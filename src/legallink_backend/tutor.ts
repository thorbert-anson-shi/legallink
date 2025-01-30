/**
 * file: rag.ts
 */

import "cheerio"; // Memastikan Cheerio tersedia, sesuai kebutuhan CheerioWebBaseLoader
import { z } from "zod";

// LangChain & LangGraph imports
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { VertexAIEmbeddings } from "@langchain/google-vertexai";
import { ChatVertexAI } from "@langchain/google-vertexai";
import { MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  BaseMessage,
  isAIMessage,
} from "@langchain/core/messages";
import { ToolNode, toolsCondition, createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";

//
// 1. Setup Model, Embeddings, dan VectorStore
//

// Chat model (misalnya Vertex AI)
const llm = new ChatVertexAI({
  model: "gemini-1.5-flash",
  temperature: 0,
});

// Embeddings model
const embeddings = new VertexAIEmbeddings({
  model: "text-embedding-004",
});

// Vector store in-memory
const vectorStore = new MemoryVectorStore(embeddings);

//
// 2. Memuat & Mengindeks Dokumen
//    (Menggunakan CheerioWebBaseLoader dan memecah dokumen menjadi chunk)
//

async function loadAndIndexDocs(): Promise<void> {
  const pTagSelector = "p";
  const cheerioLoader = new CheerioWebBaseLoader(
    "https://lilianweng.github.io/posts/2023-06-23-agent/",
    {
      selector: pTagSelector,
    }
  );

  // Memuat dokumen
  const docs = await cheerioLoader.load();

  // Memecah dokumen menggunakan text splitter
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const allSplits = await splitter.splitDocuments(docs);

  // Menambahkan potongan dokumen ke VectorStore
  await vectorStore.addDocuments(allSplits);
}

//
// 3. Definisi Tool 'retrieve'
//    (menggunakan Zod untuk validasi argumen dan menyiapkan responseFormat).
//

const retrieveSchema = z.object({
  query: z.string(),
});
type RetrieveSchema = z.infer<typeof retrieveSchema>;

const retrieve = tool<RetrieveSchema>(
  async ({ query }) => {
    const retrievedDocs = await vectorStore.similaritySearch(query, 2);

    // Serialize (bisa dipakai di pesan AI, misalnya)
    const serialized = retrievedDocs
      .map(
        (doc) => `Source: ${doc.metadata.source}\nContent: ${doc.pageContent}`
      )
      .join("\n");

    // Return: 
    //  - Elemen pertama array untuk menampilkan di pesan
    //  - Elemen kedua adalah 'artifact' dokumen aslinya (bila dibutuhkan)
    return [serialized, retrievedDocs];
  },
  {
    name: "retrieve",
    description: "Retrieve information related to a query.",
    schema: retrieveSchema,
    responseFormat: "content_and_artifact",
  }
);

//
// 4. Membuat 'Chain' Sederhana untuk Conversational RAG
//    - Node 1: queryOrRespond
//    - Node 2: tools (eksekusi retrieval)
//    - Node 3: generate (menggabungkan context & menjawab)
//

// Fungsi 1: Generate AIMessage yang mungkin mengandung tool-call
async function queryOrRespond(
  state: typeof MessagesAnnotation.State
): Promise<Partial<typeof MessagesAnnotation.State>> {
  const llmWithTools = llm.bindTools([retrieve]);
  const response = await llmWithTools.invoke(state.messages);
  // Menambahkan message ke state
  return { messages: [response] };
}

// Node untuk mengeksekusi tool 'retrieve'
const toolsNode = new ToolNode([retrieve]);

// Fungsi 2: Generate jawaban final berdasarkan 'ToolMessage' terakhir
async function generate(
  state: typeof MessagesAnnotation.State
): Promise<Partial<typeof MessagesAnnotation.State>> {
  // Kumpulkan ToolMessage terbaru (jika ada)
  const recentToolMessages: ToolMessage[] = [];
  for (let i = state.messages.length - 1; i >= 0; i--) {
    const message = state.messages[i];
    if (message instanceof ToolMessage) {
      recentToolMessages.push(message);
    } else {
      break;
    }
  }
  const toolMessages = recentToolMessages.reverse();

  // Buat prompt
  const docsContent = toolMessages.map((doc) => doc.content).join("\n");
  const systemMessageContent =
    "You are an assistant for question-answering tasks. " +
    "Use the following pieces of retrieved context to answer " +
    "the question. If you don't know the answer, say that you " +
    "don't know. Use three sentences maximum and keep the answer concise." +
    "\n\n" +
    `${docsContent}`;

  // Saring pesan percakapan yang relevan: Human, System, AI(tanpa tool calls)
  const conversationMessages = state.messages.filter(
    (message) =>
      message instanceof HumanMessage ||
      message instanceof SystemMessage ||
      (message instanceof AIMessage && message.tool_calls.length === 0)
  );

  const prompt = [
    new SystemMessage(systemMessageContent),
    ...conversationMessages,
  ];

  // Eksekusi final
  const response = await llm.invoke(prompt);
  return { messages: [response] };
}

// Bangun graph
const graphBuilder = new StateGraph(MessagesAnnotation)
  .addNode("queryOrRespond", queryOrRespond)
  .addNode("tools", toolsNode)
  .addNode("generate", generate)
  .addEdge("__start__", "queryOrRespond")
  // Jika AIMessage TIDAK memanggil tool, akhiri. Kalau memanggil tool, ke "tools".
  .addConditionalEdges("queryOrRespond", toolsCondition, {
    __end__: "__end__",
    tools: "tools",
  })
  .addEdge("tools", "generate")
  .addEdge("generate", "__end__");

const graph = graphBuilder.compile();

//
// 5. Fungsi untuk mencetak isi percakapan ke konsol secara rapi
//

function prettyPrint(message: BaseMessage) {
  let txt = `[${message._getType()}]: ${message.content}`;
  // Tampilkan tool calls jika ada
  if (isAIMessage(message) && message.tool_calls && message.tool_calls.length > 0) {
    const toolCalls = message.tool_calls
      .map((tc) => `- ${tc.name}(${JSON.stringify(tc.args)})`)
      .join("\n");
    txt += `\nTools:\n${toolCalls}`;
  }
  console.log(txt);
}

//
// 6. Menjalankan contoh 'Chain' + (opsional) Memory
//    - Menggunakan MemorySaver (in-memory) sebagai contohnya
//

async function runChainExamplesWithMemory() {
  // Inisialisasi memory
  const checkpointer = new MemorySaver();
  const graphWithMemory = graphBuilder.compile({ checkpointer });

  // Contoh 1: Pesan user "Hello"
  const inputs1 = {
    messages: [{ role: "user", content: "Hello" }],
  };

  console.log("=== Running first user message (no retrieval) ===");
  for await (const step of await graphWithMemory.stream(inputs1, {
    configurable: { thread_id: "thread1" },
    streamMode: "values",
  })) {
    const lastMessage = step.messages[step.messages.length - 1];
    prettyPrint(lastMessage);
    console.log("-----");
  }

  // Contoh 2: Pesan user "What is Task Decomposition?"
  const inputs2 = {
    messages: [{ role: "user", content: "What is Task Decomposition?" }],
  };

  console.log("\n=== Running second user message (with retrieval) ===");
  for await (const step of await graphWithMemory.stream(inputs2, {
    configurable: { thread_id: "thread1" },
    streamMode: "values",
  })) {
    const lastMessage = step.messages[step.messages.length - 1];
    prettyPrint(lastMessage);
    console.log("-----");
  }

  // Contoh 3: Pertanyaan lanjutan - "Can you look up some common ways of doing it?"
  const inputs3 = {
    messages: [{ role: "user", content: "Can you look up some common ways of doing it?" }],
  };

  console.log("\n=== Running third user message (follow-up) ===");
  for await (const step of await graphWithMemory.stream(inputs3, {
    configurable: { thread_id: "thread1" },
    streamMode: "values",
  })) {
    const lastMessage = step.messages[step.messages.length - 1];
    prettyPrint(lastMessage);
    console.log("-----");
  }
}

//
// 7. Contoh Penggunaan *Agent* (ReAct)
//

async function runAgentExample() {
  // Membuat ReAct Agent minimal
  const agentGraph = createReactAgent({
    llm,
    tools: [retrieve],
  });

  // Contoh query yang memicu beberapa langkah tool retrieval
  const inputMessage = `What is the standard method for Task Decomposition?
Once you get the answer, look up common extensions of that method.`;

  console.log("\n=== Running ReAct Agent Example ===");
  const inputs = {
    messages: [{ role: "user", content: inputMessage }],
  };

  for await (const step of await agentGraph.stream(inputs, {
    streamMode: "values",
  })) {
    const lastMessage = step.messages[step.messages.length - 1];
    prettyPrint(lastMessage);
    console.log("-----");
  }
}

//
// 8. Fungsi main untuk mengeksekusi semua contoh
//
async function main() {
  console.log("Memuat dan mengindeks dokumen...");
  await loadAndIndexDocs();

  console.log("=== Mulai Contoh Chain dengan Memory ===");
  await runChainExamplesWithMemory();

  console.log("=== Mulai Contoh Agent ===");
  await runAgentExample();
}

// Jalankan jika file ini dieksekusi secara langsung:
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("Error running main:", err);
    process.exit(1);
  });
}

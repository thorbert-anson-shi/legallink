import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
// import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { ChatVertexAI } from "@langchain/google-vertexai";
import { VertexAIEmbeddings } from "@langchain/google-vertexai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  BaseMessage,
} from "@langchain/core/messages";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
// import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { Document } from "@langchain/core/documents";
import fs from "fs";
import pdfParse from "pdf-parse";


// 1. Inisialisasi komponen utama
async function initializeComponents() {
  const llm = new ChatVertexAI({
    model: "gemini-1.5-flash",
    temperature: 0
  });

  const embeddings = new VertexAIEmbeddings({
    model: "text-embedding-004"
  });

  const vectorStore = new MemoryVectorStore(embeddings);
  
  return { llm, embeddings, vectorStore };
}

// ✅ Fungsi untuk membaca & mengekstrak teks dari PDF menggunakan pdf-parse
async function loadPDF(path: string): Promise<string> {
    try {
      const dataBuffer = fs.readFileSync(path);
      const pdfData = await pdfParse(dataBuffer);
      return pdfData.text; // Mengambil teks dari PDF
    } catch (error) {
      console.error(`❌ Gagal memproses PDF: ${path}`, error);
      return ""; // Jika gagal, kembalikan string kosong agar tidak merusak proses
    }
  }


// 2. Pemrosesan dokumen PDF
async function processLegalDocuments(vectorStore: MemoryVectorStore) {
  // Load multiple PDF documents
  const pdfPaths = [
    "src/docs/5. UU-40-2007 PERSEROAN TERBATAS.pdf",
    // "src/docs/e39ab-uu-nomor-8-tahun-1999/pdf",
    // "src\docs\Kerjasama_UMKM.pdf",
    // "src\docs\kolonial_kuh_perdata_fix.pdf",
    // "src\docs\KUH DAGANG.pdf",
    // "src\docs\UU Nomor  19 Tahun 2016.pdf",
    // "src\docs\UU Nomor 13 Tahun 2003.pdf",
    // "src/docs/UU_1999_30.pdf",
    // "src\docs\UU_Nomor_11_Tahun_2020-compressed.pdf"
  ];

  // ✅ Load semua dokumen PDF
  const pdfTexts = await Promise.all(pdfPaths.map(path => loadPDF(path)));

  // ✅ Ubah teks PDF menjadi dokumen LangChain
  const rawDocs = pdfTexts.map((text, index) => ({
    pageContent: text,
    metadata: { source: pdfPaths[index] },
  }));

  // ✅ Splitter khusus dokumen hukum (Menggunakan pemisah Pasal, BAB, dll.)
  const legalSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 2000,
    chunkOverlap: 400,
    separators: ["\n\nPasal", "\n\nBAB", "\n\nBagian", "\n\n"],
  });

  // ✅ Pisahkan dokumen menjadi chunk
  const allSplits = await legalSplitter.splitDocuments(rawDocs);

  // ✅ Tambahkan ke Vector Store
  await vectorStore.addDocuments(allSplits);

  console.log("✅ Semua dokumen hukum telah diproses dan dimasukkan ke Vector Store.");
  
  return allSplits;
}

// 3. Definisi alat retrieval
function createRetrievalTool(vectorStore: MemoryVectorStore) {
  const retrieveSchema = z.object({ query: z.string() });

  return tool(
    async ({ query }: { query: string }): Promise<[string, Document[]]> => {
      const retrievedDocs = await vectorStore.similaritySearch(query, 3);
      const serialized = retrievedDocs
        .map((doc) => `Sumber: ${doc.metadata.source}\nPasal: ${doc.metadata.page}\nIsi: ${doc.pageContent}`)
        .join("\n\n");
      return [serialized, retrievedDocs];
    },
    {
      name: "retrieve_legal_documents",
      description: "Temukan dokumen hukum yang relevan dengan query",
      schema: retrieveSchema,
      responseFormat: "content_and_artifact",
    }
  );
}

// 4. Setup RAG Graph
function setupRAGGraph(llm: ChatVertexAI, retrieve: any) {
  // Definisi node graph
  async function queryOrRespond(state: typeof MessagesAnnotation.State) {
    const llmWithTools = llm.bindTools([retrieve]);
    const response = await llmWithTools.invoke(state.messages);
    return { messages: [response] };
  }

  const tools = new ToolNode([retrieve]);

  async function generate(state: typeof MessagesAnnotation.State) {
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

    const docsContent = toolMessages.map((doc) => doc.content).join("\n");
    const systemMessageContent = `Anda adalah asisten hukum yang ahli. 
      Gunakan dokumen-dokumen berikut untuk menjawab pertanyaan:
      ${docsContent}

      JIKA TIDAK ADA DOKUMEN YANG RELEVAN:
      - Katakan "Tidak ditemukan dasar hukum yang relevan"
      - Jangan membuat jawaban dari imajinasi

      FORMAT JAWABAN:
      - Sertakan referensi pasal dan sumber dokumen
      - Gunakan bahasa Indonesia yang formal`;

    const conversationMessages = state.messages.filter(
      (message) =>
        message instanceof HumanMessage ||
        message instanceof SystemMessage ||
        (message instanceof AIMessage && !message.tool_calls?.length)
    );

    const prompt = [
      new SystemMessage(systemMessageContent),
      ...conversationMessages,
    ];

    const response = await llm.invoke(prompt);
    return { messages: [response] };
  }

  // Bangun graph
  const graphBuilder = new StateGraph(MessagesAnnotation)
    .addNode("queryOrRespond", queryOrRespond)
    .addNode("tools", tools)
    .addNode("generate", generate)
    .addEdge("__start__", "queryOrRespond")
    .addConditionalEdges("queryOrRespond", toolsCondition, {
      __end__: "__end__",
      tools: "tools",
    })
    .addEdge("tools", "generate")
    .addEdge("generate", "__end__");

  const graph = graphBuilder.compile();
  const checkpointer = new MemorySaver();
  const graphWithMemory = graphBuilder.compile({ checkpointer });

  return { graph, graphWithMemory };
}

// 5. Fungsi utilitas
function prettyPrint(message: BaseMessage): void {
  let txt = `[${message._getType()}]: ${message.content}`;
  if (message instanceof AIMessage && message.tool_calls?.length) {
    const toolCalls = message.tool_calls
      .map((tc) => `- ${tc.name}(${JSON.stringify(tc.args)})`)
      .join("\n");
    txt += `\nTools:\n${toolCalls}`;
  }
  console.log(txt);
}

// 6. Contoh penggunaan
async function runExamples(graph: any, graphWithMemory: any) {
  const threadConfig = {
    configurable: { thread_id: "legal_case_123" },
    streamMode: "values" as const,
  };

  // Contoh 1: Pertanyaan umum
  const contoh1 = {
    messages: [new HumanMessage("Apa sanksi untuk tindak pidana korupsi?")]
  };

  console.log("\n=== Contoh 1 ===");
  for await (const step of await graph.stream(contoh1, { streamMode: "values" })) {
    const lastMessage = step.messages[step.messages.length - 1];
    prettyPrint(lastMessage);
    console.log("-----\n");
  }

  // Contoh 2: Percakapan lanjutan
  const contoh2 = {
    messages: [new HumanMessage("Apakah ada pengecualian untuk sanksi tersebut?")]
  };

  console.log("\n=== Contoh 2 ===");
  for await (const step of await graphWithMemory.stream(contoh2, threadConfig)) {
    const lastMessage = step.messages[step.messages.length - 1];
    prettyPrint(lastMessage);
    console.log("-----\n");
  }
}

// 7. Main function
export async function main() {
  try {
    // Inisialisasi komponen
    const { llm, vectorStore } = await initializeComponents();
    
    // Proses dokumen hukum
    await processLegalDocuments(vectorStore);
    
    // Buat alat retrieval
    const retrieve = createRetrievalTool(vectorStore);
    
    // Setup RAG graph
    const { graph, graphWithMemory } = setupRAGGraph(llm, retrieve);
    
    // Jalankan contoh
    await runExamples(graph, graphWithMemory);
  } catch (error) {
    console.error("Terjadi kesalahan:", error);
  }
}

// Jalankan aplikasi
main();
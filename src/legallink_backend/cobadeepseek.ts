import "cheerio";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
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
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { Document } from "@langchain/core/documents";

(async () => {
// Initialize models and vector store
const llm = new ChatVertexAI({
  model: "gemini-1.5-flash",
  temperature: 0
});

const embeddings = new VertexAIEmbeddings({
  model: "text-embedding-004"
});

const vectorStore = new MemoryVectorStore(embeddings);

// Load and process documents
const pTagSelector = "p";
const cheerioLoader = new CheerioWebBaseLoader(
  "https://lilianweng.github.io/posts/2023-06-23-agent/",
  { selector: pTagSelector }
);

const docs: Document[] = await cheerioLoader.load();

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});
const allSplits: Document[] = await splitter.splitDocuments(docs);

// Index documents
await vectorStore.addDocuments(allSplits);

// Define retrieval tool
const retrieveSchema = z.object({ query: z.string() });

const retrieve = tool(
  async ({ query }: { query: string }): Promise<[string, Document[]]> => {
    const retrievedDocs = await vectorStore.similaritySearch(query, 2);
    const serialized = retrievedDocs
      .map((doc) => `Source: ${doc.metadata.source}\nContent: ${doc.pageContent}`)
      .join("\n");
    return [serialized, retrievedDocs];
  },
  {
    name: "retrieve",
    description: "Retrieve information related to a query.",
    schema: retrieveSchema,
    responseFormat: "content_and_artifact",
  }
);

// Define graph nodes
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
  const systemMessageContent = `You are an assistant for question-answering tasks. 
    Use the following pieces of retrieved context to answer the question. 
    If you don't know the answer, say that you don't know. 
    Use three sentences maximum and keep the answer concise.\n\n${docsContent}`;

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

// Build and compile the graph
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

// Utility function for printing messages
const prettyPrint = (message: BaseMessage): void => {
  let txt = `[${message._getType()}]: ${message.content}`;
  if (message instanceof AIMessage && message.tool_calls?.length) {
    const toolCalls = message.tool_calls
      .map((tc) => `- ${tc.name}(${JSON.stringify(tc.args)})`)
      .join("\n");
    txt += `\nTools:\n${toolCalls}`;
  }
  console.log(txt);
};

// State management setup
const checkpointer = new MemorySaver();
const graphWithMemory = graphBuilder.compile({ checkpointer });

const threadConfig = {
  configurable: { thread_id: "abc123" },
  streamMode: "values" as const,
};

// Test examples
async function runExamples() {
  // First example
  const inputs1 = { messages: [new HumanMessage("Hello")] };
  for await (const step of await graph.stream(inputs1, { streamMode: "values" })) {
    const lastMessage = step.messages[step.messages.length - 1];
    prettyPrint(lastMessage);
    console.log("-----\n");
  }

  // Second example
  const inputs2 = { messages: [new HumanMessage("What is Task Decomposition?")] };
  for await (const step of await graph.stream(inputs2, { streamMode: "values" })) {
    const lastMessage = step.messages[step.messages.length - 1];
    prettyPrint(lastMessage);
    console.log("-----\n");
  }

  // Stateful example
  const inputs3 = { messages: [new HumanMessage("What is Task Decomposition?")] };
  for await (const step of await graphWithMemory.stream(inputs3, threadConfig)) {
    const lastMessage = step.messages[step.messages.length - 1];
    prettyPrint(lastMessage);
    console.log("-----\n");
  }

  // Agent example
  const agent = createReactAgent({ llm, tools: [retrieve] });
  const inputMessage = `What is the standard method for Task Decomposition?
    Once you get the answer, look up common extensions of that method.`;
  
  const inputs5 = { messages: [new HumanMessage(inputMessage)] };
  for await (const step of await agent.stream(inputs5, { streamMode: "values" })) {
    const lastMessage = step.messages[step.messages.length - 1];
    prettyPrint(lastMessage);
    console.log("-----\n");
  }
}

runExamples().catch(console.error);
});
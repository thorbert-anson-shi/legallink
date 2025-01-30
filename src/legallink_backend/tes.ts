import { ChatVertexAI } from "@langchain/google-vertexai";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

import { PDFLoader } from "langchain/document_loaders/fs/pdf";

import * as dotenv from "dotenv";

import { BaseLanguageModel } from "langchain/base_language";


dotenv.config();

// ########################################
// #### LOGIC TO POPULATE VECTOR STORE ####
// ########################################

// Fungsi untuk memuat dokumen dan membuat Vector Store
async function loadVectorStore(): Promise<MemoryVectorStore> {
  const filePaths: string[] = [
    "Docs/UU-40-2007-PERSEROAN-TERBATAS.pdf",
    "Docs/UU-13-2003-KETENAGAKERJAAN.pdf",
    "Docs/UU-19-2016-ITE.pdf",
  ];

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 100,
  });

  let allDocs: any[] = [];

  for (const filePath of filePaths) {
    const loader = new PDFLoader(filePath);
    const rawDocs = await loader.load();
    const splitDocs = await textSplitter.splitDocuments(rawDocs);
    allDocs.push(...splitDocs);
  }

  // Inisialisasi embeddings
  const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "models/embedding-001",
  });

  // Buat Vector Store dari dokumen yang telah diproses
  return MemoryVectorStore.fromDocuments(allDocs, embeddings);
}

// ###########################################
// #### LOGIC TO ANSWER FROM VECTOR STORE ####
// ###########################################

async function setupRAG() {
  const vectorstore = await loadVectorStore();

  // Buat retriever dari Vector Store
  const retriever = vectorstore.asRetriever({ k: 10 });

  // Inisialisasi model LLM
  const llm = new ChatVertexAI({
    model: "gemini-1.5-flash", // Bisa diganti ke "gemini-1.5-pro"
    temperature: 0.2,
    maxOutputTokens: 8192,
  });
  
  // Prompt untuk HistoryAwareRetriever
  const retrieverPrompt = ChatPromptTemplate.fromMessages([
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
    [
      "human",
      "Given the above conversation, generate a search query to look up in order to get information relevant to the conversation.",
    ],
  ]);

  // Buat HistoryAwareRetriever untuk memahami konteks percakapan
  const retrieverChain = await createHistoryAwareRetriever({
    llm:llm,
    retriever,
    rephrasePrompt: retrieverPrompt,
  });

  // Fake chat history
  const chatHistory: (HumanMessage | AIMessage)[] = [
    new HumanMessage("Apa itu PT dalam hukum Indonesia?"),
    new AIMessage("PT adalah Perseroan Terbatas, yang diatur dalam UU No. 40 Tahun 2007."),
  ];

  // Prompt utama untuk sistem
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "Jawablah pertanyaan pengguna berdasarkan konteks berikut: {context}."],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
  ]);

  // Buat chain untuk menggabungkan dokumen dan chatbot
  const chain = await createStuffDocumentsChain({
    llm,
    prompt,
  });

  // Gabungkan retriever dengan chain untuk membentuk pipeline akhir
  const conversationChain = await createRetrievalChain({
    combineDocsChain: chain,
    retriever: retrieverChain,
  });

  return { conversationChain, chatHistory };
}

// ###########################################
// #### CHATBOT EXECUTION FUNCTION ####
// ###########################################

async function chatWithBot(question: string) {
  const { conversationChain, chatHistory } = await setupRAG();

  // Kirim pertanyaan dengan history chat ke chatbot
  const response = await conversationChain.invoke({
    chat_history: chatHistory,
    input: question,
  });

  console.log(response);
}

// Eksekusi chatbot dengan contoh pertanyaan
chatWithBot("Bagaimana cara mendirikan PT?");

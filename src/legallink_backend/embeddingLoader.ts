import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "langchain/document";
import { Chroma } from "langchain/vectorstores/chroma";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import dotenv from "dotenv";

dotenv.config();

let vectorStore: Chroma | null = null;
let isLoaded = false;

export async function loadEmbeddings(): Promise<Chroma> {
  if (isLoaded && vectorStore) return vectorStore;

  const filePaths = [
    "Docs/UU-40-2007-PERSEROAN-TERBATAS.pdf",
    "Docs/UU-13-2003-KETENAGAKERJAAN.pdf",
    "Docs/UU-19-2016-ITE.pdf",
  ];

  const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });

  let allDocs: Document[] = [];
  for (const pdfFile of filePaths) {
    const loader = new PDFLoader(pdfFile);
    const rawDocs = await loader.load();
    const splittedDocs = await textSplitter.splitDocuments(rawDocs);
    allDocs.push(...splittedDocs);
  }

  console.log("[EmbeddingLoader] Total documents loaded:", allDocs.length);

  const embedding = new GoogleGenerativeAIEmbeddings({
    model: "models/embedding-001",
  });

  vectorStore = await Chroma.fromDocuments(allDocs, embedding, {
    collectionName: "legal_documents",
    url: "http://localhost:8000", // Jika menjalankan Chroma lokal, sesuaikan jika pakai cloud
  });

  isLoaded = true;
  console.log("[EmbeddingLoader] Vector Store created.");

  return vectorStore;
}

export async function getVectorStore(): Promise<Chroma> {
  return isLoaded && vectorStore ? vectorStore : await loadEmbeddings();
}

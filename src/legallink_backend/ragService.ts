import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate, MessagesPlaceholder } from "langchain-core/prompts";
import { HumanMessage, AIMessage } from "langchain-core/messages";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { RunnableParallel } from "langchain/schema/runnable";
import { getVectorStore } from "./embeddingLoader";
import { ChatMessageHistory } from "langchain/stores/message/in_memory"; // ✅ Gunakan ChatMessageHistory
import { RedisChatMessageHistory } from "@langchain/redis"; // ✅ Perbaikan: Gunakan import dari @langchain/redis
import dotenv from "dotenv";

dotenv.config();

let initialized = false;
let chatChain: any;

const systemPrompt = `
Anda adalah AI hukum yang sangat terlatih. 
Gunakan dokumen relevan sebagai referensi dalam menjawab pertanyaan pengguna.
Jawablah dengan jelas, akurat, dan profesional.
`;

const contextualizeSystemPrompt = `
Anda adalah AI yang membantu pengguna memahami hukum. 
Jika pertanyaan merujuk ke konteks sebelumnya, reformulasikan agar menjadi pertanyaan mandiri yang jelas.
`;

// 🔹 Inisialisasi RAG
export async function initRAG() {
  if (initialized) return;
  
  const vectorStore = await getVectorStore();
  const chatLLM = new ChatGoogleGenerativeAI({
    model: "gemini-1.5-pro",
    temperature: 0.2,
    topP: 0.95,
    topK: 40,
  });

  const baseRetriever = vectorStore.asRetriever({
    searchType: "similarity",
    k: 10,
  });

  const contextualizePrompt = ChatPromptTemplate.fromMessages([
    ["system", contextualizeSystemPrompt],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
  ]);
  
  const chatbotPrompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
  ]);

  // ✅ Pilih penyimpanan history chat (Redis atau ChatMessageHistory)
  const getMessageHistory = (sessionId: string) => {
    if (process.env.REDIS_URL) {
      return new RedisChatMessageHistory({
        sessionId,
        url: process.env.REDIS_URL,
      });
    }
    return new ChatMessageHistory(); // ✅ Ganti dari MemoryChatMessageHistory ke ChatMessageHistory
  };

  // ✅ Buat history-aware retriever
  const historyAwareRetriever = RunnableParallel.from([
    baseRetriever,
    chatLLM.bind({}), // ✅ Perbaikan: Gunakan `bind({})` langsung untuk menghindari `_streamEvents` error
  ]).map(([retrievedDocs]) => retrievedDocs);

  // ✅ Buat chain yang menggabungkan dokumen + chatbot
  const stuffChainChatbot = createStuffDocumentsChain(chatLLM, chatbotPrompt); // ✅ Tetap gunakan createStuffDocumentsChain()

  // ✅ Pipeline RAG dengan history-aware retriever
  chatChain = RunnableParallel.from([
    {
      context: historyAwareRetriever,
      question: (input) => input.input, // ✅ Mapping input
      history: (input) => input.chat_history, // ✅ Mapping chat history
    },
  ]).pipe(stuffChainChatbot);

  initialized = true;
  console.log("[RAG Service] Initialized.");
}

// 🔹 Fungsi utama untuk chatbot
export async function chatWithBot(question: string, history: (HumanMessage | AIMessage)[]) {
  if (!initialized) await initRAG();

  const response = await chatChain.invoke({
    input: question,
    chat_history: history,
  });

  const answer = response.answer ?? "";

  const newHistory = [
    ...history,
    new HumanMessage(question),
    new AIMessage(answer),
  ];

  return { answer, newHistory };
}

import React from "react";
import ReactDOM from "react-dom/client";

// Required for tailwind and custom styling
import "./index.css";

// Page routing and navigation
import { BrowserRouter, Route, Routes } from "react-router";

// Pages
import { Home, AnalysisPage, ChatPage } from "./pages";

const root: HTMLElement = document.getElementById("root")!;

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route index element={<Home />} />
        <Route path="/analyze" element={<AnalysisPage />} />
        <Route path="/chat" element={<ChatPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);

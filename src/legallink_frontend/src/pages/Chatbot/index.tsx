import { useState } from "react";

export function ChatPage() {
  function sendMessage(formData: FormData) {}

  const [history, setHistory] = useState<string>("");

  return (
    <main className="flex">
      <div id="chat-space" className=""></div>
      <div id="chat-box">
        <form action={sendMessage}>
          <input type="text" name="message" id="message-input" />
          <input type="submit" hidden />
        </form>
      </div>
    </main>
  );
}

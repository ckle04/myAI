"use client";

import ChatInput from "@/components/chat/input";
import ChatMessages from "@/components/chat/messages";
import { useApp } from "@/hooks/use-app";
import ChatHeader from "@/components/chat/header";

export default function Chat() {
  const {
  messages,
  handleUserMessage, // This exists in use-app.ts
  isStreaming, // This exists in use-app.ts
} = useApp();


  return (
    <>
      <ChatHeader />
      <div className="flex justify-center items-center h-screen">
        <div className="flex flex-col max-w-screen-lg w-full h-full p-5">
          <ChatMessages messages={messages} indicatorState={indicatorState} />
        </div>
      </div>
      <ChatInput
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        input={input}
        isLoading={isLoading}
      />
    </>
  );
}

"use client";

import { useApp } from "@/hooks/use-app"; // ✅ Ensure named import
import ChatHeader from "@/components/chat/header";
import ChatMessages from "@/components/chat/messages";
import ChatInput from "@/components/chat/input";

/**
 * The main chat page component.
 */
export default function Chat() {
  const {
    messages,
    handleUserMessage,
    handleInputChange,
    handleSubmit,
    input,
    isStreaming,
    clearMessages, // ✅ Now properly imported
  } = useApp();

  return (
    <>
      {/* Chat Header with Clear Messages Button */}
      <ChatHeader clearMessages={clearMessages} /> 

      {/* Chat Container */}
      <div className="flex justify-center items-center h-screen">
        <div className="flex flex-col max-w-screen-lg w-full h-full p-5">
          {/* Chat Messages */}
          <ChatMessages messages={messages} />

          {/* Chat Input */}
          <ChatInput
            input={input}
            handleInputChange={handleInputChange}
            handleSubmit={handleSubmit}
            isLoading={isStreaming}
          />
        </div>
      </div>
    </>
  );
}

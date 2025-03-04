"use client";

import { useEffect, useRef, useState } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { Message } from "../types/chat";

/**
 * Example usage:
 *   const { messages, isStreaming, handleUserMessage } = useApp();
 *   ...
 *   handleUserMessage("market TSLA");
 *
 * It checks if the user typed "market" and calls /api/market-data.
 * Otherwise, it calls /api/chat with streaming (via fetchEventSource).
 */
export function useApp() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // We use a ref to store the current abort controller, so we can cancel streaming if needed
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * handleUserMessage: the main entry point to process new user chat messages
   */
  async function handleUserMessage(userInput: string) {
    if (!userInput.trim()) return;

    // 1. Add the user’s message to the chat state
    const newUserMessage: Message = {
      role: "user",
      content: userInput,
    };
    setMessages((prev) => [...prev, newUserMessage]);

    // 2. Check if it starts with "market" (simple check)
    if (userInput.toLowerCase().startsWith("market")) {
      const parts = userInput.split(" ");
      const symbol = parts[1] || "SPY"; // default if none

      // 2a. Fetch from /api/market-data?symbol=...
      const marketUrl = `/api/market-data?symbol=${symbol}`;

      try {
        const res = await fetch(marketUrl);
        const data = await res.json();

        // If successful, data might have { role, content } or { error }
        if (data.role && data.content) {
          setMessages((prev) => [...prev, data]);
        } else if (data.error) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.error },
          ]);
        }
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Error fetching market data." },
        ]);
      }

      // 2b. End here, so we don’t proceed to streaming from /api/chat
      return;
    }

    // 3. If not a "market" command, proceed with your normal streaming AI call
    await streamAiResponse(userInput);
  }

  /**
   * Streams the AI response from /api/chat using fetch-event-source
   */
  async function streamAiResponse(userInput: string) {
    setIsStreaming(true);

    // Cancel any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      // fetchEventSource is from @microsoft/fetch-event-source
      await fetchEventSource("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInput }),
        signal: abortControllerRef.current.signal,
        onmessage: (event) => {
          if (event.data === "[DONE]") {
            // End of stream
            setIsStreaming(false);
            abortControllerRef.current = null;
            return;
          }

          // Otherwise, append the streamed token to the assistant message
          const token = event.data;
          setMessages((prevMessages) => {
            const lastMessage = prevMessages[prevMessages.length - 1];

            // If last message is assistant, append the token
            if (lastMessage && lastMessage.role === "assistant") {
              const updatedMessage = {
                ...lastMessage,
                content: lastMessage.content + token,
              };
              return [...prevMessages.slice(0, -1), updatedMessage];
            } else {
              // Otherwise, create a new assistant message
              const newAssistantMessage: Message = {
                role: "assistant",
                content: token,
              };
              return [...prevMessages, newAssistantMessage];
            }
          });
        },
        onerror: (err) => {
          console.error("EventSource onerror:", err);
          setIsStreaming(false);
          abortControllerRef.current = null;
        },
        onclose: () => {
          // The server closed the stream
          setIsStreaming(false);
          abortControllerRef.current = null;
        },
      });
    } catch (error) {
      console.error("Error in streamAiResponse:", error);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }

  /**
   * Cleanup on unmount: if the component using this hook unmounts,
   * we abort the ongoing stream (if any).
   */
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    messages,
    isStreaming,
    handleUserMessage,
  };
}


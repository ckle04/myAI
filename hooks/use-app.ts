"use client";

import { useEffect, useRef, useState } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { Message } from "../types/chat";

/**
 * Hook that manages chat messages, streaming responses, and market data requests.
 */
export function useApp() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(""); // Track input value
  const [isStreaming, setIsStreaming] = useState(false);

  // Ref to store the current abort controller for streaming
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Handles user message input
   */
  async function handleUserMessage(userInput: string) {
    if (!userInput.trim()) return;

    // 1. Add user's message to the chat state
    const newUserMessage: Message = {
      role: "user",
      content: userInput,
    };
    setMessages((prev) => [...prev, newUserMessage]);

    // 2. Check if it starts with "market" (simple check)
    if (userInput.toLowerCase().startsWith("market")) {
      const parts = userInput.split(" ");
      const symbol = parts[1] || "SPY"; // Default to SPY if no symbol is given

      // Fetch market data
      const marketUrl = `/api/market-data?symbol=${symbol}`;

      try {
        const res = await fetch(marketUrl);
        const data = await res.json();

        // If successful, data should contain { role: 'assistant', content: '...' }
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

      return; // Don't proceed with AI response streaming
    }

    // 3. If not a "market" command, proceed with streaming AI response
    await streamAiResponse(userInput);
  }

  /**
   * Streams AI response from /api/chat using fetch-event-source
   */
  async function streamAiResponse(userInput: string) {
    setIsStreaming(true);

    // Cancel any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      await fetchEventSource("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInput }),
        signal: abortControllerRef.current.signal,
        onmessage: (event) => {
          if (event.data === "[DONE]") {
            setIsStreaming(false);
            abortControllerRef.current = null;
            return;
          }

          // Append the streamed token to the assistant message
          const token = event.data;
          setMessages((prevMessages) => {
            const lastMessage = prevMessages[prevMessages.length - 1];

            if (lastMessage && lastMessage.role === "assistant") {
              const updatedMessage = {
                ...lastMessage,
                content: lastMessage.content + token,
              };
              return [...prevMessages.slice(0, -1), updatedMessage];
            } else {
              return [
                ...prevMessages,
                { role: "assistant", content: token },
              ];
            }
          });
        },
        onerror: (err) => {
          console.error("EventSource error:", err);
          setIsStreaming(false);
          abortControllerRef.current = null;
        },
        onclose: () => {
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
   * Clears all chat messages
   */
  function clearMessages() {
    setMessages([]);
  }

  /**
   * Handles input changes for the chat input field
   */
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInput(e.target.value);
  }

  /**
   * Handles chat message submission
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    await handleUserMessage(input);
    setInput(""); // Clear input field
  }

  /**
   * Cleanup: Abort any ongoing streaming when component unmounts
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
    handleInputChange,
    handleSubmit,
    input,
    clearMessages, // ✅ Ensures clearMessages exists
  };
}

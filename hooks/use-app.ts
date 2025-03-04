'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source'; // Make sure you have this installed!
import { Message } from '../types/chat'; // Adjust the import based on how your "Message" type is defined

/**
 * This is a simplified version that:
 *   - Tracks chat messages in state.
 *   - Sends user commands to either /api/market-data (for "market" commands) or /api/chat (for normal ones).
 *   - Appends server responses to the messages array.
 *
 * Adjust it to match your project’s actual types, endpoints, and error handling.
 */

export function useApp() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // You might have more states/refs here—like an abort controller, etc.
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Primary method to handle user input from your chat <input>.
   */
  async function handleUserMessage(userInput: string) {
    if (!userInput.trim()) return;

    // 1) Add the user’s message to the chat
    const newUserMessage: Message = {
      role: 'user',
      content: userInput,
    };
    setMessages((prev) => [...prev, newUserMessage]);

    // 2) Check if this is a “market” command
    if (userInput.toLowerCase().startsWith('market')) {
      // e.g. userInput = "market TSLA" => symbol = "TSLA"
      const parts = userInput.split(' ');
      const symbol = parts[1] || 'SPY';

      // 2a) Call the /api/market-data route (GET request, passing symbol as query param)
      const marketUrl = `/api/market-data?symbol=${symbol}`;

      try {
        const res = await fetch(marketUrl);
        const data = await res.json();

        // If successful, data has shape { role: 'assistant', content: 'My trading recommendation...' }
        if (data.role && data.content) {
          setMessages((prev) => [...prev, data]); // Add to chat
        } else if (data.error) {
          // If there's an error field, show that
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: data.error },
          ]);
        }
      } catch (error) {
        // In case /api/market-data fails entirely
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Error fetching market data.' },
        ]);
      }

      // Done handling “market” command, so return
      return;
    }

    // 3) Otherwise, call the normal /api/chat route (streaming GPT or similar)
    await streamAiResponse(userInput);
  }

  /**
   * Streams an assistant response from /api/chat and appends tokens as they arrive.
   * Replace with whatever your existing code was if you had something similar.
   */
  async function streamAiResponse(userInput: string) {
    setIsStreaming(true);

    // Cancel any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetchEventSource('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userInput }),
        signal: abortControllerRef.current.signal,
        onmessage: (event) => {
          // The server might send a “DONE” event to close
          if (event.data === '[DONE]') {
            setIsStreaming(false);
            abortControllerRef.current = null;
            return;
          }

          // Otherwise, event.data is the next chunk of the assistant’s response
          const token = event.data;
          setMessages((prevMessages) => {
            // Insert or update the last assistant message
            const lastMessage = prevMessages[prevMessages.length - 1];

            // If the last message was from the assistant, append
            if (lastMessage && lastMessage.role === 'assistant') {
              const updatedMessage = {
                ...lastMessage,
                content: lastMessage.content + token,
              };
              return [...prevMessages.slice(0, -1), updatedMessage];
            } else {
              // Otherwise, create a new assistant message
              const newAssistantMessage: Message = {
                role: 'assistant',
                content: token,
              };
              return [...prevMessages, newAssistantMessage];
            }
          });
        },
        onerror: (error) => {
          console.error('EventSource error:', error);
          setIsStreaming(false);
          abortControllerRef.current = null;
        },
        onclose: () => {
          // The server closed th

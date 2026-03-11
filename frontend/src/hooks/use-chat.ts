"use client";

import { useState, useCallback, useRef } from "react";
import { useAccount, useChainId } from "wagmi";
import { usePathname } from "next/navigation";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const { isConnected } = useAccount();
  const chainId = useChainId();
  const pathname = usePathname();

  const sendMessage = useCallback(
    async (content: string) => {
      const userMessage: ChatMessage = { role: "user", content };
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setIsLoading(true);

      // Abort any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedMessages,
            context: {
              chainId,
              isConnected,
              currentPage: pathname,
            },
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error("Chat request failed");
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let assistantContent = "";

        // Add placeholder assistant message
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.text) {
                  assistantContent += data.text;
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      role: "assistant",
                      content: assistantContent,
                    };
                    return updated;
                  });
                }
              } catch {
                // Skip malformed lines
              }
            }
          }
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setMessages((prev) => [
            ...prev.filter((m) => m.role !== "assistant" || m.content !== ""),
            {
              role: "assistant",
              content: "Sorry, I had trouble responding. Please try again.",
            },
          ]);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [messages, chainId, isConnected, pathname]
  );

  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setIsLoading(false);
  }, []);

  return { messages, isLoading, sendMessage, clearChat };
}

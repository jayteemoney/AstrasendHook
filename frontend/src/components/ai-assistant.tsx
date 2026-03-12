"use client";

import { useState, useRef, useEffect } from "react";
import { useChat, type ChatMessage } from "@/hooks/use-chat";

const SUGGESTED_QUESTIONS = [
  "How do I send money?",
  "What are the fees?",
  "Which chain should I use?",
  "How do group contributions work?",
  "Can I cancel a remittance?",
  "What is auto-release?",
  "Is my money safe in escrow?",
  "What's the daily send limit?",
  "How do I receive money?",
  "What is World ID compliance?",
];

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, isLoading, sendMessage, clearChat } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput("");
  };

  const handleSuggestion = (q: string) => {
    if (isLoading) return;
    sendMessage(q);
    chipsRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg transition-all hover:scale-105 hover:bg-emerald-500 sm:bottom-6 sm:right-6"
          aria-label="Open Astra AI Assistant"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-5 right-4 z-50 flex w-[calc(100vw-2rem)] flex-col rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl sm:bottom-6 sm:right-6 sm:w-[390px]" style={{ height: "min(560px, 85vh)" }}>
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-700 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white shadow-sm">
                A
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Astra</h3>
                <p className="text-xs text-zinc-400">AstraSend AI Guide</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                  aria-label="Clear chat"
                  title="Clear conversation"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                aria-label="Close"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-xl font-bold text-white">
                  A
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-200">Hi, I&apos;m Astra</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Your guide to AstraSend. Ask me anything about sending money,
                    fees, or how it all works.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg: ChatMessage, i: number) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="mr-2 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-bold text-white">
                        A
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-emerald-600 text-white"
                          : "bg-zinc-800 text-zinc-200"
                      }`}
                    >
                      {msg.content || (
                        <span className="flex gap-1">
                          <span className="animate-bounce" style={{ animationDelay: "0ms" }}>·</span>
                          <span className="animate-bounce" style={{ animationDelay: "150ms" }}>·</span>
                          <span className="animate-bounce" style={{ animationDelay: "300ms" }}>·</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Suggested questions chips — always visible */}
          <div
            ref={chipsRef}
            className="flex shrink-0 gap-2 overflow-x-auto border-t border-zinc-800 px-4 py-2 scrollbar-hide"
          >
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => handleSuggestion(q)}
                disabled={isLoading}
                className="shrink-0 rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-emerald-600 hover:bg-emerald-900/30 hover:text-emerald-400 disabled:opacity-40"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="shrink-0 border-t border-zinc-700 px-4 py-3"
          >
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Astra anything..."
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="rounded-xl bg-emerald-600 px-3 py-2 text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m22 2-7 20-4-9-9-4z" />
                  <path d="m22 2-11 11" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

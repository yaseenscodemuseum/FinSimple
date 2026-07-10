"use client";

import { useEffect, useRef } from "react";
import type { Message } from "@/lib/types";
import { MessageBubble } from "./MessageBubble";

interface Props {
  messages: Message[];
  isLoading: boolean;
}

export function ChatArea({ messages, isLoading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-medium text-[var(--color-text-secondary)]">
            Upload a document and start chatting
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)] opacity-70">
            I&apos;ll explain your finances like you&apos;re 10
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {isLoading && (
        <div className="flex justify-start mb-4">
          <div className="rounded-2xl bg-[var(--color-bubble-ai)] backdrop-blur-md border border-[var(--color-glass-border)] px-4 py-3">
            <div className="flex gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--color-text-secondary)] animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="h-2 w-2 rounded-full bg-[var(--color-text-secondary)] animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="h-2 w-2 rounded-full bg-[var(--color-text-secondary)] animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

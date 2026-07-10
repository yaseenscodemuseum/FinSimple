"use client";

import { useState, useCallback, useRef } from "react";
import type { Message, DocumentContext, UserProfile } from "@/lib/types";
import { generateId } from "@/lib/utils";

export function useChat(getDocumentContext: () => DocumentContext[], userProfile?: UserProfile) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      setError(null);
      const userMsg: Message = {
        id: generateId(),
        role: "user",
        content,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      const aiMsgId = generateId();
      setMessages((prev) => [
        ...prev,
        { id: aiMsgId, role: "assistant", content: "", timestamp: Date.now() },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const history = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            context: getDocumentContext(),
            history,
            userProfile,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(
            errData.error || `Request failed (${response.status})`
          );
        }

        if (!response.body) throw new Error("No response stream");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              if (parsed.content) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMsgId
                      ? { ...m, content: m.content + parsed.content }
                      : m
                  )
                );
              }
            } catch (parseErr) {
              if (
                parseErr instanceof Error &&
                parseErr.message !== "Unexpected end of JSON input"
              ) {
                throw parseErr;
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        const msg = err instanceof Error ? err.message : "Something went wrong";
        setError(msg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  content: m.content || "Sorry, something went wrong. Please try again.",
                }
              : m
          )
        );
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [messages, getDocumentContext, userProfile]
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isLoading, error, sendMessage, stopGeneration, clearMessages };
}

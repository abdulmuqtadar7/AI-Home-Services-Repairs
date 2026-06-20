"use client";

import { useEffect, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
};

type ChatResponse = {
  sessionId: string;
  conversationId: string;
  reply: string | null;
  handoff: boolean;
  emergency: boolean;
  booked?: boolean;
  jobId?: string | null;
  status: string;
};

export function ChatWidget({
  businessId,
  businessName = "Our team",
  greeting = "Hi! How can we help you today?",
}: {
  businessId: string;
  businessName?: string;
  greeting?: string;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [emergency, setEmergency] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ id: "greet", role: "assistant", content: greeting }]);
    }
  }, [open, messages.length, greeting]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setMessages((m) => [
      ...m,
      { id: "u_" + Date.now(), role: "user", content: text },
    ]);
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, sessionId, message: text }),
      });
      const data: ChatResponse = await res.json();
      if (!res.ok) {
        setMessages((m) => [
          ...m,
          {
            id: "e_" + Date.now(),
            role: "system",
            content: "Something went wrong. Please try again.",
          },
        ]);
        return;
      }
      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
      }
      setEmergency(data.emergency);
      if (data.reply) {
        setMessages((m) => [
          ...m,
          { id: "a_" + Date.now(), role: "assistant", content: data.reply! },
        ]);
      } else if (data.handoff) {
        setMessages((m) => [
          ...m,
          {
            id: "h_" + Date.now(),
            role: "system",
            content:
              "A team member is reviewing your message and will reply here shortly.",
          },
        ]);
      }
      if (data.booked) {
        setMessages((m) => [
          ...m,
          {
            id: "b_" + Date.now(),
            role: "system",
            content:
              "Your visit request has been logged. Our team will confirm the details shortly.",
          },
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: "e_" + Date.now(),
          role: "system",
          content: "Network error. Please try again.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function resetChat() {
    if (sending) return;
    setSessionId(null);
    setEmergency(false);
    setInput("");
    setMessages([{ id: "greet", role: "assistant", content: greeting }]);
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {open && (
        <div className="mb-3 flex h-[32rem] w-80 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:w-96">
          <div className="flex items-center justify-between bg-gray-900 px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">{businessName}</p>
              <p className="text-xs text-gray-300">
                We typically reply in a few minutes
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={resetChat}
                className="rounded px-2 py-1 text-xs text-gray-300 hover:bg-white/10 hover:text-white"
                aria-label="Start a new chat"
              >
                New chat
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 text-gray-300 hover:bg-white/10 hover:text-white"
                aria-label="Close chat"
              >
                {"\u2715"}
              </button>
            </div>
          </div>

          {emergency && (
            <div className="bg-red-50 px-4 py-2 text-xs font-medium text-red-700">
              This looks urgent {"\u2014"} a team member is being alerted now.
            </div>
          )}

          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto bg-gray-50 px-4 py-4"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === "user" ? "flex justify-end" : "flex justify-start"
                }
              >
                {m.role === "system" ? (
                  <div className="max-w-[85%] rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
                    {m.content}
                  </div>
                ) : (
                  <div
                    className={
                      "max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm " +
                      (m.role === "user"
                        ? "bg-gray-900 text-white"
                        : "bg-white text-gray-800 shadow-sm")
                    }
                  >
                    {m.content}
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-white px-3 py-2 text-sm text-gray-400 shadow-sm">
                  {"\u2026"}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 bg-white p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                rows={1}
                placeholder="Type your message..."
                className="max-h-24 flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
              />
              <button
                onClick={send}
                disabled={sending || !input.trim()}
                className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-900 text-2xl text-white shadow-lg transition hover:bg-gray-700"
        aria-label="Open chat"
      >
        {open ? "\u2715" : "\uD83D\uDCAC"}
      </button>
    </div>
  );
}

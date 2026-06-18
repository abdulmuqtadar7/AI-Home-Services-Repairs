"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ConversationListItem = {
  id: string;
  channel: string;
  status: string;
  aiActive: boolean;
  lastMessageAt: string;
  customer: { id: string; name: string | null; phone: string | null } | null;
  messageCount: number;
  preview: string;
  previewSender: string | null;
};

type Msg = {
  id: string;
  sender: string;
  content: string;
  createdAt: string;
};

type ConversationDetail = {
  id: string;
  channel: string;
  status: string;
  aiActive: boolean;
  customer: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  messages: Msg[];
};

const STATUSES: ReadonlyArray<readonly [string, string]> = [
  ["NEW_LEAD", "New lead"],
  ["AI_HANDLING", "AI handling"],
  ["HUMAN_NEEDED", "Human needed"],
  ["BOOKED", "Booked"],
  ["COMPLETED", "Completed"],
  ["LOST", "Lost"],
];

const STATUS_COLORS: Record<string, string> = {
  NEW_LEAD: "bg-sky-100 text-sky-700",
  AI_HANDLING: "bg-violet-100 text-violet-700",
  HUMAN_NEEDED: "bg-amber-100 text-amber-700",
  BOOKED: "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-slate-100 text-slate-600",
  LOST: "bg-rose-100 text-rose-700",
};

const CHANNEL_LABELS: Record<string, string> = {
  WEB_CHAT: "Web chat",
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
  VOICE: "Voice",
  EMAIL: "Email",
};

const SENDER_LABELS: Record<string, string> = {
  CUSTOMER: "Customer",
  AI: "AI assistant",
  HUMAN_AGENT: "You",
  SYSTEM: "System",
};

function statusLabel(value: string) {
  return STATUSES.find(([v]) => v === value)?.[1] ?? value;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  const days = Math.floor(hrs / 24);
  return days + "d ago";
}

export function InboxClient({
  initialConversations,
}: {
  initialConversations: ConversationListItem[];
}) {
  const [list, setList] =
    useState<ConversationListItem[]>(initialConversations);
  const [filter, setFilter] = useState("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialConversations[0]?.id ?? null,
  );
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadList = useCallback(async (status: string) => {
    const qs = status === "ALL" ? "" : "?status=" + status;
    const res = await fetch("/api/conversations" + qs);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setList(data.conversations ?? []);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    setError(null);
    const res = await fetch("/api/conversations/" + id);
    const data = await res.json().catch(() => ({}));
    setLoadingDetail(false);
    if (res.ok) setDetail(data.conversation);
    else setError(data.error ?? "Could not load conversation");
  }, []);

  useEffect(() => {
    loadList(filter);
  }, [filter, loadList]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages.length]);

  async function changeStatus(status: string) {
    if (!detail) return;
    setDetail({ ...detail, status });
    await fetch("/api/conversations/" + detail.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadList(filter);
  }

  async function toggleAi() {
    if (!detail) return;
    const next = !detail.aiActive;
    setDetail({ ...detail, aiActive: next });
    await fetch("/api/conversations/" + detail.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiActive: next }),
    });
    loadList(filter);
  }

  async function sendReply() {
    if (!detail || !reply.trim()) return;
    setSending(true);
    setError(null);
    const res = await fetch("/api/conversations/" + detail.id + "/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: reply, sender: "HUMAN_AGENT" }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) {
      setError(data.error ?? "Could not send message");
      return;
    }
    setReply("");
    setDetail((d) =>
      d
        ? { ...d, aiActive: false, messages: [...d.messages, data.message] }
        : d,
    );
    loadList(filter);
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <aside className="flex w-80 shrink-0 flex-col rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          >
            <option value="ALL">All conversations</option>
            {STATUSES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto">
          {list.length === 0 && (
            <p className="p-4 text-sm text-slate-400">No conversations yet.</p>
          )}
          {list.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={
                "block w-full border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50 " +
                (selectedId === c.id ? "bg-indigo-50" : "")
              }
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-slate-800">
                  {c.customer?.name || "Unknown contact"}
                </span>
                <span className="shrink-0 text-xs text-slate-400">
                  {timeAgo(c.lastMessageAt)}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {c.preview || "No messages"}
              </p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-[10px] font-medium " +
                    (STATUS_COLORS[c.status] ?? "bg-slate-100 text-slate-600")
                  }
                >
                  {statusLabel(c.status)}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                  {CHANNEL_LABELS[c.channel] ?? c.channel}
                </span>
                {!c.aiActive && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                    Human
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="flex flex-1 flex-col rounded-2xl border border-slate-200 bg-white">
        {!detail && (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
            {loadingDetail ? "Loading\u2026" : "Select a conversation"}
          </div>
        )}
        {detail && (
          <>
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">
                  {detail.customer?.name || "Unknown contact"}
                </h2>
                <p className="text-xs text-slate-500">
                  {detail.customer?.phone ||
                    detail.customer?.email ||
                    CHANNEL_LABELS[detail.channel] ||
                    detail.channel}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={detail.status}
                  onChange={(e) => changeStatus(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-indigo-500"
                >
                  {STATUSES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={toggleAi}
                  className={
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition " +
                    (detail.aiActive
                      ? "bg-violet-100 text-violet-700 hover:bg-violet-200"
                      : "bg-amber-100 text-amber-700 hover:bg-amber-200")
                  }
                >
                  {detail.aiActive ? "AI active" : "Human handling"}
                </button>
              </div>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
              {detail.messages.length === 0 && (
                <p className="text-center text-sm text-slate-400">
                  No messages in this conversation yet.
                </p>
              )}
              {detail.messages.map((m) => {
                const mine = m.sender === "HUMAN_AGENT" || m.sender === "AI";
                const bubble =
                  m.sender === "AI"
                    ? "bg-violet-600 text-white"
                    : m.sender === "HUMAN_AGENT"
                      ? "bg-indigo-600 text-white"
                      : m.sender === "SYSTEM"
                        ? "bg-slate-200 text-slate-600"
                        : "bg-white text-slate-800 border border-slate-200";
                return (
                  <div
                    key={m.id}
                    className={
                      "flex flex-col " + (mine ? "items-end" : "items-start")
                    }
                  >
                    <div
                      className={
                        "max-w-[75%] rounded-2xl px-3 py-2 text-sm " + bubble
                      }
                    >
                      {m.content}
                    </div>
                    <span className="mt-1 text-[10px] text-slate-400">
                      {SENDER_LABELS[m.sender] ?? m.sender}
                      {" \u00b7 "}
                      {timeAgo(m.createdAt)}
                    </span>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {error && (
              <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex items-end gap-2 border-t border-slate-100 p-3">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
                rows={2}
                placeholder="Type a reply\u2026 (Enter to send, Shift+Enter for newline)"
                className="h-12 flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={sendReply}
                disabled={sending || !reply.trim()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {sending ? "Sending\u2026" : "Send"}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

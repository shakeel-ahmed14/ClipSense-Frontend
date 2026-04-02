"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, MessageCircle, Send, X } from "lucide-react";
import {
  postClipsenseQuery,
  userMessageForApiError,
  type ClipsenseSegment,
} from "@/lib/clipsense-api";

type Segment = ClipsenseSegment;

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  segments?: Segment[];
  timestamp: Date;
}

interface ChatWidgetProps {
  onVideoSeek?: (title: string, start: number, end: number) => void;
  apiReady?: boolean;
  apiStatusHint?: string;
}

export function ChatWidget({
  onVideoSeek,
  apiReady = true,
  apiStatusHint,
}: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading, open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading || !apiReady) return;

    const userMsg: Message = {
      id: String(Date.now()),
      type: "user",
      content: q,
      timestamp: new Date(),
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const data = await postClipsenseQuery(q, { top_k: 5, generate_answer: true });
      setMessages((m) => [
        ...m,
        {
          id: String(Date.now() + 1),
          type: "assistant",
          content:
            data.answer ||
            "Here are the most relevant moments from the tutorials (see sources below).",
          segments: data.segments,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          id: String(Date.now() + 1),
          type: "assistant",
          content: userMessageForApiError(err),
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg transition hover:scale-105 hover:shadow-xl"
          aria-label="Open ClipSense assistant"
        >
          <MessageCircle className="h-7 w-7" strokeWidth={2} />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[min(560px,85vh)] w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                <MessageCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-white">ClipSense</p>
                <p className="text-xs text-amber-100">
                  {apiReady ? "Ask about the tutorials" : apiStatusHint || "API not ready"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-white hover:bg-white/20"
              aria-label="Close chat"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div
            ref={scrollRef}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 bg-stone-50"
          >
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center px-2 text-center text-stone-600">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                  <MessageCircle className="h-8 w-8 text-amber-600" />
                </div>
                <p className="mb-1 font-medium text-stone-800">Cooking assistant</p>
                <p className="text-sm text-stone-500">
                  Ask when something happens in these videos — I’ll point you to the timestamp.
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={
                    msg.type === "user"
                      ? "max-w-[90%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-amber-500 to-orange-600 px-3 py-2 text-sm text-white"
                      : "max-w-[95%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-stone-800 shadow-sm ring-1 ring-stone-100"
                  }
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                  {msg.segments && msg.segments.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-stone-100 pt-3">
                      <p className="text-xs font-medium text-stone-500">Jump to moment</p>
                      {msg.segments.map((seg, i) => (
                        <button
                          key={`${seg.title}-${i}`}
                          type="button"
                          onClick={() => onVideoSeek?.(seg.title, seg.start, seg.end)}
                          className="w-full rounded-lg border border-amber-100 bg-amber-50/80 px-2 py-2 text-left text-xs transition hover:border-amber-300 hover:bg-amber-50"
                        >
                          <p className="line-clamp-1 font-medium text-stone-900">{seg.title}</p>
                          <p className="mt-0.5 text-amber-800">
                            {formatTime(seg.start)} – {formatTime(seg.end)}
                          </p>
                          <p className="mt-1 line-clamp-2 text-stone-600">{seg.text}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm text-stone-600 shadow-sm ring-1 ring-stone-100">
                  <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                  Thinking…
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={submit}
            className="border-t border-stone-200 bg-white p-3"
          >
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about the videos…"
                disabled={loading || !apiReady}
                className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm outline-none ring-amber-500/30 focus:border-amber-400 focus:ring-2 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading || !apiReady}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow disabled:opacity-40"
                aria-label="Send"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChefHat, Clock, Play } from "lucide-react";
import { ChatWidget } from "@/components/ChatWidget";
import {
  fetchClipsenseHealth,
  fetchVideoList,
  getApiBase,
  matchVideoRagTitle,
  type VideoManifestEntry,
} from "@/lib/clipsense-api";

export function CookingSite() {
  const [videos, setVideos] = useState<VideoManifestEntry[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [apiReady, setApiReady] = useState(true);
  const [apiHint, setApiHint] = useState<string | undefined>();
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  const setRef = (ragTitle: string) => (el: HTMLVideoElement | null) => {
    const m = videoRefs.current;
    if (el) m.set(ragTitle, el);
    else m.delete(ragTitle);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const h = await fetchClipsenseHealth();
        if (cancelled) return;
        if (!h.index_loaded) {
          setApiReady(false);
          setApiHint("Index missing — add multimodal_embeddings.joblib to backend");
        } else {
          setApiReady(true);
          setApiHint(undefined);
        }
      } catch {
        if (cancelled) return;
        setApiReady(false);
        setApiHint("API offline — run: uvicorn app.main:app (from backend/)");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchVideoList();
        if (!cancelled) {
          setVideos(list);
          setListError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setListError(e instanceof Error ? e.message : "Could not load video list");
          setVideos([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onVideoSeek = useCallback(
    (segmentTitle: string, start: number, end: number) => {
      void end;
      const key = matchVideoRagTitle(segmentTitle, videos);
      if (!key) {
        const el = videoRefs.current.values().next().value;
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      const v = videoRefs.current.get(key);
      if (v) {
        v.scrollIntoView({ behavior: "smooth", block: "center" });
        try {
          v.currentTime = Math.max(0, start);
          void v.play().catch(() => {});
        } catch {
          /* ignore */
        }
      }
    },
    [videos]
  );

  const base = getApiBase();

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50/40 to-stone-100">
      <header className="border-b border-amber-100 bg-white/90 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md">
              <ChefHat className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-stone-900">
                HomeCook Studio
              </h1>
              <p className="text-sm text-stone-500">Tutorial library + AI timestamps</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="mb-8 text-center text-stone-600">
          Watch the lessons below. Open the assistant to ask questions; tap a result to jump to
          that moment in the matching video.
        </p>

        {listError && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {listError} — check <code className="rounded bg-white px-1">NEXT_PUBLIC_CLIPSENSE_API_URL</code>{" "}
            and that the API exposes <code className="rounded bg-white px-1">/api/videos</code>.
          </div>
        )}

        {videos.length === 0 && !listError && (
          <div className="rounded-xl border border-dashed border-stone-300 bg-white/60 px-4 py-8 text-center text-stone-600">
            <Play className="mx-auto mb-2 h-10 w-10 text-amber-500 opacity-80" />
            <p className="font-medium text-stone-800">No videos configured</p>
            <p className="mt-1 text-sm">
              Add MP4 files under <code className="rounded bg-stone-100 px-1">backend/videos</code> and
              update <code className="rounded bg-stone-100 px-1">manifest.json</code>.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-12">
          {videos.map((v) => {
            const url = `${base}${v.src}`;
            return (
              <article
                key={v.file}
                className="overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-lg shadow-amber-900/5"
              >
                <div className="aspect-video bg-stone-900">
                  <video
                    ref={setRef(v.ragTitle)}
                    className="h-full w-full"
                    controls
                    preload="metadata"
                    src={url}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
                <div className="border-t border-amber-50 px-5 py-4">
                  <div className="mb-1 flex items-center gap-2 text-xs text-stone-500">
                    <Clock className="h-3.5 w-3.5" />
                    Streamed from API
                  </div>
                  <h2 className="text-lg font-semibold text-stone-900">{v.headline}</h2>
                  {v.description ? (
                    <p className="mt-2 text-sm leading-relaxed text-stone-600">{v.description}</p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </main>

      <footer className="mt-16 border-t border-amber-100 bg-gradient-to-r from-amber-600 to-orange-700 py-10 text-center text-amber-50">
        <p className="text-sm">ClipSense · Multimodal RAG over your tutorial library</p>
      </footer>

      <ChatWidget onVideoSeek={onVideoSeek} apiReady={apiReady} apiStatusHint={apiHint} />
    </div>
  );
}

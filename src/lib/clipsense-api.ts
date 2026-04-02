export interface ClipsenseSegment {
  title: string;
  number: number;
  start: number;
  end: number;
  text: string;
  visual_captions: string[];
  score: number;
}

export interface ClipsenseQueryResponse {
  query: string;
  segments: ClipsenseSegment[];
  answer?: string;
}

export interface ClipsenseHealthResponse {
  status: string;
  index_loaded: boolean;
  index_path: string;
  rows: number | null;
}

export interface VideoManifestEntry {
  file: string;
  src: string;
  ragTitle: string;
  headline: string;
  description?: string;
}

export function getApiBase(): string {
  const b = process.env.NEXT_PUBLIC_CLIPSENSE_API_URL?.trim();
  if (b) return b.replace(/\/$/, "");
  return "http://127.0.0.1:8000";
}

export async function fetchClipsenseHealth(): Promise<ClipsenseHealthResponse> {
  const r = await fetch(`${getApiBase()}/health`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Health failed: ${r.status}`);
  return r.json();
}

export async function fetchVideoList(): Promise<VideoManifestEntry[]> {
  const r = await fetch(`${getApiBase()}/api/videos`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Videos list failed: ${r.status}`);
  const data = (await r.json()) as { videos: VideoManifestEntry[] };
  return data.videos ?? [];
}

function detailFromBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const d = (body as { detail?: unknown }).detail;
  if (typeof d === "string") return d;
  return null;
}

export class ClipsenseApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: string | null
  ) {
    super(message);
    this.name = "ClipsenseApiError";
  }
}

export async function postClipsenseQuery(
  query: string,
  options?: { top_k?: number; generate_answer?: boolean; signal?: AbortSignal }
): Promise<ClipsenseQueryResponse> {
  const r = await fetch(`${getApiBase()}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      top_k: options?.top_k ?? 5,
      generate_answer: options?.generate_answer ?? true,
    }),
    signal: options?.signal,
  });
  let body: unknown;
  try {
    body = await r.json();
  } catch {
    body = null;
  }
  if (!r.ok) {
    const detail = detailFromBody(body);
    let message = detail || r.statusText || "Request failed";
    if (r.status === 503) {
      message =
        detail ||
        "Search index is not loaded. Add multimodal_embeddings.joblib to the backend and restart the API.";
    } else if (r.status === 502) {
      message =
        detail ||
        "Ollama is unreachable. Start Ollama and pull the embed + LLM models.";
    }
    throw new ClipsenseApiError(message, r.status, detail);
  }
  return body as ClipsenseQueryResponse;
}

export function userMessageForApiError(err: unknown): string {
  if (err instanceof ClipsenseApiError) return err.message;
  if (err instanceof Error) {
    if (err.name === "AbortError") return "Request cancelled.";
    if (err.message.includes("Failed to fetch")) {
      return "Cannot reach the ClipSense API. Is uvicorn running on port 8000?";
    }
    return err.message;
  }
  return "Something went wrong. Please try again.";
}

export function matchVideoRagTitle(
  segmentTitle: string,
  videos: VideoManifestEntry[]
): string | null {
  const t = segmentTitle.trim().toLowerCase();
  for (const v of videos) {
    if (v.ragTitle.trim().toLowerCase() === t) return v.ragTitle;
  }
  for (const v of videos) {
    const r = v.ragTitle.trim().toLowerCase();
    if (t.includes(r) || r.includes(t)) return v.ragTitle;
  }
  return null;
}

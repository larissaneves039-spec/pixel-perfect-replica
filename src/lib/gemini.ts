import { TONES } from "./tables";
import type { SectionInput } from "./formState";

export interface AudioSection {
  start: number;
  end: number;
  description: string;
  keywords: string[];
}
export interface AudioAnalysis {
  theme: string;
  tone: string;
  keywords: string[];
  sections: AudioSection[];
}

export class GeminiError extends Error {}

export const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

/** Converte as seções do áudio em pesos proporcionais ao tempo, cobrindo a duração total. */
export function sectionsFromAnalysis(sections: AudioSection[], total: number): SectionInput[] {
  const sorted = [...sections]
    .map((s) => ({ ...s, start: Math.max(0, Math.min(total, s.start)), end: Math.max(0, Math.min(total, s.end)) }))
    .sort((a, b) => a.start - b.start);
  const out: SectionInput[] = [];
  sorted.forEach((s, i) => {
    const start = i === 0 ? 0 : s.start;
    const end = i === sorted.length - 1 ? total : sorted[i + 1].start;
    const dur = end - start;
    if (dur <= 0) return;
    out.push({ description: s.description, weight: Math.round((dur / total) * 1000) / 10, keywords: s.keywords.slice(0, 6) });
  });
  return out;
}

async function toBase64(file: Blob): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

const BASE = "https://generativelanguage.googleapis.com/v1beta";
const MODEL_KEY = "bgvideo.geminiModel";

interface ModelInfo { name: string; supportedGenerationMethods?: string[] }

/** Escolhe o melhor modelo de texto/áudio disponível: Flash estável mais novo, depois preview, depois Pro. */
export function chooseModel(models: ModelInfo[]): string | null {
  const ok = models
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""))
    .filter((n) => n.startsWith("gemini-") && !/(tts|image|live|embedding|lite|audio|robotics|computer|thinking|exp|nano|learnlm|gemma)/.test(n));
  const ver = (n: string) => parseFloat(n.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? "0");
  const score = (n: string) => (n.includes("flash") ? 2000 : n.includes("pro") ? 1000 : 0) + (n.includes("preview") ? 0 : 500) + (/-latest$/.test(n) ? -1 : 0) + ver(n) * 10;
  ok.sort((a, b) => score(b) - score(a) || a.length - b.length);
  return ok[0] ?? null;
}

async function errorDetail(r: Response): Promise<string> {
  try { return (await r.json())?.error?.message ?? ""; } catch { return ""; }
}

export async function pickModel(key: string, fresh = false): Promise<string> {
  if (!fresh) {
    try { const c = localStorage.getItem(MODEL_KEY); if (c) return c; } catch { /* ignore */ }
  }
  const r = await fetch(`${BASE}/models?pageSize=1000`, { headers: { "x-goog-api-key": key } });
  if (!r.ok) {
    const d = await errorDetail(r);
    if (r.status === 400 || r.status === 401 || r.status === 403) throw new GeminiError(`Chave do Gemini inválida ou sem permissão${d ? `: ${d}` : "."}`);
    throw new GeminiError(`Não foi possível listar os modelos do Gemini (${r.status})${d ? `: ${d}` : "."}`);
  }
  const m = chooseModel((await r.json())?.models ?? []);
  if (!m) throw new GeminiError("Nenhum modelo do Gemini disponível para esta chave.");
  try { localStorage.setItem(MODEL_KEY, m); } catch { /* ignore */ }
  return m;
}

async function call(key: string, body: unknown): Promise<{ json: any; model: string }> {
  let model = await pickModel(key);
  let refreshed = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(`${BASE}/models/${model}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body) });
    if (r.ok) return { json: await r.json(), model };
    const detail = await errorDetail(r);
    if (r.status === 404 && !refreshed) {
      refreshed = true;
      model = await pickModel(key, true);
      continue;
    }
    if (r.status === 429 && attempt === 0) {
      await new Promise((res) => setTimeout(res, 5000));
      continue;
    }
    const why = detail ? ` Detalhe: ${detail}` : "";
    if (r.status === 400 && /api key/i.test(detail)) throw new GeminiError("Chave do Gemini inválida.");
    if (r.status === 400) throw new GeminiError(`O Gemini recusou o pedido.${why}`);
    if (r.status === 401 || r.status === 403) throw new GeminiError(`Chave do Gemini sem permissão.${why}`);
    if (r.status === 404) throw new GeminiError(`Modelo do Gemini não encontrado (${model}).${why}`);
    if (r.status === 429) throw new GeminiError(`O Gemini respondeu com limite de uso (429).${why}`);
    throw new GeminiError(`Erro no Gemini (${r.status}).${why}`);
  }
  throw new GeminiError("O Gemini não respondeu. Tente novamente.");
}

export async function testGeminiKey(key: string): Promise<string> {
  const { model } = await call(key, { contents: [{ parts: [{ text: "ok" }] }], generationConfig: { maxOutputTokens: 5 } });
  return model;
}

export async function analyzeAudio(key: string, file: File, duration: number, locale: string): Promise<AudioAnalysis> {
  if (file.size > MAX_AUDIO_BYTES) throw new GeminiError("Áudio muito grande (máx. 15 MB).");
  const data = await toBase64(file);
  const tones = TONES.map((t) => t.key);
  const prompt = `Você ouvirá um áudio de ${Math.round(duration)} segundos que será narrado sobre um vídeo de fundo montado com clipes do banco Pexels.
Escute, entenda o assunto e a linha lógica, e divida em seções na ordem do áudio (início e fim em segundos, cobrindo de 0 a ${Math.round(duration)}), cada uma com a mudança de assunto/visual. Use entre 1 e 12 seções.
Para cada seção dê uma descrição curta (${locale === "pt-BR" ? "em português" : "em inglês"}) e 2 a 5 palavras-chave visuais concretas EM INGLÊS, boas para buscar vídeos de banco (ex.: "ocean waves", "city night").
Dê também o tema geral curto (${locale === "pt-BR" ? "em português" : "em inglês"}), palavras-chave gerais em inglês e o tom visual mais adequado.`;
  const { json } = await call(key, {
    contents: [{ parts: [{ inline_data: { mime_type: audioMime(file), data } }, { text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          theme: { type: "STRING" },
          tone: { type: "STRING", enum: tones },
          keywords: { type: "ARRAY", items: { type: "STRING" } },
          sections: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { start: { type: "NUMBER" }, end: { type: "NUMBER" }, description: { type: "STRING" }, keywords: { type: "ARRAY", items: { type: "STRING" } } },
              required: ["start", "end", "description", "keywords"],
            },
          },
        },
        required: ["theme", "tone", "keywords", "sections"],
      },
    },
  });
  const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
  if (!text) throw new GeminiError("O Gemini não conseguiu analisar este áudio.");
  try {
    const a = JSON.parse(text) as AudioAnalysis;
    if (!tones.includes(a.tone)) a.tone = tones[0];
    return a;
  } catch {
    throw new GeminiError("Resposta inesperada do Gemini.");
  }
}

export function audioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    a.preload = "metadata";
    a.onloadedmetadata = () => { URL.revokeObjectURL(url); isFinite(a.duration) ? resolve(a.duration) : reject(new Error("Duração indisponível")); };
    a.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não foi possível ler este áudio.")); };
    a.src = url;
  });
}

/** Tipo de áudio aceito pelo Gemini; arquivos .mp4 são enviados como audio/mp4. */
export function audioMime(file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const byExt: Record<string, string> = { mp4: "audio/mp4", m4a: "audio/mp4", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", aac: "audio/aac", webm: "audio/webm" };
  if (file.type.startsWith("audio/")) return file.type;
  return byExt[ext] ?? "audio/mp4";
}

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

const MODEL = "gemini-2.5-flash";
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

async function call(key: string, body: unknown): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body) });
    if (r.ok) return r.json();
    if (r.status === 429 && attempt === 0) {
      await new Promise((res) => setTimeout(res, 5000));
      continue;
    }
    let detail = "";
    try { detail = (await r.json())?.error?.message ?? ""; } catch { /* ignore */ }
    if (r.status === 400 && /api key/i.test(detail)) throw new GeminiError("Chave do Gemini inválida.");
    if (r.status === 400) throw new GeminiError(`O Gemini recusou o pedido: ${detail || "formato de áudio não aceito"}.`);
    if (r.status === 401 || r.status === 403) throw new GeminiError("Chave do Gemini inválida ou sem permissão.");
    if (r.status === 429) throw new GeminiError("Limite de uso do Gemini atingido. Tente mais tarde.");
    throw new GeminiError(`Erro no Gemini (${r.status}). Tente novamente.`);
  }
  throw new GeminiError("Limite de uso do Gemini atingido. Tente mais tarde.");
}

export async function testGeminiKey(key: string) {
  await call(key, { contents: [{ parts: [{ text: "ok" }] }], generationConfig: { maxOutputTokens: 5 } });
}

export async function analyzeAudio(key: string, file: File, duration: number, locale: string): Promise<AudioAnalysis> {
  if (file.size > MAX_AUDIO_BYTES) throw new GeminiError("Áudio muito grande (máx. 15 MB).");
  const data = await toBase64(file);
  const tones = TONES.map((t) => t.key);
  const prompt = `Você ouvirá um áudio de ${Math.round(duration)} segundos que será narrado sobre um vídeo de fundo montado com clipes do banco Pexels.
Escute, entenda o assunto e a linha lógica, e divida em seções na ordem do áudio (início e fim em segundos, cobrindo de 0 a ${Math.round(duration)}), cada uma com a mudança de assunto/visual. Use entre 1 e 12 seções.
Para cada seção dê uma descrição curta (${locale === "pt-BR" ? "em português" : "em inglês"}) e 2 a 5 palavras-chave visuais concretas EM INGLÊS, boas para buscar vídeos de banco (ex.: "ocean waves", "city night").
Dê também o tema geral curto (${locale === "pt-BR" ? "em português" : "em inglês"}), palavras-chave gerais em inglês e o tom visual mais adequado.`;
  const json = await call(key, {
    contents: [{ parts: [{ inline_data: { mime_type: file.type || "audio/mpeg", data } }, { text: prompt }] }],
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

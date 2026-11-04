// Camada de dados 100% no navegador: o app chama o Supabase direto com a
// sessão do usuário; o isolamento entre usuários é garantido pelas policies
// de RLS (mesma proteção que as server functions davam). Necessário porque
// o app roda em hospedagem estática (GitHub Pages), sem servidor próprio.
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { StoredScene } from "@/lib/queue";

const uuid = z.string().uuid();

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Sessão expirada — entre novamente.");
  return data.user.id;
}

export const listFolders = async () => {
  const { data, error } = await supabase
    .from("folders")
    .select("id, name, created_at")
    .order("name");
  if (error) throw new Error(error.message);
  return data;
};

export const createFolder = async (input: { data: { name: string } }) => {
  const name = z.string().trim().min(1).max(80).parse(input.data.name);
  const userId = await requireUserId();
  const { data: row, error } = await supabase
    .from("folders")
    .insert({ user_id: userId, name })
    .select("id, name, created_at")
    .single();
  if (error) throw new Error(error.message);
  return row;
};

export const renameFolder = async (input: { data: { id: string; name: string } }) => {
  const parsed = z.object({ id: uuid, name: z.string().trim().min(1).max(80) }).parse(input.data);
  const { error } = await supabase.from("folders").update({ name: parsed.name }).eq("id", parsed.id);
  if (error) throw new Error(error.message);
};

export const deleteFolder = async (input: { data: { id: string } }) => {
  const id = uuid.parse(input.data.id);
  const { error } = await supabase.from("folders").delete().eq("id", id);
  if (error) throw new Error(error.message);
};

export interface VideoListItem {
  id: string;
  folderId: string;
  title: string;
  status: string;
  error: string | null;
  totalSeconds: number;
  outputPaths: string[];
  audioPath: string | null;
  createdAt: string;
  scenes: StoredScene[];
  signedUrls: string[];
}

export const listVideos = async (input: { data: { folderId: string } }): Promise<VideoListItem[]> => {
  const folderId = uuid.parse(input.data.folderId);
  const { data: rowsData, error } = await supabase
    .from("videos")
    .select("id, folder_id, title, status, error, total_seconds, output_paths, audio_path, scenes, created_at")
    .eq("folder_id", folderId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (rowsData ?? []) as {
    id: string;
    folder_id: string;
    title: string;
    status: string;
    error: string | null;
    total_seconds: number;
    output_paths: string[] | null;
    audio_path: string | null;
    scenes: unknown;
    created_at: string;
  }[];

  const paths = rows.flatMap((r) => (r.output_paths ?? []).filter((p): p is string => !!p));
  const urls = new Map<string, string>();
  await Promise.all(
    paths.map(async (p) => {
      const { data: signed } = await supabase.storage.from("videos").createSignedUrl(p, 60 * 60 * 24 * 7);
      if (signed) urls.set(p, signed.signedUrl);
    }),
  );

  return rows.map((r) => ({
    id: r.id,
    folderId: r.folder_id,
    title: r.title,
    status: r.status,
    error: r.error,
    totalSeconds: r.total_seconds,
    outputPaths: (r.output_paths ?? []) as string[],
    audioPath: r.audio_path,
    createdAt: r.created_at,
    scenes: r.scenes as StoredScene[],
    signedUrls: (r.output_paths ?? []).map((p) => urls.get(p as string) ?? ""),
  }));
};

export const enqueueVideo = async (input: {
  data: {
    folderId: string;
    title: string;
    settings: Record<string, unknown>;
    scenes: Record<string, unknown>[];
    totalSeconds: number;
    audioPath?: string | null;
  };
}) => {
  const data = z
    .object({
      folderId: uuid,
      title: z.string().trim().min(1).max(200),
      settings: z.record(z.string(), z.unknown()),
      scenes: z.array(z.record(z.string(), z.unknown())).min(1),
      totalSeconds: z.number().int().min(10).max(3 * 3600),
      audioPath: z.string().max(500).nullish(),
    })
    .parse(input.data);
  const userId = await requireUserId();
  const { data: row, error } = await supabase
    .from("videos")
    .insert({
      user_id: userId,
      folder_id: data.folderId,
      title: data.title,
      status: "queued",
      settings: data.settings as unknown as Json,
      scenes: data.scenes as unknown as Json,
      audio_path: data.audioPath ?? null,
      total_seconds: data.totalSeconds,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return row;
};

export const saveRenderedVideo = async (input: {
  data: {
    folderId: string;
    title: string;
    settings: Record<string, unknown>;
    scenes: Record<string, unknown>[];
    totalSeconds: number;
    paths: string[];
  };
}) => {
  const data = z
    .object({
      folderId: uuid,
      title: z.string().trim().min(1).max(200),
      settings: z.record(z.string(), z.unknown()),
      scenes: z.array(z.record(z.string(), z.unknown())).min(1),
      totalSeconds: z.number().int().min(10).max(3 * 3600),
      paths: z.array(z.string().min(1).max(500)).min(1).max(60),
    })
    .parse(input.data);
  const userId = await requireUserId();
  const { data: row, error } = await supabase
    .from("videos")
    .insert({
      user_id: userId,
      folder_id: data.folderId,
      title: data.title,
      status: "done",
      settings: data.settings as unknown as Json,
      scenes: data.scenes as unknown as Json,
      output_paths: data.paths,
      total_seconds: data.totalSeconds,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return row;
};

export const retryVideo = async (input: { data: { id: string } }) => {
  const id = uuid.parse(input.data.id);
  const { error } = await supabase
    .from("videos")
    .update({ status: "queued", error: null, locked_at: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
};

export const deleteVideo = async (input: { data: { id: string } }) => {
  const id = uuid.parse(input.data.id);
  const { error } = await supabase.from("videos").delete().eq("id", id);
  if (error) throw new Error(error.message);
};

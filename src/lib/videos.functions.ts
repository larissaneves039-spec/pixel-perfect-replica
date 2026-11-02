import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { StoredScene } from "@/lib/queue";

const uuid = z.string().uuid();

export const listFolders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("folders")
      .select("id, name, created_at")
      .order("name");
    if (error) throw new Error(error.message);
    return data;
  });

export const createFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string }) => z.object({ name: z.string().trim().min(1).max(80) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("folders")
      .insert({ user_id: context.userId, name: data.name })
      .select("id, name, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const renameFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; name: string }) =>
    z.object({ id: uuid, name: z.string().trim().min(1).max(80) }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("folders").update({ name: data.name }).eq("id", data.id);
    if (error) throw new Error(error.message);
  });

export const deleteFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("folders").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
  });

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

export const listVideos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { folderId: string }) => z.object({ folderId: uuid }).parse(input))
  .handler(async ({ data, context }): Promise<VideoListItem[]> => {
    const { data: rowsData, error } = await context.supabase
      .from("videos")
      .select("id, folder_id, title, status, error, total_seconds, output_paths, audio_path, scenes, created_at")
      .eq("folder_id", data.folderId)
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
        const { data: signed } = await context.supabase.storage.from("videos").createSignedUrl(p, 60 * 60 * 24 * 7);
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
  });

export const enqueueVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    folderId: string;
    title: string;
    settings: Record<string, unknown>;
    scenes: Record<string, unknown>[];
    totalSeconds: number;
    audioPath?: string | null;
  }) =>
    z.object({
      folderId: uuid,
      title: z.string().trim().min(1).max(200),
      settings: z.record(z.string(), z.unknown()),
      scenes: z.array(z.record(z.string(), z.unknown())).min(1),
      totalSeconds: z.number().int().min(10).max(3 * 3600),
      audioPath: z.string().max(500).nullish(),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("videos")
      .insert({
        user_id: context.userId,
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
  });

export const saveRenderedVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    folderId: string;
    title: string;
    settings: Record<string, unknown>;
    scenes: Record<string, unknown>[];
    totalSeconds: number;
    paths: string[];
  }) =>
    z.object({
      folderId: uuid,
      title: z.string().trim().min(1).max(200),
      settings: z.record(z.string(), z.unknown()),
      scenes: z.array(z.record(z.string(), z.unknown())).min(1),
      totalSeconds: z.number().int().min(10).max(3 * 3600),
      paths: z.array(z.string().min(1).max(500)).min(1).max(60),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("videos")
      .insert({
        user_id: context.userId,
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
  });

export const retryVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("videos")
      .update({ status: "queued", error: null, locked_at: null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
  });

export const deleteVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("videos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
  });

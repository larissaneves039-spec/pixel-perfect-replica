import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Worker avisa que o vídeo terminou de renderizar, com os caminhos salvos.
export const Route = createFileRoute("/api/public/worker/complete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["WORKER_SECRET"];
        if (!secret) return new Response("Worker não configurado", { status: 500 });
        const provided = request.headers.get("x-worker-secret");
        if (!provided || provided.length !== secret.length || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const body = await request.json().catch(() => null);
        const parsed = z
          .object({ videoId: z.string().uuid(), paths: z.array(z.string().min(1).max(500)).min(1).max(60) })
          .safeParse(body);
        if (!parsed.success) return new Response("Dados inválidos", { status: 400 });

        const { error } = await supabaseAdmin
          .from("videos")
          .update({ status: "done", output_paths: parsed.data.paths, error: null, locked_at: null })
          .eq("id", parsed.data.videoId)
          .eq("status", "rendering");
        if (error) {
          console.error("[worker/complete]", error.message);
          return new Response("Erro ao salvar", { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});

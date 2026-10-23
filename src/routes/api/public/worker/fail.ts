import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Worker avisa que a renderização falhou, com o motivo.
export const Route = createFileRoute("/api/public/worker/fail")({
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
          .object({ videoId: z.string().uuid(), message: z.string().min(1).max(1000) })
          .safeParse(body);
        if (!parsed.success) return new Response("Dados inválidos", { status: 400 });

        const { error } = await supabaseAdmin
          .from("videos")
          .update({ status: "error", error: parsed.data.message, locked_at: null })
          .eq("id", parsed.data.videoId);
        if (error) {
          console.error("[worker/fail]", error.message);
          return new Response("Erro ao salvar", { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});

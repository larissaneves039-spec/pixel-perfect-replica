import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Worker do GitHub Actions reivindica o próximo vídeo da fila.
// Protegido por WORKER_SECRET no header x-worker-secret.
export const Route = createFileRoute("/api/public/worker/claim")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["WORKER_SECRET"];
        if (!secret) return new Response("Worker não configurado", { status: 500 });
        const provided = request.headers.get("x-worker-secret");
        if (!provided || provided.length !== secret.length || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { data, error } = await supabaseAdmin.rpc("claim_video_job");
        if (error) {
          console.error("[worker/claim]", error.message);
          return new Response("Erro na fila", { status: 500 });
        }
        if (!data || !data.id) return Response.json({ video: null, audioUrl: null });

        let audioUrl: string | null = null;
        if (data.audio_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from("videos")
            .createSignedUrl(data.audio_path, 60 * 60 * 8);
          audioUrl = signed?.signedUrl ?? null;
        }
        return Response.json({ video: data, audioUrl });
      },
    },
  },
});

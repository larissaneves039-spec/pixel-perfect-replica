import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2,
  CircleDashed,
  Download,
  FileText,
  FolderPlus,
  Loader2,
  LogOut,
  Pencil,
  RefreshCw,
  Settings,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  createFolder,
  deleteFolder,
  deleteVideo,
  listFolders,
  listVideos,
  renameFolder,
  retryVideo,
  type VideoListItem,
} from "@/lib/videos.functions";
import { creditsText, type StoredScene } from "@/lib/queue";
import { fmtTime } from "@/lib/formState";
import { supabase } from "@/integrations/supabase/client";

interface FolderRow {
  id: string;
  name: string;
  created_at: string;
}

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  queued: { label: "Na fila", variant: "secondary" },
  rendering: { label: "Renderizando", variant: "default" },
  done: { label: "Pronto", variant: "outline" },
  error: { label: "Erro", variant: "destructive" },
};

export const Route = createFileRoute("/_authenticated/videos")({
  head: () => ({
    meta: [
      { title: "Meus vídeos — Gerador de Vídeo de Fundo" },
      { name: "description", content: "Suas caixas de vídeos: na fila, renderizando, prontos e com erro." },
      { property: "og:title", content: "Meus vídeos — Gerador de Vídeo de Fundo" },
      { property: "og:description", content: "Suas caixas de vídeos: na fila, renderizando, prontos e com erro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VideosPage,
});

function VideosPage() {
  const queryClient = useQueryClient();
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [videos, setVideos] = useState<VideoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");

  const refreshFolders = useCallback(async () => {
    try {
      const rows = (await listFolders()) as FolderRow[];
      setFolders(rows);
      setSelected((cur) => cur ?? rows[0]?.id ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar pastas.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshVideos = useCallback(async (folderId: string) => {
    try {
      const rows = (await listVideos({ data: { folderId } })) as VideoListItem[];
      setVideos(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar vídeos.");
    }
  }, []);

  useEffect(() => {
    void refreshFolders();
  }, [refreshFolders]);

  useEffect(() => {
    if (!selected) {
      setVideos([]);
      return;
    }
    void refreshVideos(selected);
    const t = setInterval(() => void refreshVideos(selected), 10000);
    return () => clearInterval(t);
  }, [selected, refreshVideos]);

  const addFolder = async () => {
    const name = newName.trim();
    if (!name) return;
    setNewName("");
    try {
      const row = (await createFolder({ data: { name } })) as FolderRow;
      await refreshFolders();
      setSelected(row.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar pasta.");
    }
  };

  const rename = async (folder: FolderRow) => {
    const name = window.prompt("Novo nome da pasta:", folder.name)?.trim();
    if (!name || name === folder.name) return;
    try {
      await renameFolder({ data: { id: folder.id, name } });
      await refreshFolders();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao renomear.");
    }
  };

  const removeFolder = async (folder: FolderRow) => {
    if (!window.confirm(`Apagar a pasta "${folder.name}" e os vídeos dentro dela?`)) return;
    try {
      await deleteFolder({ data: { id: folder.id } });
      setSelected((cur) => (cur === folder.id ? null : cur));
      await refreshFolders();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao apagar pasta.");
    }
  };

  const retry = async (v: VideoListItem) => {
    try {
      await retryVideo({ data: { id: v.id } });
      if (selected) void refreshVideos(selected);
      toast.success("Vídeo de volta na fila.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao reenfileirar.");
    }
  };

  const removeVideo = async (v: VideoListItem) => {
    try {
      await deleteVideo({ data: { id: v.id } });
      setVideos((rows) => rows.filter((x) => x.id !== v.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao apagar vídeo.");
    }
  };

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen pb-20">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-6 py-6">
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">Meus vídeos</h1>
          <p className="text-sm text-muted-foreground">Pastas com os vídeos na fila, prontos e com erro.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" asChild>
            <Link to="/"><Settings /> Novo vídeo</Link>
          </Button>
          <Button variant="ghost" onClick={() => void signOut()}><LogOut /> Sair</Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 md:grid-cols-[240px_1fr]">
        <aside className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void addFolder()}
              placeholder="Nova pasta…"
              className="h-9"
            />
            <Button size="sm" variant="secondary" className="h-9 shrink-0" onClick={() => void addFolder()}>
              <FolderPlus />
            </Button>
          </div>
          {loading ? (
            <p className="flex items-center gap-2 p-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando…</p>
          ) : folders.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">Nenhuma pasta ainda.</p>
          ) : (
            <ul className="space-y-1">
              {folders.map((f) => (
                <li key={f.id} className="group flex items-center gap-1">
                  <button
                    onClick={() => setSelected(f.id)}
                    className={`flex-1 truncate rounded-md px-3 py-2 text-left text-sm hover:bg-accent ${selected === f.id ? "bg-accent font-medium" : ""}`}
                  >
                    {f.name}
                  </button>
                  <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100" onClick={() => void rename(f)} aria-label={`Renomear ${f.name}`}>
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100" onClick={() => void removeFolder(f)} aria-label={`Apagar ${f.name}`}>
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="space-y-4">
          {!selected ? (
            <p className="panel p-6 text-sm text-muted-foreground">
              Selecione uma pasta — ou crie uma e envie um vídeo pela tela <Link to="/" className="text-primary hover:underline">Novo vídeo</Link>.
            </p>
          ) : videos.length === 0 ? (
            <p className="panel p-6 text-sm text-muted-foreground">Nenhum vídeo nesta pasta ainda.</p>
          ) : (
            <div className="space-y-4">
              {videos.map((v) => {
                const st = STATUS[v.status] ?? STATUS["queued"];
                return (
                  <div key={v.id} className="panel space-y-3 p-4">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-medium">{v.title}</span>
                      <Badge variant={st.variant}>
                        {v.status === "done" ? <CheckCircle2 /> : v.status === "error" ? <TriangleAlert /> : v.status === "rendering" ? <Loader2 className="animate-spin" /> : <CircleDashed />}
                        {st.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{fmtTime(v.totalSeconds)} · {new Date(v.createdAt).toLocaleDateString("pt-BR")}</span>
                      <Button variant="ghost" size="icon" className="ml-auto size-8" onClick={() => void removeVideo(v)} aria-label="Apagar vídeo">
                        <Trash2 />
                      </Button>
                    </div>
                    {v.error && <p className="text-sm text-destructive">{v.error}</p>}
                    {v.status === "done" && v.signedUrls[0] && (
                      <video src={v.signedUrls[0]} controls preload="metadata" className="max-h-[50vh] w-full rounded-md bg-background" />
                    )}
                    <div className="flex flex-wrap gap-2">
                      {v.status === "error" && (
                        <Button size="sm" variant="secondary" onClick={() => void retry(v)}><RefreshCw /> Tentar de novo</Button>
                      )}
                      {v.outputPaths.map((p, i) =>
                        v.signedUrls[i] ? (
                          <Button key={p} size="sm" variant="secondary" asChild>
                            <a href={v.signedUrls[i]} download={`${slugify(v.title)}${v.outputPaths.length > 1 ? `_parte${i + 1}` : ""}.${p.endsWith(".mp4") ? "mp4" : "webm"}`}>
                              <Download /> Baixar{v.outputPaths.length > 1 ? ` parte ${i + 1}` : ""}
                            </a>
                          </Button>
                        ) : null,
                      )}
                      {v.status === "done" && (
                        <Button size="sm" variant="ghost" onClick={() => downloadCredits(v)}><FileText /> Créditos (.txt)</Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function downloadCredits(v: VideoListItem) {
  const scenes = (v.scenes as StoredScene[] | null) ?? [];
  const blob = new Blob([creditsText(scenes)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `creditos_${slugify(v.title)}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "video";
}

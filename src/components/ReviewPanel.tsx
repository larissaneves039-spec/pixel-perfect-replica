import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Shuffle, Wrench, Film } from "lucide-react";
import type { ResolvedSlot } from "@/lib/mediaResolver";
import { fmtTime } from "@/lib/formState";
import { cn } from "@/lib/utils";

export function ReviewPanel(props: {
  slots: ResolvedSlot[];
  total: number;
  requests: number;
  busyIndex: number | null;
  busy: boolean;
  onSwap: (i: number) => void;
  onRegenerate: () => void;
  onComplete: () => void;
  onRender: () => void;
  onBack: () => void;
}) {
  const s = props.slots;
  const clips = s.filter((x) => !x.reused && x.media?.type === "video").length;
  const photos = s.filter((x) => !x.reused && x.media?.type === "photo").length;
  const reused = s.filter((x) => x.reused).length;
  return (
    <div className="space-y-6">
      <div className="panel flex flex-wrap items-center gap-x-6 gap-y-3 p-5">
        <Stat n={s.length} l="cenas" />
        <Stat n={clips} l="clipes" />
        <Stat n={photos} l="fotos" />
        <Stat n={reused} l="reaproveitadas" />
        <Stat n={props.requests} l="requisições usadas" />
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="ghost" onClick={props.onBack} disabled={props.busy}>Voltar</Button>
          <Button variant="secondary" onClick={props.onRegenerate} disabled={props.busy}><Shuffle /> Gerar nova seleção</Button>
          {reused > 0 && <Button variant="secondary" onClick={props.onComplete} disabled={props.busy}><Wrench /> Completar cenas faltantes</Button>}
          <Button onClick={props.onRender} disabled={props.busy}><Film /> Renderizar vídeo</Button>
        </div>
      </div>

      <div className="flex h-10 overflow-hidden rounded-md border border-border">
        {s.map((x) => (
          <div key={x.slot.index} title={`${fmtTime(x.slot.startTime)}`} style={{ width: `${(x.slot.duration / props.total) * 100}%` }} className="relative border-r border-background/60 last:border-r-0">
            {x.media && <img src={x.media.thumbUrl} alt="" className={cn("h-full w-full object-cover", x.reused && "opacity-40")} loading="lazy" />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {s.map((x, i) => (
          <div key={i} className="panel overflow-hidden">
            <div className="relative aspect-video bg-muted">
              {x.media && <img src={x.media.thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" />}
              <Badge className="absolute left-2 top-2" variant={x.reused ? "destructive" : x.media?.type === "video" ? "default" : "secondary"}>
                {x.reused ? "Reaproveitada" : x.media?.type === "video" ? "Clipe" : "Foto"}
              </Badge>
            </div>
            <div className="space-y-1.5 p-3 text-xs">
              <div className="font-mono text-foreground">{fmtTime(x.slot.startTime)}–{fmtTime(x.slot.startTime + x.slot.duration)}</div>
              {x.media && <a href={x.media.pexelsUrl} target="_blank" rel="noreferrer" className="block truncate text-muted-foreground hover:text-primary">{x.media.authorName}</a>}
              <Button variant="ghost" size="sm" className="h-7 w-full text-xs" disabled={props.busy || props.busyIndex !== null} onClick={() => props.onSwap(i)}>
                <RefreshCw className={cn(props.busyIndex === i && "animate-spin")} /> Trocar esta mídia
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return (
    <div>
      <div className="font-display text-2xl font-bold">{n}</div>
      <div className="text-xs text-muted-foreground">{l}</div>
    </div>
  );
}

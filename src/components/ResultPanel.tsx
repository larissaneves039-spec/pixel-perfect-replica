import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import type { RenderPart } from "@/lib/renderer";
import type { ResolvedSlot } from "@/lib/mediaResolver";
import { fmtTime } from "@/lib/formState";

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function ResultPanel(props: { parts: RenderPart[]; slots: ResolvedSlot[]; theme: string; total: number; onRestart: () => void }) {
  const slug = props.theme.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "video";
  const dur = fmtTime(props.total).replace(/:/g, "-");
  const name = (p: RenderPart) => `fundo_${slug}_${dur}${props.parts.length > 1 ? `_parte${p.index + 1}` : ""}.${p.ext}`;
  const urls = useMemo(() => props.parts.map((p) => URL.createObjectURL(p.blob)), [props.parts]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  const credits = () => {
    const lines = props.slots.map((s) => `${fmtTime(s.slot.startTime)}–${fmtTime(s.slot.startTime + s.slot.duration)} | ${s.reused ? "Reaproveitada" : s.media?.type === "video" ? "Clipe" : "Foto"} | ${s.media?.authorName ?? ""} | ${s.media?.pexelsUrl ?? ""}`);
    download(new Blob([`Créditos — Mídias fornecidas por Pexels (https://www.pexels.com)\n\n${lines.join("\n")}\n`], { type: "text/plain;charset=utf-8" }), `creditos_${slug}.txt`);
  };
  return (
    <div className="panel space-y-6 p-6">
      <h2 className="text-2xl font-bold">Seu vídeo está pronto</h2>
      <video src={urls[0]} controls className="max-h-[60vh] w-full rounded-md bg-background" />
      <div className="flex flex-wrap gap-2">
        {props.parts.length === 1 ? (
          <Button onClick={() => download(props.parts[0].blob, name(props.parts[0]))}><Download /> Baixar vídeo</Button>
        ) : (
          <>
            {props.parts.map((p) => (
              <Button key={p.index} variant="secondary" onClick={() => download(p.blob, name(p))}><Download /> Parte {p.index + 1} ({fmtTime(p.start)}–{fmtTime(p.end)})</Button>
            ))}
            <Button onClick={() => props.parts.forEach((p, i) => setTimeout(() => download(p.blob, name(p)), i * 600))}><Download /> Baixar todas</Button>
          </>
        )}
        <Button variant="secondary" onClick={credits}><FileText /> Baixar créditos (.txt)</Button>
        <Button variant="ghost" onClick={props.onRestart}>Criar outro</Button>
      </div>
      <p className="text-xs text-muted-foreground">Formato: {props.parts[0]?.ext.toUpperCase()}</p>
    </div>
  );
}

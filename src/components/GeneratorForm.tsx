import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Plus, X, Music, Loader2 } from "lucide-react";
import { TONES } from "@/lib/tables";
import { planSlots } from "@/lib/slotPlanner";
import { type FormState, totalSeconds, MIN_TOTAL, MAX_TOTAL } from "@/lib/formState";
import { cn } from "@/lib/utils";

const PRESETS: [string, number][] = [["30 s", 30], ["1 min", 60], ["3 min", 180], ["5 min", 300], ["10 min", 600], ["15 min", 900], ["30 min", 1800], ["60 min", 3600]];
const CATEGORIES = [...new Set(TONES.map((t) => t.category))];

function Seg<T extends string | number>(p: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {p.options.map(([v, l]) => (
        <button key={String(v)} type="button" onClick={() => p.onChange(v)}
          className={cn("rounded-md border px-3 py-1.5 text-sm transition-colors", p.value === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary text-secondary-foreground hover:bg-accent")}>
          {l}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export interface AudioProps {
  name: string | null;
  duration: number;
  analyzing: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
}

export function GeneratorForm(props: { form: FormState; onChange: (f: FormState) => void; onSubmit: () => void; busy: boolean; audio: AudioProps }) {
  const f = props.form;
  const set = (p: Partial<FormState>) => props.onChange({ ...f, ...p });
  const [kw, setKw] = useState("");
  const total = totalSeconds(f);
  const plan = total >= MIN_TOTAL ? planSlots(total, f.maxMedia, f.sections.map((s) => s.weight)) : null;
  const valid = total >= MIN_TOTAL && total <= MAX_TOTAL && f.theme.trim().length > 0;
  const setTotal = (s: number) => set({ hours: Math.floor(s / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 });
  const addKw = () => {
    const v = kw.trim();
    if (v && !f.keywords.includes(v)) set({ keywords: [...f.keywords, v] });
    setKw("");
  };

  const a = props.audio;
  const locked = !!a.name;
  return (
    <form className="panel space-y-7 p-6 md:p-8" onSubmit={(e) => { e.preventDefault(); if (valid && !a.analyzing) props.onSubmit(); }}>
      <div className="space-y-3 rounded-md border border-dashed border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Music className="size-5 text-primary" />
            <div>
              <div className="font-semibold">{a.name ?? "Enviar áudio (opcional)"}</div>
              <div className="text-xs text-muted-foreground">
                {a.analyzing ? <span className="inline-flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> O Gemini está ouvindo o áudio…</span>
                  : a.name ? `Duração ${Math.floor(a.duration / 60)}:${String(Math.round(a.duration % 60)).padStart(2, "0")} · tema, seções e palavras-chave preenchidos pelo Gemini`
                  : "MP3, MP4, WAV, M4A ou OGG até 15 MB. O Gemini define duração, tema e seções."}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" asChild disabled={a.analyzing}>
              <label className="cursor-pointer">
                {a.name ? "Trocar áudio" : "Escolher áudio"}
                <input type="file" accept="audio/*,video/mp4,.mp4,.m4a,.mp3,.wav,.ogg,.aac,.webm" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) a.onPick(file); }} />
              </label>
            </Button>
            {a.name && <Button type="button" variant="ghost" size="sm" onClick={a.onClear} disabled={a.analyzing}><X /> Remover</Button>}
          </div>
        </div>
        {a.name && (
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={f.includeAudio} onCheckedChange={(v) => set({ includeAudio: v })} /> Incluir o áudio no vídeo final
          </label>
        )}
        {a.name && (
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={f.subtitles} onCheckedChange={(v) => set({ subtitles: v })} disabled={!f.captions?.length} /> Mostrar legendas na parte inferior do vídeo
            {!f.captions?.length && <span className="text-xs text-muted-foreground">(analise o áudio para gerar as legendas)</span>}
          </label>
        )}
      </div>
      <div className="grid gap-7 md:grid-cols-2">
        <Field label="Duração do vídeo" hint={total > 1800 ? <span className="text-warning">A renderização acontece em tempo real: um vídeo de {Math.round(total / 60)} min leva cerca de {Math.round(total / 60)} min para ficar pronto.</span> : total < MIN_TOTAL ? "Mínimo de 10 segundos." : total > MAX_TOTAL ? "Máximo de 3 horas." : null}>
          <div className="flex items-center gap-2">
            {([["hours", "h"], ["minutes", "min"], ["seconds", "s"]] as const).map(([k, l]) => (
              <div key={k} className="flex items-center gap-1">
                <Input type="number" disabled={locked} min={0} max={k === "hours" ? 3 : 59} className="w-20" value={f[k]} onChange={(e) => set({ [k]: Math.max(0, Number(e.target.value) || 0) })} aria-label={l} />
                <span className="text-sm text-muted-foreground">{l}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(([l, s]) => (
              <button key={l} type="button" disabled={locked} onClick={() => setTotal(s)} className={cn("rounded-full border px-2.5 py-0.5 text-xs", total === s ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground")}>{l}</button>
            ))}
          </div>
        </Field>

        <Field label="Formato">
          <Seg value={f.format} onChange={(v) => set({ format: v })} options={[["16:9", "Paisagem 16:9"], ["9:16", "Retrato 9:16"], ["1:1", "Quadrado 1:1"]]} />
        </Field>

        <Field label={`Tempo máximo por mídia: ${f.maxMedia} s`} hint={plan && <>≈ {plan.slots.length} cenas{plan.adjusted && <span className="text-warning"> · ajustado para {plan.effectiveMaxMedia} s por mídia (limite de 600 cenas)</span>}</>}>
          <Slider min={2} max={30} step={1} value={[f.maxMedia]} onValueChange={([v]) => set({ maxMedia: v })} />
        </Field>

        <Field label="Tema">
          <Input value={f.theme} onChange={(e) => set({ theme: e.target.value })} placeholder="ex.: floresta sombria à noite" />
        </Field>

        <Field label="Tom visual">
          <Select value={f.tone} onValueChange={(v) => set({ tone: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectGroup key={c}>
                  <SelectLabel>{c}</SelectLabel>
                  {TONES.filter((t) => t.category === c).map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Palavras-chave extras">
          <div className="flex gap-2">
            <Input value={kw} onChange={(e) => setKw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKw(); } }} placeholder="ex.: fog, river" />
            <Button type="button" variant="secondary" size="icon" onClick={addKw} aria-label="Adicionar"><Plus /></Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {f.keywords.map((k) => (
              <Badge key={k} variant="secondary" className="gap-1">{k}<button type="button" onClick={() => set({ keywords: f.keywords.filter((x) => x !== k) })} aria-label={`Remover ${k}`}><X className="size-3" /></button></Badge>
            ))}
          </div>
        </Field>

        <Field label="Idioma do tema e das palavras-chave">
          <Seg value={f.locale} onChange={(v) => set({ locale: v })} options={[["pt-BR", "Português"], ["en-US", "Inglês"]]} />
        </Field>

        <Field label="Qualidade da fonte">
          <Seg value={f.quality} onChange={(v) => set({ quality: v })} options={[["standard", "Padrão"], ["high", "Alta"]]} />
        </Field>

        <Field label="Tipo de mídia">
          <Seg value={f.mode} onChange={(v) => set({ mode: v })} options={[["video", "Clipes de vídeo"], ["photo", "Fotos"], ["mixed", "Misto"]]} />
          {f.mode === "mixed" && (
            <div className="space-y-1 pt-2">
              <div className="text-xs text-muted-foreground">% de fotos: {f.photoPct}%</div>
              <Slider min={0} max={100} step={5} value={[f.photoPct]} onValueChange={([v]) => set({ photoPct: v })} />
            </div>
          )}
        </Field>
      </div>

      <Collapsible>
        <CollapsibleTrigger className="group flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" /> Avançado
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-5 grid gap-7 md:grid-cols-2">
          <Field label="Seções (opcional)" hint="Cada seção vira um contexto de busca próprio. Sem seções, o vídeo inteiro usa o tema.">
            <div className="space-y-2">
              {f.sections.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={s.description} title={s.keywords?.join(", ")} placeholder="Descrição da seção" onChange={(e) => set({ sections: f.sections.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })} />
                  <Input type="number" min={1} max={100} className="w-20" value={s.weight} aria-label="Peso %" onChange={(e) => set({ sections: f.sections.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) || 0 } : x)) })} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => set({ sections: f.sections.filter((_, j) => j !== i) })} aria-label="Remover seção"><X /></Button>
                </div>
              ))}
              <Button type="button" variant="secondary" size="sm" onClick={() => set({ sections: [...f.sections, { description: "", weight: 25 }] })}><Plus /> Adicionar seção</Button>
            </div>
          </Field>
          <Field label={`Crossfade: ${f.crossfade.toFixed(1)} s`}>
            <Slider min={0} max={2} step={0.1} value={[f.crossfade]} onValueChange={([v]) => set({ crossfade: v })} />
          </Field>
          <Field label="Scanlines sutis">
            <Switch checked={f.scanlines} onCheckedChange={(v) => set({ scanlines: v })} />
          </Field>
          <Field label="Bitrate">
            <Seg value={f.bitrate} onChange={(v) => set({ bitrate: v })} options={[[5, "Leve 5 Mbps"], [8, "Padrão 8 Mbps"], [12, "Alta 12 Mbps"]]} />
          </Field>
          <Field label="Dividir em partes">
            <Seg value={f.partMinutes} onChange={(v) => set({ partMinutes: v })} options={[[0, "Arquivo único"], [5, "5 min"], [10, "10 min"], [20, "20 min"], [30, "30 min"]]} />
          </Field>
        </CollapsibleContent>
      </Collapsible>

      <Button type="submit" size="lg" className="w-full font-semibold" disabled={!valid || props.busy}>
        {a.analyzing ? "Analisando áudio…" : props.busy ? "Buscando mídias…" : "Escolher mídias no Pexels"}
      </Button>
    </form>
  );
}

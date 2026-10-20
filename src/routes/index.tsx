import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Settings, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { GeneratorForm } from "@/components/GeneratorForm";
import { SettingsDialog } from "@/components/SettingsDialog";
import { ReviewPanel } from "@/components/ReviewPanel";
import { ResultPanel } from "@/components/ResultPanel";
import { DEFAULT_FORM, FORMAT_SIZE, fmtTime, MIN_TOTAL, MAX_TOTAL, loadForm, loadKey, saveForm, saveKey, loadGeminiKey, saveGeminiKey, totalSeconds, type FormState } from "@/lib/formState";
import { planSlots, type Slot } from "@/lib/slotPlanner";
import { buildQueries } from "@/lib/queryBuilder";
import { PexelsClient, PexelsError } from "@/lib/pexelsClient";
import { resolveAll, resolveSlot, type ResolvedSlot } from "@/lib/mediaResolver";
import { analyzeAudio, audioDuration, sectionsFromAnalysis } from "@/lib/gemini";
import { renderVideo, supportCheck, type RenderPart, type RenderProgress } from "@/lib/renderer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gerador de Vídeo de Fundo — mídias do Pexels" },
      { name: "description", content: "Gere vídeos de fundo com clipes e fotos do Pexels, sem repetir mídias, direto no navegador." },
      { property: "og:title", content: "Gerador de Vídeo de Fundo — mídias do Pexels" },
      { property: "og:description", content: "Envie um áudio ou escolha duração e tema; o app monta um vídeo de fundo com mídias do Pexels sem repetição." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Step = "form" | "review" | "render" | "result";

function Index() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [apiKey, setApiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioDur, setAudioDur] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [busy, setBusy] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [slots, setSlots] = useState<ResolvedSlot[]>([]);
  const [requests, setRequests] = useState(0);
  const [rateLimited, setRateLimited] = useState(false);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [support, setSupport] = useState<string | null>(null);
  const [rp, setRp] = useState<RenderProgress | null>(null);
  const [parts, setParts] = useState<RenderPart[]>([]);
  const [plannedTotal, setPlannedTotal] = useState(0);
  const clientRef = useRef<PexelsClient | null>(null);
  const usedRef = useRef(new Set<string>());
  const planRef = useRef<Slot[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const renderStart = useRef(0);

  useEffect(() => {
    setForm(loadForm());
    setApiKey(loadKey());
    setGeminiKey(loadGeminiKey());
    setSupport(supportCheck());
  }, []);
  useEffect(() => saveForm(form), [form]);

  const fmt = FORMAT_SIZE[form.format];
  const opts = { orientation: fmt.orientation, mode: form.mode, photoPct: form.photoPct };
  const queriesFor = (s: Slot) =>
    buildQueries({ theme: form.theme, sectionText: form.sections[s.sectionIndex]?.description ?? "", sectionKeywords: form.sections[s.sectionIndex]?.keywords, tone: form.tone, keywords: form.keywords, slotIndex: s.index, userLocale: form.locale });

  const pickAudio = async (file: File) => {
    if (!geminiKey) {
      setSettingsOpen(true);
      toast.error("Cole sua chave do Gemini primeiro.");
      return;
    }
    setAnalyzing(true);
    try {
      const dur = await audioDuration(file);
      if (dur < MIN_TOTAL || dur > MAX_TOTAL) throw new Error("O áudio precisa ter entre 10 segundos e 3 horas.");
      const total = Math.ceil(dur);
      const a = await analyzeAudio(geminiKey, file, dur, form.locale);
      setAudioFile(file);
      setAudioDur(dur);
      setForm((f) => ({
        ...f,
        hours: Math.floor(total / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60,
        theme: a.theme || f.theme, tone: a.tone, keywords: a.keywords.slice(0, 6),
        sections: sectionsFromAnalysis(a.sections, total),
      }));
      toast.success("Áudio analisado! Revise o tema e as seções.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao analisar o áudio.");
    } finally {
      setAnalyzing(false);
    }
  };

  const getClient = (fresh: boolean) => {
    if (fresh || !clientRef.current) clientRef.current = new PexelsClient(apiKey, fmt.minWidth, form.quality, setRequests);
    return clientRef.current;
  };

  const resolveRun = async (mode: "new" | "complete") => {
    if (!apiKey) {
      setSettingsOpen(true);
      toast.error("Cole sua chave do Pexels primeiro.");
      return;
    }
    setBusy(true);
    setRateLimited(false);
    try {
      let existing: ResolvedSlot[] | undefined;
      const client = getClient(mode === "new");
      if (mode === "new") {
        const total = totalSeconds(form);
        const plan = planSlots(total, form.maxMedia, form.sections.map((s) => s.weight));
        if (plan.adjusted) toast.warning(`Tempo por mídia ajustado para ${plan.effectiveMaxMedia} s (limite de 600 cenas).`);
        planRef.current = plan.slots;
        setPlannedTotal(total);
        usedRef.current = new Set();
        setRequests(0);
      } else {
        client.rateLimited = false;
        existing = slots;
        usedRef.current = new Set(slots.filter((s) => !s.reused && s.media).map((s) => s.media!.key));
      }
      const res = await resolveAll({
        searcher: client,
        slots: planRef.current,
        queriesFor,
        opts,
        used: usedRef.current,
        existing,
        onSlotResolved: (d, t, o, i) => {
          setProgressMsg(`Cena ${i + 1}/${t} pronta — ${o}`);
          setProgressPct((d / t) * 100);
        },
      });
      setSlots(res);
      setRateLimited(client.rateLimited);
      setStep("review");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao buscar mídias.");
    } finally {
      setBusy(false);
      setProgressMsg("");
      setProgressPct(0);
    }
  };

  const swap = async (i: number) => {
    setSwapIndex(i);
    try {
      const client = getClient(false);
      const cur = slots[i].media;
      const m = await resolveSlot(client, queriesFor(slots[i].slot), opts, usedRef.current, new Set(cur ? [cur.key] : []));
      if (!m) {
        toast.error(client.rateLimited ? "Limite da API do Pexels atingido." : "Nenhuma outra mídia encontrada para esta cena.");
        setRateLimited(client.rateLimited);
        return;
      }
      if (cur && !slots[i].reused) usedRef.current.delete(cur.key);
      setSlots((s) => s.map((x, j) => (j === i ? { ...x, media: m, reused: false } : x)));
    } catch (e) {
      toast.error(e instanceof PexelsError ? e.message : "Erro ao trocar mídia.");
    } finally {
      setSwapIndex(null);
    }
  };

  const startRender = async () => {
    if (support) {
      toast.error(support);
      return;
    }
    setStep("render");
    setParts([]);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let wake: any = null;
    try {
      wake = await (navigator as any).wakeLock?.request("screen");
    } catch {
      /* ignore */
    }
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onUnload);
    renderStart.current = performance.now();
    await new Promise((r) => requestAnimationFrame(r));
    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Não foi possível preparar o vídeo.");
      const renderScenes = slots.map((s) => {
        if (!s.media) throw new Error("Há uma cena sem mídia.");
        return { start: s.slot.startTime, duration: s.slot.duration, media: s.media, effect: s.effect };
      });
      const out = await renderVideo({
        canvas,
        width: fmt.w,
        height: fmt.h,
        total: plannedTotal,
        scenes: renderScenes,
        replaceVideo: async (blocked, i) => {
          ctrl.signal.throwIfAborted();
          usedRef.current.add(blocked.key);
          return resolveSlot(getClient(false), queriesFor(slots[i].slot), { ...opts, videoOnly: true }, usedRef.current, new Set([blocked.key]));
        },
        onVideoReplaced: (media, i) => {
          setSlots((previous) => previous.map((s, j) => j === i ? { ...s, media, reused: false } : s));
          toast(`Cena ${i + 1}: clipe bloqueado substituído por outro vídeo.`);
        },
        audio: audioFile && form.includeAudio ? audioFile : null,
        crossfade: form.crossfade,
        scanlines: form.scanlines,
        bitrateMbps: form.bitrate,
        partSeconds: form.partMinutes ? form.partMinutes * 60 : null,
        onProgress: setRp,
        signal: ctrl.signal,
      });
      if (ctrl.signal.aborted) {
        setStep("review");
        toast("Renderização cancelada.");
      } else {
        setParts(out);
        setStep("result");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro na renderização.");
      setStep("review");
    } finally {
      window.removeEventListener("beforeunload", onUnload);
      wake?.release?.().catch?.(() => {});
      setRp(null);
    }
  };

  const elapsedWall = rp ? (performance.now() - renderStart.current) / 1000 : 0;
  const pct = rp ? rp.elapsed / rp.total : 0;

  return (
    <div className="min-h-screen pb-20">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">Gerador de Vídeo de Fundo</h1>
          <p className="text-sm text-muted-foreground">Clipes e fotos do Pexels, sem repetição, montados no seu navegador.</p>
        </div>
        <Button variant="secondary" onClick={() => setSettingsOpen(true)}><Settings /> {apiKey ? "Configurações" : "Adicionar chave"}</Button>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6">
        {support && <Notice>{support}</Notice>}
        {rateLimited && step === "review" && <Notice>Limite da API do Pexels atingido (padrão: 200 req/hora e 20.000/mês). Algumas cenas foram reaproveitadas — use "Completar cenas faltantes" mais tarde.</Notice>}

        {step === "form" && (
          <>
            <GeneratorForm form={form} onChange={setForm} onSubmit={() => resolveRun("new")} busy={busy}
              audio={{ name: audioFile?.name ?? null, duration: audioDur, analyzing, onPick: pickAudio, onClear: () => { setAudioFile(null); setAudioDur(0); } }} />
            {busy && <BusyBar msg={progressMsg} pct={progressPct} requests={requests} />}
          </>
        )}
        {step === "review" && (
          <>
            {busy && <BusyBar msg={progressMsg} pct={progressPct} requests={requests} />}
            <ReviewPanel slots={slots} total={plannedTotal} requests={requests} busy={busy} busyIndex={swapIndex}
              onSwap={swap} onRegenerate={() => resolveRun("new")} onComplete={() => resolveRun("complete")} onRender={startRender} onBack={() => setStep("form")} />
          </>
        )}
        <div className={step === "render" ? "panel space-y-5 p-6" : "hidden"}>
          <Notice>A renderização acontece em tempo real (≈ a duração do vídeo). Mantenha esta aba aberta e visível.</Notice>
          <canvas ref={canvasRef} className="mx-auto max-h-[50vh] max-w-full rounded-md border border-border bg-background" />
          <Progress value={pct * 100} />
          <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
            <span>{Math.round(pct * 100)}% · {fmtTime(rp?.elapsed ?? 0)} / {fmtTime(plannedTotal)}</span>
            <span>Cena {(rp?.sceneIndex ?? 0) + 1}/{slots.length}{rp && rp.parts > 1 ? ` · parte ${rp.part + 1}/${rp.parts}` : ""}</span>
            <span>Decorrido {fmtTime(elapsedWall)} · restante ≈ {fmtTime(plannedTotal - (rp?.elapsed ?? 0))}</span>
          </div>
          <Button variant="destructive" onClick={() => abortRef.current?.abort()}>Cancelar</Button>
        </div>
        {step === "result" && <ResultPanel parts={parts} slots={slots} theme={form.theme} total={plannedTotal} onRestart={() => setStep("form")} />}
      </main>

      <footer className="fixed inset-x-0 bottom-0 border-t border-border bg-background/90 py-2 text-center text-xs text-muted-foreground backdrop-blur">
        <a href="https://www.pexels.com" target="_blank" rel="noreferrer" className="hover:text-primary">Mídias fornecidas por Pexels</a>
      </footer>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} value={apiKey} geminiValue={geminiKey} onSave={(k, g) => { setApiKey(k); saveKey(k); setGeminiKey(g); saveGeminiKey(g); clientRef.current = null; }} />
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
      <div>{children}</div>
    </div>
  );
}

function BusyBar({ msg, pct, requests }: { msg: string; pct: number; requests: number }) {
  return (
    <div className="panel space-y-2 p-4">
      <Progress value={pct} />
      <div className="flex justify-between text-xs text-muted-foreground"><span>{msg || "Buscando mídias…"}</span><span>{requests} requisições</span></div>
    </div>
  );
}

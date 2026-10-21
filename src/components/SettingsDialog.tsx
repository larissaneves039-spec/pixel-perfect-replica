import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { testKey, PexelsError } from "@/lib/pexelsClient";
import { toast } from "sonner";
import { testGeminiKey } from "@/lib/gemini";

export function SettingsDialog(props: { open: boolean; onOpenChange: (o: boolean) => void; value: string; geminiValue: string; onSave: (k: string, g: string) => void }) {
  const [key, setKey] = useState(props.value);
  const [gkey, setGkey] = useState(props.geminiValue);
  const [gtesting, setGtesting] = useState(false);
  const runG = async () => {
    setGtesting(true);
    try {
      const model = await testGeminiKey(gkey.trim());
      toast.success(`Chave do Gemini válida! Modelo usado: ${model}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao testar a chave.");
    } finally {
      setGtesting(false);
    }
  };
  const [testing, setTesting] = useState(false);
  const run = async () => {
    setTesting(true);
    try {
      await testKey(key.trim());
      toast.success("Chave válida!");
    } catch (e) {
      toast.error(e instanceof PexelsError ? e.message : "Falha ao testar a chave.");
    } finally {
      setTesting(false);
    }
  };
  return (
    <Dialog open={props.open} onOpenChange={(o) => { if (o) { setKey(props.value); setGkey(props.geminiValue); } props.onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurações</DialogTitle>
          <DialogDescription>Suas chaves ficam salvas apenas neste navegador.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="pkey">Chave da API do Pexels</Label>
          <Input id="pkey" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Cole sua chave aqui" />
          <a href="https://www.pexels.com/api/" target="_blank" rel="noreferrer" className="text-sm text-primary underline-offset-4 hover:underline">
            Obter chave grátis
          </a>
          <div><Button size="sm" variant="secondary" onClick={run} disabled={!key.trim() || testing}>{testing ? "Testando…" : "Testar chave"}</Button></div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="gkey">Chave da API do Gemini (para analisar áudios)</Label>
          <Input id="gkey" type="password" value={gkey} onChange={(e) => setGkey(e.target.value)} placeholder="Cole sua chave aqui" />
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-sm text-primary underline-offset-4 hover:underline">Obter chave do Gemini</a>
          <div><Button size="sm" variant="secondary" onClick={runG} disabled={!gkey.trim() || gtesting}>{gtesting ? "Testando…" : "Testar chave"}</Button></div>
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={() => { props.onSave(key.trim(), gkey.trim()); props.onOpenChange(false); toast.success("Chaves salvas."); }}>Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { testKey, PexelsError } from "@/lib/pexelsClient";
import { toast } from "sonner";

export function SettingsDialog(props: { open: boolean; onOpenChange: (o: boolean) => void; value: string; onSave: (k: string) => void }) {
  const [key, setKey] = useState(props.value);
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
    <Dialog open={props.open} onOpenChange={(o) => { if (o) setKey(props.value); props.onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurações</DialogTitle>
          <DialogDescription>Sua chave do Pexels fica salva apenas neste navegador.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="pkey">Chave da API do Pexels</Label>
          <Input id="pkey" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Cole sua chave aqui" />
          <a href="https://www.pexels.com/api/" target="_blank" rel="noreferrer" className="text-sm text-primary underline-offset-4 hover:underline">
            Obter chave grátis
          </a>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={run} disabled={!key.trim() || testing}>{testing ? "Testando…" : "Testar chave"}</Button>
          <Button onClick={() => { props.onSave(key.trim()); props.onOpenChange(false); toast.success("Chave salva."); }}>Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

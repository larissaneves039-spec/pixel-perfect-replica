import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Clapperboard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Gerador de Vídeo de Fundo" },
      { name: "description", content: "Entre com e-mail e senha para gerenciar suas pastas de vídeos." },
      { property: "og:title", content: "Entrar — Gerador de Vídeo de Fundo" },
      { property: "og:description", content: "Entre com e-mail e senha para gerenciar suas pastas de vídeos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) void navigate({ to: "/videos", replace: true });
    });
  }, [navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) {
          void navigate({ to: "/videos", replace: true });
        } else {
          setConfirmEmail(true);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        void navigate({ to: "/videos", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na autenticação.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="panel w-full max-w-sm space-y-6 p-8">
        <div className="flex items-center gap-2">
          <Clapperboard className="size-6 text-primary" />
          <h1 className="font-display text-2xl font-bold">Gerador de Vídeo de Fundo</h1>
        </div>
        {confirmEmail ? (
          <div className="space-y-3 text-sm">
            <p className="font-medium">Conta criada!</p>
            <p className="text-muted-foreground">
              Confirme seu e-mail na mensagem que enviamos (verifique também o spam) e depois volte aqui para entrar.
            </p>
            <Button variant="secondary" onClick={() => setMode("signin")} className="w-full">
              Voltar para o login
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={submit}>
            <div className="flex rounded-md border border-input p-1 text-sm">
              <button type="button" onClick={() => setMode("signin")}
                className={`flex-1 rounded px-3 py-1.5 ${mode === "signin" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                Entrar
              </button>
              <button type="button" onClick={() => setMode("signup")}
                className={`flex-1 rounded px-3 py-1.5 ${mode === "signup" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                Criar conta
              </button>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mínimo 6 caracteres" />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {mode === "signup" ? "Criar conta" : "Entrar"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              <Link to="/" className="hover:text-primary">Voltar ao gerador</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Truck, Check, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

const checks = (s: string) => ({
  len: s.length >= 8,
  num: /\d/.test(s),
  upper: /[A-Z]/.test(s),
});

export default function SetupSenha() {
  const { user, refreshPerfil, mustChangePassword } = useAuth();
  const { toast } = useToast();
  const nav = useNavigate();
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [loading, setLoading] = useState(false);

  if (!user) return <Navigate to="/auth" replace />;

  const c = checks(p1);
  const ok = c.len && c.num && c.upper && p1 === p2;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: p1 });
    if (error) { setLoading(false); return toast({ title: "Erro", description: error.message, variant: "destructive" }); }

    // Limpa flag must_change_password se houver perfil
    await (supabase as any).from("usuarios_perfis").update({ must_change_password: false }).eq("user_id", user.id);
    await refreshPerfil();
    setLoading(false);
    toast({ title: "Senha definida", description: "Bem-vindo ao sistema!" });
    nav("/agendamentos", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-dark p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3 text-white">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-brand shadow-elevated">
            <Truck className="h-6 w-6" />
          </div>
          <div className="text-left">
            <h1 className="text-xl font-bold">BRQ - FROTA INTERNA</h1>
            <p className="text-xs text-white/60">Defina sua senha de acesso</p>
          </div>
        </div>
        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle>{mustChangePassword ? "Bem-vindo!" : "Trocar senha"}</CardTitle>
            <CardDescription>
              {mustChangePassword ? "Crie uma senha segura para acessar o sistema." : "Atualize sua senha quando quiser."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nova senha</Label>
                <Input type="password" value={p1} onChange={(e) => setP1(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Confirmar senha</Label>
                <Input type="password" value={p2} onChange={(e) => setP2(e.target.value)} required />
              </div>
              <ul className="space-y-1 rounded-md border border-border bg-muted/30 p-3 text-xs">
                <Req ok={c.len} label="Mínimo 8 caracteres" />
                <Req ok={c.upper} label="1 letra maiúscula" />
                <Req ok={c.num} label="1 número" />
                <Req ok={!!p1 && p1 === p2} label="Senhas iguais" />
              </ul>
              <Button type="submit" disabled={!ok || loading} className="w-full bg-gradient-brand text-primary-foreground">
                {loading ? "Salvando..." : "Salvar e entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Req({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-2 ${ok ? "text-success" : "text-muted-foreground"}`}>
      {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}{label}
    </li>
  );
}

import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export default function Auth() {
  const { user, signIn, signUp } = useAuth();
  const nav = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  if (!isSupabaseConfigured) return <Navigate to="/setup" replace />;
  if (user) return <Navigate to="/" replace />;

  const onSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await signIn(String(fd.get("email")), String(fd.get("password")));
    setLoading(false);
    if (error) toast({ title: "Erro ao entrar", description: error, variant: "destructive" });
    else nav("/");
  };

  const onSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await signUp(String(fd.get("email")), String(fd.get("password")), String(fd.get("nome")));
    setLoading(false);
    if (error) toast({ title: "Erro ao criar conta", description: error, variant: "destructive" });
    else toast({ title: "Conta criada", description: "Verifique seu e-mail caso a confirmação esteja ativa, depois faça login." });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-dark p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3 text-white">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-brand shadow-elevated">
            <Truck className="h-6 w-6" />
          </div>
          <div className="text-left">
            <h1 className="text-xl font-bold">BRQ – Frota Interna</h1>
            <p className="text-xs text-white/60">Gestão de frota corporativa</p>
          </div>
        </div>
        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle>Acesso</CardTitle>
            <CardDescription>Entre ou crie sua conta para continuar.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={onSignIn} className="space-y-3 pt-3">
                  <div className="space-y-1.5"><Label htmlFor="se">E-mail</Label><Input id="se" name="email" type="email" required /></div>
                  <div className="space-y-1.5"><Label htmlFor="sp">Senha</Label><Input id="sp" name="password" type="password" required minLength={6} /></div>
                  <Button type="submit" className="w-full bg-gradient-brand text-primary-foreground" disabled={loading}>
                    {loading ? "Entrando..." : "Entrar"}
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={onSignUp} className="space-y-3 pt-3">
                  <div className="space-y-1.5"><Label htmlFor="un">Nome</Label><Input id="un" name="nome" required /></div>
                  <div className="space-y-1.5"><Label htmlFor="ue">E-mail</Label><Input id="ue" name="email" type="email" required /></div>
                  <div className="space-y-1.5"><Label htmlFor="up">Senha</Label><Input id="up" name="password" type="password" required minLength={6} /></div>
                  <Button type="submit" className="w-full bg-gradient-brand text-primary-foreground" disabled={loading}>
                    {loading ? "Criando..." : "Criar conta"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

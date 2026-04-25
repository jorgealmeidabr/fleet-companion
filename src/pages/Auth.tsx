import { useState } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { validarEmail } from "@/lib/validators";

export default function Auth() {
  const { user, signIn, signUp } = useAuth();
  const nav = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

  // Estados de validação ao vivo
  const [signinErrors, setSigninErrors] = useState<{ email?: string; password?: string }>({});
  const [signupErrors, setSignupErrors] = useState<{ email?: string; password?: string; nome?: string }>({});

  if (!isSupabaseConfigured) return <Navigate to="/setup" replace />;
  if (user) return <Navigate to="/" replace />;

  const onSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email"));
    const password = String(fd.get("password"));
    const errs = { email: validarEmail(email) ?? undefined, password: password.length < 6 ? "Senha mínima 6 caracteres" : undefined };
    setSigninErrors(errs as any);
    if (errs.email || errs.password) return;
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) toast({ title: "Erro ao entrar", description: error, variant: "destructive" });
    else { toast({ title: "Bem-vindo!" }); nav("/"); }
  };

  const onSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nome = String(fd.get("nome")).trim();
    const email = String(fd.get("email"));
    const password = String(fd.get("password"));
    const errs = {
      nome: nome.length < 2 ? "Informe seu nome" : undefined,
      email: validarEmail(email) ?? undefined,
      password: password.length < 6 ? "Senha mínima 6 caracteres" : undefined,
    };
    setSignupErrors(errs as any);
    if (errs.nome || errs.email || errs.password) return;
    setLoading(true);
    const { error } = await signUp(email, password, nome);
    setLoading(false);
    if (error) toast({ title: "Erro ao criar conta", description: error, variant: "destructive" });
    else toast({ title: "Conta criada", description: "Verifique seu e-mail caso a confirmação esteja ativa, depois faça login." });
  };

  const onForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validarEmail(forgotEmail)) { toast({ title: "E-mail inválido", variant: "destructive" }); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "E-mail enviado", description: "Confira sua caixa de entrada." }); setForgot(false); }
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
            <p className="text-xs text-white/60">Gestão de frota corporativa BRQ</p>
          </div>
        </div>
        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle>{forgot ? "Recuperar senha" : "Acesso"}</CardTitle>
            <CardDescription>
              {forgot ? "Enviaremos um link para redefinir sua senha." : "Entre ou crie sua conta para continuar."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {forgot ? (
              <form onSubmit={onForgot} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fe">E-mail</Label>
                  <Input id="fe" type="email" required value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
                </div>
                <Button type="submit" className="w-full bg-gradient-brand text-primary-foreground" disabled={loading}>
                  {loading ? "Enviando..." : "Enviar link"}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setForgot(false)}>Voltar</Button>
              </form>
            ) : (
              <Tabs defaultValue="signin">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Entrar</TabsTrigger>
                  <TabsTrigger value="signup">Criar conta</TabsTrigger>
                </TabsList>
                <TabsContent value="signin">
                  <form onSubmit={onSignIn} className="space-y-3 pt-3" noValidate>
                    <div className="space-y-1.5">
                      <Label htmlFor="se">E-mail</Label>
                      <Input id="se" name="email" type="email" required onBlur={(e) => setSigninErrors(s => ({ ...s, email: validarEmail(e.target.value) ?? undefined }))} />
                      {signinErrors.email && <p className="text-xs text-destructive">{signinErrors.email}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sp">Senha</Label>
                      <Input id="sp" name="password" type="password" required minLength={6} />
                      {signinErrors.password && <p className="text-xs text-destructive">{signinErrors.password}</p>}
                    </div>
                    <Button type="submit" className="w-full bg-gradient-brand text-primary-foreground" disabled={loading}>
                      {loading ? "Entrando..." : "Entrar"}
                    </Button>
                    <button type="button" className="block w-full text-center text-xs text-muted-foreground hover:text-foreground" onClick={() => setForgot(true)}>
                      Esqueceu a senha?
                    </button>
                  </form>
                </TabsContent>
                <TabsContent value="signup">
                  <form onSubmit={onSignUp} className="space-y-3 pt-3" noValidate>
                    <div className="space-y-1.5">
                      <Label htmlFor="un">Nome</Label>
                      <Input id="un" name="nome" required onBlur={(e) => setSignupErrors(s => ({ ...s, nome: e.target.value.trim().length < 2 ? "Informe seu nome" : undefined }))} />
                      {signupErrors.nome && <p className="text-xs text-destructive">{signupErrors.nome}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ue">E-mail</Label>
                      <Input id="ue" name="email" type="email" required onBlur={(e) => setSignupErrors(s => ({ ...s, email: validarEmail(e.target.value) ?? undefined }))} />
                      {signupErrors.email && <p className="text-xs text-destructive">{signupErrors.email}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="up">Senha</Label>
                      <Input id="up" name="password" type="password" required minLength={6} />
                      {signupErrors.password && <p className="text-xs text-destructive">{signupErrors.password}</p>}
                    </div>
                    <Button type="submit" className="w-full bg-gradient-brand text-primary-foreground" disabled={loading}>
                      {loading ? "Criando..." : "Criar conta"}
                    </Button>
                    <p className="text-center text-[11px] text-muted-foreground">
                      Novas contas iniciam como <strong>motorista</strong>. Um admin pode promover seu papel.
                    </p>
                  </form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-white/50">
          <Link to="/setup" className="hover:text-white">Configurações de conexão</Link>
        </p>
      </div>
    </div>
  );
}

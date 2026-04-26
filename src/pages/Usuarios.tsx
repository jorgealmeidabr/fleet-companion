import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { fmtDateTime } from "@/lib/format";
import { validarEmail, validarCNH, formatarCNH, validarTelefone, formatarTelefone } from "@/lib/validators";
import type { Motorista, ModuloPermissao, Permissoes, UsuarioPerfil } from "@/lib/types";
import { PERMISSOES_DEFAULT, PERMISSOES_TUDO } from "@/lib/types";
import {
  Plus, Search, MoreVertical, ShieldCheck, Mail, Eye, EyeOff, Copy,
  LayoutDashboard, Car, Users as UsersIcon, Wrench, Fuel, CalendarRange,
  ClipboardCheck, AlertTriangle, Bell, History, DollarSign, Lock, Check,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Row extends UsuarioPerfil {
  motorista?: Motorista | null;
  email?: string | null;
}

const MOD_META: Array<{ key: ModuloPermissao; label: string; icon: any; locked?: boolean }> = [
  { key: "dashboard",     label: "Dashboard",          icon: LayoutDashboard },
  { key: "veiculos",      label: "Veículos",           icon: Car },
  { key: "motoristas",    label: "Pessoas / Motoristas", icon: UsersIcon },
  { key: "manutencao",    label: "Manutenção",         icon: Wrench },
  { key: "abastecimento", label: "Abastecimento",      icon: Fuel },
  { key: "agendamentos",  label: "Agendamentos",       icon: CalendarRange, locked: true },
  { key: "checklists",    label: "Checklists",         icon: ClipboardCheck, locked: true },
  { key: "multas",        label: "Multas",             icon: AlertTriangle },
  { key: "alertas",       label: "Alertas",            icon: Bell },
  { key: "historico",     label: "Histórico / Logs",   icon: History },
];

const PRESETS: Record<string, Permissoes> = {
  minimo: { ...PERMISSOES_DEFAULT },
  operacional: {
    ...PERMISSOES_DEFAULT,
    veiculos: true, abastecimento: true, alertas: true,
  },
  zerar: { ...PERMISSOES_DEFAULT, agendamentos: true, checklists: true }, // mantém obrigatórios
};

const generatePassword = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const nums = "23456789";
  const all = chars + lower + nums;
  let p = chars[Math.floor(Math.random() * chars.length)] + nums[Math.floor(Math.random() * nums.length)];
  for (let i = 0; i < 8; i++) p += all[Math.floor(Math.random() * all.length)];
  return p;
};

export default function Usuarios() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [fTipo, setFTipo] = useState<"all" | "admin" | "usuario">("all");
  const [fStatus, setFStatus] = useState<"all" | "ativo" | "inativo">("all");

  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const reload = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("usuarios_perfis").select("*").order("created_at", { ascending: false });
    const list = (data ?? []) as UsuarioPerfil[];
    const mIds = list.map(p => p.motorista_id).filter(Boolean);
    let mots: Record<string, Motorista> = {};
    if (mIds.length) {
      const { data: ms } = await supabase.from("motoristas").select("*").in("id", mIds);
      ((ms ?? []) as Motorista[]).forEach(m => { mots[m.id] = m; });
    }
    setRows(list.map(p => ({ ...p, motorista: mots[p.motorista_id], email: mots[p.motorista_id]?.email })));
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter(r => {
      if (fTipo !== "all" && r.tipo_conta !== fTipo) return false;
      if (fStatus === "ativo" && !r.ativo) return false;
      if (fStatus === "inativo" && r.ativo) return false;
      if (q) {
        const hay = `${r.motorista?.nome ?? ""} ${r.email ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, busca, fTipo, fStatus]);

  const toggleAtivo = async (r: Row) => {
    await (supabase as any).from("usuarios_perfis").update({ ativo: !r.ativo }).eq("id", r.id);
    toast({ title: !r.ativo ? "Usuário ativado" : "Usuário desativado" });
    reload();
  };

  return (
    <>
      <PageHeader
        title="Usuários"
        subtitle="Gerencie quem acessa o sistema e o que cada pessoa pode ver"
        actions={
          <Button className="bg-gradient-brand text-primary-foreground" onClick={() => { setEditing(null); setOpenModal(true); }}>
            <Plus className="mr-1 h-4 w-4" />Novo usuário
          </Button>
        }
      />

      <Card className="mb-4 shadow-card">
        <CardContent className="grid gap-3 p-4 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por nome ou e-mail..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <Select value={fTipo} onValueChange={(v: any) => setFTipo(v)}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="admin">Apenas Admins</SelectItem>
              <SelectItem value="usuario">Apenas Usuários</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fStatus} onValueChange={(v: any) => setFStatus(v)}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="inativo">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-10 text-center text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={UsersIcon} title="Nenhum usuário encontrado" description="Crie o primeiro usuário do sistema." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Usuário</th>
                    <th className="px-4 py-3 text-left">Cargo</th>
                    <th className="px-4 py-3 text-left">E-mail</th>
                    <th className="px-4 py-3 text-left">Tipo</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Último acesso</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} className="border-b border-border hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={r.motorista?.foto_url ?? undefined} />
                            <AvatarFallback>{(r.motorista?.nome ?? "?").slice(0,2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium leading-tight">{r.motorista?.nome ?? "—"}</p>
                            {r.must_change_password && <p className="text-[10px] text-warning">Convite pendente</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.motorista?.cargo ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.email ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge className={r.tipo_conta === "admin" ? "bg-purple-600/15 text-purple-600 hover:bg-purple-600/15 border border-purple-600/30" : "bg-muted text-muted-foreground hover:bg-muted"}>
                          {r.tipo_conta === "admin" ? "Admin" : "Usuário"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={r.ativo ? "default" : "secondary"} className={r.ativo ? "bg-success/15 text-success border border-success/30 hover:bg-success/15" : ""}>
                          {r.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{r.last_login ? fmtDateTime(r.last_login) : "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditing(r); setOpenModal(true); }}>Editar</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <ConfirmDialog
                              title={r.ativo ? "Desativar usuário" : "Ativar usuário"}
                              description={r.ativo ? "O usuário não conseguirá mais entrar no sistema." : "O usuário voltará a ter acesso."}
                              confirmLabel={r.ativo ? "Desativar" : "Ativar"}
                              destructive={r.ativo}
                              onConfirm={() => toggleAtivo(r)}
                              trigger={<DropdownMenuItem onSelect={e => e.preventDefault()}>{r.ativo ? "Desativar conta" : "Ativar conta"}</DropdownMenuItem>}
                            />
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <UserWizard
        open={openModal}
        onOpenChange={(o) => { setOpenModal(o); if (!o) setEditing(null); }}
        editing={editing}
        onSaved={reload}
        currentUserId={currentUser?.id ?? null}
      />
    </>
  );
}

// =====================================================================
// MODAL DE 3 PASSOS
// =====================================================================
function UserWizard({
  open, onOpenChange, editing, onSaved, currentUserId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Row | null;
  onSaved: () => void;
  currentUserId: string | null;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  // Passo 1: dados pessoais
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cargo, setCargo] = useState("");
  const [cnhNum, setCnhNum] = useState("");
  const [cnhCat, setCnhCat] = useState("B");
  const [cnhVal, setCnhVal] = useState("");
  const [tipoConta, setTipoConta] = useState<"admin" | "usuario">("usuario");
  const [senha, setSenha] = useState("");

  // Passo 2: permissões
  const [perms, setPerms] = useState<Permissoes>(PERMISSOES_DEFAULT);

  // Detecção de motorista existente
  const [existingMot, setExistingMot] = useState<Motorista | null>(null);
  const [linkExisting, setLinkExisting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(1); setSaving(false); setExistingMot(null); setLinkExisting(false);
    if (editing) {
      const m = editing.motorista;
      setNome(m?.nome ?? ""); setEmail(m?.email ?? ""); setTelefone(m?.telefone ?? "");
      setCargo(m?.cargo ?? ""); setCnhNum(m?.cnh_numero ?? ""); setCnhCat(m?.cnh_categoria ?? "B");
      setCnhVal(m?.cnh_validade ?? ""); setTipoConta(editing.tipo_conta);
      setPerms(editing.permissoes ?? PERMISSOES_DEFAULT); setSenha("");
    } else {
      setNome(""); setEmail(""); setTelefone(""); setCargo(""); setCnhNum("");
      setCnhCat("B"); setCnhVal(""); setTipoConta("usuario");
      setPerms(PERMISSOES_DEFAULT); setSenha(generatePassword());
    }
  }, [open, editing]);

  // Verifica motorista existente por email (apenas no modo criar)
  useEffect(() => {
    if (editing) return;
    const e = email.trim().toLowerCase();
    if (!e || validarEmail(e)) { setExistingMot(null); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from("motoristas").select("*").eq("email", e).limit(1);
      const found = ((data ?? []) as Motorista[])[0];
      if (found) {
        setExistingMot(found);
        // pré-preenche
        if (!nome) setNome(found.nome);
        if (!cargo) setCargo(found.cargo ?? "");
        if (!telefone) setTelefone(found.telefone ?? "");
        if (!cnhNum) setCnhNum(found.cnh_numero);
        if (!cnhCat) setCnhCat(found.cnh_categoria);
        if (!cnhVal) setCnhVal(found.cnh_validade);
      } else setExistingMot(null);
    }, 400);
    return () => clearTimeout(t);
  }, [email, editing]);

  const passo1Valido = (): string | null => {
    if (nome.trim().length < 2) return "Informe o nome";
    if (validarEmail(email)) return "E-mail inválido";
    if (cargo.trim().length < 2) return "Informe o cargo";
    if (telefone && validarTelefone(telefone)) return "Telefone inválido";
    if (cnhNum && validarCNH(cnhNum)) return "CNH deve ter 11 dígitos";
    if (!editing && senha.length < 8) return "Senha temporária mínima 8 caracteres";
    return null;
  };

  const next = () => {
    if (step === 1) {
      const err = passo1Valido();
      if (err) return toast({ title: err, variant: "destructive" });
      setStep(tipoConta === "admin" ? 3 : 2);
      return;
    }
    if (step === 2) {
      setStep(3);
      return;
    }
  };
  const back = () => {
    if (step === 3 && tipoConta === "admin") setStep(1);
    else setStep(s => Math.max(1, s - 1));
  };

  const setPerm = (k: ModuloPermissao, v: boolean) => setPerms(p => ({ ...p, [k]: v }));

  const submit = async () => {
    setSaving(true);
    try {
      // 1. Resolver/criar motorista
      let motoristaId: string;
      if (editing) {
        motoristaId = editing.motorista_id;
        await (supabase as any).from("motoristas").update({
          nome, email, telefone: telefone || null, cargo: cargo || null,
          cnh_numero: cnhNum || "00000000000",
          cnh_categoria: cnhCat,
          cnh_validade: cnhVal || new Date(Date.now() + 5*365*86400000).toISOString().slice(0,10),
        }).eq("id", motoristaId);
      } else if (linkExisting && existingMot) {
        motoristaId = existingMot.id;
      } else {
        const { data: mNew, error: mErr } = await (supabase as any).from("motoristas").insert({
          nome, email, telefone: telefone || null, cargo: cargo || null,
          cnh_numero: cnhNum || "00000000000",
          cnh_categoria: cnhCat,
          cnh_validade: cnhVal || new Date(Date.now() + 5*365*86400000).toISOString().slice(0,10),
          status: "ativo",
        }).select().single();
        if (mErr) throw mErr;
        motoristaId = (mNew as Motorista).id;
      }

      // 2. Criar usuário Auth (apenas no modo criar)
      let userId: string;
      if (editing) {
        userId = editing.user_id;
        // Atualizar perfil
        const finalPerms = tipoConta === "admin" ? PERMISSOES_TUDO : perms;
        await (supabase as any).from("usuarios_perfis").update({
          tipo_conta: tipoConta, permissoes: finalPerms, motorista_id: motoristaId,
        }).eq("id", editing.id);
        toast({ title: "Usuário atualizado" });
      } else {
        // signUp com senha temporária
        const { data: signed, error: sErr } = await supabase.auth.signUp({
          email, password: senha,
          options: { data: { nome }, emailRedirectTo: `${window.location.origin}/setup-senha` },
        });
        if (sErr) throw sErr;
        userId = signed.user!.id;

        // Vincula motorista ao user_id
        await (supabase as any).from("motoristas").update({ user_id: userId }).eq("id", motoristaId);

        const finalPerms = tipoConta === "admin" ? PERMISSOES_TUDO : perms;
        const { error: pErr } = await (supabase as any).from("usuarios_perfis").insert({
          user_id: userId, motorista_id: motoristaId,
          tipo_conta: tipoConta, permissoes: finalPerms, ativo: true,
          must_change_password: true,
        });
        if (pErr) throw pErr;
        toast({
          title: "Usuário criado",
          description: `Senha temporária: ${senha} — copie e envie ao usuário.`,
        });
      }
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const copyPwd = () => { navigator.clipboard.writeText(senha); toast({ title: "Senha copiada" }); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar usuário" : "Novo usuário"}</DialogTitle>
          <DialogDescription className="sr-only">
            Assistente em três etapas: dados pessoais, permissões de acesso e confirmação.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          {[1, 2, 3].map((s, idx) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full border ${step >= s ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{s}</div>
              <span>{s === 1 ? "Dados" : s === 2 ? "Permissões" : "Confirmar"}</span>
              {idx < 2 && <div className="mx-1 h-px w-6 bg-border" />}
            </div>
          ))}
        </div>

        {/* PASSO 1 */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Nome completo *"><Input value={nome} onChange={e => setNome(e.target.value)} /></Field>
              <Field label="E-mail (login) *"><Input type="email" disabled={!!editing} value={email} onChange={e => setEmail(e.target.value)} /></Field>
            </div>
            {existingMot && !editing && (
              <div className="rounded-md border border-info/30 bg-info/10 p-3 text-sm">
                <p className="font-medium text-info">E-mail já cadastrado em motoristas: <span className="font-bold">{existingMot.nome}</span>.</p>
                <p className="mt-1 text-xs text-muted-foreground">Deseja vincular este cadastro existente?</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant={linkExisting ? "default" : "outline"} onClick={() => setLinkExisting(true)}>Sim, vincular</Button>
                  <Button size="sm" variant={!linkExisting ? "default" : "outline"} onClick={() => setLinkExisting(false)}>Não, criar novo</Button>
                </div>
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Telefone"><Input value={telefone} onChange={e => setTelefone(formatarTelefone(e.target.value))} placeholder="(00) 00000-0000" /></Field>
              <Field label="Cargo *"><Input value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Motorista, Técnico, Supervisor..." /></Field>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="CNH número"><Input value={cnhNum} onChange={e => setCnhNum(formatarCNH(e.target.value))} placeholder="11 dígitos" /></Field>
              <Field label="CNH categoria">
                <Select value={cnhCat} onValueChange={setCnhCat}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["A","B","AB","C","D","E"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="CNH validade"><Input type="date" value={cnhVal} onChange={e => setCnhVal(e.target.value)} /></Field>
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <Label className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Tipo de conta</Label>
              <Tabs value={tipoConta} onValueChange={(v: any) => setTipoConta(v)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="usuario">Usuário</TabsTrigger>
                  <TabsTrigger value="admin">Admin</TabsTrigger>
                </TabsList>
              </Tabs>
              {tipoConta === "admin" && (
                <p className="text-xs text-muted-foreground">
                  Admins têm <strong>acesso completo</strong> ao sistema e podem gerenciar outros usuários.
                </p>
              )}
            </div>

            {!editing && (
              <Field label="Senha temporária (o usuário será obrigado a trocar)">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input type={showPwd ? "text" : "password"} value={senha} onChange={e => setSenha(e.target.value)} className="pr-10" />
                    <button type="button" onClick={() => setShowPwd(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button type="button" variant="outline" size="icon" onClick={copyPwd} title="Copiar"><Copy className="h-4 w-4" /></Button>
                  <Button type="button" variant="outline" onClick={() => setSenha(generatePassword())}>Gerar</Button>
                </div>
              </Field>
            )}
          </div>
        )}

        {/* PASSO 2 */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-sm font-semibold">O que este usuário poderá ver?</p>
              <p className="text-xs text-muted-foreground">Itens marcados aparecem na barra lateral. Itens desmarcados nem existem para o usuário.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setPerms({ ...PRESETS.minimo })}>Acesso mínimo</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setPerms({ ...PRESETS.operacional })}>Acesso operacional</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setPerms({ ...PRESETS.zerar })}>Limpar tudo</Button>
            </div>

            <div className="divide-y divide-border rounded-lg border border-border">
              {MOD_META.map(({ key, label, icon: Icon, locked }) => (
                <div key={key} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{label}</span>
                    {locked && <Tooltip><TooltipTrigger asChild><Lock className="h-3 w-3 text-muted-foreground" /></TooltipTrigger><TooltipContent>Obrigatório para todos os usuários</TooltipContent></Tooltip>}
                  </div>
                  <Switch
                    checked={locked ? true : perms[key]}
                    disabled={!!locked}
                    onCheckedChange={(v) => setPerm(key, v)}
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-lg border border-warning/40 bg-warning/10 p-3">
              <div className="flex items-center gap-3">
                <DollarSign className="h-4 w-4 text-warning" />
                <div>
                  <p className="text-sm font-medium">Ver valores financeiros (R$)</p>
                  <p className="text-xs text-muted-foreground">Oculta custos e valores em todos os módulos que este usuário acessa</p>
                </div>
              </div>
              <Switch checked={perms.financeiro} onCheckedChange={(v) => setPerm("financeiro", v)} />
            </div>
          </div>
        )}

        {/* PASSO 3 */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-border p-4">
              <Avatar className="h-14 w-14"><AvatarFallback className="text-lg">{nome.slice(0,2).toUpperCase()}</AvatarFallback></Avatar>
              <div className="flex-1">
                <p className="text-lg font-semibold">{nome}</p>
                <p className="text-sm text-muted-foreground">{cargo} · {email}</p>
                <Badge className={`mt-1 ${tipoConta === "admin" ? "bg-purple-600/15 text-purple-600 border border-purple-600/30" : "bg-muted text-muted-foreground"}`}>
                  {tipoConta === "admin" ? "Admin" : "Usuário"}
                </Badge>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Módulos liberados</p>
              <div className="flex flex-wrap gap-2">
                {tipoConta === "admin" ? (
                  <Badge className="bg-success/15 text-success border border-success/30">Acesso total ao sistema</Badge>
                ) : (
                  <>
                    {MOD_META.filter(m => m.locked || perms[m.key]).map(m => (
                      <Badge key={m.key} className="bg-success/15 text-success border border-success/30 hover:bg-success/15">
                        <Check className="mr-1 h-3 w-3" />{m.label}
                      </Badge>
                    ))}
                    {perms.financeiro && (
                      <Badge className="bg-success/15 text-success border border-success/30 hover:bg-success/15">
                        <DollarSign className="mr-1 h-3 w-3" />Valores R$
                      </Badge>
                    )}
                  </>
                )}
              </div>
            </div>

            {!editing && (
              <div className="rounded-md border border-info/30 bg-info/10 p-3 text-sm">
                <Mail className="mr-1 inline h-4 w-4" />
                O usuário receberá a senha temporária <strong className="font-mono">{senha}</strong> e será obrigado a trocá-la no primeiro acesso.
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && <Button type="button" variant="outline" onClick={back}>Voltar</Button>}
          {step < 3 && <Button type="button" onClick={next}>Continuar</Button>}
          {step === 3 && (
            <Button type="button" disabled={saving} onClick={submit} className="bg-gradient-brand text-primary-foreground">
              {saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar usuário"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

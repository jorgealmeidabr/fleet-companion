import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtBRL, fmtDate, fmtNumber, nowSP } from "@/lib/format";
import { Money } from "@/components/Money";
import type { Abastecimento, Checklist, Manutencao, Veiculo, UsuarioPerfil, Motorista } from "@/lib/types";
import { ArrowLeft, Car, Fuel, Wrench, ClipboardCheck, TrendingUp, Lock, FileText, ShieldCheck, Receipt, Search as SearchIcon, Radio } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { getRestriction, setRestriction } from "@/lib/vehicleAccess";
import { useToast } from "@/hooks/use-toast";

export default function VeiculoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null);
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([]);
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);

  // Uso restrito (admin)
  type UsuarioRow = { user_id: string; nome: string };
  const [restricted, setRestrictedState] = useState(false);
  const [allowedUserIds, setAllowedUserIds] = useState<string[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [savingRestriction, setSavingRestriction] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getRestriction(id).then(r => {
      if (cancelled) return;
      setRestrictedState(r.restricted);
      setAllowedUserIds(r.allowedUserIds);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data: perfis } = await (supabase as any)
        .from("usuarios_perfis")
        .select("user_id, motorista_id, ativo, tipo_conta")
        .eq("ativo", true)
        .eq("tipo_conta", "usuario");
      const perfisRows = (perfis ?? []) as Array<Pick<UsuarioPerfil, "user_id" | "motorista_id" | "ativo" | "tipo_conta">>;
      const motoristaIds = Array.from(new Set(perfisRows.map(p => p.motorista_id).filter(Boolean)));
      let nomes: Record<string, string> = {};
      if (motoristaIds.length) {
        const { data: ms } = await supabase.from("motoristas").select("id, nome").in("id", motoristaIds);
        nomes = Object.fromEntries(((ms ?? []) as Array<Pick<Motorista, "id" | "nome">>).map(m => [m.id, m.nome]));
      }
      const lista: UsuarioRow[] = perfisRows
        .map(p => ({ user_id: p.user_id, nome: nomes[p.motorista_id] ?? "Sem nome" }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      setUsuarios(lista);
    })();
  }, [isAdmin]);

  const toggleAllowed = (userId: string, checked: boolean) => {
    setAllowedUserIds(prev =>
      checked ? Array.from(new Set([...prev, userId])) : prev.filter(u => u !== userId)
    );
  };

  const salvarRestricao = async () => {
    if (!id) return;
    setSavingRestriction(true);
    try {
      await setRestriction(id, { restricted, allowedUserIds });
      toast({ title: "Restrição salva", description: restricted ? `${allowedUserIds.length} usuário(s) liberado(s).` : "Veículo liberado para todos." });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e?.message ?? "Falha desconhecida", variant: "destructive" });
    } finally {
      setSavingRestriction(false);
    }
  };


  useEffect(() => {
    if (!id) return;
    let first = true;
    const load = async () => {
      if (first) setLoading(true);
      const [v, m, a, c] = await Promise.all([
        supabase.from("veiculos").select("*").eq("id", id).maybeSingle(),
        supabase.from("manutencoes").select("*").eq("veiculo_id", id).order("data", { ascending: false }),
        supabase.from("abastecimentos").select("*").eq("veiculo_id", id).order("data", { ascending: true }),
        supabase.from("checklists").select("*").eq("veiculo_id", id).order("data", { ascending: false }).limit(10),
      ]);
      setVeiculo((v.data as Veiculo) ?? null);
      setManutencoes((m.data ?? []) as Manutencao[]);
      setAbastecimentos((a.data ?? []) as Abastecimento[]);
      setChecklists((c.data ?? []) as Checklist[]);
      if (first) { setLoading(false); first = false; }
    };
    load();
    const pid = setInterval(load, 10_000);
    return () => clearInterval(pid);
  }, [id]);

  const consumoData = useMemo(
    () => abastecimentos
      .filter(a => a.consumo_km_l && a.consumo_km_l > 0)
      .map(a => ({ data: fmtDate(a.data), consumo: Number(a.consumo_km_l), custo: Number(a.custo_por_km ?? 0) })),
    [abastecimentos]
  );

  const totais = useMemo(() => ({
    custoManut: manutencoes.reduce((s, m) => s + Number(m.custo_total ?? 0), 0),
    custoAbast: abastecimentos.reduce((s, a) => s + Number(a.valor_total ?? 0), 0),
    litros: abastecimentos.reduce((s, a) => s + Number(a.litros ?? 0), 0),
  }), [manutencoes, abastecimentos]);

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!veiculo) return (
    <div className="text-center">
      <p className="text-muted-foreground">Veículo não encontrado.</p>
      <Button variant="outline" className="mt-4" onClick={() => navigate("/veiculos")}>Voltar</Button>
    </div>
  );

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => navigate("/veiculos")} className="mb-4">
        <ArrowLeft className="mr-1 h-4 w-4" />Voltar
      </Button>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1 overflow-hidden">
          <div className="aspect-video w-full bg-muted">
            {veiculo.foto_url ? (
              <img src={veiculo.foto_url} alt={veiculo.modelo} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center"><Car className="h-16 w-16 text-muted-foreground/40" /></div>
            )}
          </div>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-xl font-bold tracking-wider">{veiculo.placa}</span>
              <StatusBadge status={veiculo.status} />
            </div>
            <h2 className="text-lg font-semibold">{veiculo.marca} {veiculo.modelo}</h2>
            <dl className="grid grid-cols-2 gap-2 pt-2 text-sm">
              <div><dt className="text-muted-foreground">Ano</dt><dd className="font-medium">{veiculo.ano}</dd></div>
              <div><dt className="text-muted-foreground">Tipo</dt><dd className="font-medium capitalize">{veiculo.tipo}</dd></div>
              <div><dt className="text-muted-foreground">Combustível</dt><dd className="font-medium capitalize">{veiculo.combustivel}</dd></div>
              <div><dt className="text-muted-foreground">Km atual</dt><dd className="font-medium">{fmtNumber(veiculo.km_atual)}</dd></div>
              {veiculo.km_inicial != null && (
                <div><dt className="text-muted-foreground">Km inicial</dt><dd className="font-medium">{fmtNumber(veiculo.km_inicial)}</dd></div>
              )}
              <div className="col-span-2">
                <dt className="text-muted-foreground">Consumo médio</dt>
                <dd className="font-medium">
                  {veiculo.consumo_medio_kml != null
                    ? `${fmtNumber(veiculo.consumo_medio_kml, { maximumFractionDigits: 2 })} km/L`
                    : "—"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-2 lg:grid-cols-1 xl:grid-cols-3">
          <KpiMini icon={<Wrench />} label="Custo manutenções" value={<Money value={totais.custoManut} />} />
          <KpiMini icon={<Fuel />} label="Custo abastecimentos" value={<Money value={totais.custoAbast} />} />
          <KpiMini icon={<TrendingUp />} label="Litros abastecidos" value={`${fmtNumber(totais.litros, { maximumFractionDigits: 1 })} L`} />
          <Card className="sm:col-span-3 lg:col-span-1 xl:col-span-3">
            <CardHeader className="pb-2"><CardTitle className="text-base">Consumo (km/L) ao longo do tempo</CardTitle></CardHeader>
            <CardContent className="h-64">
              {consumoData.length === 0 ? (
                <p className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados de consumo ainda.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={consumoData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="data" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Line type="monotone" dataKey="consumo" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <DocumentacaoSection veiculo={veiculo} />

      {isAdmin && (
        <Card className="mb-6 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4" />
              Uso restrito
              {restricted && <Badge variant="secondary" className="ml-1">Ativo</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="restricted-toggle" className="text-sm font-medium">
                  Restringir uso deste veículo
                </Label>
                <p className="text-xs text-muted-foreground">
                  Quando ativado, apenas usuários selecionados poderão reservar este veículo. Admins sempre veem todos os veículos.
                </p>
              </div>
              <Switch
                id="restricted-toggle"
                checked={restricted}
                onCheckedChange={setRestrictedState}
              />
            </div>

            {restricted && (
              <div className="space-y-2">
                <Label className="text-sm">Usuários autorizados ({allowedUserIds.length})</Label>
                {usuarios.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado.</p>
                ) : (
                  <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                    {usuarios.map(u => {
                      const checked = allowedUserIds.includes(u.user_id);
                      return (
                        <label
                          key={u.user_id}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => toggleAllowed(u.user_id, !!v)}
                          />
                          <span>{u.nome}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="brand" onClick={salvarRestricao} disabled={savingRestriction}>
                Salvar
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Configuração armazenada localmente neste navegador.
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="manutencoes">
        <TabsList>
          <TabsTrigger value="manutencoes"><Wrench className="mr-1 h-4 w-4" />Manutenções ({manutencoes.length})</TabsTrigger>
          <TabsTrigger value="abastecimentos"><Fuel className="mr-1 h-4 w-4" />Abastecimentos ({abastecimentos.length})</TabsTrigger>
          <TabsTrigger value="checklists"><ClipboardCheck className="mr-1 h-4 w-4" />Checklists ({checklists.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="manutencoes">
          <ListaSimples
            empty="Nenhuma manutenção registrada."
            items={manutencoes.map(m => ({
              id: m.id,
              left: <span className="capitalize">{m.tipo}</span>,
              middle: m.descricao ?? m.oficina ?? "—",
              right: <><Money value={Number(m.custo_total)} /> · <StatusBadge status={m.status} /></>,
              date: fmtDate(m.data),
            }))}
          />
        </TabsContent>

        <TabsContent value="abastecimentos">
          <ListaSimples
            empty="Nenhum abastecimento registrado."
            items={[...abastecimentos].reverse().map(a => ({
              id: a.id,
              left: `${fmtNumber(a.litros, { maximumFractionDigits: 1 })} L`,
              middle: a.posto ?? "—",
              right: <><Money value={Number(a.valor_total)} /> {a.consumo_km_l && <span className="ml-2 text-xs text-muted-foreground">{Number(a.consumo_km_l).toFixed(1)} km/L</span>}</>,
              date: fmtDate(a.data),
            }))}
          />
        </TabsContent>

        <TabsContent value="checklists">
          <ListaSimples
            empty="Nenhum checklist registrado."
            items={checklists.map(c => ({
              id: c.id,
              left: <StatusBadge status={c.status} />,
              middle: c.observacoes ?? "—",
              right: [
                c.pneus_ok ? "Pneus✓" : "Pneus✗",
                c.luzes_ok ? "Luzes✓" : "Luzes✗",
                c.combustivel_ok ? "Comb✓" : "Comb✗",
                c.nivel_oleo_ok ? "Óleo✓" : "Óleo✗",
              ].join(" · "),
              date: fmtDate(c.data),
            }))}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}

function KpiMini({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ListaSimples({
  items, empty,
}: {
  items: { id: string; left: React.ReactNode; middle: React.ReactNode; right: React.ReactNode; date: string }[];
  empty: string;
}) {
  if (items.length === 0) return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{empty}</CardContent></Card>;
  return (
    <Card>
      <CardContent className="divide-y divide-border p-0">
        {items.map(it => (
          <div key={it.id} className="grid grid-cols-12 items-center gap-3 px-4 py-3 text-sm">
            <div className="col-span-2 text-muted-foreground">{it.date}</div>
            <div className="col-span-2 font-medium">{it.left}</div>
            <div className="col-span-5 truncate text-muted-foreground">{it.middle}</div>
            <div className="col-span-3 text-right">{it.right}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ====== Documentação Veicular ======
type DocStatus = { label: string; classe: string };
function statusPorData(dataISO?: string | null, pendente = false): DocStatus {
  if (pendente) return { label: "Pendente", classe: "bg-red-500/15 text-red-400 border-red-500/30" };
  if (!dataISO) return { label: "Não informado", classe: "bg-muted text-muted-foreground border-border" };
  const dias = Math.ceil((new Date(dataISO).getTime() - nowSP().getTime()) / 86_400_000);
  if (dias < 0) return { label: `Vencido há ${Math.abs(dias)}d`, classe: "bg-red-500/15 text-red-400 border-red-500/30" };
  if (dias <= 60) return { label: `Vence em ${dias}d`, classe: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
  return { label: `Vence em ${dias}d`, classe: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
}

function DocCard({ icon, titulo, vencimento, status, extra }: {
  icon: React.ReactNode; titulo: string; vencimento?: string | null; status: DocStatus; extra?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="text-amber-400">{icon}</span>
            {titulo}
          </div>
          <Badge variant="outline" className={status.classe}>{status.label}</Badge>
        </div>
        {vencimento !== undefined && (
          <p className="text-xs text-muted-foreground">Vencimento: <span className="font-medium text-foreground">{fmtDate(vencimento)}</span></p>
        )}
        {extra}
      </CardContent>
    </Card>
  );
}

function DocumentacaoSection({ veiculo }: { veiculo: Veiculo }) {
  const ipvaPendente = veiculo.ipva_status === "pendente";
  return (
    <Card className="mb-6 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-amber-400" />
          Documentação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <DocCard
            icon={<FileText className="h-4 w-4" />}
            titulo="CRLV"
            vencimento={veiculo.crlv_vencimento}
            status={statusPorData(veiculo.crlv_vencimento)}
          />
          <DocCard
            icon={<Receipt className="h-4 w-4" />}
            titulo="IPVA"
            vencimento={veiculo.ipva_vencimento}
            status={statusPorData(veiculo.ipva_vencimento, ipvaPendente)}
            extra={
              <p className="text-xs text-muted-foreground">
                {veiculo.ipva_valor != null ? <>Valor: <span className="font-medium text-foreground">{fmtBRL(Number(veiculo.ipva_valor))}</span> · </> : null}
                Status: <span className={`font-medium ${ipvaPendente ? "text-red-400" : "text-emerald-400"}`}>{veiculo.ipva_status ?? "—"}</span>
              </p>
            }
          />
          <DocCard
            icon={<ShieldCheck className="h-4 w-4" />}
            titulo="Seguro"
            vencimento={veiculo.seguro_fim}
            status={statusPorData(veiculo.seguro_fim)}
            extra={
              <div className="space-y-0.5 text-xs text-muted-foreground">
                {veiculo.seguro_seguradora && <p>Seguradora: <span className="font-medium text-foreground">{veiculo.seguro_seguradora}</span></p>}
                {veiculo.seguro_apolice && <p>Apólice: <span className="font-mono text-foreground">{veiculo.seguro_apolice}</span></p>}
                {veiculo.seguro_cobertura && <p className="line-clamp-2">Cobertura: {veiculo.seguro_cobertura}</p>}
              </div>
            }
          />
          <DocCard
            icon={<SearchIcon className="h-4 w-4" />}
            titulo="Inspeção veicular"
            vencimento={veiculo.inspecao_proxima}
            status={statusPorData(veiculo.inspecao_proxima)}
            extra={veiculo.inspecao_data ? <p className="text-xs text-muted-foreground">Última: <span className="font-medium text-foreground">{fmtDate(veiculo.inspecao_data)}</span></p> : null}
          />
          <Card>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Radio className="h-4 w-4 text-amber-400" />
                  Rastreador
                </div>
                <Badge variant="outline" className={veiculo.rastreador_instalado
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-muted text-muted-foreground border-border"}>
                  {veiculo.rastreador_instalado ? "Instalado" : "Não instalado"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {(veiculo.renavam || veiculo.chassi || veiculo.numero_motor) && (
          <Card>
            <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Renavam</p><p className="font-mono font-medium">{veiculo.renavam ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Chassi</p><p className="font-mono font-medium">{veiculo.chassi ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Nº do motor</p><p className="font-mono font-medium">{veiculo.numero_motor ?? "—"}</p></div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}

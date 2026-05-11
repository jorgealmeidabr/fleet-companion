import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { fmtDateTime } from "@/lib/format";
import type { Acidente, AcidenteStatus, Veiculo } from "@/lib/types";
import { ArrowLeft, Printer } from "lucide-react";
import brqLogo from "@/assets/brq-logo-app.jpg";

const TIPO_LABEL: Record<string, string> = {
  colisao: "Colisão", atropelamento: "Atropelamento",
  capotamento: "Capotamento", outro: "Outro",
};
const CULPA_LABEL: Record<string, string> = {
  funcionario: "Funcionário", terceiro: "Terceiro",
  falha_mecanica: "Falha mecânica", desconhecido: "Desconhecido",
};

export default function AcidenteDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [acidente, setAcidente] = useState<Acidente | null>(null);
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("acidentes").select("*").eq("id", id).maybeSingle();
    setAcidente(data as Acidente | null);
    if (data?.veiculo_id) {
      const { data: v } = await supabase.from("veiculos").select("*").eq("id", data.veiculo_id).maybeSingle();
      setVeiculo(v as Veiculo | null);
    }
    setLoading(false);
  };
  useEffect(() => {
    load();
    const pid = setInterval(load, 10_000);
    return () => clearInterval(pid);
  }, [id]);

  async function alterarStatus(s: AcidenteStatus) {
    const { error } = await (supabase as any).from("acidentes").update({ status: s }).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Status atualizado" });
    setAcidente(a => a ? { ...a, status: s } : a);
  }

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>;
  if (!acidente) return <div className="p-8 text-center">Ocorrência não encontrada.</div>;

  return (
    <div className="space-y-4">
      <div className="no-print">
        <Button variant="ghost" size="sm" onClick={() => navigate("/acidentes")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
        </Button>
      </div>

      <div className="no-print">
        <PageHeader
          title={`Ocorrência ${acidente.protocolo}`}
          subtitle={`Registrada em ${fmtDateTime(acidente.created_at)}`}
          actions={
            <div className="flex items-center gap-2">
              <StatusBadge status={acidente.status} />
              <Select value={acidente.status} onValueChange={(v) => alterarStatus(v as AcidenteStatus)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_analise">Em análise</SelectItem>
                  <SelectItem value="encerrado">Encerrado</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" /> Imprimir documento formal
              </Button>
            </div>
          }
        />
      </div>

      {/* Vista web (oculta em print) */}
      <div className="no-print grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Motorista</CardTitle></CardHeader>
          <CardContent className="text-sm">{acidente.motorista_nome}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Veículo</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {veiculo ? `${veiculo.placa} — ${veiculo.marca} ${veiculo.modelo} (${veiculo.ano})` : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Data e local</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <div>{fmtDateTime(acidente.data_hora)}</div>
            <div className="text-muted-foreground">{acidente.local}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Tipo / Culpa / B.O.</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <div>Tipo: <strong>{TIPO_LABEL[acidente.tipo]}</strong></div>
            <div>Culpa: <strong>{CULPA_LABEL[acidente.culpa]}</strong></div>
            <div>Nº B.O.: <strong>{acidente.numero_bo || "—"}</strong></div>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">Descrição</CardTitle></CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm">{acidente.descricao}</CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">Fotos ({acidente.fotos_urls.length})</CardTitle></CardHeader>
          <CardContent>
            {acidente.fotos_urls.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem fotos.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {acidente.fotos_urls.map((u, i) => (
                  <a key={i} href={u} target="_blank" rel="noreferrer">
                    <img src={u} alt={`Foto ${i + 1}`} className="aspect-square w-full rounded border object-cover" />
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Documento formal para impressão */}
      <div className="hidden print:block">
        <div className="print-area mx-auto max-w-3xl bg-white p-8 text-black">
          <div className="mb-6 flex items-center gap-4 border-b pb-4">
            <img src={brqLogo} alt="BRQ" className="h-16 w-16 object-contain" />
            <div>
              <div className="text-xs uppercase tracking-wide">BRQ — Frota Interna</div>
              <h1 className="text-2xl font-bold">Relatório de Ocorrência de Acidente</h1>
              <div className="text-xs">Protocolo: <strong>{acidente.protocolo}</strong> • Gerado em {new Date().toLocaleString("pt-BR")}</div>
            </div>
          </div>

          <Section title="Identificação">
            <Field label="Motorista" value={acidente.motorista_nome} />
            <Field label="Veículo" value={veiculo ? `${veiculo.placa} — ${veiculo.marca} ${veiculo.modelo} (${veiculo.ano})` : "—"} />
            <Field label="Data e hora" value={fmtDateTime(acidente.data_hora)} />
            <Field label="Local" value={acidente.local} />
          </Section>

          <Section title="Classificação">
            <Field label="Tipo" value={TIPO_LABEL[acidente.tipo]} />
            <Field label="Culpa" value={CULPA_LABEL[acidente.culpa]} />
            <Field label="Nº Boletim de Ocorrência" value={acidente.numero_bo || "Não informado"} />
            <Field label="Status" value={acidente.status} />
          </Section>

          <Section title="Descrição da ocorrência">
            <p className="whitespace-pre-wrap text-sm">{acidente.descricao}</p>
          </Section>

          {acidente.fotos_urls.length > 0 && (
            <Section title={`Registro fotográfico (${acidente.fotos_urls.length})`}>
              <div className="grid grid-cols-2 gap-2">
                {acidente.fotos_urls.map((u, i) => (
                  <img key={i} src={u} alt={`Foto ${i + 1}`} className="aspect-square w-full border object-cover" />
                ))}
              </div>
            </Section>
          )}

          <div className="mt-12 grid grid-cols-2 gap-12">
            <div className="text-center">
              <div className="mb-1 border-t pt-2 text-xs">Assinatura do Motorista</div>
              <div className="text-xs text-muted-foreground">{acidente.motorista_nome}</div>
            </div>
            <div className="text-center">
              <div className="mb-1 border-t pt-2 text-xs">Assinatura do Responsável da Empresa</div>
              <div className="text-xs text-muted-foreground">BRQ — Gestão de Frota</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="mb-2 border-b pb-1 text-sm font-bold uppercase tracking-wide">{title}</h2>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
}
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

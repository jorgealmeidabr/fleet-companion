import { useEffect, useState } from "react";
import { nowSP } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { uploadFiles } from "@/lib/storage";
import type { Veiculo, AcidenteContato, AcidenteTipo, AcidenteCulpa, Motorista } from "@/lib/types";
import {
  Ambulance, Flame, Shield, Phone, MessageCircle, AlertTriangle,
  CheckCircle2, Upload, Loader2, ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PASSOS = [
  "Verificar feridos e acionar socorro",
  "Sinalizar o local com triângulo",
  "Chamar a polícia e fazer o Boletim de Ocorrência",
  "Fotografar os danos e o local",
  "Comunicar a empresa imediatamente",
];

function gerarProtocolo() {
  const d = nowSP();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `AC-${stamp}-${rand}`;
}

export default function AcidentesUsuario() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [contatos, setContatos] = useState<AcidenteContato[]>([]);
  const [motoristaNome, setMotoristaNome] = useState("");
  const [passos, setPassos] = useState<boolean[]>(Array(PASSOS.length).fill(false));

  // form
  const [veiculoId, setVeiculoId] = useState("");
  const [dataHora, setDataHora] = useState(() => {
    const d = nowSP();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [local, setLocal] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<AcidenteTipo>("colisao");
  const [culpa, setCulpa] = useState<AcidenteCulpa>("desconhecido");
  const [numeroBo, setNumeroBo] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [protocoloOk, setProtocoloOk] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [v, c] = await Promise.all([
        supabase.from("veiculos").select("*").order("placa"),
        (supabase as any).from("acidentes_contatos").select("*").order("ordem"),
      ]);
      setVeiculos((v.data ?? []) as Veiculo[]);
      setContatos((c?.data ?? []) as AcidenteContato[]);

      if (user) {
        const { data: mot } = await supabase
          .from("motoristas").select("*").eq("user_id", user.id).limit(1);
        const m = (mot?.[0] as Motorista | undefined);
        setMotoristaNome(m?.nome ?? user.email ?? "");
      }
    })();
  }, [user]);

  const togglePasso = (i: number) =>
    setPassos(p => p.map((x, idx) => (idx === i ? !x : x)));

  async function enviar() {
    if (!user) return;
    if (!veiculoId || !local.trim() || !descricao.trim()) {
      toast({ title: "Preencha veículo, local e descrição", variant: "destructive" });
      return;
    }
    setEnviando(true);
    try {
      let urls: string[] = [];
      if (files.length > 0) urls = await uploadFiles("acidentes", files);

      const protocolo = gerarProtocolo();
      const { error } = await (supabase as any).from("acidentes").insert({
        protocolo,
        user_id: user.id,
        motorista_nome: motoristaNome || user.email,
        veiculo_id: veiculoId,
        data_hora: new Date(dataHora).toISOString(),
        local,
        descricao,
        tipo,
        culpa,
        numero_bo: numeroBo || null,
        fotos_urls: urls,
        status: "pendente",
      });
      if (error) throw error;
      setProtocoloOk(protocolo);
      toast({ title: "Ocorrência registrada", description: `Protocolo ${protocolo}` });
      // reset
      setVeiculoId(""); setLocal(""); setDescricao(""); setNumeroBo("");
      setTipo("colisao"); setCulpa("desconhecido"); setFiles([]);
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Acidentes"
        subtitle="Em caso de acidente, siga o passo a passo e registre a ocorrência."
      />

      {/* Banner de emergência */}
      <Card className="border-destructive bg-destructive/10">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2 font-semibold text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Em caso de acidente, mantenha a calma e siga os passos abaixo
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button asChild variant="destructive" className="justify-start">
              <a href="tel:192"><Ambulance className="mr-2 h-4 w-4" /> SAMU (192)</a>
            </Button>
            <Button asChild variant="destructive" className="justify-start">
              <a href="tel:193"><Flame className="mr-2 h-4 w-4" /> Bombeiros (193)</a>
            </Button>
            <Button asChild variant="destructive" className="justify-start">
              <a href="tel:190"><Shield className="mr-2 h-4 w-4" /> Polícia (190)</a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Checklist de passos */}
      <Card>
        <CardHeader><CardTitle>Passo a passo</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {PASSOS.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => togglePasso(i)}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                passos[i] ? "border-success bg-success/10" : "hover:bg-muted/50",
              )}
            >
              <div className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold",
                passos[i] ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground",
              )}>
                {passos[i] ? <CheckCircle2 className="h-5 w-5" /> : i + 1}
              </div>
              <div className={cn("text-sm", passos[i] && "line-through text-muted-foreground")}>{p}</div>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Contatos */}
      <Card>
        <CardHeader><CardTitle>Contatos da empresa</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {contatos.length === 0 && (
            <p className="text-sm text-muted-foreground md:col-span-3">
              Nenhum contato cadastrado. Peça ao administrador para configurar.
            </p>
          )}
          {contatos.map(c => (
            <div key={c.id} className="rounded-lg border p-3">
              <div className="font-semibold">{c.nome}</div>
              <div className="text-xs text-muted-foreground">{c.cargo}</div>
              <div className="mt-2 text-sm">{c.telefone}</div>
              <div className="mt-2 flex gap-2">
                <Button asChild size="sm" variant="outline" className="flex-1">
                  <a href={`tel:${c.telefone.replace(/\D/g, "")}`}>
                    <Phone className="mr-1 h-3 w-3" /> Ligar
                  </a>
                </Button>
                {c.whatsapp && (
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <a target="_blank" rel="noreferrer" href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`}>
                      <MessageCircle className="mr-1 h-3 w-3" /> WhatsApp
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Formulário */}
      <Card>
        <CardHeader><CardTitle>Registrar ocorrência</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {protocoloOk ? (
            <div className="rounded-lg border border-success bg-success/10 p-4 text-center">
              <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-success" />
              <div className="font-semibold">Ocorrência enviada</div>
              <div className="text-sm text-muted-foreground">Protocolo: <span className="font-mono">{protocoloOk}</span></div>
              <Button className="mt-3" variant="outline" onClick={() => setProtocoloOk(null)}>
                Registrar outra
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <Label>Veículo *</Label>
                  <Select value={veiculoId} onValueChange={setVeiculoId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {veiculos.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.placa} — {v.marca} {v.modelo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Motorista</Label>
                  <Input value={motoristaNome} readOnly />
                </div>
                <div>
                  <Label>Data e hora *</Label>
                  <Input type="datetime-local" value={dataHora} onChange={e => setDataHora(e.target.value)} />
                </div>
                <div>
                  <Label>Local do acidente *</Label>
                  <Input value={local} onChange={e => setLocal(e.target.value)} placeholder="Endereço, ponto de referência..." />
                </div>
                <div>
                  <Label>Tipo *</Label>
                  <Select value={tipo} onValueChange={v => setTipo(v as AcidenteTipo)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="colisao">Colisão</SelectItem>
                      <SelectItem value="atropelamento">Atropelamento</SelectItem>
                      <SelectItem value="capotamento">Capotamento</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Culpa *</Label>
                  <Select value={culpa} onValueChange={v => setCulpa(v as AcidenteCulpa)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="funcionario">Funcionário</SelectItem>
                      <SelectItem value="terceiro">Terceiro</SelectItem>
                      <SelectItem value="falha_mecanica">Falha mecânica</SelectItem>
                      <SelectItem value="desconhecido">Desconhecido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label>Descrição *</Label>
                  <Textarea rows={4} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descreva como ocorreu o acidente..." />
                </div>
                <div>
                  <Label>Número do B.O. (opcional)</Label>
                  <Input value={numeroBo} onChange={e => setNumeroBo(e.target.value)} />
                </div>
                <div>
                  <Label>Fotos do local e dos danos</Label>
                  <Input type="file" multiple accept="image/*" onChange={e => setFiles(Array.from(e.target.files ?? []))} />
                  {files.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">{files.length} arquivo(s) selecionado(s)</p>
                  )}
                </div>
              </div>
              <Button onClick={enviar} disabled={enviando} className="w-full md:w-auto">
                {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Enviar ocorrência
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Acordeão Responsabilidade Legal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScrollText className="h-5 w-5" /> Responsabilidade Legal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible>
            <AccordionItem value="empresa">
              <AccordionTrigger>Empresa paga (acidente em serviço — CC art. 932)</AccordionTrigger>
              <AccordionContent>
                Quando o acidente ocorre durante o exercício regular do trabalho, sem dolo ou
                culpa grave do funcionário, a responsabilidade civil é da empresa, conforme
                art. 932, III, do Código Civil. A empresa arca com danos materiais e a
                indenização de terceiros, podendo acionar seguro próprio.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="funcionario">
              <AccordionTrigger>Funcionário paga (negligência grave ou uso indevido — CLT art. 462)</AccordionTrigger>
              <AccordionContent>
                Em caso de dolo, culpa grave (negligência, imprudência, imperícia comprovada)
                ou uso indevido do veículo (fora do horário, álcool, fins pessoais), o
                funcionário pode ser responsabilizado, com desconto em folha mediante prévio
                acordo, conforme art. 462, §1º, da CLT.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}

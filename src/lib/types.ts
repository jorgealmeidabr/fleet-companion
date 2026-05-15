// Tipos do banco BRQ – Frota Interna
export type VeiculoTipo = "carro" | "moto" | "caminhao" | "van";
export type VeiculoCombustivel = "flex" | "gasolina" | "diesel" | "eletrico";
export type VeiculoStatus = "disponivel" | "manutencao" | "inativo" | "reservado";
export type MotoristaStatus = "ativo" | "inativo";
export type ManutencaoTipo = "preventiva" | "corretiva" | "preditiva";
export type ManutencaoStatus = "agendada" | "em_andamento" | "concluida";
export type ManutencaoSubtipo = "troca_oleo" | "filtro" | "correia" | "freio" | "pneu" | "alinhamento" | "revisao_geral" | "outro";
export type ManutencaoPrioridade = "baixa" | "media" | "alta" | "urgente";
export interface ManutencaoPeca { nome: string; quantidade: number; valor_unitario: number; garantia_dias?: number | null; }
export type ChecklistStatus = "ok" | "problema";
export type AgendamentoStatus = "ativo" | "cancelado" | "agendado" | "em_uso" | "concluido";
export type MultaStatus = "pendente" | "pago" | "contestado";
export type RequestType = "maintenance" | "fuel";
export type RequestUrgency = "low" | "medium" | "high";
export type RequestStatus = "requested" | "pending" | "completed";
export type AppRole = "admin" | "motorista";
export type TipoConta = "admin" | "usuario";

export type ModuloPermissao =
  | "dashboard" | "veiculos" | "motoristas" | "manutencao" | "abastecimento"
  | "agendamentos" | "checklists" | "multas" | "alertas" | "historico"
  | "usuarios" | "financeiro" | "solicitacoes" | "acidentes";

export type Permissoes = Record<ModuloPermissao, boolean>;

export const PERMISSOES_DEFAULT: Permissoes = {
  dashboard: false, veiculos: false, motoristas: false, manutencao: false,
  abastecimento: false, agendamentos: true, checklists: true, multas: false,
  alertas: false, historico: false, usuarios: false, financeiro: false,
  solicitacoes: true, acidentes: true,
};

export const PERMISSOES_TUDO: Permissoes = {
  dashboard: true, veiculos: true, motoristas: true, manutencao: true,
  abastecimento: true, agendamentos: true, checklists: true, multas: true,
  alertas: true, historico: true, usuarios: true, financeiro: true,
  solicitacoes: true, acidentes: true,
};

export type AcidenteTipo = "colisao" | "atropelamento" | "capotamento" | "outro";
export type AcidenteCulpa = "funcionario" | "terceiro" | "falha_mecanica" | "desconhecido";
export type AcidenteStatus = "pendente" | "em_analise" | "encerrado";

export interface Acidente {
  id: string;
  protocolo: string;
  user_id: string;
  motorista_nome: string;
  veiculo_id: string | null;
  data_hora: string;
  local: string;
  descricao: string;
  tipo: AcidenteTipo;
  culpa: AcidenteCulpa;
  numero_bo: string | null;
  fotos_urls: string[];
  status: AcidenteStatus;
  created_at: string;
}

export interface AcidenteContato {
  id: string;
  nome: string;
  cargo: string;
  telefone: string;
  whatsapp: string | null;
  ordem: number;
  created_at: string;
}

export type IpvaStatus = "pago" | "pendente";
export interface Veiculo {
  id: string; placa: string; modelo: string; marca: string; ano: number;
  tipo: VeiculoTipo; combustivel: VeiculoCombustivel; km_atual: number;
  status: VeiculoStatus; foto_url: string | null;
  cnh_necessaria: "A" | "B" | "AB"; created_at: string;
  renavam?: string | null;
  chassi?: string | null;
  numero_motor?: string | null;
  crlv_vencimento?: string | null;
  ipva_valor?: number | null;
  ipva_status?: IpvaStatus | null;
  ipva_vencimento?: string | null;
  seguro_seguradora?: string | null;
  seguro_apolice?: string | null;
  seguro_inicio?: string | null;
  seguro_fim?: string | null;
  seguro_cobertura?: string | null;
  inspecao_data?: string | null;
  inspecao_proxima?: string | null;
  rastreador_instalado?: boolean | null;
  km_inicial?: number | null;
  consumo_medio_kml?: number | null;
}
export interface Motorista { id: string; nome: string; cnh_numero: string; cnh_categoria: string; cnh_validade: string; telefone: string | null; email: string | null; cargo: string | null; status: MotoristaStatus; foto_url: string | null; user_id: string | null; created_at: string; }
export interface Manutencao {
  id: string; veiculo_id: string; tipo: ManutencaoTipo; data: string;
  km_momento: number; descricao: string | null; pecas_trocadas: string | null;
  custo_total: number; oficina: string | null;
  proxima_km: number | null; proxima_data: string | null;
  status: ManutencaoStatus; created_at: string;
  subtipo?: ManutencaoSubtipo | null;
  km_atual?: number | null;
  km_proxima_manutencao?: number | null;
  data_proxima_manutencao?: string | null;
  tempo_parado_horas?: number | null;
  prioridade?: ManutencaoPrioridade | null;
  pecas?: ManutencaoPeca[] | null;
}
export interface Abastecimento { id: string; veiculo_id: string; motorista_id: string | null; data: string; km_atual: number; litros: number; valor_total: number; posto: string | null; consumo_km_l: number | null; custo_por_km: number | null; created_at: string; }
export interface Checklist { id: string; veiculo_id: string; motorista_id: string | null; data: string; pneus_ok: boolean; luzes_ok: boolean; combustivel_ok: boolean; nivel_oleo_ok: boolean; observacoes: string | null; fotos_urls: string[] | null; status: ChecklistStatus; created_at: string; }
export interface Agendamento { id: string; veiculo_id: string; motorista_id: string; data_saida: string; data_retorno_prevista: string; data_retorno_real: string | null; destino: string | null; km_saida: number | null; km_retorno: number | null; status: AgendamentoStatus; observacoes: string | null; created_at: string; litros_abastecidos?: number | null; km_l?: number | null; }
export interface Multa { id: string; veiculo_id: string; motorista_id: string | null; data_infracao: string; tipo_infracao: string; valor: number; pontos_cnh: number; status_pagamento: MultaStatus; auto_infracao: string | null; created_at: string; }
export interface UsuarioPerfil { id: string; user_id: string; motorista_id: string; tipo_conta: TipoConta; permissoes: Permissoes; ativo: boolean; must_change_password: boolean; created_at: string; last_login: string | null; }
export interface Request {
  id: string;
  protocol: string;
  user_id: string;
  vehicle_id: string;
  type: RequestType;
  km: number;
  urgency: RequestUrgency | null;
  problem_description: string | null;
  fuel_type: string | null;
  liters: number | null;
  observations: string | null;
  status: RequestStatus;
  pdf_url: string | null;
  created_at: string;
}

// Stub minimal de Database para o supabase-js
export type Database = {
  public: {
    Tables: {
      veiculos: { Row: Veiculo; Insert: Partial<Veiculo>; Update: Partial<Veiculo> };
      motoristas: { Row: Motorista; Insert: Partial<Motorista>; Update: Partial<Motorista> };
      manutencoes: { Row: Manutencao; Insert: Partial<Manutencao>; Update: Partial<Manutencao> };
      abastecimentos: { Row: Abastecimento; Insert: Partial<Abastecimento>; Update: Partial<Abastecimento> };
      checklists: { Row: Checklist; Insert: Partial<Checklist>; Update: Partial<Checklist> };
      agendamentos: { Row: Agendamento; Insert: Partial<Agendamento>; Update: Partial<Agendamento> };
      multas: { Row: Multa; Insert: Partial<Multa>; Update: Partial<Multa> };
      requests: { Row: Request; Insert: Partial<Request>; Update: Partial<Request> };
      acidentes: { Row: Acidente; Insert: Partial<Acidente>; Update: Partial<Acidente> };
      acidentes_contatos: { Row: AcidenteContato; Insert: Partial<AcidenteContato>; Update: Partial<AcidenteContato> };
      profiles: { Row: { id: string; nome: string | null; email: string | null; cargo_pretendido: string | null; status: "pendente" | "ativo" | "rejeitado"; created_at: string }; Insert: any; Update: any };
      user_roles: { Row: { id: string; user_id: string; role: AppRole }; Insert: any; Update: any };
      usuarios_perfis: { Row: UsuarioPerfil; Insert: Partial<UsuarioPerfil>; Update: Partial<UsuarioPerfil> };
    };
    Functions: {
      has_role: { Args: { _user_id: string; _role: AppRole }; Returns: boolean };
      has_perm: { Args: { _user_id: string; _modulo: string }; Returns: boolean };
      is_admin_perfil: { Args: { _user_id: string }; Returns: boolean };
      is_perfil_ativo: { Args: { _uid: string }; Returns: boolean };
      create_pending_profile: { Args: { _user_id: string; _nome: string; _email: string }; Returns: void };
      approve_user: { Args: { _user_id: string; _tipo?: TipoConta; _permissoes?: any; _cargo?: string | null }; Returns: void };
      reject_user: { Args: { _user_id: string }; Returns: void };
    };
  };
};

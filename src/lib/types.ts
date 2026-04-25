// Tipos do banco BRQ – Frota Interna
export type VeiculoTipo = "carro" | "moto" | "caminhao" | "van";
export type VeiculoCombustivel = "flex" | "gasolina" | "diesel" | "eletrico";
export type VeiculoStatus = "disponivel" | "manutencao" | "inativo" | "reservado";
export type MotoristaStatus = "ativo" | "inativo";
export type ManutencaoTipo = "preventiva" | "corretiva";
export type ManutencaoStatus = "agendada" | "em_andamento" | "concluida";
export type ChecklistStatus = "ok" | "problema";
export type AgendamentoStatus = "agendado" | "em_uso" | "concluido" | "cancelado";
export type MultaStatus = "pendente" | "pago" | "contestado";
export type AppRole = "admin" | "motorista";
export type TipoConta = "admin" | "usuario";

export type ModuloPermissao =
  | "dashboard" | "veiculos" | "motoristas" | "manutencao" | "abastecimento"
  | "agendamentos" | "checklists" | "multas" | "alertas" | "historico"
  | "usuarios" | "financeiro";

export type Permissoes = Record<ModuloPermissao, boolean>;

export const PERMISSOES_DEFAULT: Permissoes = {
  dashboard: false, veiculos: false, motoristas: false, manutencao: false,
  abastecimento: false, agendamentos: true, checklists: true, multas: false,
  alertas: false, historico: false, usuarios: false, financeiro: false,
};

export const PERMISSOES_TUDO: Permissoes = {
  dashboard: true, veiculos: true, motoristas: true, manutencao: true,
  abastecimento: true, agendamentos: true, checklists: true, multas: true,
  alertas: true, historico: true, usuarios: true, financeiro: true,
};

export interface Veiculo { id: string; placa: string; modelo: string; marca: string; ano: number; tipo: VeiculoTipo; combustivel: VeiculoCombustivel; km_atual: number; status: VeiculoStatus; foto_url: string | null; created_at: string; }
export interface Motorista { id: string; nome: string; cnh_numero: string; cnh_categoria: string; cnh_validade: string; telefone: string | null; email: string | null; cargo: string | null; status: MotoristaStatus; foto_url: string | null; user_id: string | null; created_at: string; }
export interface Manutencao { id: string; veiculo_id: string; tipo: ManutencaoTipo; data: string; km_momento: number; descricao: string | null; pecas_trocadas: string | null; custo_total: number; oficina: string | null; proxima_km: number | null; proxima_data: string | null; status: ManutencaoStatus; created_at: string; }
export interface Abastecimento { id: string; veiculo_id: string; motorista_id: string | null; data: string; km_atual: number; litros: number; valor_total: number; posto: string | null; consumo_km_l: number | null; custo_por_km: number | null; created_at: string; }
export interface Checklist { id: string; veiculo_id: string; motorista_id: string | null; data: string; pneus_ok: boolean; luzes_ok: boolean; combustivel_ok: boolean; nivel_oleo_ok: boolean; observacoes: string | null; fotos_urls: string[] | null; status: ChecklistStatus; created_at: string; }
export interface Agendamento { id: string; veiculo_id: string; motorista_id: string; data_saida: string; data_retorno_prevista: string; data_retorno_real: string | null; destino: string | null; km_saida: number | null; km_retorno: number | null; status: AgendamentoStatus; observacoes: string | null; created_at: string; }
export interface Multa { id: string; veiculo_id: string; motorista_id: string | null; data_infracao: string; tipo_infracao: string; valor: number; pontos_cnh: number; status_pagamento: MultaStatus; auto_infracao: string | null; created_at: string; }
export interface UsuarioPerfil { id: string; user_id: string; motorista_id: string; tipo_conta: TipoConta; permissoes: Permissoes; ativo: boolean; must_change_password: boolean; created_at: string; last_login: string | null; }

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
      profiles: { Row: { id: string; nome: string | null; email: string | null; created_at: string }; Insert: any; Update: any };
      user_roles: { Row: { id: string; user_id: string; role: AppRole }; Insert: any; Update: any };
      usuarios_perfis: { Row: UsuarioPerfil; Insert: Partial<UsuarioPerfil>; Update: Partial<UsuarioPerfil> };
    };
    Functions: {
      has_role: { Args: { _user_id: string; _role: AppRole }; Returns: boolean };
      has_perm: { Args: { _user_id: string; _modulo: string }; Returns: boolean };
      is_admin_perfil: { Args: { _user_id: string }; Returns: boolean };
    };
  };
};

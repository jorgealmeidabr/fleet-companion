import { useAuth } from "./useAuth";
import type { ModuloPermissao, Permissoes } from "@/lib/types";

/**
 * Hook global de permissões granulares.
 * - Admin sempre vê tudo (permissoes vem como PERMISSOES_TUDO em useAuth).
 * - Para usuários comuns, lê o jsonb permissoes definido pelo admin.
 * - Fallback legado: se não há `usuarios_perfis`, comporta como antes
 *   (admin → tudo; motorista → apenas agendamentos+checklists).
 */
export function usePermissions() {
  const { permissoes, isAdmin, role, perfil } = useAuth();

  const fallback: Permissoes = isAdmin
    ? {
        dashboard: true, veiculos: true, motoristas: true, manutencao: true,
        abastecimento: true, agendamentos: true, checklists: true, multas: true,
        alertas: true, historico: true, usuarios: true, financeiro: true,
        solicitacoes: true, acidentes: true,
      }
    : {
        dashboard: false, veiculos: false, motoristas: false, manutencao: false,
        abastecimento: false, agendamentos: true, checklists: true, multas: false,
        alertas: false, historico: false, usuarios: false, financeiro: false,
        solicitacoes: true, acidentes: true,
      };

  const p: Permissoes = permissoes ?? fallback;

  const canSee = (modulo: ModuloPermissao): boolean => isAdmin || !!p[modulo];
  const canSeeFinancial = (): boolean => isAdmin || !!p.financeiro;

  return {
    permissoes: p,
    canSee,
    canSeeFinancial,
    isAdmin,
    isManagedUser: !!perfil, // tem registro em usuarios_perfis
    role,
  };
}

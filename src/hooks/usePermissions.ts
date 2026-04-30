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

  // Mescla permissões salvas com defaults para módulos que devem
  // estar liberados a todos os usuários (ex.: acidentes, solicitações).
  const baseDefaults: Partial<Permissoes> = {
    acidentes: true,
    solicitacoes: true,
    agendamentos: true,
    checklists: true,
  };
  const p: Permissoes = permissoes
    ? { ...baseDefaults, ...permissoes } as Permissoes
    : fallback;

  const canSee = (modulo: ModuloPermissao): boolean => {
    if (isAdmin) return true;
    // Se a chave nunca foi definida nas permissões salvas, usa default
    if (permissoes && permissoes[modulo] === undefined && baseDefaults[modulo]) return true;
    return !!p[modulo];
  };
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

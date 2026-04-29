/**
 * Janela de horário efetivamente ocupada por um agendamento.
 *
 * Regras:
 *  - Se `data_retorno_real` existe → fim = data_retorno_real.
 *  - Se não existe e o agendamento está ativo → fim = data_saida + 30 minutos
 *    (estimativa mínima; nunca bloquear o dia inteiro).
 *  - Para agendamentos cancelados/concluídos sem retorno real, ainda devolvemos
 *    a janela mínima de 30 min — chamadores devem filtrar por status antes.
 */
export function janelaOcupada(a: {
  data_saida: string;
  data_retorno_real: string | null;
  status: string;
}): { inicio: Date; fim: Date } {
  const inicio = new Date(a.data_saida);
  const fim = a.data_retorno_real
    ? new Date(a.data_retorno_real)
    : new Date(inicio.getTime() + 30 * 60_000);
  return { inicio, fim };
}

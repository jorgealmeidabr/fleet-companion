# Correção do cálculo de bloqueio (apenas front-end)

## Helper novo

**`src/lib/agendamento.ts`** — função única `janelaOcupada`:

```ts
export function janelaOcupada(a: {
  data_saida: string;
  data_retorno_real: string | null;
  status: string;
}): { inicio: Date; fim: Date } {
  const inicio = new Date(a.data_saida);
  const fim = a.data_retorno_real
    ? new Date(a.data_retorno_real)
    : new Date(inicio.getTime() + 30 * 60_000); // 30 min mínimos quando ativo sem retorno
  return { inicio, fim };
}
```

## Substituições

### `src/pages/Agendamentos.tsx`
- **`eventosNoDia`** (~linha 187): trocar `inRange(selectedDay, a.data_saida, a.data_retorno_prevista)` por uso de `janelaOcupada(a).fim`.
- **`diasComEvento`** (~linha 192): iterar de `data_saida` até `janelaOcupada(a).fim`.
- **`conflito`** (~linha 208): comparar `inicio < janelaOcupada(a).fim && fim > janelaOcupada(a).inicio` (em vez de `data_retorno_prevista`/`data_saida` crus).

### `src/components/HourTimeline.tsx`
- **bloco `blocks`** (~linha 22): substituir `new Date(a.data_retorno_prevista)` por `janelaOcupada(a).fim`.
- **`suggestFreeSlots`** (~linha 103): mesma troca dentro do `.map`.
- O parâmetro continua sendo `Agendamento[]` (já contém `data_retorno_real` e `status`), sem mudar a assinatura pública.

### `src/pages/Veiculos.tsx`
- Na derivação de status "Em uso": usar `janelaOcupada` para decidir se o agendamento ativo cobre o instante atual (em vez de assumir o dia inteiro / `data_retorno_prevista`).

## Não muda

- `data_retorno_prevista` continua no schema, no formulário e nas exibições — apenas deixa de ser referência para conflito.
- Nenhuma migration, RPC, trigger ou function do Supabase é tocada. A trigger server-side `agendamentos_block_overlap` permanece como está (segunda camada de validação independente).
- Demais telas (Histórico, Checklist Pendente) não são afetadas.

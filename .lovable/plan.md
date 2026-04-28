## Objetivo

Nas barras de "Disponibilidade por horário" de cada veículo, exibir **todas as reservas existentes** — não apenas as de status `ativo`. Hoje reservas com status legado (`agendado`, `em_uso`) ou qualquer outro estado que não seja `cancelado`/`concluido` não aparecem na timeline, dando impressão de que o veículo está livre quando na verdade já está reservado.

## Comportamento atual

- `src/pages/Agendamentos.tsx` cria `ativos = rows.filter(r => r.status === "ativo")`.
- A timeline (`HourTimeline`) recebe apenas `ativos` e, internamente, **ainda filtra novamente** por `status === "ativo"` (`src/components/HourTimeline.tsx`, função `blocks` e `suggestFreeSlots`).
- Resultado: reservas com status `agendado`, `em_uso` (legado, não migradas) ou qualquer outro valor não aparecem como blocos vermelhos.

## Comportamento desejado

A timeline deve exibir **toda reserva que ocupa horário**, ou seja, qualquer agendamento cujo status **não seja** `cancelado` nem `concluido`. Isso cobre:

- `ativo` (novo padrão)
- `agendado` e `em_uso` (legado, caso ainda existam no banco)
- Qualquer outro estado futuro que represente reserva vigente

Reservas `cancelado` e `concluido` continuam ocultas (não bloqueiam horário).

## Mudanças

### 1. `src/pages/Agendamentos.tsx`

- Renomear/ajustar o `useMemo` `ativos` para incluir todas as reservas que ocupam horário:
  ```ts
  const ativos = useMemo(
    () => rows.filter(r => r.status !== "cancelado" && r.status !== "concluido"),
    [rows]
  );
  ```
- Manter o nome `ativos` para minimizar mudanças nos demais usos (conflito, sugestões, lista de eventos, badge da aba "Ativos", etc.). Ele agora representa "reservas que ocupam horário".

### 2. `src/components/HourTimeline.tsx`

- Remover o segundo filtro `.filter(a => a.status === "ativo")` dentro de `blocks` (a página já passa a lista correta).
- Remover o mesmo filtro dentro de `suggestFreeSlots` para que sugestões de horário também respeitem todas as reservas vigentes.

## Efeitos colaterais (intencionais)

- A aba "Ativos" passará a listar também reservas legadas em uso/agendadas. Isso é coerente com o pedido (todas as reservas vigentes ficam visíveis).
- A detecção de **conflito** ao criar um novo agendamento passará a considerar essas reservas legadas, evitando double-booking — comportamento correto.

## Fora do escopo

- Não alterar lógica de criação, devolução, checklist, ou migrações SQL.
- Não mexer no visual da barra (cores, fundo, legenda).
- Não mexer no calendário mensal nem em outras páginas.

## Arquivos afetados

- `src/pages/Agendamentos.tsx` (filtro de `ativos`)
- `src/components/HourTimeline.tsx` (remover filtros redundantes em `blocks` e `suggestFreeSlots`)

## Plano: Status em tempo real nos cards de Veículos

### Objetivo
Na página `/veiculos`:
1. Trocar o subtítulo para **"Estado da frota em tempo real"**.
2. Em cada card, exibir informação contextual conforme o status efetivo:
   - **Disponível** → sem alteração.
   - **Reservado** (agendamento futuro, ainda não iniciado) → mostrar nome do motorista e horário de início no formato `HH:mm`.
   - **Em uso** (agendamento ativo cujo `data_saida` já passou e `data_retorno_real` ainda é nulo) → badge azul "Em uso" + nome do motorista + tempo decorrido (ex: `Em uso há 1h30m`).

### Arquivo principal
`src/pages/Veiculos.tsx`.

### Mudanças

1. **Subtítulo** (linha 92): `subtitle="Estado da frota em tempo real"`.

2. **Carregar agendamentos completos** (substituir o `useEffect` atual, linhas 52–69):
   - Em vez de só `Set<veiculo_id>`, manter um `Map<veiculo_id, { motoristaNome, dataSaida, status }>`.
   - Query: `from("agendamentos").select("veiculo_id,data_saida,motorista_id,status").eq("status","ativo")` + join via segunda query em `motoristas` para pegar `nome` (ou `select("veiculo_id,data_saida,motoristas(nome)")` se houver FK; usar fallback com segunda chamada se necessário).
   - Manter o canal realtime já existente.

3. **Status efetivo** (linhas 71–75): 
   - Para cada veículo com agendamento ativo, comparar `data_saida` com `now`:
     - `data_saida <= now` → status efetivo `"em_uso"`.
     - `data_saida > now` → status efetivo `"reservado"`.
   - Manter `manutencao` / `inativo` intactos.
   - Acrescentar um `useState` que guarda um `tick` atualizado a cada 60s para que "há 1h30m" e a transição reservado→em_uso recalculem automaticamente (`useEffect` com `setInterval(..., 60_000)`).

4. **StatusBadge "Em uso" azul** (`src/components/StatusBadge.tsx`): trocar a classe de `em_uso` de warning (amarelo) para info (azul):
   - `em_uso: { label: "Em uso", className: "bg-info/15 text-info border-info/20" }`

5. **Renderização nos cards** (dentro de `<CardContent>`, após a linha "tipo · combustível"):
   - Se status efetivo = `"reservado"` e há info de agendamento:
     `Reservado para {nome} • {HH:mm}` (formatado de `data_saida`).
   - Se status efetivo = `"em_uso"`:
     `Em uso por {nome} • há {Xh Ym}`.
   - Texto compacto, `text-xs text-muted-foreground` (nome em `text-foreground font-medium`).

6. **Helpers locais** (no topo do arquivo ou em `src/lib/format.ts`):
   - `formatHHmm(iso: string)` → usa `Date` + `toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})`.
   - `formatDuracao(desdeISO: string, now: number)` → calcula diferença e retorna `"1h30m"`, `"45m"`, `"2h"` etc.

### Observações
- Os dados já estão em `agendamentos` + `motoristas`; nenhuma migration é necessária.
- O realtime já existente no canal `agendamentos` recarrega o mapa quando algo muda (criação, devolução).
- Filtro lateral por status continua funcionando porque usa `v.status` derivado.
- Tipo `AgendamentoStatus` já inclui `"em_uso"`, então `StatusBadge` aceita sem mudanças adicionais.
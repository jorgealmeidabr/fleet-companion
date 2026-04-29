
## Adicionar ticker e feed de eventos em tempo real na página de Veículos

Dois novos elementos visuais serão adicionados a `src/pages/Veiculos.tsx`, sem alterar os cards existentes nem a lógica atual de status/voz.

### 1. Ticker de eventos (marquee)

**Local:** entre o bloco de filtros e a grade de cards (logo após o `<div>` de filtros, antes do bloco `loading ? ... : filtered.length === 0 ? ...`).

**Visual:** faixa horizontal full-width, altura ~36px, fundo `bg-muted/40`, borda arredondada, overflow hidden. Conteúdo rola continuamente da direita para a esquerda em loop infinito.

**Conteúdo:** últimos 10 agendamentos (status `ativo`, `em_uso` ou recém-`concluido`), ordenados por `data_saida` desc. Cada item:
```
{PLACA} · {Reservado|Em uso|Disponível} por {NOME_MOTORISTA} · {HH:mm}
```
Separados por um divisor `·` discreto. Ícone colorido pequeno por status (verde/amarelo/azul) à esquerda de cada item.

**Animação:** keyframe CSS `marquee` que translada `-50%` em X. Para loop perfeito, o conteúdo é renderizado **duas vezes** dentro do track. Duração proporcional à quantidade de itens (~30s base). `animation-play-state: paused` no hover.

**Fonte de dados:** novo `useEffect` que carrega via Supabase os 10 últimos agendamentos relevantes + nomes dos motoristas + placas dos veículos (`rows` já disponíveis). Polling a cada 15s (mesma cadência do polling existente). Realtime channel já existente em `agendamentos` também dispara reload.

### 2. Feed de eventos (canto inferior direito)

**Local:** componente fixo `position: fixed`, `bottom-4 right-4`, `z-40`, largura ~320px. Renderizado dentro do `<>` raiz do `Veiculos.tsx` (apenas nessa página, então some ao navegar).

**Comportamento:**
- Estado recolhido: botão circular 48x48 com ícone `Bell` (lucide), badge contador de eventos novos.
- Estado expandido: card com header "Eventos recentes" + botão `ChevronDown` para recolher; lista dos últimos **5** eventos, ordem cronológica decrescente.
- Cada item: bolinha colorida (`bg-success` / `bg-warning` / `bg-info`) + placa em mono + texto `por {motorista}` + horário `HH:mm` à direita; subtle hover.

**Cores por status:**
- `disponivel` → verde (`text-success` / `bg-success`)
- `reservado` → amarelo (`text-warning` / `bg-warning`)
- `em_uso` → azul (`text-info` / `bg-info`)

**Fonte de dados:** mesma query do ticker (reaproveita `eventos` em estado compartilhado), apenas os 5 primeiros. Polling 15s já cobre.

### Detalhamento técnico

**Tipo do evento (local ao componente):**
```ts
type Evento = {
  id: string;            // agendamento.id + status (chave de animação)
  veiculoId: string;
  placa: string;
  motorista: string;
  status: "reservado" | "em_uso" | "disponivel";
  hora: string;          // ISO usado para HH:mm
};
```

**Derivação do status do evento** (a partir do agendamento, igual ao `rowsEfetivos`):
- agendamento `ativo` com `data_saida > now` → `reservado` (hora = `data_saida`)
- agendamento `ativo` com `data_saida <= now` → `em_uso` (hora = `data_saida`)
- agendamento `concluido` recente → `disponivel` (hora = `data_retorno_real ?? data_saida`)

Buscar com:
```ts
supabase.from("agendamentos")
  .select("id,veiculo_id,motorista_id,data_saida,data_retorno_real,status")
  .in("status", ["ativo","concluido"])
  .order("data_saida", { ascending: false })
  .limit(20)
```
Depois mapear para `Evento[]`, juntar com `motoristas.nome` (uma única query `in`) e com `rows` para placa, e cortar em 10 (ticker) / 5 (feed).

**Animação marquee** — adicionar em `tailwind.config.ts` (extend.keyframes/animation):
```ts
marquee: { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } }
// animation: marquee: "marquee 30s linear infinite"
```
Uso: `<div className="flex w-max animate-marquee hover:[animation-play-state:paused]">{items}{items}</div>` dentro de wrapper `overflow-hidden`.

**Ícone de status** — usa `StatusBadge` existente para consistência ou um `<span className="h-2 w-2 rounded-full bg-success" />` (mais leve, melhor para o ticker).

**Polling** — um único `useEffect` novo com `setInterval(loadEventos, 15_000)` + cleanup. Independente do polling existente para não acoplar.

**Visibilidade** — feed e ticker visíveis para qualquer usuário (a restrição admin do enunciado original valia só para a voz; o pedido atual não menciona role).

### Arquivos alterados

- `src/pages/Veiculos.tsx` — novo estado `eventos`, `loadEventos`, ticker JSX, componente inline `EventFeed` (ou bloco JSX) com toggle.
- `tailwind.config.ts` — keyframe + animation `marquee`.

Sem novas dependências, sem alterações de schema, sem mudança nos cards existentes nem na lógica de voz/idle.

# Módulo de Documentação Veicular

Adicionar gestão de documentos (CRLV, IPVA, seguro, inspeção, rastreador) sem alterar telas/funcionalidades fora do escopo definido.

## 1. Banco de dados

Nova migration `supabase_setup/19_migration_v12_documentacao_veicular.sql` adicionando à tabela `veiculos`:

- `renavam text`
- `chassi text`
- `numero_motor text`
- `crlv_vencimento date`
- `ipva_valor numeric(12,2)`
- `ipva_status text` (check `in ('pago','pendente')`, default `'pendente'`)
- `ipva_vencimento date`
- `seguro_seguradora text`
- `seguro_apolice text`
- `seguro_inicio date`
- `seguro_fim date`
- `seguro_cobertura text`
- `inspecao_data date`
- `inspecao_proxima date`
- &nbsp;

Atualizar `src/lib/types.ts` → interface `Veiculo` com os novos campos (todos opcionais/nullable).

## 2. Tela Detalhe do Veículo (`src/pages/VeiculoDetalhe.tsx`)

Adicionar nova seção "Documentação" (entre o bloco de KPIs/foto e o card "Uso restrito"), apenas para visualização. Layout em grid de cards (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`), cada card mostrando:

- Nome do documento
- Data de vencimento (`fmtDate`)
- Badge colorido de status:
  - **Verde** (`bg-emerald-500/15 text-emerald-400`) — vence em > 60 dias
  - **Amarelo** (`bg-amber-500/15 text-amber-400`, acento `#F59E0B`) — vence em ≤ 60 dias
  - **Vermelho** (`bg-red-500/15 text-red-400`) — vencido ou status pendente

Cards: CRLV (`crlv_vencimento`), IPVA (`ipva_vencimento` + `ipva_status` + valor), Seguro (`seguro_fim`, mostra seguradora/apólice), Inspeção (`inspecao_proxima`), Rastreador (badge sim/não, sem vencimento). Campos identificadores (renavam, chassi, número motor) em sub-card "Identificação" sem badge.

Helper inline `statusDoc(date, extra?)` que retorna `{ label, classe }`.

## 3. Widget no Dashboard (`src/pages/Dashboard.tsx`)

Adicionar card "Documentos vencendo (60 dias)" no grid principal de gráficos (após o card "Top 3 veículos", `lg:col-span-3`). Lista ordenada por menor `diasRestantes`:

- Linha: `{placa} – {marca} {modelo}` · tipo do documento · badge "X dias" (vermelho se ≤ 0/pendente, amarelo se ≤ 30, verde caso contrário).
- Estado vazio: "Nenhum documento vencendo nos próximos 60 dias."

Cálculo derivado de `veiculos` já carregados — sem nova query. Considera CRLV, IPVA (vencimento + pendente), Seguro (`seguro_fim`), Inspeção (`inspecao_proxima`).

## 4. Alertas automáticos (`src/hooks/useAlerts.ts`)

Dentro do `useMemo`, varrer `veiculos` e gerar `AlertItem` com `level: "critico"` (severidade alta) para cada documento vencido OU vencendo em ≤ 30 dias:

- `tipo: "Documento"`, `titulo: "{Tipo} — {placa}"`, `descricao: "Vence em N dias" | "Vencido há N dias" | "IPVA pendente"`
- `veiculoId`, `link: '/veiculos/{id}'`
- IDs estáveis: `doc-crlv-{vid}`, `doc-ipva-{vid}`, `doc-seguro-{vid}`, `doc-inspecao-{vid}` (compatíveis com dismiss).

Sem alterar queries, layout do painel de alertas, ou demais regras existentes.

## Detalhes técnicos

- Datas formatadas com `fmtDate` (já em `America/Sao_Paulo`).
- `nowSP()` para cálculo de dias restantes.
- Reaproveitar `Badge` shadcn com `className` para as cores; manter tema dark e acento `#F59E0B` (amarelo já mapeado em tons amber/warning do projeto).
- Nenhuma alteração em RLS, rotas, permissões, formulário de cadastro de veículo, página `Veiculos.tsx` ou outras telas.

## Arquivos

- novo: `supabase_setup/19_migration_v12_documentacao_veicular.sql`
- editado: `src/lib/types.ts`
- editado: `src/pages/VeiculoDetalhe.tsx`
- editado: `src/pages/Dashboard.tsx`
- editado: `src/hooks/useAlerts.ts`

"Inclua também os campos de documentação no formulário de edição do veículo existente, em uma nova aba ou seção 'Documentação', com campos de data para CRLV, IPVA, Seguro e Inspeção, e toggle para rastreador instalado."
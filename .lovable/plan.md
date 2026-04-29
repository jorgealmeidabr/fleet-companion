## Objetivo
Na aba "Tabela de uso" do Histórico de veículos, exibir data + hora (dd/mm/aaaa HH:mm) nas colunas Saída e Retorno, em vez de apenas a data.

## Mudança
Arquivo: `src/pages/Historico.tsx`

Nas células das colunas "Saída" e "Retorno" da tabela de uso, trocar `fmtDate(r.saida)` / `fmtDate(r.retorno)` por uma formatação que inclua hora e minuto no padrão `dd/mm/aaaa HH:mm`.

Como `fmtDateTime` em `src/lib/format.ts` usa `toLocaleString("pt-BR")` (que retorna `dd/mm/aaaa HH:mm:ss`, com segundos), para garantir o formato pedido `HH:mm` sem segundos, usar opções explícitas:

```ts
new Date(r.saida).toLocaleString("pt-BR", {
  day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit"
})
```

Aplicar o mesmo a `r.retorno`, mantendo fallback "—" quando o valor for nulo/ inválido.

Opcional (para reuso): adicionar um helper `fmtDateTimeShort` em `src/lib/format.ts` com essas opções e usar no Histórico. Recomendo essa opção para manter consistência caso outras telas precisem do mesmo formato no futuro.

## Escopo
- Apenas a tabela de uso da página Histórico. A timeline e outros lugares permanecem inalterados.
- Sem alterações de schema, dados ou queries.
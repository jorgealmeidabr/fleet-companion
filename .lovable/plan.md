## Fuso horário Brasília (America/Sao_Paulo)

Aplicar a regra em todo o projeto, mas centralizando para evitar dezenas de pontos divergentes e bugs sutis.

### Estratégia

1) **Centralizar a formatação em `src/lib/format.ts`** adicionando `timeZone: "America/Sao_Paulo"` em `fmtDate`, `fmtDateTime` e `fmtDateTimeShort`. Todos os componentes que já usam essas helpers passam a exibir em horário de Brasília sem mudança adicional.

2) **Substituir chamadas diretas a `toLocaleString/Date/TimeString("pt-BR", ...)`** que ainda existem fora das helpers para também passar `timeZone: "America/Sao_Paulo"`. Pontos identificados:
   - `src/pages/Veiculos.tsx` (2 ocorrências de `toLocaleTimeString`)
   - `src/pages/Agendamentos.tsx` (`selectedDay.toLocaleDateString`, `day.toLocaleDateString`)
   - `src/pages/AcidenteDetalhe.tsx` (`new Date().toLocaleString("pt-BR")`)
   - `src/hooks/useAlerts.ts` (3 ocorrências)
   - `src/lib/requestPdf.ts` (1 ocorrência relevante de data)
   - `src/components/DigitalClock.tsx` e `src/components/TopbarClock.tsx`: passar `timeZone` no `toLocaleTimeString` interno (e não usar o anti-pattern de "Date convertido").

3) **"Agora" em horário de Brasília** — adicionar helper `nowSP()` em `src/lib/format.ts` que retorna um `Date` representando o instante atual interpretado para São Paulo, conforme solicitado:
   ```ts
   export const nowSP = () =>
     new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
   ```
   Substituir os usos de `new Date()` que representam "horário atual exibido/usado pelo app" por `nowSP()`:
   - `src/pages/Dashboard.tsx` (`now`)
   - `src/pages/Abastecimentos.tsx` (`now`)
   - `src/pages/Motoristas.tsx`, `src/pages/MotoristaDetalhe.tsx` (`hoje`)
   - `src/pages/AcidentesUsuario.tsx` (2 ocorrências de `d`)
   - `src/components/DigitalClock.tsx` e `src/components/TopbarClock.tsx` (state `now`)
   - `src/pages/Agendamentos.tsx` `selectedDay` inicial e o `new Date().toISOString()` exibido em texto.

4) **Não alterar** os `new Date().toISOString()` que vão para o **banco** (Supabase espera UTC):
   - `useAuth.tsx` (`last_login`)
   - `Agendamentos.tsx` (`data_retorno_real`)
   - `Checklists.tsx` (`data` ISO date)
   - Nomes de arquivos CSV (`Historico.tsx`, `Manutencoes.tsx`, `Abastecimentos.tsx`, `Multas.tsx`)
   - `validators.ts` (`getFullYear`)
   
   Esses valores são serializados para armazenamento/transferência, não exibidos. Forçar fuso aqui causaria gravação errada no banco.

### Observação técnica importante

O padrão `new Date(new Date().toLocaleString("en-US", { timeZone: ... }))` cria um `Date` cujo "wall clock" no fuso local do navegador coincide com o horário de Brasília — útil para cálculos visuais (ex.: "qual o dia hoje em SP"), porém **não deve ser gravado em campos `timestamptz` do banco** (gera offset duplo). Por isso a regra é aplicada apenas a usos visuais/cálculos locais, e a exibição usa `toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })`, que é a forma correta e independente do fuso da máquina.

### Arquivos editados

`src/lib/format.ts`, `src/pages/Veiculos.tsx`, `src/pages/Agendamentos.tsx`, `src/pages/AcidenteDetalhe.tsx`, `src/pages/AcidentesUsuario.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Abastecimentos.tsx`, `src/pages/Motoristas.tsx`, `src/pages/MotoristaDetalhe.tsx`, `src/components/DigitalClock.tsx`, `src/components/TopbarClock.tsx`, `src/hooks/useAlerts.ts`, `src/lib/requestPdf.ts`.

Nenhuma alteração em estilos, rotas, lógica de negócio, RLS, queries ou outros componentes.
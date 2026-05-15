## Objetivo

Corrigir e formalizar o cálculo de KM/L por utilização do veículo (tabela `agendamentos`) e a média de consumo do veículo, garantindo consistência via banco de dados e validações no frontend.

## 1. Banco de dados — `21_migration_v14_consumo_kml.sql` (novo)

Adicionar colunas:

- `veiculos.km_inicial int` (preenchido com `km_atual` atual no momento da migration; default 0)
- `veiculos.consumo_medio_kml numeric(10,2)` (default null)
- `agendamentos.litros_abastecidos numeric(10,2)` (null)
- `agendamentos.km_l numeric(10,2)` (calculado por trigger; null se inválido)

Trigger `trg_calc_agendamento_consumo` em `agendamentos` (BEFORE INSERT/UPDATE):

- Se `km_retorno`, `km_saida` e `litros_abastecidos` válidos (`km_retorno > km_saida`, `litros_abastecidos > 0`), calcula `km_l = round((km_retorno - km_saida) / litros_abastecidos, 2)`.
- Caso contrário, `km_l = null`.

Trigger `trg_sync_veiculo_apos_agendamento` em `agendamentos` (AFTER INSERT/UPDATE/DELETE):

- Recalcula `veiculos.consumo_medio_kml` = média de `km_l` de TODAS as utilizações daquele veículo onde `km_l is not null` (ignora registros sem litros e onde `km_retorno <= km_saida`).
- Atualiza `veiculos.km_atual` para o `MAX(km_retorno)` do veículo entre todas as utilizações (nunca retrocede; usa a utilização mais recente/maior). Só executa se houver `km_retorno` informado.

Isto garante recálculo automático em insert/update/delete (corrige bugs de duplicidade e sobrescrita com valor antigo).

## 2. Tipos — `src/lib/types.ts`

- `Veiculo`: adicionar `km_inicial?: number | null`, `consumo_medio_kml?: number | null`.
- `Agendamento`: adicionar `litros_abastecidos?: number | null`, `km_l?: number | null`.

## 3. Frontend — `src/pages/Agendamentos.tsx` (modal de devolução)

- Adicionar input numérico `Litros abastecidos (L)` no formulário de devolução (`retForm`).
- Em `confirmarDevolucao`, validar:
  1. `km_retorno != null` e `km_retorno > km_saida` → senão toast erro "Km de retorno deve ser maior que Km de saída".
  2. `km_retorno >= veiculo.km_atual` → senão toast erro "Km de retorno não pode ser menor que o Km atual do veículo (X)".
  3. `litros_abastecidos > 0` → senão toast erro "Informe litros abastecidos (> 0)".
- Remover o `update` manual do `km_atual` no veículo (agora feito pelo trigger). Apenas salva o `agendamento` com `km_retorno` e `litros_abastecidos`; recarrega veículos para refletir os novos valores calculados pelo banco.
- Exibir, após salvar, o `km_l` calculado em mensagem de sucesso ("Consumo desta utilização: X km/L").

## 4. Exibição do consumo no veículo

- Em `src/pages/Veiculos.tsx` e/ou `src/pages/VeiculoDetalhe.tsx`, mostrar `consumo_medio_kml` (formatado com `fmtNumber`, sufixo "km/L") junto às demais métricas. Sem alterar layout/design — apenas adicionar campo no card existente.

## 5. Observações

- Nenhuma alteração em `Abastecimentos.tsx` (que mantém seu próprio cálculo independente).
- A regra "ignora registro com `km_retorno <= km_saida` ou sem `litros_abastecidos`" é aplicada tanto pelo trigger de cálculo (km_l = null) quanto pela média (que filtra `km_l is not null`).
- Divisão por zero impossível (validação `litros_abastecidos > 0` no trigger e no frontend).

## Arquivos

- novo: `supabase_setup/21_migration_v14_consumo_kml.sql`
- editado: `src/lib/types.ts`
- editado: `src/pages/Agendamentos.tsx`
- editado: `src/pages/VeiculoDetalhe.tsx` (exibir consumo médio)

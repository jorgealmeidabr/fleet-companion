## Objetivo
Remover o campo "Retorno previsto" do formulário de novo agendamento. O horário real de retorno já é capturado automaticamente na devolução.

## Contexto técnico
A coluna `agendamentos.data_retorno_prevista` é `NOT NULL` no banco e é usada para:
- Detecção de conflito de horário (cliente e RPC `check_agendamento_conflito`).
- Renderização do intervalo no calendário, timeline e popup.
- Sugestões de horários alternativos.

Por isso, não dá para simplesmente remover o valor — precisamos preencher automaticamente.

## Mudanças em `src/pages/Agendamentos.tsx`

1. **Remover o input "Retorno previsto"** do `DialogContent` de novo agendamento (linhas ~645-654). A grade `sm:grid-cols-2` vira um único campo "Saída".

2. **Auto-preencher `data_retorno_prevista`** sempre que o usuário alterar "Saída":
   - Calcular `data_saida + 24h` e gravar no estado `form.data_retorno_prevista` no formato `YYYY-MM-DDTHH:mm`.
   - Assim, toda a lógica existente de conflito, timeline e RPC continua funcionando sem alteração.

3. **Texto auxiliar** abaixo do campo Saída:
   *"O horário de retorno será registrado automaticamente na devolução do veículo."*

4. **Sugestões de horário** (quando há conflito): o botão de sugestão hoje seta `data_saida` e `data_retorno_prevista` com o intervalo sugerido — manter esse comportamento (apenas usado internamente).

5. Nenhuma alteração em validação de submit (`!form.data_retorno_prevista`) é necessária, pois o valor sempre estará preenchido automaticamente quando `data_saida` existir.

## Fora do escopo
- Não alterar schema do banco (coluna continua `NOT NULL`).
- Não alterar exibição em listas/popup/calendário (continuam mostrando o intervalo previsto, agora derivado de saída + 24h até a devolução real ser registrada).
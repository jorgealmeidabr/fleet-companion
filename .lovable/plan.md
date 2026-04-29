## Plano: Validação anti-fraude do "Km de retorno"

### Objetivo
No modal "Registrar devolução" (`src/pages/Agendamentos.tsx`), impedir que o usuário confirme a devolução quando o `Km de retorno` for menor que o `Km de saída` do agendamento. Hoje existe apenas um `toast` na função `confirmarDevolucao` — vamos reforçar com validação inline e bloqueio do botão.

### Arquivo alterado
Apenas **`src/pages/Agendamentos.tsx`**.

### Mudanças

1. **Cálculo derivado no render do modal** (logo antes do JSX do `Dialog` de devolução):
   - `const kmSaida = returning?.km_saida ?? 0;`
   - `const kmRetorno = retForm.km_retorno;`
   - `const kmInvalido = kmRetorno != null && !Number.isNaN(kmRetorno) && kmRetorno < kmSaida;`

2. **Mensagem de erro inline** abaixo do `Input` de Km de retorno (linha ~762):
   - Quando `kmInvalido` for `true`, exibir:
     > "Km de retorno inválido. O valor não pode ser menor que o Km de saída."
   - Estilo: `text-xs text-destructive` (mesmo padrão usado em `FormDialog`).
   - Adicionar `aria-invalid={kmInvalido}` e borda destrutiva no `Input` (`className={kmInvalido ? "border-destructive" : ""}`).

3. **Bloquear o botão "Confirmar devolução"** (linha ~795):
   - Adicionar `kmInvalido || kmRetorno == null` ao `disabled` existente:
     `disabled={savingDevolucao || uploadingFoto || kmInvalido || kmRetorno == null}`

4. **Atualizar a mensagem do toast** em `confirmarDevolucao` (linha 321) para o texto completo solicitado, mantendo a checagem como segunda linha de defesa:
   > "Km de retorno inválido. O valor não pode ser menor que o Km de saída."

### Comportamento resultante
- Enquanto o KM digitado for menor que o KM de saída, aparece mensagem vermelha embaixo do campo, o `Input` ganha borda vermelha e o botão "Confirmar devolução" fica desabilitado.
- Se por qualquer motivo a chamada chegar a `confirmarDevolucao`, o `toast` destrutivo bloqueia a submissão.
- Nenhuma outra lógica (foto do hodômetro, status, navegação para checklist) é alterada.
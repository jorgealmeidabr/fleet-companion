## Diagnóstico

Encontrei **dois problemas** confirmados em `src/pages/Usuarios.tsx`:

### 🐛 Bug 1 — `next()` bloqueia o avanço de 2 → 3

Na linha 321:

```ts
const next = () => {
  const err = passo1Valido();          // ← sempre valida o passo 1
  if (err) return toast(...);
  if (tipoConta === "admin") setStep(3);
  else setStep(2);                     // ← do step 2, volta a setar 2!
};
```

A função roda a validação do passo 1 **independente do step atual** e, quando é chamada do step 2, executa `setStep(2)` de novo — nunca chega ao 3. É exatamente o sintoma relatado.

### ⚠️ Bug 2 — Falta `DialogDescription` (warning Radix)

Nenhum dos `DialogContent` do projeto declara `aria-describedby` nem renderiza `DialogDescription`. O Radix emite warning de acessibilidade. Arquivos afetados:

- `src/pages/Usuarios.tsx`
- `src/pages/Agendamentos.tsx`
- `src/pages/Checklists.tsx`
- `src/components/FormDialog.tsx`
- `src/components/ConfirmDialog.tsx` *(provável — confirmar)*

`command.tsx` e `alert-dialog.tsx` usam variantes próprias e não disparam o warning aqui.

---

## Correções planejadas

### 1. Refatorar `next()` no `UserWizard` (`src/pages/Usuarios.tsx`)

Tornar a função consciente do step atual:

```ts
const next = () => {
  if (step === 1) {
    const err = passo1Valido();
    if (err) return toast({ title: err, variant: "destructive" });
    setStep(tipoConta === "admin" ? 3 : 2);
    return;
  }
  if (step === 2) {
    setStep(3);                // permissões têm defaults — sem guard
    return;
  }
};
```

Mantém a regra de pular o passo 2 quando `tipoConta === "admin"` e garante que o submit ao Supabase só ocorre no step 3 (já é o caso — `submit()` está ligado apenas ao botão "Criar usuário").

### 2. Adicionar `DialogDescription` (sr-only) em todos os modais

- Importar `DialogDescription` em cada arquivo listado.
- Renderizar dentro do `DialogHeader` com `className="sr-only"` e texto contextual, ex.:
  - `Usuarios.tsx`: "Assistente de criação/edição de usuário em três etapas: dados, permissões e confirmação."
  - `FormDialog.tsx`: usar a prop `title` como base ("Formulário para {title}").
  - `ConfirmDialog.tsx`: já recebe `description` — passar para `DialogDescription` visível (não sr-only).
  - `Agendamentos.tsx` / `Checklists.tsx`: descrições curtas conforme o conteúdo de cada modal.

### 3. QA manual após aplicar

Fluxo a validar no preview:
1. Abrir `/usuarios` → "Novo usuário".
2. Preencher passo 1 (com senha gerada) → "Continuar" leva ao passo 2.
3. Alternar permissões / aplicar preset → "Continuar" leva ao passo 3.
4. "Voltar" do 3 retorna ao 2; do 2 retorna ao 1.
5. Caso `tipoConta = admin`: do passo 1 pula direto para o 3; "Voltar" no 3 retorna ao 1.
6. Confirmar que o warning do Radix sumiu do console.

## Arquivos a modificar

- `src/pages/Usuarios.tsx` — fix do `next()` + `DialogDescription`
- `src/components/FormDialog.tsx` — `DialogDescription` sr-only
- `src/components/ConfirmDialog.tsx` — usar `DialogDescription` para a descrição já existente
- `src/pages/Agendamentos.tsx` — `DialogDescription` sr-only
- `src/pages/Checklists.tsx` — `DialogDescription` sr-only

Sem alterações de schema, RLS ou lógica de negócio. A chamada ao Supabase (`signUp` + insert em `usuarios_perfis`) continua acontecendo **apenas** no botão "Criar usuário" do step 3.
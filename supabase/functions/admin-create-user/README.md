# Edge Function: `admin-create-user`

Cria um usuário (Auth + motorista + perfil) chamando `auth.admin.createUser` com a service role key — sem expor a chave no frontend. Apenas admins autenticados conseguem invocar.

## Deploy (uma única vez)

Pré-requisitos: Supabase CLI instalada e logada (`supabase login`).

```bash
# Linkar o projeto (use o ref do seu projeto: vrjjbltyostoujdvonil)
supabase link --project-ref vrjjbltyostoujdvonil

# Deploy da função (não exige verify_jwt; validamos o token dentro)
supabase functions deploy admin-create-user --no-verify-jwt
```

## Configurar a SERVICE_ROLE_KEY como secret

No painel do Supabase: **Project Settings → Edge Functions → Secrets** (ou via CLI):

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ...sua-service-role-key...
```

A service role key fica disponível em `Project Settings → API → service_role`.
**Nunca** coloque essa chave em variáveis `VITE_*` ou no código do frontend.

## Como o frontend chama

```ts
const { data, error } = await supabase.functions.invoke("admin-create-user", {
  body: { email, senha, nome, cargo, tipo_conta, permissoes, ... },
});
```

A função:
1. Valida o JWT do chamador.
2. Confirma que ele tem `tipo_conta = 'admin'` e está ativo em `usuarios_perfis`.
3. Cria o usuário no Auth (com `email_confirm: true`, sem precisar de SMTP).
4. Cria/vincula o motorista.
5. Cria o registro em `usuarios_perfis`.
6. Faz rollback do usuário Auth se qualquer etapa subsequente falhar.

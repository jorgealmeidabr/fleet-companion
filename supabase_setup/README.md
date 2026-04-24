# BRQ – Frota Interna :: Setup do Supabase

## Passo a passo (5 min)

### 1. Crie um projeto Supabase
- Acesse https://supabase.com → **New project**
- Anote a **Project URL** e a **anon public key** (Settings → API)

### 2. Configure Auth
- Authentication → Providers → **Email** → habilitado
- Authentication → URL Configuration → **Site URL** = URL do seu app (a do preview Lovable inicialmente)
- (Opcional) desabilite "Confirm email" durante testes para login imediato

### 3. Rode os scripts SQL nesta ordem (SQL Editor)
1. `01_schema.sql` — enums, tabelas, triggers, função `has_role`
2. `02_rls.sql` — políticas de segurança
3. `03_storage.sql` — buckets de fotos
4. **Crie sua primeira conta** (signup pela tela `/auth` do app)
5. **Promova-se a admin** no SQL Editor:
   ```sql
   insert into public.user_roles(user_id, role)
   select id, 'admin' from auth.users where email='SEU_EMAIL@exemplo.com'
   on conflict do nothing;
   ```
6. `04_seed.sql` — dados de exemplo

### 4. Configure as variáveis no Lovable
No projeto Lovable, abra o arquivo `.env` (ou crie):
```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

Pronto! Faça login em `/auth`.

## Modelo de permissões
- **admin**: CRUD total
- **usuario**: leitura + criar abastecimentos e checklists

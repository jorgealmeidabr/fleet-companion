
# Módulo "Acidentes"

Novo item de menu na seção **Execução** com fluxos distintos para Motorista e Admin, persistência via Supabase, notificação no sino e relatório formal imprimível.

## 1. Banco de dados (Supabase)

Novo arquivo `supabase_setup/16_migration_v9_acidentes.sql` com instruções para o usuário rodar no SQL Editor. Conteúdo:

- **Tabela `acidentes`**: `id uuid pk`, `protocolo text unique`, `user_id uuid → auth.users`, `motorista_nome text`, `veiculo_id uuid → veiculos`, `data_hora timestamptz`, `local text`, `descricao text`, `tipo text` (`colisao|atropelamento|capotamento|outro`), `culpa text` (`funcionario|terceiro|falha_mecanica|desconhecido`), `numero_bo text null`, `fotos_urls text[]`, `status text default 'pendente'` (`pendente|em_analise|encerrado`), `created_at timestamptz`.
- **Tabela `acidentes_contatos`**: `id`, `nome`, `cargo`, `telefone`, `whatsapp`, `ordem int`, `created_at`. Seed com 3 placeholders (RH, Gestor de Frota, Diretoria).
- **Bucket de storage `acidentes`** (público) para fotos.
- **RLS**:
  - `acidentes`: motorista insere/seleciona apenas as próprias (`user_id = auth.uid()`); admin tudo (`is_admin_perfil`). Apenas admin faz `update` (mudar status).
  - `acidentes_contatos`: select para todos autenticados; insert/update/delete só admin.
- Novo módulo de permissão `"acidentes"` (default true para usuário, true para admin).

## 2. Tipos e permissões

- `src/lib/types.ts`: adicionar `"acidentes"` em `ModuloPermissao`, atualizar `PERMISSOES_DEFAULT` e `PERMISSOES_TUDO`, adicionar interfaces `Acidente`, `AcidenteContato`, e mapping em `Database.Tables`.
- `src/hooks/usePermissions.ts`: incluir `acidentes: true` no fallback (admin e motorista).

## 3. Sidebar e rotas

- `src/components/AppLayout.tsx`: adicionar item `{ title: "Acidentes", url: "/acidentes", icon: AlertOctagon, perm: "acidentes" }` na seção **Execução**.
- `src/App.tsx`: adicionar rotas `/acidentes` (`AcidentesIndex`) e `/acidentes/:id` (admin — `AcidenteDetalhe`).

## 4. Página `/acidentes` — roteamento por perfil

`src/pages/Acidentes.tsx` decide via `usePermissions().isAdmin`:
- Admin → `<AcidentesAdminList />`
- Demais → `<AcidentesUsuario />`

## 5. Fluxo Usuário — `src/pages/AcidentesUsuario.tsx`

Componente único com seções verticais:

1. **Banner emergência** — `bg-destructive` full-width, texto + 3 botões `<a href="tel:192|193|190">` com ícones Lucide (`Ambulance`, `Flame`, `Shield`).
2. **Checklist 5 passos** — `useState<boolean[]>` local; cada card numerado com `Checkbox`, número grande estilo brand (amarelo). Visual de "concluído" com strikethrough.
3. **Contatos da empresa** — query em `acidentes_contatos`. Cards com nome/cargo/telefone + botões `tel:` e `https://wa.me/<num>`. Sem edição aqui (admin edita em outra UI; ver §6).
4. **Formulário de registro** — `react-hook-form` + zod (padrão do projeto). Campos:
   - Veículo (Select dos `veiculos` da frota)
   - Nome do motorista (preenchido auto: `perfil.motorista?.nome` via fetch ou `user.email` como fallback) — readonly
   - Data e hora (input `datetime-local`, default agora)
   - Local
   - Descrição (Textarea)
   - Tipo (Select)
   - Culpa (Select)
   - Nº B.O. (opcional)
   - Upload de fotos (múltiplas) usando `uploadFiles("acidentes" as any, files)` — adicionar `"acidentes"` ao tipo `Bucket` em `src/lib/storage.ts`.
   - Botão "Enviar ocorrência": gera `protocolo` (`AC-yyyymmdd-xxxx`), insere em `acidentes` com `status: "pendente"`, exibe toast + tela de confirmação inline com protocolo.
5. **Acordeão Responsabilidade Legal** — `Accordion` com 2 itens explicativos (Empresa paga / Funcionário paga) com textos legais resumidos.

## 6. Fluxo Admin

### `src/pages/AcidentesAdminList.tsx`
- `DataTable` com colunas: Data, Motorista, Veículo (placa), Tipo, Status (`StatusBadge`), Ações.
- Filtros: `Select` status (todos/pendente/em_analise/encerrado) e `Input` período (de/até).
- Botão "Ver detalhes" → `navigate(/acidentes/${id})`.
- Botão "Gerenciar contatos" abre `Dialog` com CRUD de `acidentes_contatos`.

### `src/pages/AcidenteDetalhe.tsx`
- Carrega ocorrência por id + dados do veículo.
- Seções: Dados do motorista, Veículo, Data/Local, Descrição, Tipo/Culpa, Nº B.O., Galeria de fotos (grid clicável → lightbox simples).
- `Select` para alterar status (update no Supabase + toast).
- Botão **"Imprimir documento formal"** → `window.print()`.
- Layout do relatório imprimível (renderizado dentro da página, escondido em tela e visível em print):
  - Container com classe `print-only` + global CSS `@media print { .no-print { display:none !important } body { background:white } }` adicionado em `src/index.css`.
  - Conteúdo: logo BRQ (`@/assets/brq-logo-app.jpg`), título "Relatório de Ocorrência de Acidente", protocolo, todas as informações em seções, dois campos de assinatura (motorista e responsável), data de geração.
  - Sidebar/header já são ocultos via classe `no-print` aplicada no `header` e `Sidebar` do `AppLayout` (adicionar essa classe).

## 7. Notificação no sino

- Novo hook `src/hooks/useAcidentesNotif.ts`: para admins, faz `select count(*)` em `acidentes` com `status = 'pendente'` (poll a cada 60s + Supabase realtime channel em `INSERT`).
- `useAlerts` integração: gerar `AlertItem` "Nova ocorrência registrada — [motorista], [placa]" para cada acidente pendente, com `link: /acidentes/${id}`. Isso já alimenta o badge do sino existente em `/alertas`.
- Ajuste em `useAlerts.ts`: incluir fetch da tabela `acidentes` e gerar alertas `level: "atencao"` para os admins.

## 8. Memória

Salvar `mem://features/acidentes` resumindo: tabelas, status flow, bucket de storage, perfis e endpoint de print.

## Detalhes técnicos

- Componentes shadcn já existentes: `Card`, `Accordion`, `Dialog`, `Select`, `Textarea`, `Checkbox`, `Switch`, `Badge`, `Button`, `DataTable`.
- Ícones Lucide: `AlertOctagon`, `Ambulance`, `Flame`, `Shield`, `Phone`, `MessageCircle`, `Printer`.
- Cores: usar tokens existentes (`bg-destructive`, `bg-warning`, `text-warning-foreground`) — paleta amarelo/preto BRQ já definida.
- Upload: estender `Bucket` em `src/lib/storage.ts` para incluir `"acidentes"`.
- Migração SQL **não roda automaticamente** — usuário precisa colar o conteúdo do arquivo `16_migration_v9_acidentes.sql` no SQL Editor do Supabase (mesmo padrão da v8). O código fica preparado para funcionar assim que a migração rodar.

## Arquivos a criar
- `supabase_setup/16_migration_v9_acidentes.sql`
- `src/pages/Acidentes.tsx` (router por perfil)
- `src/pages/AcidentesUsuario.tsx`
- `src/pages/AcidentesAdminList.tsx`
- `src/pages/AcidenteDetalhe.tsx`
- `src/hooks/useAcidentesNotif.ts`
- `mem://features/acidentes` + atualização do `mem://index.md`

## Arquivos a editar
- `src/lib/types.ts` (módulo `acidentes`, interfaces, Database)
- `src/lib/storage.ts` (bucket `acidentes`)
- `src/hooks/usePermissions.ts` (fallback)
- `src/hooks/useAlerts.ts` (alerta de nova ocorrência)
- `src/components/AppLayout.tsx` (item de menu + classe `no-print`)
- `src/App.tsx` (rotas)
- `src/index.css` (regras `@media print`)

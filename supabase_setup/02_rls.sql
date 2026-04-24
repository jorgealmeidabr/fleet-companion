-- ============================================================
-- RLS: leitura para autenticados; escrita só para admin
-- ============================================================

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.veiculos enable row level security;
alter table public.motoristas enable row level security;
alter table public.manutencoes enable row level security;
alter table public.abastecimentos enable row level security;
alter table public.checklists enable row level security;
alter table public.agendamentos enable row level security;
alter table public.multas enable row level security;

-- profiles: cada um vê o seu; admin vê todos
create policy "profiles self select" on public.profiles
for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "profiles self update" on public.profiles
for update to authenticated using (id = auth.uid());

-- user_roles: apenas admin gerencia; usuário vê seus próprios papéis
create policy "roles self read" on public.user_roles
for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "roles admin write" on public.user_roles
for all to authenticated
using (public.has_role(auth.uid(),'admin'))
with check (public.has_role(auth.uid(),'admin'));

-- Helper: gera 4 policies (select all, insert/update/delete admin) para uma tabela
-- Aplicado manualmente abaixo para clareza:

-- VEÍCULOS
create policy "veiculos read" on public.veiculos for select to authenticated using (true);
create policy "veiculos write admin" on public.veiculos for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- MOTORISTAS
create policy "motoristas read" on public.motoristas for select to authenticated using (true);
create policy "motoristas write admin" on public.motoristas for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- MANUTENÇÕES
create policy "manutencoes read" on public.manutencoes for select to authenticated using (true);
create policy "manutencoes write admin" on public.manutencoes for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ABASTECIMENTOS (usuários comuns podem registrar)
create policy "abastecimentos read" on public.abastecimentos for select to authenticated using (true);
create policy "abastecimentos insert" on public.abastecimentos for insert to authenticated with check (true);
create policy "abastecimentos write admin" on public.abastecimentos for update to authenticated
  using (public.has_role(auth.uid(),'admin'));
create policy "abastecimentos del admin" on public.abastecimentos for delete to authenticated
  using (public.has_role(auth.uid(),'admin'));

-- CHECKLISTS (usuários podem criar)
create policy "checklists read" on public.checklists for select to authenticated using (true);
create policy "checklists insert" on public.checklists for insert to authenticated with check (true);
create policy "checklists write admin" on public.checklists for update to authenticated
  using (public.has_role(auth.uid(),'admin'));
create policy "checklists del admin" on public.checklists for delete to authenticated
  using (public.has_role(auth.uid(),'admin'));

-- AGENDAMENTOS
create policy "agendamentos read" on public.agendamentos for select to authenticated using (true);
create policy "agendamentos write admin" on public.agendamentos for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- MULTAS
create policy "multas read" on public.multas for select to authenticated using (true);
create policy "multas write admin" on public.multas for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

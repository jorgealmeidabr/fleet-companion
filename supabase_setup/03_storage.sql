-- ============================================================
-- Storage buckets para fotos de veículos, motoristas e checklists
-- ============================================================

insert into storage.buckets (id, name, public) values
  ('veiculos','veiculos', true),
  ('motoristas','motoristas', true),
  ('checklists','checklists', true)
on conflict (id) do nothing;

-- Leitura pública (buckets já são públicos), upload por autenticados
create policy "upload autenticado veiculos" on storage.objects
for insert to authenticated with check (bucket_id = 'veiculos');
create policy "upload autenticado motoristas" on storage.objects
for insert to authenticated with check (bucket_id = 'motoristas');
create policy "upload autenticado checklists" on storage.objects
for insert to authenticated with check (bucket_id = 'checklists');

create policy "update admin storage" on storage.objects
for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "delete admin storage" on storage.objects
for delete to authenticated using (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- Dados de exemplo (seed) — rode após criar pelo menos 1 usuário admin
-- Para promover seu usuário a admin:
--   insert into public.user_roles(user_id, role)
--   select id, 'admin' from auth.users where email='SEU_EMAIL@exemplo.com'
--   on conflict do nothing;
-- ============================================================

insert into public.veiculos (placa, modelo, marca, ano, tipo, combustivel, km_atual, status) values
  ('BRQ1A23','Onix','Chevrolet',2022,'carro','flex',45230,'disponivel'),
  ('BRQ2B34','HR-V','Honda',2023,'carro','flex',12800,'disponivel'),
  ('BRQ3C45','Strada','Fiat',2021,'caminhao','flex',78900,'manutencao'),
  ('BRQ4D56','Sprinter','Mercedes',2020,'van','diesel',132450,'disponivel'),
  ('BRQ5E67','CG 160','Honda',2023,'moto','gasolina',8900,'reservado');

insert into public.motoristas (nome, cnh_numero, cnh_categoria, cnh_validade, telefone, email) values
  ('Carlos Andrade','01234567890','B','2026-08-15','11 99999-0001','carlos@brq.com'),
  ('Mariana Lopes','09876543210','AB','2025-05-10','11 99999-0002','mariana@brq.com'),
  ('Rafael Souza','11223344556','D','2027-12-01','11 99999-0003','rafael@brq.com');

with v as (select id, placa from public.veiculos)
insert into public.manutencoes (veiculo_id, tipo, data, km_momento, descricao, custo_total, oficina, proxima_km, proxima_data, status)
select v.id, 'preventiva', current_date - interval '20 days', 44000, 'Troca de óleo e filtros', 480.00, 'Oficina Central', 54000, current_date + interval '160 days', 'concluida'
from v where placa='BRQ1A23'
union all
select v.id, 'corretiva', current_date - interval '5 days', 78500, 'Reparo embreagem', 2150.00, 'Mecânica Top', null, null, 'em_andamento'
from v where placa='BRQ3C45';

with v as (select id, placa from public.veiculos), m as (select id, nome from public.motoristas)
insert into public.abastecimentos (veiculo_id, motorista_id, data, km_atual, litros, valor_total, posto)
select v.id, m.id, current_date - interval '15 days', 44500, 38.5, 230.10, 'Posto BR'
from v, m where v.placa='BRQ1A23' and m.nome='Carlos Andrade'
union all
select v.id, m.id, current_date - interval '2 days', 45230, 42.0, 252.00, 'Posto Shell'
from v, m where v.placa='BRQ1A23' and m.nome='Carlos Andrade'
union all
select v.id, m.id, current_date - interval '7 days', 12500, 35.0, 210.00, 'Posto Ipiranga'
from v, m where v.placa='BRQ2B34' and m.nome='Mariana Lopes';

with v as (select id, placa from public.veiculos), m as (select id, nome from public.motoristas)
insert into public.checklists (veiculo_id, motorista_id, data, status, observacoes)
select v.id, m.id, current_date - interval '3 days', 'ok', 'Tudo conforme.'
from v, m where v.placa='BRQ1A23' and m.nome='Carlos Andrade';

with v as (select id, placa from public.veiculos), m as (select id, nome from public.motoristas)
insert into public.multas (veiculo_id, motorista_id, data_infracao, tipo_infracao, valor, pontos_cnh, status_pagamento, auto_infracao)
select v.id, m.id, current_date - interval '40 days', 'Excesso de velocidade', 195.23, 4, 'pendente', 'AI-2025-0001'
from v, m where v.placa='BRQ4D56' and m.nome='Rafael Souza';

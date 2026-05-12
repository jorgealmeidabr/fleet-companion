## Filtro por categoria de CNH em Veículos

### O que muda

1) **Schema (banco):** adicionar coluna `cnh_necessaria` em `veiculos` com valores permitidos `'A' | 'B' | 'AB'`, default `'B'` (a maior parte da frota são carros). Backfill automático: motos → `'A'`, demais tipos → `'B'`.

2) **Tipo TS:** adicionar `cnh_necessaria: 'A' | 'B' | 'AB'` em `Veiculo` (`src/lib/types.ts`).

3) **Form de cadastro/edição (`src/pages/Veiculos.tsx`):** adicionar campo select "CNH necessária" no `fields` (A / B / AB).

4) **Helper de compatibilidade (`src/lib/cnh.ts` novo):** função `cnhPermite(cnhUsuario, cnhVeiculo)` — extrai letras únicas da categoria do motorista (ex.: "AB", "AD", "ACC") e checa se contém a do veículo. Regra solicitada (A→moto, B→carro, AB→tudo) é caso particular dessa lógica.

5) **Listagem (`src/pages/Veiculos.tsx` e onde mais houver):** seguindo o padrão existente do `useVehicleAccess` (filterAllowed remove da lista), os veículos fora da categoria do usuário **não aparecem** para usuários comuns. Admin vê tudo. Implementação: após o `filterAllowed` atual, aplicar mais um filtro por CNH usando o `cnh_categoria` do motorista vinculado ao usuário logado (vem de `perfil.motorista_id` → tabela `motoristas`).

6) **Reserva (`src/pages/Agendamentos.tsx`):** na criação do agendamento (e em "Iniciar uso"), validar antes de gravar. Se a CNH do motorista não cobrir `cnh_necessaria` do veículo, abortar com toast: `Sua habilitação categoria {X} não permite conduzir este veículo.`

### Arquivos

- `supabase_setup/18_migration_v11_cnh_necessaria.sql` (novo) — coluna + check + backfill.
- `src/lib/types.ts` — campo no `Veiculo`.
- `src/lib/cnh.ts` (novo) — `cnhPermite(...)`.
- `src/pages/Veiculos.tsx` — campo no form + filtro extra na listagem.
- `src/pages/Agendamentos.tsx` — filtro extra na lista de veículos selecionáveis + validação no submit do novo agendamento e no `iniciarUso`.

### Não muda

Estilos, rotas, layout, hooks de auth, RLS, demais validações, fluxo de devolução/checklist, `useVehicleAccess`, regra dos 30min, polling.
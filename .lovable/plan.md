## Objetivo

Permitir que admins marquem um veículo como "Uso restrito" e selecionem quais usuários podem reservá-lo. Nas telas de agendamento (calendário e novo agendamento), o frontend filtra: se o veículo é restrito, só aparece para usuários liberados. Admins veem tudo.

## Importante sobre persistência

O pedido é para criar a tabela `vehicle_allowed_users` "implicitamente via upsert", **sem migração SQL e sem RLS**. Isso **não funciona com Supabase/Postgres** — o PostgREST só expõe tabelas que já existem no schema, e a tentativa de insert vai retornar erro "relation does not exist". Além disso, a coluna `restricted` em `veiculos` também não existe e não pode ser criada sem migração.

Para entregar o efeito sem nenhuma alteração de banco, vou usar **localStorage** como armazenamento (chave por veículo). Fica claramente apenas-cliente: configurado num navegador, lido por todos os usuários no mesmo dispositivo. É a única forma fiel à restrição "sem migração e sem RLS".

Se você prefere persistência real e multi-dispositivo, me avise e eu adiciono uma migração mínima criando a tabela + a coluna + RLS adequada — é o caminho recomendado.

## Mudanças

### 1. `src/lib/vehicleAccess.ts` (novo)
Helper com:
- `getRestriction(vehicleId): { restricted: boolean; allowedUserIds: string[] }`
- `setRestriction(vehicleId, value)`
- `getAllRestrictions(): Record<vehicleId, ...>`
- `canUserUseVehicle(vehicleId, userId, isAdmin): boolean` — admin sempre true; sem restrição → true; com restrição → checa lista.

Armazena em `localStorage` sob a chave `vehicle_access_v1` como objeto `{ [vehicleId]: { restricted, allowedUserIds } }`. Emite um `window` CustomEvent `vehicle-access-changed` para hooks reagirem.

### 2. `src/hooks/useVehicleAccess.ts` (novo)
Hook que retorna o mapa de restrições e re-renderiza ao ouvir o evento + `storage`. Expõe `filterAllowed(vehiculos, userId, isAdmin)`.

### 3. `src/pages/VeiculoDetalhe.tsx`
Adicionar (somente para `isAdmin`) um card "Uso restrito":
- `Switch` "Uso restrito" (componente já existe em `ui/switch`).
- Quando ligado: lista de usuários (`usuarios_perfis` + nome do `motoristas` via join client-side, tipo_conta = "usuario", ativo) com `Checkbox` por linha.
- Botão "Salvar" → chama `setRestriction(veiculo.id, { restricted, allowedUserIds })`.
- Toast de confirmação. Estado local inicializado a partir de `getRestriction`.

### 4. `src/pages/Agendamentos.tsx`
- Na inicialização, obter `perfil.user_id` do `useAuth`.
- Aplicar `filterAllowed` em:
  - `veiculos` exibidos no grid de "Novo Agendamento" (linhas que renderizam cards selecionáveis).
  - Lista de veículos da timeline horária no Calendário (loop sobre `veiculos`).
- Admin: passa `isAdmin=true` → vê todos.

### 5. (Opcional, mesma sessão) Indicador visual
Em `VeiculoDetalhe` admin, mostrar badge "Restrito" no card do veículo quando `restricted=true`. (Não pedido em outras telas, então não tocar `Veiculos.tsx`.)

## Detalhes técnicos

- `usuarios_perfis` tem `user_id` e `motorista_id`; carregar nomes via `motoristas.in("id", motoristaIds)`.
- `filterAllowed` recebe `veiculos: Veiculo[]` e devolve filtrado; aplicar antes dos `useMemo` de `colorByVeiculo`/grids para que a UI inteira respeite a permissão.
- Conflitos / janelas continuam funcionando normalmente — só some o card pra quem não está liberado.
- Nenhuma chamada Supabase nova; nenhuma migração; nenhum schema novo.

## Limitação (precisa confirmar)

A configuração mora em `localStorage` do navegador do admin. Outros dispositivos não veem a restrição. Se aceitável, prossigo. Se não, recomendo trocar para uma migração SQL real.

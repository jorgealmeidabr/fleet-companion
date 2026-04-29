## Desativar tela de descanso (idle) na página de Veículos

O hook `useIdle` é instanciado em `src/components/AppLayout.tsx` (linha 156) com `enabled = !!user`, e mostra `<IdleScreen />` após 50s de inatividade. Para desligá-lo apenas em `/veiculos`, basta condicionar o `enabled` à rota atual.

### Mudança técnica (arquivo único)

`**src/components/AppLayout.tsx**` — substituir a linha 156:

```tsx
const location = useLocation();
// Desativa a tela de descanso enquanto o usuário estiver na página de Veículos
const idleEnabled = !!user && location.pathname !== "/veiculos";
const { idle, wake } = useIdle(50000, idleEnabled);
```

`useLocation` já está importado (linha 1). Quando o usuário entra em `/veiculos`, `enabled` vira `false` — o `useIdle` limpa o timer e não mostra mais o overlay. Ao navegar para qualquer outra rota, `enabled` volta a `true` e o comportamento normal é retomado automaticamente.

### Comportamento

- Em `/veiculos`: nenhum timer de inatividade, `IdleScreen` nunca aparece.
- Em qualquer outra rota autenticada: comportamento atual preservado (60s → tela de descanso).
- Sem mudanças em `useIdle`, `IdleScreen` ou em `Veiculos.tsx`.
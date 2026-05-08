## Objetivo
Corrigir o bug visual do menu lateral quando recolhido, ajustando apenas CSS/estilos no `AppLayout.tsx` (componente do Sidebar). Nenhuma rota, hook, query ou lógica será alterada.

## Mudanças

Arquivo único: `src/components/AppLayout.tsx`

### 1. Container do Sidebar (estado colapsado)
Adicionar classes condicionais no `<Sidebar>` para forçar largura fixa de 56px e overflow hidden quando `collapsed === true`:
- `w-14` (56px) e `overflow-hidden` quando colapsado.

### 2. Itens de navegação (`NavLink` dentro do `SidebarMenuButton`)
Quando colapsado, aplicar:
- `flex items-center justify-center w-full py-2` (padding 8px 0)
- Manter o ícone com tamanho fixo `h-4 w-4 shrink-0` (já existe `h-4 w-4`, adicionar `shrink-0`).

### 3. Texto do item
O `<span>` com o título já é renderizado apenas quando `!collapsed`. Para garantir que, em transição, não quebre layout, envolver com classes `overflow-hidden whitespace-nowrap` (no estado expandido também é seguro).

### 4. Badge de notificação no estado colapsado
Hoje o badge usa `absolute right-0 top-0 -translate-y-1 translate-x-1` quando colapsado. Ajustar para a especificação:
- `absolute top-1 right-1.5` (≈ top: 4px; right: 6px), removendo os translates.
- Manter `h-5 min-w-[20px]` etc.

### 5. Header/Footer do Sidebar
Quando colapsado, garantir que o conteúdo do header (logo) fique centralizado e sem overflow. O bloco de texto já só renderiza quando `!collapsed`, então apenas centralizar o wrapper do logo nesse estado (`justify-center` quando colapsado).

## Detalhes técnicos

- Toda condicionalidade usará `cn(..., collapsed && "...")` seguindo o padrão já existente no arquivo.
- Não tocar em `groups`, `NavLink to`, `usePermissions`, `useAlerts`, `useRequestBadge`, autenticação, ou qualquer outro componente.
- Sem mudanças em `index.css` ou `tailwind.config.ts` — apenas classes utilitárias Tailwind já disponíveis.
- Comportamento de toggling do sidebar (via `SidebarTrigger` / `useSidebar`) permanece intacto.

## Resultado esperado
- Menu recolhido com 56px de largura, ícones perfeitamente centralizados, sem texto visível, sem cortes.
- Badge vermelho aparece no canto superior direito do ícone (top 4px / right 6px).
- Nenhuma regressão funcional.

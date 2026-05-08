## Objetivo
Adicionar funcionalidade de recolher/expandir grupos no menu lateral (`src/components/AppLayout.tsx`), sem alterar estilos, rotas, lógica ou outros componentes.

## Escopo
- **Único arquivo modificado:** `src/components/AppLayout.tsx`
- **Único componente modificado:** `AppSidebar`
- Nenhum outro arquivo, hook, rota, query ou componente será alterado.

## Mudanças

### 1. Imports
- Adicionar `useState` ao import do React.
- Adicionar `ChevronDown` ao import existente do `lucide-react`.

### 2. Estado por grupo
Dentro de `AppSidebar`, criar um estado que mapeia o label do grupo para `boolean` (todos começam `true` = expandido):

```ts
const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
  () => Object.fromEntries(groups.map(g => [g.label, true]))
);
const toggleGroup = (label: string) =>
  setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
```

### 3. Render do grupo
Para cada `group` no `visibleGroups.map(...)`:

- O `<SidebarGroupLabel>` atual será substituído por um `<button>` (dentro do `SidebarGroupLabel` para preservar o estilo existente do label) que:
  - Chama `toggleGroup(group.label)` no `onClick`.
  - Mostra o título do grupo + um `<ChevronDown>` à direita.
  - O ícone aplica `className="transition-transform duration-200"` e, quando o grupo está recolhido, adiciona `rotate-180` (via `cn`).
  - Quando `collapsed` (sidebar em modo ícones), o botão é renderizado sem o chevron e sem `onClick` ativo — comportamento atual preservado.

- O `<SidebarGroupContent>` recebe um wrapper interno com classes:
  - `overflow-hidden transition-all duration-200`
  - `max-h-0` quando `!openGroups[group.label] && !collapsed`
  - `max-h-[1000px]` (valor folgado, suficiente p/ qualquer grupo) caso contrário.
  - Quando `collapsed`, sempre `max-h-[1000px]` (lógica ignorada).

### 4. Comportamento quando colapsado
- Bloco `if (collapsed) { ... ignore toggle ... }` no render do label/conteúdo: o chevron não aparece, o clique não faz nada (ou o handler vira no-op), e os itens permanecem visíveis (`max-h-[1000px]`).

## Não alterar
- Estilos existentes, classes Tailwind atuais, cores, tokens, ícones dos itens.
- Rotas, `NavLink`, permissões (`canSee`), badges, hooks (`useAlerts`, `useRequestBadge`, etc.).
- Componente `AppLayout` (apenas o `AppSidebar` interno).
- Qualquer arquivo fora de `src/components/AppLayout.tsx`.

## Detalhes técnicos
- Animação via `max-height` + `transition-all duration-200` + `overflow-hidden` (conforme solicitado).
- Rotação do chevron via `rotate-180` + `transition-transform duration-200`.
- Estado local (não persistido) — cada reload reinicia com todos os grupos expandidos.

## Goal
Add a live clock + date block to the global topbar (`AppLayout` header), positioned right after the brand/trigger area, separated by a subtle vertical divider. The topbar's existing right-side cluster (search, badges, email, theme, logout) stays untouched.

## Where it goes
The brand/logo lives inside the sidebar (`SidebarHeader`), so within the topbar itself the leftmost element is the `SidebarTrigger`. The new block is inserted in `src/components/AppLayout.tsx`, immediately after `<SidebarTrigger />` and before the existing `<div className="ml-auto ...">` cluster.

````text
[≡ trigger] | [ 14:32:07            ]   ........................  [search][badge][email][theme][logout]
            |  Quarta, 29 de abr. 2026
````

## Component
Create `src/components/TopbarClock.tsx` — a small self-contained client component:

- State: `now: Date`, initialized with `new Date()`.
- Effect: `setInterval(() => setNow(new Date()), 1000)`, cleared on unmount.
- Renders two stacked lines:
  - Line 1: `HH:MM:SS` — `font-size: 15px`, `color: #e0e0e0`, `font-weight: 500`, `tabular-nums`, monospace-friendly via `tabular-nums` + `font-variant-numeric`.
  - Line 2: e.g. `Quarta, 29 de abr. 2026` — `font-size: 11px`, `color: #888`, capitalized weekday.
- Localization: built manually with PT-BR arrays for full weekday names and abbreviated months (matching the requested format `"Quarta, 29 de abr. 2026"`), so we don't depend on locale availability:
  - Weekdays: `["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"]`
  - Months (abbr.): `["jan.","fev.","mar.","abr.","mai.","jun.","jul.","ago.","set.","out.","nov.","dez."]`
  - Day zero-padded with `String(d).padStart(2,"0")`.

## Topbar integration
In `src/components/AppLayout.tsx`, inside the existing `<header>`:

1. Keep `<SidebarTrigger />` as-is.
2. Add a vertical divider `<div>` right after it: `1px` wide, `28px` tall, background `#2a2a2a`, with small horizontal margin (e.g. `mx-2`).
3. Add `<TopbarClock />` after the divider.
4. Leave the `ml-auto` right-side cluster unchanged so it stays flush right.

No other topbar element is modified. No changes to styling tokens, theme, or other pages.

## Notes
- Colors are hardcoded per spec (`#2a2a2a`, `#e0e0e0`, `#888`) instead of using design tokens, since the request is explicit.
- Block is always visible regardless of theme, matching the dark-style values requested.
- No new dependencies.

## Files touched
- `src/components/TopbarClock.tsx` (new)
- `src/components/AppLayout.tsx` (insert divider + `<TopbarClock />` after `<SidebarTrigger />`)

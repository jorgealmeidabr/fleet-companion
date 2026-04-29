# Indicador "Voz Ativa" na página de Veículos

Adicionar um componente flutuante fixo no canto inferior direito da página **Veículos** que aparece somente enquanto o navegador está falando (Web Speech API), exibindo barras animadas + o texto que está sendo falado.

## Comportamento

- Posição: `position: fixed; bottom: 24px; right: 24px; z-index: 50`.
- Visibilidade controlada por polling de `window.speechSynthesis`:
  - `setInterval` a cada **300ms** verifica `speechSynthesis.speaking`.
  - Quando passa para `true` → monta com animação `fadeIn`.
  - Quando passa para `false` → animação `fadeOut` (~250ms) e desmonta.
- Texto falado: capturado via `SpeechSynthesisUtterance.text` do utterance atual.
  - Como a Web Speech API não expõe diretamente o utterance ativo, faremos um *light wrap* somente leitura: um `useEffect` faz monkey-patch de `speechSynthesis.speak` para guardar o último `utterance.text` em uma ref/módulo (`window.__lastSpokenText`). Isso não altera nenhuma lógica existente — apenas observa.
  - O polling lê esse valor enquanto `speaking === true`.

## Visual

Container:
- Fundo `#1a1a1a`, borda `1px solid #EF9F27`, `border-radius: 12px`, `padding: 10px 16px`.
- Sombra suave para destacar do fundo.
- Layout flex horizontal: [barras] · [bloco de texto].

Equalizer (esquerda):
- 7 barras verticais, `width: 3px`, `border-radius: 2px`, `background: #EF9F27`.
- Alturas base variando (ex.: 10, 16, 22, 18, 14, 20, 12 px).
- Animação CSS `voice-bounce` 0.8s `infinite ease-in-out` com `scaleY` entre `1` e `0.3`.
- `animation-delay` distinto por barra (ex.: 0s, 0.1s, 0.2s, 0.05s, 0.15s, 0.25s, 0.1s) para efeito orgânico.

Bloco direito:
- Linha 1: ponto circular **7px** âmbar piscando (`@keyframes voice-blink`, opacity 1↔0.3, 1s infinite) + texto **"Frota"** em `font-size: 11px`, cor `#EF9F27`.
- Linha 2: texto sendo falado em `font-size: 12px`, cor `#e0e0e0`, com `max-width` ~280px, `white-space: nowrap`, `overflow: hidden`, `text-overflow: ellipsis`.

## Detalhes técnicos

**Arquivos a alterar:**

1. `src/index.css` — adicionar:
   - `@keyframes voice-bounce` (`transform: scaleY(1)` ↔ `scaleY(0.3)`).
   - `@keyframes voice-blink` (opacity 1 ↔ 0.3).
   - `@keyframes voice-fade-in` / `voice-fade-out` (opacity + translateY 8px).
   - Classes utilitárias `.voice-indicator`, `.voice-indicator__bar`, `.voice-indicator__dot`, `.voice-indicator__label`, `.voice-indicator__text` com os estilos descritos.

2. `src/components/VoiceActiveIndicator.tsx` (novo):
   - Componente cliente isolado.
   - `useState<{ visible: boolean; text: string }>`.
   - `useEffect` que:
     - Faz monkey-patch único de `speechSynthesis.speak` para registrar `utterance.text` em `(window as any).__lastSpokenText`.
     - Inicia `setInterval(300ms)`:
       - Se `speechSynthesis.speaking` e não visível → set `visible=true`, `text = window.__lastSpokenText ?? ""`.
       - Se não está falando e estava visível → dispara estado `closing` por 250ms (anim fadeOut), depois `visible=false`.
     - Cleanup: `clearInterval` (não desfaz patch, é idempotente e seguro).
   - Renderiza `null` quando não visível e não fechando.
   - Usa as classes do CSS para barras/ponto/texto. Renderiza 7 `<span class="voice-indicator__bar" style={{ animationDelay, height }} />`.

3. `src/pages/Veiculos.tsx`:
   - Importar `VoiceActiveIndicator`.
   - Renderizar `<VoiceActiveIndicator />` ao final do JSX retornado pela página (irmão do conteúdo principal). Nenhuma outra alteração.

## Acessibilidade

- Container com `role="status"` e `aria-live="polite"` para que leitores de tela anunciem o texto falado uma vez (texto curto, sem ruído).
- Ponto/barras com `aria-hidden="true"`.

## Fora de escopo

- Não alterar nenhuma chamada existente a `speechSynthesis.speak` na aplicação.
- Não tocar em outros componentes da topbar, do feed ou da tabela de veículos.
- Sem bibliotecas externas; apenas CSS + React.

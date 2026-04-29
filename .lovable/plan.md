# Sincronizar texto do indicador de voz em tempo real

Hoje o `VoiceActiveIndicator` faz polling de `speechSynthesis.speaking` e exibe um texto estático (capturado no momento do `speak`). Vamos trocar para um modelo orientado a eventos que acompanha palavra-a-palavra a fala atual.

## Mudanças

### 1. `src/components/VoiceActiveIndicator.tsx` (reescrita do hook de captura)

Substituir o monkey-patch atual por um patch que injeta handlers em cada `SpeechSynthesisUtterance` antes de delegar ao `speak` original. Cada utterance terá:

- **`onstart`** → dispara um `CustomEvent('voice-indicator-update')` com `{ active: true, text, charIndex: 0, charLength: 0 }`. Componente fica visível e mostra o texto completo em branco.
- **`onboundary`** → quando `e.name === 'word'` (ou indefinido), lê `e.charIndex` e `e.charLength`. Se `charLength` for 0 (Chrome/Safari às vezes não preenche), faz fallback derivando o tamanho da palavra atual via regex `/^\S+/` aplicada a `text.slice(charIndex)`. Dispara update com a palavra atual destacada.
- **`onend`** e **`onerror`** → dispara `{ active: false, ... }`. Componente esconde com fadeOut (250ms).

Os handlers preservam handlers prévios (chamando `prev?.call(utterance, e)`) para não interferir com lógica existente.

O componente React:
- Remove o `setInterval` de 300ms.
- Escuta o `CustomEvent` no `window` e atualiza `useState<{ active, text, charIndex, charLength }>`.
- Mantém o estado `closing` para a animação de fadeOut existente.
- Ao renderizar o texto, divide em três spans: `before` (branco), `current` (destacado em âmbar `#EF9F27`), `after` (branco).

### 2. `src/index.css`

Adicionar uma única regra junto de `.voice-indicator__text`:

```
.voice-indicator__highlight {
  color: #EF9F27;
  font-weight: 600;
  transition: color 0.1s ease;
}
```

## Compatibilidade e fora de escopo

- O patch de `speechSynthesis.speak` continua idempotente (`patched` global) — não altera nenhuma chamada existente.
- Handlers prévios definidos pelo chamador são preservados.
- Sem mudanças em `Veiculos.tsx` nem em qualquer outro consumidor de voz.
- O texto continua truncado por `text-overflow: ellipsis` na CSS atual; não vamos alterar o layout, apenas a cor da palavra atual.

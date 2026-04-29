## Ajustes no sistema de voz da página Veículos (admin)

Refinar o efeito de narração em `src/pages/Veiculos.tsx` para: (a) ler todos os veículos em sequência ao entrar na página, (b) fazer polling a cada 15s buscando status atualizado, e (c) só falar quando o status efetivo mudar em relação ao último lido.

### Comportamento

- **Entrada na página (admin):** enfileirar uma narração por veículo, na ordem de `rowsEfetivos`, usando as frases já definidas:
  - Disponível: "O veículo {MODELO}, placa {PLACA}, está disponível."
  - Reservado: "O veículo {MODELO}, placa {PLACA}, foi reservado pelo condutor {NOME}."
  - Em uso: "O veículo {MODELO}, placa {PLACA}, está em uso pelo condutor {NOME}."
  - Apenas status `disponivel | reservado | em_uso` são narrados (ignorar `manutencao`/`inativo`).
  - Como `speechSynthesis.speak` já enfileira utterances nativamente, basta chamar `speak(...)` em loop — o navegador toca uma após a outra.

- **Polling 15s:** novo `setInterval` que recarrega `agendamentos` ativos (mesma query de hoje) e dispara recomputação. O canal realtime continua existindo para reagir mais rápido a mudanças, mas o polling garante o ciclo de 15s pedido.

- **Anti-repetição:** manter `prevStatusRef: Map<veiculoId, status>`. Só falar quando `status !== prev`. Após falar (ou na inicialização, antes do primeiro lote), atualizar o map com o status atual.

- **Inicialização vs. mudança:**
  - Hoje o efeito popula o ref no primeiro tick e **não fala nada**. Mudar para: no primeiro tick, falar a frase de cada veículo (status relevante) e popular o ref.
  - Em ticks subsequentes, falar só dos veículos cujo status mudou.

### Mudanças técnicas (arquivo único)

**`src/pages/Veiculos.tsx`**

1. **Polling 15s para agendamentos ativos**
   - Extrair a função `load()` do `useEffect` atual para escopo do componente (ou manter dentro e adicionar um segundo `setInterval`).
   - Adicionar `setInterval(load, 15_000)` ao lado do canal realtime, com cleanup.

2. **Efeito de voz — substituir lógica de inicialização**
   - Remover o early-return que apenas popula o ref na primeira execução.
   - Novo fluxo:
     ```ts
     for (const v of rowsEfetivos) {
       const status = v.status as string;
       if (!relevantes.has(status)) { prev.set(v.id, status); continue; }
       const anterior = prev.get(v.id);
       if (anterior === status) continue;             // anti-repetição
       const frase = montarFrase(v, status, agendamentosAtivos.get(v.id));
       if (frase) speak(frase);
       prev.set(v.id, status);
     }
     ```
   - Na primeira execução (`!initializedRef.current`), `prev` está vazio → todos os veículos relevantes são falados em sequência (atende ao requisito 1). Depois marca `initializedRef.current = true`.
   - Em execuções seguintes (disparadas por polling/realtime/tick), só fala os que mudaram (atende aos requisitos 2 e 3).

3. **Sem mudanças** em UI, badges, filtros, helper `speak`, ou idioma (`pt-BR` mantido).

### Diagrama

```text
mount (admin)
  │
  ▼
load() agendamentos ativos ──► rowsEfetivos
  │
  ▼
efeito de voz: prev vazio → fala todos (em sequência via fila do speechSynthesis)
  │
  ▼
setInterval 15s → load() → rowsEfetivos recomputa
  │
  ▼
efeito de voz: para cada v, status ≠ prev[v.id]? → fala só esse  → prev[v.id] = status
```

### Casos cobertos
- Entrada na página: narra todos os veículos relevantes em ordem.
- Mudança detectada via polling 15s ou realtime: narra apenas o(s) veículo(s) alterado(s).
- Status inalterado: silêncio (regra anti-repetição).
- Não-admin: efeito sai imediatamente, nenhum áudio.
- `manutencao`/`inativo`: não narrados, mas registrados no ref para evitar narração ao transitar de volta sem mudança real.

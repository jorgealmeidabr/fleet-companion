# Notificações por voz na página de Veículos (admin)

Adicionar narração automática via Web Speech API (`speechSynthesis`) na página `/veiculos` sempre que o status efetivo de um veículo mudar. Apenas admins ouvem.

## Comportamento

Frases (pt-BR), com substituição dos dados reais do agendamento ativo:

- Reservado: "O veículo {MODELO}, placa {PLACA}, foi reservado pelo condutor {NOME DO MOTORISTA}."
- Em uso: "O veículo {MODELO}, placa {PLACA}, está em uso pelo condutor {NOME DO MOTORISTA}."
- Disponível: "O veículo {MODELO}, placa {PLACA}, está disponível."

Regras:
- Toca somente quando o status mudar em relação ao último estado conhecido daquele veículo.
- Nunca repete para o mesmo status do mesmo veículo.
- Não fala em outros status (manutencao, inativo) — apenas nas três transições acima.
- Sem áudio externo — apenas `window.speechSynthesis` com `SpeechSynthesisUtterance` (`lang = "pt-BR"`).
- Visível/audível apenas para `isAdmin`.

## Mudanças técnicas (arquivo único)

**`src/pages/Veiculos.tsx`**

1. Criar um `useRef<Map<string, string>>` (`prevStatusRef`) para guardar o último status falado por `veiculo.id`.
2. Criar helper local `speak(texto: string)`:
   - Sai cedo se `!isAdmin` ou `typeof window === "undefined"` ou `!("speechSynthesis" in window)`.
   - `const u = new SpeechSynthesisUtterance(texto); u.lang = "pt-BR"; u.rate = 1; window.speechSynthesis.speak(u);`
3. Adicionar `useEffect` que depende de `[rowsEfetivos, agendamentosAtivos, isAdmin]`:
   - Para cada `v` em `rowsEfetivos`, considerar apenas status `disponivel | reservado | em_uso`.
   - Comparar com `prevStatusRef.current.get(v.id)`.
   - Inicialização: na primeira execução, popular o ref sem falar (evita disparar narração para o estado já existente ao carregar a página). Usar uma flag `initializedRef` (boolean).
   - Em mudanças subsequentes: montar a frase usando `v.modelo`, `v.placa` e `agendamentosAtivos.get(v.id)?.motoristaNome ?? ""` (para reservado/em_uso). Chamar `speak(frase)` e atualizar o ref.
4. Não introduzir nenhuma UI nova — apenas o efeito colateral sonoro.

## Diagrama de fluxo

```text
rowsEfetivos muda
   │
   ▼
para cada veículo:
   status atual ≠ status anterior?
        │ sim                          │ não
        ▼                              ▼
   isAdmin? ──não──► ignora        nada
        │ sim
        ▼
   monta frase (Disponível/Reservado/Em uso)
        │
        ▼
   speechSynthesis.speak(utterance pt-BR)
        │
        ▼
   prevStatusRef.set(id, novoStatus)
```

## Casos cobertos
- Mudança via realtime (canal já existente em `agendamentos`) → `rowsEfetivos` recomputa → efeito dispara.
- Transição automática `reservado → em_uso` pelo tick de 60s → também dispara (mudou o status efetivo).
- Carregamento inicial da página: não fala nada (apenas registra o baseline).
- Não-admin: efeito sai imediatamente, nenhuma fala ocorre.

Execute o plano abaixo exatamente como descrito, **sem alterar layout, estilos, rotas, autenticação, componentes visuais ou** `Veiculos.tsx`.

---

**1. Migration SQL —** `supabase_setup/17_migration_v10_agendamentos_30min.sql` **(novo arquivo)**

Reescrever a função `check_agendamento_conflito` usada pelo trigger `agendamentos_block_overlap` para calcular o fim da reserva existente como:

sql

```sql
reserva_fim = COALESCE(data_retorno_real, data_saida + interval '30 minutes')
```

Isso permite criar novo agendamento após os 30min estimados, mesmo sem devolução física. Não alterar schema, policies nem outros triggers.

---

**2.** `src/pages/Agendamentos.tsx` **— apenas a função** `iniciarUso`

Antes de prosseguir com o início do uso, consultar em tempo real se existe agendamento anterior do mesmo veículo ainda não devolvido:

ts

```ts
const { data: pend } = await supabase
  .from("agendamentos")
  .select("id")
  .eq("veiculo_id", a.veiculo_id)
  .neq("id", a.id)
  .is("data_retorno_real", null)
  .in("status", ["ativo"])
  .lt("data_saida", a.data_saida)
  .limit(1);
if (pend && pend.length > 0) {
  toast({ title: "O outro condutor ainda não devolveu o veículo.", variant: "destructive" });
  return;
}
```

Somente após essa verificação prosseguir com o fluxo atual (`update km_atual` + toast). Não alterar devolução, cálculo de 30min nem nenhum outro trecho.

---

**3.** `src/hooks/useTable.ts` **— polling de 10s**

Dentro do hook, adicionar intervalo que chama `reload` a cada 10 segundos:

ts

```ts
useEffect(() => {
  reload();
  const id = setInterval(reload, 10_000);
  return () => clearInterval(id);
}, [table]);
```

Não alterar a assinatura do hook nem criar novos componentes.

---

**4.** `src/pages/Dashboard.tsx` **/** `src/pages/Index.tsx` **— polling de 10s**

Adicionar `setInterval` de 10 segundos para refazer as queries existentes (sem reload de página). Não alterar layout nem lógica de exibição.

---

**5.** `src/pages/VeiculoDetalhe.tsx`**,** `src/pages/MotoristaDetalhe.tsx`**,** `src/pages/AcidenteDetalhe.tsx` **— polling de 10s**

Adicionar `setInterval` de 10 segundos para refazer as queries existentes de cada página. Não alterar layout nem lógica de exibição.

---

`Veiculos.tsx` **não deve ser tocada** — já possui realtime + polling próprio de 15s.
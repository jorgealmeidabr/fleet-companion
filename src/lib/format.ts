export const TZ_SP = "America/Sao_Paulo";

export const fmtBRL = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtNumber = (n: number | null | undefined, opts?: Intl.NumberFormatOptions) =>
  (n ?? 0).toLocaleString("pt-BR", opts);

export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { timeZone: TZ_SP });
};

export const fmtDateTime = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("pt-BR", { timeZone: TZ_SP });
};

export const fmtDateTimeShort = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: TZ_SP,
  });
};

// "Agora" interpretado em horário de Brasília. Usar APENAS para exibição
// ou cálculos visuais — nunca gravar no banco (campos timestamptz esperam UTC).
export const nowSP = () =>
  new Date(new Date().toLocaleString("en-US", { timeZone: TZ_SP }));

// Compatibilidade entre categoria de CNH do motorista e a exigida pelo veículo.
// Veículo exige 'A', 'B' ou 'AB' (AB = qualquer uma serve).
// Motorista pode ter categorias compostas (ex.: "AB", "AD", "ACC", "BE").

export type CnhVeiculo = "A" | "B" | "AB";

const letrasUteis = (cat: string | null | undefined): Set<string> => {
  const s = new Set<string>();
  if (!cat) return s;
  for (const ch of cat.toUpperCase()) {
    if (ch === "A" || ch === "B") s.add(ch);
  }
  return s;
};

export function cnhPermite(
  cnhMotorista: string | null | undefined,
  cnhVeiculo: string | null | undefined,
): boolean {
  const exigida = (cnhVeiculo ?? "B").toUpperCase();
  const tem = letrasUteis(cnhMotorista);
  if (exigida === "AB") return tem.has("A") || tem.has("B");
  if (exigida === "A") return tem.has("A");
  if (exigida === "B") return tem.has("B");
  return true;
}

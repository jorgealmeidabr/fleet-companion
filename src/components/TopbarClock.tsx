import { useEffect, useState } from "react";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MONTHS_ABBR = [
  "jan.", "fev.", "mar.", "abr.", "mai.", "jun.",
  "jul.", "ago.", "set.", "out.", "nov.", "dez.",
];

const pad = (n: number) => String(n).padStart(2, "0");

export function TopbarClock() {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const dateLine = `${WEEKDAYS[now.getDay()]}, ${pad(now.getDate())} de ${MONTHS_ABBR[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <div className="flex flex-col leading-tight" aria-label="Data e hora atuais">
      <span
        className="tabular-nums"
        style={{ fontSize: "15px", color: "#e0e0e0", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}
      >
        {time}
      </span>
      <span style={{ fontSize: "11px", color: "#888" }}>{dateLine}</span>
    </div>
  );
}

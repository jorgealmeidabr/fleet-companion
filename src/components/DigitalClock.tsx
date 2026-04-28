import { useEffect, useState } from "react";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const pad = (n: number) => n.toString().padStart(2, "0");

export function DigitalClock() {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  const dataStr = `${DIAS[now.getDay()]} ${pad(now.getDate())} ${MESES[now.getMonth()]}`;

  return (
    <div
      className="flex flex-col items-end rounded-md border border-amber-500 px-2 py-1 font-mono leading-none"
      style={{ backgroundColor: "#111" }}
      aria-label="Relógio digital"
    >
      <div className="flex items-baseline gap-1 text-amber-500">
        <span style={{ fontSize: "22px" }} className="font-bold tabular-nums">
          {hh}:{mm}
        </span>
        <span className="text-xs tabular-nums">{ss}</span>
      </div>
      <span className="mt-0.5 text-[10px] uppercase tracking-wider text-amber-500">
        {dataStr}
      </span>
    </div>
  );
}

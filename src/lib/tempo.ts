export function formatSegundos(totalSegundos: number | null | undefined): string {
  if (totalSegundos === null || totalSegundos === undefined || Number.isNaN(totalSegundos)) return "—";
  const total = Math.max(Math.round(totalSegundos), 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/** Horas com 1 casa, para carga de máquina (ex.: "12,5 h"). */
export function formatHoras(totalSegundos: number): string {
  return `${(totalSegundos / 3600).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
}

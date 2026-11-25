import type { StatusInspecaoLinha, TurnoInspecaoLinha } from "@/types/database";

/** Turno calculado pelo horário em São Paulo: manhã 06–14h, tarde 14–22h, noite 22–06h. */
export function turnoAtual(data: Date = new Date()): TurnoInspecaoLinha {
  const hora = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(data)
  );
  if (hora >= 6 && hora < 14) return "manha";
  if (hora >= 14 && hora < 22) return "tarde";
  return "noite";
}

export const TURNO_LABEL: Record<TurnoInspecaoLinha, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

export const TURNO_CLASS: Record<TurnoInspecaoLinha, string> = {
  manha: "bg-sky-100 text-sky-700",
  tarde: "bg-amber-100 text-amber-700",
  noite: "bg-indigo-100 text-indigo-700",
};

export const STATUS_INSPECAO_LABEL: Record<StatusInspecaoLinha, string> = {
  ok: "OK",
  nao_ok: "Não OK",
  parada: "Parada",
};

export const STATUS_INSPECAO_CLASS: Record<StatusInspecaoLinha, string> = {
  ok: "bg-emerald-100 text-emerald-800 border-emerald-300",
  nao_ok: "bg-red-100 text-red-800 border-red-300",
  parada: "bg-slate-200 text-slate-700 border-slate-300",
};

/** Em dia = teve inspeção dessa máquina há menos de 1h. */
export function inspecaoEmDia(ultimaCreatedAt: string | null): boolean {
  if (!ultimaCreatedAt) return false;
  return Date.now() - new Date(ultimaCreatedAt).getTime() < 60 * 60 * 1000;
}

export function minutosDesde(iso: string): number {
  return Math.round((Date.now() - new Date(iso).getTime()) / 60000);
}

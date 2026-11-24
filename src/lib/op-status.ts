import type { StatusOP, StatusPreparo } from "@/types/database";

export const STATUS_LABEL: Record<StatusOP, string> = {
  planejada: "Planejada",
  aberta: "Liberada",
  setup: "Setup",
  em_producao: "Em produção",
  parada: "Parada",
  concluida: "Concluída",
};

export const STATUS_BADGE_CLASS: Record<StatusOP, string> = {
  planejada: "bg-amber-100 text-amber-800",
  aberta: "bg-emerald-100 text-emerald-800",
  setup: "bg-sky-100 text-sky-700",
  em_producao: "bg-green-100 text-green-700",
  parada: "bg-red-100 text-red-700",
  concluida: "bg-brand-100 text-brand-700",
};

/** Itens da preparação da OP (o "kit" que precisa estar pronto antes de liberar). */
export const PREPARO_ITENS = [
  { campo: "material_status", label: "Material", sigla: "M" },
  { campo: "ferramenta_status", label: "Ferramenta", sigla: "F" },
  { campo: "dispositivo_status", label: "Dispositivo", sigla: "D" },
  { campo: "programa_status", label: "Programa", sigla: "P" },
] as const;

export type CampoPreparo = (typeof PREPARO_ITENS)[number]["campo"];

export const PREPARO_LABEL: Record<StatusPreparo, string> = {
  pendente: "Pendente",
  aguardando: "Aguardando",
  ok: "OK",
  na: "Não se aplica",
};

export const PREPARO_CLASS: Record<StatusPreparo, string> = {
  pendente: "bg-red-100 text-red-700 border-red-200",
  aguardando: "bg-amber-100 text-amber-800 border-amber-200",
  ok: "bg-emerald-100 text-emerald-800 border-emerald-200",
  na: "bg-slate-100 text-slate-500 border-slate-200",
};

export function preparoCompleto(op: Record<CampoPreparo, StatusPreparo>): boolean {
  return PREPARO_ITENS.every((i) => op[i.campo] === "ok" || op[i.campo] === "na");
}

export function preparoPendencias(op: Record<CampoPreparo, StatusPreparo>): string[] {
  return PREPARO_ITENS.filter((i) => op[i.campo] === "pendente" || op[i.campo] === "aguardando").map(
    (i) => i.label
  );
}

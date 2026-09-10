import type { StatusOP } from "@/types/database";

export const STATUS_LABEL: Record<StatusOP, string> = {
  aberta: "Aberta",
  em_producao: "Em produção",
  parada: "Parada",
  concluida: "Concluída",
};

export const STATUS_BADGE_CLASS: Record<StatusOP, string> = {
  aberta: "bg-slate-100 text-slate-600",
  em_producao: "bg-green-100 text-green-700",
  parada: "bg-red-100 text-red-700",
  concluida: "bg-blue-100 text-blue-700",
};

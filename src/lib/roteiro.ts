import type { TipoEtapa } from "@/types/database";

export const TIPO_ETAPA_LABEL: Record<TipoEtapa, string> = {
  manual: "Manual",
  maquina: "Máquina (2ª operação)",
  externo: "Tratamento externo",
  inspecao: "Inspeção de qualidade",
};

export const TIPO_ETAPA_CLASS: Record<TipoEtapa, string> = {
  manual: "bg-slate-100 text-slate-700",
  maquina: "bg-sky-100 text-sky-700",
  externo: "bg-amber-100 text-amber-800",
  inspecao: "bg-violet-100 text-violet-700",
};

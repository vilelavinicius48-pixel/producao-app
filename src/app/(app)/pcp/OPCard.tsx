import Link from "next/link";
import { moverNaFila } from "./actions";
import {
  PREPARO_CLASS,
  PREPARO_ITENS,
  PREPARO_LABEL,
  STATUS_BADGE_CLASS,
  STATUS_LABEL,
} from "@/lib/op-status";
import { formatData, formatQtd } from "@/lib/pcp/carteira";
import type { StatusOP, StatusPreparo } from "@/types/database";

export type OPQuadro = {
  id: string;
  numero: number;
  status: StatusOP;
  maquina_id: string;
  sequencia: number | null;
  quantidade_planejada: number;
  created_at: string;
  material_status: StatusPreparo;
  ferramenta_status: StatusPreparo;
  dispositivo_status: StatusPreparo;
  programa_status: StatusPreparo;
  previsao_material: string | null;
  pecas: { codigo: string; descricao: string; tempo_padrao_segundos: number | null } | null;
  pedido_itens: { cliente: string; data_entrega: string; numero_pedido: string } | null;
};

export function OPCard({
  op,
  produzido,
  hoje,
  destaque,
  podeMover,
  primeiro,
  ultimo,
}: {
  op: OPQuadro;
  produzido: number;
  hoje: string;
  destaque?: "proxima" | "atual";
  podeMover: boolean;
  primeiro?: boolean;
  ultimo?: boolean;
}) {
  const atrasado = op.pedido_itens && op.pedido_itens.data_entrega < hoje;
  const naoPronta = destaque === "proxima" && op.status === "planejada";

  return (
    <div
      className={`rounded-lg border bg-white p-2.5 text-sm ${
        destaque === "atual"
          ? "border-green-300 bg-green-50/50"
          : naoPronta
            ? "border-red-300"
            : destaque === "proxima"
              ? "border-emerald-300"
              : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/ordens/${op.numero}`} className="min-w-0 hover:underline">
          <span className="font-semibold text-slate-900">OP {op.numero}</span>{" "}
          <span className="text-slate-700">{op.pecas?.codigo}</span>
          <span className="block truncate text-xs text-slate-500">{op.pecas?.descricao}</span>
        </Link>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE_CLASS[op.status]}`}>
          {STATUS_LABEL[op.status]}
        </span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
        <span>
          {produzido > 0 ? `${formatQtd(produzido)} / ` : ""}
          {formatQtd(Number(op.quantidade_planejada))} pç
        </span>
        {op.pedido_itens && (
          <span className={atrasado ? "font-semibold text-red-700" : ""}>
            Entrega {formatData(op.pedido_itens.data_entrega)}
          </span>
        )}
        {op.pedido_itens && <span className="truncate">{op.pedido_itens.cliente.split(" ")[0]}</span>}
      </div>

      {(op.status === "planejada" || op.status === "aberta") && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {PREPARO_ITENS.map((i) => (
              <span
                key={i.campo}
                title={`${i.label}: ${PREPARO_LABEL[op[i.campo]]}${
                  i.campo === "material_status" && op.previsao_material
                    ? ` (previsão ${formatData(op.previsao_material)})`
                    : ""
                }`}
                className={`inline-flex h-6 w-6 items-center justify-center rounded border text-[11px] font-bold ${
                  PREPARO_CLASS[op[i.campo]]
                }`}
              >
                {i.sigla}
              </span>
            ))}
          </div>
          {podeMover && (
            <div className="flex gap-1">
              {!primeiro && (
                <form action={moverNaFila}>
                  <input type="hidden" name="op_id" value={op.id} />
                  <input type="hidden" name="direcao" value="subir" />
                  <button
                    type="submit"
                    aria-label="Subir na fila"
                    className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-100"
                  >
                    ↑
                  </button>
                </form>
              )}
              {!ultimo && (
                <form action={moverNaFila}>
                  <input type="hidden" name="op_id" value={op.id} />
                  <input type="hidden" name="direcao" value="descer" />
                  <button
                    type="submit"
                    aria-label="Descer na fila"
                    className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-100"
                  >
                    ↓
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}
      {naoPronta && <p className="mt-1.5 text-xs font-semibold text-red-700">Próxima ainda não está pronta</p>}
    </div>
  );
}

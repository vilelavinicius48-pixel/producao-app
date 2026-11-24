import Link from "next/link";
import { excluirOPPlanejada, salvarPreparo, trocarMaquina } from "@/app/(app)/pcp/actions";
import { PREPARO_ITENS, PREPARO_LABEL, preparoCompleto, type CampoPreparo } from "@/lib/op-status";
import { formatData, formatQtd } from "@/lib/pcp/carteira";
import type { OrdemProducao, StatusPreparo } from "@/types/database";

const OPCOES: StatusPreparo[] = ["pendente", "aguardando", "ok", "na"];

export function PreparoPanel({
  op,
  maquinas,
  pedido,
}: {
  op: OrdemProducao;
  maquinas: { id: string; codigo: string }[];
  pedido: { cliente: string; numero_pedido: string; data_entrega: string; quantidade: number } | null;
}) {
  const editavel = op.status === "planejada" || (op.status === "aberta" && !op.setup_concluido_em);
  const completo = preparoCompleto(op as Record<CampoPreparo, StatusPreparo>);

  return (
    <div className="mt-6 rounded-xl border border-amber-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Preparação (PCP)</h2>
        {pedido && (
          <p className="text-xs text-slate-600">
            Pedido {pedido.numero_pedido} · {pedido.cliente} · {formatQtd(Number(pedido.quantidade))} pç · entrega{" "}
            {formatData(pedido.data_entrega)}
          </p>
        )}
      </div>

      {editavel ? (
        <form action={salvarPreparo} className="mt-3 space-y-3">
          <input type="hidden" name="op_id" value={op.id} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {PREPARO_ITENS.map((i) => (
              <label key={i.campo} className="text-sm">
                <span className="mb-1 block font-medium text-slate-700">{i.label}</span>
                <select
                  name={i.campo}
                  defaultValue={op[i.campo]}
                  className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                >
                  {OPCOES.map((o) => (
                    <option key={o} value={o}>
                      {PREPARO_LABEL[o]}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr]">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Previsão do material</span>
              <input
                type="date"
                name="previsao_material"
                defaultValue={op.previsao_material ?? ""}
                className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Observação</span>
              <input
                name="obs_pcp"
                defaultValue={op.obs_pcp ?? ""}
                placeholder="Ex.: falta fresa Ø3, dispositivo na retífica…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              name="acao"
              value="salvar"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Salvar
            </button>
            {op.status === "planejada" && (
              <button
                type="submit"
                name="acao"
                value="liberar"
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                title="Todos os itens precisam estar OK ou Não se aplica"
              >
                Salvar e liberar para produção
              </button>
            )}
            {op.status === "aberta" && (
              <button
                type="submit"
                name="acao"
                value="voltar"
                className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50"
              >
                Voltar para planejada
              </button>
            )}
          </div>
          {op.status === "planejada" && !completo && (
            <p className="text-xs text-slate-500">
              Para liberar, deixe todos os itens como OK ou Não se aplica.
            </p>
          )}
        </form>
      ) : (
        <p className="mt-2 text-sm text-slate-600">
          {PREPARO_ITENS.map((i) => `${i.label}: ${PREPARO_LABEL[op[i.campo]]}`).join(" · ")}
        </p>
      )}

      {editavel && (
        <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-slate-100 pt-3">
          <form action={trocarMaquina} className="flex items-end gap-2">
            <input type="hidden" name="op_id" value={op.id} />
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Máquina</span>
              <select name="maquina_id" defaultValue={op.maquina_id} className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
                {maquinas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.codigo}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Trocar máquina
            </button>
          </form>
          <Link href="/pcp/programacao" className="pb-2 text-sm text-brand-600 hover:underline">
            Ver fila das máquinas
          </Link>
          {op.status === "planejada" && (
            <form action={excluirOPPlanejada} className="ml-auto">
              <input type="hidden" name="op_id" value={op.id} />
              <button type="submit" className="pb-2 text-sm font-medium text-red-600 hover:underline">
                Excluir OP
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

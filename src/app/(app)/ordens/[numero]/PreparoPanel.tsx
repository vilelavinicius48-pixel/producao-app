"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  excluirOPPlanejada,
  recalcularMaterialAutomaticoOP,
  salvarPreparo,
  trocarMaquina,
  type EstadoPreparo,
} from "@/app/(app)/pcp/actions";
import { PREPARO_CLASS, PREPARO_ITENS, PREPARO_LABEL, preparoCompleto, type CampoPreparo } from "@/lib/op-status";
import { formatData, formatQtd } from "@/lib/pcp/carteira";
import type { OrdemProducao, StatusPreparo } from "@/types/database";

const OPCOES: StatusPreparo[] = ["pendente", "aguardando", "ok", "na"];
const ESTADO_INICIAL: EstadoPreparo = {};
const OUTROS_ITENS = PREPARO_ITENS.filter((i) => i.campo !== "material_status");

export function PreparoPanel({
  op,
  maquinas,
  pedido,
  materialInfo,
}: {
  op: OrdemProducao;
  maquinas: { id: string; codigo: string; nome: string }[];
  pedido: { cliente: string; numero_pedido: string; data_entrega: string; quantidade: number } | null;
  materialInfo: { label: string; unidade: "m" | "folhas"; necessidade: number | null; barras: number | null } | null;
}) {
  const editavel = op.status === "planejada" || (op.status === "aberta" && !op.setup_concluido_em);
  const [preparo, setPreparo] = useState<Record<CampoPreparo, StatusPreparo>>(() => {
    const inicial = {} as Record<CampoPreparo, StatusPreparo>;
    for (const item of PREPARO_ITENS) inicial[item.campo] = op[item.campo];
    return inicial;
  });
  const [editandoMaterial, setEditandoMaterial] = useState(op.material_status_manual);
  const completo = preparoCompleto(preparo);
  const [estado, formAction, pendente] = useActionState(salvarPreparo, ESTADO_INICIAL);
  const [estadoMaquina, trocarMaquinaAction, trocandoMaquina] = useActionState(trocarMaquina, ESTADO_INICIAL);

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
        <form action={formAction} className="mt-3 space-y-3">
          <input type="hidden" name="op_id" value={op.id} />
          <input type="hidden" name="material_manual" value={editandoMaterial ? "true" : "false"} />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="text-sm">
              <span className="mb-1 flex items-center justify-between font-medium text-slate-700">
                Material
                {!editandoMaterial && (
                  <button type="button" onClick={() => setEditandoMaterial(true)} className="text-xs font-normal text-brand-600 hover:underline">
                    editar
                  </button>
                )}
              </span>
              {editandoMaterial ? (
                <select
                  name="material_status"
                  value={preparo.material_status}
                  onChange={(e) => setPreparo((p) => ({ ...p, material_status: e.target.value as StatusPreparo }))}
                  className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                >
                  {OPCOES.map((o) => (
                    <option key={o} value={o}>
                      {PREPARO_LABEL[o]}
                    </option>
                  ))}
                </select>
              ) : (
                <span
                  className={`flex h-[38px] items-center rounded-lg border px-2 text-sm ${PREPARO_CLASS[op.material_status]}`}
                  title="Calculado automaticamente a partir do estoque e dos pedidos de compra de material"
                >
                  {PREPARO_LABEL[op.material_status]}
                  {op.material_status === "aguardando" && op.previsao_material && ` (previsão ${formatData(op.previsao_material)})`}
                </span>
              )}
            </div>
            {OUTROS_ITENS.map((i) => (
              <label key={i.campo} className="text-sm">
                <span className="mb-1 block font-medium text-slate-700">{i.label}</span>
                <select
                  name={i.campo}
                  value={preparo[i.campo]}
                  onChange={(e) => setPreparo((p) => ({ ...p, [i.campo]: e.target.value as StatusPreparo }))}
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

          {materialInfo && (
            <p className="text-xs text-slate-500">
              Precisa de {materialInfo.label}: {formatQtd(Number(materialInfo.necessidade ?? 0))} {materialInfo.unidade}
              {materialInfo.barras !== null && ` (${materialInfo.barras} barra${materialInfo.barras > 1 ? "s" : ""})`}
              {op.material_status_manual && " · editado na mão, não recalcula sozinho"}
            </p>
          )}

          {editandoMaterial && (
            <label className="block text-sm sm:w-56">
              <span className="mb-1 block font-medium text-slate-700">Previsão do material</span>
              <input
                type="date"
                name="previsao_material"
                defaultValue={op.previsao_material ?? ""}
                className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
              />
            </label>
          )}

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Observação</span>
            <input
              name="obs_pcp"
              defaultValue={op.obs_pcp ?? ""}
              placeholder="Ex.: falta fresa Ø3, dispositivo na retífica…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              name="acao"
              value="salvar"
              disabled={pendente}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Salvar
            </button>
            {op.status === "planejada" && (
              <button
                type="submit"
                name="acao"
                value="liberar"
                disabled={pendente || !completo}
                title={completo ? "Liberar OP para produção" : "Deixe todos os itens como OK ou Não se aplica para liberar"}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Salvar e liberar para produção
              </button>
            )}
            {op.status === "aberta" && (
              <button
                type="submit"
                name="acao"
                value="voltar"
                disabled={pendente}
                className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Voltar para planejada
              </button>
            )}
            {op.material_status_manual && (
              <form action={recalcularMaterialAutomaticoOP}>
                <input type="hidden" name="op_id" value={op.id} />
                <button type="submit" className="text-xs font-medium text-slate-500 hover:underline">
                  Recalcular material automático
                </button>
              </form>
            )}
          </div>
          {op.status === "planejada" && !completo && (
            <p className="text-xs text-slate-500">Para liberar, deixe todos os itens como OK ou Não se aplica.</p>
          )}
          {estado.erro && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{estado.erro}</p>
          )}
        </form>
      ) : (
        <p className="mt-2 text-sm text-slate-600">
          {PREPARO_ITENS.map((i) => `${i.label}: ${PREPARO_LABEL[op[i.campo]]}`).join(" · ")}
        </p>
      )}

      {editavel && (
        <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-slate-100 pt-3">
          <form action={trocarMaquinaAction} className="flex items-end gap-2">
            <input type="hidden" name="op_id" value={op.id} />
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Máquina</span>
              <select name="maquina_id" defaultValue={op.maquina_id} className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
                {maquinas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={trocandoMaquina}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
      {estadoMaquina.erro && (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{estadoMaquina.erro}</p>
      )}
    </div>
  );
}

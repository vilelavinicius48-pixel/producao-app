import {
  atualizarPrevisaoPedido,
  cancelarPedidoCompraMaterial,
  criarPedidoCompraMaterial,
  marcarPedidoRecebido,
} from "../actions";
import { createClient } from "@/lib/supabase/server";
import { formatData, formatQtd, hojeISO } from "@/lib/pcp/carteira";
import { materialLabel, unidadeMaterial } from "@/lib/pcp/material";

export default async function ComprasMaterialPage() {
  const supabase = await createClient();
  const hoje = hojeISO();

  const [{ data: materiais }, { data: pedidos }] = await Promise.all([
    supabase.from("materiais").select("id, formato, tipo, medida_a_mm, medida_b_mm, espessura_mm").eq("ativo", true).order("tipo"),
    supabase
      .from("pedidos_compra_material")
      .select("*, materiais(formato, tipo, medida_a_mm, medida_b_mm, espessura_mm)")
      .order("status", { ascending: true })
      .order("previsao_chegada", { ascending: true, nullsFirst: false })
      .limit(200),
  ]);

  const abertos = (pedidos ?? []).filter((p) => p.status === "pedido");
  const fechados = (pedidos ?? []).filter((p) => p.status !== "pedido");

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Compras de material</h1>
      <p className="mt-1 text-sm text-slate-600">
        Registre o pedido de compra; quando o material chegar, marque como recebido para entrar no estoque.
      </p>

      <form action={criarPedidoCompraMaterial} className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Material</label>
          <select name="material_id" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {(materiais ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {materialLabel(m)} ({unidadeMaterial(m.formato)})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Quantidade</label>
          <input name="quantidade" inputMode="decimal" required className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-slate-700">Fornecedor</label>
          <input name="fornecedor" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Data do pedido</label>
          <input type="date" name="data_pedido" defaultValue={hoje} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Previsão de chegada</label>
          <input type="date" name="previsao_chegada" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          Registrar pedido
        </button>
      </form>

      <h2 className="mt-8 text-sm font-semibold text-slate-900">Pedidos em aberto</h2>
      <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">Material</th>
              <th className="px-3 py-2 text-right">Quantidade</th>
              <th className="px-3 py-2">Fornecedor</th>
              <th className="px-3 py-2">Pedido em</th>
              <th className="px-3 py-2">Previsão de chegada</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {abertos.map((p) => {
              const m = p.materiais as unknown as Parameters<typeof materialLabel>[0] | null;
              const atrasado = p.previsao_chegada && p.previsao_chegada < hoje;
              return (
                <tr key={p.id}>
                  <td className="px-3 py-2 font-medium text-slate-900">{m ? materialLabel(m) : "-"}</td>
                  <td className="px-3 py-2 text-right">
                    {formatQtd(Number(p.quantidade))} {m ? unidadeMaterial(m.formato) : ""}
                  </td>
                  <td className="px-3 py-2">{p.fornecedor}</td>
                  <td className="px-3 py-2">{formatData(p.data_pedido)}</td>
                  <td className="px-3 py-2">
                    <form action={atualizarPrevisaoPedido} className="flex items-center gap-1.5">
                      <input type="hidden" name="pedido_id" value={p.id} />
                      <input
                        type="date"
                        name="previsao_chegada"
                        defaultValue={p.previsao_chegada ?? ""}
                        className={`rounded border px-2 py-1 text-xs ${atrasado ? "border-red-300 text-red-700" : "border-slate-300"}`}
                      />
                      <button type="submit" className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
                        Salvar
                      </button>
                    </form>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <form action={marcarPedidoRecebido} className="flex items-center gap-1.5">
                        <input type="hidden" name="pedido_id" value={p.id} />
                        <input
                          name="quantidade_recebida"
                          inputMode="decimal"
                          placeholder={String(p.quantidade)}
                          title="Quantidade que realmente chegou (deixe vazio se veio tudo)"
                          className="w-20 rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                        <button type="submit" className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
                          Recebido
                        </button>
                      </form>
                      <form action={cancelarPedidoCompraMaterial}>
                        <input type="hidden" name="pedido_id" value={p.id} />
                        <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                          Cancelar
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {abertos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Nenhum pedido em aberto
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {fechados.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold text-slate-900">Histórico</h2>
          <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Material</th>
                  <th className="px-3 py-2 text-right">Pedido</th>
                  <th className="px-3 py-2 text-right">Recebido</th>
                  <th className="px-3 py-2">Fornecedor</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fechados.map((p) => {
                  const m = p.materiais as unknown as Parameters<typeof materialLabel>[0] | null;
                  return (
                    <tr key={p.id}>
                      <td className="px-3 py-2">{m ? materialLabel(m) : "-"}</td>
                      <td className="px-3 py-2 text-right">{formatQtd(Number(p.quantidade))}</td>
                      <td className="px-3 py-2 text-right">
                        {p.quantidade_recebida !== null ? formatQtd(Number(p.quantidade_recebida)) : "-"}
                      </td>
                      <td className="px-3 py-2">{p.fornecedor}</td>
                      <td className="px-3 py-2">{p.status === "recebido" ? "Recebido" : "Cancelado"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { criarOPDoPedido } from "../actions";
import { formatData, formatQtd } from "@/lib/pcp/carteira";
import { formatHoras } from "@/lib/tempo";

export default async function NovaOPDoPedidoPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string }>;
}) {
  const { item: itemId } = await searchParams;
  if (!itemId) notFound();
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("pedido_itens")
    .select("*, pecas(id, tempo_padrao_segundos, pecas_maquinas(maquina_id))")
    .eq("id", itemId)
    .single();
  if (!item) notFound();

  const peca = item.pecas as unknown as {
    id: string;
    tempo_padrao_segundos: number | null;
    pecas_maquinas: { maquina_id: string }[];
  } | null;

  const [{ data: opsItem }, { data: estoque }, { data: maquinas }, { data: fila }] = await Promise.all([
    supabase.from("ordens_producao").select("numero, quantidade_planejada, status").eq("pedido_item_id", item.id),
    peca
      ? supabase.from("estoque_pecas").select("saldo").eq("peca_id", peca.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("maquinas").select("id, codigo, nome").eq("ativo", true).order("codigo"),
    supabase
      .from("ordens_producao")
      .select("maquina_id, tempo_estimado_segundos")
      .in("status", ["planejada", "aberta", "setup", "em_producao", "parada"]),
  ]);

  const qtdEmOP = (opsItem ?? []).reduce((s, o) => s + Number(o.quantidade_planejada), 0);
  const saldoEstoque = Math.max(Number(estoque?.saldo ?? 0), 0);
  const sugerida = Math.max(Number(item.quantidade) - qtdEmOP - saldoEstoque, 0) || Number(item.quantidade);

  const compativeis = new Set((peca?.pecas_maquinas ?? []).map((pm) => pm.maquina_id));
  const opcoes = compativeis.size > 0 ? (maquinas ?? []).filter((m) => compativeis.has(m.id)) : (maquinas ?? []);

  const carga = new Map<string, { ops: number; segundos: number }>();
  for (const f of fila ?? []) {
    const c = carga.get(f.maquina_id) ?? { ops: 0, segundos: 0 };
    c.ops++;
    c.segundos += Number(f.tempo_estimado_segundos ?? 0);
    carga.set(f.maquina_id, c);
  }

  return (
    <div className="max-w-2xl">
      <Link href="/pcp/carteira" className="text-sm text-brand-600 hover:underline">
        ← Carteira
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Gerar OP</h1>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <p className="text-base font-semibold text-slate-900">
          {item.codigo_produto} — {item.descricao}
        </p>
        <p className="mt-1 text-slate-600">
          {item.cliente} · Pedido {item.numero_pedido}
          {item.pedido_compra && ` (PC ${item.pedido_compra})`} · Entrega {formatData(item.data_entrega)}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-slate-500">Qtd do pedido</p>
            <p className="font-semibold">{formatQtd(Number(item.quantidade))}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Já em OP</p>
            <p className="font-semibold">{formatQtd(qtdEmOP)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Estoque da peça</p>
            <p className="font-semibold">{formatQtd(saldoEstoque)}</p>
          </div>
        </div>
      </div>

      <form action={criarOPDoPedido} className="mt-4 space-y-4">
        <input type="hidden" name="pedido_item_id" value={item.id} />
        <input type="hidden" name="voltar" value="/pcp/carteira" />

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <label className="mb-1 block text-sm font-medium text-slate-700">Quantidade da OP</label>
          <input
            name="quantidade"
            type="number"
            min="0.0001"
            step="any"
            required
            defaultValue={sugerida}
            className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-slate-500">Sugestão: pedido − já em OP − estoque. Ajuste se quiser fazer lote maior.</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-sm font-medium text-slate-700">Máquina</p>
          {compativeis.size === 0 && (
            <p className="mb-2 text-xs text-amber-700">
              Peça sem máquinas cadastradas — a escolhida será gravada no cadastro da peça.
            </p>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {opcoes.map((m, i) => {
              const c = carga.get(m.id);
              return (
                <label
                  key={m.id}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
                >
                  <span className="flex items-center gap-2">
                    <input type="radio" name="maquina_id" value={m.id} required defaultChecked={opcoes.length === 1 && i === 0} />
                    <span className="font-medium">{m.nome}</span>
                  </span>
                  <span className="text-xs text-slate-500">
                    {c ? `${c.ops} OP${c.ops > 1 ? "s" : ""} · ${formatHoras(c.segundos)}` : "livre"}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Criar OP planejada
        </button>
      </form>
    </div>
  );
}

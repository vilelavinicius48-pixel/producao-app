import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ehFormatoBarra, materialLabel, unidadeMaterial } from "@/lib/pcp/material";
import { formatQtd } from "@/lib/pcp/carteira";
import { CopiarListaButton } from "./CopiarListaButton";

export default async function NecessidadeMaterialPage() {
  const supabase = await createClient();

  const [{ data: materiais }, { data: ops }, { data: estoque }, { data: pedidos }] = await Promise.all([
    supabase.from("materiais").select("id, formato, tipo, medida_a_mm, medida_b_mm, espessura_mm, ativo").order("tipo"),
    supabase
      .from("ordens_producao")
      .select("material_id, material_metros_necessarios, material_folhas_necessarias")
      .in("status", ["planejada", "aberta"])
      .not("material_id", "is", null),
    supabase.from("estoque_materiais").select("material_id, saldo"),
    supabase.from("pedidos_compra_material").select("material_id, quantidade").eq("status", "pedido"),
  ]);

  const estoquePorMaterial = new Map((estoque ?? []).map((e) => [e.material_id, Number(e.saldo)]));
  const pedidoAbertoPorMaterial = new Map<string, number>();
  for (const p of pedidos ?? []) {
    pedidoAbertoPorMaterial.set(p.material_id, (pedidoAbertoPorMaterial.get(p.material_id) ?? 0) + Number(p.quantidade));
  }

  // O campo certo (metros ou folhas) depende do formato do material.
  const formatoPorMaterial = new Map((materiais ?? []).map((m) => [m.id, m.formato]));
  const necessidadePorMaterial = new Map<string, number>();
  for (const op of ops ?? []) {
    if (!op.material_id) continue;
    const formato = formatoPorMaterial.get(op.material_id);
    const valor = formato && ehFormatoBarra(formato) ? op.material_metros_necessarios : op.material_folhas_necessarias;
    if (valor === null || valor === undefined) continue;
    necessidadePorMaterial.set(op.material_id, (necessidadePorMaterial.get(op.material_id) ?? 0) + Number(valor));
  }

  const linhas = (materiais ?? [])
    .map((m) => {
      const necessario = necessidadePorMaterial.get(m.id) ?? 0;
      const estoqueAtual = Math.max(estoquePorMaterial.get(m.id) ?? 0, 0);
      const pedidoAberto = pedidoAbertoPorMaterial.get(m.id) ?? 0;
      const falta = Math.max(necessario - estoqueAtual - pedidoAberto, 0);
      return { material: m, necessario, estoqueAtual, pedidoAberto, falta, unidade: unidadeMaterial(m.formato) };
    })
    .filter((l) => l.necessario > 0 || l.estoqueAtual > 0 || l.pedidoAberto > 0)
    .sort((a, b) => b.falta - a.falta);

  const itensParaCopiar = linhas.map((l) => ({ label: materialLabel(l.material), faltam: l.falta, unidade: l.unidade }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Necessidade de material</h1>
          <p className="mt-1 text-sm text-slate-600">
            Soma das OPs planejadas/liberadas, descontando estoque e pedidos de compra já em aberto.
          </p>
        </div>
        <CopiarListaButton itens={itensParaCopiar} />
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">Material</th>
              <th className="px-3 py-2 text-right">Necessário</th>
              <th className="px-3 py-2 text-right">Estoque</th>
              <th className="px-3 py-2 text-right">Pedido em aberto</th>
              <th className="px-3 py-2 text-right">Falta comprar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.map((l) => (
              <tr key={l.material.id}>
                <td className="px-3 py-2 font-medium text-slate-900">{materialLabel(l.material)}</td>
                <td className="px-3 py-2 text-right">
                  {formatQtd(l.necessario)} {l.unidade}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatQtd(l.estoqueAtual)} {l.unidade}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatQtd(l.pedidoAberto)} {l.unidade}
                </td>
                <td className={`px-3 py-2 text-right font-semibold ${l.falta > 0 ? "text-red-700" : "text-emerald-700"}`}>
                  {formatQtd(l.falta)} {l.unidade}
                </td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Nenhum material com necessidade, estoque ou pedido em aberto no momento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-sm text-slate-500">
        Quer registrar uma compra?{" "}
        <Link href="/pcp/compras" className="text-brand-600 hover:underline">
          Ir para Compras de material
        </Link>
      </p>
    </div>
  );
}

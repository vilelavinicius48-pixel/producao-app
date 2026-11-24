import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buscarTodos } from "@/lib/pcp/paginar";
import {
  calcularCarteira,
  diasEntre,
  formatData,
  formatQtd,
  hojeISO,
  SITUACAO_CLASS,
  SITUACAO_LABEL,
  type OPEntrada,
  type Situacao,
} from "@/lib/pcp/carteira";
import { STATUS_BADGE_CLASS, STATUS_LABEL } from "@/lib/op-status";
import type { StatusOP } from "@/types/database";

type ItemLinha = {
  id: string;
  cliente: string;
  numero_pedido: string;
  pedido_compra: string | null;
  data_entrega: string;
  codigo_produto: string;
  descricao: string;
  quantidade: number;
  peca_id: string | null;
  empresa: string | null;
  pecas: { tempo_padrao_segundos: number | null } | null;
};

type OPLinha = OPEntrada & { maquinas: { codigo: string } | null };

const FILTROS: { valor: string; label: string }[] = [
  { valor: "", label: "Todos" },
  { valor: "a_programar", label: "A programar" },
  { valor: "atrasados", label: "Atrasados" },
  { valor: "aguardando", label: "Aguardando preparo" },
  { valor: "andamento", label: "Liberados / em produção" },
];

export default async function CarteiraPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; q?: string; filtro?: string }>;
}) {
  const { cliente = "", q = "", filtro = "" } = await searchParams;
  const supabase = await createClient();
  const hoje = hojeISO();

  const [itens, ops, { data: estoque }] = await Promise.all([
    buscarTodos<ItemLinha>((de, ate) =>
      supabase
        .from("pedido_itens")
        .select(
          "id, cliente, numero_pedido, pedido_compra, data_entrega, codigo_produto, descricao, quantidade, peca_id, empresa, pecas(tempo_padrao_segundos)"
        )
        .eq("status", "aberto")
        .order("data_entrega")
        .order("id")
        .range(de, ate)
        .overrideTypes<ItemLinha[], { merge: false }>()
    ),
    buscarTodos<OPLinha>((de, ate) =>
      supabase
        .from("ordens_producao")
        .select("numero, status, pedido_item_id, quantidade_planejada, maquinas(codigo)")
        .not("pedido_item_id", "is", null)
        .order("numero")
        .range(de, ate)
        .overrideTypes<OPLinha[], { merge: false }>()
    ),
    supabase.from("estoque_pecas").select("peca_id, saldo"),
  ]);

  const saldo = new Map((estoque ?? []).map((e) => [e.peca_id, Number(e.saldo)]));
  const calculo = calcularCarteira(itens, ops, saldo);
  const maquinaPorOP = new Map(ops.map((o) => [o.numero, o.maquinas?.codigo ?? ""]));

  const clientes = [...new Set(itens.map((i) => i.cliente))].sort();
  const busca = q.trim().toLowerCase();

  const contagem: Record<Situacao, number> = {
    a_programar: 0,
    parcial: 0,
    aguardando: 0,
    liberada: 0,
    producao: 0,
    produzido: 0,
    estoque: 0,
  };
  let atrasados = 0;
  for (const it of itens) {
    contagem[calculo.get(it.id)!.situacao]++;
    if (it.data_entrega < hoje) atrasados++;
  }

  const visiveis = itens.filter((it) => {
    const c = calculo.get(it.id)!;
    if (cliente && it.cliente !== cliente) return false;
    if (busca && !`${it.codigo_produto} ${it.descricao} ${it.numero_pedido}`.toLowerCase().includes(busca))
      return false;
    if (filtro === "a_programar") return c.situacao === "a_programar" || c.situacao === "parcial";
    if (filtro === "atrasados") return it.data_entrega < hoje;
    if (filtro === "aguardando") return c.situacao === "aguardando";
    if (filtro === "andamento") return c.situacao === "liberada" || c.situacao === "producao";
    return true;
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Carteira de pedidos</h1>
          <p className="mt-1 text-sm text-slate-600">
            {itens.length} itens em aberto · {atrasados} com entrega vencida
          </p>
        </div>
        <Link
          href="/pcp/importar"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Importar pedidos
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(
          [
            ["A programar", contagem.a_programar + contagem.parcial, "text-red-700"],
            ["Aguardando preparo", contagem.aguardando, "text-amber-700"],
            ["Liberados", contagem.liberada, "text-emerald-700"],
            ["Em produção", contagem.producao, "text-green-700"],
            ["Atrasados", atrasados, "text-red-700"],
          ] as const
        ).map(([label, n, cor]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-600">{label}</p>
            <p className={`text-2xl font-bold ${cor}`}>{n}</p>
          </div>
        ))}
      </div>

      <form className="mt-4 flex flex-wrap items-end gap-2">
        <select
          name="cliente"
          defaultValue={cliente}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          aria-label="Cliente"
        >
          <option value="">Todos os clientes</option>
          {clientes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          name="filtro"
          defaultValue={filtro}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          aria-label="Situação"
        >
          {FILTROS.map((f) => (
            <option key={f.valor} value={f.valor}>
              {f.label}
            </option>
          ))}
        </select>
        <input
          name="q"
          defaultValue={q}
          placeholder="Código, descrição ou nº pedido"
          className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
          Filtrar
        </button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">Entrega</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Pedido</th>
              <th className="px-3 py-2">Produto</th>
              <th className="px-3 py-2 text-right">Qtd</th>
              <th className="px-3 py-2 text-right">Estoque</th>
              <th className="px-3 py-2 text-right">Em OP</th>
              <th className="px-3 py-2 text-right">Falta</th>
              <th className="px-3 py-2">Situação</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visiveis.map((it) => {
              const c = calculo.get(it.id)!;
              const atraso = diasEntre(it.data_entrega, hoje);
              return (
                <tr key={it.id} className={atraso > 0 ? "bg-red-50/40" : undefined}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={atraso > 0 ? "font-semibold text-red-700" : "text-slate-900"}>
                      {formatData(it.data_entrega)}
                    </span>
                    {atraso > 0 && <span className="block text-xs text-red-600">{atraso} dias atrasado</span>}
                    {atraso <= 0 && atraso > -7 && (
                      <span className="block text-xs text-amber-700">
                        {atraso === 0 ? "vence hoje" : `em ${-atraso} dias`}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {it.cliente}
                    {it.empresa && (
                      <span className="block text-[11px] text-slate-500">
                        {it.empresa.toUpperCase().startsWith("R.P") ? "RP Vilela" : "Vilela Ind."}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {it.numero_pedido}
                    {it.pedido_compra && <span className="block text-xs text-slate-500">PC {it.pedido_compra}</span>}
                  </td>
                  <td className="px-3 py-2">
                    {it.peca_id ? (
                      <Link href={`/cadastros/pecas/${it.peca_id}`} className="font-medium hover:underline">
                        {it.codigo_produto}
                      </Link>
                    ) : (
                      <span className="font-medium">{it.codigo_produto}</span>
                    )}{" "}
                    — {it.descricao}
                    {it.pecas?.tempo_padrao_segundos == null && (
                      <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                        sem tempo
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{formatQtd(Number(it.quantidade))}</td>
                  <td className="px-3 py-2 text-right text-sky-700">
                    {c.cobertoEstoque > 0 ? formatQtd(c.cobertoEstoque) : "-"}
                  </td>
                  <td className="px-3 py-2 text-right">{c.qtdEmOP > 0 ? formatQtd(c.qtdEmOP) : "-"}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${c.falta > 0 ? "text-red-700" : "text-slate-400"}`}>
                    {c.falta > 0 ? formatQtd(c.falta) : "0"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SITUACAO_CLASS[c.situacao]}`}>
                      {SITUACAO_LABEL[c.situacao]}
                    </span>
                    {c.ops.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {c.ops.map((o) => (
                          <Link
                            key={o.numero}
                            href={`/ordens/${o.numero}`}
                            className={`rounded px-1.5 py-0.5 text-[11px] font-medium hover:underline ${
                              STATUS_BADGE_CLASS[o.status as StatusOP]
                            }`}
                            title={STATUS_LABEL[o.status as StatusOP]}
                          >
                            OP {o.numero} · {maquinaPorOP.get(o.numero)}
                          </Link>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {c.falta > 0 && (
                      <Link
                        href={`/pcp/nova-op?item=${it.id}`}
                        className="whitespace-nowrap rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                      >
                        Gerar OP
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
            {visiveis.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                  {itens.length === 0 ? (
                    <>
                      Carteira vazia.{" "}
                      <Link href="/pcp/importar" className="font-medium text-brand-600 underline">
                        Importe os pedidos
                      </Link>
                      .
                    </>
                  ) : (
                    "Nenhum item com esse filtro."
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

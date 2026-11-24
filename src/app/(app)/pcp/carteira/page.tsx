import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buscarTodos } from "@/lib/pcp/paginar";
import { calcularCarteira, hojeISO, type OPEntrada, type Situacao } from "@/lib/pcp/carteira";
import { CarteiraTabela, type LinhaCarteira } from "./CarteiraTabela";

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

type OPLinha = OPEntrada & { maquinas: { nome: string } | null };

export default async function CarteiraPage() {
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
        .select("numero, status, pedido_item_id, quantidade_planejada, maquinas(nome)")
        .not("pedido_item_id", "is", null)
        .order("numero")
        .range(de, ate)
        .overrideTypes<OPLinha[], { merge: false }>()
    ),
    supabase.from("estoque_pecas").select("peca_id, saldo"),
  ]);

  const saldo = new Map((estoque ?? []).map((e) => [e.peca_id, Number(e.saldo)]));
  const calculo = calcularCarteira(itens, ops, saldo);
  const opsPorItem = new Map<string, OPLinha[]>();
  for (const o of ops) {
    if (!o.pedido_item_id) continue;
    const lista = opsPorItem.get(o.pedido_item_id) ?? [];
    lista.push(o);
    opsPorItem.set(o.pedido_item_id, lista);
  }

  const clientes = [...new Set(itens.map((i) => i.cliente))].sort();

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

  const linhas: LinhaCarteira[] = itens.map((it) => {
    const c = calculo.get(it.id)!;
    return {
      id: it.id,
      dataEntrega: it.data_entrega,
      cliente: it.cliente,
      empresaLabel: it.empresa ? (it.empresa.toUpperCase().startsWith("R.P") ? "RP Vilela" : "Vilela Ind.") : null,
      numeroPedido: it.numero_pedido,
      pedidoCompra: it.pedido_compra,
      pecaId: it.peca_id,
      codigoProduto: it.codigo_produto,
      descricao: it.descricao,
      semTempo: it.pecas?.tempo_padrao_segundos == null,
      quantidade: Number(it.quantidade),
      cobertoEstoque: c.cobertoEstoque,
      qtdEmOP: c.qtdEmOP,
      falta: c.falta,
      situacao: c.situacao,
      ops: (opsPorItem.get(it.id) ?? []).map((o) => ({ numero: o.numero, status: o.status, maquina: o.maquinas?.nome ?? "" })),
    };
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

      <CarteiraTabela linhas={linhas} clientes={clientes} hoje={hoje} />
    </div>
  );
}

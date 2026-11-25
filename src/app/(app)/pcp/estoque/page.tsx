import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { movimentarEstoque } from "../actions";
import { buscarTodos } from "@/lib/pcp/paginar";
import { formatQtd, formatQtdPecas } from "@/lib/pcp/carteira";

export default async function EstoquePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const supabase = await createClient();

  const [{ data: saldos }, itens] = await Promise.all([
    supabase.from("estoque_pecas").select("peca_id, saldo, atualizado_em"),
    buscarTodos<{ peca_id: string | null; quantidade: number }>((de, ate) =>
      supabase.from("pedido_itens").select("peca_id, quantidade").eq("status", "aberto").order("id").range(de, ate)
    ),
  ]);

  const saldoPorPeca = new Map((saldos ?? []).map((s) => [s.peca_id, s]));
  const demanda = new Map<string, number>();
  for (const i of itens) if (i.peca_id) demanda.set(i.peca_id, (demanda.get(i.peca_id) ?? 0) + Number(i.quantidade));

  // Mostra peças com pedido em aberto ou com saldo em estoque.
  const ids = [...new Set([...demanda.keys(), ...saldoPorPeca.keys()])];
  const { data: pecas } =
    ids.length > 0
      ? await supabase.from("pecas").select("id, codigo, descricao").in("id", ids.slice(0, 1000)).order("codigo")
      : { data: [] };

  const busca = q.trim().toLowerCase();
  const lista = (pecas ?? []).filter(
    (p) => !busca || `${p.codigo} ${p.descricao}`.toLowerCase().includes(busca)
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Estoque de peças prontas</h1>
      <p className="mt-1 text-sm text-slate-600">
        Peças com pedido em aberto ou com saldo. Use <strong>Contagem</strong> para lançar o que tem na prateleira
        (o app acerta a diferença), ou Entrada/Saída para movimentar.
      </p>

      <form className="mt-4 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar código ou descrição"
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
          Buscar
        </button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">Peça</th>
              <th className="px-3 py-2 text-right">Em pedido</th>
              <th className="px-3 py-2 text-right">Estoque</th>
              <th className="px-3 py-2">Lançar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lista.map((p) => {
              const s = saldoPorPeca.get(p.id);
              return (
                <tr key={p.id}>
                  <td className="px-3 py-2">
                    <Link href={`/cadastros/pecas/${p.id}`} className="font-medium hover:underline">
                      {p.codigo}
                    </Link>{" "}
                    — {p.descricao}
                  </td>
                  <td className="px-3 py-2 text-right">{formatQtd(demanda.get(p.id) ?? 0)}</td>
                  <td className="px-3 py-2 text-right">
                    <span className="font-semibold">{formatQtdPecas(Number(s?.saldo ?? 0))}</span>
                    {s?.atualizado_em && (
                      <span className="block text-[11px] text-slate-500">
                        {new Date(s.atualizado_em).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <form action={movimentarEstoque} className="flex items-center gap-1.5">
                      <input type="hidden" name="peca_id" value={p.id} />
                      <select name="tipo" defaultValue="contagem" className="rounded border border-slate-300 px-2 py-1 text-xs">
                        <option value="contagem">Contagem</option>
                        <option value="entrada">Entrada</option>
                        <option value="saida">Saída</option>
                      </select>
                      <input
                        name="quantidade"
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        required
                        placeholder="Qtd"
                        className="w-20 rounded border border-slate-300 px-2 py-1 text-xs"
                      />
                      <button
                        type="submit"
                        className="rounded bg-slate-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-700"
                      >
                        Lançar
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {lista.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  Nenhuma peça. Importe a carteira de pedidos primeiro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

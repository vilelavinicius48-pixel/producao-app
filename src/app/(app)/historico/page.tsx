import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABEL, STATUS_BADGE_CLASS } from "@/lib/op-status";
import type { StatusOP } from "@/types/database";

const STATUS_OPCOES: StatusOP[] = ["aberta", "em_producao", "parada", "concluida"];

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; numero?: string }>;
}) {
  const { status, numero } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("ordens_producao")
    .select("numero, status, quantidade_planejada, created_at, concluida_em, pecas(codigo, descricao), maquinas(codigo, nome)")
    .order("numero", { ascending: false })
    .limit(200);

  if (status && STATUS_OPCOES.includes(status as StatusOP)) {
    query = query.eq("status", status as StatusOP);
  }
  if (numero) query = query.eq("numero", Number(numero));

  const { data: ops } = await query;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Histórico de OPs</h1>

      <form className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Número</label>
          <input
            name="numero"
            type="number"
            defaultValue={numero}
            className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
          <select
            name="status"
            defaultValue={status ?? ""}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">Todos</option>
            {STATUS_OPCOES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Filtrar
        </button>
      </form>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3">Número</th>
              <th className="px-4 py-3">Peça</th>
              <th className="px-4 py-3">Máquina</th>
              <th className="px-4 py-3">Qtd. planejada</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Criada em</th>
              <th className="px-4 py-3">Concluída em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ops?.map((op) => {
              const peca = op.pecas as unknown as { codigo: string; descricao: string } | null;
              const maquina = op.maquinas as unknown as { codigo: string; nome: string } | null;
              return (
                <tr key={op.numero}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link href={`/ordens/${op.numero}`} className="hover:underline">
                      OP {op.numero}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{peca ? `${peca.codigo} — ${peca.descricao}` : "-"}</td>
                  <td className="px-4 py-3">{maquina ? `${maquina.codigo} — ${maquina.nome}` : "-"}</td>
                  <td className="px-4 py-3">{op.quantidade_planejada}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[op.status]}`}>
                      {STATUS_LABEL[op.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">{new Date(op.created_at).toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3">
                    {op.concluida_em ? new Date(op.concluida_em).toLocaleString("pt-BR") : "-"}
                  </td>
                </tr>
              );
            })}
            {ops?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  Nenhuma OP encontrada
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

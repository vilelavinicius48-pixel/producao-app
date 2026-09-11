import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABEL, STATUS_BADGE_CLASS } from "@/lib/op-status";

export default async function OrdensPage() {
  const supabase = await createClient();
  const { data: ops } = await supabase
    .from("ordens_producao")
    .select("numero, status, quantidade_planejada, created_at, pecas(codigo, descricao), maquinas(codigo, nome)")
    .order("numero", { ascending: false })
    .limit(100);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Ordens de produção</h1>
        <Link
          href="/ordens/nova"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Nova OP
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Número</th>
              <th className="px-4 py-3">Peça</th>
              <th className="px-4 py-3">Máquina</th>
              <th className="px-4 py-3">Qtd. planejada</th>
              <th className="px-4 py-3">Status</th>
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
                </tr>
              );
            })}
            {ops?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Nenhuma OP cadastrada
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

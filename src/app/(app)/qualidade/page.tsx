import Link from "next/link";
import { requireQualidade } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function QualidadePage() {
  await requireQualidade();
  const supabase = await createClient();

  const { data: apontamentos } = await supabase
    .from("apontamentos")
    .select(
      "id, timestamp_start, timestamp_stop, quantidade_produzida, operadores(nome), inspecoes_qualidade(id), ordens_producao(numero, pecas(codigo, descricao))"
    )
    .not("timestamp_stop", "is", null)
    .order("timestamp_stop", { ascending: false })
    .limit(100);

  const pendentes = (apontamentos ?? []).filter((a) => {
    const inspecao = a.inspecoes_qualidade as unknown as { id: string } | null;
    return inspecao === null;
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Qualidade — inspeções pendentes</h1>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">OP</th>
              <th className="px-4 py-3">Peça</th>
              <th className="px-4 py-3">Operador</th>
              <th className="px-4 py-3">Produzido</th>
              <th className="px-4 py-3">Encerrado em</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pendentes.map((a) => {
              const op = a.ordens_producao as unknown as {
                numero: number;
                pecas: { codigo: string; descricao: string };
              };
              const operador = a.operadores as unknown as { nome: string } | null;
              return (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">OP {op.numero}</td>
                  <td className="px-4 py-3">
                    {op.pecas.codigo} — {op.pecas.descricao}
                  </td>
                  <td className="px-4 py-3">{operador?.nome ?? "-"}</td>
                  <td className="px-4 py-3">{a.quantidade_produzida}</td>
                  <td className="px-4 py-3">{new Date(a.timestamp_stop!).toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/qualidade/${a.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                      Inspecionar
                    </Link>
                  </td>
                </tr>
              );
            })}
            {pendentes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Nenhuma inspeção pendente
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

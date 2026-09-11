import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { togglePecaAtiva } from "./actions";
import { formatSegundos } from "@/lib/tempo";

export default async function PecasPage() {
  const supabase = await createClient();
  const { data: pecas } = await supabase.from("pecas").select("*").order("codigo");

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Peças</h1>
        <Link
          href="/cadastros/pecas/nova"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Nova peça
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Tempo padrão (h:min:s)</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pecas?.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-medium text-slate-900">
                  <Link href={`/cadastros/pecas/${p.id}`} className="hover:underline">
                    {p.codigo}
                  </Link>
                </td>
                <td className="px-4 py-3">{p.descricao}</td>
                <td className="px-4 py-3 font-mono">{formatSegundos(p.tempo_padrao_segundos)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      p.ativo ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {p.ativo ? "Ativa" : "Inativa"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <form action={togglePecaAtiva}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="ativo" value={(!p.ativo).toString()} />
                    <button type="submit" className="text-sm font-medium text-blue-600 hover:underline">
                      {p.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {pecas?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Nenhuma peça cadastrada
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

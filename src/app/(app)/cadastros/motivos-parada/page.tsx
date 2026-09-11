import { createClient } from "@/lib/supabase/server";
import { createMotivoParada, toggleMotivoParadaAtivo } from "./actions";

export default async function MotivosParadaPage() {
  const supabase = await createClient();
  const { data: motivos } = await supabase
    .from("motivos_parada")
    .select("*")
    .order("descricao");

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Motivos de parada</h1>

      <form
        action={createMotivoParada}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-slate-700">Descrição</label>
          <input
            name="descricao"
            required
            placeholder="Ex: Setup, Manutenção, Falta de material, Quebra"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Adicionar
        </button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {motivos?.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{m.descricao}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      m.ativo ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {m.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <form action={toggleMotivoParadaAtivo}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="ativo" value={(!m.ativo).toString()} />
                    <button type="submit" className="text-sm font-medium text-blue-600 hover:underline">
                      {m.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {motivos?.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                  Nenhum motivo cadastrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

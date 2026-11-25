import { createClient } from "@/lib/supabase/server";
import { createTratamento, toggleTratamentoAtivo } from "./actions";

export default async function TratamentosPage() {
  const supabase = await createClient();
  const { data: tratamentos } = await supabase.from("tratamentos").select("*").order("nome");

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Tratamentos externos</h1>
      <p className="mt-1 text-sm text-slate-600">
        Ex.: oxidação, zincagem, polimento. Depois, vincule o fornecedor na hora de registrar o envio.
      </p>

      <form
        action={createTratamento}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-slate-700">Nome</label>
          <input
            name="nome"
            required
            placeholder="Ex: Oxidação preta, Zincagem, Polimento"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          Adicionar
        </button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tratamentos?.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{t.nome}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      t.ativo ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {t.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <form action={toggleTratamentoAtivo}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="ativo" value={(!t.ativo).toString()} />
                    <button type="submit" className="text-sm font-medium text-brand-600 hover:underline">
                      {t.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {tratamentos?.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                  Nenhum tratamento cadastrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

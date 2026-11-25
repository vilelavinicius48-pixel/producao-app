import { createClient } from "@/lib/supabase/server";
import { createFornecedor, toggleFornecedorAtivo } from "./actions";

export default async function FornecedoresPage() {
  const supabase = await createClient();
  const { data: fornecedores } = await supabase.from("fornecedores").select("*").order("nome");

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Fornecedores</h1>
      <p className="mt-1 text-sm text-slate-600">Fornecedores de tratamento externo (oxidação, zincagem, etc.).</p>

      <form
        action={createFornecedor}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-slate-700">Nome</label>
          <input
            name="nome"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-slate-700">Contato (opcional)</label>
          <input
            name="contato"
            placeholder="Telefone, e-mail..."
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
              <th className="px-4 py-3">Contato</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {fornecedores?.map((f) => (
              <tr key={f.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{f.nome}</td>
                <td className="px-4 py-3 text-slate-600">{f.contato ?? "-"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      f.ativo ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {f.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <form action={toggleFornecedorAtivo}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="ativo" value={(!f.ativo).toString()} />
                    <button type="submit" className="text-sm font-medium text-brand-600 hover:underline">
                      {f.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {fornecedores?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  Nenhum fornecedor cadastrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

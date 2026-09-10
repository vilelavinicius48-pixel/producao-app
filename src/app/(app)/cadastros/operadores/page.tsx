import { createClient } from "@/lib/supabase/server";
import { createOperador, toggleOperadorAtivo } from "./actions";

const PERFIL_LABEL: Record<string, string> = {
  gestor: "Gestor",
  operador: "Operador",
  qualidade: "Qualidade",
};

export default async function OperadoresPage() {
  const supabase = await createClient();
  const { data: operadores } = await supabase
    .from("operadores")
    .select("*")
    .order("nome");

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Usuários</h1>
      <p className="mt-1 text-sm text-slate-500">
        Somente gestores podem criar contas. O login é feito com matrícula + senha.
      </p>

      <form
        action={createOperador}
        className="mt-6 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Matrícula</label>
          <input
            name="matricula"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Nome</label>
          <input
            name="nome"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Perfil</label>
          <select
            name="perfil"
            required
            defaultValue="operador"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="operador">Operador</option>
            <option value="qualidade">Qualidade</option>
            <option value="gestor">Gestor</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Senha inicial</label>
          <input
            name="senha"
            type="password"
            required
            minLength={6}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="lg:col-span-4">
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Criar usuário
          </button>
        </div>
      </form>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3">Matrícula</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Perfil</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {operadores?.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{o.matricula}</td>
                <td className="px-4 py-3">{o.nome}</td>
                <td className="px-4 py-3">{PERFIL_LABEL[o.perfil] ?? o.perfil}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      o.ativo ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {o.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <form action={toggleOperadorAtivo}>
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="ativo" value={(!o.ativo).toString()} />
                    <button type="submit" className="text-sm font-medium text-blue-600 hover:underline">
                      {o.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {operadores?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Nenhum usuário cadastrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

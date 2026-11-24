import { createClient } from "@/lib/supabase/server";
import { atualizarBarraMaquina, createMaquina, toggleMaquinaAtiva } from "./actions";

export default async function MaquinasPage() {
  const supabase = await createClient();
  const { data: maquinas } = await supabase
    .from("maquinas")
    .select("*")
    .order("codigo");

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Máquinas</h1>

      <form
        action={createMaquina}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Código</label>
          <input
            name="codigo"
            required
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-slate-700">Nome</label>
          <input
            name="nome"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Adicionar
        </button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Barra (mm) / sobra de ponta</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {maquinas?.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{m.codigo}</td>
                <td className="px-4 py-3">{m.nome}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      m.ativo ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {m.ativo ? "Ativa" : "Inativa"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <form action={atualizarBarraMaquina} className="flex items-center gap-1.5">
                    <input type="hidden" name="id" value={m.id} />
                    <input
                      name="barra_comprimento_mm"
                      inputMode="decimal"
                      placeholder="Não usa barra"
                      defaultValue={m.barra_comprimento_mm ?? ""}
                      title="Tamanho da barra em mm (ex.: 3000 para 3 m). Deixe vazio se a máquina não trabalha com barra."
                      className="w-28 rounded border border-slate-300 px-2 py-1 text-xs"
                    />
                    <span className="text-xs text-slate-400">sobra</span>
                    <input
                      name="barra_sobra_mm"
                      inputMode="decimal"
                      placeholder="0"
                      defaultValue={m.barra_sobra_mm ?? 0}
                      title="Sobra de ponta da barra que não dá pra usar (mm)"
                      className="w-16 rounded border border-slate-300 px-2 py-1 text-xs"
                    />
                    <button
                      type="submit"
                      className="rounded bg-slate-800 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-700"
                    >
                      Salvar
                    </button>
                  </form>
                </td>
                <td className="px-4 py-3 text-right">
                  <form action={toggleMaquinaAtiva}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="ativo" value={(!m.ativo).toString()} />
                    <button type="submit" className="text-sm font-medium text-brand-600 hover:underline">
                      {m.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {maquinas?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Nenhuma máquina cadastrada
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

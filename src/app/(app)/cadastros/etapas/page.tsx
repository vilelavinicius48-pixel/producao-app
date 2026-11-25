import { createClient } from "@/lib/supabase/server";
import { createEtapa, toggleEtapaAtiva } from "./actions";
import { TIPO_ETAPA_CLASS, TIPO_ETAPA_LABEL } from "@/lib/roteiro";
import type { TipoEtapa } from "@/types/database";

const TIPOS: TipoEtapa[] = ["manual", "maquina", "externo", "inspecao"];

export default async function EtapasPage() {
  const supabase = await createClient();
  const { data: etapas } = await supabase.from("etapas").select("*").order("nome");

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Etapas / Postos</h1>
      <p className="mt-1 text-sm text-slate-600">
        Os postos pelos quais uma peça passa depois de sair da máquina (ou uma 2ª operação em máquina). Depois, monte o
        roteiro de cada peça em <span className="font-medium">Cadastros → Peças</span>.
      </p>

      <form
        action={createEtapa}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-slate-700">Nome</label>
          <input
            name="nome"
            required
            placeholder="Ex: Rebarbação, Lavagem, Gravação a laser"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Tipo</label>
          <select name="tipo" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {TIPO_ETAPA_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          Adicionar
        </button>
      </form>

      <p className="mt-2 text-xs text-slate-500">
        <strong>Manual</strong>: posto físico (rebarbação, furadeira, lavagem, embalagem...). <strong>Máquina</strong>:
        gera uma OP de 2ª operação. <strong>Tratamento externo</strong>: vai pra um fornecedor e volta.{" "}
        <strong>Inspeção</strong>: usa o módulo de Qualidade.
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {etapas?.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{e.nome}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIPO_ETAPA_CLASS[e.tipo]}`}>
                    {TIPO_ETAPA_LABEL[e.tipo]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      e.ativo ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {e.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <form action={toggleEtapaAtiva}>
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="ativo" value={(!e.ativo).toString()} />
                    <button type="submit" className="text-sm font-medium text-brand-600 hover:underline">
                      {e.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {etapas?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  Nenhuma etapa cadastrada
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

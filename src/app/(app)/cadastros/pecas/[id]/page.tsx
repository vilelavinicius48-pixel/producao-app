import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatSegundos } from "@/lib/tempo";
import { TimeInput } from "@/components/TimeInput";
import { updatePeca } from "../actions";

export default async function PecaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: peca } = await supabase.from("pecas").select("*").eq("id", id).single();
  if (!peca) notFound();

  const [{ data: compativeis }, { data: materiais }, { data: maquinas }] = await Promise.all([
    supabase.from("pecas_maquinas").select("maquina_id").eq("peca_id", id),
    supabase.from("peca_materiais").select("*").eq("peca_id", id),
    supabase.from("maquinas").select("id, codigo, nome").eq("ativo", true).order("codigo"),
  ]);

  const compativeisIds = new Set((compativeis ?? []).map((c) => c.maquina_id));
  const pendencias = [
    peca.tempo_padrao_segundos === null && "tempo padrão",
    compativeisIds.size === 0 && "máquinas compatíveis",
    (materiais ?? []).length === 0 && "material",
  ].filter(Boolean) as string[];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">
        {peca.codigo} — {peca.descricao}
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Tempo padrão:{" "}
        {peca.tempo_padrao_segundos !== null
          ? `${formatSegundos(peca.tempo_padrao_segundos)} (h:min:s) por unidade`
          : "não cadastrado"}{" "}
        · {peca.ativo ? "Ativa" : "Inativa"}
      </p>

      {pendencias.length > 0 && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Cadastro pendente: falta {pendencias.join(", ")}.
        </p>
      )}

      <form action={updatePeca} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <input type="hidden" name="id" value={peca.id} />
        <h2 className="text-sm font-semibold text-slate-900">Editar cadastro</h2>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Descrição</label>
          <input
            name="descricao"
            defaultValue={peca.descricao}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div>
          <TimeInput
            name="tempo_padrao_segundos"
            label="Tempo de ciclo por peça (h:min:s) — deixe 0 se ainda não souber"
            defaultSegundos={peca.tempo_padrao_segundos ?? 0}
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Máquinas que fazem esta peça</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {maquinas?.map((m) => (
              <label key={m.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="maquina_id"
                  value={m.id}
                  defaultChecked={compativeisIds.has(m.id)}
                  className="h-4 w-4"
                />
                {m.codigo}
              </label>
            ))}
          </div>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Salvar cadastro
        </button>
      </form>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Materiais necessários</h2>
        <ul className="space-y-1 text-sm text-slate-700">
          {materiais?.map((m) => (
            <li key={m.id}>
              {m.material} — {m.quantidade_por_unidade} {m.unidade_medida} / unidade
            </li>
          ))}
          {materiais?.length === 0 && <li className="text-slate-500">Nenhum material cadastrado</li>}
        </ul>
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import { requireQualidade } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createInspecao } from "../actions";

export default async function InspecionarPage({
  params,
}: {
  params: Promise<{ apontamentoId: string }>;
}) {
  await requireQualidade();
  const { apontamentoId } = await params;
  const supabase = await createClient();

  const { data: apontamento } = await supabase
    .from("apontamentos")
    .select(
      "id, timestamp_stop, quantidade_produzida, quantidade_refugada, operadores(nome), ordens_producao(numero, pecas(codigo, descricao)), inspecoes_qualidade(id)"
    )
    .eq("id", apontamentoId)
    .single();

  if (!apontamento || !apontamento.timestamp_stop) notFound();

  const jaInspecionado = (apontamento.inspecoes_qualidade as unknown as { id: string }[]).length > 0;
  const op = apontamento.ordens_producao as unknown as {
    numero: number;
    pecas: { codigo: string; descricao: string };
  };
  const operador = apontamento.operadores as unknown as { nome: string } | null;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold text-slate-900">Inspeção de qualidade</h1>
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <p>
          OP {op.numero} — {op.pecas.codigo} {op.pecas.descricao}
        </p>
        <p>Operador: {operador?.nome ?? "-"}</p>
        <p>Produzido: {apontamento.quantidade_produzida} · Refugado: {apontamento.quantidade_refugada}</p>
      </div>

      {jaInspecionado ? (
        <p className="mt-6 text-slate-500">Este apontamento já foi inspecionado.</p>
      ) : (
        <form action={createInspecao} className="mt-6 space-y-4">
          <input type="hidden" name="apontamento_id" value={apontamento.id} />

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Resultado</label>
            <div className="flex gap-3">
              {[
                { value: "aprovado", label: "Aprovado", color: "green" },
                { value: "reprovado", label: "Reprovado", color: "red" },
                { value: "retrabalho", label: "Retrabalho", color: "amber" },
              ].map((r) => (
                <label
                  key={r.value}
                  className="flex-1 cursor-pointer rounded-xl border border-slate-300 px-4 py-4 text-center text-sm font-semibold has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50"
                >
                  <input type="radio" name="resultado" value={r.value} required className="sr-only" />
                  {r.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Observação</label>
            <textarea
              name="observacao"
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-blue-600 px-4 py-4 text-lg font-bold text-white hover:bg-blue-700"
          >
            Registrar inspeção
          </button>
        </form>
      )}
    </div>
  );
}

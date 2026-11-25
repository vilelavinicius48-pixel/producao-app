import { requireQualidade } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TURNO_CLASS, TURNO_LABEL, STATUS_INSPECAO_CLASS, STATUS_INSPECAO_LABEL } from "@/lib/inspecao-linha";
import { excluirInspecaoLinha } from "./actions";

export default async function HistoricoInspecaoLinhaPage() {
  await requireQualidade();
  const supabase = await createClient();

  const { data: inspecoes } = await supabase
    .from("inspecoes_linha")
    .select(
      "id, situacao_geral, turno, observacao, created_at, operadores(nome), ordens_producao(numero, maquinas(nome), pecas(codigo, descricao)), motivos_refugo(descricao)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Histórico de Inspeções de Linha</h1>
      <p className="mt-1 text-sm text-slate-600">Todas as inspeções de linha realizadas.</p>

      <div className="mt-6 space-y-2">
        {(inspecoes ?? []).map((insp) => {
          const operador = insp.operadores as unknown as { nome: string } | null;
          const op = insp.ordens_producao as unknown as {
            numero: number;
            maquinas: { nome: string } | null;
            pecas: { codigo: string; descricao: string };
          } | null;
          const motivo = insp.motivos_refugo as unknown as { descricao: string } | null;
          const data = new Date(insp.created_at);

          return (
            <details key={insp.id} className="group rounded-lg border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
                  <span className="shrink-0 text-sm text-slate-500">
                    {data.toLocaleDateString("pt-BR")}
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${TURNO_CLASS[insp.turno]}`}>
                    {TURNO_LABEL[insp.turno]}
                  </span>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_INSPECAO_CLASS[insp.situacao_geral]}`}
                  >
                    {STATUS_INSPECAO_LABEL[insp.situacao_geral]}
                  </span>
                  {op && (
                    <span className="truncate text-sm text-slate-700">
                      OP {op.numero} · {op.maquinas?.nome} · {op.pecas.codigo}
                    </span>
                  )}
                  <span className="text-sm text-slate-700">Inspetor: {operador?.nome ?? "-"}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <svg
                    className="h-4 w-4 text-slate-400 transition group-open:rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  <form action={excluirInspecaoLinha}>
                    <input type="hidden" name="id" value={insp.id} />
                    <button
                      type="submit"
                      aria-label="Excluir inspeção"
                      className="text-red-500 hover:text-red-700"
                    >
                      🗑
                    </button>
                  </form>
                </div>
              </summary>

              <div className="border-t border-slate-100 px-4 py-3 text-sm">
                <p className="text-xs text-slate-500">
                  {data.toLocaleString("pt-BR")}
                </p>
                {motivo && (
                  <p className="mt-2 text-slate-700">
                    <span className="font-medium">Motivo:</span> {motivo.descricao}
                  </p>
                )}
                {insp.observacao && <p className="mt-2 text-slate-700">{insp.observacao}</p>}
                {!motivo && !insp.observacao && <p className="mt-2 text-slate-500">Sem mais detalhes.</p>}
              </div>
            </details>
          );
        })}
        {(inspecoes ?? []).length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
            Nenhuma inspeção de linha registrada ainda.
          </p>
        )}
      </div>
    </div>
  );
}

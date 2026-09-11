import { createClient } from "@/lib/supabase/server";
import { Cronometro } from "@/components/Cronometro";
import { DashboardRealtime } from "./DashboardRealtime";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: maquinas }, { data: opsAtivas }, { data: apontamentosAbertos }, { data: paradasAbertas }] =
    await Promise.all([
      supabase.from("maquinas").select("*").eq("ativo", true).order("codigo"),
      supabase
        .from("ordens_producao")
        .select("id, numero, status, maquina_id, quantidade_planejada, pecas(codigo, descricao)")
        .in("status", ["em_producao", "parada"]),
      supabase
        .from("apontamentos")
        .select("op_id, timestamp_start, operadores(nome)")
        .is("timestamp_stop", null),
      supabase.from("paradas").select("op_id, timestamp_inicio").is("timestamp_fim", null),
    ]);

  const apontamentoPorOp = new Map((apontamentosAbertos ?? []).map((a) => [a.op_id, a]));
  const paradaPorOp = new Map((paradasAbertas ?? []).map((p) => [p.op_id, p]));
  const opPorMaquina = new Map((opsAtivas ?? []).map((op) => [op.maquina_id, op]));

  return (
    <div>
      <DashboardRealtime />
      <h1 className="text-3xl font-bold text-slate-900">Painel de produção</h1>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {maquinas?.map((m) => {
          const op = opPorMaquina.get(m.id);
          const peca = op?.pecas as unknown as { codigo: string; descricao: string } | null;

          if (!op) {
            return (
              <div key={m.id} className="rounded-2xl border border-slate-200 bg-white p-6">
                <p className="text-xl font-bold text-slate-900">
                  {m.codigo} — {m.nome}
                </p>
                <p className="mt-4 text-lg text-slate-400">LIVRE</p>
              </div>
            );
          }

          const emProducao = op.status === "em_producao";
          const apontamento = apontamentoPorOp.get(op.id);
          const parada = paradaPorOp.get(op.id);
          const operador = apontamento?.operadores as unknown as { nome: string } | null;

          return (
            <div
              key={m.id}
              className={`rounded-2xl border-2 p-6 ${
                emProducao ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"
              }`}
            >
              <p className="text-xl font-bold text-slate-900">
                {m.codigo} — {m.nome}
              </p>
              <p
                className={`mt-1 text-sm font-bold uppercase tracking-wide ${
                  emProducao ? "text-green-700" : "text-red-700"
                }`}
              >
                {emProducao ? "Em produção" : "Parada"}
              </p>

              <p className="mt-3 text-lg text-slate-800">
                OP {op.numero} — {peca?.codigo} {peca?.descricao}
              </p>
              <p className="text-sm text-slate-600">Planejado: {op.quantidade_planejada}</p>

              {emProducao && apontamento ? (
                <div className="mt-4">
                  <p className="text-sm text-slate-600">Operador: {operador?.nome ?? "-"}</p>
                  <Cronometro
                    desde={apontamento.timestamp_start}
                    className="text-3xl font-bold text-green-800"
                  />
                </div>
              ) : parada ? (
                <div className="mt-4">
                  <p className="text-sm text-red-700">PARADA HÁ</p>
                  <Cronometro desde={parada.timestamp_inicio} className="text-3xl font-bold text-red-800" />
                </div>
              ) : null}
            </div>
          );
        })}
        {maquinas?.length === 0 && <p className="text-slate-400">Nenhuma máquina cadastrada</p>}
      </div>
    </div>
  );
}

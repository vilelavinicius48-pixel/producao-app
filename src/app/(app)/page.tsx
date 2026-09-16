import { createClient } from "@/lib/supabase/server";
import { Cronometro } from "@/components/Cronometro";
import { DashboardRealtime } from "./DashboardRealtime";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { data: maquinas },
    { data: opsAtivas },
    { data: opsAbertas },
    { data: setupsAbertos },
    { data: apontamentosAbertos },
    { data: paradasAbertas },
  ] = await Promise.all([
    supabase.from("maquinas").select("*").eq("ativo", true).order("codigo"),
    supabase
      .from("ordens_producao")
      .select("id, numero, status, maquina_id, quantidade_planejada, pecas(codigo, descricao)")
      .in("status", ["setup", "em_producao", "parada"]),
    supabase
      .from("ordens_producao")
      .select("id, numero, status, maquina_id, quantidade_planejada, pecas(codigo, descricao)")
      .eq("status", "aberta")
      .order("created_at", { ascending: true }),
    supabase
      .from("setups")
      .select("op_id, timestamp_inicio, operadores(nome)")
      .is("timestamp_fim", null),
    supabase
      .from("apontamentos")
      .select("op_id, timestamp_start, operadores(nome)")
      .is("timestamp_stop", null),
    supabase.from("paradas").select("op_id, timestamp_inicio").is("timestamp_fim", null),
  ]);

  const opIds = [...(opsAtivas ?? []), ...(opsAbertas ?? [])].map((op) => op.id);
  const { data: progresso } =
    opIds.length > 0
      ? await supabase.from("op_progresso").select("*").in("op_id", opIds)
      : { data: [] };

  const produzidoPorOp = new Map((progresso ?? []).map((p) => [p.op_id, p.quantidade_produzida_total]));
  const setupPorOp = new Map((setupsAbertos ?? []).map((s) => [s.op_id, s]));
  const apontamentoPorOp = new Map((apontamentosAbertos ?? []).map((a) => [a.op_id, a]));
  const paradaPorOp = new Map((paradasAbertas ?? []).map((p) => [p.op_id, p]));
  const opAtivaPorMaquina = new Map((opsAtivas ?? []).map((op) => [op.maquina_id, op]));
  const opAbertaPorMaquina = new Map<string, NonNullable<typeof opsAbertas>[number]>();
  for (const op of opsAbertas ?? []) {
    if (!opAbertaPorMaquina.has(op.maquina_id)) opAbertaPorMaquina.set(op.maquina_id, op);
  }

  return (
    <div>
      <DashboardRealtime />
      <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Painel de produção</h1>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:mt-8 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        {maquinas?.map((m) => {
          const opAtiva = opAtivaPorMaquina.get(m.id);
          const opAberta = !opAtiva ? opAbertaPorMaquina.get(m.id) : undefined;

          if (!opAtiva && !opAberta) {
            return (
              <div key={m.id} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <p className="text-lg font-bold text-slate-900 sm:text-xl">
                  {m.codigo} — {m.nome}
                </p>
                <p className="mt-4 text-lg font-semibold text-slate-500">LIVRE</p>
              </div>
            );
          }

          if (opAberta) {
            const peca = opAberta.pecas as unknown as { codigo: string; descricao: string } | null;
            const produzido = produzidoPorOp.get(opAberta.id) ?? 0;
            return (
              <div key={m.id} className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-5 sm:p-6">
                <p className="text-lg font-bold text-slate-900 sm:text-xl">
                  {m.codigo} — {m.nome}
                </p>
                <p className="mt-1 text-sm font-bold uppercase tracking-wide text-amber-700">
                  Aguardando apontamento
                </p>
                <p className="mt-3 text-base text-slate-800 sm:text-lg">
                  OP {opAberta.numero} — {peca?.codigo} {peca?.descricao}
                </p>
                <p className="text-sm text-slate-600">
                  Produzido: {produzido} / {opAberta.quantidade_planejada}
                </p>
              </div>
            );
          }

          const op = opAtiva!;
          const peca = op.pecas as unknown as { codigo: string; descricao: string } | null;

          if (op.status === "setup") {
            const setup = setupPorOp.get(op.id);
            const operadorSetup = setup?.operadores as unknown as { nome: string } | null;
            return (
              <div key={m.id} className="rounded-2xl border-2 border-sky-500 bg-sky-50 p-5 sm:p-6">
                <p className="text-lg font-bold text-slate-900 sm:text-xl">
                  {m.codigo} — {m.nome}
                </p>
                <p className="mt-1 text-sm font-bold uppercase tracking-wide text-sky-700">SETUP</p>
                <p className="mt-3 text-base text-slate-800 sm:text-lg">
                  OP {op.numero} — {peca?.codigo} {peca?.descricao}
                </p>
                {setup && (
                  <div className="mt-4">
                    <p className="text-sm text-slate-600">Operador: {operadorSetup?.nome ?? "-"}</p>
                    <Cronometro
                      desde={setup.timestamp_inicio}
                      className="text-2xl font-bold text-sky-800 sm:text-3xl"
                    />
                  </div>
                )}
              </div>
            );
          }

          const emProducao = op.status === "em_producao";
          const apontamento = apontamentoPorOp.get(op.id);
          const parada = paradaPorOp.get(op.id);
          const operador = apontamento?.operadores as unknown as { nome: string } | null;
          const produzido = produzidoPorOp.get(op.id) ?? 0;

          return (
            <div
              key={m.id}
              className={`rounded-2xl border-2 p-5 sm:p-6 ${
                emProducao ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"
              }`}
            >
              <p className="text-lg font-bold text-slate-900 sm:text-xl">
                {m.codigo} — {m.nome}
              </p>
              <p
                className={`mt-1 text-sm font-bold uppercase tracking-wide ${
                  emProducao ? "text-green-700" : "text-red-700"
                }`}
              >
                {emProducao ? "Em produção" : "Parada"}
              </p>

              <p className="mt-3 text-base text-slate-800 sm:text-lg">
                OP {op.numero} — {peca?.codigo} {peca?.descricao}
              </p>
              <p className="text-sm text-slate-600">
                Produzido: {produzido} / {op.quantidade_planejada}
              </p>

              {emProducao && apontamento ? (
                <div className="mt-4">
                  <p className="text-sm text-slate-600">Operador: {operador?.nome ?? "-"}</p>
                  <Cronometro
                    desde={apontamento.timestamp_start}
                    className="text-2xl font-bold text-green-800 sm:text-3xl"
                  />
                </div>
              ) : parada ? (
                <div className="mt-4">
                  <p className="text-sm text-red-700">PARADA HÁ</p>
                  <Cronometro
                    desde={parada.timestamp_inicio}
                    className="text-2xl font-bold text-red-800 sm:text-3xl"
                  />
                </div>
              ) : null}
            </div>
          );
        })}
        {maquinas?.length === 0 && <p className="text-slate-500">Nenhuma máquina cadastrada</p>}
      </div>
    </div>
  );
}

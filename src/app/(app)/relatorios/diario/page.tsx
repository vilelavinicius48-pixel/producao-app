import { requireGestor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function formatMinutos(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h${m.toString().padStart(2, "0")}min`;
}

function hojeISO() {
  const now = new Date();
  const tz = now.getTimezoneOffset();
  const local = new Date(now.getTime() - tz * 60000);
  return local.toISOString().slice(0, 10);
}

export default async function RelatorioDiarioPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>;
}) {
  await requireGestor();
  const { data: dataParam } = await searchParams;
  const dataSelecionada = dataParam || hojeISO();

  const inicioDia = new Date(`${dataSelecionada}T00:00:00`);
  const fimDia = new Date(inicioDia.getTime() + 24 * 60 * 60 * 1000);

  const supabase = await createClient();

  const [{ data: maquinas }, { data: apontamentos }, { data: paradas }] = await Promise.all([
    supabase.from("maquinas").select("*").eq("ativo", true).order("codigo"),
    supabase
      .from("apontamentos")
      .select("timestamp_start, timestamp_stop, quantidade_produzida, ordens_producao(maquina_id, pecas(tempo_padrao_por_unidade))")
      .not("timestamp_stop", "is", null)
      .gte("timestamp_stop", inicioDia.toISOString())
      .lt("timestamp_stop", fimDia.toISOString()),
    supabase
      .from("paradas")
      .select("timestamp_inicio, timestamp_fim, ordens_producao(maquina_id)")
      .not("timestamp_fim", "is", null)
      .gte("timestamp_fim", inicioDia.toISOString())
      .lt("timestamp_fim", fimDia.toISOString()),
  ]);

  type Agregado = { tempoRodado: number; tempoParado: number; tempoPadraoGanho: number };
  const porMaquina = new Map<string, Agregado>();

  function get(maquinaId: string): Agregado {
    if (!porMaquina.has(maquinaId)) {
      porMaquina.set(maquinaId, { tempoRodado: 0, tempoParado: 0, tempoPadraoGanho: 0 });
    }
    return porMaquina.get(maquinaId)!;
  }

  for (const a of apontamentos ?? []) {
    const op = a.ordens_producao as unknown as {
      maquina_id: string;
      pecas: { tempo_padrao_por_unidade: number };
    } | null;
    if (!op) continue;
    const agg = get(op.maquina_id);
    const minutos = (new Date(a.timestamp_stop!).getTime() - new Date(a.timestamp_start).getTime()) / 60000;
    agg.tempoRodado += minutos;
    agg.tempoPadraoGanho += op.pecas.tempo_padrao_por_unidade * (a.quantidade_produzida ?? 0);
  }

  for (const p of paradas ?? []) {
    const op = p.ordens_producao as unknown as { maquina_id: string } | null;
    if (!op) continue;
    const agg = get(op.maquina_id);
    agg.tempoParado += (new Date(p.timestamp_fim!).getTime() - new Date(p.timestamp_inicio).getTime()) / 60000;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Relatório diário por máquina</h1>
      <p className="mt-1 text-sm text-slate-500">
        &quot;Tempo padrão (produzido)&quot; é o tempo que deveria ter sido gasto, pelo cadastro da peça, para
        produzir a quantidade real do dia — comparado ao tempo rodado real para calcular a eficiência.
      </p>

      <form className="mt-4 flex items-end gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Data</label>
          <input
            type="date"
            name="data"
            defaultValue={dataSelecionada}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Ver
        </button>
      </form>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3">Máquina</th>
              <th className="px-4 py-3">Tempo rodado</th>
              <th className="px-4 py-3">Tempo parado</th>
              <th className="px-4 py-3">Tempo padrão (produzido)</th>
              <th className="px-4 py-3">Eficiência do dia</th>
              <th className="px-4 py-3">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {maquinas?.map((m) => {
              const agg = porMaquina.get(m.id);
              const teveAtividade = agg && (agg.tempoRodado > 0 || agg.tempoParado > 0);
              const eficiencia = agg && agg.tempoRodado > 0 ? agg.tempoPadraoGanho / agg.tempoRodado : null;
              const atrasado = eficiencia !== null && eficiencia < 1;
              return (
                <tr key={m.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {m.codigo} — {m.nome}
                  </td>
                  <td className="px-4 py-3">{formatMinutos(agg?.tempoRodado ?? 0)}</td>
                  <td className="px-4 py-3">{formatMinutos(agg?.tempoParado ?? 0)}</td>
                  <td className="px-4 py-3">{formatMinutos(agg?.tempoPadraoGanho ?? 0)}</td>
                  <td className="px-4 py-3">{eficiencia !== null ? `${(eficiencia * 100).toFixed(0)}%` : "-"}</td>
                  <td className="px-4 py-3">
                    {!teveAtividade ? (
                      <span className="text-slate-400">Sem atividade</span>
                    ) : atrasado ? (
                      <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                        Atrasada
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                        No prazo
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {maquinas?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
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

import { requireGestor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatSegundos } from "@/lib/tempo";
import { EficienciaChart } from "@/components/EficienciaChart";

function hojeISO() {
  const now = new Date();
  const tz = now.getTimezoneOffset();
  const local = new Date(now.getTime() - tz * 60000);
  return local.toISOString().slice(0, 10);
}

type Agregado = {
  tempoRodado: number;
  tempoParado: number;
  tempoPadraoGanho: number;
  qtdAprovada: number;
  qtdReprovada: number;
  qtdRetrabalho: number;
};

function novoAgregado(): Agregado {
  return { tempoRodado: 0, tempoParado: 0, tempoPadraoGanho: 0, qtdAprovada: 0, qtdReprovada: 0, qtdRetrabalho: 0 };
}

function taxaAprovacao(agg?: Agregado) {
  if (!agg) return null;
  const totalInspecionado = agg.qtdAprovada + agg.qtdReprovada + agg.qtdRetrabalho;
  return totalInspecionado > 0 ? agg.qtdAprovada / totalInspecionado : null;
}

export default async function RelatorioDiarioPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; maquina_id?: string; operador_id?: string }>;
}) {
  await requireGestor();
  const { data: dataParam, maquina_id: maquinaFiltro, operador_id: operadorFiltro } = await searchParams;
  const dataSelecionada = dataParam || hojeISO();

  const inicioDia = new Date(`${dataSelecionada}T00:00:00`);
  const fimDia = new Date(inicioDia.getTime() + 24 * 60 * 60 * 1000);

  const supabase = await createClient();

  const [{ data: maquinas }, { data: operadores }, { data: apontamentos }, { data: paradas }] =
    await Promise.all([
      supabase.from("maquinas").select("*").eq("ativo", true).order("codigo"),
      supabase.from("operadores").select("*").eq("perfil", "operador").eq("ativo", true).order("nome"),
      supabase
        .from("apontamentos")
        .select(
          "timestamp_start, timestamp_stop, quantidade_produzida, operador_id, operadores(nome), ordens_producao(maquina_id, pecas(tempo_padrao_segundos)), inspecoes_qualidade(quantidade_aprovada, quantidade_reprovada, quantidade_retrabalho)"
        )
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

  const apontamentosFiltrados = (apontamentos ?? []).filter((a) => {
    const op = a.ordens_producao as unknown as { maquina_id: string } | null;
    if (maquinaFiltro && op?.maquina_id !== maquinaFiltro) return false;
    if (operadorFiltro && a.operador_id !== operadorFiltro) return false;
    return true;
  });
  const paradasFiltradas = (paradas ?? []).filter((p) => {
    const op = p.ordens_producao as unknown as { maquina_id: string } | null;
    if (maquinaFiltro && op?.maquina_id !== maquinaFiltro) return false;
    return true;
  });

  const porMaquina = new Map<string, Agregado>();
  const porOperador = new Map<string, Agregado & { nome: string }>();

  function getMaquina(id: string): Agregado {
    if (!porMaquina.has(id)) porMaquina.set(id, novoAgregado());
    return porMaquina.get(id)!;
  }
  function getOperador(id: string, nome: string) {
    if (!porOperador.has(id)) porOperador.set(id, { ...novoAgregado(), nome });
    return porOperador.get(id)!;
  }

  for (const a of apontamentosFiltrados) {
    const op = a.ordens_producao as unknown as {
      maquina_id: string;
      pecas: { tempo_padrao_segundos: number };
    } | null;
    if (!op) continue;
    const segundos = (new Date(a.timestamp_stop!).getTime() - new Date(a.timestamp_start).getTime()) / 1000;
    const padraoGanho = op.pecas.tempo_padrao_segundos * (a.quantidade_produzida ?? 0);
    const inspecoes = a.inspecoes_qualidade as unknown as
      | { quantidade_aprovada: number; quantidade_reprovada: number; quantidade_retrabalho: number }[]
      | null;
    const inspecao = inspecoes?.[0];

    const aggMaquina = getMaquina(op.maquina_id);
    aggMaquina.tempoRodado += segundos;
    aggMaquina.tempoPadraoGanho += padraoGanho;
    if (inspecao) {
      aggMaquina.qtdAprovada += inspecao.quantidade_aprovada;
      aggMaquina.qtdReprovada += inspecao.quantidade_reprovada;
      aggMaquina.qtdRetrabalho += inspecao.quantidade_retrabalho;
    }

    if (a.operador_id) {
      const operador = a.operadores as unknown as { nome: string } | null;
      const aggOperador = getOperador(a.operador_id, operador?.nome ?? "-");
      aggOperador.tempoRodado += segundos;
      aggOperador.tempoPadraoGanho += padraoGanho;
      if (inspecao) {
        aggOperador.qtdAprovada += inspecao.quantidade_aprovada;
        aggOperador.qtdReprovada += inspecao.quantidade_reprovada;
        aggOperador.qtdRetrabalho += inspecao.quantidade_retrabalho;
      }
    }
  }

  for (const p of paradasFiltradas) {
    const op = p.ordens_producao as unknown as { maquina_id: string } | null;
    if (!op) continue;
    const segundos = (new Date(p.timestamp_fim!).getTime() - new Date(p.timestamp_inicio).getTime()) / 1000;
    getMaquina(op.maquina_id).tempoParado += segundos;
  }

  const maquinasVisiveis = (maquinas ?? []).filter((m) => !maquinaFiltro || m.id === maquinaFiltro);
  const operadoresVisiveis = (operadores ?? []).filter((o) => !operadorFiltro || o.id === operadorFiltro);

  const eficienciaPorMaquina = (m: { id: string }) => {
    const agg = porMaquina.get(m.id);
    return agg && agg.tempoRodado > 0 ? agg.tempoPadraoGanho / agg.tempoRodado : null;
  };
  const eficienciaPorOperadorFn = (agg?: Agregado) =>
    agg && agg.tempoRodado > 0 ? agg.tempoPadraoGanho / agg.tempoRodado : null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Relatório diário</h1>
      <p className="mt-1 text-sm text-slate-600">
        &quot;Tempo padrão (produzido)&quot; é o tempo que deveria ter sido gasto, pelo cadastro da peça, para
        produzir a quantidade real do período — comparado ao tempo rodado real para calcular a eficiência. A
        taxa de qualidade considera apenas o que já foi inspecionado pela qualidade.
      </p>

      <form className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Data</label>
          <input
            type="date"
            name="data"
            defaultValue={dataSelecionada}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Máquina</label>
          <select
            name="maquina_id"
            defaultValue={maquinaFiltro ?? ""}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">Todas</option>
            {maquinas?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.codigo} — {m.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Operador</label>
          <select
            name="operador_id"
            defaultValue={operadorFiltro ?? ""}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">Todos</option>
            {operadores?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Ver
        </button>
      </form>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <EficienciaChart
          title="Eficiência por máquina"
          items={maquinasVisiveis.map((m) => ({
            label: `${m.codigo} — ${m.nome}`,
            eficiencia: eficienciaPorMaquina(m),
          }))}
        />
        <EficienciaChart
          title="Eficiência por operador"
          items={operadoresVisiveis.map((o) => ({
            label: o.nome,
            eficiencia: eficienciaPorOperadorFn(porOperador.get(o.id)),
          }))}
        />
        <EficienciaChart
          title="Taxa de aprovação por máquina"
          items={maquinasVisiveis.map((m) => ({
            label: `${m.codigo} — ${m.nome}`,
            eficiencia: taxaAprovacao(porMaquina.get(m.id)),
          }))}
        />
        <EficienciaChart
          title="Taxa de aprovação por operador"
          items={operadoresVisiveis.map((o) => ({
            label: o.nome,
            eficiencia: taxaAprovacao(porOperador.get(o.id)),
          }))}
        />
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Máquina</th>
              <th className="px-4 py-3">Tempo rodado</th>
              <th className="px-4 py-3">Tempo parado</th>
              <th className="px-4 py-3">Tempo padrão (produzido)</th>
              <th className="px-4 py-3">Eficiência</th>
              <th className="px-4 py-3">Aprov./Reprov./Retrab.</th>
              <th className="px-4 py-3">Taxa qualidade</th>
              <th className="px-4 py-3">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {maquinasVisiveis.map((m) => {
              const agg = porMaquina.get(m.id);
              const teveAtividade = agg && (agg.tempoRodado > 0 || agg.tempoParado > 0);
              const eficiencia = eficienciaPorMaquina(m);
              const atrasado = eficiencia !== null && eficiencia < 1;
              const taxaQ = taxaAprovacao(agg);
              return (
                <tr key={m.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {m.codigo} — {m.nome}
                  </td>
                  <td className="px-4 py-3">{formatSegundos(agg?.tempoRodado ?? 0)}</td>
                  <td className="px-4 py-3">{formatSegundos(agg?.tempoParado ?? 0)}</td>
                  <td className="px-4 py-3">{formatSegundos(agg?.tempoPadraoGanho ?? 0)}</td>
                  <td className="px-4 py-3">{eficiencia !== null ? `${(eficiencia * 100).toFixed(0)}%` : "-"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-green-700">{agg?.qtdAprovada ?? 0}</span> /{" "}
                    <span className="text-red-700">{agg?.qtdReprovada ?? 0}</span> /{" "}
                    <span className="text-amber-700">{agg?.qtdRetrabalho ?? 0}</span>
                  </td>
                  <td className="px-4 py-3">{taxaQ !== null ? `${(taxaQ * 100).toFixed(0)}%` : "-"}</td>
                  <td className="px-4 py-3">
                    {!teveAtividade ? (
                      <span className="text-slate-500">Sem atividade</span>
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
            {maquinasVisiveis.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  Nenhuma máquina encontrada
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Operador</th>
              <th className="px-4 py-3">Tempo trabalhado</th>
              <th className="px-4 py-3">Tempo padrão (produzido)</th>
              <th className="px-4 py-3">Eficiência</th>
              <th className="px-4 py-3">Aprov./Reprov./Retrab.</th>
              <th className="px-4 py-3">Taxa qualidade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {operadoresVisiveis.map((o) => {
              const agg = porOperador.get(o.id);
              const eficiencia = eficienciaPorOperadorFn(agg);
              const taxaQ = taxaAprovacao(agg);
              return (
                <tr key={o.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{o.nome}</td>
                  <td className="px-4 py-3">{formatSegundos(agg?.tempoRodado ?? 0)}</td>
                  <td className="px-4 py-3">{formatSegundos(agg?.tempoPadraoGanho ?? 0)}</td>
                  <td className="px-4 py-3">{eficiencia !== null ? `${(eficiencia * 100).toFixed(0)}%` : "-"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-green-700">{agg?.qtdAprovada ?? 0}</span> /{" "}
                    <span className="text-red-700">{agg?.qtdReprovada ?? 0}</span> /{" "}
                    <span className="text-amber-700">{agg?.qtdRetrabalho ?? 0}</span>
                  </td>
                  <td className="px-4 py-3">{taxaQ !== null ? `${(taxaQ * 100).toFixed(0)}%` : "-"}</td>
                </tr>
              );
            })}
            {operadoresVisiveis.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Nenhum operador encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

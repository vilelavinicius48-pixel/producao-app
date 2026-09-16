import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABEL, STATUS_BADGE_CLASS } from "@/lib/op-status";
import { formatSegundos } from "@/lib/tempo";

function formatDataHora(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("pt-BR");
}

export default async function OPDetalhePage({
  params,
}: {
  params: Promise<{ numero: string }>;
}) {
  const { numero } = await params;
  const supabase = await createClient();

  const { data: op } = await supabase
    .from("ordens_producao")
    .select("*, pecas(*), maquinas(*)")
    .eq("numero", Number(numero))
    .single();

  if (!op) notFound();

  const peca = op.pecas as unknown as {
    id: string;
    codigo: string;
    descricao: string;
    tempo_padrao_segundos: number;
  };
  const maquina = op.maquinas as unknown as { codigo: string; nome: string };

  const { data: materiais } = await supabase
    .from("peca_materiais")
    .select("*")
    .eq("peca_id", peca.id);

  const { data: apontamentos } = await supabase
    .from("apontamentos")
    .select(
      "*, operadores(nome), inspecoes_qualidade(quantidade_aprovada, quantidade_reprovada, quantidade_retrabalho, observacao, avaliador_id, operadores(nome))"
    )
    .eq("op_id", op.id)
    .order("timestamp_start", { ascending: true });

  const { data: paradas } = await supabase
    .from("paradas")
    .select("*, motivos_parada(descricao)")
    .eq("op_id", op.id)
    .order("timestamp_inicio", { ascending: true });

  const produzidaTotal = (apontamentos ?? []).reduce((s, a) => s + (a.quantidade_produzida ?? 0), 0);
  const refugadaTotal = (apontamentos ?? []).reduce((s, a) => s + (a.quantidade_refugada ?? 0), 0);
  const tempoRodadoTotalSegundos = (apontamentos ?? []).reduce((s, a) => {
    if (!a.timestamp_stop) return s;
    return s + (new Date(a.timestamp_stop).getTime() - new Date(a.timestamp_start).getTime()) / 1000;
  }, 0);
  const saldo = op.quantidade_planejada - produzidaTotal;
  const eficienciaGlobal =
    tempoRodadoTotalSegundos > 0
      ? (peca.tempo_padrao_segundos * produzidaTotal) / tempoRodadoTotalSegundos
      : null;
  const tempoRestanteSegundos = saldo > 0 ? saldo * peca.tempo_padrao_segundos : 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">OP {op.numero}</h1>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_BADGE_CLASS[op.status]}`}>
          {STATUS_LABEL[op.status]}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        {peca.codigo} — {peca.descricao} · Máquina {maquina.codigo} — {maquina.nome}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-600">Qtd. planejada</p>
          <p className="text-lg font-semibold text-slate-900">{op.quantidade_planejada}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-600">Produzido / Refugado</p>
          <p className="text-lg font-semibold text-slate-900">
            {produzidaTotal} / {refugadaTotal}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-600">Saldo</p>
          <p className="text-lg font-semibold text-slate-900">{Math.max(saldo, 0)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-600">Eficiência</p>
          <p className="text-lg font-semibold text-slate-900">
            {eficienciaGlobal !== null ? `${(eficienciaGlobal * 100).toFixed(0)}%` : "-"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-600">Tempo estimado</p>
          <p className="text-lg font-semibold text-slate-900">{formatSegundos(op.tempo_estimado_segundos)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-600">Tempo rodado</p>
          <p className="text-lg font-semibold text-slate-900">{formatSegundos(tempoRodadoTotalSegundos)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-600">Tempo restante (estimado)</p>
          <p className="text-lg font-semibold text-slate-900">{formatSegundos(tempoRestanteSegundos)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-600">Criada em</p>
          <p className="text-lg font-semibold text-slate-900">{formatDataHora(op.created_at)}</p>
        </div>
      </div>

      {materiais && materiais.length > 0 && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Material necessário total</h2>
          <ul className="space-y-1 text-sm text-slate-700">
            {materiais.map((m) => (
              <li key={m.id}>
                {m.material}: {(m.quantidade_por_unidade * op.quantidade_planejada).toFixed(2)} {m.unidade_medida}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Apontamentos</h2>
        {apontamentos && apontamentos.length > 0 ? (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-slate-600">
              <tr>
                <th className="py-1 pr-3">Operador</th>
                <th className="py-1 pr-3">Início</th>
                <th className="py-1 pr-3">Fim</th>
                <th className="py-1 pr-3">Esperado</th>
                <th className="py-1 pr-3">Produzido</th>
                <th className="py-1 pr-3">Refugado</th>
                <th className="py-1 pr-3">Eficiência</th>
                <th className="py-1 pr-3">Qualidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {apontamentos.map((a) => {
                const operador = a.operadores as unknown as { nome: string } | null;
                const inspecao = a.inspecoes_qualidade as unknown as {
                  quantidade_aprovada: number;
                  quantidade_reprovada: number;
                  quantidade_retrabalho: number;
                  observacao: string | null;
                  operadores: { nome: string } | null;
                } | null;
                const duracaoSegundos = a.timestamp_stop
                  ? (new Date(a.timestamp_stop).getTime() - new Date(a.timestamp_start).getTime()) / 1000
                  : null;
                const esperado =
                  duracaoSegundos !== null ? Math.round(duracaoSegundos / peca.tempo_padrao_segundos) : null;
                return (
                  <tr key={a.id}>
                    <td className="py-1 pr-3">{operador?.nome ?? "-"}</td>
                    <td className="py-1 pr-3">{formatDataHora(a.timestamp_start)}</td>
                    <td className="py-1 pr-3">{a.timestamp_stop ? formatDataHora(a.timestamp_stop) : "em andamento"}</td>
                    <td className="py-1 pr-3">{esperado ?? "-"}</td>
                    <td className="py-1 pr-3">{a.quantidade_produzida ?? "-"}</td>
                    <td className="py-1 pr-3">{a.quantidade_refugada ?? "-"}</td>
                    <td className="py-1 pr-3">
                      {a.eficiencia !== null ? `${(a.eficiencia * 100).toFixed(0)}%` : "-"}
                    </td>
                    <td className="py-1 pr-3">
                      {inspecao ? (
                        <span className="whitespace-nowrap">
                          <span className="text-green-700">A:{inspecao.quantidade_aprovada}</span>{" "}
                          <span className="text-red-700">R:{inspecao.quantidade_reprovada}</span>{" "}
                          <span className="text-amber-700">Rt:{inspecao.quantidade_retrabalho}</span>
                        </span>
                      ) : (
                        "pendente"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Nenhum apontamento ainda</p>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Paradas</h2>
        {paradas && paradas.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="text-slate-600">
              <tr>
                <th className="py-1 pr-3">Início</th>
                <th className="py-1 pr-3">Fim</th>
                <th className="py-1 pr-3">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paradas.map((p) => {
                const motivo = p.motivos_parada as unknown as { descricao: string } | null;
                return (
                  <tr key={p.id}>
                    <td className="py-1 pr-3">{formatDataHora(p.timestamp_inicio)}</td>
                    <td className="py-1 pr-3">{p.timestamp_fim ? formatDataHora(p.timestamp_fim) : "em aberto"}</td>
                    <td className="py-1 pr-3">{motivo?.descricao ?? "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-500">Nenhuma parada registrada</p>
        )}
      </div>
    </div>
  );
}

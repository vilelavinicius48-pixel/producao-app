import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABEL, STATUS_BADGE_CLASS } from "@/lib/op-status";

function formatMinutos(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h${m.toString().padStart(2, "0")}min`;
}

function formatDataHora(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("pt-BR");
}

const RESULTADO_LABEL: Record<string, string> = {
  aprovado: "Aprovado",
  reprovado: "Reprovado",
  retrabalho: "Retrabalho",
};

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
    tempo_padrao_por_unidade: number;
  };
  const maquina = op.maquinas as unknown as { codigo: string; nome: string };

  const { data: materiais } = await supabase
    .from("peca_materiais")
    .select("*")
    .eq("peca_id", peca.id);

  const { data: apontamentos } = await supabase
    .from("apontamentos")
    .select("*, operadores(nome), inspecoes_qualidade(resultado, observacao, avaliador_id, operadores(nome))")
    .eq("op_id", op.id)
    .order("timestamp_start", { ascending: true });

  const { data: paradas } = await supabase
    .from("paradas")
    .select("*, motivos_parada(descricao)")
    .eq("op_id", op.id)
    .order("timestamp_inicio", { ascending: true });

  const produzidaTotal = (apontamentos ?? []).reduce((s, a) => s + (a.quantidade_produzida ?? 0), 0);
  const refugadaTotal = (apontamentos ?? []).reduce((s, a) => s + (a.quantidade_refugada ?? 0), 0);
  const tempoRodadoTotal = (apontamentos ?? []).reduce((s, a) => {
    if (!a.timestamp_stop) return s;
    return s + (new Date(a.timestamp_stop).getTime() - new Date(a.timestamp_start).getTime()) / 60000;
  }, 0);
  const saldo = op.quantidade_planejada - produzidaTotal;
  const eficienciaGlobal =
    tempoRodadoTotal > 0 ? (peca.tempo_padrao_por_unidade * produzidaTotal) / tempoRodadoTotal : null;
  const tempoRestanteMin = saldo > 0 ? saldo * peca.tempo_padrao_por_unidade : 0;

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
          <p className="text-xs text-slate-500">Qtd. planejada</p>
          <p className="text-lg font-semibold text-slate-900">{op.quantidade_planejada}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Produzido / Refugado</p>
          <p className="text-lg font-semibold text-slate-900">
            {produzidaTotal} / {refugadaTotal}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Saldo</p>
          <p className="text-lg font-semibold text-slate-900">{Math.max(saldo, 0)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Eficiência</p>
          <p className="text-lg font-semibold text-slate-900">
            {eficienciaGlobal !== null ? `${(eficienciaGlobal * 100).toFixed(0)}%` : "-"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Tempo estimado</p>
          <p className="text-lg font-semibold text-slate-900">{formatMinutos(op.tempo_estimado_minutos)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Tempo rodado</p>
          <p className="text-lg font-semibold text-slate-900">{formatMinutos(tempoRodadoTotal)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Tempo restante (estimado)</p>
          <p className="text-lg font-semibold text-slate-900">{formatMinutos(tempoRestanteMin)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Criada em</p>
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
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 pr-3">Operador</th>
                <th className="py-1 pr-3">Início</th>
                <th className="py-1 pr-3">Fim</th>
                <th className="py-1 pr-3">Produzido</th>
                <th className="py-1 pr-3">Refugado</th>
                <th className="py-1 pr-3">Eficiência</th>
                <th className="py-1 pr-3">Qualidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {apontamentos.map((a) => {
                const operador = a.operadores as unknown as { nome: string } | null;
                const inspecoes = a.inspecoes_qualidade as unknown as
                  | { resultado: string; observacao: string | null; operadores: { nome: string } | null }[]
                  | null;
                const inspecao = inspecoes?.[0];
                return (
                  <tr key={a.id}>
                    <td className="py-1 pr-3">{operador?.nome ?? "-"}</td>
                    <td className="py-1 pr-3">{formatDataHora(a.timestamp_start)}</td>
                    <td className="py-1 pr-3">{a.timestamp_stop ? formatDataHora(a.timestamp_stop) : "em andamento"}</td>
                    <td className="py-1 pr-3">{a.quantidade_produzida ?? "-"}</td>
                    <td className="py-1 pr-3">{a.quantidade_refugada ?? "-"}</td>
                    <td className="py-1 pr-3">
                      {a.eficiencia !== null ? `${(a.eficiencia * 100).toFixed(0)}%` : "-"}
                    </td>
                    <td className="py-1 pr-3">
                      {inspecao ? RESULTADO_LABEL[inspecao.resultado] : "pendente"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-400">Nenhum apontamento ainda</p>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Paradas</h2>
        {paradas && paradas.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500">
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
          <p className="text-sm text-slate-400">Nenhuma parada registrada</p>
        )}
      </div>
    </div>
  );
}

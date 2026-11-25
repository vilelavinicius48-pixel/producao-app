import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOperador } from "@/lib/auth";
import { formatData, formatQtdPecas } from "@/lib/pcp/carteira";
import { STATUS_BADGE_CLASS, STATUS_LABEL } from "@/lib/op-status";
import { SubloteAcoes } from "./SubloteAcoes";

const SUBLOTE_STATUS_LABEL: Record<string, string> = {
  aguardando_etapa: "Aguardando etapa",
  em_etapa: "Em andamento",
  aguardando_decisao: "Aguardando decisão",
  concluida: "Concluída",
  mesclada: "Mesclado em outro sublote",
  transferida: "Virou OP de 2ª operação",
};

const QUALIDADE_CLASS: Record<string, string> = {
  em_processo: "bg-slate-100 text-slate-700 border-slate-300",
  aprovado: "bg-emerald-100 text-emerald-800 border-emerald-300",
  reprovado: "bg-pink-100 text-pink-800 border-pink-300",
  retrabalho: "bg-amber-100 text-amber-800 border-amber-300",
};

export default async function OPCelularPage({ params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params;
  await requireOperador();
  const supabase = await createClient();

  const { data: op } = await supabase
    .from("ordens_producao")
    .select("*, pecas(codigo, descricao), maquinas(nome), pedido_itens(cliente, data_entrega)")
    .eq("numero", Number(numero))
    .single();
  if (!op) notFound();

  const peca = op.pecas as unknown as { codigo: string; descricao: string } | null;
  const maquina = op.maquinas as unknown as { nome: string } | null;
  const pedido = op.pedido_itens as unknown as { cliente: string; data_entrega: string } | null;

  const [{ data: sublotes }, { data: operadores }, { data: motivos }] = await Promise.all([
    supabase
      .from("sublotes")
      .select(
        "id, quantidade, horario, status, qualidade_status, operadores(nome), roteiro_atual:peca_roteiro_etapas(etapa:etapas(nome))"
      )
      .eq("op_id", op.id)
      .order("horario", { ascending: true }),
    supabase.from("operadores").select("*").eq("perfil", "operador").eq("ativo", true).order("nome"),
    supabase.from("motivos_refugo").select("*").eq("ativo", true).order("descricao"),
  ]);

  const subloteIds = (sublotes ?? []).map((s) => s.id);
  const { data: etapasAtivas } =
    subloteIds.length > 0
      ? await supabase
          .from("sublote_etapas")
          .select(
            "id, sublote_id, status, etapas(nome, tipo), peca_roteiro_etapas(maquina_id, maquinas(nome))"
          )
          .in("sublote_id", subloteIds)
          .neq("status", "concluida")
      : { data: [] };

  const etapaPorSublote = new Map(
    (etapasAtivas ?? []).map((e) => {
      const etapa = e.etapas as unknown as { nome: string; tipo: string } | null;
      const roteiroEtapa = e.peca_roteiro_etapas as unknown as {
        maquina_id: string | null;
        maquinas: { nome: string } | null;
      } | null;
      return [
        e.sublote_id,
        {
          subloteEtapaId: e.id as string,
          status: e.status as "aguardando" | "em_andamento",
          etapaNome: etapa?.nome ?? "-",
          etapaTipo: etapa?.tipo ?? "manual",
          maquinaNome: roteiroEtapa?.maquinas?.nome ?? null,
        },
      ];
    })
  );

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">OP {op.numero}</h1>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_BADGE_CLASS[op.status]}`}>
            {STATUS_LABEL[op.status]}
          </span>
        </div>
        <p className="mt-1 text-base text-slate-700">
          {peca?.codigo} — {peca?.descricao}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Máquina {maquina?.nome} · {formatQtdPecas(Number(op.quantidade_planejada))} pç
          {pedido && (
            <>
              {" "}
              · {pedido.cliente} · entrega {formatData(pedido.data_entrega)}
            </>
          )}
        </p>
      </div>

      <h2 className="mt-6 text-lg font-semibold text-slate-900">Sublotes</h2>
      <div className="mt-3 space-y-3">
        {(sublotes ?? []).map((s) => {
          const operador = s.operadores as unknown as { nome: string } | null;
          const roteiroAtual = s.roteiro_atual as unknown as { etapa: { nome: string } | null } | null;
          const dataHora = new Date(s.horario);
          const etapaAtiva = etapaPorSublote.get(s.id) ?? null;
          return (
            <div key={s.id} className={`rounded-xl border-2 bg-white p-4 ${QUALIDADE_CLASS[s.qualidade_status]}`}>
              <div className="flex items-center justify-between">
                <p className="text-base font-semibold text-slate-900">{operador?.nome ?? "-"}</p>
                <span className="text-sm text-slate-600">
                  {dataHora.toLocaleDateString("pt-BR")} {dataHora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="mt-1 text-2xl font-bold text-slate-900">{formatQtdPecas(Number(s.quantidade))} pç</p>
              <p className="mt-1 text-sm text-slate-700">
                {SUBLOTE_STATUS_LABEL[s.status] ?? s.status}
                {s.status !== "concluida" && s.status !== "mesclada" && s.status !== "transferida" && roteiroAtual?.etapa && (
                  <> · etapa: {roteiroAtual.etapa.nome}</>
                )}
              </p>

              <SubloteAcoes
                numero={numero}
                quantidade={Number(s.quantidade)}
                etapaAtiva={etapaAtiva}
                operadores={operadores ?? []}
                motivos={motivos ?? []}
              />
            </div>
          );
        })}
        {(sublotes ?? []).length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
            Nenhum sublote ainda. Ele aparece aqui sozinho quando um apontamento fecha nessa OP.
          </p>
        )}
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOperador } from "@/lib/auth";
import { formatData, formatQtd } from "@/lib/pcp/carteira";
import { STATUS_BADGE_CLASS, STATUS_LABEL } from "@/lib/op-status";

const CAIXA_STATUS_LABEL: Record<string, string> = {
  aguardando_etapa: "Aguardando etapa",
  em_etapa: "Em andamento",
  aguardando_decisao: "Aguardando decisão",
  concluida: "Concluída",
  mesclada: "Mesclada em outra caixa",
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

  const { data: caixas } = await supabase
    .from("caixas")
    .select(
      "id, quantidade, horario, status, qualidade_status, operadores(nome), roteiro_atual:peca_roteiro_etapas(etapa:etapas(nome))"
    )
    .eq("op_id", op.id)
    .order("horario", { ascending: true });

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
          Máquina {maquina?.nome} · {formatQtd(Number(op.quantidade_planejada))} pç
          {pedido && (
            <>
              {" "}
              · {pedido.cliente} · entrega {formatData(pedido.data_entrega)}
            </>
          )}
        </p>
      </div>

      <h2 className="mt-6 text-lg font-semibold text-slate-900">Caixas</h2>
      <div className="mt-3 space-y-3">
        {(caixas ?? []).map((c) => {
          const operador = c.operadores as unknown as { nome: string } | null;
          const roteiroAtual = c.roteiro_atual as unknown as { etapa: { nome: string } | null } | null;
          const dataHora = new Date(c.horario);
          return (
            <div key={c.id} className={`rounded-xl border-2 bg-white p-4 ${QUALIDADE_CLASS[c.qualidade_status]}`}>
              <div className="flex items-center justify-between">
                <p className="text-base font-semibold text-slate-900">{operador?.nome ?? "-"}</p>
                <span className="text-sm text-slate-600">
                  {dataHora.toLocaleDateString("pt-BR")} {dataHora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="mt-1 text-2xl font-bold text-slate-900">{formatQtd(Number(c.quantidade))} pç</p>
              <p className="mt-1 text-sm text-slate-700">
                {CAIXA_STATUS_LABEL[c.status] ?? c.status}
                {c.status !== "concluida" && c.status !== "mesclada" && roteiroAtual?.etapa && (
                  <> · próxima etapa: {roteiroAtual.etapa.nome}</>
                )}
              </p>
            </div>
          );
        })}
        {(caixas ?? []).length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
            Nenhuma caixa ainda. Ela aparece aqui sozinha quando um apontamento fecha nessa OP.
          </p>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        Em breve: botões de Iniciar/Concluir etapa direto por aqui.
      </p>
    </div>
  );
}

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABEL, STATUS_BADGE_CLASS } from "@/lib/op-status";
import { ApontamentoAcoes } from "./ApontamentoAcoes";

export default async function ApontamentoOPPage({
  params,
}: {
  params: Promise<{ numero: string }>;
}) {
  const { numero } = await params;
  const supabase = await createClient();

  const { data: op } = await supabase
    .from("ordens_producao")
    .select("*, pecas(codigo, descricao), maquinas(codigo, nome)")
    .eq("numero", Number(numero))
    .single();

  if (!op) notFound();

  const peca = op.pecas as unknown as { codigo: string; descricao: string };
  const maquina = op.maquinas as unknown as { codigo: string; nome: string };

  const { data: apontamentoAberto } = await supabase
    .from("apontamentos")
    .select("id, timestamp_start, operadores(nome)")
    .eq("op_id", op.id)
    .is("timestamp_stop", null)
    .maybeSingle();

  const { data: setupAberto } = await supabase
    .from("setups")
    .select("id, timestamp_inicio, operadores(nome)")
    .eq("op_id", op.id)
    .is("timestamp_fim", null)
    .maybeSingle();

  const { data: paradaAberta } = await supabase
    .from("paradas")
    .select("timestamp_inicio")
    .eq("op_id", op.id)
    .is("timestamp_fim", null)
    .order("timestamp_inicio", { ascending: false })
    .maybeSingle();

  const { data: motivos } = await supabase
    .from("motivos_parada")
    .select("*")
    .eq("ativo", true)
    .order("descricao");

  const { data: operadores } = await supabase
    .from("operadores")
    .select("*")
    .eq("perfil", "operador")
    .eq("ativo", true)
    .order("nome");

  const { data: progresso } = await supabase
    .from("op_progresso")
    .select("*")
    .eq("op_id", op.id)
    .maybeSingle();

  const operadorInfo = apontamentoAberto?.operadores as unknown as { nome: string } | null;
  const setupOperadorInfo = setupAberto?.operadores as unknown as { nome: string } | null;

  return (
    <div className="mx-auto max-w-md">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">OP {op.numero}</h1>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_BADGE_CLASS[op.status]}`}>
          {STATUS_LABEL[op.status]}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        {peca.codigo} — {peca.descricao} · Máquina {maquina.codigo}
      </p>
      <p className="text-sm font-medium text-slate-700">
        Produzido: {progresso?.quantidade_produzida_total ?? 0} / {op.quantidade_planejada}
      </p>

      <div className="mt-6">
        <ApontamentoAcoes
          opId={op.id}
          numero={numero}
          status={op.status}
          setupConcluido={op.setup_concluido_em !== null}
          operadores={operadores ?? []}
          setupAberto={
            setupAberto
              ? {
                  id: setupAberto.id,
                  timestamp_inicio: setupAberto.timestamp_inicio,
                  operadorNome: setupOperadorInfo?.nome ?? "-",
                }
              : null
          }
          apontamentoAberto={
            apontamentoAberto
              ? {
                  id: apontamentoAberto.id,
                  timestamp_start: apontamentoAberto.timestamp_start,
                  operadorNome: operadorInfo?.nome ?? "-",
                }
              : null
          }
          paradaAberta={paradaAberta ?? null}
          motivos={motivos ?? []}
        />
      </div>
    </div>
  );
}

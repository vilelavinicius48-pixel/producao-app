import { notFound } from "next/navigation";
import { requireQualidade } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InspecaoForm } from "./InspecaoForm";

export default async function InspecionarPage({
  params,
}: {
  params: Promise<{ apontamentoId: string }>;
}) {
  await requireQualidade();
  const { apontamentoId } = await params;
  const supabase = await createClient();

  const { data: apontamento } = await supabase
    .from("apontamentos")
    .select(
      "id, timestamp_stop, quantidade_produzida, quantidade_refugada, operadores(nome), ordens_producao(numero, pecas(codigo, descricao)), inspecoes_qualidade(id)"
    )
    .eq("id", apontamentoId)
    .single();

  if (!apontamento || !apontamento.timestamp_stop) notFound();

  const jaInspecionado = (apontamento.inspecoes_qualidade as unknown as { id: string } | null) !== null;
  const op = apontamento.ordens_producao as unknown as {
    numero: number;
    pecas: { codigo: string; descricao: string };
  };
  const operador = apontamento.operadores as unknown as { nome: string } | null;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold text-slate-900">Inspeção de qualidade</h1>
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <p>
          OP {op.numero} — {op.pecas.codigo} {op.pecas.descricao}
        </p>
        <p>Operador: {operador?.nome ?? "-"}</p>
        <p>Produzido: {apontamento.quantidade_produzida} · Refugado: {apontamento.quantidade_refugada}</p>
      </div>

      {jaInspecionado ? (
        <p className="mt-6 text-slate-600">Este apontamento já foi inspecionado.</p>
      ) : (
        <InspecaoForm apontamentoId={apontamento.id} quantidadeProduzida={apontamento.quantidade_produzida ?? 0} />
      )}
    </div>
  );
}

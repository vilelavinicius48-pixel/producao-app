import { notFound } from "next/navigation";
import { requireQualidade } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InspecaoSubloteForm } from "./InspecaoSubloteForm";

export default async function InspecionarSubloteEtapaPage({
  params,
}: {
  params: Promise<{ subloteEtapaId: string }>;
}) {
  await requireQualidade();
  const { subloteEtapaId } = await params;
  const supabase = await createClient();

  const { data: etapa } = await supabase
    .from("sublote_etapas")
    .select(
      "id, status, etapas(nome), sublotes(quantidade, operadores(nome), ordens_producao(numero, pecas(codigo, descricao)))"
    )
    .eq("id", subloteEtapaId)
    .single();

  if (!etapa) notFound();

  const etapaInfo = etapa.etapas as unknown as { nome: string } | null;
  const sublote = etapa.sublotes as unknown as {
    quantidade: number;
    operadores: { nome: string } | null;
    ordens_producao: { numero: number; pecas: { codigo: string; descricao: string } } | null;
  } | null;
  const op = sublote?.ordens_producao;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold text-slate-900">Inspeção de qualidade — {etapaInfo?.nome ?? "etapa"}</h1>
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <p>{op ? `OP ${op.numero} — ${op.pecas.codigo} ${op.pecas.descricao}` : "-"}</p>
        <p>Operador do sublote: {sublote?.operadores?.nome ?? "-"}</p>
        <p>Quantidade no sublote: {sublote?.quantidade ?? 0}</p>
      </div>

      {etapa.status === "concluida" ? (
        <p className="mt-6 text-slate-600">Esta etapa já foi inspecionada.</p>
      ) : (
        <InspecaoSubloteForm subloteEtapaId={etapa.id} quantidade={Number(sublote?.quantidade ?? 0)} />
      )}
    </div>
  );
}

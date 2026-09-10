"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireQualidade } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ResultadoInspecao } from "@/types/database";

const RESULTADOS: ResultadoInspecao[] = ["aprovado", "reprovado", "retrabalho"];

export async function createInspecao(formData: FormData) {
  const avaliador = await requireQualidade();

  const apontamentoId = String(formData.get("apontamento_id"));
  const resultado = String(formData.get("resultado")) as ResultadoInspecao;
  const observacao = String(formData.get("observacao") ?? "").trim();

  if (!apontamentoId || !RESULTADOS.includes(resultado)) {
    throw new Error("Preencha o resultado da inspeção");
  }

  const supabase = await createClient();

  const { data: apontamento } = await supabase
    .from("apontamentos")
    .select("timestamp_stop")
    .eq("id", apontamentoId)
    .single();

  if (!apontamento?.timestamp_stop) {
    throw new Error("Só é possível inspecionar apontamentos já fechados");
  }

  const { error } = await supabase.from("inspecoes_qualidade").insert({
    apontamento_id: apontamentoId,
    resultado,
    observacao: observacao || null,
    avaliador_id: avaliador.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/qualidade");
  redirect("/qualidade");
}

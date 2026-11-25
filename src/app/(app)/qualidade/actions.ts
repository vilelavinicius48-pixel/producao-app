"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireQualidade } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function createInspecao(formData: FormData) {
  const avaliador = await requireQualidade();

  const apontamentoId = String(formData.get("apontamento_id"));
  const quantidadeAprovada = Number(formData.get("quantidade_aprovada") ?? 0);
  const quantidadeReprovada = Number(formData.get("quantidade_reprovada") ?? 0);
  const quantidadeRetrabalho = Number(formData.get("quantidade_retrabalho") ?? 0);
  const observacao = String(formData.get("observacao") ?? "").trim();

  if (
    !apontamentoId ||
    [quantidadeAprovada, quantidadeReprovada, quantidadeRetrabalho].some((q) => Number.isNaN(q) || q < 0)
  ) {
    throw new Error("Preencha as quantidades da inspeção (valores não negativos)");
  }
  if ([quantidadeAprovada, quantidadeReprovada, quantidadeRetrabalho].some((q) => !Number.isInteger(q))) {
    throw new Error("Quantidade de peças é sempre um número inteiro, sem vírgula");
  }

  const supabase = await createClient();

  const { data: apontamento } = await supabase
    .from("apontamentos")
    .select("timestamp_stop, quantidade_produzida")
    .eq("id", apontamentoId)
    .single();

  if (!apontamento?.timestamp_stop) {
    throw new Error("Só é possível inspecionar apontamentos já fechados");
  }

  const total = quantidadeAprovada + quantidadeReprovada + quantidadeRetrabalho;
  if (total > (apontamento.quantidade_produzida ?? 0) + 0.001) {
    throw new Error("A soma das quantidades não pode ser maior que a quantidade produzida no apontamento");
  }

  const { error } = await supabase.from("inspecoes_qualidade").insert({
    apontamento_id: apontamentoId,
    quantidade_aprovada: quantidadeAprovada,
    quantidade_reprovada: quantidadeReprovada,
    quantidade_retrabalho: quantidadeRetrabalho,
    observacao: observacao || null,
    avaliador_id: avaliador.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/qualidade");
  redirect("/qualidade");
}

export async function createInspecaoSublote(formData: FormData) {
  const avaliador = await requireQualidade();

  const subloteEtapaId = String(formData.get("sublote_etapa_id"));
  const quantidadeAprovada = Number(formData.get("quantidade_aprovada") ?? 0);
  const quantidadeReprovada = Number(formData.get("quantidade_reprovada") ?? 0);
  const quantidadeRetrabalho = Number(formData.get("quantidade_retrabalho") ?? 0);
  const observacao = String(formData.get("observacao") ?? "").trim();

  if (
    !subloteEtapaId ||
    [quantidadeAprovada, quantidadeReprovada, quantidadeRetrabalho].some((q) => Number.isNaN(q) || q < 0)
  ) {
    throw new Error("Preencha as quantidades da inspeção (valores não negativos)");
  }
  if ([quantidadeAprovada, quantidadeReprovada, quantidadeRetrabalho].some((q) => !Number.isInteger(q))) {
    throw new Error("Quantidade de peças é sempre um número inteiro, sem vírgula");
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("concluir_inspecao_sublote", {
    p_sublote_etapa_id: subloteEtapaId,
    p_avaliador_id: avaliador.id,
    p_quantidade_aprovada: quantidadeAprovada,
    p_quantidade_reprovada: quantidadeReprovada,
    p_quantidade_retrabalho: quantidadeRetrabalho,
    p_observacao: observacao || null,
  });
  if (error) throw new Error(error.message.replace(/^.*ERROR:\s*/i, ""));

  revalidatePath("/qualidade");
  redirect("/qualidade");
}

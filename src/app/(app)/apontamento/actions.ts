"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOperador } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function friendlyError(message: string): never {
  throw new Error(message.replace(/^.*ERROR:\s*/i, ""));
}

export async function iniciarApontamentoAction(formData: FormData) {
  await requireOperador();
  const opId = String(formData.get("op_id"));
  const numero = String(formData.get("numero"));
  const operadorId = String(formData.get("operador_id") ?? "");

  if (!operadorId) throw new Error("Selecione o operador");

  const supabase = await createClient();
  const { error } = await supabase.rpc("iniciar_apontamento", {
    p_op_id: opId,
    p_operador_id: operadorId,
  });
  if (error) friendlyError(error.message);

  revalidatePath(`/apontamento/${numero}`);
  redirect(`/apontamento/${numero}`);
}

export async function pararProducaoAction(formData: FormData) {
  await requireOperador();
  const apontamentoId = String(formData.get("apontamento_id"));
  const numero = String(formData.get("numero"));
  const quantidadeProduzida = Number(formData.get("quantidade_produzida"));
  const quantidadeRefugada = Number(formData.get("quantidade_refugada"));

  const supabase = await createClient();
  const { error } = await supabase.rpc("parar_producao", {
    p_apontamento_id: apontamentoId,
    p_quantidade_produzida: quantidadeProduzida,
    p_quantidade_refugada: quantidadeRefugada,
  });
  if (error) friendlyError(error.message);

  revalidatePath(`/apontamento/${numero}`);
  redirect(`/apontamento/${numero}`);
}

export async function pausarProducaoAction(formData: FormData) {
  await requireOperador();
  const apontamentoId = String(formData.get("apontamento_id"));
  const numero = String(formData.get("numero"));
  const quantidadeProduzida = Number(formData.get("quantidade_produzida"));
  const quantidadeRefugada = Number(formData.get("quantidade_refugada"));

  const supabase = await createClient();
  const { error } = await supabase.rpc("pausar_producao", {
    p_apontamento_id: apontamentoId,
    p_quantidade_produzida: quantidadeProduzida,
    p_quantidade_refugada: quantidadeRefugada,
  });
  if (error) friendlyError(error.message);

  revalidatePath(`/apontamento/${numero}`);
  redirect(`/apontamento/${numero}`);
}

export async function voltarParadaAction(formData: FormData) {
  await requireOperador();
  const opId = String(formData.get("op_id"));
  const numero = String(formData.get("numero"));
  const motivoId = String(formData.get("motivo_id"));
  const operadorId = String(formData.get("operador_id") ?? "");

  if (!operadorId) throw new Error("Selecione o operador");

  const supabase = await createClient();
  const { error } = await supabase.rpc("voltar_parada", {
    p_op_id: opId,
    p_motivo_id: motivoId,
    p_operador_id: operadorId,
  });
  if (error) friendlyError(error.message);

  revalidatePath(`/apontamento/${numero}`);
  redirect(`/apontamento/${numero}`);
}

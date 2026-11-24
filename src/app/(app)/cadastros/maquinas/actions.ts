"use server";

import { revalidatePath } from "next/cache";
import { requireGestor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function createMaquina(formData: FormData) {
  await requireGestor();
  const codigo = String(formData.get("codigo") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();

  if (!codigo || !nome) {
    throw new Error("Código e nome são obrigatórios");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("maquinas").insert({ codigo, nome });
  if (error) throw new Error(error.message);

  revalidatePath("/cadastros/maquinas");
}

export async function toggleMaquinaAtiva(formData: FormData) {
  await requireGestor();
  const id = String(formData.get("id"));
  const ativo = formData.get("ativo") === "true";

  const supabase = await createClient();
  const { error } = await supabase.from("maquinas").update({ ativo }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/cadastros/maquinas");
}

/** Tamanho de barra que a máquina usa (mm) + sobra de ponta que não dá pra aproveitar. Deixe vazio se a máquina não trabalha com barra. */
export async function atualizarBarraMaquina(formData: FormData) {
  await requireGestor();
  const id = String(formData.get("id") ?? "");
  const comprimentoStr = String(formData.get("barra_comprimento_mm") ?? "").replace(",", ".").trim();
  const sobraStr = String(formData.get("barra_sobra_mm") ?? "").replace(",", ".").trim();
  if (!id) throw new Error("Máquina não encontrada");

  const comprimento = comprimentoStr ? Number(comprimentoStr) : null;
  const sobra = sobraStr ? Number(sobraStr) : 0;
  if (comprimento !== null && (!Number.isFinite(comprimento) || comprimento <= 0)) {
    throw new Error("Tamanho de barra inválido");
  }
  if (!Number.isFinite(sobra) || sobra < 0) throw new Error("Sobra de ponta inválida");

  const supabase = await createClient();
  const { error } = await supabase
    .from("maquinas")
    .update({ barra_comprimento_mm: comprimento, barra_sobra_mm: sobra })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/cadastros/maquinas");
}

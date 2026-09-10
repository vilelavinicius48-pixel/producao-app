"use server";

import { revalidatePath } from "next/cache";
import { requireGestor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function createMotivoParada(formData: FormData) {
  await requireGestor();
  const descricao = String(formData.get("descricao") ?? "").trim();
  if (!descricao) throw new Error("Descrição é obrigatória");

  const supabase = await createClient();
  const { error } = await supabase.from("motivos_parada").insert({ descricao });
  if (error) throw new Error(error.message);

  revalidatePath("/cadastros/motivos-parada");
}

export async function toggleMotivoParadaAtivo(formData: FormData) {
  await requireGestor();
  const id = String(formData.get("id"));
  const ativo = formData.get("ativo") === "true";

  const supabase = await createClient();
  const { error } = await supabase.from("motivos_parada").update({ ativo }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/cadastros/motivos-parada");
}

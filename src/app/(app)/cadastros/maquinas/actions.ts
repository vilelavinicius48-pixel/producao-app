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

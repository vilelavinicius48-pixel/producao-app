"use server";

import { revalidatePath } from "next/cache";
import { requireGestor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function createFornecedor(formData: FormData) {
  await requireGestor();
  const nome = String(formData.get("nome") ?? "").trim();
  const contato = String(formData.get("contato") ?? "").trim() || null;
  if (!nome) throw new Error("Nome é obrigatório");

  const supabase = await createClient();
  const { error } = await supabase.from("fornecedores").insert({ nome, contato });
  if (error) throw new Error(error.message);

  revalidatePath("/cadastros/fornecedores");
}

export async function toggleFornecedorAtivo(formData: FormData) {
  await requireGestor();
  const id = String(formData.get("id"));
  const ativo = formData.get("ativo") === "true";

  const supabase = await createClient();
  const { error } = await supabase.from("fornecedores").update({ ativo }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/cadastros/fornecedores");
}

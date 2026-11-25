"use server";

import { revalidatePath } from "next/cache";
import { requireGestor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TipoEtapa } from "@/types/database";

const TIPOS_VALIDOS: TipoEtapa[] = ["manual", "maquina", "externo", "inspecao"];

export async function createEtapa(formData: FormData) {
  await requireGestor();
  const nome = String(formData.get("nome") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "") as TipoEtapa;
  if (!nome) throw new Error("Nome é obrigatório");
  if (!TIPOS_VALIDOS.includes(tipo)) throw new Error("Tipo inválido");

  const supabase = await createClient();
  const { error } = await supabase.from("etapas").insert({ nome, tipo });
  if (error) throw new Error(error.message);

  revalidatePath("/cadastros/etapas");
}

export async function toggleEtapaAtiva(formData: FormData) {
  await requireGestor();
  const id = String(formData.get("id"));
  const ativo = formData.get("ativo") === "true";

  const supabase = await createClient();
  const { error } = await supabase.from("etapas").update({ ativo }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/cadastros/etapas");
}

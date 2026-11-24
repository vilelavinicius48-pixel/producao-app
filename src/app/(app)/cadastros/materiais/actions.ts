"use server";

import { revalidatePath } from "next/cache";
import { requireGestor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { FormatoMaterial } from "@/types/database";

const FORMATOS: FormatoMaterial[] = ["redonda", "sextavada", "quadrada", "retangular", "tubo", "chapa"];

function numeroOuNulo(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").replace(",", ".").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function createMaterial(formData: FormData) {
  await requireGestor();
  const formato = String(formData.get("formato") ?? "") as FormatoMaterial;
  const tipo = String(formData.get("tipo") ?? "").trim();
  const medidaA = numeroOuNulo(formData.get("medida_a_mm"));
  const medidaB = numeroOuNulo(formData.get("medida_b_mm"));
  const espessura = numeroOuNulo(formData.get("espessura_mm"));

  if (!FORMATOS.includes(formato)) throw new Error("Formato inválido");
  if (!tipo) throw new Error("Informe o tipo do material");
  if (medidaA === null || medidaA <= 0) throw new Error("Medida principal é obrigatória");
  if ((formato === "retangular" || formato === "tubo" || formato === "chapa") && (medidaB === null || medidaB <= 0)) {
    throw new Error("Esse formato precisa da segunda medida");
  }
  if (formato === "chapa" && (espessura === null || espessura <= 0)) {
    throw new Error("Chapa precisa da espessura");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("materiais").insert({
    formato,
    tipo,
    medida_a_mm: medidaA,
    medida_b_mm: medidaB,
    espessura_mm: formato === "chapa" ? espessura : null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/cadastros/materiais");
}

/** Corrige um material já cadastrado (ex.: a importação da planilha entendeu tipo/medida errado). */
export async function atualizarMaterial(formData: FormData) {
  await requireGestor();
  const id = String(formData.get("id") ?? "");
  const tipo = String(formData.get("tipo") ?? "").trim();
  const medidaA = numeroOuNulo(formData.get("medida_a_mm"));
  const medidaB = numeroOuNulo(formData.get("medida_b_mm"));
  const espessura = numeroOuNulo(formData.get("espessura_mm"));

  if (!id) throw new Error("Material não encontrado");
  if (!tipo) throw new Error("Informe o tipo do material");
  if (medidaA === null || medidaA <= 0) throw new Error("Medida principal é obrigatória");

  const supabase = await createClient();
  const { data: material } = await supabase.from("materiais").select("formato").eq("id", id).single();
  if (!material) throw new Error("Material não encontrado");

  const { error } = await supabase
    .from("materiais")
    .update({
      tipo,
      medida_a_mm: medidaA,
      medida_b_mm: medidaB,
      espessura_mm: material.formato === "chapa" ? espessura : null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/cadastros/materiais");
}

export async function toggleMaterialAtivo(formData: FormData) {
  await requireGestor();
  const id = String(formData.get("id"));
  const ativo = formData.get("ativo") === "true";

  const supabase = await createClient();
  const { error } = await supabase.from("materiais").update({ ativo }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/cadastros/materiais");
}

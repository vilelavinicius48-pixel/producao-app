"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireGestor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function createPeca(formData: FormData) {
  await requireGestor();

  const codigo = String(formData.get("codigo") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const tempoPadrao = Number(formData.get("tempo_padrao_segundos"));
  const maquinaIds = formData.getAll("maquina_id").map(String);

  const materiais = formData.get("materiais_json")
    ? (JSON.parse(String(formData.get("materiais_json"))) as Array<{
        material: string;
        quantidade_por_unidade: number;
        unidade_medida: string;
      }>)
    : [];

  if (!codigo || !descricao || !tempoPadrao || tempoPadrao <= 0) {
    throw new Error("Código, descrição e tempo padrão (> 0) são obrigatórios");
  }
  if (maquinaIds.length === 0) {
    throw new Error("Selecione ao menos uma máquina compatível");
  }

  const supabase = await createClient();

  const { data: peca, error } = await supabase
    .from("pecas")
    .insert({ codigo, descricao, tempo_padrao_segundos: tempoPadrao })
    .select("id")
    .single();

  if (error || !peca) throw new Error(error?.message ?? "Falha ao criar peça");

  const { error: errMaquinas } = await supabase
    .from("pecas_maquinas")
    .insert(maquinaIds.map((maquina_id) => ({ peca_id: peca.id, maquina_id })));
  if (errMaquinas) throw new Error(errMaquinas.message);

  const materiaisValidos = materiais.filter(
    (m) => m.material?.trim() && m.quantidade_por_unidade > 0
  );
  if (materiaisValidos.length > 0) {
    const { error: errMateriais } = await supabase.from("peca_materiais").insert(
      materiaisValidos.map((m) => ({
        peca_id: peca.id,
        material: m.material.trim(),
        quantidade_por_unidade: m.quantidade_por_unidade,
        unidade_medida: m.unidade_medida?.trim() || "un",
      }))
    );
    if (errMateriais) throw new Error(errMateriais.message);
  }

  revalidatePath("/cadastros/pecas");
  redirect("/cadastros/pecas");
}

export async function togglePecaAtiva(formData: FormData) {
  await requireGestor();
  const id = String(formData.get("id"));
  const ativo = formData.get("ativo") === "true";

  const supabase = await createClient();
  const { error } = await supabase.from("pecas").update({ ativo }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/cadastros/pecas");
}

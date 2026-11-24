"use server";

import { redirect } from "next/navigation";
import { requireGestor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { criarOPPlanejada } from "@/lib/pcp/criar-op";

export async function createOP(formData: FormData) {
  const gestor = await requireGestor();

  const pecaId = String(formData.get("peca_id") ?? "");
  const maquinaId = String(formData.get("maquina_id") ?? "");
  const quantidadePlanejada = Number(formData.get("quantidade_planejada"));

  if (!pecaId || !maquinaId || !quantidadePlanejada || quantidadePlanejada <= 0) {
    throw new Error("Selecione peça, máquina e uma quantidade válida");
  }

  const supabase = await createClient();
  const numero = await criarOPPlanejada(supabase, {
    pecaId,
    maquinaId,
    quantidade: quantidadePlanejada,
    criadoPor: gestor.id,
  });

  redirect(`/ordens/${numero}`);
}

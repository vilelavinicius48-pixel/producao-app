"use server";

import { redirect } from "next/navigation";
import { requireGestor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function createOP(formData: FormData) {
  const gestor = await requireGestor();

  const pecaId = String(formData.get("peca_id") ?? "");
  const maquinaId = String(formData.get("maquina_id") ?? "");
  const quantidadePlanejada = Number(formData.get("quantidade_planejada"));

  if (!pecaId || !maquinaId || !quantidadePlanejada || quantidadePlanejada <= 0) {
    throw new Error("Selecione peça, máquina e uma quantidade válida");
  }

  const supabase = await createClient();

  const { data: peca, error: pecaError } = await supabase
    .from("pecas")
    .select("tempo_padrao_por_unidade")
    .eq("id", pecaId)
    .single();
  if (pecaError || !peca) throw new Error("Peça não encontrada");

  const { data: compat, error: compatError } = await supabase
    .from("pecas_maquinas")
    .select("maquina_id")
    .eq("peca_id", pecaId)
    .eq("maquina_id", maquinaId)
    .maybeSingle();
  if (compatError) throw new Error(compatError.message);
  if (!compat) throw new Error("Máquina selecionada não é compatível com a peça");

  const tempoEstimadoMinutos = peca.tempo_padrao_por_unidade * quantidadePlanejada;

  const { data: op, error } = await supabase
    .from("ordens_producao")
    .insert({
      peca_id: pecaId,
      maquina_id: maquinaId,
      quantidade_planejada: quantidadePlanejada,
      tempo_estimado_minutos: tempoEstimadoMinutos,
      criado_por: gestor.id,
    })
    .select("numero")
    .single();

  if (error || !op) throw new Error(error?.message ?? "Falha ao criar OP");

  redirect(`/ordens/${op.numero}`);
}

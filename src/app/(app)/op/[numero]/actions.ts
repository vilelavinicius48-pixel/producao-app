"use server";

import { revalidatePath } from "next/cache";
import { requireOperador } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { criarOPPlanejada } from "@/lib/pcp/criar-op";

function friendlyError(message: string): never {
  throw new Error(message.replace(/^.*ERROR:\s*/i, ""));
}

export async function iniciarEtapaSubloteAction(formData: FormData) {
  await requireOperador();
  const subloteEtapaId = String(formData.get("sublote_etapa_id"));
  const numero = String(formData.get("numero"));
  const operadorId = String(formData.get("operador_id") ?? "");

  if (!operadorId) throw new Error("Selecione o operador");

  const supabase = await createClient();
  const { error } = await supabase.rpc("iniciar_etapa_sublote", {
    p_sublote_etapa_id: subloteEtapaId,
    p_operador_id: operadorId,
  });
  if (error) friendlyError(error.message);

  revalidatePath(`/op/${numero}`);
}

export async function concluirEtapaSubloteAction(formData: FormData) {
  await requireOperador();
  const subloteEtapaId = String(formData.get("sublote_etapa_id"));
  const numero = String(formData.get("numero"));
  const operadorId = String(formData.get("operador_id") ?? "");
  const quantidadeBoa = Number(formData.get("quantidade_boa"));
  const quantidadeRefugo = Number(formData.get("quantidade_refugo") ?? 0);
  const motivoRefugoId = String(formData.get("motivo_refugo_id") ?? "") || null;

  if (!operadorId) throw new Error("Selecione o operador");
  if (!Number.isInteger(quantidadeBoa) || !Number.isInteger(quantidadeRefugo)) {
    throw new Error("Quantidade de peças é sempre um número inteiro, sem vírgula");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("concluir_etapa_sublote", {
    p_sublote_etapa_id: subloteEtapaId,
    p_operador_id: operadorId,
    p_quantidade_boa: quantidadeBoa,
    p_quantidade_refugo: quantidadeRefugo,
    p_motivo_refugo_id: motivoRefugoId,
  });
  if (error) friendlyError(error.message);

  revalidatePath(`/op/${numero}`);
}

export async function gerarOpSegundaOperacaoAction(formData: FormData) {
  const operadorAtual = await requireOperador();
  const subloteEtapaId = String(formData.get("sublote_etapa_id"));
  const numero = String(formData.get("numero"));
  const operadorId = String(formData.get("operador_id") ?? "");

  if (!operadorId) throw new Error("Selecione o operador");

  // Client admin (ignora RLS): criar OP e registrar compatibilidade de máquina são
  // ações de gestor no resto do sistema, mas aqui quem aciona é o operador no
  // celular — a autorização já foi checada acima (requireOperador) e pelas
  // validações desta própria função.
  const supabase = createAdminClient();

  // Consultas em sequência (não Promise.all): ver lib/pcp/criar-op.ts.
  const { data: etapa, error: etapaError } = await supabase
    .from("sublote_etapas")
    .select("id, status, sublote_id, peca_roteiro_etapa_id")
    .eq("id", subloteEtapaId)
    .single();
  if (etapaError || !etapa) throw new Error("Etapa do sublote não encontrada");
  if (etapa.status === "concluida") throw new Error("Esta etapa já foi concluída");

  const { data: sublote, error: subloteError } = await supabase
    .from("sublotes")
    .select("id, op_id, peca_id, quantidade")
    .eq("id", etapa.sublote_id)
    .single();
  if (subloteError || !sublote) throw new Error("Sublote não encontrado");

  const { data: roteiroEtapa, error: roteiroError } = await supabase
    .from("peca_roteiro_etapas")
    .select("id, maquina_id")
    .eq("id", etapa.peca_roteiro_etapa_id ?? "")
    .single();
  if (roteiroError || !roteiroEtapa?.maquina_id) {
    throw new Error("Esta etapa não tem máquina cadastrada no roteiro da peça");
  }

  const novaOp = await criarOPPlanejada(supabase, {
    pecaId: sublote.peca_id,
    maquinaId: roteiroEtapa.maquina_id,
    quantidade: Number(sublote.quantidade),
    criadoPor: operadorAtual.id,
    opOrigemId: sublote.op_id,
    roteiroEtapaOrigemId: roteiroEtapa.id,
  });

  const { error: concluirError } = await supabase
    .from("sublote_etapas")
    .update({
      status: "concluida",
      operador_fim_id: operadorId,
      timestamp_fim: new Date().toISOString(),
      quantidade_boa: sublote.quantidade,
      quantidade_refugo: 0,
    })
    .eq("id", subloteEtapaId);
  if (concluirError) throw new Error(concluirError.message);

  const { error: transferidaError } = await supabase
    .from("sublotes")
    .update({ status: "transferida" })
    .eq("id", sublote.id);
  if (transferidaError) throw new Error(transferidaError.message);

  revalidatePath(`/op/${numero}`);
  revalidatePath(`/ordens/${numero}`);
  void novaOp;
}

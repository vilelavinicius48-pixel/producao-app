"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireQualidade, requireGestor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { turnoAtual } from "@/lib/inspecao-linha";
import type { StatusInspecaoLinha } from "@/types/database";

const STATUS_VALIDOS: StatusInspecaoLinha[] = ["ok", "nao_ok", "parada"];

function statusValido(v: FormDataEntryValue | null): v is StatusInspecaoLinha {
  return typeof v === "string" && (STATUS_VALIDOS as string[]).includes(v);
}

export async function salvarInspecaoLinha(formData: FormData) {
  const inspetor = await requireQualidade();

  const opId = String(formData.get("op_id") ?? "");
  const numero = String(formData.get("numero") ?? "");
  const situacaoGeral = formData.get("situacao_geral");
  const motivoId = String(formData.get("motivo_id") ?? "") || null;
  const observacao = String(formData.get("observacao") ?? "").trim();

  if (!opId) throw new Error("OP não encontrada");
  if (!statusValido(situacaoGeral)) throw new Error("Selecione a situação geral");
  if (situacaoGeral !== "ok" && !motivoId) throw new Error("Informe o motivo");

  const supabase = await createClient();

  const { data: op, error: opError } = await supabase
    .from("ordens_producao")
    .select("id, maquina_id, peca_id")
    .eq("id", opId)
    .single();
  if (opError || !op) throw new Error("OP não encontrada");

  const { error: inspecaoError } = await supabase.from("inspecoes_linha").insert({
    op_id: op.id,
    maquina_id: op.maquina_id,
    peca_id: op.peca_id,
    inspetor_id: inspetor.id,
    situacao_geral: situacaoGeral,
    motivo_id: motivoId,
    turno: turnoAtual(),
    observacao: observacao || null,
  });
  if (inspecaoError) throw new Error(inspecaoError.message);

  revalidatePath(`/inspecao-linha/${numero}`);
  revalidatePath("/inspecao-linha");
  redirect(`/inspecao-linha/${numero}`);
}

export async function excluirInspecaoLinha(formData: FormData) {
  await requireGestor();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Inspeção não encontrada");

  const supabase = await createClient();
  const { error } = await supabase.from("inspecoes_linha").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/inspecao-linha");
}

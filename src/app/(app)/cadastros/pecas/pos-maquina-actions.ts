"use server";

import { revalidatePath } from "next/cache";
import { requireGestor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function revalidarPeca(pecaId: string) {
  revalidatePath(`/cadastros/pecas/${pecaId}`);
}

// ---------------------------------------------------------------------------
// Roteiro (etapas pós-máquina)
// ---------------------------------------------------------------------------

export async function adicionarRoteiroEtapa(formData: FormData) {
  await requireGestor();
  const pecaId = String(formData.get("peca_id") ?? "");
  const etapaId = String(formData.get("etapa_id") ?? "");
  const maquinaId = String(formData.get("maquina_id") ?? "").trim() || null;
  const tratamentoId = String(formData.get("tratamento_id") ?? "").trim() || null;
  if (!pecaId || !etapaId) throw new Error("Selecione a etapa");

  const supabase = await createClient();

  const { data: etapa } = await supabase.from("etapas").select("tipo").eq("id", etapaId).single();
  if (!etapa) throw new Error("Etapa não encontrada");
  if (etapa.tipo === "maquina" && !maquinaId) throw new Error("Escolha a máquina dessa 2ª operação");
  if (etapa.tipo === "externo" && !tratamentoId) throw new Error("Escolha o tratamento dessa etapa");

  const { data: ultima } = await supabase
    .from("peca_roteiro_etapas")
    .select("ordem")
    .eq("peca_id", pecaId)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("peca_roteiro_etapas").insert({
    peca_id: pecaId,
    etapa_id: etapaId,
    ordem: (ultima?.ordem ?? 0) + 1,
    maquina_id: etapa.tipo === "maquina" ? maquinaId : null,
    tratamento_id: etapa.tipo === "externo" ? tratamentoId : null,
  });
  if (error) throw new Error(error.message);

  revalidarPeca(pecaId);
}

export async function removerRoteiroEtapa(formData: FormData) {
  await requireGestor();
  const id = String(formData.get("id") ?? "");
  const pecaId = String(formData.get("peca_id") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.from("peca_roteiro_etapas").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidarPeca(pecaId);
}

export async function moverRoteiroEtapa(formData: FormData) {
  await requireGestor();
  const id = String(formData.get("id") ?? "");
  const pecaId = String(formData.get("peca_id") ?? "");
  const direcao = String(formData.get("direcao") ?? "");

  const supabase = await createClient();
  const { data: lista } = await supabase
    .from("peca_roteiro_etapas")
    .select("id, ordem")
    .eq("peca_id", pecaId)
    .order("ordem", { ascending: true });
  if (!lista) return;

  const idx = lista.findIndex((l) => l.id === id);
  const alvo = direcao === "subir" ? idx - 1 : idx + 1;
  if (idx < 0 || alvo < 0 || alvo >= lista.length) return;

  const a = lista[idx];
  const b = lista[alvo];
  await supabase.from("peca_roteiro_etapas").update({ ordem: b.ordem }).eq("id", a.id);
  await supabase.from("peca_roteiro_etapas").update({ ordem: a.ordem }).eq("id", b.id);

  revalidarPeca(pecaId);
}

/** Substitui o roteiro atual da peça pelo roteiro de outra peça (template). */
export async function copiarRoteiro(formData: FormData) {
  await requireGestor();
  const pecaId = String(formData.get("peca_id") ?? "");
  const origemId = String(formData.get("origem_peca_id") ?? "");
  if (!origemId) throw new Error("Selecione a peça de origem");

  const supabase = await createClient();
  const { data: origem, error: errOrigem } = await supabase
    .from("peca_roteiro_etapas")
    .select("etapa_id, ordem, maquina_id, tratamento_id")
    .eq("peca_id", origemId)
    .order("ordem");
  if (errOrigem) throw new Error(errOrigem.message);
  if (!origem || origem.length === 0) throw new Error("A peça de origem não tem roteiro cadastrado");

  const { error: errDel } = await supabase.from("peca_roteiro_etapas").delete().eq("peca_id", pecaId);
  if (errDel) throw new Error(errDel.message);

  const { error: errIns } = await supabase.from("peca_roteiro_etapas").insert(
    origem.map((e) => ({
      peca_id: pecaId,
      etapa_id: e.etapa_id,
      ordem: e.ordem,
      maquina_id: e.maquina_id,
      tratamento_id: e.tratamento_id,
    }))
  );
  if (errIns) throw new Error(errIns.message);

  revalidarPeca(pecaId);
}

// ---------------------------------------------------------------------------
// Plano de medição (cotas)
// ---------------------------------------------------------------------------

export async function adicionarCotaMedicao(formData: FormData) {
  await requireGestor();
  const pecaId = String(formData.get("peca_id") ?? "");
  const tipo = String(formData.get("tipo") ?? "").trim();
  const ehAtributo = formData.get("eh_atributo") === "true";
  const nominal = String(formData.get("nominal") ?? "").replace(",", ".").trim();
  const minimo = String(formData.get("minimo") ?? "").replace(",", ".").trim();
  const maximo = String(formData.get("maximo") ?? "").replace(",", ".").trim();
  const instrumento = String(formData.get("instrumento") ?? "").trim() || null;
  const frequencia = String(formData.get("frequencia") ?? "").trim() || null;
  if (!pecaId || !tipo) throw new Error("Informe o tipo da cota");

  const supabase = await createClient();

  const { data: ultima } = await supabase
    .from("peca_plano_medicao_cotas")
    .select("ordem")
    .eq("peca_id", pecaId)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("peca_plano_medicao_cotas").insert({
    peca_id: pecaId,
    ordem: (ultima?.ordem ?? 0) + 1,
    tipo,
    eh_atributo: ehAtributo,
    nominal: !ehAtributo && nominal ? Number(nominal) : null,
    minimo: !ehAtributo && minimo ? Number(minimo) : null,
    maximo: !ehAtributo && maximo ? Number(maximo) : null,
    instrumento,
    frequencia,
  });
  if (error) throw new Error(error.message);

  revalidarPeca(pecaId);
}

export async function removerCotaMedicao(formData: FormData) {
  await requireGestor();
  const id = String(formData.get("id") ?? "");
  const pecaId = String(formData.get("peca_id") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.from("peca_plano_medicao_cotas").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidarPeca(pecaId);
}

export async function moverCotaMedicao(formData: FormData) {
  await requireGestor();
  const id = String(formData.get("id") ?? "");
  const pecaId = String(formData.get("peca_id") ?? "");
  const direcao = String(formData.get("direcao") ?? "");

  const supabase = await createClient();
  const { data: lista } = await supabase
    .from("peca_plano_medicao_cotas")
    .select("id, ordem")
    .eq("peca_id", pecaId)
    .order("ordem", { ascending: true });
  if (!lista) return;

  const idx = lista.findIndex((l) => l.id === id);
  const alvo = direcao === "subir" ? idx - 1 : idx + 1;
  if (idx < 0 || alvo < 0 || alvo >= lista.length) return;

  const a = lista[idx];
  const b = lista[alvo];
  await supabase.from("peca_plano_medicao_cotas").update({ ordem: b.ordem }).eq("id", a.id);
  await supabase.from("peca_plano_medicao_cotas").update({ ordem: a.ordem }).eq("id", b.id);

  revalidarPeca(pecaId);
}

/** Substitui o plano de medição atual da peça pelo plano de outra peça (template). */
export async function copiarPlanoMedicao(formData: FormData) {
  await requireGestor();
  const pecaId = String(formData.get("peca_id") ?? "");
  const origemId = String(formData.get("origem_peca_id") ?? "");
  if (!origemId) throw new Error("Selecione a peça de origem");

  const supabase = await createClient();
  const { data: origem, error: errOrigem } = await supabase
    .from("peca_plano_medicao_cotas")
    .select("ordem, tipo, eh_atributo, nominal, minimo, maximo, instrumento, frequencia")
    .eq("peca_id", origemId)
    .order("ordem");
  if (errOrigem) throw new Error(errOrigem.message);
  if (!origem || origem.length === 0) throw new Error("A peça de origem não tem plano de medição cadastrado");

  const { error: errDel } = await supabase.from("peca_plano_medicao_cotas").delete().eq("peca_id", pecaId);
  if (errDel) throw new Error(errDel.message);

  const { error: errIns } = await supabase.from("peca_plano_medicao_cotas").insert(
    origem.map((c) => ({ ...c, peca_id: pecaId }))
  );
  if (errIns) throw new Error(errIns.message);

  revalidarPeca(pecaId);
}

// ---------------------------------------------------------------------------
// Desenho técnico
// ---------------------------------------------------------------------------

const EXTENSOES_PERMITIDAS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "application/pdf": "pdf",
};

export async function enviarDesenhoPeca(formData: FormData) {
  await requireGestor();
  const pecaId = String(formData.get("peca_id") ?? "");
  const arquivo = formData.get("arquivo") as File | null;
  if (!pecaId || !arquivo || arquivo.size === 0) throw new Error("Selecione um arquivo");

  const extensao = EXTENSOES_PERMITIDAS[arquivo.type];
  if (!extensao) throw new Error("Envie um PNG, JPG ou PDF");
  if (arquivo.size > 15 * 1024 * 1024) throw new Error("Arquivo maior que 15 MB");

  const supabase = await createClient();

  const { data: pecaAtual } = await supabase.from("pecas").select("desenho_path").eq("id", pecaId).single();

  const caminho = `${pecaId}/desenho.${extensao}`;
  const buffer = Buffer.from(await arquivo.arrayBuffer());
  const { error: errUpload } = await supabase.storage
    .from("desenhos")
    .upload(caminho, buffer, { contentType: arquivo.type, upsert: true });
  if (errUpload) throw new Error(errUpload.message);

  // Se o arquivo antigo tinha outra extensão, remove o arquivo anterior (upsert não troca a extensão sozinho).
  if (pecaAtual?.desenho_path && pecaAtual.desenho_path !== caminho) {
    await supabase.storage.from("desenhos").remove([pecaAtual.desenho_path]);
  }

  const { error } = await supabase
    .from("pecas")
    .update({ desenho_path: caminho, desenho_content_type: arquivo.type })
    .eq("id", pecaId);
  if (error) throw new Error(error.message);

  revalidarPeca(pecaId);
}

export async function removerDesenhoPeca(formData: FormData) {
  await requireGestor();
  const pecaId = String(formData.get("peca_id") ?? "");

  const supabase = await createClient();
  const { data: peca } = await supabase.from("pecas").select("desenho_path").eq("id", pecaId).single();
  if (peca?.desenho_path) {
    await supabase.storage.from("desenhos").remove([peca.desenho_path]);
  }

  const { error } = await supabase.from("pecas").update({ desenho_path: null, desenho_content_type: null }).eq("id", pecaId);
  if (error) throw new Error(error.message);

  revalidarPeca(pecaId);
}

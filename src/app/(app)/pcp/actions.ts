"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireGestor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { criarOPPlanejada } from "@/lib/pcp/criar-op";
import { chaveItem, lerCarteiraTabela, type LinhaCarteira } from "@/lib/pcp/csv";
import { buscarTodos, emBlocos } from "@/lib/pcp/paginar";
import { PREPARO_ITENS, preparoCompleto } from "@/lib/op-status";
import type { OrdemProducao, StatusPreparo } from "@/types/database";

function revalidarPCP() {
  revalidatePath("/pcp", "layout");
  revalidatePath("/ordens", "layout");
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// Importação da carteira
// ---------------------------------------------------------------------------

export type ItemResumo = {
  cliente: string;
  numero_pedido: string;
  codigo: string;
  descricao: string;
  data_entrega: string;
  quantidade: number;
};

export type ResumoImportacao = {
  erros: string[];
  linhas: number;
  duplicadas: number;
  novos: ItemResumo[];
  alterados: { item: ItemResumo; antes: string }[];
  reabertos: ItemResumo[];
  encerrados: (ItemResumo & { comOP: boolean })[];
  inalterados: number;
  pecasNovas: number;
  aplicado: boolean;
};

type Existente = {
  id: string;
  chave: string;
  status: "aberto" | "encerrado";
  cliente: string;
  numero_pedido: string;
  pedido_compra: string | null;
  data_pedido: string | null;
  data_entrega: string;
  codigo_produto: string;
  descricao: string;
  quantidade: number;
  empresa: string | null;
};

function paraResumo(l: LinhaCarteira): ItemResumo {
  return {
    cliente: l.cliente,
    numero_pedido: l.numero_pedido,
    codigo: l.codigo,
    descricao: l.descricao,
    data_entrega: l.data_entrega,
    quantidade: l.quantidade,
  };
}

/**
 * Recebe a planilha (já convertida em tabela de textos no navegador) e compara com a carteira atual.
 * Com aplicar=false só devolve a prévia.
 * Regra: o arquivo é a carteira COMPLETA — item aberto que não veio no arquivo é encerrado.
 */
export async function importarPedidos(
  tabela: string[][],
  arquivo: string,
  aplicar: boolean
): Promise<ResumoImportacao> {
  const gestor = await requireGestor();
  const supabase = await createClient();

  if (!Array.isArray(tabela) || tabela.length > 20000) throw new Error("Planilha inválida ou grande demais");
  const limpa = tabela.map((linha) => (Array.isArray(linha) ? linha.map((c) => String(c ?? "")) : []));
  const { linhas: brutas, erros } = lerCarteiraTabela(limpa);
  const vazio: ResumoImportacao = {
    erros,
    linhas: 0,
    duplicadas: 0,
    novos: [],
    alterados: [],
    reabertos: [],
    encerrados: [],
    inalterados: 0,
    pecasNovas: 0,
    aplicado: false,
  };
  if (brutas.length === 0) return vazio;

  // Junta linhas repetidas (mesmo pedido + código + entrega) somando a quantidade.
  const porChave = new Map<string, LinhaCarteira>();
  let duplicadas = 0;
  for (const l of brutas) {
    const k = chaveItem(l);
    const atual = porChave.get(k);
    if (atual) {
      atual.quantidade += l.quantidade;
      duplicadas++;
    } else {
      porChave.set(k, { ...l });
    }
  }

  const existentes = await buscarTodos<Existente>((de, ate) =>
    supabase
      .from("pedido_itens")
      .select(
        "id, chave, status, cliente, numero_pedido, pedido_compra, data_pedido, data_entrega, codigo_produto, descricao, quantidade, empresa"
      )
      .order("id")
      .range(de, ate)
  );
  const existentePorChave = new Map(existentes.map((e) => [e.chave, e]));

  const novos: LinhaCarteira[] = [];
  const alterados: { linha: LinhaCarteira; antes: string }[] = [];
  const reabertos: LinhaCarteira[] = [];
  let inalterados = 0;

  for (const [k, l] of porChave) {
    const e = existentePorChave.get(k);
    if (!e) {
      novos.push(l);
      continue;
    }
    if (e.status === "encerrado") {
      reabertos.push(l);
      continue;
    }
    const mudancas: string[] = [];
    if (Math.abs(Number(e.quantidade) - l.quantidade) > 0.00001)
      mudancas.push(`qtd ${Number(e.quantidade)} → ${l.quantidade}`);
    if (e.descricao !== l.descricao) mudancas.push("descrição");
    if (e.cliente !== l.cliente) mudancas.push("cliente");
    if ((e.pedido_compra ?? null) !== l.pedido_compra) mudancas.push("pedido de compra");
    if ((e.data_pedido ?? null) !== l.data_pedido) mudancas.push("data do pedido");
    if ((e.empresa ?? null) !== l.empresa) mudancas.push("empresa");
    if (mudancas.length > 0) alterados.push({ linha: l, antes: mudancas.join(", ") });
    else inalterados++;
  }

  const paraEncerrar = existentes.filter((e) => e.status === "aberto" && !porChave.has(e.chave));

  const comOP = new Set<string>();
  for (const bloco of emBlocos(paraEncerrar.map((e) => e.id))) {
    const { data } = await supabase
      .from("ordens_producao")
      .select("pedido_item_id")
      .in("pedido_item_id", bloco)
      .neq("status", "concluida");
    (data ?? []).forEach((o) => o.pedido_item_id && comOP.add(o.pedido_item_id));
  }

  // Peças: liga cada código ao cadastro; cria as que não existem (cadastro pendente).
  const codigos = [...new Set([...porChave.values()].map((l) => l.codigo))];
  const pecaPorCodigo = new Map<string, string>();
  for (const bloco of emBlocos(codigos)) {
    const { data, error } = await supabase.from("pecas").select("id, codigo").in("codigo", bloco);
    if (error) throw new Error(error.message);
    (data ?? []).forEach((p) => pecaPorCodigo.set(p.codigo, p.id));
  }
  const pecasFaltando = codigos.filter((c) => !pecaPorCodigo.has(c));

  const resumo: ResumoImportacao = {
    erros,
    linhas: brutas.length,
    duplicadas,
    novos: novos.map(paraResumo),
    alterados: alterados.map((a) => ({ item: paraResumo(a.linha), antes: a.antes })),
    reabertos: reabertos.map(paraResumo),
    encerrados: paraEncerrar.map((e) => ({
      cliente: e.cliente,
      numero_pedido: e.numero_pedido,
      codigo: e.codigo_produto,
      descricao: e.descricao,
      data_entrega: e.data_entrega,
      quantidade: Number(e.quantidade),
      comOP: comOP.has(e.id),
    })),
    inalterados,
    pecasNovas: pecasFaltando.length,
    aplicado: false,
  };

  if (!aplicar) return resumo;

  // --- Aplicar ---
  if (pecasFaltando.length > 0) {
    const descricaoPorCodigo = new Map([...porChave.values()].map((l) => [l.codigo, l.descricao]));
    for (const bloco of emBlocos(pecasFaltando)) {
      const { data, error } = await supabase
        .from("pecas")
        .insert(bloco.map((codigo) => ({ codigo, descricao: descricaoPorCodigo.get(codigo) ?? codigo })))
        .select("id, codigo");
      if (error) throw new Error(`Erro ao criar peças: ${error.message}`);
      (data ?? []).forEach((p) => pecaPorCodigo.set(p.codigo, p.id));
    }
  }

  const agora = new Date().toISOString();
  const gravar = [...novos, ...alterados.map((a) => a.linha), ...reabertos].map((l) => ({
    chave: chaveItem(l),
    cliente: l.cliente,
    numero_pedido: l.numero_pedido,
    pedido_compra: l.pedido_compra,
    data_pedido: l.data_pedido,
    data_entrega: l.data_entrega,
    codigo_produto: l.codigo,
    descricao: l.descricao,
    quantidade: l.quantidade,
    empresa: l.empresa,
    peca_id: pecaPorCodigo.get(l.codigo) ?? null,
    status: "aberto" as const,
    encerrado_em: null,
    updated_at: agora,
  }));
  for (const bloco of emBlocos(gravar, 200)) {
    const { error } = await supabase.from("pedido_itens").upsert(bloco, { onConflict: "chave" });
    if (error) throw new Error(`Erro ao gravar pedidos: ${error.message}`);
  }

  for (const bloco of emBlocos(paraEncerrar.map((e) => e.id))) {
    const { error } = await supabase
      .from("pedido_itens")
      .update({ status: "encerrado", encerrado_em: agora, updated_at: agora })
      .in("id", bloco);
    if (error) throw new Error(`Erro ao encerrar itens: ${error.message}`);
  }

  await supabase.from("importacoes_pedidos").insert({
    arquivo,
    linhas: brutas.length,
    novos: novos.length,
    alterados: alterados.length,
    encerrados: paraEncerrar.length,
    reabertos: reabertos.length,
    criado_por: gestor.id,
  });

  revalidarPCP();
  return { ...resumo, aplicado: true };
}

// ---------------------------------------------------------------------------
// OPs a partir da carteira
// ---------------------------------------------------------------------------

export async function criarOPDoPedido(formData: FormData) {
  const gestor = await requireGestor();
  const itemId = String(formData.get("pedido_item_id") ?? "");
  const maquinaId = String(formData.get("maquina_id") ?? "");
  const quantidade = Number(formData.get("quantidade"));
  const voltar = String(formData.get("voltar") ?? "/pcp/carteira");

  if (!itemId || !maquinaId || !quantidade || quantidade <= 0) {
    throw new Error("Escolha a máquina e uma quantidade válida");
  }

  const supabase = await createClient();
  const { data: item, error } = await supabase
    .from("pedido_itens")
    .select("id, peca_id, codigo_produto, descricao")
    .eq("id", itemId)
    .single();
  if (error || !item) throw new Error("Item do pedido não encontrado");

  let pecaId = item.peca_id;
  if (!pecaId) {
    const { data: peca, error: errPeca } = await supabase
      .from("pecas")
      .upsert({ codigo: item.codigo_produto, descricao: item.descricao }, { onConflict: "codigo" })
      .select("id")
      .single();
    if (errPeca || !peca) throw new Error(errPeca?.message ?? "Falha ao criar a peça");
    pecaId = peca.id;
    await supabase.from("pedido_itens").update({ peca_id: pecaId }).eq("id", itemId);
  }

  await criarOPPlanejada(supabase, {
    pecaId,
    maquinaId,
    quantidade,
    criadoPor: gestor.id,
    pedidoItemId: itemId,
  });

  revalidarPCP();
  redirect(voltar.startsWith("/") ? voltar : "/pcp/carteira");
}

// ---------------------------------------------------------------------------
// Preparação / liberação
// ---------------------------------------------------------------------------

const PREPARO_VALIDOS: StatusPreparo[] = ["pendente", "aguardando", "ok", "na"];

export type EstadoPreparo = { erro?: string };

/**
 * Salva o preparo (e opcionalmente libera/volta a OP). Erros esperados (validação,
 * concorrência) são devolvidos como texto em vez de lançados, para o formulário
 * mostrar um aviso simples em vez de travar com uma tela de erro técnica.
 */
export async function salvarPreparo(_prevState: EstadoPreparo, formData: FormData): Promise<EstadoPreparo> {
  await requireGestor();
  const opId = String(formData.get("op_id") ?? "");
  const acao = String(formData.get("acao") ?? "salvar");
  const supabase = await createClient();

  const { data: op, error } = await supabase
    .from("ordens_producao")
    .select("id, numero, status, setup_concluido_em")
    .eq("id", opId)
    .single();
  if (error || !op) return { erro: "OP não encontrada" };

  const preparo = {} as Record<(typeof PREPARO_ITENS)[number]["campo"], StatusPreparo>;
  for (const item of PREPARO_ITENS) {
    const v = String(formData.get(item.campo) ?? "pendente") as StatusPreparo;
    preparo[item.campo] = PREPARO_VALIDOS.includes(v) ? v : "pendente";
  }
  const previsao = String(formData.get("previsao_material") ?? "").trim() || null;
  const obs = String(formData.get("obs_pcp") ?? "").trim() || null;

  const update: Partial<OrdemProducao> = { ...preparo, previsao_material: previsao, obs_pcp: obs };

  if (acao === "liberar") {
    if (op.status !== "planejada") return { erro: "Só OP planejada pode ser liberada" };
    if (!preparoCompleto(preparo)) {
      return { erro: "Para liberar, todos os itens precisam estar OK ou 'Não se aplica'" };
    }
    update.status = "aberta";
    update.liberada_em = new Date().toISOString();
  } else if (acao === "voltar") {
    if (op.status !== "aberta" || op.setup_concluido_em) {
      return { erro: "Só dá para voltar para planejada uma OP liberada que ainda não começou" };
    }
    update.status = "planejada";
    update.liberada_em = null;
  }

  const { error: errUpd } = await supabase.from("ordens_producao").update(update).eq("id", opId);
  if (errUpd) return { erro: errUpd.message };

  revalidarPCP();
  revalidatePath(`/ordens/${op.numero}`);
  return {};
}

/** Marca um item de preparo como OK direto do quadro/pendências. */
export async function marcarPreparoOk(formData: FormData) {
  await requireGestor();
  const opId = String(formData.get("op_id") ?? "");
  const campo = String(formData.get("campo") ?? "");
  if (!PREPARO_ITENS.some((i) => i.campo === campo)) throw new Error("Item inválido");

  const supabase = await createClient();
  const { error } = await supabase
    .from("ordens_producao")
    .update({ [campo as (typeof PREPARO_ITENS)[number]["campo"]]: "ok" as StatusPreparo } as Partial<OrdemProducao>)
    .eq("id", opId)
    .in("status", ["planejada", "aberta"]);
  if (error) throw new Error(error.message);
  revalidarPCP();
}

// ---------------------------------------------------------------------------
// Fila das máquinas
// ---------------------------------------------------------------------------

type ItemFila = { id: string; sequencia: number | null };

async function filaDaMaquina(supabase: Awaited<ReturnType<typeof createClient>>, maquinaId: string) {
  const { data, error } = await supabase
    .from("ordens_producao")
    .select("id, sequencia")
    .eq("maquina_id", maquinaId)
    .in("status", ["planejada", "aberta"])
    .order("sequencia", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ItemFila[];
}

async function gravarOrdem(supabase: Awaited<ReturnType<typeof createClient>>, fila: ItemFila[]) {
  for (let i = 0; i < fila.length; i++) {
    if (fila[i].sequencia !== i + 1) {
      const { error } = await supabase.from("ordens_producao").update({ sequencia: i + 1 }).eq("id", fila[i].id);
      if (error) throw new Error(error.message);
    }
  }
}

export async function moverNaFila(formData: FormData) {
  await requireGestor();
  const opId = String(formData.get("op_id") ?? "");
  const direcao = String(formData.get("direcao") ?? "");
  const supabase = await createClient();

  const { data: op } = await supabase.from("ordens_producao").select("maquina_id").eq("id", opId).single();
  if (!op) throw new Error("OP não encontrada");

  const fila = await filaDaMaquina(supabase, op.maquina_id);
  const idx = fila.findIndex((f) => f.id === opId);
  if (idx < 0) throw new Error("OP não está na fila");

  const alvo = direcao === "subir" ? idx - 1 : direcao === "descer" ? idx + 1 : direcao === "topo" ? 0 : idx;
  if (alvo >= 0 && alvo < fila.length && alvo !== idx) {
    const [item] = fila.splice(idx, 1);
    fila.splice(alvo, 0, item);
  }
  await gravarOrdem(supabase, fila);
  revalidarPCP();
}

export async function trocarMaquina(formData: FormData) {
  await requireGestor();
  const opId = String(formData.get("op_id") ?? "");
  const maquinaId = String(formData.get("maquina_id") ?? "");
  const supabase = await createClient();

  const { data: op } = await supabase
    .from("ordens_producao")
    .select("id, numero, status, peca_id, maquina_id, setup_concluido_em")
    .eq("id", opId)
    .single();
  if (!op) throw new Error("OP não encontrada");
  if (!["planejada", "aberta"].includes(op.status) || op.setup_concluido_em) {
    throw new Error("Só dá para trocar a máquina de OP que ainda não começou");
  }
  if (op.maquina_id === maquinaId) return;

  const { data: compat } = await supabase.from("pecas_maquinas").select("maquina_id").eq("peca_id", op.peca_id);
  if ((compat ?? []).length > 0 && !(compat ?? []).some((c) => c.maquina_id === maquinaId)) {
    throw new Error("Essa máquina não está cadastrada como compatível com a peça (ajuste no cadastro da peça)");
  }
  if ((compat ?? []).length === 0) {
    await supabase.from("pecas_maquinas").insert({ peca_id: op.peca_id, maquina_id: maquinaId });
  }

  const filaNova = await filaDaMaquina(supabase, maquinaId);
  const { error } = await supabase
    .from("ordens_producao")
    .update({ maquina_id: maquinaId, sequencia: filaNova.length + 1 })
    .eq("id", opId);
  if (error) throw new Error(error.message);

  await gravarOrdem(supabase, await filaDaMaquina(supabase, op.maquina_id));
  revalidarPCP();
  revalidatePath(`/ordens/${op.numero}`);
}

export async function excluirOPPlanejada(formData: FormData) {
  await requireGestor();
  const opId = String(formData.get("op_id") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ordens_producao")
    .delete()
    .eq("id", opId)
    .eq("status", "planejada")
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Só OP planejada pode ser excluída");
  revalidarPCP();
  redirect("/pcp/programacao");
}

// ---------------------------------------------------------------------------
// Estoque de peças prontas
// ---------------------------------------------------------------------------

export async function movimentarEstoque(formData: FormData) {
  const gestor = await requireGestor();
  const pecaId = String(formData.get("peca_id") ?? "");
  const tipo = String(formData.get("tipo") ?? "");
  const quantidade = Number(String(formData.get("quantidade") ?? "").replace(",", "."));
  const observacao = String(formData.get("observacao") ?? "").trim() || null;

  if (!pecaId || !Number.isFinite(quantidade) || quantidade < 0) throw new Error("Quantidade inválida");

  const supabase = await createClient();

  let movimento: { tipo: "entrada" | "saida" | "ajuste"; quantidade: number };
  if (tipo === "contagem") {
    const { data } = await supabase.from("estoque_pecas").select("saldo").eq("peca_id", pecaId).maybeSingle();
    const delta = quantidade - Number(data?.saldo ?? 0);
    if (delta === 0) return;
    movimento = { tipo: "ajuste", quantidade: delta };
  } else if (tipo === "entrada") {
    movimento = { tipo: "entrada", quantidade };
  } else if (tipo === "saida") {
    movimento = { tipo: "saida", quantidade: -quantidade };
  } else {
    throw new Error("Tipo de movimento inválido");
  }

  const { error } = await supabase.from("estoque_movimentos").insert({
    peca_id: pecaId,
    ...movimento,
    observacao: observacao ?? (tipo === "contagem" ? "Contagem de estoque" : null),
    criado_por: gestor.id,
  });
  if (error) throw new Error(error.message);
  revalidarPCP();
}

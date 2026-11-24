"use server";

import { requireGestor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { recalcularMaterial } from "@/lib/pcp/recalcular-material";
import {
  agruparItensEstoqueMaterial,
  interpretarLinhaEstoqueMaterial,
  type GrupoEstoqueMaterial,
} from "@/lib/pcp/estoque-material-import";

export type PreviaImportacaoEstoque = {
  erro?: string;
  linhasLidas: number;
  grupos: GrupoEstoqueMaterial[];
  naoReconhecidos: { textoOriginal: string; motivo: string }[];
};

/** Lê a aba "RESUMO DE ESTOQUE" (coluna de descrição + coluna TOTAL) e devolve uma prévia pra revisar. */
export async function preVisualizarEstoqueMaterial(tabela: string[][]): Promise<PreviaImportacaoEstoque> {
  await requireGestor();
  const vazio = { linhasLidas: 0, grupos: [], naoReconhecidos: [] };

  const idxCabecalho = tabela.findIndex((l) => (l[1] ?? "").trim().toUpperCase() === "DISCRIMINAÇÃO");
  if (idxCabecalho < 0) {
    return { ...vazio, erro: 'Não encontrei a aba "RESUMO DE ESTOQUE" nesse formato (coluna "DISCRIMINAÇÃO" não apareceu).' };
  }

  const itens = [];
  let linhasLidas = 0;
  for (let i = idxCabecalho + 1; i < tabela.length; i++) {
    const linha = tabela[i];
    const desc = (linha[1] ?? "").trim();
    if (!desc) continue;
    const totalStr = (linha[6] ?? "").trim();
    if (!totalStr || Number.isNaN(Number(totalStr))) continue; // linha de cabeçalho de local (sem número)
    linhasLidas++;
    itens.push(interpretarLinhaEstoqueMaterial(i, desc, Number(totalStr)));
  }

  const grupos = agruparItensEstoqueMaterial(itens);
  const naoReconhecidos = itens
    .filter((it) => !it.reconhecido)
    .map((it) => ({ textoOriginal: it.textoOriginal, motivo: it.motivoNaoReconhecido ?? "Não reconhecido" }));

  return { linhasLidas, grupos, naoReconhecidos };
}

export type ResultadoImportacaoEstoque = { erro?: string; criados: number; somados: number; ignoradosZero: number };

/** Cria/encontra cada material do grupo e lança a quantidade como ajuste de estoque (carga inicial). */
export async function confirmarImportacaoEstoqueMaterial(grupos: GrupoEstoqueMaterial[]): Promise<ResultadoImportacaoEstoque> {
  const gestor = await requireGestor();
  const supabase = await createClient();

  let criados = 0;
  let somados = 0;
  let ignoradosZero = 0;

  for (const g of grupos) {
    if (!g.tipo || !g.medidaAMm || g.medidaAMm <= 0) continue;

    let query = supabase
      .from("materiais")
      .select("id")
      .eq("formato", g.formato)
      .eq("tipo", g.tipo)
      .eq("medida_a_mm", g.medidaAMm);
    query = g.medidaBMm === null ? query.is("medida_b_mm", null) : query.eq("medida_b_mm", g.medidaBMm);
    query = g.espessuraMm === null ? query.is("espessura_mm", null) : query.eq("espessura_mm", g.espessuraMm);
    const { data: existente } = await query.maybeSingle();

    let materialId = existente?.id as string | undefined;
    if (materialId) {
      somados++;
    } else {
      const { data: novo, error } = await supabase
        .from("materiais")
        .insert({
          formato: g.formato,
          tipo: g.tipo,
          medida_a_mm: g.medidaAMm,
          medida_b_mm: g.medidaBMm,
          espessura_mm: g.espessuraMm,
        })
        .select("id")
        .single();
      if (error || !novo) return { criados, somados, ignoradosZero, erro: error?.message ?? "Falha ao criar material" };
      materialId = novo.id;
      criados++;
    }

    if (Math.round(g.quantidade * 1000) === 0) {
      ignoradosZero++;
      continue;
    }

    const { error: errMov } = await supabase.from("estoque_material_movimentos").insert({
      material_id: materialId,
      tipo: "ajuste",
      quantidade: g.quantidade,
      observacao: "Carga inicial (planilha de controle de matéria-prima)",
      criado_por: gestor.id,
    });
    if (errMov) return { criados, somados, ignoradosZero, erro: errMov.message };
  }

  await recalcularMaterial(supabase);
  return { criados, somados, ignoradosZero };
}

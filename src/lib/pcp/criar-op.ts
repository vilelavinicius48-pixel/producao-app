import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { calcularConsumoOP } from "@/lib/pcp/material";
import { recalcularMaterial } from "@/lib/pcp/recalcular-material";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Calcula e devolve o snapshot de material (barras/folhas/metros) desta peça nesta máquina, se der. */
export async function calcularMaterialOP(
  supabase: Supabase,
  args: { pecaId: string; maquinaId: string; quantidade: number }
): Promise<{
  material_id: string | null;
  material_barras_necessarias: number | null;
  material_folhas_necessarias: number | null;
  material_metros_necessarios: number | null;
}> {
  const vazio = {
    material_id: null,
    material_barras_necessarias: null,
    material_folhas_necessarias: null,
    material_metros_necessarios: null,
  };
  // Consultas em sequência (não Promise.all): disparar a renovação do token de sessão em
  // paralelo, em mais de uma consulta ao mesmo tempo, pode derrubar a sessão do usuário.
  const { data: peca } = await supabase
    .from("pecas")
    .select("material_id, comprimento_consumido_mm, pecas_por_folha, materiais(formato)")
    .eq("id", args.pecaId)
    .single();
  const { data: maquina } = await supabase
    .from("maquinas")
    .select("barra_comprimento_mm, barra_sobra_mm")
    .eq("id", args.maquinaId)
    .single();
  if (!peca?.material_id || !maquina) return vazio;

  const material = peca.materiais as unknown as { formato: import("@/types/database").FormatoMaterial } | null;
  if (!material) return vazio;

  const consumo = calcularConsumoOP({
    formato: material.formato,
    quantidadePlanejada: args.quantidade,
    comprimentoConsumidoMm: peca.comprimento_consumido_mm,
    pecasPorFolha: peca.pecas_por_folha,
    barraComprimentoMm: maquina.barra_comprimento_mm,
    barraSobraMm: maquina.barra_sobra_mm,
  });
  if (consumo.erro) return { ...vazio, material_id: peca.material_id };

  return {
    material_id: peca.material_id,
    material_barras_necessarias: consumo.barrasNecessarias,
    material_folhas_necessarias: consumo.folhasNecessarias,
    material_metros_necessarios: consumo.metrosNecessarios,
  };
}

/**
 * Cria uma OP no estado "planejada", no fim da fila da máquina.
 * - Se a peça já tem máquinas compatíveis cadastradas, a máquina precisa ser uma delas.
 * - Se ainda não tem nenhuma, a máquina escolhida passa a ser compatível (o cadastro se completa com o uso).
 * - Tempo estimado só é calculado se a peça tiver tempo padrão.
 * - O "kit" de material (barras/folhas/metros necessários) é um retrato de quando a OP foi
 *   criada — igual tempo_estimado_segundos, não se atualiza sozinho se o cadastro da peça mudar depois.
 */
export async function criarOPPlanejada(
  supabase: Supabase,
  args: {
    pecaId: string;
    maquinaId: string;
    quantidade: number;
    criadoPor: string;
    pedidoItemId?: string | null;
    opOrigemId?: string | null;
    roteiroEtapaOrigemId?: string | null;
  }
): Promise<number> {
  const {
    pecaId,
    maquinaId,
    quantidade,
    criadoPor,
    pedidoItemId = null,
    opOrigemId = null,
    roteiroEtapaOrigemId = null,
  } = args;

  if (!Number.isInteger(quantidade) || quantidade <= 0) {
    throw new Error("A quantidade da OP é em peças inteiras (sem vírgula)");
  }

  const { data: peca, error: pecaError } = await supabase
    .from("pecas")
    .select("tempo_padrao_segundos")
    .eq("id", pecaId)
    .single();
  if (pecaError || !peca) throw new Error("Peça não encontrada");

  const { data: compat, error: compatError } = await supabase
    .from("pecas_maquinas")
    .select("maquina_id")
    .eq("peca_id", pecaId);
  if (compatError) throw new Error(compatError.message);

  if (compat.length > 0 && !compat.some((c) => c.maquina_id === maquinaId)) {
    throw new Error("Máquina selecionada não é compatível com a peça");
  }
  if (compat.length === 0) {
    const { error } = await supabase.from("pecas_maquinas").insert({ peca_id: pecaId, maquina_id: maquinaId });
    if (error) throw new Error(error.message);
  }

  const { data: ultima } = await supabase
    .from("ordens_producao")
    .select("sequencia")
    .eq("maquina_id", maquinaId)
    .neq("status", "concluida")
    .not("sequencia", "is", null)
    .order("sequencia", { ascending: false })
    .limit(1)
    .maybeSingle();
  const material = await calcularMaterialOP(supabase, { pecaId, maquinaId, quantidade });

  const { data: op, error } = await supabase
    .from("ordens_producao")
    .insert({
      peca_id: pecaId,
      maquina_id: maquinaId,
      quantidade_planejada: quantidade,
      tempo_estimado_segundos:
        peca.tempo_padrao_segundos !== null ? peca.tempo_padrao_segundos * quantidade : null,
      criado_por: criadoPor,
      status: "planejada",
      pedido_item_id: pedidoItemId,
      sequencia: (ultima?.sequencia ?? 0) + 1,
      op_origem_id: opOrigemId,
      roteiro_etapa_origem_id: roteiroEtapaOrigemId,
      ...material,
    })
    .select("numero")
    .single();

  if (error || !op) throw new Error(error?.message ?? "Falha ao criar OP");
  if (material.material_id) await recalcularMaterial(supabase);
  return op.numero;
}

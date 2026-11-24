import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Cria uma OP no estado "planejada", no fim da fila da máquina.
 * - Se a peça já tem máquinas compatíveis cadastradas, a máquina precisa ser uma delas.
 * - Se ainda não tem nenhuma, a máquina escolhida passa a ser compatível (o cadastro se completa com o uso).
 * - Tempo estimado só é calculado se a peça tiver tempo padrão.
 */
export async function criarOPPlanejada(
  supabase: Supabase,
  args: { pecaId: string; maquinaId: string; quantidade: number; criadoPor: string; pedidoItemId?: string | null }
): Promise<number> {
  const { pecaId, maquinaId, quantidade, criadoPor, pedidoItemId = null } = args;

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
    })
    .select("numero")
    .single();

  if (error || !op) throw new Error(error?.message ?? "Falha ao criar OP");
  return op.numero;
}

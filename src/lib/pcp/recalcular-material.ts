import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { calcularStatusMaterial, ehFormatoBarra, type OPParaStatusMaterial, type PedidoAbertoMaterial } from "@/lib/pcp/material";
import type { FormatoMaterial } from "@/types/database";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Recalcula o status de material (ok/aguardando/pendente) de todas as OPs planejadas/abertas
 * que não tiveram o material travado na mão (material_status_manual = false), com base no
 * estoque de material e nos pedidos de compra em aberto. Chamado depois de qualquer evento que
 * muda essa conta: criar OP, trocar máquina, movimentar estoque, criar/receber pedido de compra.
 */
export async function recalcularMaterial(supabase: Supabase): Promise<void> {
  // Consultas em sequência (não Promise.all): disparar a renovação do token de sessão em
  // paralelo, em mais de uma consulta ao mesmo tempo, pode derrubar a sessão do usuário.
  const { data: ops } = await supabase
    .from("ordens_producao")
    .select(
      "id, maquina_id, sequencia, material_id, material_folhas_necessarias, material_metros_necessarios, material_status, previsao_material, pedido_itens(data_entrega)"
    )
    .in("status", ["planejada", "aberta"])
    .eq("material_status_manual", false)
    .not("material_id", "is", null);
  if (!ops || ops.length === 0) return;

  const { data: materiais } = await supabase.from("materiais").select("id, formato");
  const { data: estoque } = await supabase.from("estoque_materiais").select("material_id, saldo");
  const { data: pedidos } = await supabase
    .from("pedidos_compra_material")
    .select("material_id, quantidade, previsao_chegada")
    .eq("status", "pedido");

  const formatoPorMaterial = new Map((materiais ?? []).map((m) => [m.id, m.formato as FormatoMaterial]));
  const estoquePorMaterial = new Map((estoque ?? []).map((e) => [e.material_id, Number(e.saldo)]));
  const pedidosPorMaterial = new Map<string, PedidoAbertoMaterial[]>();
  for (const p of pedidos ?? []) {
    const lista = pedidosPorMaterial.get(p.material_id) ?? [];
    lista.push({ quantidade: Number(p.quantidade), previsao_chegada: p.previsao_chegada });
    pedidosPorMaterial.set(p.material_id, lista);
  }

  const entradas: OPParaStatusMaterial[] = [];
  const semCalculo: string[] = []; // OPs cujo cadastro não permite calcular necessidade -> ficam pendentes
  for (const op of ops) {
    const pedidoItem = op.pedido_itens as unknown as { data_entrega: string } | null;
    const formato = op.material_id ? formatoPorMaterial.get(op.material_id) : undefined;
    const necessidade = formato && ehFormatoBarra(formato) ? op.material_metros_necessarios : op.material_folhas_necessarias;
    if (!formato || necessidade === null || necessidade === undefined) {
      semCalculo.push(op.id);
      continue;
    }
    entradas.push({
      id: op.id,
      maquina_id: op.maquina_id,
      sequencia: op.sequencia,
      material_id: op.material_id as string,
      necessidade: Number(necessidade),
      dataEntrega: pedidoItem?.data_entrega ?? null,
    });
  }

  const resultado = calcularStatusMaterial(entradas, estoquePorMaterial, pedidosPorMaterial);

  // Updates em sequência pelo mesmo motivo das leituras acima (evitar corrida no refresh do token).
  for (const [opId, r] of resultado) {
    const atual = ops.find((o) => o.id === opId);
    if (atual && atual.material_status === r.status && atual.previsao_material === r.previsao) continue; // já está certo
    await supabase.from("ordens_producao").update({ material_status: r.status, previsao_material: r.previsao }).eq("id", opId);
  }
  for (const opId of semCalculo) {
    const atual = ops.find((o) => o.id === opId);
    if (atual?.material_status === "pendente") continue;
    await supabase.from("ordens_producao").update({ material_status: "pendente", previsao_material: null }).eq("id", opId);
  }
}

import type { FormatoMaterial, StatusPreparo } from "@/types/database";

/** Formatos que são comprados/controlados em metros de barra (todo o resto é chapa, em folhas). */
const FORMATOS_BARRA: FormatoMaterial[] = ["redonda", "sextavada", "quadrada", "retangular", "tubo"];

export function ehFormatoBarra(formato: FormatoMaterial): boolean {
  return FORMATOS_BARRA.includes(formato);
}

/** "m" para formatos em barra, "folhas" para chapa — é a unidade usada no estoque e nos pedidos de compra. */
export function unidadeMaterial(formato: FormatoMaterial): "m" | "folhas" {
  return ehFormatoBarra(formato) ? "m" : "folhas";
}

export const FORMATO_LABEL: Record<FormatoMaterial, string> = {
  redonda: "Redonda",
  sextavada: "Sextavada",
  quadrada: "Quadrada",
  retangular: "Retangular",
  tubo: "Tubo",
  chapa: "Chapa",
};

/** Rótulo pronto pra tela, ex.: "Inox 316L Ø8mm" ou "Aço 1020 Chapa 1000x2000x3mm". */
export function materialLabel(m: {
  formato: FormatoMaterial;
  tipo: string;
  medida_a_mm: number;
  medida_b_mm: number | null;
  espessura_mm: number | null;
}): string {
  const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  switch (m.formato) {
    case "redonda":
      return `${m.tipo} Ø${n(m.medida_a_mm)}mm`;
    case "sextavada":
      return `${m.tipo} Sext. ${n(m.medida_a_mm)}mm`;
    case "quadrada":
      return `${m.tipo} Quad. ${n(m.medida_a_mm)}mm`;
    case "retangular":
      return `${m.tipo} Ret. ${n(m.medida_a_mm)}x${n(m.medida_b_mm ?? 0)}mm`;
    case "tubo":
      return `${m.tipo} Tubo Ø${n(m.medida_a_mm)}x${n(m.medida_b_mm ?? 0)}mm`;
    case "chapa":
      return m.medida_b_mm !== null
        ? `${m.tipo} Chapa ${n(m.medida_a_mm)}x${n(m.medida_b_mm)}x${n(m.espessura_mm ?? 0)}mm`
        : `${m.tipo} Chapa ${n(m.espessura_mm ?? m.medida_a_mm)}mm`;
  }
}

/** Tira acento e caixa pra buscar "titanio" e achar "Titânio" (comparação tolerante). */
export function normalizarBusca(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export type ConsumoOP = {
  pecasPorUnidade: number | null;
  barrasNecessarias: number | null;
  folhasNecessarias: number | null;
  metrosNecessarios: number | null;
  /** Quando preenchido, não deu pra calcular (cadastro incompleto ou incoerente). */
  erro?: string;
};

/**
 * Calcula quantas barras/folhas (e metros, se for barra) uma OP precisa, a partir
 * do cadastro da peça (comprimento consumido ou peças por folha) e da máquina
 * (tamanho da barra + sobra), conforme o formato do material.
 */
export function calcularConsumoOP(args: {
  formato: FormatoMaterial;
  quantidadePlanejada: number;
  comprimentoConsumidoMm: number | null;
  pecasPorFolha: number | null;
  barraComprimentoMm: number | null;
  barraSobraMm: number;
}): ConsumoOP {
  const vazio: ConsumoOP = { pecasPorUnidade: null, barrasNecessarias: null, folhasNecessarias: null, metrosNecessarios: null };
  const quantidade = Math.max(args.quantidadePlanejada, 0);

  if (!ehFormatoBarra(args.formato)) {
    if (!args.pecasPorFolha || args.pecasPorFolha <= 0) {
      return { ...vazio, erro: "Cadastre quantas peças saem de 1 folha" };
    }
    const folhas = Math.ceil(quantidade / args.pecasPorFolha);
    return { pecasPorUnidade: args.pecasPorFolha, barrasNecessarias: null, folhasNecessarias: folhas, metrosNecessarios: null };
  }

  if (!args.comprimentoConsumidoMm || args.comprimentoConsumidoMm <= 0) {
    return { ...vazio, erro: "Cadastre o comprimento consumido por peça" };
  }
  if (!args.barraComprimentoMm || args.barraComprimentoMm <= 0) {
    return { ...vazio, erro: "Cadastre o tamanho de barra desta máquina" };
  }
  const util = args.barraComprimentoMm - (args.barraSobraMm || 0);
  if (util <= 0) {
    return { ...vazio, erro: "A sobra de ponta da máquina é maior que a barra" };
  }
  const pecasPorBarra = Math.floor(util / args.comprimentoConsumidoMm);
  if (pecasPorBarra < 1) {
    return { ...vazio, erro: "A peça é maior que o comprimento útil da barra" };
  }
  const barras = Math.ceil(quantidade / pecasPorBarra);
  const metros = (barras * args.barraComprimentoMm) / 1000;
  return { pecasPorUnidade: pecasPorBarra, barrasNecessarias: barras, folhasNecessarias: null, metrosNecessarios: metros };
}

// ---------------------------------------------------------------------------
// Status automático do material na OP (ok / aguardando / pendente)
// ---------------------------------------------------------------------------

export type OPParaStatusMaterial = {
  id: string;
  maquina_id: string;
  sequencia: number | null;
  material_id: string;
  necessidade: number; // metros ou folhas, na unidade do material
  dataEntrega: string | null; // data de entrega do pedido vinculado, se houver
};

export type PedidoAbertoMaterial = { quantidade: number; previsao_chegada: string | null };

export type ResultadoStatusMaterial = { status: Extract<StatusPreparo, "ok" | "aguardando" | "pendente">; previsao: string | null };

/** Texto pronto pra colar no WhatsApp com a lista de compra (o que falta, por material). */
export function montarListaCompra(itens: { label: string; faltam: number; unidade: string }[]): string {
  const linhas = itens
    .filter((i) => i.faltam > 0)
    .map((i) => `• ${i.label}: ${i.faltam.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${i.unidade}`);
  return linhas.length > 0 ? `Lista de compra de material:\n${linhas.join("\n")}` : "Nada faltando no momento.";
}

const SEM_ENTREGA = "9999-12-31";

/**
 * Decide o status de material de cada OP com base no estoque disponível e nos
 * pedidos de compra em aberto, sempre priorizando quem tem entrega mais cedo
 * (critério principal, vale também entre OPs de máquinas diferentes) e, para
 * desempate (mesma entrega ou nenhuma), a ordem da fila da máquina.
 */
export function calcularStatusMaterial(
  ops: OPParaStatusMaterial[],
  estoquePorMaterial: Map<string, number>,
  pedidosAbertosPorMaterial: Map<string, PedidoAbertoMaterial[]>
): Map<string, ResultadoStatusMaterial> {
  const resultado = new Map<string, ResultadoStatusMaterial>();

  const porMaterial = new Map<string, OPParaStatusMaterial[]>();
  for (const op of ops) {
    const lista = porMaterial.get(op.material_id) ?? [];
    lista.push(op);
    porMaterial.set(op.material_id, lista);
  }

  for (const [materialId, lista] of porMaterial) {
    const ordenada = [...lista].sort((a, b) => {
      const dA = a.dataEntrega ?? SEM_ENTREGA;
      const dB = b.dataEntrega ?? SEM_ENTREGA;
      if (dA !== dB) return dA.localeCompare(dB);
      return (a.sequencia ?? Infinity) - (b.sequencia ?? Infinity);
    });

    let restanteEstoque = Math.max(estoquePorMaterial.get(materialId) ?? 0, 0);
    const pedidos = [...(pedidosAbertosPorMaterial.get(materialId) ?? [])]
      .sort((a, b) => (a.previsao_chegada ?? SEM_ENTREGA).localeCompare(b.previsao_chegada ?? SEM_ENTREGA))
      .map((p) => ({ restante: p.quantidade, previsao_chegada: p.previsao_chegada }));

    for (const op of ordenada) {
      if (restanteEstoque >= op.necessidade) {
        restanteEstoque -= op.necessidade;
        resultado.set(op.id, { status: "ok", previsao: null });
        continue;
      }

      const falta = op.necessidade - Math.max(restanteEstoque, 0);
      restanteEstoque = Math.min(restanteEstoque, 0);

      let acumulado = 0;
      let previsaoCobertura: string | null = null;
      for (const pedido of pedidos) {
        if (acumulado >= falta) break;
        if (pedido.restante <= 0) continue;
        const usar = Math.min(pedido.restante, falta - acumulado);
        pedido.restante -= usar;
        acumulado += usar;
        previsaoCobertura = pedido.previsao_chegada;
      }

      if (acumulado >= falta) {
        resultado.set(op.id, { status: "aguardando", previsao: previsaoCobertura });
      } else {
        resultado.set(op.id, { status: "pendente", previsao: null });
      }
    }
  }

  return resultado;
}

import type { StatusOP } from "@/types/database";

/** Data de hoje (aaaa-mm-dd) no fuso da fábrica. */
export function hojeISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function formatData(iso: string | null): string {
  if (!iso) return "-";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function diasEntre(deISO: string, ateISO: string): number {
  return Math.round((Date.parse(ateISO) - Date.parse(deISO)) / 86_400_000);
}

export function formatQtd(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

/** Quantidade de peças: sempre número inteiro, nunca com vírgula. */
export function formatQtdPecas(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}

export type Situacao = "a_programar" | "parcial" | "aguardando" | "liberada" | "producao" | "produzido" | "estoque";

export const SITUACAO_LABEL: Record<Situacao, string> = {
  a_programar: "A programar",
  parcial: "OP parcial",
  aguardando: "Aguardando preparo",
  liberada: "Liberada",
  producao: "Em produção",
  produzido: "Produzido",
  estoque: "Coberto pelo estoque",
};

export const SITUACAO_CLASS: Record<Situacao, string> = {
  a_programar: "bg-red-100 text-red-700",
  parcial: "bg-orange-100 text-orange-800",
  aguardando: "bg-amber-100 text-amber-800",
  liberada: "bg-emerald-100 text-emerald-800",
  producao: "bg-green-100 text-green-700",
  produzido: "bg-brand-100 text-brand-700",
  estoque: "bg-sky-100 text-sky-700",
};

export type ItemEntrada = {
  id: string;
  peca_id: string | null;
  data_entrega: string;
  quantidade: number;
};

export type OPEntrada = {
  numero: number;
  status: StatusOP;
  pedido_item_id: string | null;
  quantidade_planejada: number;
};

export type CalculoItem = {
  qtdEmOP: number;
  cobertoEstoque: number;
  falta: number;
  situacao: Situacao;
  ops: OPEntrada[];
};

/**
 * Para cada item aberto: quanto já tem OP, quanto o estoque cobre (por ordem de entrega) e quanto falta programar.
 * O estoque de cada peça é consumido primeiro pelos itens com entrega mais cedo.
 */
export function calcularCarteira(
  itens: ItemEntrada[],
  ops: OPEntrada[],
  saldoEstoque: Map<string, number>
): Map<string, CalculoItem> {
  const opsPorItem = new Map<string, OPEntrada[]>();
  for (const op of ops) {
    if (!op.pedido_item_id) continue;
    const lista = opsPorItem.get(op.pedido_item_id) ?? [];
    lista.push(op);
    opsPorItem.set(op.pedido_item_id, lista);
  }

  const restante = new Map(saldoEstoque);
  const ordenados = [...itens].sort((a, b) => a.data_entrega.localeCompare(b.data_entrega));
  const resultado = new Map<string, CalculoItem>();

  for (const item of ordenados) {
    const opsItem = opsPorItem.get(item.id) ?? [];
    const qtdEmOP = opsItem.reduce((s, o) => s + Number(o.quantidade_planejada), 0);
    const necessidade = Math.max(Number(item.quantidade) - qtdEmOP, 0);

    let cobertoEstoque = 0;
    if (item.peca_id && necessidade > 0) {
      const disponivel = Math.max(restante.get(item.peca_id) ?? 0, 0);
      cobertoEstoque = Math.min(disponivel, necessidade);
      restante.set(item.peca_id, disponivel - cobertoEstoque);
    }
    const falta = necessidade - cobertoEstoque;

    let situacao: Situacao;
    if (falta > 0) situacao = opsItem.length === 0 ? "a_programar" : "parcial";
    else if (opsItem.length === 0) situacao = "estoque";
    else if (opsItem.some((o) => ["setup", "em_producao", "parada"].includes(o.status))) situacao = "producao";
    else if (opsItem.some((o) => o.status === "planejada")) situacao = "aguardando";
    else if (opsItem.some((o) => o.status === "aberta")) situacao = "liberada";
    else situacao = "produzido";

    resultado.set(item.id, { qtdEmOP, cobertoEstoque, falta, situacao, ops: opsItem });
  }

  return resultado;
}

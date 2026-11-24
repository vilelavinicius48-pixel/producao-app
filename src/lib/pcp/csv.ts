/**
 * Leitura da carteira de pedidos ("Relatório de Pedidos em Aberto"), da planilha Excel ou de CSV.
 * O navegador transforma o arquivo numa tabela de textos; a interpretação abaixo roda no servidor.
 *
 * Colunas reconhecidas (nome do cabeçalho, sem acento/maiúscula/espaço):
 *   Cliente · Data Entrega · Pedido Compra · Nº Pedido · Data Pedido · Código · Descrição · Qtdade
 * Também aceita uma coluna única "Código - Descrição do Produto".
 */

export type LinhaCarteira = {
  cliente: string;
  numero_pedido: string;
  pedido_compra: string | null;
  data_pedido: string | null; // ISO yyyy-mm-dd
  data_entrega: string; // ISO yyyy-mm-dd
  codigo: string;
  descricao: string;
  quantidade: number;
  empresa: string | null; // "Empresa Grupo": qual das empresas do grupo emitiu o pedido
};

export type ResultadoLeitura = { linhas: LinhaCarteira[]; erros: string[] };

type Campo =
  | "cliente"
  | "data_entrega"
  | "pedido_compra"
  | "numero_pedido"
  | "data_pedido"
  | "codigo"
  | "descricao"
  | "codigo_descricao"
  | "quantidade"
  | "empresa";

const SINONIMOS: Record<Campo, string[]> = {
  cliente: ["cliente", "nomecliente", "razaosocial", "nomedocliente"],
  data_entrega: ["dataentrega", "entrega", "dtentrega", "prazo", "dataprevista"],
  pedido_compra: ["pedidocompra", "pedidodecompra", "pedidocliente", "ordemcompra", "oc", "pc"],
  numero_pedido: ["npedido", "nopedido", "numeropedido", "numpedido", "pedido", "pedidovenda"],
  data_pedido: ["datapedido", "dtpedido", "emissao", "dataemissao"],
  codigo: ["codigo", "codproduto", "codigoproduto", "produto", "item", "coditem"],
  descricao: ["descricao", "descricaoproduto", "descricaodoproduto", "descricaoitem"],
  codigo_descricao: ["codigodescricaodoproduto", "codigodescricaoproduto", "codigodescricao"],
  quantidade: ["qtdade", "quantidade", "qtd", "qtde", "saldo", "qtdpendente", "saldopendente"],
  empresa: ["empresagrupo", "empresa", "filial"],
};

export function normalizarCabecalho(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function detectarSeparador(primeiraLinha: string): string {
  const contagem = [";", "\t", ","].map((sep) => ({ sep, n: primeiraLinha.split(sep).length }));
  contagem.sort((a, b) => b.n - a.n);
  return contagem[0].n > 1 ? contagem[0].sep : ";";
}

/** Parser CSV simples com suporte a aspas. */
export function parseCSV(texto: string, sep?: string): string[][] {
  const limpo = texto.replace(/^﻿/, "");
  const separador = sep ?? detectarSeparador(limpo.split(/\r?\n/, 1)[0] ?? "");
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;

  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (aspas) {
      if (c === '"') {
        if (limpo[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          aspas = false;
        }
      } else {
        campo += c;
      }
    } else if (c === '"') {
      aspas = true;
    } else if (c === separador) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && limpo[i + 1] === "\n") i++;
      linha.push(campo);
      campo = "";
      if (linha.some((v) => v.trim() !== "")) linhas.push(linha);
      linha = [];
    } else {
      campo += c;
    }
  }
  linha.push(campo);
  if (linha.some((v) => v.trim() !== "")) linhas.push(linha);
  return linhas;
}

/** dd/mm/aaaa, dd/mm/aa, aaaa-mm-dd ou número de série do Excel → aaaa-mm-dd. */
export function parseData(valor: string): string | null {
  const v = valor.trim();
  if (!v) return null;
  if (/^\d{5}$/.test(v)) {
    // Data do Excel que veio como número (dias desde 30/12/1899).
    const serie = Number(v);
    if (serie > 20000 && serie < 80000) {
      return new Date(Date.UTC(1899, 11, 30) + serie * 86_400_000).toISOString().slice(0, 10);
    }
  }
  let m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?!\d)/);
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${ano}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

/** Número no formato brasileiro ("1.000,00") ou internacional ("1000.00"). */
export function parseNumero(valor: string): number | null {
  const v = valor.trim().replace(/\s/g, "");
  if (!v) return null;
  let normal: string;
  if (v.includes(",")) normal = v.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(v)) normal = v.replace(/\./g, "");
  else normal = v;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

export function chaveItem(l: Pick<LinhaCarteira, "numero_pedido" | "codigo" | "data_entrega">): string {
  return `${l.numero_pedido.trim()}|${l.codigo.trim().toUpperCase()}|${l.data_entrega}`;
}

export function lerCarteiraCSV(texto: string): ResultadoLeitura {
  return lerCarteiraTabela(parseCSV(texto));
}

/** Lê a carteira de uma tabela (linhas × colunas de texto), vinda do Excel ou de um CSV. */
export function lerCarteiraTabela(tabela: string[][]): ResultadoLeitura {
  const erros: string[] = [];
  if (tabela.length < 2) return { linhas: [], erros: ["Arquivo vazio ou sem linhas de pedido."] };

  // Procura a linha de cabeçalho nas primeiras 15 linhas (relatórios às vezes têm título antes).
  let idxCab = -1;
  let mapa: Partial<Record<Campo, number>> = {};
  for (let i = 0; i < Math.min(15, tabela.length); i++) {
    const normal = tabela[i].map(normalizarCabecalho);
    const tentativa: Partial<Record<Campo, number>> = {};
    (Object.keys(SINONIMOS) as Campo[]).forEach((campo) => {
      const idx = normal.findIndex((h) => SINONIMOS[campo].includes(h));
      if (idx >= 0) tentativa[campo] = idx;
    });
    const temCodigo = tentativa.codigo !== undefined || tentativa.codigo_descricao !== undefined;
    if (tentativa.data_entrega !== undefined && tentativa.quantidade !== undefined && temCodigo) {
      idxCab = i;
      mapa = tentativa;
      break;
    }
  }

  if (idxCab < 0) {
    return {
      linhas: [],
      erros: [
        "Não encontrei o cabeçalho. O arquivo precisa ter pelo menos as colunas Data Entrega, Código e Qtdade.",
      ],
    };
  }

  const pegar = (linha: string[], campo: Campo) =>
    mapa[campo] !== undefined ? (linha[mapa[campo]!] ?? "").trim() : "";

  const linhas: LinhaCarteira[] = [];
  let clienteAtual = "";

  for (let i = idxCab + 1; i < tabela.length; i++) {
    const linha = tabela[i];
    const nLinha = i + 1;

    // Relatório agrupado: linha "Cliente: XYZ" sem dados.
    const primeira = (linha[0] ?? "").trim();
    const mCliente = primeira.match(/^Cliente:\s*(.+)$/i);
    if (mCliente) {
      clienteAtual = mCliente[1].trim();
      continue;
    }

    let codigo = pegar(linha, "codigo");
    let descricao = pegar(linha, "descricao");
    if (!codigo && mapa.codigo_descricao !== undefined) {
      const cd = pegar(linha, "codigo_descricao");
      const sep = cd.indexOf(" - ");
      codigo = sep >= 0 ? cd.slice(0, sep).trim() : cd;
      descricao = sep >= 0 ? cd.slice(sep + 3).trim() : cd;
    }

    const entregaBruta = pegar(linha, "data_entrega");
    const qtdBruta = pegar(linha, "quantidade");
    if (!codigo && !entregaBruta && !qtdBruta) continue; // linha de rodapé/vazia

    const data_entrega = parseData(entregaBruta);
    const quantidade = parseNumero(qtdBruta);
    const numero_pedido = pegar(linha, "numero_pedido");
    const cliente = pegar(linha, "cliente") || clienteAtual;

    if (!codigo) {
      erros.push(`Linha ${nLinha}: sem código do produto.`);
      continue;
    }
    if (!data_entrega) {
      erros.push(`Linha ${nLinha} (${codigo}): data de entrega inválida "${entregaBruta}".`);
      continue;
    }
    if (quantidade === null) {
      erros.push(`Linha ${nLinha} (${codigo}): quantidade inválida "${qtdBruta}".`);
      continue;
    }
    if (!numero_pedido) {
      erros.push(`Linha ${nLinha} (${codigo}): sem nº do pedido.`);
      continue;
    }

    linhas.push({
      cliente: cliente || "(sem cliente)",
      numero_pedido,
      pedido_compra: pegar(linha, "pedido_compra") || null,
      data_pedido: parseData(pegar(linha, "data_pedido")),
      data_entrega,
      codigo,
      descricao: descricao || codigo,
      quantidade: Math.round(quantidade * 10000) / 10000,
      empresa: pegar(linha, "empresa") || null,
    });
  }

  if (linhas.length === 0 && erros.length === 0) erros.push("Nenhuma linha de pedido encontrada.");
  return { linhas, erros };
}

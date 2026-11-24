/**
 * Leitura da planilha "Controle de Matéria Prima" (estoque inicial de material), vinda do
 * controle manual da empresa. É um texto livre (ex.: "Barra Redonda Inox 316L - Ø 8mm" ou
 * "Tubo Inox Ø 1,5x0,5mm"), então o resultado é sempre uma PRÉVIA que o gestor revisa e corrige
 * antes de confirmar — nunca importa direto sem olhar.
 */
import type { FormatoMaterial } from "@/types/database";

export type ItemEstoqueMaterial = {
  linha: number;
  textoOriginal: string;
  reconhecido: boolean;
  formato: FormatoMaterial | null;
  tipo: string;
  medidaAMm: number | null;
  medidaBMm: number | null;
  espessuraMm: number | null;
  /** Já convertida pra unidade do material (metros pra barra, folhas pra chapa). */
  quantidade: number;
  motivoNaoReconhecido?: string;
};

const POLEGADA_MM = 25.4;

/** "1.000" (separador de milhar) vira 1000; "6,35" (decimal) vira 6.35. Nunca os dois juntos num mesmo número. */
function numeroBR(s: string): number | null {
  const limpo = s.trim();
  if (!limpo) return null;
  if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) return Number(limpo.replace(/\./g, ""));
  const n = Number(limpo.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** "1/4" -> 0.25 ; "1.1/2" ou "1-1/2" (um inteiro e uma fração) -> 1.5 ; "1" -> 1 */
function fracaoPolegadas(s: string): number | null {
  const limpo = s.trim();
  const mista = limpo.match(/^(\d+)[.\-](\d+)\/(\d+)$/);
  if (mista) return Number(mista[1]) + Number(mista[2]) / Number(mista[3]);
  const fracao = limpo.match(/^(\d+)\/(\d+)$/);
  if (fracao) return Number(fracao[1]) / Number(fracao[2]);
  const inteiro = limpo.match(/^(\d+(?:[.,]\d+)?)$/);
  if (inteiro) return numeroBR(inteiro[1]);
  return null;
}

/**
 * Uma medida em "N mm", em polegada com a conversão já dada entre parênteses, ou só em polegada.
 * Não exige que a medida seja o resto todo da frase: ignora anotação de fornecedor/lote que
 * sobrar depois dela (ex.: "1/8\"(3,17mm) TECNOAR" ou "1,0mm CASSIFLEX").
 */
function medidaMm(trecho: string): number | null {
  const s = trecho.trim().replace(/''/g, '"');
  const comPolegadaEMm = s.match(/^(\d+(?:[.\-]\d+\/\d+|\/\d+)?)"\s*\(([\d.,]+)\s*mm\)/i);
  if (comPolegadaEMm) return numeroBR(comPolegadaEMm[2]);
  const soMm = s.match(/^([\d.,]+)\s*mm\b/i);
  if (soMm) return numeroBR(soMm[1]);
  const soPolegada = s.match(/^(\d+(?:[.\-]\d+\/\d+|\/\d+)?)"/);
  if (soPolegada) {
    const pol = fracaoPolegadas(soPolegada[1]);
    return pol !== null ? Math.round(pol * POLEGADA_MM * 100) / 100 : null;
  }
  // só número solto (ex.: "6,0" num pedaço de chapa) — aceita como mm
  const soNumero = s.match(/^([\d.,]+)/);
  if (soNumero) return numeroBR(soNumero[1]);
  return null;
}

/** Corrige símbolos que vieram corrompidos na planilha (fontes antigas usam "¤"/"◙" no lugar de "Ø"). */
function normaliza(desc: string): string {
  return desc.replace(/[¤◙]/g, "Ø").replace(/\s+/g, " ").trim();
}

/** Tira anotação de fornecedor/lote no fim (ex.: "TECNOAR", "EMFILS (3640322)") pra o tipo ficar mais limpo. */
function limpaTipo(tipo: string): string {
  return tipo
    .replace(/\s*\([^)]*\d[^)]*\)\s*$/g, "")
    .replace(/\s+[A-ZÀ-Ú]{4,}\s*$/g, "")
    .replace(/[-\s]+$/, "")
    .trim();
}

type Deteccao = { formato: FormatoMaterial; prefixoRegex: RegExp };

const DETECCOES: Deteccao[] = [
  { formato: "sextavada", prefixoRegex: /^Barra\s+Sextavada\s*/i },
  { formato: "quadrada", prefixoRegex: /^Barra\s+Quadrada\s*/i },
  { formato: "retangular", prefixoRegex: /^Barra\s+(Retangular|Chata)\s*/i },
  { formato: "tubo", prefixoRegex: /^Tubo\s+/i },
  { formato: "chapa", prefixoRegex: /^(Chapa\s+(Quadrada|Retangular)\s+|Chapa\s*|Placa\s+de\s*)/i },
  { formato: "redonda", prefixoRegex: /^(Barra\s+Redonda|BR|Tarugo\s+Redondo|Tarugo\s+de|Tarugo|Fio\s+de)\s*/i },
];

/** Separa "tipo" (nome da liga/material) da "medida" (bitola/dimensões): a medida começa no último
 *  " - " antes dela, ou (quando não há " - ") no primeiro "Ø" — nunca no primeiro dígito, porque
 *  nomes de liga costumam ter números colados (ex.: "SAE-1020", "Inox 316L", "6351T6"). */
function dividirTipoEMedida(resto: string): { tipo: string; medidas: string } {
  const ultimoSeparador = resto.lastIndexOf(" - ");
  let tipoBruto: string;
  let medidas: string;
  if (ultimoSeparador >= 0) {
    tipoBruto = resto.slice(0, ultimoSeparador);
    medidas = resto.slice(ultimoSeparador + 3);
  } else {
    const idxO = resto.indexOf("Ø");
    if (idxO >= 0) {
      tipoBruto = resto.slice(0, idxO);
      medidas = resto.slice(idxO);
    } else {
      // sem " - " nem "Ø" (ex.: "Acrílico 10X1.000X2.000 mm") — acha onde começa um token "NxM"
      const dimensaoColada = resto.match(/\d[\d.,]*\s*[xX]\s*\d/);
      if (!dimensaoColada) return { tipo: limpaTipo(resto), medidas: "" };
      const idx = resto.indexOf(dimensaoColada[0]);
      tipoBruto = resto.slice(0, idx);
      medidas = resto.slice(idx);
    }
  }
  medidas = medidas.trim().replace(/^Ø\s*/i, "");
  return { tipo: limpaTipo(tipoBruto), medidas };
}

export type GrupoEstoqueMaterial = {
  formato: FormatoMaterial;
  tipo: string;
  medidaAMm: number;
  medidaBMm: number | null;
  espessuraMm: number | null;
  quantidade: number;
  origens: string[]; // descrições originais que foram somadas neste grupo (lotes/fornecedores diferentes)
};

/** Agrupa itens reconhecidos iguais (mesmo formato+tipo+medida), somando a quantidade — a planilha
 *  real tem o mesmo material repetido várias vezes por causa de lote/fornecedor/local diferentes. */
export function agruparItensEstoqueMaterial(itens: ItemEstoqueMaterial[]): GrupoEstoqueMaterial[] {
  const grupos = new Map<string, GrupoEstoqueMaterial>();
  for (const it of itens) {
    if (!it.reconhecido || !it.formato) continue;
    const chave = `${it.formato}|${it.tipo}|${it.medidaAMm}|${it.medidaBMm}|${it.espessuraMm}`;
    const existente = grupos.get(chave);
    if (existente) {
      existente.quantidade += it.quantidade;
      existente.origens.push(it.textoOriginal);
    } else {
      grupos.set(chave, {
        formato: it.formato,
        tipo: it.tipo,
        medidaAMm: it.medidaAMm as number,
        medidaBMm: it.medidaBMm,
        espessuraMm: it.espessuraMm,
        quantidade: it.quantidade,
        origens: [it.textoOriginal],
      });
    }
  }
  return [...grupos.values()].sort((a, b) => a.tipo.localeCompare(b.tipo));
}

export function interpretarLinhaEstoqueMaterial(linha: number, textoOriginal: string, totalBruto: number): ItemEstoqueMaterial {
  const desc = normaliza(textoOriginal);
  const base: ItemEstoqueMaterial = {
    linha,
    textoOriginal,
    reconhecido: false,
    formato: null,
    tipo: desc,
    medidaAMm: null,
    medidaBMm: null,
    espessuraMm: null,
    quantidade: 0,
  };

  const deteccao = DETECCOES.find((d) => d.prefixoRegex.test(desc));
  if (!deteccao) return { ...base, motivoNaoReconhecido: "Formato não reconhecido (cadastre à mão)" };

  const resto = desc.replace(deteccao.prefixoRegex, "");
  const { tipo, medidas } = dividirTipoEMedida(resto);
  if (!medidas) return { ...base, formato: deteccao.formato, tipo, motivoNaoReconhecido: "Não encontrei a medida" };

  if (deteccao.formato === "redonda" || deteccao.formato === "sextavada") {
    const valor = medidaMm(medidas);
    if (valor === null) return { ...base, formato: deteccao.formato, tipo, motivoNaoReconhecido: "Não entendi a bitola" };
    return { ...base, reconhecido: true, formato: deteccao.formato, tipo, medidaAMm: valor, quantidade: totalBruto / 1000 };
  }

  if (deteccao.formato === "quadrada") {
    const valor = medidaMm(medidas);
    if (valor === null) return { ...base, formato: deteccao.formato, tipo, motivoNaoReconhecido: "Não entendi o lado" };
    return { ...base, reconhecido: true, formato: deteccao.formato, tipo, medidaAMm: valor, quantidade: totalBruto / 1000 };
  }

  if (deteccao.formato === "retangular") {
    const partes = medidas.split(/\s*[xX]\s*/).filter(Boolean);
    if (partes.length < 2) return { ...base, formato: deteccao.formato, tipo, motivoNaoReconhecido: "Não entendi largura x altura" };
    const a = medidaMm(partes[0]);
    const b = medidaMm(partes[1]);
    if (a === null || b === null) return { ...base, formato: deteccao.formato, tipo, motivoNaoReconhecido: "Não entendi largura x altura" };
    return { ...base, reconhecido: true, formato: deteccao.formato, tipo, medidaAMm: a, medidaBMm: b, quantidade: totalBruto / 1000 };
  }

  if (deteccao.formato === "tubo") {
    const partes = medidas.split(/\s*[xX]\s*/).filter(Boolean);
    if (partes.length < 2) return { ...base, formato: deteccao.formato, tipo, motivoNaoReconhecido: "Não entendi diâmetro x parede" };
    const diametro = medidaMm(partes[0]);
    const parede = medidaMm(partes[1]);
    if (diametro === null || parede === null) return { ...base, formato: deteccao.formato, tipo, motivoNaoReconhecido: "Não entendi diâmetro x parede" };
    return { ...base, reconhecido: true, formato: deteccao.formato, tipo, medidaAMm: diametro, medidaBMm: parede, quantidade: totalBruto / 1000 };
  }

  // chapa: 1 a 3 medidas separadas por x (mm, ou polegada — ex.: "4\"x463x463mm") — o primeiro número é
  // a espessura; quantidade já vem em folhas/peças.
  const semPC = medidas.replace(/\(\s*P[ÇC]\s*\)/i, "").trim();
  const numeros = semPC
    .split(/\s*[xX]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (numeros.length < 1) return { ...base, formato: "chapa", tipo, motivoNaoReconhecido: "Não entendi as medidas da chapa" };
  const vals = numeros.map((n) => medidaMm(n));
  if (vals.some((v) => v === null)) return { ...base, formato: "chapa", tipo, motivoNaoReconhecido: "Não entendi as medidas da chapa" };
  const [espessura, largura, comprimento] = vals as number[];
  return {
    ...base,
    reconhecido: true,
    formato: "chapa",
    tipo,
    espessuraMm: espessura,
    medidaAMm: largura ?? espessura,
    medidaBMm: comprimento ?? null,
    quantidade: totalBruto,
  };
}

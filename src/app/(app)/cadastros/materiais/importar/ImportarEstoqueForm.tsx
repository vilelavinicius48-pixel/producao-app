"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  confirmarImportacaoEstoqueMaterial,
  preVisualizarEstoqueMaterial,
  type PreviaImportacaoEstoque,
  type ResultadoImportacaoEstoque,
} from "./actions";
import { FORMATO_LABEL, materialLabel, unidadeMaterial } from "@/lib/pcp/material";
import type { GrupoEstoqueMaterial } from "@/lib/pcp/estoque-material-import";

/** Lê o arquivo e devolve a aba "RESUMO DE ESTOQUE" (ou a 1ª aba cujo nome contenha "RESUMO"), como texto. */
async function lerAbaResumo(arquivo: File): Promise<string[][]> {
  const XLSX = await import("@e965/xlsx");
  const pasta = XLSX.read(await arquivo.arrayBuffer(), { type: "array" });
  const nomeAba = pasta.SheetNames.find((n) => n.toUpperCase().includes("RESUMO")) ?? pasta.SheetNames[0];
  const aba = pasta.Sheets[nomeAba];
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, raw: true, defval: "" });
  return linhas.map((linha) => linha.map((v) => (v === null || v === undefined ? "" : String(v))));
}

type GrupoEditavel = GrupoEstoqueMaterial & { incluir: boolean };

export function ImportarEstoqueForm() {
  const [previa, setPrevia] = useState<PreviaImportacaoEstoque | null>(null);
  const [itens, setItens] = useState<GrupoEditavel[]>([]);
  const [resultado, setResultado] = useState<ResultadoImportacaoEstoque | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  async function escolher(f: File | null) {
    setPrevia(null);
    setResultado(null);
    setErro(null);
    if (!f) return;
    startTransition(async () => {
      try {
        const tabela = await lerAbaResumo(f);
        const r = await preVisualizarEstoqueMaterial(tabela);
        if (r.erro) {
          setErro(r.erro);
          return;
        }
        setPrevia(r);
        setItens(r.grupos.map((g) => ({ ...g, incluir: true })));
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não consegui ler a planilha.");
      }
    });
  }

  function confirmar() {
    const selecionados = itens.filter((i) => i.incluir);
    startTransition(async () => {
      try {
        setResultado(await confirmarImportacaoEstoqueMaterial(selecionados));
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
      }
    });
  }

  const porFormato = useMemo(() => {
    const grupos = new Map<string, (GrupoEditavel & { indice: number })[]>();
    itens.forEach((it, indice) => {
      const lista = grupos.get(it.formato) ?? [];
      lista.push({ ...it, indice });
      grupos.set(it.formato, lista);
    });
    return grupos;
  }, [itens]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Planilha de controle de matéria-prima (aba &quot;RESUMO DE ESTOQUE&quot;)
        </label>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => escolher(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-700"
        />
        <p className="mt-2 text-xs text-slate-500">
          A leitura é automática (texto livre), então revise a lista antes de confirmar — desmarque o que não
          quiser importar, ou ajuste a quantidade. O que não for reconhecido fica numa lista separada pra
          cadastrar à mão depois.
        </p>
      </div>

      {pendente && <p className="text-sm text-slate-600">Processando…</p>}
      {erro && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {resultado && !resultado.erro && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <p className="font-semibold">Importação concluída</p>
          <p className="mt-1">
            {resultado.criados} material(is) novo(s) · {resultado.somados} já existiam (quantidade somada) ·{" "}
            {resultado.ignoradosZero} com quantidade zero (ignorados)
          </p>
          <Link href="/cadastros/materiais" className="mt-3 inline-block font-semibold text-green-800 underline">
            Ver catálogo de materiais →
          </Link>
        </div>
      )}

      {previa && !resultado && (
        <>
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
            <p className="font-semibold">Prévia — nada foi gravado ainda</p>
            <p className="mt-1">
              {previa.linhasLidas} linhas lidas · {itens.length} materiais identificados (já somando lotes
              repetidos) · {previa.naoReconhecidos.length} não reconhecidos
            </p>
            <button
              type="button"
              onClick={confirmar}
              disabled={pendente || itens.filter((i) => i.incluir).length === 0}
              className="mt-3 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Confirmar importação ({itens.filter((i) => i.incluir).length} selecionados)
            </button>
          </div>

          {[...porFormato.entries()].map(([formato, lista]) => (
            <details key={formato} className="rounded-xl border border-slate-200 bg-white" open={lista.length <= 20}>
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900">
                <span className="mr-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{lista.length}</span>
                {FORMATO_LABEL[formato as GrupoEstoqueMaterial["formato"]]}
              </summary>
              <div className="max-h-96 overflow-auto border-t border-slate-100">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {lista.map((g) => {
                      const { indice } = g;
                      return (
                        <tr key={indice} className={g.incluir ? "" : "opacity-40"}>
                          <td className="px-3 py-1.5">
                            <input
                              type="checkbox"
                              checked={g.incluir}
                              onChange={(e) =>
                                setItens((arr) => arr.map((it, i) => (i === indice ? { ...it, incluir: e.target.checked } : it)))
                              }
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            {materialLabel({
                              formato: g.formato,
                              tipo: g.tipo,
                              medida_a_mm: g.medidaAMm,
                              medida_b_mm: g.medidaBMm,
                              espessura_mm: g.espessuraMm,
                            })}
                            {g.origens.length > 1 && <span className="ml-1 text-xs text-slate-400">({g.origens.length} lotes)</span>}
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <input
                              inputMode="decimal"
                              value={g.quantidade}
                              onChange={(e) =>
                                setItens((arr) =>
                                  arr.map((it, i) => (i === indice ? { ...it, quantidade: Number(e.target.value) || 0 } : it))
                                )
                              }
                              className="w-24 rounded border border-slate-300 px-2 py-1 text-right text-xs"
                            />
                          </td>
                          <td className="px-3 py-1.5 text-xs text-slate-500">{unidadeMaterial(g.formato)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          ))}

          {previa.naoReconhecidos.length > 0 && (
            <details className="rounded-xl border border-amber-200 bg-amber-50">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-amber-900">
                <span className="mr-2 rounded-full bg-amber-200 px-2 py-0.5 text-xs text-amber-900">
                  {previa.naoReconhecidos.length}
                </span>
                Não reconhecidos — cadastre à mão se forem matéria-prima de verdade
              </summary>
              <ul className="max-h-60 overflow-auto border-t border-amber-100 px-4 py-2 text-xs text-amber-900">
                {previa.naoReconhecidos.map((n, i) => (
                  <li key={i} className="py-0.5">
                    {n.textoOriginal} — <span className="text-amber-700">{n.motivo}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}

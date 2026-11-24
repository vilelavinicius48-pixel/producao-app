"use client";

import { useState } from "react";
import { createMaterial } from "./actions";
import type { FormatoMaterial } from "@/types/database";
import { FORMATO_LABEL } from "@/lib/pcp/material";

const FORMATOS: FormatoMaterial[] = ["redonda", "sextavada", "quadrada", "retangular", "tubo", "chapa"];

/** Rótulo de cada campo conforme o formato escolhido (a coluna no banco é sempre a mesma, só muda o nome na tela). */
const CAMPO_A: Record<FormatoMaterial, string> = {
  redonda: "Diâmetro (mm)",
  sextavada: "Medida entre faces (mm)",
  quadrada: "Lado (mm)",
  retangular: "Largura (mm)",
  tubo: "Diâmetro externo (mm)",
  chapa: "Largura da folha (mm)",
};
const CAMPO_B: Partial<Record<FormatoMaterial, string>> = {
  retangular: "Altura (mm)",
  tubo: "Diâmetro interno (mm)",
  chapa: "Comprimento da folha (mm)",
};

export function MaterialForm() {
  const [formato, setFormato] = useState<FormatoMaterial>("redonda");

  return (
    <form action={createMaterial} className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Formato</label>
        <select
          name="formato"
          value={formato}
          onChange={(e) => setFormato(e.target.value as FormatoMaterial)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        >
          {FORMATOS.map((f) => (
            <option key={f} value={f}>
              {FORMATO_LABEL[f]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1">
        <label className="mb-1 block text-sm font-medium text-slate-700">Tipo / liga</label>
        <input
          name="tipo"
          required
          placeholder="Ex.: Inox 316L, Titânio Gr5"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">{CAMPO_A[formato]}</label>
        <input
          name="medida_a_mm"
          inputMode="decimal"
          required
          className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
      </div>
      {CAMPO_B[formato] && (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">{CAMPO_B[formato]}</label>
          <input
            name="medida_b_mm"
            inputMode="decimal"
            required
            className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
      )}
      {formato === "chapa" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Espessura (mm)</label>
          <input
            name="espessura_mm"
            inputMode="decimal"
            required
            className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
      )}
      <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
        Adicionar
      </button>
    </form>
  );
}

"use client";

import { useState } from "react";
import { createPeca } from "../actions";
import { TimeInput } from "@/components/TimeInput";
import type { Maquina } from "@/types/database";

interface MaterialRow {
  material: string;
  quantidade_por_unidade: string;
  unidade_medida: string;
}

const EMPTY_ROW: MaterialRow = { material: "", quantidade_por_unidade: "", unidade_medida: "un" };

export function PecaForm({ maquinas }: { maquinas: Maquina[] }) {
  const [materiais, setMateriais] = useState<MaterialRow[]>([{ ...EMPTY_ROW }]);

  function updateRow(index: number, patch: Partial<MaterialRow>) {
    setMateriais((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setMateriais((rows) => [...rows, { ...EMPTY_ROW }]);
  }

  function removeRow(index: number) {
    setMateriais((rows) => rows.filter((_, i) => i !== index));
  }

  const materiaisJson = JSON.stringify(
    materiais
      .filter((r) => r.material.trim())
      .map((r) => ({
        material: r.material,
        quantidade_por_unidade: Number(r.quantidade_por_unidade),
        unidade_medida: r.unidade_medida,
      }))
  );

  return (
    <form action={createPeca} className="space-y-6">
      <input type="hidden" name="materiais_json" value={materiaisJson} />

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Código</label>
          <input
            name="codigo"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <TimeInput name="tempo_padrao_segundos" label="Tempo padrão por unidade (h:min:s)" required />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">Descrição</label>
          <input
            name="descricao"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Máquinas compatíveis</h2>
        {maquinas.length === 0 ? (
          <p className="text-sm text-slate-600">
            Nenhuma máquina cadastrada ainda. Cadastre máquinas antes de criar a peça.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {maquinas.map((m) => (
              <label key={m.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="maquina_id" value={m.id} className="h-4 w-4" />
                {m.codigo} — {m.nome}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Materiais necessários (por unidade)</h2>
          <button
            type="button"
            onClick={addRow}
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            + adicionar material
          </button>
        </div>

        <div className="space-y-2">
          {materiais.map((row, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-slate-600">Material</label>
                <input
                  value={row.material}
                  onChange={(e) => updateRow(i, { material: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="w-32">
                <label className="mb-1 block text-xs text-slate-600">Qtd./unidade</label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={row.quantidade_por_unidade}
                  onChange={(e) => updateRow(i, { quantidade_por_unidade: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="w-24">
                <label className="mb-1 block text-xs text-slate-600">Unidade</label>
                <input
                  value={row.unidade_medida}
                  onChange={(e) => updateRow(i, { unidade_medida: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        type="submit"
        className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Salvar peça
      </button>
    </form>
  );
}

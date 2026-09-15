"use client";

import { useState } from "react";
import { createInspecao } from "../actions";

export function InspecaoForm({ apontamentoId, quantidadeProduzida }: { apontamentoId: string; quantidadeProduzida: number }) {
  const [aprovada, setAprovada] = useState(String(quantidadeProduzida));
  const [reprovada, setReprovada] = useState("0");
  const [retrabalho, setRetrabalho] = useState("0");

  const total = (Number(aprovada) || 0) + (Number(reprovada) || 0) + (Number(retrabalho) || 0);
  const excedeu = total > quantidadeProduzida + 0.001;

  return (
    <form action={createInspecao} className="mt-6 space-y-4">
      <input type="hidden" name="apontamento_id" value={apontamentoId} />

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-green-700">Aprovada</label>
          <input
            name="quantidade_aprovada"
            type="number"
            min="0"
            step="0.0001"
            required
            value={aprovada}
            onChange={(e) => setAprovada(e.target.value)}
            className="w-full rounded-xl border border-green-300 bg-green-50 px-3 py-4 text-center text-lg font-semibold text-green-900 focus:border-green-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-red-700">Reprovada</label>
          <input
            name="quantidade_reprovada"
            type="number"
            min="0"
            step="0.0001"
            required
            value={reprovada}
            onChange={(e) => setReprovada(e.target.value)}
            className="w-full rounded-xl border border-red-300 bg-red-50 px-3 py-4 text-center text-lg font-semibold text-red-900 focus:border-red-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-amber-700">Retrabalho</label>
          <input
            name="quantidade_retrabalho"
            type="number"
            min="0"
            step="0.0001"
            required
            value={retrabalho}
            onChange={(e) => setRetrabalho(e.target.value)}
            className="w-full rounded-xl border border-amber-300 bg-amber-50 px-3 py-4 text-center text-lg font-semibold text-amber-900 focus:border-amber-500 focus:outline-none"
          />
        </div>
      </div>

      <p className={`text-sm font-medium ${excedeu ? "text-red-600" : "text-slate-600"}`}>
        Total inspecionado: {total} / {quantidadeProduzida} produzido
        {excedeu && " — não pode passar do produzido"}
      </p>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Observação</label>
        <textarea
          name="observacao"
          rows={4}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={excedeu}
        className="w-full rounded-xl bg-blue-600 px-4 py-4 text-lg font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        Registrar inspeção
      </button>
    </form>
  );
}

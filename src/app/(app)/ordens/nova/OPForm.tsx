"use client";

import { useMemo, useState } from "react";
import { createOP } from "../actions";
import type { Maquina } from "@/types/database";

interface PecaComRelacoes {
  id: string;
  codigo: string;
  descricao: string;
  tempo_padrao_por_unidade: number;
  pecas_maquinas: { maquina_id: string }[];
  peca_materiais: { material: string; quantidade_por_unidade: number; unidade_medida: string }[];
}

export function OPForm({ pecas, maquinas }: { pecas: PecaComRelacoes[]; maquinas: Maquina[] }) {
  const [pecaId, setPecaId] = useState("");
  const [quantidade, setQuantidade] = useState("");

  const peca = useMemo(() => pecas.find((p) => p.id === pecaId), [pecas, pecaId]);

  const maquinasCompativeis = useMemo(() => {
    if (!peca) return [];
    const ids = new Set(peca.pecas_maquinas.map((pm) => pm.maquina_id));
    return maquinas.filter((m) => ids.has(m.id));
  }, [peca, maquinas]);

  const qtd = Number(quantidade) || 0;
  const tempoEstimadoMin = peca ? peca.tempo_padrao_por_unidade * qtd : 0;
  const horas = Math.floor(tempoEstimadoMin / 60);
  const minutos = Math.round(tempoEstimadoMin % 60);

  return (
    <form action={createOP} className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label className="mb-1 block text-sm font-medium text-slate-700">Peça</label>
        <select
          name="peca_id"
          required
          value={pecaId}
          onChange={(e) => setPecaId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">Selecione...</option>
          {pecas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.codigo} — {p.descricao}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label className="mb-1 block text-sm font-medium text-slate-700">Quantidade planejada</label>
        <input
          name="quantidade_planejada"
          type="number"
          min="0.0001"
          step="0.0001"
          required
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label className="mb-1 block text-sm font-medium text-slate-700">Máquina</label>
        {!peca ? (
          <p className="text-sm text-slate-500">Selecione uma peça primeiro.</p>
        ) : maquinasCompativeis.length === 0 ? (
          <p className="text-sm text-red-600">
            Nenhuma máquina compatível cadastrada para esta peça.
          </p>
        ) : (
          <select
            name="maquina_id"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">Selecione...</option>
            {maquinasCompativeis.map((m) => (
              <option key={m.id} value={m.id}>
                {m.codigo} — {m.nome}
              </option>
            ))}
          </select>
        )}
      </div>

      {peca && qtd > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-semibold">Cálculo automático</p>
          <p className="mt-1">
            Tempo estimado: <strong>{horas}h{minutos.toString().padStart(2, "0")}min</strong>{" "}
            ({tempoEstimadoMin.toFixed(2)} min)
          </p>
          {peca.peca_materiais.length > 0 ? (
            <div className="mt-2">
              <p className="font-medium">Material necessário total:</p>
              <ul className="ml-4 list-disc">
                {peca.peca_materiais.map((m, i) => (
                  <li key={i}>
                    {m.material}: {(m.quantidade_por_unidade * qtd).toFixed(2)} {m.unidade_medida}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-2 text-blue-700">Nenhum material cadastrado para esta peça.</p>
          )}
        </div>
      )}

      <button
        type="submit"
        className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Gerar OP
      </button>
    </form>
  );
}

"use client";

import { useMemo, useState } from "react";
import { createOP } from "../actions";
import { formatSegundos } from "@/lib/tempo";
import { calcularConsumoOP, materialLabel, unidadeMaterial } from "@/lib/pcp/material";
import { formatQtd } from "@/lib/pcp/carteira";
import type { FormatoMaterial, Maquina } from "@/types/database";

export interface PecaComRelacoes {
  id: string;
  codigo: string;
  descricao: string;
  tempo_padrao_segundos: number | null;
  comprimento_consumido_mm: number | null;
  pecas_por_folha: number | null;
  pecas_maquinas: { maquina_id: string }[];
  peca_materiais: { material: string; quantidade_por_unidade: number; unidade_medida: string }[];
  materiais: { formato: FormatoMaterial; tipo: string; medida_a_mm: number; medida_b_mm: number | null; espessura_mm: number | null } | null;
}

export function OPForm({ pecas, maquinas }: { pecas: PecaComRelacoes[]; maquinas: Maquina[] }) {
  const [pecaId, setPecaId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [maquinaId, setMaquinaId] = useState("");

  const peca = useMemo(() => pecas.find((p) => p.id === pecaId), [pecas, pecaId]);
  const maquina = useMemo(() => maquinas.find((m) => m.id === maquinaId), [maquinas, maquinaId]);

  const maquinasCompativeis = useMemo(() => {
    if (!peca) return [];
    // Peça sem máquinas cadastradas: libera todas; a escolhida passa a ser compatível.
    if (peca.pecas_maquinas.length === 0) return maquinas;
    const ids = new Set(peca.pecas_maquinas.map((pm) => pm.maquina_id));
    return maquinas.filter((m) => ids.has(m.id));
  }, [peca, maquinas]);

  const qtd = Number(quantidade) || 0;
  const tempoEstimadoSegundos =
    peca && peca.tempo_padrao_segundos !== null ? peca.tempo_padrao_segundos * qtd : null;

  return (
    <form action={createOP} className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label className="mb-1 block text-sm font-medium text-slate-700">Peça</label>
        <select
          name="peca_id"
          required
          value={pecaId}
          onChange={(e) => setPecaId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
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
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label className="mb-1 block text-sm font-medium text-slate-700">Máquina</label>
        {!peca ? (
          <p className="text-sm text-slate-600">Selecione uma peça primeiro.</p>
        ) : maquinasCompativeis.length === 0 ? (
          <p className="text-sm text-red-600">Nenhuma máquina ativa cadastrada.</p>
        ) : (
          <>
          {peca.pecas_maquinas.length === 0 && (
            <p className="mb-2 text-xs text-amber-700">
              Peça sem máquinas cadastradas — a máquina escolhida será gravada no cadastro da peça.
            </p>
          )}
          <select
            name="maquina_id"
            required
            value={maquinaId}
            onChange={(e) => setMaquinaId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            <option value="">Selecione...</option>
            {maquinasCompativeis.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
          </>
        )}
      </div>

      {peca && qtd > 0 && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
          <p className="font-semibold">Cálculo automático</p>
          <p className="mt-1">
            Tempo estimado:{" "}
            {tempoEstimadoSegundos !== null ? (
              <>
                <strong>{formatSegundos(tempoEstimadoSegundos)}</strong> (h:min:s)
              </>
            ) : (
              <span className="text-amber-700">peça sem tempo padrão (cadastro pendente)</span>
            )}
          </p>
          {peca.materiais &&
            (() => {
              const consumo = calcularConsumoOP({
                formato: peca.materiais.formato,
                quantidadePlanejada: qtd,
                comprimentoConsumidoMm: peca.comprimento_consumido_mm,
                pecasPorFolha: peca.pecas_por_folha,
                barraComprimentoMm: maquina?.barra_comprimento_mm ?? null,
                barraSobraMm: maquina?.barra_sobra_mm ?? 0,
              });
              const necessidade = consumo.metrosNecessarios ?? consumo.folhasNecessarias;
              return (
                <p className="mt-2">
                  Material ({materialLabel(peca.materiais)}):{" "}
                  {!maquina ? (
                    <span className="text-amber-700">selecione a máquina para calcular</span>
                  ) : consumo.erro ? (
                    <span className="text-amber-700">{consumo.erro}</span>
                  ) : (
                    <strong>
                      {formatQtd(necessidade ?? 0)} {unidadeMaterial(peca.materiais.formato)}
                      {consumo.barrasNecessarias !== null && ` (${consumo.barrasNecessarias} barras)`}
                    </strong>
                  )}
                </p>
              );
            })()}
          {peca.peca_materiais.length > 0 && (
            <div className="mt-2">
              <p className="font-medium">Outros materiais necessários:</p>
              <ul className="ml-4 list-disc">
                {peca.peca_materiais.map((m, i) => (
                  <li key={i}>
                    {m.material}: {(m.quantidade_por_unidade * qtd).toFixed(2)} {m.unidade_medida}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!peca.materiais && peca.peca_materiais.length === 0 && (
            <p className="mt-2 text-brand-700">Nenhum material cadastrado para esta peça.</p>
          )}
        </div>
      )}

      <button
        type="submit"
        className="rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Gerar OP
      </button>
    </form>
  );
}

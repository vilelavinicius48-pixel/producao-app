"use client";

import { useMemo, useState } from "react";
import { adicionarRoteiroEtapa, copiarRoteiro, moverRoteiroEtapa, removerRoteiroEtapa } from "../pos-maquina-actions";
import { TIPO_ETAPA_CLASS, TIPO_ETAPA_LABEL } from "@/lib/roteiro";
import type { TipoEtapa } from "@/types/database";

type ItemRoteiro = {
  id: string;
  ordem: number;
  etapa: { nome: string; tipo: TipoEtapa } | null;
  maquina: { nome: string } | null;
  tratamento: { nome: string } | null;
};

export function RoteiroPecaForm({
  pecaId,
  roteiro,
  etapas,
  maquinas,
  tratamentos,
  outrasPecas,
}: {
  pecaId: string;
  roteiro: ItemRoteiro[];
  etapas: { id: string; nome: string; tipo: TipoEtapa }[];
  maquinas: { id: string; nome: string }[];
  tratamentos: { id: string; nome: string }[];
  outrasPecas: { id: string; codigo: string; descricao: string }[];
}) {
  const [etapaId, setEtapaId] = useState("");
  const etapaSelecionada = useMemo(() => etapas.find((e) => e.id === etapaId) ?? null, [etapas, etapaId]);

  return (
    <div className="space-y-4">
      {roteiro.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma etapa no roteiro ainda.</p>
      ) : (
        <ol className="space-y-1.5">
          {roteiro.map((item, i) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                <span className="font-medium text-slate-900">{item.etapa?.nome}</span>
                {item.etapa && (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TIPO_ETAPA_CLASS[item.etapa.tipo]}`}>
                    {TIPO_ETAPA_LABEL[item.etapa.tipo]}
                  </span>
                )}
                {item.maquina && <span className="text-xs text-slate-600">máquina: {item.maquina.nome}</span>}
                {item.tratamento && <span className="text-xs text-slate-600">tratamento: {item.tratamento.nome}</span>}
              </div>
              <div className="flex items-center gap-1">
                <form action={moverRoteiroEtapa}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="peca_id" value={pecaId} />
                  <input type="hidden" name="direcao" value="subir" />
                  <button
                    type="submit"
                    disabled={i === 0}
                    aria-label="Subir"
                    className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-30"
                  >
                    ↑
                  </button>
                </form>
                <form action={moverRoteiroEtapa}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="peca_id" value={pecaId} />
                  <input type="hidden" name="direcao" value="descer" />
                  <button
                    type="submit"
                    disabled={i === roteiro.length - 1}
                    aria-label="Descer"
                    className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-30"
                  >
                    ↓
                  </button>
                </form>
                <form action={removerRoteiroEtapa}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="peca_id" value={pecaId} />
                  <button type="submit" className="rounded px-2 py-0.5 text-xs font-medium text-red-600 hover:underline">
                    remover
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ol>
      )}

      <form
        action={async (formData) => {
          await adicionarRoteiroEtapa(formData);
          setEtapaId("");
        }}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-slate-300 p-3"
      >
        <input type="hidden" name="peca_id" value={pecaId} />
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Adicionar etapa</span>
          <select
            name="etapa_id"
            required
            value={etapaId}
            onChange={(e) => setEtapaId(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Selecione...</option>
            {etapas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome} ({TIPO_ETAPA_LABEL[e.tipo]})
              </option>
            ))}
          </select>
        </label>
        {etapaSelecionada?.tipo === "maquina" && (
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Máquina</span>
            <select name="maquina_id" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">Selecione...</option>
              {maquinas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </label>
        )}
        {etapaSelecionada?.tipo === "externo" && (
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Tratamento</span>
            <select name="tratamento_id" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">Selecione...</option>
              {tratamentos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          Adicionar
        </button>
      </form>

      {outrasPecas.length > 0 && (
        <form action={copiarRoteiro} className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
          <input type="hidden" name="peca_id" value={pecaId} />
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Copiar roteiro de</span>
            <select name="origem_peca_id" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">Selecione a peça...</option>
              {outrasPecas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.codigo} — {p.descricao}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Copiar (substitui o roteiro atual)
          </button>
        </form>
      )}
    </div>
  );
}

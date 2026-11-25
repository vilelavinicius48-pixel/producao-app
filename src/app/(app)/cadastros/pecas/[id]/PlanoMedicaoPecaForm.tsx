"use client";

import { useState } from "react";
import {
  adicionarCotaMedicao,
  copiarPlanoMedicao,
  enviarDesenhoPeca,
  moverCotaMedicao,
  removerCotaMedicao,
  removerDesenhoPeca,
} from "../pos-maquina-actions";

const TIPOS_SUGERIDOS = ["Comprimento", "Diâmetro", "Raio", "Ângulo", "Rosca", "Planicidade", "Teste funcional", "Outro"];

type Cota = {
  id: string;
  ordem: number;
  tipo: string;
  eh_atributo: boolean;
  nominal: number | null;
  minimo: number | null;
  maximo: number | null;
  instrumento: string | null;
  frequencia: string | null;
};

export function PlanoMedicaoPecaForm({
  pecaId,
  cotas,
  outrasPecas,
  desenhoUrl,
}: {
  pecaId: string;
  cotas: Cota[];
  outrasPecas: { id: string; codigo: string; descricao: string }[];
  desenhoUrl: string | null;
}) {
  const [ehAtributo, setEhAtributo] = useState(false);

  return (
    <div className="space-y-4">
      {cotas.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma cota cadastrada ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-slate-600">
              <tr>
                <th className="py-1 pr-2">#</th>
                <th className="py-1 pr-2">Tipo</th>
                <th className="py-1 pr-2 text-right">Nominal</th>
                <th className="py-1 pr-2 text-right">Mín.</th>
                <th className="py-1 pr-2 text-right">Máx.</th>
                <th className="py-1 pr-2">Instrumento</th>
                <th className="py-1 pr-2">Frequência</th>
                <th className="py-1 pr-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cotas.map((c, i) => (
                <tr key={c.id}>
                  <td className="py-1.5 pr-2 text-slate-500">{i + 1}</td>
                  <td className="py-1.5 pr-2 font-medium text-slate-900">{c.tipo}</td>
                  {c.eh_atributo ? (
                    <td className="py-1.5 pr-2 text-slate-600" colSpan={3}>
                      OK / NOK
                    </td>
                  ) : (
                    <>
                      <td className="py-1.5 pr-2 text-right">{c.nominal ?? "-"}</td>
                      <td className="py-1.5 pr-2 text-right">{c.minimo ?? "-"}</td>
                      <td className="py-1.5 pr-2 text-right">{c.maximo ?? "-"}</td>
                    </>
                  )}
                  <td className="py-1.5 pr-2 text-slate-600">{c.instrumento ?? "-"}</td>
                  <td className="py-1.5 pr-2 text-slate-600">{c.frequencia ?? "-"}</td>
                  <td className="py-1.5 pr-2">
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      <form action={moverCotaMedicao}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="peca_id" value={pecaId} />
                        <input type="hidden" name="direcao" value="subir" />
                        <button type="submit" disabled={i === 0} className="rounded border border-slate-300 px-1.5 py-0.5 text-xs disabled:opacity-30">
                          ↑
                        </button>
                      </form>
                      <form action={moverCotaMedicao}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="peca_id" value={pecaId} />
                        <input type="hidden" name="direcao" value="descer" />
                        <button
                          type="submit"
                          disabled={i === cotas.length - 1}
                          className="rounded border border-slate-300 px-1.5 py-0.5 text-xs disabled:opacity-30"
                        >
                          ↓
                        </button>
                      </form>
                      <form action={removerCotaMedicao}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="peca_id" value={pecaId} />
                        <button type="submit" className="px-1.5 text-xs font-medium text-red-600 hover:underline">
                          remover
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form
        action={async (formData) => {
          await adicionarCotaMedicao(formData);
          setEhAtributo(false);
        }}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-slate-300 p-3"
      >
        <input type="hidden" name="peca_id" value={pecaId} />
        <input type="hidden" name="eh_atributo" value={ehAtributo ? "true" : "false"} />
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Tipo da cota</span>
          <input
            name="tipo"
            required
            list="tipos-cota-sugeridos"
            placeholder="Ex: Diâmetro Ø8"
            className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <datalist id="tipos-cota-sugeridos">
            {TIPOS_SUGERIDOS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
        <label className="flex items-center gap-1.5 pb-2 text-sm">
          <input type="checkbox" checked={ehAtributo} onChange={(e) => setEhAtributo(e.target.checked)} className="h-4 w-4" />
          Atributo (OK/NOK)
        </label>
        {!ehAtributo && (
          <>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Nominal</span>
              <input name="nominal" inputMode="decimal" className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Mínimo</span>
              <input name="minimo" inputMode="decimal" className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Máximo</span>
              <input name="maximo" inputMode="decimal" className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
          </>
        )}
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Instrumento (opcional)</span>
          <input name="instrumento" placeholder="Paquímetro..." className="w-36 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Frequência (opcional)</span>
          <input name="frequencia" placeholder="1 a cada 10 pç" className="w-36 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          Adicionar
        </button>
      </form>

      {outrasPecas.length > 0 && (
        <form action={copiarPlanoMedicao} className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
          <input type="hidden" name="peca_id" value={pecaId} />
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Copiar plano de medição de</span>
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
            Copiar (substitui o plano atual)
          </button>
        </form>
      )}

      <div className="border-t border-slate-100 pt-3">
        <p className="mb-2 text-sm font-medium text-slate-700">Desenho técnico</p>
        {desenhoUrl ? (
          <div className="flex flex-wrap items-center gap-3">
            <a href={desenhoUrl} target="_blank" rel="noreferrer" className="text-sm text-brand-600 hover:underline">
              Ver desenho atual →
            </a>
            <form action={removerDesenhoPeca}>
              <input type="hidden" name="peca_id" value={pecaId} />
              <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                remover
              </button>
            </form>
          </div>
        ) : (
          <p className="mb-2 text-xs text-amber-700">Nenhum desenho anexado.</p>
        )}
        <form action={enviarDesenhoPeca} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="peca_id" value={pecaId} />
          <input
            type="file"
            name="arquivo"
            accept="image/png,image/jpeg,application/pdf"
            required
            className="text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-slate-700"
          />
          <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
            {desenhoUrl ? "Substituir" : "Enviar"}
          </button>
        </form>
      </div>
    </div>
  );
}

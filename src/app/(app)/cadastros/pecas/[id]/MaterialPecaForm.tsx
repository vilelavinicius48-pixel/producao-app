"use client";

import { useMemo, useState } from "react";
import { calcularConsumoOP, ehFormatoBarra } from "@/lib/pcp/material";
import { MaterialCombobox, type MaterialOpcao } from "@/components/MaterialCombobox";

type MaquinaCompat = { id: string; nome: string; barra_comprimento_mm: number | null; barra_sobra_mm: number };

export function MaterialPecaForm({
  materiais,
  maquinasCompativeis,
  materialIdAtual,
  comprimentoAtual,
  pecasPorFolhaAtual,
}: {
  materiais: MaterialOpcao[];
  maquinasCompativeis: MaquinaCompat[];
  materialIdAtual: string | null;
  comprimentoAtual: number | null;
  pecasPorFolhaAtual: number | null;
}) {
  const [materialId, setMaterialId] = useState(materialIdAtual ?? "");
  const [comprimento, setComprimento] = useState(comprimentoAtual ? String(comprimentoAtual) : "");
  const [pecasPorFolha, setPecasPorFolha] = useState(pecasPorFolhaAtual ? String(pecasPorFolhaAtual) : "");

  const material = useMemo(() => materiais.find((m) => m.id === materialId) ?? null, [materiais, materialId]);
  const ehBarra = material ? ehFormatoBarra(material.formato) : true;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Material</span>
          <MaterialCombobox
            name="material_id"
            materiais={materiais}
            defaultValue={materialId}
            onChange={setMaterialId}
            placeholder="Sem material — buscar…"
          />
        </label>
        {material && ehBarra && (
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Comprimento consumido por peça (mm, já com corte/sangria)</span>
            <input
              name="comprimento_consumido_mm"
              inputMode="decimal"
              value={comprimento}
              onChange={(e) => setComprimento(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        )}
        {material && !ehBarra && (
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Quantas peças saem de 1 folha</span>
            <input
              name="pecas_por_folha"
              inputMode="numeric"
              value={pecasPorFolha}
              onChange={(e) => setPecasPorFolha(e.target.value)}
              placeholder="Conforme seu desenho de corte"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        )}
      </div>

      {material && ehBarra && maquinasCompativeis.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <p className="mb-1 font-medium text-slate-700">Peças por barra em cada máquina compatível:</p>
          <ul className="space-y-0.5">
            {maquinasCompativeis.map((m) => {
              const consumo = calcularConsumoOP({
                formato: material.formato,
                quantidadePlanejada: 1,
                comprimentoConsumidoMm: comprimento ? Number(comprimento.replace(",", ".")) : null,
                pecasPorFolha: null,
                barraComprimentoMm: m.barra_comprimento_mm,
                barraSobraMm: m.barra_sobra_mm,
              });
              return (
                <li key={m.id}>
                  {m.nome}:{" "}
                  {consumo.erro ? <span className="text-amber-700">{consumo.erro}</span> : <span>{consumo.pecasPorUnidade} peças/barra</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

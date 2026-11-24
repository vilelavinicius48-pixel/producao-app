"use client";

import { useState } from "react";
import { atualizarMaterial } from "./actions";
import { FORMATO_LABEL, materialLabel } from "@/lib/pcp/material";
import type { Material } from "@/types/database";

export function MaterialEditForm({ material: m }: { material: Material }) {
  const [editando, setEditando] = useState(false);

  if (!editando) {
    return (
      <button type="button" onClick={() => setEditando(true)} className="text-left hover:underline" title="Clique para corrigir">
        <span className="font-medium text-slate-900">{materialLabel(m)}</span>
        <span className="block text-xs text-slate-500">{FORMATO_LABEL[m.formato]}</span>
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        await atualizarMaterial(formData);
        setEditando(false);
      }}
      className="flex flex-wrap items-center gap-1.5"
    >
      <input type="hidden" name="id" value={m.id} />
      <span className="text-xs text-slate-500">{FORMATO_LABEL[m.formato]}</span>
      <input name="tipo" defaultValue={m.tipo} className="w-36 rounded border border-slate-300 px-2 py-1 text-xs" />
      <input
        name="medida_a_mm"
        defaultValue={m.medida_a_mm}
        inputMode="decimal"
        title="Medida principal (mm)"
        className="w-16 rounded border border-slate-300 px-2 py-1 text-xs"
      />
      {m.medida_b_mm !== null && (
        <input
          name="medida_b_mm"
          defaultValue={m.medida_b_mm}
          inputMode="decimal"
          title="Segunda medida (mm)"
          className="w-16 rounded border border-slate-300 px-2 py-1 text-xs"
        />
      )}
      {m.formato === "chapa" && (
        <input
          name="espessura_mm"
          defaultValue={m.espessura_mm ?? ""}
          inputMode="decimal"
          title="Espessura (mm)"
          className="w-16 rounded border border-slate-300 px-2 py-1 text-xs"
        />
      )}
      <button type="submit" className="rounded bg-slate-800 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-700">
        Salvar
      </button>
      <button type="button" onClick={() => setEditando(false)} className="text-xs text-slate-500 hover:underline">
        cancelar
      </button>
    </form>
  );
}

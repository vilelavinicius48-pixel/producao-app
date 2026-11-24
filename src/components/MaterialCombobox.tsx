"use client";

import { useMemo, useRef, useState } from "react";
import { materialLabel, normalizarBusca } from "@/lib/pcp/material";
import type { FormatoMaterial } from "@/types/database";

export type MaterialOpcao = {
  id: string;
  formato: FormatoMaterial;
  tipo: string;
  medida_a_mm: number;
  medida_b_mm: number | null;
  espessura_mm: number | null;
};

/** Select de material com busca: digite parte do nome/bitola pra filtrar em vez de rolar a lista. */
export function MaterialCombobox({
  name,
  materiais,
  defaultValue,
  onChange,
  placeholder = "Buscar material…",
  required,
}: {
  name: string;
  materiais: MaterialOpcao[];
  defaultValue?: string;
  onChange?: (materialId: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const opcoes = useMemo(() => materiais.map((m) => ({ ...m, label: materialLabel(m) })), [materiais]);
  const [valor, setValor] = useState(defaultValue ?? "");
  const selecionado = useMemo(() => opcoes.find((o) => o.id === valor) ?? null, [opcoes, valor]);
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filtradas = useMemo(() => {
    const q = normalizarBusca(busca.trim());
    if (!q) return opcoes;
    return opcoes.filter((o) => normalizarBusca(o.label).includes(q));
  }, [opcoes, busca]);

  function selecionar(id: string) {
    setValor(id);
    setAberto(false);
    setBusca("");
    onChange?.(id);
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onBlur={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node)) setAberto(false);
      }}
    >
      <input type="hidden" name={name} value={valor} required={required} />
      <input
        type="text"
        value={aberto ? busca : (selecionado?.label ?? "")}
        onChange={(e) => {
          setBusca(e.target.value);
          if (!aberto) setAberto(true);
        }}
        onFocus={() => {
          setAberto(true);
          setBusca("");
        }}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-7 text-sm focus:border-brand-500 focus:outline-none"
      />
      {!aberto && valor && (
        <button
          type="button"
          onClick={() => selecionar("")}
          title="Limpar"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
        >
          ✕
        </button>
      )}
      {aberto && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white text-sm shadow-lg">
          {filtradas.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => selecionar(o.id)}
                className={`block w-full px-3 py-2 text-left hover:bg-slate-50 ${o.id === valor ? "bg-brand-50 font-medium" : ""}`}
              >
                {o.label}
              </button>
            </li>
          ))}
          {filtradas.length === 0 && <li className="px-3 py-2 text-slate-500">Nenhum material encontrado</li>}
        </ul>
      )}
    </div>
  );
}

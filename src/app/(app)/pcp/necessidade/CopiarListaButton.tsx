"use client";

import { useState } from "react";
import { montarListaCompra } from "@/lib/pcp/material";

export function CopiarListaButton({ itens }: { itens: { label: string; faltam: number; unidade: string }[] }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        const texto = montarListaCompra(itens);
        try {
          await navigator.clipboard.writeText(texto);
        } catch {
          window.prompt("Copie o texto abaixo:", texto);
        }
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      }}
      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
    >
      {copiado ? "Copiado!" : "Copiar lista de compra"}
    </button>
  );
}

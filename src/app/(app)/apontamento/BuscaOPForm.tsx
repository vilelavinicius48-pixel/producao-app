"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function BuscaOPForm() {
  const [numero, setNumero] = useState("");
  const router = useRouter();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (numero.trim()) router.push(`/apontamento/${numero.trim()}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <input
        type="number"
        inputMode="numeric"
        placeholder="Número da OP"
        value={numero}
        onChange={(e) => setNumero(e.target.value)}
        autoFocus
        className="rounded-xl border border-slate-300 px-6 py-5 text-2xl focus:border-brand-500 focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-xl bg-brand-600 px-6 py-5 text-xl font-bold text-white hover:bg-brand-700"
      >
        Buscar OP
      </button>
    </form>
  );
}

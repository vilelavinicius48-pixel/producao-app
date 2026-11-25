"use client";

export function ImprimirButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
    >
      Imprimir
    </button>
  );
}

"use client";

import { useState } from "react";

interface Props {
  name: string;
  label: string;
  defaultSegundos?: number;
  required?: boolean;
}

export function TimeInput({ name, label, defaultSegundos = 0, required }: Props) {
  const [h, setH] = useState(Math.floor(defaultSegundos / 3600));
  const [m, setM] = useState(Math.floor((defaultSegundos % 3600) / 60));
  const [s, setS] = useState(defaultSegundos % 60);

  const total = h * 3600 + m * 60 + s;

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <input type="hidden" name={name} value={total} />
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-center">
          <input
            type="number"
            min={0}
            max={99}
            value={h}
            onChange={(e) => setH(Math.max(0, Number(e.target.value) || 0))}
            required={required}
            className="w-16 rounded-lg border border-slate-300 px-2 py-2 text-center text-lg focus:border-brand-500 focus:outline-none"
          />
          <span className="mt-1 text-xs text-slate-600">horas</span>
        </div>
        <span className="pb-5 text-lg text-slate-500">:</span>
        <div className="flex flex-col items-center">
          <input
            type="number"
            min={0}
            max={59}
            value={m}
            onChange={(e) => setM(Math.min(59, Math.max(0, Number(e.target.value) || 0)))}
            className="w-16 rounded-lg border border-slate-300 px-2 py-2 text-center text-lg focus:border-brand-500 focus:outline-none"
          />
          <span className="mt-1 text-xs text-slate-600">min</span>
        </div>
        <span className="pb-5 text-lg text-slate-500">:</span>
        <div className="flex flex-col items-center">
          <input
            type="number"
            min={0}
            max={59}
            value={s}
            onChange={(e) => setS(Math.min(59, Math.max(0, Number(e.target.value) || 0)))}
            className="w-16 rounded-lg border border-slate-300 px-2 py-2 text-center text-lg focus:border-brand-500 focus:outline-none"
          />
          <span className="mt-1 text-xs text-slate-600">seg</span>
        </div>
      </div>
      {total === 0 && <p className="mt-1 text-xs text-red-600">Informe um tempo maior que zero</p>}
    </div>
  );
}

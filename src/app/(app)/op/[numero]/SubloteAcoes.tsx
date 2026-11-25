"use client";

import { useState } from "react";
import Link from "next/link";
import {
  iniciarEtapaSubloteAction,
  concluirEtapaSubloteAction,
  gerarOpSegundaOperacaoAction,
} from "./actions";
import type { MotivoRefugo, Operador } from "@/types/database";

type EtapaAtiva = {
  subloteEtapaId: string;
  status: "aguardando" | "em_andamento";
  etapaNome: string;
  etapaTipo: string;
  maquinaNome: string | null;
} | null;

interface Props {
  numero: string;
  quantidade: number;
  etapaAtiva: EtapaAtiva;
  operadores: Operador[];
  motivos: MotivoRefugo[];
}

function SeletorOperador({ operadores }: { operadores: Operador[] }) {
  return (
    <select
      name="operador_id"
      required
      className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base focus:border-brand-500 focus:outline-none"
    >
      <option value="">Quem está fazendo...</option>
      {operadores.map((o) => (
        <option key={o.id} value={o.id}>
          {o.matricula} — {o.nome}
        </option>
      ))}
    </select>
  );
}

export function SubloteAcoes({ numero, quantidade, etapaAtiva, operadores, motivos }: Props) {
  const [aberto, setAberto] = useState(false);
  const [refugo, setRefugo] = useState("0");

  if (!etapaAtiva) return null;

  if (etapaAtiva.etapaTipo === "inspecao") {
    return (
      <div className="mt-3">
        <Link
          href={`/qualidade/sublote/${etapaAtiva.subloteEtapaId}`}
          className="block w-full rounded-lg bg-brand-600 px-4 py-3 text-center text-base font-semibold text-white hover:bg-brand-700"
        >
          Fazer inspeção de qualidade →
        </Link>
      </div>
    );
  }

  if (etapaAtiva.etapaTipo === "maquina") {
    if (!aberto) {
      return (
        <button
          onClick={() => setAberto(true)}
          className="mt-3 w-full rounded-lg bg-sky-600 px-4 py-3 text-base font-semibold text-white hover:bg-sky-700"
        >
          Gerar OP de 2ª operação{etapaAtiva.maquinaNome ? ` (${etapaAtiva.maquinaNome})` : ""}
        </button>
      );
    }
    return (
      <form action={gerarOpSegundaOperacaoAction} className="mt-3 space-y-2">
        <input type="hidden" name="sublote_etapa_id" value={etapaAtiva.subloteEtapaId} />
        <input type="hidden" name="numero" value={numero} />
        <SeletorOperador operadores={operadores} />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAberto(false)}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-3 text-sm font-semibold text-slate-700"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-1 rounded-lg bg-sky-600 px-3 py-3 text-sm font-bold text-white hover:bg-sky-700"
          >
            Confirmar
          </button>
        </div>
      </form>
    );
  }

  // manual ou externo
  if (etapaAtiva.status === "aguardando") {
    if (!aberto) {
      return (
        <button
          onClick={() => setAberto(true)}
          className="mt-3 w-full rounded-lg bg-green-600 px-4 py-3 text-base font-semibold text-white hover:bg-green-700"
        >
          Iniciar etapa: {etapaAtiva.etapaNome}
        </button>
      );
    }
    return (
      <form action={iniciarEtapaSubloteAction} className="mt-3 space-y-2">
        <input type="hidden" name="sublote_etapa_id" value={etapaAtiva.subloteEtapaId} />
        <input type="hidden" name="numero" value={numero} />
        <SeletorOperador operadores={operadores} />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAberto(false)}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-3 text-sm font-semibold text-slate-700"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-1 rounded-lg bg-green-600 px-3 py-3 text-sm font-bold text-white hover:bg-green-700"
          >
            Confirmar
          </button>
        </div>
      </form>
    );
  }

  // em_andamento: concluir
  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="mt-3 w-full rounded-lg bg-brand-600 px-4 py-3 text-base font-semibold text-white hover:bg-brand-700"
      >
        Concluir etapa: {etapaAtiva.etapaNome}
      </button>
    );
  }

  return (
    <form action={concluirEtapaSubloteAction} className="mt-3 space-y-2">
      <input type="hidden" name="sublote_etapa_id" value={etapaAtiva.subloteEtapaId} />
      <input type="hidden" name="numero" value={numero} />
      <SeletorOperador operadores={operadores} />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Qtd boa</label>
          <input
            name="quantidade_boa"
            type="number"
            min="0"
            step="1"
            required
            defaultValue={quantidade}
            className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Qtd refugo</label>
          <input
            name="quantidade_refugo"
            type="number"
            min="0"
            step="1"
            required
            value={refugo}
            onChange={(e) => setRefugo(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>
      {Number(refugo) > 0 && (
        <select
          name="motivo_refugo_id"
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base focus:border-brand-500 focus:outline-none"
        >
          <option value="">Motivo do refugo...</option>
          {motivos.map((m) => (
            <option key={m.id} value={m.id}>
              {m.descricao}
            </option>
          ))}
        </select>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-3 text-sm font-semibold text-slate-700"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="flex-1 rounded-lg bg-brand-600 px-3 py-3 text-sm font-bold text-white hover:bg-brand-700"
        >
          Confirmar
        </button>
      </div>
    </form>
  );
}

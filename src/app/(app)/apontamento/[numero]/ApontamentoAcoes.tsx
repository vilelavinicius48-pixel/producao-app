"use client";

import { useState } from "react";
import {
  iniciarApontamentoAction,
  pararProducaoAction,
  pausarProducaoAction,
  voltarParadaAction,
} from "../actions";
import { Cronometro } from "@/components/Cronometro";
import type { MotivoParada, Operador, StatusOP } from "@/types/database";

interface Props {
  opId: string;
  numero: string;
  status: StatusOP;
  operadores: Operador[];
  apontamentoAberto: { id: string; timestamp_start: string; operadorNome: string } | null;
  paradaAberta: { timestamp_inicio: string } | null;
  motivos: MotivoParada[];
}

type View = "buttons" | "finalizar" | "parada" | "voltar";

function SeletorOperador({ operadores }: { operadores: Operador[] }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">Operador</label>
      {operadores.length === 0 ? (
        <p className="text-sm text-red-600">Nenhum operador cadastrado. Peça a um gestor para cadastrar.</p>
      ) : (
        <select
          name="operador_id"
          required
          className="w-full rounded-xl border border-slate-300 px-4 py-4 text-lg focus:border-brand-500 focus:outline-none"
        >
          <option value="">Selecione quem está operando...</option>
          {operadores.map((o) => (
            <option key={o.id} value={o.id}>
              {o.matricula} — {o.nome}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

export function ApontamentoAcoes({
  opId,
  numero,
  status,
  operadores,
  apontamentoAberto,
  paradaAberta,
  motivos,
}: Props) {
  const [view, setView] = useState<View>("buttons");

  if (status === "aberta") {
    return (
      <form action={iniciarApontamentoAction} className="space-y-4">
        <input type="hidden" name="op_id" value={opId} />
        <input type="hidden" name="numero" value={numero} />
        <SeletorOperador operadores={operadores} />
        <button
          type="submit"
          className="w-full rounded-2xl bg-green-600 px-6 py-8 text-2xl font-bold text-white hover:bg-green-700"
        >
          INICIAR PRODUÇÃO
        </button>
      </form>
    );
  }

  if (status === "em_producao" && apontamentoAberto) {
    if (view === "finalizar" || view === "parada") {
      const action = view === "finalizar" ? pararProducaoAction : pausarProducaoAction;
      const titulo = view === "finalizar" ? "Finalizar produção" : "Registrar parada";
      const corBotao = view === "finalizar" ? "bg-brand-600 hover:bg-brand-700" : "bg-red-600 hover:bg-red-700";
      return (
        <form action={action} className="space-y-4">
          <input type="hidden" name="apontamento_id" value={apontamentoAberto.id} />
          <input type="hidden" name="numero" value={numero} />
          <h2 className="text-xl font-bold text-slate-900">{titulo}</h2>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Quantidade produzida</label>
            <input
              name="quantidade_produzida"
              type="number"
              min="0"
              step="0.0001"
              required
              autoFocus
              className="w-full rounded-xl border border-slate-300 px-4 py-4 text-xl focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Quantidade refugada</label>
            <input
              name="quantidade_refugada"
              type="number"
              min="0"
              step="0.0001"
              required
              defaultValue={0}
              className="w-full rounded-xl border border-slate-300 px-4 py-4 text-xl focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setView("buttons")}
              className="flex-1 rounded-xl border border-slate-300 px-4 py-4 text-lg font-semibold text-slate-700"
            >
              Cancelar
            </button>
            <button type="submit" className={`flex-1 rounded-xl px-4 py-4 text-lg font-bold text-white ${corBotao}`}>
              Confirmar
            </button>
          </div>
        </form>
      );
    }

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
          <p className="text-sm text-green-800">Em produção por {apontamentoAberto.operadorNome}</p>
          <Cronometro desde={apontamentoAberto.timestamp_start} className="text-3xl font-bold text-green-900" />
        </div>
        <button
          onClick={() => setView("parada")}
          className="w-full rounded-2xl bg-red-600 px-6 py-6 text-xl font-bold text-white hover:bg-red-700"
        >
          PARADA
        </button>
        <button
          onClick={() => setView("finalizar")}
          className="w-full rounded-2xl bg-brand-600 px-6 py-6 text-xl font-bold text-white hover:bg-brand-700"
        >
          FINALIZAR (STOP)
        </button>
      </div>
    );
  }

  if (status === "parada") {
    if (view === "voltar") {
      return (
        <form action={voltarParadaAction} className="space-y-4">
          <input type="hidden" name="op_id" value={opId} />
          <input type="hidden" name="numero" value={numero} />
          <h2 className="text-xl font-bold text-slate-900">Voltar de parada</h2>
          <SeletorOperador operadores={operadores} />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Motivo da parada</label>
            <select
              name="motivo_id"
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-4 text-lg focus:border-brand-500 focus:outline-none"
            >
              <option value="">Selecione...</option>
              {motivos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.descricao}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setView("buttons")}
              className="flex-1 rounded-xl border border-slate-300 px-4 py-4 text-lg font-semibold text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl bg-green-600 px-4 py-4 text-lg font-bold text-white hover:bg-green-700"
            >
              Confirmar retorno
            </button>
          </div>
        </form>
      );
    }

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-sm text-red-800">PARADA HÁ</p>
          {paradaAberta && (
            <Cronometro desde={paradaAberta.timestamp_inicio} className="text-3xl font-bold text-red-900" />
          )}
        </div>
        <button
          onClick={() => setView("voltar")}
          className="w-full rounded-2xl bg-green-600 px-6 py-8 text-2xl font-bold text-white hover:bg-green-700"
        >
          VOLTAR DE PARADA
        </button>
      </div>
    );
  }

  return <p className="text-center text-slate-500">OP concluída.</p>;
}

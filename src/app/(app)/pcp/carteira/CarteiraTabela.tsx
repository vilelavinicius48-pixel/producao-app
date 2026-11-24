"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { diasEntre, formatData, formatQtd, SITUACAO_CLASS, SITUACAO_LABEL, type Situacao } from "@/lib/pcp/carteira";
import { normalizarBusca } from "@/lib/pcp/material";
import { STATUS_BADGE_CLASS, STATUS_LABEL } from "@/lib/op-status";
import type { StatusOP } from "@/types/database";

export type LinhaCarteira = {
  id: string;
  dataEntrega: string;
  cliente: string;
  empresaLabel: string | null;
  numeroPedido: string;
  pedidoCompra: string | null;
  pecaId: string | null;
  codigoProduto: string;
  descricao: string;
  semTempo: boolean;
  quantidade: number;
  cobertoEstoque: number;
  qtdEmOP: number;
  falta: number;
  situacao: Situacao;
  ops: { numero: number; status: StatusOP; maquina: string }[];
};

const FILTROS: { valor: string; label: string }[] = [
  { valor: "", label: "Todos" },
  { valor: "a_programar", label: "A programar" },
  { valor: "atrasados", label: "Atrasados" },
  { valor: "aguardando", label: "Aguardando preparo" },
  { valor: "andamento", label: "Liberados / em produção" },
];

export function CarteiraTabela({ linhas, clientes, hoje }: { linhas: LinhaCarteira[]; clientes: string[]; hoje: string }) {
  const [cliente, setCliente] = useState("");
  const [filtro, setFiltro] = useState("");
  const [busca, setBusca] = useState("");

  const visiveis = useMemo(() => {
    const q = normalizarBusca(busca.trim());
    return linhas.filter((it) => {
      if (cliente && it.cliente !== cliente) return false;
      if (q && !normalizarBusca(`${it.codigoProduto} ${it.descricao} ${it.numeroPedido} ${it.cliente}`).includes(q)) return false;
      if (filtro === "a_programar") return it.situacao === "a_programar" || it.situacao === "parcial";
      if (filtro === "atrasados") return it.dataEntrega < hoje;
      if (filtro === "aguardando") return it.situacao === "aguardando";
      if (filtro === "andamento") return it.situacao === "liberada" || it.situacao === "producao";
      return true;
    });
  }, [linhas, cliente, filtro, busca, hoje]);

  return (
    <>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <select
          value={cliente}
          onChange={(e) => setCliente(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          aria-label="Cliente"
        >
          <option value="">Todos os clientes</option>
          {clientes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          aria-label="Situação"
        >
          {FILTROS.map((f) => (
            <option key={f.valor} value={f.valor}>
              {f.label}
            </option>
          ))}
        </select>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Código, descrição ou nº pedido"
          className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">Entrega</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Pedido</th>
              <th className="px-3 py-2">Produto</th>
              <th className="px-3 py-2 text-right">Qtd</th>
              <th className="px-3 py-2 text-right">Estoque</th>
              <th className="px-3 py-2 text-right">Em OP</th>
              <th className="px-3 py-2 text-right">Falta</th>
              <th className="px-3 py-2">Situação</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visiveis.map((it) => {
              const atraso = diasEntre(it.dataEntrega, hoje);
              return (
                <tr key={it.id} className={atraso > 0 ? "bg-red-50/40" : undefined}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={atraso > 0 ? "font-semibold text-red-700" : "text-slate-900"}>
                      {formatData(it.dataEntrega)}
                    </span>
                    {atraso > 0 && <span className="block text-xs text-red-600">{atraso} dias atrasado</span>}
                    {atraso <= 0 && atraso > -7 && (
                      <span className="block text-xs text-amber-700">
                        {atraso === 0 ? "vence hoje" : `em ${-atraso} dias`}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {it.cliente}
                    {it.empresaLabel && <span className="block text-[11px] text-slate-500">{it.empresaLabel}</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {it.numeroPedido}
                    {it.pedidoCompra && <span className="block text-xs text-slate-500">PC {it.pedidoCompra}</span>}
                  </td>
                  <td className="px-3 py-2">
                    {it.pecaId ? (
                      <Link href={`/cadastros/pecas/${it.pecaId}`} className="font-medium hover:underline">
                        {it.codigoProduto}
                      </Link>
                    ) : (
                      <span className="font-medium">{it.codigoProduto}</span>
                    )}{" "}
                    — {it.descricao}
                    {it.semTempo && (
                      <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">sem tempo</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{formatQtd(it.quantidade)}</td>
                  <td className="px-3 py-2 text-right text-sky-700">
                    {it.cobertoEstoque > 0 ? formatQtd(it.cobertoEstoque) : "-"}
                  </td>
                  <td className="px-3 py-2 text-right">{it.qtdEmOP > 0 ? formatQtd(it.qtdEmOP) : "-"}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${it.falta > 0 ? "text-red-700" : "text-slate-400"}`}>
                    {it.falta > 0 ? formatQtd(it.falta) : "0"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SITUACAO_CLASS[it.situacao]}`}>
                      {SITUACAO_LABEL[it.situacao]}
                    </span>
                    {it.ops.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {it.ops.map((o) => (
                          <Link
                            key={o.numero}
                            href={`/ordens/${o.numero}`}
                            className={`rounded px-1.5 py-0.5 text-[11px] font-medium hover:underline ${STATUS_BADGE_CLASS[o.status]}`}
                            title={STATUS_LABEL[o.status]}
                          >
                            OP {o.numero} · {o.maquina}
                          </Link>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {it.falta > 0 && (
                      <Link
                        href={`/pcp/nova-op?item=${it.id}`}
                        className="whitespace-nowrap rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                      >
                        Gerar OP
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
            {visiveis.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                  {linhas.length === 0 ? (
                    <>
                      Carteira vazia.{" "}
                      <Link href="/pcp/importar" className="font-medium text-brand-600 underline">
                        Importe os pedidos
                      </Link>
                      .
                    </>
                  ) : (
                    "Nenhum item com esse filtro."
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

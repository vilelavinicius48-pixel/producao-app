"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { importarPedidos, type ItemResumo, type ResumoImportacao } from "../actions";
import { formatData, formatQtd } from "@/lib/pcp/carteira";
import { parseCSV } from "@/lib/pcp/csv";

function celulaParaTexto(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    // Datas do Excel não têm fuso: a biblioteca entrega meia-noite UTC.
    const d = v.getUTCDate().toString().padStart(2, "0");
    const m = (v.getUTCMonth() + 1).toString().padStart(2, "0");
    return `${d}/${m}/${v.getUTCFullYear()}`;
  }
  // Excel guarda 0,04 como 0.03999999910593033: arredonda e usa vírgula decimal.
  if (typeof v === "number") return String(Math.round(v * 10000) / 10000).replace(".", ",");
  return String(v);
}

/** Planilha Excel (.xls ou .xlsx) ou CSV → tabela de textos (primeira aba). */
async function lerArquivo(arquivo: File): Promise<string[][]> {
  const nome = arquivo.name.toLowerCase();
  if (nome.endsWith(".xls") || nome.endsWith(".xlsx")) {
    const XLSX = await import("@e965/xlsx");
    const pasta = XLSX.read(await arquivo.arrayBuffer(), { type: "array", cellDates: true, UTC: true });
    const aba = pasta.Sheets[pasta.SheetNames[0]];
    const linhas = XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, raw: true, defval: "" });
    return linhas.map((linha) => linha.map(celulaParaTexto));
  }
  // CSV/TXT: UTF-8; se vier com caracteres quebrados (Excel/Windows), relê como Windows-1252.
  const buffer = await arquivo.arrayBuffer();
  let texto = new TextDecoder("utf-8").decode(buffer);
  if (texto.includes("�")) texto = new TextDecoder("windows-1252").decode(buffer);
  return parseCSV(texto);
}

function TabelaItens({ itens, extra }: { itens: ItemResumo[]; extra?: (i: number) => React.ReactNode }) {
  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="sticky top-0 bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2">Entrega</th>
            <th className="px-3 py-2">Cliente</th>
            <th className="px-3 py-2">Pedido</th>
            <th className="px-3 py-2">Produto</th>
            <th className="px-3 py-2 text-right">Qtd</th>
            {extra && <th className="px-3 py-2" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {itens.map((it, i) => (
            <tr key={`${it.numero_pedido}-${it.codigo}-${it.data_entrega}`}>
              <td className="px-3 py-1.5 whitespace-nowrap">{formatData(it.data_entrega)}</td>
              <td className="px-3 py-1.5">{it.cliente}</td>
              <td className="px-3 py-1.5">{it.numero_pedido}</td>
              <td className="px-3 py-1.5">
                <span className="font-medium">{it.codigo}</span> — {it.descricao}
              </td>
              <td className="px-3 py-1.5 text-right">{formatQtd(it.quantidade)}</td>
              {extra && <td className="px-3 py-1.5">{extra(i)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Secao({
  titulo,
  qtd,
  cor,
  children,
}: {
  titulo: string;
  qtd: number;
  cor: string;
  children: React.ReactNode;
}) {
  if (qtd === 0) return null;
  return (
    <details className="rounded-xl border border-slate-200 bg-white" open={qtd <= 30}>
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900">
        <span className={`mr-2 rounded-full px-2 py-0.5 text-xs ${cor}`}>{qtd}</span>
        {titulo}
      </summary>
      <div className="border-t border-slate-100">{children}</div>
    </details>
  );
}

export function ImportarForm() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [tabela, setTabela] = useState<string[][]>([]);
  const [resumo, setResumo] = useState<ResumoImportacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  async function escolher(f: File | null) {
    setArquivo(f);
    setResumo(null);
    setErro(null);
    if (!f) return;
    let t: string[][];
    try {
      t = await lerArquivo(f);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui ler a planilha.");
      return;
    }
    setTabela(t);
    startTransition(async () => {
      try {
        setResumo(await importarPedidos(t, f.name, false));
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
      }
    });
  }

  function confirmar() {
    if (!arquivo) return;
    startTransition(async () => {
      try {
        setResumo(await importarPedidos(tabela, arquivo.name, true));
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
      }
    });
  }

  const nadaMuda =
    resumo &&
    resumo.novos.length + resumo.alterados.length + resumo.reabertos.length + resumo.encerrados.length === 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Planilha Excel da carteira (relatório de pedidos em aberto, todos os clientes)
        </label>
        <input
          type="file"
          accept=".xlsx,.xls,.csv,.txt"
          onChange={(e) => escolher(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-700"
        />
        <p className="mt-2 text-xs text-slate-500">
          O arquivo precisa ser a carteira completa: item aberto no app que não estiver no arquivo será
          encerrado (entendido como entregue ou cancelado).
        </p>
      </div>

      {pendente && <p className="text-sm text-slate-600">Processando…</p>}
      {erro && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      )}

      {resumo && (
        <div className="space-y-4">
          {resumo.erros.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p className="font-semibold">{resumo.erros.length} linha(s) ignorada(s):</p>
              <ul className="mt-1 ml-4 list-disc">
                {resumo.erros.slice(0, 20).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {resumo.linhas > 0 && (
            <div
              className={`rounded-xl border p-4 text-sm ${
                resumo.aplicado ? "border-green-200 bg-green-50 text-green-900" : "border-brand-200 bg-brand-50 text-brand-900"
              }`}
            >
              <p className="font-semibold">
                {resumo.aplicado ? "Importação concluída" : "Prévia — nada foi gravado ainda"}
              </p>
              <p className="mt-1">
                {resumo.linhas} linhas lidas · {resumo.novos.length} novas · {resumo.alterados.length} alteradas ·{" "}
                {resumo.reabertos.length} reabertas · {resumo.encerrados.length} a encerrar · {resumo.inalterados}{" "}
                sem mudança
                {resumo.pecasNovas > 0 && ` · ${resumo.pecasNovas} peças novas (cadastro pendente)`}
                {resumo.duplicadas > 0 && ` · ${resumo.duplicadas} linhas repetidas somadas`}
              </p>
              {resumo.aplicado ? (
                <Link href="/pcp/carteira" className="mt-3 inline-block font-semibold text-green-800 underline">
                  Ver carteira →
                </Link>
              ) : nadaMuda ? (
                <p className="mt-2">A carteira já está igual ao arquivo.</p>
              ) : (
                <button
                  type="button"
                  onClick={confirmar}
                  disabled={pendente}
                  className="mt-3 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  Confirmar importação
                </button>
              )}
            </div>
          )}

          <Secao titulo="Itens novos" qtd={resumo.novos.length} cor="bg-green-100 text-green-800">
            <TabelaItens itens={resumo.novos} />
          </Secao>
          <Secao titulo="Itens alterados" qtd={resumo.alterados.length} cor="bg-amber-100 text-amber-800">
            <TabelaItens
              itens={resumo.alterados.map((a) => a.item)}
              extra={(i) => <span className="text-xs text-amber-800">{resumo.alterados[i].antes}</span>}
            />
          </Secao>
          <Secao titulo="Itens reabertos" qtd={resumo.reabertos.length} cor="bg-sky-100 text-sky-800">
            <TabelaItens itens={resumo.reabertos} />
          </Secao>
          <Secao
            titulo="Itens que saíram da carteira (serão encerrados)"
            qtd={resumo.encerrados.length}
            cor="bg-slate-200 text-slate-700"
          >
            <TabelaItens
              itens={resumo.encerrados}
              extra={(i) =>
                resumo.encerrados[i].comOP ? (
                  <span className="text-xs font-semibold text-red-700">tem OP aberta</span>
                ) : null
              }
            />
          </Secao>
        </div>
      )}
    </div>
  );
}

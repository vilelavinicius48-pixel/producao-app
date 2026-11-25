import Link from "next/link";
import { requireQualidade } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatQtdPecas } from "@/lib/pcp/carteira";

type Filtros = {
  maquina?: string;
  peca?: string;
  op?: string;
  data?: string;
};

type LinhaApontamento = {
  id: string;
  timestamp_stop: string | null;
  quantidade_produzida: number | null;
  operadores: { nome: string } | null;
  ordens_producao: {
    numero: number;
    maquina_id: string;
    maquinas: { nome: string } | null;
    pecas: { codigo: string; descricao: string };
  } | null;
};

type LinhaSublote = {
  id: string;
  timestamp_inicio: string | null;
  sublotes: {
    quantidade: number;
    operadores: { nome: string } | null;
    ordens_producao: {
      numero: number;
      maquina_id: string;
      maquinas: { nome: string } | null;
      pecas: { codigo: string; descricao: string };
    } | null;
  } | null;
};

function bateFiltro(
  filtros: Filtros,
  info: { maquinaId?: string; pecaCodigo?: string; pecaDescricao?: string; opNumero?: number; dataISO?: string | null }
) {
  if (filtros.maquina && info.maquinaId !== filtros.maquina) return false;
  if (filtros.op && String(info.opNumero ?? "") !== filtros.op.trim()) return false;
  if (filtros.peca) {
    const busca = filtros.peca.trim().toLowerCase();
    const alvo = `${info.pecaCodigo ?? ""} ${info.pecaDescricao ?? ""}`.toLowerCase();
    if (!alvo.includes(busca)) return false;
  }
  if (filtros.data) {
    const diaLinha = info.dataISO ? info.dataISO.slice(0, 10) : null;
    if (diaLinha !== filtros.data) return false;
  }
  return true;
}

export default async function QualidadePage({
  searchParams,
}: {
  searchParams: Promise<Filtros>;
}) {
  await requireQualidade();
  const filtros = await searchParams;
  const supabase = await createClient();

  const [{ data: apontamentos }, { data: etapasPendentes }, { data: maquinas }] = await Promise.all([
    supabase
      .from("apontamentos")
      .select(
        "id, timestamp_start, timestamp_stop, quantidade_produzida, operadores(nome), inspecoes_qualidade(id), ordens_producao(numero, maquina_id, maquinas(nome), pecas(codigo, descricao))"
      )
      .not("timestamp_stop", "is", null)
      .order("timestamp_stop", { ascending: false })
      .limit(200),
    supabase
      .from("sublote_etapas")
      .select(
        "id, timestamp_inicio, etapas!inner(nome, tipo), sublotes(quantidade, operadores(nome), ordens_producao(numero, maquina_id, maquinas(nome), pecas(codigo, descricao)))"
      )
      .eq("status", "em_andamento")
      .eq("etapas.tipo", "inspecao")
      .order("timestamp_inicio", { ascending: false })
      .limit(200),
    supabase.from("maquinas").select("id, nome").eq("ativo", true).order("nome"),
  ]);

  const pendentesBrutas = (apontamentos ?? []).filter((a) => {
    const inspecao = a.inspecoes_qualidade as unknown as { id: string } | null;
    return inspecao === null;
  }) as unknown as LinhaApontamento[];

  const pendentes = pendentesBrutas.filter((a) =>
    bateFiltro(filtros, {
      maquinaId: a.ordens_producao?.maquina_id,
      pecaCodigo: a.ordens_producao?.pecas.codigo,
      pecaDescricao: a.ordens_producao?.pecas.descricao,
      opNumero: a.ordens_producao?.numero,
      dataISO: a.timestamp_stop,
    })
  );

  const etapasBrutas = (etapasPendentes ?? []) as unknown as LinhaSublote[];
  const etapasFiltradas = etapasBrutas.filter((e) =>
    bateFiltro(filtros, {
      maquinaId: e.sublotes?.ordens_producao?.maquina_id,
      pecaCodigo: e.sublotes?.ordens_producao?.pecas.codigo,
      pecaDescricao: e.sublotes?.ordens_producao?.pecas.descricao,
      opNumero: e.sublotes?.ordens_producao?.numero,
      dataISO: e.timestamp_inicio,
    })
  );

  const temFiltroAtivo = Boolean(filtros.maquina || filtros.peca || filtros.op || filtros.data);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Qualidade — inspeções pendentes</h1>

      <form className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Máquina</label>
          <select
            name="maquina"
            defaultValue={filtros.maquina ?? ""}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            <option value="">Todas</option>
            {(maquinas ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Peça</label>
          <input
            name="peca"
            defaultValue={filtros.peca ?? ""}
            placeholder="Código ou descrição"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Lote (nº da OP)</label>
          <input
            name="op"
            type="number"
            defaultValue={filtros.op ?? ""}
            placeholder="Ex: 42"
            className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Data</label>
          <input
            name="data"
            type="date"
            defaultValue={filtros.data ?? ""}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          Filtrar
        </button>
        {temFiltroAtivo && (
          <Link href="/qualidade" className="text-sm font-medium text-slate-600 hover:underline">
            Limpar filtros
          </Link>
        )}
      </form>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Por apontamento (direto da máquina)
      </h2>
      <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">OP</th>
              <th className="px-4 py-3">Máquina</th>
              <th className="px-4 py-3">Peça</th>
              <th className="px-4 py-3">Operador</th>
              <th className="px-4 py-3">Produzido</th>
              <th className="px-4 py-3">Encerrado em</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pendentes.map((a) => {
              const op = a.ordens_producao!;
              return (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">OP {op.numero}</td>
                  <td className="px-4 py-3">{op.maquinas?.nome ?? "-"}</td>
                  <td className="px-4 py-3">
                    {op.pecas.codigo} — {op.pecas.descricao}
                  </td>
                  <td className="px-4 py-3">{a.operadores?.nome ?? "-"}</td>
                  <td className="px-4 py-3">{a.quantidade_produzida !== null ? formatQtdPecas(a.quantidade_produzida) : "-"}</td>
                  <td className="px-4 py-3">{new Date(a.timestamp_stop!).toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/qualidade/${a.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                      Inspecionar
                    </Link>
                  </td>
                </tr>
              );
            })}
            {pendentes.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  Nenhuma inspeção pendente
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Por etapa do roteiro pós-máquina (sublote)
      </h2>
      <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">OP</th>
              <th className="px-4 py-3">Máquina</th>
              <th className="px-4 py-3">Peça</th>
              <th className="px-4 py-3">Operador do sublote</th>
              <th className="px-4 py-3">Quantidade</th>
              <th className="px-4 py-3">Chegou em</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {etapasFiltradas.map((e) => {
              const op = e.sublotes?.ordens_producao;
              return (
                <tr key={e.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{op ? `OP ${op.numero}` : "-"}</td>
                  <td className="px-4 py-3">{op?.maquinas?.nome ?? "-"}</td>
                  <td className="px-4 py-3">
                    {op ? `${op.pecas.codigo} — ${op.pecas.descricao}` : "-"}
                  </td>
                  <td className="px-4 py-3">{e.sublotes?.operadores?.nome ?? "-"}</td>
                  <td className="px-4 py-3">
                    {e.sublotes?.quantidade !== undefined ? formatQtdPecas(e.sublotes.quantidade) : "-"}
                  </td>
                  <td className="px-4 py-3">
                    {e.timestamp_inicio ? new Date(e.timestamp_inicio).toLocaleString("pt-BR") : "-"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/qualidade/sublote/${e.id}`}
                      className="text-sm font-medium text-brand-600 hover:underline"
                    >
                      Inspecionar
                    </Link>
                  </td>
                </tr>
              );
            })}
            {etapasFiltradas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  Nenhuma inspeção pendente
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

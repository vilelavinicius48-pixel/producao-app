import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { marcarPreparoOk } from "../actions";
import { PREPARO_ITENS, PREPARO_LABEL, type CampoPreparo } from "@/lib/op-status";
import { formatData, formatQtd, hojeISO } from "@/lib/pcp/carteira";
import { buscarTodos } from "@/lib/pcp/paginar";
import type { OPQuadro } from "../OPCard";

type OPPend = OPQuadro & {
  maquinas: { nome: string } | null;
  peca_id: string;
  pecas: (OPQuadro["pecas"] & { peca_materiais: { material: string; quantidade_por_unidade: number; unidade_medida: string }[] }) | null;
};

export default async function PendenciasPage() {
  const supabase = await createClient();
  const hoje = hojeISO();

  const { data } = await supabase
    .from("ordens_producao")
    .select(
      "id, numero, status, maquina_id, sequencia, quantidade_planejada, created_at, peca_id, material_status, ferramenta_status, dispositivo_status, programa_status, previsao_material, maquinas(nome), pecas(codigo, descricao, tempo_padrao_segundos, peca_materiais(material, quantidade_por_unidade, unidade_medida)), pedido_itens(cliente, data_entrega, numero_pedido)"
    )
    .eq("status", "planejada")
    .order("created_at")
    .overrideTypes<OPPend[], { merge: false }>();
  const ops = data ?? [];

  // Prioridade: entrega mais próxima primeiro.
  const entrega = (o: OPPend) => o.pedido_itens?.data_entrega ?? "9999-12-31";
  ops.sort((a, b) => entrega(a).localeCompare(entrega(b)));

  // Peças da carteira aberta com cadastro incompleto.
  const itensAbertos = await buscarTodos<{ peca_id: string | null }>((de, ate) =>
    supabase.from("pedido_itens").select("peca_id").eq("status", "aberto").order("id").range(de, ate)
  );
  const pecaIds = [...new Set(itensAbertos.map((i) => i.peca_id).filter(Boolean))] as string[];
  const { data: pecas } =
    pecaIds.length > 0
      ? await supabase
          .from("pecas")
          .select("id, codigo, descricao, tempo_padrao_segundos, pecas_maquinas(maquina_id)")
          .in("id", pecaIds.slice(0, 500))
      : { data: [] };
  const pecasPendentes = (pecas ?? []).filter(
    (p) => p.tempo_padrao_segundos === null || (p.pecas_maquinas as unknown[]).length === 0
  );

  const grupos = PREPARO_ITENS.map((item) => ({
    ...item,
    ops: ops.filter((o) => o[item.campo as CampoPreparo] === "pendente" || o[item.campo as CampoPreparo] === "aguardando"),
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Pendências</h1>
      <p className="mt-1 text-sm text-slate-600">
        O que está segurando as {ops.length} OPs planejadas, por ordem de entrega. Marque OK quando estiver resolvido.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {grupos.map((g) => (
          <section key={g.campo} className="rounded-xl border border-slate-200 bg-white">
            <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="font-semibold text-slate-900">{g.label}</h2>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  g.ops.length > 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {g.ops.length}
              </span>
            </header>
            {g.ops.length === 0 ? (
              <p className="px-4 py-4 text-sm text-slate-500">Nada pendente.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {g.ops.map((o) => {
                  const estado = o[g.campo as CampoPreparo];
                  const atrasado = o.pedido_itens && o.pedido_itens.data_entrega < hoje;
                  return (
                    <li key={o.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
                      <div className="min-w-0">
                        <Link href={`/ordens/${o.numero}`} className="font-medium text-slate-900 hover:underline">
                          OP {o.numero} · {o.maquinas?.nome}
                        </Link>{" "}
                        <span className="text-slate-700">
                          {o.pecas?.codigo} — {formatQtd(Number(o.quantidade_planejada))} pç
                        </span>
                        <p className="text-xs text-slate-500">
                          {o.pedido_itens && (
                            <span className={atrasado ? "font-semibold text-red-700" : ""}>
                              Entrega {formatData(o.pedido_itens.data_entrega)} ·{" "}
                            </span>
                          )}
                          {PREPARO_LABEL[estado]}
                          {g.campo === "material_status" && o.previsao_material && (
                            <> · chega {formatData(o.previsao_material)}</>
                          )}
                        </p>
                        {g.campo === "material_status" &&
                          (o.pecas?.peca_materiais ?? []).map((m) => (
                            <p key={m.material} className="text-xs text-slate-600">
                              {m.material}: {formatQtd(m.quantidade_por_unidade * Number(o.quantidade_planejada))}{" "}
                              {m.unidade_medida}
                            </p>
                          ))}
                      </div>
                      <form action={marcarPreparoOk} className="shrink-0">
                        <input type="hidden" name="op_id" value={o.id} />
                        <input type="hidden" name="campo" value={g.campo} />
                        <button
                          type="submit"
                          className="rounded-lg border border-emerald-300 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                        >
                          OK
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white">
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="font-semibold text-slate-900">Peças da carteira com cadastro incompleto</h2>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
            {pecasPendentes.length}
          </span>
        </header>
        {pecasPendentes.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">Todas com tempo e máquina cadastrados.</p>
        ) : (
          <ul className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0">
            {pecasPendentes.map((p) => (
              <li key={p.id} className="px-4 py-2 text-sm">
                <Link href={`/cadastros/pecas/${p.id}`} className="font-medium text-slate-900 hover:underline">
                  {p.codigo}
                </Link>{" "}
                <span className="text-slate-600">{p.descricao}</span>
                <span className="block text-xs text-amber-700">
                  falta{" "}
                  {[
                    p.tempo_padrao_segundos === null && "tempo",
                    (p.pecas_maquinas as unknown[]).length === 0 && "máquina",
                  ]
                    .filter(Boolean)
                    .join(" e ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

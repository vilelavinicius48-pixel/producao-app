import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { hojeISO } from "@/lib/pcp/carteira";
import { formatHoras } from "@/lib/tempo";
import { OPCard, type OPQuadro } from "../OPCard";
import type { StatusOP } from "@/types/database";

const ATIVOS: StatusOP[] = ["setup", "em_producao", "parada"];

export default async function ProgramacaoPage() {
  const supabase = await createClient();
  const hoje = hojeISO();

  const [{ data: maquinas }, { data: opsData }] = await Promise.all([
    supabase.from("maquinas").select("id, codigo, nome").eq("ativo", true).order("codigo"),
    supabase
      .from("ordens_producao")
      .select(
        "id, numero, status, maquina_id, sequencia, quantidade_planejada, created_at, material_status, ferramenta_status, dispositivo_status, programa_status, previsao_material, pecas(codigo, descricao, tempo_padrao_segundos), pedido_itens(cliente, data_entrega, numero_pedido)"
      )
      .in("status", ["planejada", "aberta", ...ATIVOS])
      .order("sequencia", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .overrideTypes<OPQuadro[], { merge: false }>(),
  ]);
  const ops = opsData ?? [];

  const { data: progresso } =
    ops.length > 0
      ? await supabase.from("op_progresso").select("op_id, quantidade_produzida_total").in(
          "op_id",
          ops.map((o) => o.id)
        )
      : { data: [] };
  const produzido = new Map((progresso ?? []).map((p) => [p.op_id, Number(p.quantidade_produzida_total)]));

  const totalFila = ops.filter((o) => !ATIVOS.includes(o.status)).length;
  const liberadas = ops.filter((o) => o.status === "aberta").length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Programação das máquinas</h1>
          <p className="mt-1 text-sm text-slate-600">
            {totalFila} OPs na fila · {liberadas} liberadas · a primeira da fila de cada máquina é a próxima a entrar
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="font-semibold">Preparo:</span> M material · F ferramenta · D dispositivo · P programa
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(maquinas ?? []).map((m) => {
          const daMaquina = ops.filter((o) => o.maquina_id === m.id);
          const atual = daMaquina.filter((o) => ATIVOS.includes(o.status));
          const fila = daMaquina.filter((o) => !ATIVOS.includes(o.status));

          let carga = 0;
          let semTempo = 0;
          for (const o of daMaquina) {
            const saldo = Math.max(Number(o.quantidade_planejada) - (produzido.get(o.id) ?? 0), 0);
            if (o.pecas?.tempo_padrao_segundos) carga += saldo * o.pecas.tempo_padrao_segundos;
            else semTempo++;
          }

          return (
            <section key={m.id} className="flex flex-col rounded-xl border border-slate-200 bg-slate-50">
              <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                <h2 className="text-base font-bold text-slate-900">{m.nome}</h2>
                <span className="text-xs text-slate-600">
                  {formatHoras(carga)}
                  {semTempo > 0 && <span className="text-amber-700"> + {semTempo} sem tempo</span>}
                </span>
              </header>
              <div className="flex flex-1 flex-col gap-2 p-2">
                {atual.map((op) => (
                  <OPCard
                    key={op.id}
                    op={op}
                    produzido={produzido.get(op.id) ?? 0}
                    hoje={hoje}
                    destaque="atual"
                    podeMover={false}
                  />
                ))}
                {atual.length === 0 && (
                  <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-center text-xs text-slate-500">
                    Máquina sem OP rodando
                  </p>
                )}
                {fila.length > 0 && (
                  <p className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Fila</p>
                )}
                {fila.map((op, i) => (
                  <OPCard
                    key={op.id}
                    op={op}
                    produzido={produzido.get(op.id) ?? 0}
                    hoje={hoje}
                    destaque={i === 0 ? "proxima" : undefined}
                    podeMover
                    primeiro={i === 0}
                    ultimo={i === fila.length - 1}
                  />
                ))}
                {fila.length === 0 && (
                  <p className="px-1 text-xs text-red-700">
                    Nenhuma OP na fila —{" "}
                    <Link href="/pcp/carteira?filtro=a_programar" className="underline">
                      programar
                    </Link>
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireQualidade } from "@/lib/auth";
import { STATUS_BADGE_CLASS, STATUS_LABEL } from "@/lib/op-status";
import { inspecaoEmDia, minutosDesde } from "@/lib/inspecao-linha";
import { salvarInspecaoLinha } from "../actions";

const OPCOES_STATUS: { value: "ok" | "nao_ok" | "parada"; label: string; classe: string }[] = [
  { value: "ok", label: "OK", classe: "has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 has-[:checked]:text-emerald-800" },
  { value: "nao_ok", label: "Não OK", classe: "has-[:checked]:border-red-500 has-[:checked]:bg-red-50 has-[:checked]:text-red-800" },
  { value: "parada", label: "Parada", classe: "has-[:checked]:border-slate-500 has-[:checked]:bg-slate-100 has-[:checked]:text-slate-800" },
];

function SeletorStatus({ name, defaultValue }: { name: string; defaultValue: "ok" | "nao_ok" | "parada" }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {OPCOES_STATUS.map((op) => (
        <label
          key={op.value}
          className={`flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 ${op.classe}`}
        >
          <input
            type="radio"
            name={name}
            value={op.value}
            defaultChecked={defaultValue === op.value}
            className="sr-only"
          />
          {op.label}
        </label>
      ))}
    </div>
  );
}

export default async function InspecaoLinhaPage({ params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params;
  await requireQualidade();
  const supabase = await createClient();

  const { data: op } = await supabase
    .from("ordens_producao")
    .select("*, pecas(id, codigo, descricao), maquinas(id, nome)")
    .eq("numero", Number(numero))
    .single();
  if (!op) notFound();

  const peca = op.pecas as unknown as { id: string; codigo: string; descricao: string };
  const maquina = op.maquinas as unknown as { id: string; nome: string };

  const [{ data: motivos }, { data: ultima }] = await Promise.all([
    supabase.from("motivos_refugo").select("*").eq("ativo", true).order("descricao"),
    supabase
      .from("inspecoes_linha")
      .select("created_at, operadores(nome)")
      .eq("maquina_id", maquina.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const emDia = inspecaoEmDia(ultima?.created_at ?? null);
  const inspetorUltima = ultima?.operadores as unknown as { nome: string } | null;
  const minutosDesdeUltima = ultima ? minutosDesde(ultima.created_at) : null;

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">OP {op.numero}</h1>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_BADGE_CLASS[op.status]}`}>
            {STATUS_LABEL[op.status]}
          </span>
        </div>
        <p className="mt-1 text-base text-slate-700">
          {peca.codigo} — {peca.descricao}
        </p>
        <p className="mt-1 text-sm text-slate-500">Máquina {maquina.nome}</p>
      </div>

      <div
        className={`mt-4 rounded-xl border-2 p-4 text-sm ${
          emDia ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-red-300 bg-red-50 text-red-800"
        }`}
      >
        {emDia ? (
          <p>
            <strong>Em dia</strong> — última inspeção de linha há {minutosDesdeUltima} min, por {inspetorUltima?.nome ?? "-"}.
          </p>
        ) : (
          <p>
            <strong>Pendente</strong> — {ultima ? `faz mais de 1h desde a última inspeção (${inspetorUltima?.nome ?? "-"}).` : "ainda não teve inspeção de linha nesta máquina."}
          </p>
        )}
      </div>

      <form action={salvarInspecaoLinha} className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <input type="hidden" name="op_id" value={op.id} />
        <input type="hidden" name="numero" value={numero} />

        <div className="group/situacao">
          <label className="mb-1 block text-sm font-semibold text-slate-700">Situação geral da máquina</label>
          <SeletorStatus name="situacao_geral" defaultValue="ok" />
          <div className="mt-2 hidden group-has-[input:not([value=ok]):checked]/situacao:block">
            <select
              name="motivo_id"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            >
              <option value="">Motivo...</option>
              {(motivos ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.descricao}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Observação (opcional)</label>
          <textarea
            name="observacao"
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-brand-600 px-4 py-4 text-lg font-bold text-white hover:bg-brand-700"
        >
          Salvar inspeção de linha
        </button>
      </form>
    </div>
  );
}

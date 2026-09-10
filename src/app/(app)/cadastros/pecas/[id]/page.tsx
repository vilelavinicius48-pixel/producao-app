import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function PecaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: peca } = await supabase.from("pecas").select("*").eq("id", id).single();
  if (!peca) notFound();

  const { data: maquinasCompativeis } = await supabase
    .from("pecas_maquinas")
    .select("maquinas(codigo, nome)")
    .eq("peca_id", id);

  const { data: materiais } = await supabase
    .from("peca_materiais")
    .select("*")
    .eq("peca_id", id);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">
        {peca.codigo} — {peca.descricao}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Tempo padrão: {peca.tempo_padrao_por_unidade} min/unidade ·{" "}
        {peca.ativo ? "Ativa" : "Inativa"}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Máquinas compatíveis</h2>
          <ul className="space-y-1 text-sm text-slate-700">
            {maquinasCompativeis?.map((mc, i) => {
              const maquina = mc.maquinas as unknown as { codigo: string; nome: string } | null;
              return <li key={i}>{maquina ? `${maquina.codigo} — ${maquina.nome}` : "-"}</li>;
            })}
            {maquinasCompativeis?.length === 0 && (
              <li className="text-slate-400">Nenhuma máquina vinculada</li>
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Materiais necessários</h2>
          <ul className="space-y-1 text-sm text-slate-700">
            {materiais?.map((m) => (
              <li key={m.id}>
                {m.material} — {m.quantidade_por_unidade} {m.unidade_medida} / unidade
              </li>
            ))}
            {materiais?.length === 0 && (
              <li className="text-slate-400">Nenhum material cadastrado</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

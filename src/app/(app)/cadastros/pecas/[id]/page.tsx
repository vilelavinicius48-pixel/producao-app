import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatSegundos } from "@/lib/tempo";
import { TimeInput } from "@/components/TimeInput";
import { updatePeca } from "../actions";
import { MaterialPecaForm } from "./MaterialPecaForm";
import { RoteiroPecaForm } from "./RoteiroPecaForm";
import { PlanoMedicaoPecaForm } from "./PlanoMedicaoPecaForm";

export default async function PecaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: peca } = await supabase.from("pecas").select("*").eq("id", id).single();
  if (!peca) notFound();

  const [
    { data: compativeis },
    { data: materiais },
    { data: maquinas },
    { data: materiaisAtivos },
    { data: roteiro },
    { data: cotas },
    { data: etapasAtivas },
    { data: tratamentosAtivos },
    { data: outrasPecas },
  ] = await Promise.all([
    supabase.from("pecas_maquinas").select("maquina_id, tempo_padrao_segundos").eq("peca_id", id),
    supabase.from("peca_materiais").select("*").eq("peca_id", id),
    supabase.from("maquinas").select("id, codigo, nome, barra_comprimento_mm, barra_sobra_mm").eq("ativo", true).order("codigo"),
    supabase.from("materiais").select("id, formato, tipo, medida_a_mm, medida_b_mm, espessura_mm").eq("ativo", true).order("tipo"),
    supabase
      .from("peca_roteiro_etapas")
      .select("id, ordem, etapa:etapas(nome, tipo), maquina:maquinas(nome), tratamento:tratamentos(nome)")
      .eq("peca_id", id)
      .order("ordem")
      .overrideTypes<
        {
          id: string;
          ordem: number;
          etapa: { nome: string; tipo: import("@/types/database").TipoEtapa } | null;
          maquina: { nome: string } | null;
          tratamento: { nome: string } | null;
        }[],
        { merge: false }
      >(),
    supabase.from("peca_plano_medicao_cotas").select("*").eq("peca_id", id).order("ordem"),
    supabase.from("etapas").select("id, nome, tipo").eq("ativo", true).order("nome"),
    supabase.from("tratamentos").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("pecas").select("id, codigo, descricao").neq("id", id).order("codigo"),
  ]);

  const compativeisIds = new Set((compativeis ?? []).map((c) => c.maquina_id));
  const tempoPorMaquina = new Map((compativeis ?? []).map((c) => [c.maquina_id, c.tempo_padrao_segundos]));
  const maquinasCompativeis = (maquinas ?? []).filter((m) => compativeisIds.has(m.id));
  const desenhoUrl = peca.desenho_path
    ? supabase.storage.from("desenhos").getPublicUrl(peca.desenho_path).data.publicUrl
    : null;
  const pendencias = [
    peca.tempo_padrao_segundos === null && "tempo padrão",
    compativeisIds.size === 0 && "máquinas compatíveis",
    peca.material_id === null && "material",
    (roteiro ?? []).length === 0 && "roteiro pós-máquina",
    (cotas ?? []).length === 0 && "plano de medição",
  ].filter(Boolean) as string[];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">
        {peca.codigo} — {peca.descricao}
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Tempo padrão:{" "}
        {peca.tempo_padrao_segundos !== null
          ? `${formatSegundos(peca.tempo_padrao_segundos)} (h:min:s) por unidade`
          : "não cadastrado"}{" "}
        · {peca.ativo ? "Ativa" : "Inativa"}
      </p>

      {pendencias.length > 0 && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Cadastro pendente: falta {pendencias.join(", ")}.
        </p>
      )}

      <form action={updatePeca} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <input type="hidden" name="id" value={peca.id} />
        <h2 className="text-sm font-semibold text-slate-900">Editar cadastro</h2>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Descrição</label>
          <input
            name="descricao"
            defaultValue={peca.descricao}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div>
          <TimeInput
            name="tempo_padrao_segundos"
            label="Tempo de ciclo por peça (h:min:s) — deixe 0 se ainda não souber"
            defaultSegundos={peca.tempo_padrao_segundos ?? 0}
          />
        </div>
        <div>
          <p className="mb-1 text-sm font-medium text-slate-700">Máquinas que fazem esta peça</p>
          <p className="mb-2 text-xs text-slate-500">
            Tempo (s) é opcional — só preencha se o tempo de ciclo nessa máquina for diferente do tempo padrão geral acima.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {maquinas?.map((m) => (
              <div key={m.id} className="flex items-center gap-2 text-sm text-slate-700">
                <label className="flex flex-1 items-center gap-2">
                  <input
                    type="checkbox"
                    name="maquina_id"
                    value={m.id}
                    defaultChecked={compativeisIds.has(m.id)}
                    className="h-4 w-4"
                  />
                  {m.nome}
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  name={`tempo_maquina_${m.id}`}
                  placeholder="tempo (s)"
                  defaultValue={tempoPorMaquina.get(m.id) ?? ""}
                  className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Material (barra/chapa)</p>
          <MaterialPecaForm
            materiais={materiaisAtivos ?? []}
            maquinasCompativeis={maquinasCompativeis}
            materialIdAtual={peca.material_id}
            comprimentoAtual={peca.comprimento_consumido_mm}
            pecasPorFolhaAtual={peca.pecas_por_folha}
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Salvar cadastro
        </button>
      </form>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Materiais necessários</h2>
        <ul className="space-y-1 text-sm text-slate-700">
          {materiais?.map((m) => (
            <li key={m.id}>
              {m.material} — {m.quantidade_por_unidade} {m.unidade_medida} / unidade
            </li>
          ))}
          {materiais?.length === 0 && <li className="text-slate-500">Nenhum material cadastrado</li>}
        </ul>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Roteiro pós-máquina</h2>
        <p className="mb-3 text-xs text-slate-500">
          Etapas pelas quais a peça passa depois de sair da máquina, na ordem em que acontecem.
        </p>
        <RoteiroPecaForm
          pecaId={peca.id}
          roteiro={roteiro ?? []}
          etapas={etapasAtivas ?? []}
          maquinas={(maquinas ?? []).map((m) => ({ id: m.id, nome: m.nome }))}
          tratamentos={tratamentosAtivos ?? []}
          outrasPecas={outrasPecas ?? []}
        />
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Plano de medição</h2>
        <p className="mb-3 text-xs text-slate-500">
          Cotas que precisam ser inspecionadas, com o desenho técnico da peça anexado.
        </p>
        <PlanoMedicaoPecaForm pecaId={peca.id} cotas={cotas ?? []} outrasPecas={outrasPecas ?? []} desenhoUrl={desenhoUrl} />
      </div>
    </div>
  );
}

import { requireGestor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OPForm, type PecaComRelacoes } from "./OPForm";

export default async function NovaOPPage() {
  await requireGestor();
  const supabase = await createClient();

  const [{ data: pecas }, { data: maquinas }] = await Promise.all([
    supabase
      .from("pecas")
      .select(
        "id, codigo, descricao, tempo_padrao_segundos, comprimento_consumido_mm, pecas_por_folha, pecas_maquinas(maquina_id), peca_materiais(material, quantidade_por_unidade, unidade_medida), materiais(formato, tipo, medida_a_mm, medida_b_mm, espessura_mm)"
      )
      .eq("ativo", true)
      .order("codigo"),
    supabase.from("maquinas").select("*").eq("ativo", true).order("codigo"),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Nova ordem de produção</h1>
      <div className="mt-6 max-w-xl">
        <OPForm pecas={(pecas ?? []) as unknown as PecaComRelacoes[]} maquinas={maquinas ?? []} />
      </div>
    </div>
  );
}

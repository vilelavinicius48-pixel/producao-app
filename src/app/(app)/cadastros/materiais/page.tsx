import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { toggleMaterialAtivo } from "./actions";
import { MaterialForm } from "./MaterialForm";
import { MaterialEditForm } from "./MaterialEditForm";
import { unidadeMaterial } from "@/lib/pcp/material";

export default async function MateriaisPage() {
  const supabase = await createClient();
  const { data: materiais } = await supabase.from("materiais").select("*").order("tipo");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Materiais</h1>
          <p className="mt-1 text-sm text-slate-600">
            Catálogo de materiais (tipo + bitola). Depois, vincule o material de cada peça em{" "}
            <span className="font-medium">Cadastros → Peças</span>.
          </p>
        </div>
        <Link href="/cadastros/materiais/importar" className="text-sm font-medium text-brand-600 hover:underline">
          Importar estoque inicial de uma planilha →
        </Link>
      </div>

      <MaterialForm />

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Material</th>
              <th className="px-4 py-3">Unidade</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {materiais?.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3">
                  <MaterialEditForm material={m} />
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{unidadeMaterial(m.formato)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      m.ativo ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {m.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right align-top">
                  <form action={toggleMaterialAtivo}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="ativo" value={(!m.ativo).toString()} />
                    <button type="submit" className="text-sm font-medium text-brand-600 hover:underline">
                      {m.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {materiais?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  Nenhum material cadastrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

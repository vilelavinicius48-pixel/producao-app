import { createClient } from "@/lib/supabase/server";
import { PecaForm } from "./PecaForm";

export default async function NovaPecaPage() {
  const supabase = await createClient();
  const { data: maquinas } = await supabase
    .from("maquinas")
    .select("*")
    .eq("ativo", true)
    .order("codigo");

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Nova peça</h1>
      <div className="mt-6">
        <PecaForm maquinas={maquinas ?? []} />
      </div>
    </div>
  );
}

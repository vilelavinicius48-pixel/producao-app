import { createClient } from "@/lib/supabase/server";
import { ImportarForm } from "./ImportarForm";

export default async function ImportarPage() {
  const supabase = await createClient();
  const { data: ultimas } = await supabase
    .from("importacoes_pedidos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900">Importar pedidos</h1>
      <p className="mt-1 text-sm text-slate-600">
        Exporte do sistema o relatório de pedidos em aberto em Excel (.xlsx) e envie aqui. Primeiro aparece uma prévia do
        que muda; só grava depois de confirmar.
      </p>

      <div className="mt-6">
        <ImportarForm />
      </div>

      {ultimas && ultimas.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-slate-900">Últimas importações</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {ultimas.map((u) => (
              <li key={u.id}>
                {new Date(u.created_at).toLocaleString("pt-BR")} — {u.arquivo ?? "arquivo"}: {u.linhas} linhas,{" "}
                {u.novos} novas, {u.alterados} alteradas, {u.encerrados} encerradas
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

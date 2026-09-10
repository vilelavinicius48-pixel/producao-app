import { getOperadorAtual } from "@/lib/auth";

export default async function HomePage() {
  const operador = await getOperadorAtual();

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Olá, {operador?.nome}</h1>
      <p className="mt-2 text-slate-600">
        Fase 1 concluída: cadastros base. Os módulos de ordens de produção, apontamento e
        dashboard chegam nas próximas fases.
      </p>
    </div>
  );
}

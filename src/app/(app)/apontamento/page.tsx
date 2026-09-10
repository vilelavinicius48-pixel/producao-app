import { BuscaOPForm } from "./BuscaOPForm";

export default function ApontamentoPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold text-slate-900">Apontamento de produção</h1>
      <p className="mt-1 text-sm text-slate-600">Digite o número da OP para iniciar, parar ou finalizar.</p>
      <div className="mt-6">
        <BuscaOPForm />
      </div>
    </div>
  );
}

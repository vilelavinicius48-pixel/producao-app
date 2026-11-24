import Link from "next/link";
import { ImportarEstoqueForm } from "./ImportarEstoqueForm";

export default function ImportarEstoqueMaterialPage() {
  return (
    <div>
      <Link href="/cadastros/materiais" className="text-sm text-brand-600 hover:underline">
        ← Materiais
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Importar estoque inicial de material</h1>
      <p className="mt-1 text-sm text-slate-600">
        Lê a planilha de controle de matéria-prima e cadastra os materiais + o estoque atual de cada um.
      </p>

      <div className="mt-6">
        <ImportarEstoqueForm />
      </div>
    </div>
  );
}

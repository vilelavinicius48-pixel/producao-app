import Link from "next/link";
import { redirect } from "next/navigation";
import { getOperadorAtual } from "@/lib/auth";
import { logout } from "@/app/login/actions";

const NAV_ITEMS: { href: string; label: string; perfis: Array<"gestor" | "operador" | "qualidade"> }[] = [
  { href: "/", label: "Início", perfis: ["gestor", "operador", "qualidade"] },
  { href: "/dashboard", label: "Painel", perfis: ["gestor", "operador", "qualidade"] },
  { href: "/apontamento", label: "Apontamento", perfis: ["gestor", "operador"] },
  { href: "/ordens", label: "Ordens de produção", perfis: ["gestor"] },
  { href: "/qualidade", label: "Qualidade", perfis: ["qualidade"] },
  { href: "/historico", label: "Histórico", perfis: ["gestor", "qualidade"] },
  { href: "/relatorios/diario", label: "Relatório diário", perfis: ["gestor"] },
  { href: "/cadastros/pecas", label: "Peças", perfis: ["gestor"] },
  { href: "/cadastros/maquinas", label: "Máquinas", perfis: ["gestor"] },
  { href: "/cadastros/motivos-parada", label: "Motivos de parada", perfis: ["gestor"] },
  { href: "/cadastros/operadores", label: "Usuários", perfis: ["gestor"] },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const operador = await getOperadorAtual();

  if (!operador) {
    redirect("/login");
  }

  if (!operador.ativo) {
    redirect(`/login?error=${encodeURIComponent("Usuário inativo. Fale com um gestor.")}`);
  }

  const visibleItems = NAV_ITEMS.filter((item) => item.perfis.includes(operador.perfil));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-lg font-bold text-slate-900">Produção</span>
            <nav className="flex gap-1">
              {visibleItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right text-sm">
              <div className="font-medium text-slate-900">{operador.nome}</div>
              <div className="text-slate-500 capitalize">{operador.perfil}</div>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}

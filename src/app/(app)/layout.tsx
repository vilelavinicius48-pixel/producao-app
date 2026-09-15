import Link from "next/link";
import { redirect } from "next/navigation";
import { getOperadorAtual } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { MobileBottomNav } from "./MobileBottomNav";
import { CadastrosMenu } from "./CadastrosMenu";
import type { Perfil } from "@/types/database";

const NAV_ITEMS: { href: string; label: string; perfis: Perfil[] }[] = [
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

const PAINEL = { href: "/", label: "Painel", icon: "painel" as const };

const BOTTOM_NAV_PRIMARIOS: Record<Perfil, { href: string; label: string; icon: "painel" | "apontamento" | "ordens" | "qualidade" | "historico" }[]> = {
  gestor: [
    PAINEL,
    { href: "/apontamento", label: "Apontamento", icon: "apontamento" },
    { href: "/ordens", label: "Ordens", icon: "ordens" },
    { href: "/historico", label: "Histórico", icon: "historico" },
  ],
  operador: [PAINEL, { href: "/apontamento", label: "Apontamento", icon: "apontamento" }],
  qualidade: [PAINEL, { href: "/qualidade", label: "Qualidade", icon: "qualidade" }, { href: "/historico", label: "Histórico", icon: "historico" }],
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const operador = await getOperadorAtual();

  if (!operador) {
    redirect("/login");
  }

  if (!operador.ativo) {
    redirect(`/login?error=${encodeURIComponent("Usuário inativo. Fale com um gestor.")}`);
  }

  const visibleItems = NAV_ITEMS.filter((item) => item.perfis.includes(operador.perfil));
  const primarios = BOTTOM_NAV_PRIMARIOS[operador.perfil];
  const primariosHrefs = new Set(primarios.map((p) => p.href));
  const demais = visibleItems.filter((item) => !primariosHrefs.has(item.href));

  const cadastroItems = visibleItems.filter((item) => item.href.startsWith("/cadastros"));
  const outrosItems = visibleItems.filter((item) => !item.href.startsWith("/cadastros"));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex min-w-0 items-center gap-3 sm:gap-6">
            <Link href="/" className="shrink-0 text-lg font-bold text-slate-900">
              Produção
            </Link>
            <nav className="hidden flex-wrap items-center gap-1 sm:flex">
              {outrosItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
              {cadastroItems.length > 0 && <CadastrosMenu items={cadastroItems} />}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden text-right text-sm sm:block">
              <div className="font-medium text-slate-900">{operador.nome}</div>
              <div className="text-slate-600 capitalize">{operador.perfil}</div>
            </div>
            <form action={logout}>
              <button
                type="submit"
                aria-label="Sair"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-6 pb-24 sm:px-4 sm:py-8 sm:pb-8">{children}</main>

      <MobileBottomNav primarios={primarios} demais={demais} />
    </div>
  );
}

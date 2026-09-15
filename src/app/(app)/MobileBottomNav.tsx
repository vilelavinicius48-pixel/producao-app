"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface NavItem {
  href: string;
  label: string;
}

interface IconNavItem extends NavItem {
  icon: "painel" | "apontamento" | "ordens" | "qualidade" | "historico" | "relatorio" | "cadastros";
}

const ICONS: Record<IconNavItem["icon"], React.ReactNode> = {
  painel: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 11.5 12 4l9 7.5M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"
    />
  ),
  apontamento: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 4h6a1 1 0 0 1 1 1v1h1a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h1V5a1 1 0 0 1 1-1Zm-1 9 2.5 2.5L16 10"
    />
  ),
  ordens: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 6h16M4 12h16M4 18h10"
    />
  ),
  qualidade: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Zm-3 9 2 2 4-4"
    />
  ),
  historico: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 8v5l3 2M3 12a9 9 0 1 1 3 6.7M3 12v5m0-5h5"
    />
  ),
  relatorio: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 20V10m6 10V4m6 16v-7"
    />
  ),
  cadastros: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 6h16M4 12h16M4 18h16"
    />
  ),
};

function Icon({ name }: { name: IconNavItem["icon"] }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
      {ICONS[name]}
    </svg>
  );
}

export function MobileBottomNav({
  primarios,
  demais,
}: {
  primarios: IconNavItem[];
  demais: NavItem[];
}) {
  const [aberto, setAberto] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setAberto(false);
  }, [pathname]);

  const ativo = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-50 flex border-t border-slate-200 bg-white sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {primarios.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
              ativo(item.href) ? "text-blue-600" : "text-slate-600"
            }`}
          >
            <Icon name={item.icon} />
            {item.label}
          </Link>
        ))}
        {demais.length > 0 && (
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
              aberto ? "text-blue-600" : "text-slate-600"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
              <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
              <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
            </svg>
            Mais
          </button>
        )}
      </nav>

      {aberto && (
        <>
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setAberto(false)}
            className="fixed inset-0 z-40 bg-black/20 sm:hidden"
          />
          <div
            className="fixed inset-x-0 bottom-[56px] z-50 max-h-[60vh] overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-white p-2 pb-4 shadow-2xl sm:hidden"
            style={{ marginBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-300" />
            {demais
              .filter((item) => !item.href.startsWith("/cadastros"))
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-lg px-4 py-3 text-base font-medium text-slate-700 active:bg-slate-100"
                >
                  {item.label}
                </Link>
              ))}
            {demais.some((item) => item.href.startsWith("/cadastros")) && (
              <>
                <p className="mt-2 px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Cadastros
                </p>
                {demais
                  .filter((item) => item.href.startsWith("/cadastros"))
                  .map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="block rounded-lg px-4 py-3 text-base font-medium text-slate-700 active:bg-slate-100"
                    >
                      {item.label}
                    </Link>
                  ))}
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

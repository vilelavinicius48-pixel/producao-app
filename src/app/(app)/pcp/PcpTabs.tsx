"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const PCP_LINKS = [
  { href: "/pcp/carteira", label: "Carteira" },
  { href: "/pcp/programacao", label: "Programação" },
  { href: "/pcp/pendencias", label: "Pendências" },
  { href: "/pcp/estoque", label: "Estoque" },
  { href: "/pcp/necessidade", label: "Necessidade de material" },
  { href: "/pcp/compras", label: "Compras de material" },
  { href: "/pcp/importar", label: "Importar pedidos" },
];

export function PcpTabs() {
  const pathname = usePathname();
  return (
    <nav className="-mx-3 mb-6 flex gap-1 overflow-x-auto border-b border-slate-200 px-3 sm:mx-0 sm:px-0">
      {PCP_LINKS.map((l) => {
        const ativo = pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
              ativo
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface NavItem {
  href: string;
  label: string;
}

export function CadastrosMenu({ items }: { items: NavItem[] }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const ativo = pathname.startsWith("/cadastros");

  useEffect(() => {
    setAberto(false);
  }, [pathname]);

  useEffect(() => {
    function onClickFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", onClickFora);
    return () => document.removeEventListener("mousedown", onClickFora);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className={`flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-100 ${
          ativo ? "text-blue-600" : "text-slate-700 hover:text-slate-900"
        }`}
      >
        Cadastros
        <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-transform ${aberto ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {aberto && (
        <div className="absolute left-0 top-full z-40 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

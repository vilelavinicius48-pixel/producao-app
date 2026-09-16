import { cache } from "react";
import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Operador } from "@/types/database";

/** Usuário autenticado + seu perfil (operadores). Null se não logado. */
export const getOperadorAtual = cache(async (): Promise<Operador | null> => {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) return null;

  const { data } = await supabase
    .from("operadores")
    .select("*")
    .eq("id", session.user.id)
    .single();

  return data;
});

/** Usa em Server Actions/páginas restritas a gestor. Redireciona caso contrário. */
export async function requireGestor(): Promise<Operador> {
  const operador = await getOperadorAtual();
  if (!operador || operador.perfil !== "gestor") {
    redirect("/");
  }
  return operador;
}

export async function requireOperador(): Promise<Operador> {
  const operador = await getOperadorAtual();
  if (!operador) {
    redirect("/login");
  }
  return operador;
}

export async function requireQualidade(): Promise<Operador> {
  const operador = await getOperadorAtual();
  if (!operador || (operador.perfil !== "qualidade" && operador.perfil !== "gestor")) {
    redirect("/");
  }
  return operador;
}

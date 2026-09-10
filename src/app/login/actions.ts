"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const matricula = String(formData.get("matricula") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/");

  if (!matricula || !senha) {
    redirect(`/login?error=Preencha matrícula e senha&redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  const supabase = await createClient();

  // matrícula é o "login" do operador; internamente o Supabase Auth usa
  // e-mail, então mapeamos matrícula -> e-mail sintético @producao.local
  const email = `${matricula.toLowerCase()}@producao.local`;

  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

  if (error) {
    redirect(`/login?error=Matrícula ou senha inválida&redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  redirect(redirectTo || "/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

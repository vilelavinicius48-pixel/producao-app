"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireGestor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Perfil } from "@/types/database";

const PERFIS: Perfil[] = ["gestor", "operador", "qualidade"];

export async function createOperador(formData: FormData) {
  await requireGestor();

  const matricula = String(formData.get("matricula") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const perfil = String(formData.get("perfil") ?? "") as Perfil;
  const senha = String(formData.get("senha") ?? "");

  if (!matricula || !nome || !PERFIS.includes(perfil) || senha.length < 6) {
    throw new Error(
      "Preencha matrícula, nome, perfil e uma senha com ao menos 6 caracteres"
    );
  }

  const email = `${matricula.toLowerCase()}@producao.local`;
  const admin = createAdminClient();

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { matricula, nome },
  });

  if (userError || !userData.user) {
    throw new Error(userError?.message ?? "Falha ao criar usuário de autenticação");
  }

  const { error: insertError } = await admin
    .from("operadores")
    .insert({ id: userData.user.id, matricula, nome, perfil });

  if (insertError) {
    await admin.auth.admin.deleteUser(userData.user.id);
    throw new Error(insertError.message);
  }

  revalidatePath("/cadastros/operadores");
  redirect("/cadastros/operadores");
}

export async function toggleOperadorAtivo(formData: FormData) {
  await requireGestor();
  const id = String(formData.get("id"));
  const ativo = formData.get("ativo") === "true";

  const supabase = await createClient();
  const { error } = await supabase.from("operadores").update({ ativo }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/cadastros/operadores");
}

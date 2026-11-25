-- =============================================================================
-- 0019 — Gestor também pode salvar Inspeção de Linha (não só qualidade), já
-- que o gestor quer poder testar/acompanhar como o inspetor de linha usa.
-- =============================================================================

drop policy if exists "inspecoes_linha_insert_qualidade" on public.inspecoes_linha;
create policy "inspecoes_linha_insert_qualidade" on public.inspecoes_linha
  for insert to authenticated
  with check ((public.is_qualidade() or public.is_gestor()) and inspetor_id = auth.uid());

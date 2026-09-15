-- ============================================================================
-- Libera o modulo de qualidade tambem para o perfil gestor (alem de
-- qualidade), para permitir testar/operar o fluxo completo.
-- ============================================================================

drop policy if exists "inspecoes_insert_qualidade" on public.inspecoes_qualidade;

create policy "inspecoes_insert_qualidade_ou_gestor" on public.inspecoes_qualidade
  for insert to authenticated
  with check ((public.is_qualidade() or public.is_gestor()) and avaliador_id = auth.uid());

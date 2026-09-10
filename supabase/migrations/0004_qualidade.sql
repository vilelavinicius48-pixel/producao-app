-- ============================================================================
-- Fase 7: qualidade — inspeção 1-para-1 com cada apontamento fechado
-- ============================================================================

create or replace function public.is_qualidade()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce((select perfil = 'qualidade' from public.operadores where id = auth.uid()), false);
$fn$;

create table if not exists public.inspecoes_qualidade (
  id uuid primary key default gen_random_uuid(),
  apontamento_id uuid not null unique references public.apontamentos (id),
  resultado text not null check (resultado in ('aprovado', 'reprovado', 'retrabalho')),
  observacao text,
  avaliador_id uuid not null references public.operadores (id),
  created_at timestamptz not null default now()
);

alter table public.inspecoes_qualidade enable row level security;

create policy "inspecoes_select_autenticados" on public.inspecoes_qualidade
  for select to authenticated using (true);

create policy "inspecoes_insert_qualidade" on public.inspecoes_qualidade
  for insert to authenticated
  with check (public.is_qualidade() and avaliador_id = auth.uid());

alter publication supabase_realtime add table public.inspecoes_qualidade;

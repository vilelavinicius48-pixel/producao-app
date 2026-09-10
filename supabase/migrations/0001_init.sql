-- ============================================================================
-- Fase 1: fundação — perfis de usuário (operadores) e cadastros base
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- operadores (todo usuário do sistema: gestor / operador / qualidade)
-- 1:1 com auth.users. Linhas são criadas por um gestor via API admin
-- (service role), nunca por self-signup.
-- ----------------------------------------------------------------------------
create table if not exists public.operadores (
  id uuid primary key references auth.users (id) on delete cascade,
  matricula text not null unique,
  nome text not null,
  perfil text not null check (perfil in ('gestor', 'operador', 'qualidade')),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.operadores is 'Perfil de todo usuário autenticado: gestor, operador ou qualidade.';

-- Função auxiliar (security definer) para checar o perfil do usuário logado
-- sem cair em recursão de RLS nas políticas abaixo.
create or replace function public.perfil_atual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select perfil from public.operadores where id = auth.uid();
$$;

create or replace function public.is_gestor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select perfil = 'gestor' from public.operadores where id = auth.uid()), false);
$$;

-- ----------------------------------------------------------------------------
-- maquinas
-- ----------------------------------------------------------------------------
create table if not exists public.maquinas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- motivos_parada
-- ----------------------------------------------------------------------------
create table if not exists public.motivos_parada (
  id uuid primary key default gen_random_uuid(),
  descricao text not null unique,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- pecas
-- tempo_padrao_por_unidade em minutos
-- ----------------------------------------------------------------------------
create table if not exists public.pecas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  descricao text not null,
  tempo_padrao_por_unidade numeric(10, 4) not null check (tempo_padrao_por_unidade > 0),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- máquinas compatíveis com cada peça (N:N)
create table if not exists public.pecas_maquinas (
  peca_id uuid not null references public.pecas (id) on delete cascade,
  maquina_id uuid not null references public.maquinas (id) on delete cascade,
  primary key (peca_id, maquina_id)
);

-- materiais necessários por unidade produzida de cada peça
create table if not exists public.peca_materiais (
  id uuid primary key default gen_random_uuid(),
  peca_id uuid not null references public.pecas (id) on delete cascade,
  material text not null,
  quantidade_por_unidade numeric(12, 4) not null check (quantidade_por_unidade > 0),
  unidade_medida text not null default 'un'
);

create index if not exists peca_materiais_peca_id_idx on public.peca_materiais (peca_id);
create index if not exists pecas_maquinas_maquina_id_idx on public.pecas_maquinas (maquina_id);

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.operadores enable row level security;
alter table public.maquinas enable row level security;
alter table public.motivos_parada enable row level security;
alter table public.pecas enable row level security;
alter table public.pecas_maquinas enable row level security;
alter table public.peca_materiais enable row level security;

-- operadores: qualquer usuário autenticado ativo pode ler a lista (precisa
-- selecionar operador no apontamento); só gestor escreve. Inserts de fato
-- acontecem via service role (rota admin), mas a policy fica como defesa em
-- profundidade e para permitir edição de nome/ativo pelo gestor.
create policy "operadores_select_autenticados" on public.operadores
  for select to authenticated
  using (true);

create policy "operadores_write_gestor" on public.operadores
  for all to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());

-- cadastros base (pecas, maquinas, motivos_parada, relações): leitura para
-- todo autenticado ativo, escrita só gestor.
create policy "maquinas_select_autenticados" on public.maquinas
  for select to authenticated using (true);
create policy "maquinas_write_gestor" on public.maquinas
  for all to authenticated using (public.is_gestor()) with check (public.is_gestor());

create policy "motivos_parada_select_autenticados" on public.motivos_parada
  for select to authenticated using (true);
create policy "motivos_parada_write_gestor" on public.motivos_parada
  for all to authenticated using (public.is_gestor()) with check (public.is_gestor());

create policy "pecas_select_autenticados" on public.pecas
  for select to authenticated using (true);
create policy "pecas_write_gestor" on public.pecas
  for all to authenticated using (public.is_gestor()) with check (public.is_gestor());

create policy "pecas_maquinas_select_autenticados" on public.pecas_maquinas
  for select to authenticated using (true);
create policy "pecas_maquinas_write_gestor" on public.pecas_maquinas
  for all to authenticated using (public.is_gestor()) with check (public.is_gestor());

create policy "peca_materiais_select_autenticados" on public.peca_materiais
  for select to authenticated using (true);
create policy "peca_materiais_write_gestor" on public.peca_materiais
  for all to authenticated using (public.is_gestor()) with check (public.is_gestor());

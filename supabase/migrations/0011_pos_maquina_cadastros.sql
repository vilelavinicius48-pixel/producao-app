-- =============================================================================
-- 0011 — Pós-máquina (parte 1 de várias): cadastros de etapas/postos,
-- tratamentos externos, fornecedores e motivos de refugo; roteiro e plano de
-- medição por peça (ainda sem caixa/execução — isso vem numa parte seguinte).
-- =============================================================================

-- 1) Catálogo de etapas/postos do pós-máquina.
create table if not exists public.etapas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null check (tipo in ('manual', 'maquina', 'externo', 'inspecao')),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.etapas is
  'Postos pelos quais uma peça passa depois de sair da máquina (ou uma 2ª operação em máquina).';
comment on column public.etapas.tipo is
  'manual = posto físico (rebarbação, lavagem...); maquina = gera OP de 2ª operação; externo = tratamento com fornecedor; inspecao = usa o módulo de qualidade.';

-- 2) Catálogos simples: tratamentos externos, fornecedores, motivos de refugo.
create table if not exists public.tratamentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  contato text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.motivos_refugo (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3) Roteiro da peça: lista ordenada de etapas pós-máquina.
--    maquina_id só é usado (e exigido pela aplicação) quando etapas.tipo = 'maquina';
--    tratamento_id só é usado (e exigido pela aplicação) quando etapas.tipo = 'externo'.
create table if not exists public.peca_roteiro_etapas (
  id uuid primary key default gen_random_uuid(),
  peca_id uuid not null references public.pecas (id) on delete cascade,
  etapa_id uuid not null references public.etapas (id),
  ordem integer not null,
  maquina_id uuid references public.maquinas (id),
  tratamento_id uuid references public.tratamentos (id),
  created_at timestamptz not null default now()
);

create index if not exists peca_roteiro_etapas_peca_idx on public.peca_roteiro_etapas (peca_id, ordem);

-- 4) Plano de medição da peça: lista de cotas a inspecionar.
--    eh_atributo = true -> cota tipo OK/NOK (ex.: teste funcional), sem nominal/mínimo/máximo.
create table if not exists public.peca_plano_medicao_cotas (
  id uuid primary key default gen_random_uuid(),
  peca_id uuid not null references public.pecas (id) on delete cascade,
  ordem integer not null,
  tipo text not null,
  eh_atributo boolean not null default false,
  nominal numeric(12, 4),
  minimo numeric(12, 4),
  maximo numeric(12, 4),
  instrumento text,
  frequencia text,
  created_at timestamptz not null default now()
);

create index if not exists peca_plano_medicao_cotas_peca_idx on public.peca_plano_medicao_cotas (peca_id, ordem);

-- 5) Desenho técnico anexado à peça (um arquivo atual por peça, substituível).
alter table public.pecas
  add column if not exists desenho_path text,
  add column if not exists desenho_content_type text;

-- 6) RLS: leitura para todo autenticado, escrita só gestor (mesmo padrão do resto do app).
alter table public.etapas enable row level security;
alter table public.tratamentos enable row level security;
alter table public.fornecedores enable row level security;
alter table public.motivos_refugo enable row level security;
alter table public.peca_roteiro_etapas enable row level security;
alter table public.peca_plano_medicao_cotas enable row level security;

create policy "etapas_select_autenticados" on public.etapas for select to authenticated using (true);
create policy "etapas_write_gestor" on public.etapas for all to authenticated using (public.is_gestor()) with check (public.is_gestor());

create policy "tratamentos_select_autenticados" on public.tratamentos for select to authenticated using (true);
create policy "tratamentos_write_gestor" on public.tratamentos for all to authenticated using (public.is_gestor()) with check (public.is_gestor());

create policy "fornecedores_select_autenticados" on public.fornecedores for select to authenticated using (true);
create policy "fornecedores_write_gestor" on public.fornecedores for all to authenticated using (public.is_gestor()) with check (public.is_gestor());

create policy "motivos_refugo_select_autenticados" on public.motivos_refugo for select to authenticated using (true);
create policy "motivos_refugo_write_gestor" on public.motivos_refugo for all to authenticated using (public.is_gestor()) with check (public.is_gestor());

create policy "peca_roteiro_etapas_select_autenticados" on public.peca_roteiro_etapas for select to authenticated using (true);
create policy "peca_roteiro_etapas_write_gestor" on public.peca_roteiro_etapas for all to authenticated using (public.is_gestor()) with check (public.is_gestor());

create policy "peca_plano_medicao_cotas_select_autenticados" on public.peca_plano_medicao_cotas for select to authenticated using (true);
create policy "peca_plano_medicao_cotas_write_gestor" on public.peca_plano_medicao_cotas for all to authenticated using (public.is_gestor()) with check (public.is_gestor());

-- 7) Espaço de armazenamento (bucket) pra guardar o desenho técnico (PNG/JPG/PDF).
--    Público pra leitura (precisa abrir o link direto na Ficha da OP depois); só gestor escreve.
insert into storage.buckets (id, name, public)
values ('desenhos', 'desenhos', true)
on conflict (id) do nothing;

create policy "desenhos_select_publico" on storage.objects
  for select using (bucket_id = 'desenhos');

create policy "desenhos_write_gestor" on storage.objects
  for all to authenticated
  using (bucket_id = 'desenhos' and public.is_gestor())
  with check (bucket_id = 'desenhos' and public.is_gestor());

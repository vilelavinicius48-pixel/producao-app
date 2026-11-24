-- =============================================================================
-- 0009 — PCP: carteira de pedidos, OP planejada com checklist de preparação,
-- fila por máquina e estoque de peças prontas.
-- =============================================================================

-- 1) Peças importadas da carteira entram sem tempo padrão ("cadastro pendente").
alter table public.pecas alter column tempo_padrao_segundos drop not null;
alter table public.ordens_producao alter column tempo_estimado_segundos drop not null;

-- 2) As 12 máquinas da programação (não duplica códigos já cadastrados).
insert into public.maquinas (codigo, nome) values
  ('XP16', 'XP16'),
  ('GL-240', 'GL-240'),
  ('XE20', 'XE20'),
  ('XE26', 'XE26'),
  ('INDEX', 'INDEX'),
  ('MACH 9', 'MACH 9'),
  ('SIEMENS', 'SIEMENS'),
  ('TN01', 'TN01'),
  ('TNL02', 'TNL02'),
  ('NOMURA', 'NOMURA'),
  ('EUROSTEC', 'EUROSTEC'),
  ('D600', 'D600')
on conflict (codigo) do nothing;

-- 3) Carteira de pedidos (cada linha do relatório "Pedidos em aberto").
create table if not exists public.pedido_itens (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique, -- nº pedido | código | data de entrega
  cliente text not null,
  numero_pedido text not null,
  pedido_compra text,
  data_pedido date,
  data_entrega date not null,
  codigo_produto text not null,
  descricao text not null,
  quantidade numeric(14, 4) not null,
  peca_id uuid references public.pecas (id),
  empresa text, -- "Empresa Grupo" do relatório (R.P. Vilela ou Vilela Indústria)
  status text not null default 'aberto' check (status in ('aberto', 'encerrado')),
  encerrado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.pedido_itens is
  'Linhas da carteira importada do sistema. encerrado = saiu da carteira numa importação (entregue/cancelado).';

create index if not exists pedido_itens_status_entrega_idx on public.pedido_itens (status, data_entrega);
create index if not exists pedido_itens_peca_idx on public.pedido_itens (peca_id);

create table if not exists public.importacoes_pedidos (
  id uuid primary key default gen_random_uuid(),
  arquivo text,
  linhas integer not null default 0,
  novos integer not null default 0,
  alterados integer not null default 0,
  encerrados integer not null default 0,
  reabertos integer not null default 0,
  criado_por uuid references public.operadores (id),
  created_at timestamptz not null default now()
);

-- 4) OP: novo estado "planejada" (antes de ser liberada) + preparação + fila.
--    'aberta' passa a significar "liberada para produção".
alter table public.ordens_producao drop constraint if exists ordens_producao_status_check;
alter table public.ordens_producao
  add constraint ordens_producao_status_check
  check (status in ('planejada', 'aberta', 'setup', 'em_producao', 'parada', 'concluida'));

alter table public.ordens_producao
  add column if not exists pedido_item_id uuid references public.pedido_itens (id) on delete set null,
  add column if not exists sequencia integer,
  add column if not exists material_status text not null default 'pendente',
  add column if not exists ferramenta_status text not null default 'pendente',
  add column if not exists dispositivo_status text not null default 'pendente',
  add column if not exists programa_status text not null default 'pendente',
  add column if not exists previsao_material date,
  add column if not exists obs_pcp text,
  add column if not exists liberada_em timestamptz;

alter table public.ordens_producao
  add constraint ordens_producao_preparacao_check check (
    material_status in ('pendente', 'aguardando', 'ok', 'na')
    and ferramenta_status in ('pendente', 'aguardando', 'ok', 'na')
    and dispositivo_status in ('pendente', 'aguardando', 'ok', 'na')
    and programa_status in ('pendente', 'aguardando', 'ok', 'na')
  );

-- OPs que já existiam foram geradas pelo fluxo antigo: considera tudo pronto.
update public.ordens_producao
set material_status = 'ok', ferramenta_status = 'ok', dispositivo_status = 'ok', programa_status = 'ok',
    liberada_em = created_at
where status <> 'planejada' and liberada_em is null;

create index if not exists ordens_producao_pedido_item_idx on public.ordens_producao (pedido_item_id);
create index if not exists ordens_producao_fila_idx on public.ordens_producao (maquina_id, sequencia);

-- 5) Estoque de peças prontas (movimentos com sinal: entrada +, saída −, ajuste ±).
create table if not exists public.estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  peca_id uuid not null references public.pecas (id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'saida', 'ajuste')),
  quantidade numeric(14, 4) not null,
  observacao text,
  criado_por uuid references public.operadores (id),
  created_at timestamptz not null default now()
);

create index if not exists estoque_movimentos_peca_idx on public.estoque_movimentos (peca_id);

create or replace view public.estoque_pecas
with (security_invoker = true) as
select peca_id, sum(quantidade) as saldo, max(created_at) as atualizado_em
from public.estoque_movimentos
group by peca_id;

grant select on public.estoque_pecas to authenticated;

-- 6) RLS: todos autenticados leem; só gestor escreve.
alter table public.pedido_itens enable row level security;
alter table public.importacoes_pedidos enable row level security;
alter table public.estoque_movimentos enable row level security;

create policy "pedido_itens_select_autenticados" on public.pedido_itens
  for select to authenticated using (true);
create policy "pedido_itens_write_gestor" on public.pedido_itens
  for all to authenticated using (public.is_gestor()) with check (public.is_gestor());

create policy "importacoes_select_autenticados" on public.importacoes_pedidos
  for select to authenticated using (true);
create policy "importacoes_write_gestor" on public.importacoes_pedidos
  for all to authenticated using (public.is_gestor()) with check (public.is_gestor());

create policy "estoque_mov_select_autenticados" on public.estoque_movimentos
  for select to authenticated using (true);
create policy "estoque_mov_write_gestor" on public.estoque_movimentos
  for all to authenticated using (public.is_gestor()) with check (public.is_gestor());

-- Excluir OP planejada por engano (só gestor, só se nunca foi iniciada).
create policy "op_delete_gestor_planejada" on public.ordens_producao
  for delete to authenticated using (public.is_gestor() and status = 'planejada');

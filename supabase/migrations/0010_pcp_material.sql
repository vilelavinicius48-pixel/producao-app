-- =============================================================================
-- 0010 — PCP: controle de material (barra/chapa), estoque em metros/folhas,
-- pedidos de compra com previsão de chegada e status automático na OP.
-- =============================================================================

-- 1) Catálogo de materiais. "formato" decide o que medida_a/medida_b/espessura
--    significam (ver lib/pcp/material.ts para a descrição por extenso):
--      redonda     -> medida_a = diâmetro
--      sextavada   -> medida_a = medida entre faces
--      quadrada    -> medida_a = lado
--      retangular  -> medida_a = largura, medida_b = altura
--      tubo        -> medida_a = diâmetro externo, medida_b = diâmetro interno
--      chapa       -> medida_a = largura da folha, medida_b = comprimento da folha,
--                      espessura_mm = espessura
create table if not exists public.materiais (
  id uuid primary key default gen_random_uuid(),
  formato text not null check (formato in ('redonda', 'sextavada', 'quadrada', 'retangular', 'tubo', 'chapa')),
  tipo text not null,
  medida_a_mm numeric(10, 2) not null,
  medida_b_mm numeric(10, 2),
  espessura_mm numeric(10, 2),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.materiais is
  'Catálogo de materiais (barra ou chapa). Barra é controlada em metros; chapa, em folhas.';

-- 2) Máquina: tamanho da barra que ela usa e a sobra de ponta que não dá pra aproveitar.
--    Não se aplica a máquinas que não trabalham com barra (ficam nulas).
alter table public.maquinas
  add column if not exists barra_comprimento_mm numeric(10, 2),
  add column if not exists barra_sobra_mm numeric(10, 2) not null default 0;

-- 3) Peça: qual material ela usa e como calcular quantas peças saem de 1 barra/folha.
--    comprimento_consumido_mm -> formatos em barra (já inclui corte/sangria).
--    pecas_por_folha -> formato chapa (informado pelo usuário; o corte de chapa
--      segue um desenho de aproveitamento que o sistema não calcula sozinho).
alter table public.pecas
  add column if not exists material_id uuid references public.materiais (id) on delete set null,
  add column if not exists comprimento_consumido_mm numeric(10, 2),
  add column if not exists pecas_por_folha integer;

-- 4) OP: snapshot do material e da conta (quantidade pedida pode mudar o cadastro
--    da peça depois; a OP guarda o que valia quando foi criada/teve a máquina trocada,
--    do mesmo jeito que tempo_estimado_segundos já funciona).
alter table public.ordens_producao
  add column if not exists material_id uuid references public.materiais (id) on delete set null,
  add column if not exists material_barras_necessarias integer,
  add column if not exists material_folhas_necessarias integer,
  add column if not exists material_metros_necessarios numeric(12, 3),
  add column if not exists material_status_manual boolean not null default false;

comment on column public.ordens_producao.material_status_manual is
  'true = gestor editou o status do material na mão; o recálculo automático passa a ignorar esta OP até "Recalcular automático".';

-- 5) Estoque de material (entrada/saida/ajuste). Unidade = metros (barra) ou folhas (chapa),
--    conforme materiais.formato.
create table if not exists public.estoque_material_movimentos (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materiais (id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'saida', 'ajuste')),
  quantidade numeric(12, 3) not null,
  observacao text,
  criado_por uuid references public.operadores (id),
  created_at timestamptz not null default now()
);

create index if not exists estoque_material_movimentos_material_idx on public.estoque_material_movimentos (material_id);

create or replace view public.estoque_materiais
with (security_invoker = true) as
select material_id, sum(quantidade) as saldo, max(created_at) as atualizado_em
from public.estoque_material_movimentos
group by material_id;

grant select on public.estoque_materiais to authenticated;

-- 6) Pedido de compra de material. Ao marcar "recebido", o app lança a entrada
--    correspondente em estoque_material_movimentos (quantidade_recebida pode ser
--    diferente da pedida, para entrega parcial).
create table if not exists public.pedidos_compra_material (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materiais (id),
  quantidade numeric(12, 3) not null,
  quantidade_recebida numeric(12, 3),
  fornecedor text not null,
  data_pedido date not null default current_date,
  previsao_chegada date,
  status text not null default 'pedido' check (status in ('pedido', 'recebido', 'cancelado')),
  recebido_em timestamptz,
  criado_por uuid references public.operadores (id),
  created_at timestamptz not null default now()
);

create index if not exists pedidos_compra_material_material_idx on public.pedidos_compra_material (material_id, status);

-- 7) RLS: todos autenticados leem; só gestor escreve (mesmo padrão do resto do PCP).
alter table public.materiais enable row level security;
alter table public.estoque_material_movimentos enable row level security;
alter table public.pedidos_compra_material enable row level security;

create policy "materiais_select_autenticados" on public.materiais
  for select to authenticated using (true);
create policy "materiais_write_gestor" on public.materiais
  for all to authenticated using (public.is_gestor()) with check (public.is_gestor());

create policy "estoque_material_select_autenticados" on public.estoque_material_movimentos
  for select to authenticated using (true);
create policy "estoque_material_write_gestor" on public.estoque_material_movimentos
  for all to authenticated using (public.is_gestor()) with check (public.is_gestor());

create policy "pedidos_compra_material_select_autenticados" on public.pedidos_compra_material
  for select to authenticated using (true);
create policy "pedidos_compra_material_write_gestor" on public.pedidos_compra_material
  for all to authenticated using (public.is_gestor()) with check (public.is_gestor());

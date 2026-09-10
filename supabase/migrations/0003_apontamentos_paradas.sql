-- ============================================================================
-- Fase 3 + 4: apontamentos (start/stop) e paradas (parada/voltar), com trava
-- de recurso exclusivo por OP e por máquina, atômica no banco.
-- ============================================================================

create table if not exists public.apontamentos (
  id uuid primary key default gen_random_uuid(),
  op_id uuid not null references public.ordens_producao (id),
  operador_id uuid not null references public.operadores (id),
  timestamp_start timestamptz not null default now(),
  timestamp_stop timestamptz,
  quantidade_produzida numeric(12, 4),
  quantidade_refugada numeric(12, 4),
  eficiencia numeric(12, 4)
);

create index if not exists apontamentos_op_id_idx on public.apontamentos (op_id);

-- só pode existir 1 apontamento aberto por OP ao mesmo tempo (defesa extra,
-- além da regra de status aplicada nas funções abaixo)
create unique index if not exists apontamentos_op_aberto_idx
  on public.apontamentos (op_id)
  where timestamp_stop is null;

create table if not exists public.paradas (
  id uuid primary key default gen_random_uuid(),
  op_id uuid not null references public.ordens_producao (id),
  timestamp_inicio timestamptz not null default now(),
  timestamp_fim timestamptz,
  motivo_id uuid references public.motivos_parada (id)
);

create index if not exists paradas_op_id_idx on public.paradas (op_id);

alter table public.apontamentos enable row level security;
alter table public.paradas enable row level security;

create policy "apontamentos_select_autenticados" on public.apontamentos
  for select to authenticated using (true);

create policy "paradas_select_autenticados" on public.paradas
  for select to authenticated using (true);

-- Sem policies de insert/update para apontamentos/paradas: toda escrita
-- passa pelas funções abaixo (security definer, dono = postgres, ignoram RLS).

-- ----------------------------------------------------------------------------
-- iniciar_apontamento: Start. OP precisa estar 'aberta'.
-- ----------------------------------------------------------------------------
create or replace function public.iniciar_apontamento(p_op_id uuid)
returns public.apontamentos
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_op public.ordens_producao%rowtype;
  v_apontamento public.apontamentos%rowtype;
begin
  select * into v_op from public.ordens_producao where id = p_op_id for update;

  if not found then
    raise exception 'OP nao encontrada';
  end if;

  if v_op.status <> 'aberta' then
    raise exception 'OP nao esta disponivel para iniciar (status atual: %)', v_op.status;
  end if;

  insert into public.apontamentos (op_id, operador_id, timestamp_start)
  values (p_op_id, auth.uid(), now())
  returning * into v_apontamento;

  update public.ordens_producao set status = 'em_producao' where id = p_op_id;

  return v_apontamento;
end;
$fn$;

grant execute on function public.iniciar_apontamento(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- parar_producao: Stop. Fecha apontamento com quantidades; encerra a OP
-- ('concluida' se atingiu a quantidade planejada, senao volta a 'aberta').
-- ----------------------------------------------------------------------------
create or replace function public.parar_producao(
  p_apontamento_id uuid,
  p_quantidade_produzida numeric,
  p_quantidade_refugada numeric
)
returns public.apontamentos
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_apontamento public.apontamentos%rowtype;
  v_op public.ordens_producao%rowtype;
  v_peca public.pecas%rowtype;
  v_tempo_real_minutos numeric;
  v_total_produzido numeric;
begin
  if p_quantidade_produzida is null or p_quantidade_produzida < 0
     or p_quantidade_refugada is null or p_quantidade_refugada < 0 then
    raise exception 'Quantidade produzida e refugada devem ser informadas e nao negativas';
  end if;

  select * into v_apontamento from public.apontamentos where id = p_apontamento_id for update;
  if not found then
    raise exception 'Apontamento nao encontrado';
  end if;
  if v_apontamento.timestamp_stop is not null then
    raise exception 'Apontamento ja esta encerrado';
  end if;

  select * into v_op from public.ordens_producao where id = v_apontamento.op_id for update;
  select * into v_peca from public.pecas where id = v_op.peca_id;

  v_tempo_real_minutos := greatest(extract(epoch from (now() - v_apontamento.timestamp_start)) / 60.0, 0.0001);

  update public.apontamentos
  set timestamp_stop = now(),
      quantidade_produzida = p_quantidade_produzida,
      quantidade_refugada = p_quantidade_refugada,
      eficiencia = (v_peca.tempo_padrao_por_unidade * p_quantidade_produzida) / v_tempo_real_minutos
  where id = p_apontamento_id
  returning * into v_apontamento;

  select coalesce(sum(quantidade_produzida), 0) into v_total_produzido
  from public.apontamentos where op_id = v_op.id;

  if v_total_produzido >= v_op.quantidade_planejada then
    update public.ordens_producao set status = 'concluida', concluida_em = now() where id = v_op.id;
  else
    update public.ordens_producao set status = 'aberta' where id = v_op.id;
  end if;

  return v_apontamento;
end;
$fn$;

grant execute on function public.parar_producao(uuid, numeric, numeric) to authenticated;

-- ----------------------------------------------------------------------------
-- pausar_producao: Parada. Fecha apontamento com quantidades (produção real
-- ate a pausa), marca OP como 'parada' e abre um registro de parada sem motivo.
-- ----------------------------------------------------------------------------
create or replace function public.pausar_producao(
  p_apontamento_id uuid,
  p_quantidade_produzida numeric,
  p_quantidade_refugada numeric
)
returns public.apontamentos
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_apontamento public.apontamentos%rowtype;
  v_op public.ordens_producao%rowtype;
  v_peca public.pecas%rowtype;
  v_tempo_real_minutos numeric;
begin
  if p_quantidade_produzida is null or p_quantidade_produzida < 0
     or p_quantidade_refugada is null or p_quantidade_refugada < 0 then
    raise exception 'Quantidade produzida e refugada devem ser informadas e nao negativas';
  end if;

  select * into v_apontamento from public.apontamentos where id = p_apontamento_id for update;
  if not found then
    raise exception 'Apontamento nao encontrado';
  end if;
  if v_apontamento.timestamp_stop is not null then
    raise exception 'Apontamento ja esta encerrado';
  end if;

  select * into v_op from public.ordens_producao where id = v_apontamento.op_id for update;
  select * into v_peca from public.pecas where id = v_op.peca_id;

  v_tempo_real_minutos := greatest(extract(epoch from (now() - v_apontamento.timestamp_start)) / 60.0, 0.0001);

  update public.apontamentos
  set timestamp_stop = now(),
      quantidade_produzida = p_quantidade_produzida,
      quantidade_refugada = p_quantidade_refugada,
      eficiencia = (v_peca.tempo_padrao_por_unidade * p_quantidade_produzida) / v_tempo_real_minutos
  where id = p_apontamento_id
  returning * into v_apontamento;

  update public.ordens_producao set status = 'parada' where id = v_op.id;

  insert into public.paradas (op_id, timestamp_inicio) values (v_op.id, now());

  return v_apontamento;
end;
$fn$;

grant execute on function public.pausar_producao(uuid, numeric, numeric) to authenticated;

-- ----------------------------------------------------------------------------
-- voltar_parada: pede motivo, fecha a parada aberta e inicia novo apontamento
-- automaticamente na mesma OP.
-- ----------------------------------------------------------------------------
create or replace function public.voltar_parada(p_op_id uuid, p_motivo_id uuid)
returns public.apontamentos
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_op public.ordens_producao%rowtype;
  v_parada public.paradas%rowtype;
  v_apontamento public.apontamentos%rowtype;
begin
  if p_motivo_id is null then
    raise exception 'Motivo da parada e obrigatorio';
  end if;

  select * into v_op from public.ordens_producao where id = p_op_id for update;
  if not found then
    raise exception 'OP nao encontrada';
  end if;
  if v_op.status <> 'parada' then
    raise exception 'OP nao esta parada (status atual: %)', v_op.status;
  end if;

  select * into v_parada from public.paradas
  where op_id = p_op_id and timestamp_fim is null
  order by timestamp_inicio desc
  limit 1
  for update;

  if not found then
    raise exception 'Nenhuma parada em aberto encontrada para esta OP';
  end if;

  update public.paradas
  set timestamp_fim = now(), motivo_id = p_motivo_id
  where id = v_parada.id;

  insert into public.apontamentos (op_id, operador_id, timestamp_start)
  values (p_op_id, auth.uid(), now())
  returning * into v_apontamento;

  update public.ordens_producao set status = 'em_producao' where id = p_op_id;

  return v_apontamento;
end;
$fn$;

grant execute on function public.voltar_parada(uuid, uuid) to authenticated;

alter publication supabase_realtime add table public.apontamentos;
alter publication supabase_realtime add table public.paradas;

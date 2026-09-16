-- ============================================================================
-- Etapa de Setup: primeira acao obrigatoria de uma OP nova, antes do
-- primeiro apontamento de producao. Fica marcada como tempo (setups),
-- aparece como status 'setup' (azul) no dashboard, e ao finalizar inicia
-- automaticamente um apontamento de producao (igual ao voltar de parada).
-- ============================================================================

alter table public.ordens_producao add column if not exists setup_concluido_em timestamptz;

-- OPs que ja tem algum apontamento sao tratadas como "setup ja feito"
-- (nao existiam antes desse recurso, entao nao devem ser bloqueadas).
update public.ordens_producao op
set setup_concluido_em = now()
where setup_concluido_em is null
  and exists (select 1 from public.apontamentos a where a.op_id = op.id);

alter table public.ordens_producao drop constraint if exists ordens_producao_status_check;
alter table public.ordens_producao
  add constraint ordens_producao_status_check
  check (status in ('aberta', 'setup', 'em_producao', 'parada', 'concluida'));

-- trava de maquina precisa cobrir tambem o status 'setup'
drop index if exists ordens_producao_maquina_ativa_idx;
create unique index ordens_producao_maquina_ativa_idx
  on public.ordens_producao (maquina_id)
  where status in ('setup', 'em_producao', 'parada');

create table if not exists public.setups (
  id uuid primary key default gen_random_uuid(),
  op_id uuid not null references public.ordens_producao (id),
  operador_id uuid not null references public.operadores (id),
  timestamp_inicio timestamptz not null default now(),
  timestamp_fim timestamptz
);

create index if not exists setups_op_id_idx on public.setups (op_id);
create unique index if not exists setups_op_aberto_idx
  on public.setups (op_id)
  where timestamp_fim is null;

alter table public.setups enable row level security;

create policy "setups_select_autenticados" on public.setups
  for select to authenticated using (true);

-- ----------------------------------------------------------------------------
-- iniciar_setup: primeira acao de uma OP nova. Exige status 'aberta' e
-- setup ainda nao concluido.
-- ----------------------------------------------------------------------------
create or replace function public.iniciar_setup(p_op_id uuid, p_operador_id uuid)
returns public.setups
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_op public.ordens_producao%rowtype;
  v_setup public.setups%rowtype;
  v_operador_valido boolean;
begin
  select exists(
    select 1 from public.operadores
    where id = p_operador_id and perfil = 'operador' and ativo = true
  ) into v_operador_valido;

  if not v_operador_valido then
    raise exception 'Operador invalido ou inativo';
  end if;

  select * into v_op from public.ordens_producao where id = p_op_id for update;

  if not found then
    raise exception 'OP nao encontrada';
  end if;

  if v_op.status <> 'aberta' then
    raise exception 'OP nao esta disponivel para iniciar setup (status atual: %)', v_op.status;
  end if;

  if v_op.setup_concluido_em is not null then
    raise exception 'Setup desta OP ja foi concluido';
  end if;

  insert into public.setups (op_id, operador_id, timestamp_inicio)
  values (p_op_id, p_operador_id, now())
  returning * into v_setup;

  update public.ordens_producao set status = 'setup' where id = p_op_id;

  return v_setup;
end;
$fn$;

grant execute on function public.iniciar_setup(uuid, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- finalizar_setup: fecha o setup e ja inicia um apontamento de producao
-- automaticamente, com o mesmo operador que fez o setup.
-- ----------------------------------------------------------------------------
create or replace function public.finalizar_setup(p_setup_id uuid)
returns public.apontamentos
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_setup public.setups%rowtype;
  v_op public.ordens_producao%rowtype;
  v_apontamento public.apontamentos%rowtype;
begin
  select * into v_setup from public.setups where id = p_setup_id for update;
  if not found then
    raise exception 'Setup nao encontrado';
  end if;
  if v_setup.timestamp_fim is not null then
    raise exception 'Setup ja esta encerrado';
  end if;

  select * into v_op from public.ordens_producao where id = v_setup.op_id for update;
  if v_op.status <> 'setup' then
    raise exception 'OP nao esta em setup (status atual: %)', v_op.status;
  end if;

  update public.setups set timestamp_fim = now() where id = p_setup_id;

  insert into public.apontamentos (op_id, operador_id, timestamp_start)
  values (v_op.id, v_setup.operador_id, now())
  returning * into v_apontamento;

  update public.ordens_producao
  set status = 'em_producao', setup_concluido_em = now()
  where id = v_op.id;

  return v_apontamento;
end;
$fn$;

grant execute on function public.finalizar_setup(uuid) to authenticated;

alter publication supabase_realtime add table public.setups;

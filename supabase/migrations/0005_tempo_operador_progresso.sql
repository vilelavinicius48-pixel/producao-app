-- ============================================================================
-- Ajustes de negocio:
-- 1) tempo padrao da peca vira "tempo" de verdade (segundos), nao mais um
--    numero decimal de minutos digitado como texto
-- 2) apontamento passa a ter selecao explicita de operador (varios
--    operadores usam o mesmo tablet/maquina, nao ha login individual por
--    apontamento) em vez de usar auth.uid()
-- 3) view de progresso agregada por OP (produzido/refugado total), usada no
--    dashboard e nas telas de OP
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) tempo em segundos
-- ----------------------------------------------------------------------------
alter table public.pecas add column if not exists tempo_padrao_segundos integer;
update public.pecas
  set tempo_padrao_segundos = round(tempo_padrao_por_unidade * 60)
  where tempo_padrao_segundos is null;
alter table public.pecas alter column tempo_padrao_segundos set not null;
alter table public.pecas add constraint pecas_tempo_padrao_segundos_check check (tempo_padrao_segundos > 0);
alter table public.pecas drop column tempo_padrao_por_unidade;

alter table public.ordens_producao add column if not exists tempo_estimado_segundos numeric(14, 2);
update public.ordens_producao
  set tempo_estimado_segundos = tempo_estimado_minutos * 60
  where tempo_estimado_segundos is null;
alter table public.ordens_producao alter column tempo_estimado_segundos set not null;
alter table public.ordens_producao drop column tempo_estimado_minutos;

-- ----------------------------------------------------------------------------
-- 2) view de progresso por OP
-- ----------------------------------------------------------------------------
create or replace view public.op_progresso as
select
  op_id,
  coalesce(sum(quantidade_produzida), 0) as quantidade_produzida_total,
  coalesce(sum(quantidade_refugada), 0) as quantidade_refugada_total
from public.apontamentos
where timestamp_stop is not null
group by op_id;

grant select on public.op_progresso to authenticated;

-- ----------------------------------------------------------------------------
-- 3) RPCs: recriar aceitando operador explicito e usando segundos
-- ----------------------------------------------------------------------------
drop function if exists public.iniciar_apontamento(uuid);
create or replace function public.iniciar_apontamento(p_op_id uuid, p_operador_id uuid)
returns public.apontamentos
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_op public.ordens_producao%rowtype;
  v_apontamento public.apontamentos%rowtype;
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
    raise exception 'OP nao esta disponivel para iniciar (status atual: %)', v_op.status;
  end if;

  insert into public.apontamentos (op_id, operador_id, timestamp_start)
  values (p_op_id, p_operador_id, now())
  returning * into v_apontamento;

  update public.ordens_producao set status = 'em_producao' where id = p_op_id;

  return v_apontamento;
end;
$fn$;

grant execute on function public.iniciar_apontamento(uuid, uuid) to authenticated;

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
  v_tempo_real_segundos numeric;
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

  v_tempo_real_segundos := greatest(extract(epoch from (now() - v_apontamento.timestamp_start)), 0.01);

  update public.apontamentos
  set timestamp_stop = now(),
      quantidade_produzida = p_quantidade_produzida,
      quantidade_refugada = p_quantidade_refugada,
      eficiencia = (v_peca.tempo_padrao_segundos * p_quantidade_produzida) / v_tempo_real_segundos
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
  v_tempo_real_segundos numeric;
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

  v_tempo_real_segundos := greatest(extract(epoch from (now() - v_apontamento.timestamp_start)), 0.01);

  update public.apontamentos
  set timestamp_stop = now(),
      quantidade_produzida = p_quantidade_produzida,
      quantidade_refugada = p_quantidade_refugada,
      eficiencia = (v_peca.tempo_padrao_segundos * p_quantidade_produzida) / v_tempo_real_segundos
  where id = p_apontamento_id
  returning * into v_apontamento;

  update public.ordens_producao set status = 'parada' where id = v_op.id;

  insert into public.paradas (op_id, timestamp_inicio) values (v_op.id, now());

  return v_apontamento;
end;
$fn$;

drop function if exists public.voltar_parada(uuid, uuid);
create or replace function public.voltar_parada(p_op_id uuid, p_motivo_id uuid, p_operador_id uuid)
returns public.apontamentos
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_op public.ordens_producao%rowtype;
  v_parada public.paradas%rowtype;
  v_apontamento public.apontamentos%rowtype;
  v_operador_valido boolean;
begin
  if p_motivo_id is null then
    raise exception 'Motivo da parada e obrigatorio';
  end if;

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
  values (p_op_id, p_operador_id, now())
  returning * into v_apontamento;

  update public.ordens_producao set status = 'em_producao' where id = p_op_id;

  return v_apontamento;
end;
$fn$;

grant execute on function public.voltar_parada(uuid, uuid, uuid) to authenticated;

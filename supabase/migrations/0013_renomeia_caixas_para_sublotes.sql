-- =============================================================================
-- 0013 — Renomeia "caixa" para "sublote" em todo o banco: a peça circula num
-- saquinho com etiqueta de papel, não numa caixa — "sublote" descreve melhor.
-- Puro renome, sem mudar nenhum comportamento.
-- =============================================================================

alter table public.caixas rename to sublotes;
alter table public.caixa_etapas rename to sublote_etapas;
alter table public.sublote_etapas rename column caixa_id to sublote_id;

alter policy "caixas_select_autenticados" on public.sublotes rename to "sublotes_select_autenticados";
alter policy "caixa_etapas_select_autenticados" on public.sublote_etapas rename to "sublote_etapas_select_autenticados";

comment on table public.sublotes is
  'Sublote: o que sai da máquina de uma vez (um apontamento fechado = um sublote), identificado na prática por OP + operador + horário — o saquinho com a etiqueta escrita à mão.';
comment on column public.sublotes.qualidade_status is
  'Cor da etiqueta do sublote: em_processo (branca, antes da inspeção) · aprovado (verde) · reprovado (rosa) · retrabalho (amarela).';
comment on table public.sublote_etapas is
  'Histórico: cada passagem de um sublote por uma etapa do roteiro (rastreabilidade).';

alter function public.criar_caixa_apos_apontamento(uuid) rename to criar_sublote_apos_apontamento;

create or replace function public.criar_sublote_apos_apontamento(p_apontamento_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_apontamento public.apontamentos%rowtype;
  v_op public.ordens_producao%rowtype;
  v_primeira_etapa public.peca_roteiro_etapas%rowtype;
  v_sublote_id uuid;
begin
  select * into v_apontamento from public.apontamentos where id = p_apontamento_id;
  if not found or v_apontamento.quantidade_produzida is null or v_apontamento.quantidade_produzida <= 0 then
    return;
  end if;

  select * into v_op from public.ordens_producao where id = v_apontamento.op_id;

  select * into v_primeira_etapa
  from public.peca_roteiro_etapas
  where peca_id = v_op.peca_id
  order by ordem
  limit 1;

  insert into public.sublotes (
    op_id, apontamento_id, peca_id, maquina_id, quantidade, quantidade_original,
    operador_id, horario, roteiro_atual_id, status
  )
  values (
    v_op.id, v_apontamento.id, v_op.peca_id, v_op.maquina_id,
    v_apontamento.quantidade_produzida, v_apontamento.quantidade_produzida,
    v_apontamento.operador_id, v_apontamento.timestamp_stop,
    v_primeira_etapa.id,
    case when v_primeira_etapa.id is null then 'concluida' else 'aguardando_etapa' end
  )
  returning id into v_sublote_id;

  if v_primeira_etapa.id is not null then
    insert into public.sublote_etapas (sublote_id, peca_roteiro_etapa_id, etapa_id, status)
    values (v_sublote_id, v_primeira_etapa.id, v_primeira_etapa.etapa_id, 'aguardando');
  else
    insert into public.estoque_movimentos (peca_id, tipo, quantidade, observacao, criado_por)
    values (
      v_op.peca_id, 'entrada', v_apontamento.quantidade_produzida,
      'Pós-máquina: peça sem roteiro cadastrado, entrada automática ao sair da máquina',
      v_apontamento.operador_id
    );
  end if;
end;
$fn$;

-- parar_producao/pausar_producao: só troca a chamada no fim pro nome novo.
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

  perform public.criar_sublote_apos_apontamento(v_apontamento.id);

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

  perform public.criar_sublote_apos_apontamento(v_apontamento.id);

  return v_apontamento;
end;
$fn$;

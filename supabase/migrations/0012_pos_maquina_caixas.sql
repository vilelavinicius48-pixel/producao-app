-- =============================================================================
-- 0012 — Pós-máquina, Parte 2 (1/2): caixa (sublote). Toda caixa nasce
-- automaticamente quando um apontamento fecha na máquina (Stop ou Parada),
-- com a quantidade boa daquele apontamento, e já aponta pra 1ª etapa do
-- roteiro da peça. Peça sem roteiro cadastrado: a caixa já nasce "concluida"
-- e entra direto no estoque de peças prontas (não tem pós-máquina pra fazer).
--
-- Ainda NÃO estão aqui (próxima parte): os botões Iniciar/Concluir etapa no
-- celular, a integração com Qualidade como etapa do roteiro, juntar caixas,
-- tratamento externo e a entrada no estoque ao concluir um roteiro de verdade
-- (com etapas). Essas migrações vêm depois.
-- =============================================================================

create table if not exists public.caixas (
  id uuid primary key default gen_random_uuid(),
  op_id uuid not null references public.ordens_producao (id),
  apontamento_id uuid references public.apontamentos (id),
  peca_id uuid not null references public.pecas (id),
  maquina_id uuid not null references public.maquinas (id),
  quantidade numeric(12, 4) not null,
  quantidade_original numeric(12, 4) not null,
  operador_id uuid not null references public.operadores (id),
  horario timestamptz not null,
  roteiro_atual_id uuid references public.peca_roteiro_etapas (id),
  status text not null default 'aguardando_etapa'
    check (status in ('aguardando_etapa', 'em_etapa', 'aguardando_decisao', 'concluida', 'mesclada')),
  qualidade_status text not null default 'em_processo'
    check (qualidade_status in ('em_processo', 'aprovado', 'reprovado', 'retrabalho')),
  mesclada_em_id uuid references public.caixas (id),
  created_at timestamptz not null default now()
);

comment on table public.caixas is
  'Sublote: o que sai da máquina de uma vez (um apontamento fechado = uma caixa), identificado na prática por OP + operador + horário, igual a etiqueta escrita à mão.';
comment on column public.caixas.qualidade_status is
  'Cor da etiqueta da caixa: em_processo (branca, antes da inspeção) · aprovado (verde) · reprovado (rosa) · retrabalho (amarela).';

create index if not exists caixas_op_idx on public.caixas (op_id);
create index if not exists caixas_status_idx on public.caixas (status);
create index if not exists caixas_roteiro_atual_idx on public.caixas (roteiro_atual_id);

create table if not exists public.caixa_etapas (
  id uuid primary key default gen_random_uuid(),
  caixa_id uuid not null references public.caixas (id) on delete cascade,
  peca_roteiro_etapa_id uuid references public.peca_roteiro_etapas (id),
  etapa_id uuid not null references public.etapas (id),
  status text not null default 'aguardando' check (status in ('aguardando', 'em_andamento', 'concluida')),
  operador_inicio_id uuid references public.operadores (id),
  timestamp_inicio timestamptz,
  operador_fim_id uuid references public.operadores (id),
  timestamp_fim timestamptz,
  quantidade_boa numeric(12, 4),
  quantidade_refugo numeric(12, 4),
  motivo_refugo_id uuid references public.motivos_refugo (id),
  observacao text,
  created_at timestamptz not null default now()
);

comment on table public.caixa_etapas is
  'Histórico: cada passagem de uma caixa por uma etapa do roteiro (rastreabilidade).';

create index if not exists caixa_etapas_caixa_idx on public.caixa_etapas (caixa_id);

alter table public.caixas enable row level security;
alter table public.caixa_etapas enable row level security;

create policy "caixas_select_autenticados" on public.caixas for select to authenticated using (true);
create policy "caixa_etapas_select_autenticados" on public.caixa_etapas for select to authenticated using (true);

-- Sem policies de insert/update: toda escrita passa pela função abaixo (e pelas
-- próximas RPCs de iniciar/concluir etapa, na parte seguinte), igual apontamentos/paradas.

-- ----------------------------------------------------------------------------
-- criar_caixa_apos_apontamento: chamada no fim de parar_producao/pausar_producao.
-- ----------------------------------------------------------------------------
create or replace function public.criar_caixa_apos_apontamento(p_apontamento_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_apontamento public.apontamentos%rowtype;
  v_op public.ordens_producao%rowtype;
  v_primeira_etapa public.peca_roteiro_etapas%rowtype;
  v_caixa_id uuid;
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

  insert into public.caixas (
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
  returning id into v_caixa_id;

  if v_primeira_etapa.id is not null then
    insert into public.caixa_etapas (caixa_id, peca_roteiro_etapa_id, etapa_id, status)
    values (v_caixa_id, v_primeira_etapa.id, v_primeira_etapa.etapa_id, 'aguardando');
  else
    -- peça sem roteiro pós-máquina: já está pronta ao sair da máquina.
    insert into public.estoque_movimentos (peca_id, tipo, quantidade, observacao, criado_por)
    values (
      v_op.peca_id, 'entrada', v_apontamento.quantidade_produzida,
      'Pós-máquina: peça sem roteiro cadastrado, entrada automática ao sair da máquina',
      v_apontamento.operador_id
    );
  end if;
end;
$fn$;

-- parar_producao e pausar_producao recriadas só para chamar a função acima no fim
-- (mesma assinatura e corpo de antes, só com essa chamada a mais).
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

  perform public.criar_caixa_apos_apontamento(v_apontamento.id);

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

  perform public.criar_caixa_apos_apontamento(v_apontamento.id);

  return v_apontamento;
end;
$fn$;

alter publication supabase_realtime add table public.caixas;
alter publication supabase_realtime add table public.caixa_etapas;

-- =============================================================================
-- 0014 — Pós-máquina, Parte 3: botões Iniciar/Concluir etapa no celular,
-- geração automática da OP de 2ª operação quando o sublote chega numa etapa
-- "máquina", e a integração da etapa "inspeção" com o módulo de Qualidade que
-- já existe (não muda nada do que já tem lá — só abre uma segunda porta de
-- entrada pra inspeção, agora também por etapa de sublote, além de por
-- apontamento).
-- =============================================================================

-- 1) sublotes.status ganha 'transferida': quando a etapa atual é "máquina", o
--    sublote não fica "concluído" nem "pronto" — ele virou uma nova OP de 2ª
--    operação, e quem continua a história é o sublote que nascer dali.
alter table public.sublotes drop constraint if exists caixas_status_check;
alter table public.sublotes drop constraint if exists sublotes_status_check;
alter table public.sublotes add constraint sublotes_status_check
  check (status in ('aguardando_etapa', 'em_etapa', 'aguardando_decisao', 'concluida', 'mesclada', 'transferida'));

-- 2) ordens_producao: liga a OP de 2ª operação à OP e à etapa do roteiro que a
--    geraram, pra o sublote resultante saber de onde continuar o roteiro.
alter table public.ordens_producao add column if not exists op_origem_id uuid references public.ordens_producao (id);
alter table public.ordens_producao add column if not exists roteiro_etapa_origem_id uuid references public.peca_roteiro_etapas (id);

comment on column public.ordens_producao.op_origem_id is
  'OP original que gerou esta (2ª operação), quando um sublote passa por uma etapa "máquina" do roteiro pós-máquina.';
comment on column public.ordens_producao.roteiro_etapa_origem_id is
  'Etapa do roteiro (tipo máquina) que gerou esta OP — o sublote que nascer daqui continua o roteiro depois dela, não do zero.';

-- 3) inspecoes_qualidade passa a também poder ser ligada a uma etapa de
--    sublote, não só a um apontamento. Nada do fluxo por apontamento muda.
alter table public.inspecoes_qualidade alter column apontamento_id drop not null;
alter table public.inspecoes_qualidade add column if not exists sublote_etapa_id uuid unique
  references public.sublote_etapas (id);
alter table public.inspecoes_qualidade add constraint inspecoes_qualidade_origem_check
  check (
    (apontamento_id is not null and sublote_etapa_id is null)
    or (apontamento_id is null and sublote_etapa_id is not null)
  );

comment on column public.inspecoes_qualidade.sublote_etapa_id is
  'Preenchido quando a inspeção é de uma etapa "inspecao" do roteiro pós-máquina, em vez de um apontamento direto da máquina.';

-- ----------------------------------------------------------------------------
-- 4) avancar_sublote: motor único de "o que acontece quando uma etapa termina".
--    Usado pelo concluir normal e pela inspeção de qualidade por sublote.
-- ----------------------------------------------------------------------------
create or replace function public.avancar_sublote(p_sublote_id uuid, p_quantidade numeric)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_sublote public.sublotes%rowtype;
  v_atual public.peca_roteiro_etapas%rowtype;
  v_proxima public.peca_roteiro_etapas%rowtype;
  v_proxima_etapa public.etapas%rowtype;
begin
  select * into v_sublote from public.sublotes where id = p_sublote_id for update;
  if not found then
    raise exception 'Sublote nao encontrado';
  end if;

  if v_sublote.roteiro_atual_id is not null then
    select * into v_atual from public.peca_roteiro_etapas where id = v_sublote.roteiro_atual_id;
  end if;

  if p_quantidade <= 0 then
    update public.sublotes set quantidade = 0, status = 'concluida', roteiro_atual_id = null where id = p_sublote_id;
    return;
  end if;

  select * into v_proxima
  from public.peca_roteiro_etapas
  where peca_id = v_sublote.peca_id and ordem > coalesce(v_atual.ordem, 0)
  order by ordem
  limit 1;

  if not found then
    update public.sublotes
    set quantidade = p_quantidade, status = 'concluida', roteiro_atual_id = null
    where id = p_sublote_id;

    insert into public.estoque_movimentos (peca_id, tipo, quantidade, observacao, criado_por)
    values (
      v_sublote.peca_id, 'entrada', p_quantidade,
      'Pós-máquina: fim do roteiro, entrada automática no estoque',
      v_sublote.operador_id
    );
    return;
  end if;

  select * into v_proxima_etapa from public.etapas where id = v_proxima.etapa_id;

  update public.sublotes
  set quantidade = p_quantidade,
      roteiro_atual_id = v_proxima.id,
      status = case when v_proxima_etapa.tipo = 'inspecao' then 'em_etapa' else 'aguardando_etapa' end
  where id = p_sublote_id;

  insert into public.sublote_etapas (
    sublote_id, peca_roteiro_etapa_id, etapa_id, status, operador_inicio_id, timestamp_inicio
  )
  values (
    p_sublote_id, v_proxima.id, v_proxima.etapa_id,
    case when v_proxima_etapa.tipo = 'inspecao' then 'em_andamento' else 'aguardando' end,
    case when v_proxima_etapa.tipo = 'inspecao' then v_sublote.operador_id else null end,
    case when v_proxima_etapa.tipo = 'inspecao' then now() else null end
  );
end;
$fn$;

-- ----------------------------------------------------------------------------
-- 5) iniciar_etapa_sublote / concluir_etapa_sublote: ações genéricas pras
--    etapas manual e externo (máquina tem ação própria, mais abaixo; inspeção
--    usa o módulo de Qualidade).
-- ----------------------------------------------------------------------------
create or replace function public.iniciar_etapa_sublote(p_sublote_etapa_id uuid, p_operador_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_etapa public.sublote_etapas%rowtype;
begin
  select * into v_etapa from public.sublote_etapas where id = p_sublote_etapa_id for update;
  if not found then
    raise exception 'Etapa do sublote nao encontrada';
  end if;
  if v_etapa.status <> 'aguardando' then
    raise exception 'Etapa ja foi iniciada ou concluida';
  end if;

  update public.sublote_etapas
  set status = 'em_andamento', operador_inicio_id = p_operador_id, timestamp_inicio = now()
  where id = p_sublote_etapa_id;

  update public.sublotes set status = 'em_etapa' where id = v_etapa.sublote_id;
end;
$fn$;

create or replace function public.concluir_etapa_sublote(
  p_sublote_etapa_id uuid,
  p_operador_id uuid,
  p_quantidade_boa numeric,
  p_quantidade_refugo numeric,
  p_motivo_refugo_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_etapa public.sublote_etapas%rowtype;
  v_sublote public.sublotes%rowtype;
begin
  if p_quantidade_boa is null or p_quantidade_boa < 0
     or p_quantidade_refugo is null or p_quantidade_refugo < 0 then
    raise exception 'Quantidade boa e refugo devem ser informadas e nao negativas';
  end if;

  select * into v_etapa from public.sublote_etapas where id = p_sublote_etapa_id for update;
  if not found then
    raise exception 'Etapa do sublote nao encontrada';
  end if;
  if v_etapa.status = 'concluida' then
    raise exception 'Etapa ja esta concluida';
  end if;

  select * into v_sublote from public.sublotes where id = v_etapa.sublote_id for update;

  if (p_quantidade_boa + p_quantidade_refugo) > v_sublote.quantidade + 0.001 then
    raise exception 'A soma das quantidades nao pode ser maior que a quantidade do sublote';
  end if;
  if p_quantidade_refugo > 0 and p_motivo_refugo_id is null then
    raise exception 'Informe o motivo do refugo';
  end if;

  update public.sublote_etapas
  set status = 'concluida', operador_fim_id = p_operador_id, timestamp_fim = now(),
      quantidade_boa = p_quantidade_boa, quantidade_refugo = p_quantidade_refugo,
      motivo_refugo_id = p_motivo_refugo_id
  where id = p_sublote_etapa_id;

  perform public.avancar_sublote(v_sublote.id, p_quantidade_boa);
end;
$fn$;

-- ----------------------------------------------------------------------------
-- 6) concluir_inspecao_sublote: mesma ideia da inspeção por apontamento
--    (aprovada/reprovada/retrabalho + observação), ligada a uma etapa
--    "inspecao" do roteiro. Reprovada é perda; retrabalho separa num sublote
--    novo "aguardando_decisao" pro gestor decidir depois; aprovada segue o
--    roteiro normalmente.
-- ----------------------------------------------------------------------------
create or replace function public.concluir_inspecao_sublote(
  p_sublote_etapa_id uuid,
  p_avaliador_id uuid,
  p_quantidade_aprovada numeric,
  p_quantidade_reprovada numeric,
  p_quantidade_retrabalho numeric,
  p_observacao text
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_etapa public.sublote_etapas%rowtype;
  v_sublote public.sublotes%rowtype;
  v_retrabalho_id uuid;
begin
  if p_quantidade_aprovada is null or p_quantidade_aprovada < 0
     or p_quantidade_reprovada is null or p_quantidade_reprovada < 0
     or p_quantidade_retrabalho is null or p_quantidade_retrabalho < 0 then
    raise exception 'Quantidades da inspecao devem ser informadas e nao negativas';
  end if;

  select * into v_etapa from public.sublote_etapas where id = p_sublote_etapa_id for update;
  if not found then
    raise exception 'Etapa do sublote nao encontrada';
  end if;
  if v_etapa.status = 'concluida' then
    raise exception 'Esta etapa ja foi inspecionada';
  end if;

  select * into v_sublote from public.sublotes where id = v_etapa.sublote_id for update;

  if (p_quantidade_aprovada + p_quantidade_reprovada + p_quantidade_retrabalho) > v_sublote.quantidade + 0.001 then
    raise exception 'A soma das quantidades nao pode ser maior que a quantidade do sublote';
  end if;

  insert into public.inspecoes_qualidade (
    sublote_etapa_id, quantidade_aprovada, quantidade_reprovada, quantidade_retrabalho, observacao, avaliador_id
  )
  values (
    p_sublote_etapa_id, p_quantidade_aprovada, p_quantidade_reprovada, p_quantidade_retrabalho,
    p_observacao, p_avaliador_id
  );

  update public.sublote_etapas
  set status = 'concluida', operador_fim_id = p_avaliador_id, timestamp_fim = now(),
      quantidade_boa = p_quantidade_aprovada, quantidade_refugo = p_quantidade_reprovada,
      observacao = p_observacao
  where id = p_sublote_etapa_id;

  if p_quantidade_retrabalho > 0 then
    insert into public.sublotes (
      op_id, apontamento_id, peca_id, maquina_id, quantidade, quantidade_original,
      operador_id, horario, roteiro_atual_id, status, qualidade_status
    )
    values (
      v_sublote.op_id, v_sublote.apontamento_id, v_sublote.peca_id, v_sublote.maquina_id,
      p_quantidade_retrabalho, p_quantidade_retrabalho,
      v_sublote.operador_id, v_sublote.horario, null, 'aguardando_decisao', 'retrabalho'
    )
    returning id into v_retrabalho_id;
  end if;

  if p_quantidade_aprovada > 0 then
    update public.sublotes set qualidade_status = 'aprovado' where id = v_sublote.id;
    perform public.avancar_sublote(v_sublote.id, p_quantidade_aprovada);
  else
    update public.sublotes
    set quantidade = 0, status = 'concluida', roteiro_atual_id = null,
        qualidade_status = case
          when p_quantidade_reprovada > 0 and p_quantidade_retrabalho = 0 then 'reprovado'
          else qualidade_status
        end
    where id = v_sublote.id;
  end if;
end;
$fn$;

grant execute on function public.avancar_sublote(uuid, numeric) to authenticated;
grant execute on function public.iniciar_etapa_sublote(uuid, uuid) to authenticated;
grant execute on function public.concluir_etapa_sublote(uuid, uuid, numeric, numeric, uuid) to authenticated;
grant execute on function public.concluir_inspecao_sublote(uuid, uuid, numeric, numeric, numeric, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 7) criar_sublote_apos_apontamento: quando a OP é uma 2ª operação (nasceu de
--    uma etapa "máquina"), o sublote resultante continua o roteiro DEPOIS
--    daquela etapa, em vez de recomeçar do zero.
-- ----------------------------------------------------------------------------
create or replace function public.criar_sublote_apos_apontamento(p_apontamento_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_apontamento public.apontamentos%rowtype;
  v_op public.ordens_producao%rowtype;
  v_etapa_origem public.peca_roteiro_etapas%rowtype;
  v_primeira_etapa public.peca_roteiro_etapas%rowtype;
  v_sublote_id uuid;
begin
  select * into v_apontamento from public.apontamentos where id = p_apontamento_id;
  if not found or v_apontamento.quantidade_produzida is null or v_apontamento.quantidade_produzida <= 0 then
    return;
  end if;

  select * into v_op from public.ordens_producao where id = v_apontamento.op_id;

  if v_op.roteiro_etapa_origem_id is not null then
    select * into v_etapa_origem from public.peca_roteiro_etapas where id = v_op.roteiro_etapa_origem_id;
  end if;

  select * into v_primeira_etapa
  from public.peca_roteiro_etapas
  where peca_id = v_op.peca_id and ordem > coalesce(v_etapa_origem.ordem, 0)
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
      'Pós-máquina: peça sem roteiro cadastrado (ou fim do roteiro), entrada automática ao sair da máquina',
      v_apontamento.operador_id
    );
  end if;
end;
$fn$;

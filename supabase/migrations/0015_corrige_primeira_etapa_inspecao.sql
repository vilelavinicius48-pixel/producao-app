-- =============================================================================
-- 0015 — Corrige criar_sublote_apos_apontamento: quando a 1ª etapa do roteiro
-- (ou a 1ª etapa depois de retomar, numa OP de 2ª operação) já é do tipo
-- "inspecao", o sublote tem que nascer direto como "em andamento" — igual o
-- avancar_sublote já faz pras etapas seguintes — senão ele não aparece na
-- lista de pendências da aba Qualidade sozinho.
-- =============================================================================

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
  v_primeira_etapa_tipo public.etapas%rowtype;
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
    case
      when v_primeira_etapa.id is null then 'concluida'
      else 'aguardando_etapa'
    end
  )
  returning id into v_sublote_id;

  if v_primeira_etapa.id is not null then
    select * into v_primeira_etapa_tipo from public.etapas where id = v_primeira_etapa.etapa_id;

    if v_primeira_etapa_tipo.tipo = 'inspecao' then
      update public.sublotes set status = 'em_etapa' where id = v_sublote_id;
    end if;

    insert into public.sublote_etapas (
      sublote_id, peca_roteiro_etapa_id, etapa_id, status, operador_inicio_id, timestamp_inicio
    )
    values (
      v_sublote_id, v_primeira_etapa.id, v_primeira_etapa.etapa_id,
      case when v_primeira_etapa_tipo.tipo = 'inspecao' then 'em_andamento' else 'aguardando' end,
      case when v_primeira_etapa_tipo.tipo = 'inspecao' then v_apontamento.operador_id else null end,
      case when v_primeira_etapa_tipo.tipo = 'inspecao' then v_apontamento.timestamp_stop else null end
    );
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

-- =============================================================================
-- 0020 — Tempo padrão passa a poder ser por peça+máquina, não só por peça.
-- Uma peça pode ter tempos de ciclo diferentes em máquinas diferentes (achado
-- ao importar a base de tempos/cotas do setor de qualidade). `pecas.tempo_padrao_segundos`
-- continua existindo como "tempo padrão geral" (usado quando não há um tempo
-- específico pra aquela máquina); `pecas_maquinas.tempo_padrao_segundos`, quando
-- preenchido, tem prioridade na hora de calcular o tempo estimado da OP.
-- =============================================================================

alter table public.pecas_maquinas
  add column if not exists tempo_padrao_segundos integer
  check (tempo_padrao_segundos is null or tempo_padrao_segundos > 0);

comment on column public.pecas_maquinas.tempo_padrao_segundos is
  'Tempo de ciclo (segundos) dessa peça especificamente nessa máquina. Nulo = usa o tempo padrão geral da peça (pecas.tempo_padrao_segundos).';

-- ============================================================================
-- Qualidade passa a registrar quantidade aprovada/reprovada/retrabalho por
-- apontamento (em vez de um unico resultado), permitindo compor o relatorio
-- diario com taxa de qualidade.
-- ============================================================================

alter table public.inspecoes_qualidade
  add column if not exists quantidade_aprovada numeric(12, 4) not null default 0,
  add column if not exists quantidade_reprovada numeric(12, 4) not null default 0,
  add column if not exists quantidade_retrabalho numeric(12, 4) not null default 0;

-- migra dados existentes (resultado unico -> quantidade total no bucket correspondente)
update public.inspecoes_qualidade iq
set quantidade_aprovada = case when iq.resultado = 'aprovado' then coalesce(a.quantidade_produzida, 0) else 0 end,
    quantidade_reprovada = case when iq.resultado = 'reprovado' then coalesce(a.quantidade_produzida, 0) else 0 end,
    quantidade_retrabalho = case when iq.resultado = 'retrabalho' then coalesce(a.quantidade_produzida, 0) else 0 end
from public.apontamentos a
where a.id = iq.apontamento_id and iq.resultado is not null;

alter table public.inspecoes_qualidade drop column if exists resultado;

alter table public.inspecoes_qualidade
  add constraint inspecoes_quantidades_nao_negativas check (
    quantidade_aprovada >= 0 and quantidade_reprovada >= 0 and quantidade_retrabalho >= 0
  );

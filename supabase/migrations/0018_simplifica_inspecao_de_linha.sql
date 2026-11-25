-- =============================================================================
-- 0018 — Ajusta a 0017 pro desenho simplificado: tira o checklist cota a cota
-- (não vamos usar) e deixa só situação geral + motivo (quando não for OK).
-- =============================================================================

drop table if exists public.inspecoes_linha_cotas;

alter table public.inspecoes_linha add column if not exists motivo_id uuid references public.motivos_refugo (id);

alter table public.inspecoes_linha drop constraint if exists inspecoes_linha_motivo_obrigatorio;
alter table public.inspecoes_linha add constraint inspecoes_linha_motivo_obrigatorio
  check (situacao_geral = 'ok' or motivo_id is not null);

-- =============================================================================
-- 0017 — Inspeção de Linha: o inspetor (perfil "qualidade") clica na máquina,
-- vê a OP em produção e registra rapidinho a situação geral da máquina (OK /
-- Não OK / Parada) — se não for OK, escolhe o motivo (cadastro "Motivos de
-- refugo" que já existe). Fica "pendente" quando faz mais de 1h desde a
-- última inspeção daquela máquina. O histórico geral fica em /inspecao-linha.
-- =============================================================================

create table public.inspecoes_linha (
  id uuid primary key default gen_random_uuid(),
  op_id uuid not null references public.ordens_producao (id),
  maquina_id uuid not null references public.maquinas (id),
  peca_id uuid not null references public.pecas (id),
  inspetor_id uuid not null references public.operadores (id),
  situacao_geral text not null check (situacao_geral in ('ok', 'nao_ok', 'parada')),
  motivo_id uuid references public.motivos_refugo (id),
  turno text not null check (turno in ('manha', 'tarde', 'noite')),
  observacao text,
  created_at timestamptz not null default now(),
  constraint inspecoes_linha_motivo_obrigatorio
    check (situacao_geral = 'ok' or motivo_id is not null)
);

comment on table public.inspecoes_linha is
  'Checklist rápido do inspetor de linha (perfil qualidade) sobre a máquina/OP em produção: situação geral + motivo se não for OK.';
comment on column public.inspecoes_linha.turno is
  'Calculado automaticamente a partir do horário (manhã 06–14h, tarde 14–22h, noite 22–06h).';

create index inspecoes_linha_maquina_idx on public.inspecoes_linha (maquina_id, created_at desc);

alter table public.inspecoes_linha enable row level security;

create policy "inspecoes_linha_select_autenticados" on public.inspecoes_linha
  for select to authenticated using (true);
create policy "inspecoes_linha_insert_qualidade" on public.inspecoes_linha
  for insert to authenticated with check (public.is_qualidade() and inspetor_id = auth.uid());
create policy "inspecoes_linha_delete_gestor" on public.inspecoes_linha
  for delete to authenticated using (public.is_gestor());

-- =============================================================================
-- 0016 — Quantidade de peças é sempre número inteiro, nunca com vírgula.
-- Vale pra tudo que conta peças de verdade (OP, apontamento, sublote, inspeção
-- de qualidade, estoque de peças prontas). NÃO vale pra quantidade importada
-- da carteira de pedidos (pedido_itens.quantidade), que continua exatamente
-- como vem do arquivo do outro sistema (regra 15 já decidia isso antes),
-- nem pra quantidades de material (metros/folhas), que são medidas, não peças.
-- =============================================================================

alter table public.ordens_producao
  add constraint ordens_producao_quantidade_planejada_inteira
  check (quantidade_planejada = trunc(quantidade_planejada));

alter table public.apontamentos
  add constraint apontamentos_quantidade_produzida_inteira
  check (quantidade_produzida is null or quantidade_produzida = trunc(quantidade_produzida)),
  add constraint apontamentos_quantidade_refugada_inteira
  check (quantidade_refugada is null or quantidade_refugada = trunc(quantidade_refugada));

alter table public.sublotes
  add constraint sublotes_quantidade_inteira
  check (quantidade = trunc(quantidade)),
  add constraint sublotes_quantidade_original_inteira
  check (quantidade_original = trunc(quantidade_original));

alter table public.sublote_etapas
  add constraint sublote_etapas_quantidade_boa_inteira
  check (quantidade_boa is null or quantidade_boa = trunc(quantidade_boa)),
  add constraint sublote_etapas_quantidade_refugo_inteira
  check (quantidade_refugo is null or quantidade_refugo = trunc(quantidade_refugo));

alter table public.inspecoes_qualidade
  add constraint inspecoes_qualidade_quantidade_aprovada_inteira
  check (quantidade_aprovada = trunc(quantidade_aprovada)),
  add constraint inspecoes_qualidade_quantidade_reprovada_inteira
  check (quantidade_reprovada = trunc(quantidade_reprovada)),
  add constraint inspecoes_qualidade_quantidade_retrabalho_inteira
  check (quantidade_retrabalho = trunc(quantidade_retrabalho));

alter table public.estoque_movimentos
  add constraint estoque_movimentos_quantidade_inteira
  check (quantidade = trunc(quantidade));

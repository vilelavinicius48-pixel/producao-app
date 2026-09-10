# Prompt para Claude Code

Cole o texto abaixo no Claude Code (dentro da pasta vazia do projeto) para iniciar a construção.

---

Quero construir um sistema web de acompanhamento de produção em tempo real (tipo um mini-MES) para uma fábrica de pequeno/médio porte. Preciso que você monte o projeto do zero, começando pela fundação (banco de dados + cadastros) e avançando em fases. Antes de codificar, me pergunte qualquer coisa que estiver ambígua.

## Stack

- **Frontend + Backend:** Next.js (App Router), TypeScript
- **Banco de dados:** Supabase (Postgres), usando o client oficial do Supabase
- **Tempo real:** Supabase Realtime (subscriptions), para o dashboard atualizar sozinho sem refresh manual
- **Autenticação:** Supabase Auth, com perfis: `gestor`, `operador`, `qualidade`
- **UI:** Tailwind CSS. Telas de operador devem ter botões grandes, pensadas para toque em tablet no chão de fábrica. Tela de dashboard deve ser legível de longe (TV/monitor fixo).

## Entidades principais (modelo de dados)

- **pecas**: código, descrição, tempo_padrao_por_unidade, maquinas_compativeis (relação), materiais_necessarios (lista com quantidade por unidade)
- **maquinas**: código, nome, status_atual (calculado: livre / rodando / parada)
- **operadores**: matrícula, nome, ativo
- **motivos_parada**: lista cadastrável (setup, manutenção, falta de material, quebra, etc.)
- **ordens_producao (OP)**: número sequencial automático, peça, quantidade planejada, máquina, status (`em_producao` | `parada` | `concluida`), tempo_estimado (calculado), material_necessario (calculado)
- **apontamentos**: OP (FK), operador (FK), timestamp_start, timestamp_stop, quantidade_produzida, quantidade_refugada, eficiência (calculada)
- **paradas**: OP (FK), timestamp_inicio, timestamp_fim (nulo até "Voltar de parada"), motivo (FK, preenchido só no retorno)
- **inspecoes_qualidade**: apontamento (FK, um-para-um), resultado (`aprovado` | `reprovado` | `retrabalho`), observacao, avaliador (FK operador com perfil qualidade)

## Regras de negócio (importante seguir exatamente)

1. **Geração de OP:** ao selecionar peça + quantidade + máquina, calcular automaticamente tempo total estimado e material necessário total, puxando dos cadastros.
2. **Start/Stop:** operador busca a OP pelo número, aperta Start (grava timestamp, muda status da OP e da máquina para "em produção"), depois Stop (grava timestamp, calcula tempo real, pede quantidade produzida e quantidade refugada).
3. **Parada:** botão "Parada" separado do Stop — para a produção atual, marca OP e máquina como "parada" no dashboard imediatamente, SEM pedir motivo ainda. Botão "Voltar de parada" pede o motivo (vindo da lista cadastrada) e automaticamente inicia um novo apontamento de produção na mesma OP.
4. **Parada sem retorno:** é um estado válido e esperado, não um erro. O dashboard deve mostrar um cronômetro corrido ("PARADA HÁ XX:XX:XX") enquanto não houver "Voltar de parada".
5. **Trava de recurso exclusivo:** não é possível abrir um novo apontamento se a OP já tem apontamento aberto, NEM se a máquina já está ocupada por outra OP. A trava vale pelos dois ao mesmo tempo.
6. **Concorrência entre operadores:** enquanto uma OP tem apontamento aberto por um operador, nenhum outro operador pode abrir apontamento nela. Ao fechar (stop), qualquer operador pode abrir um novo.
7. **Qualidade:** a inspeção é 1-para-1 com cada apontamento (não com a OP inteira), e só pode ser feita depois que o apontamento é fechado (stop) — é quando a peça física chega às mãos da qualidade. Resultado possível: aprovado, reprovado, retrabalho, com campo de observação livre.
8. **Estados da OP:** `em_producao`, `parada`, `concluida`. O dashboard mostra SOMENTE OPs em `em_producao` ou `parada` (ativas). OPs `concluida` saem do dashboard e vão para o histórico.
9. **Histórico:** deve armazenar todos os apontamentos, paradas e inspeções de qualidade de cada OP, consultável tanto durante a produção quanto depois de concluída.
10. **Relatório diário:** por máquina, comparar tempo planejado x tempo rodado x tempo parado, eficiência do dia, e indicar se está dentro do prazo ou atrasada.

## Fases de construção (siga nesta ordem, entregando algo funcional a cada fase)

1. Setup do projeto (Next.js + Supabase + Auth com os 3 perfis) + cadastros (peças, máquinas, operadores, motivos de parada)
2. Geração de OP com cálculo automático
3. Apontamento de produção (Start/Stop, quantidades) com a trava de recurso exclusivo (item 5)
4. Fluxo de parada (Parada/Voltar de parada) com cronômetro (itens 3 e 4)
5. Fechamento automático da OP (eficiência, saldo, tempo restante)
6. Dashboard em tempo real (Supabase Realtime) — só OPs ativas
7. Módulo de qualidade (inspeção por apontamento)
8. Histórico consolidado
9. Relatório diário

Comece pela Fase 1. Ao final de cada fase, me avise o que foi entregue antes de seguir para a próxima.

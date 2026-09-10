# Sistema de Acompanhamento de Produção em Tempo Real
### Documento de referência do projeto

> Atualize este documento sempre que uma regra de negócio mudar durante o desenvolvimento. Ele é a fonte da verdade do que o sistema deve fazer — o Claude Code deve ser instruído a seguir o que está aqui.

---

## 1. Visão geral

Sistema web para acompanhar a produção em tempo real, com três tipos de acesso:
- **Gestores:** computador, visão de relatórios e histórico
- **Colaboradores (operadores):** tablet/PC no chão de fábrica, tela de apontamento
- **Dashboard de gestão visual:** TV/monitor fixo na produção, atualização automática

Porte do projeto: pequeno, mas com complexidade real de regras de negócio e concorrência.

## 2. Stack tecnológica

| Camada | Tecnologia | Motivo |
|---|---|---|
| Frontend + Backend | Next.js (TypeScript) | Um projeto só, fácil de manter com IA |
| Banco de dados | Supabase (Postgres) | Relacional, encaixa no modelo de dados abaixo |
| Tempo real | Supabase Realtime | Dashboard atualiza sozinho, sem refresh manual |
| Autenticação | Supabase Auth | Perfis: gestor, operador, qualidade |
| UI | Tailwind CSS | Rápido, bem documentado para IA |
| Deploy | Vercel (app) + Supabase Cloud (dados) | Grátis nessa escala; avaliar hospedagem local se a fábrica não tiver internet estável |

## 3. Módulos do sistema

1. **Cadastro** — peças, máquinas, operadores, motivos de parada
2. **Geração de OP** — numeração automática; cálculo automático de tempo e material ao selecionar peça + quantidade + máquina
3. **Apontamento de produção** — start/stop, quantidade produzida/refugada, seleção de operador
4. **Fluxo de parada** — botão Parada / botão Voltar de parada (com motivo)
5. **Fechamento de OP** — eficiência, saldo produzido, tempo restante (calculado automaticamente)
6. **Dashboard** — situação de cada máquina em tempo real (só OPs ativas)
7. **Qualidade** — inspeção por apontamento (aprovado/reprovado/retrabalho + observação)
8. **Histórico** — todos os apontamentos, paradas e inspeções de cada OP
9. **Relatório diário** — planejado x realizado x parado, por máquina

## 4. Modelo de dados (entidades e relacionamentos)

```
pecas
 ├── código, descrição, tempo_padrao_por_unidade
 ├── maquinas_compativeis (N:N com maquinas)
 └── materiais_necessarios (lista: material + quantidade por unidade)

maquinas
 ├── código, nome
 └── status_atual (calculado: livre / rodando / parada)

operadores
 ├── matrícula, nome, ativo
 └── perfil (operador / gestor / qualidade)

motivos_parada
 └── descrição (cadastrável)

ordens_producao (OP)
 ├── número (sequencial automático)
 ├── peça (FK), quantidade_planejada, máquina (FK)
 ├── status: em_producao | parada | concluida
 ├── tempo_estimado (calculado), material_necessario (calculado)
 └── 1:N apontamentos, 1:N paradas

apontamentos
 ├── OP (FK), operador (FK)
 ├── timestamp_start, timestamp_stop
 ├── quantidade_produzida, quantidade_refugada
 ├── eficiência (calculada: tempo_padrao / tempo_real)
 └── 0:1 inspecao_qualidade

paradas
 ├── OP (FK)
 ├── timestamp_inicio, timestamp_fim (nulo até "Voltar de parada")
 └── motivo (FK, preenchido só no retorno)

inspecoes_qualidade
 ├── apontamento (FK, 1:1)
 ├── resultado: aprovado | reprovado | retrabalho
 ├── observação
 └── avaliador (FK operador, perfil qualidade)
```

## 5. Regras de negócio (decisões já fechadas)

| # | Regra |
|---|---|
| 1 | Geração de OP calcula automaticamente tempo estimado e material necessário a partir do cadastro da peça |
| 2 | Start grava início e muda status da OP/máquina para "em produção"; Stop grava fim, pede quantidade produzida e refugada |
| 3 | Botão "Parada" é separado do Stop: para a produção, marca dashboard como parada, sem pedir motivo ainda |
| 4 | Botão "Voltar de parada" pede o motivo (da lista cadastrada) e inicia automaticamente um novo apontamento na mesma OP |
| 5 | Parada sem retorno é um estado válido — dashboard mostra cronômetro "PARADA HÁ XX:XX:XX" |
| 6 | Trava de recurso exclusivo vale por OP **e** por máquina simultaneamente — não dá pra abrir novo apontamento se qualquer um dos dois já estiver ocupado |
| 7 | Enquanto uma OP tem apontamento aberto por um operador, nenhum outro pode abrir apontamento nela; ao fechar, qualquer operador pode abrir um novo |
| 8 | Inspeção de qualidade é 1-para-1 com cada apontamento (não com a OP inteira), e só ocorre depois que o apontamento é fechado — é quando a peça física chega à qualidade |
| 9 | Estados da OP: `em_producao`, `parada`, `concluida` |
| 10 | Dashboard mostra só OPs `em_producao` ou `parada`; `concluida` vai para o histórico |
| 11 | Histórico armazena todos os apontamentos, paradas e inspeções, consultável durante e após a produção |
| 12 | Relatório diário compara planejado x realizado x parado por máquina, indicando atraso |

## 6. Fases de desenvolvimento

1. Setup (Next.js + Supabase + Auth) + cadastros
2. Geração de OP com cálculo automático
3. Apontamento (start/stop) com trava de recurso exclusivo
4. Fluxo de parada (parada/voltar) com cronômetro
5. Fechamento automático da OP
6. Dashboard em tempo real
7. Módulo de qualidade
8. Histórico consolidado
9. Relatório diário

## 7. Dependências entre fases

- Cadastro → precisa existir antes de qualquer OP
- Geração de OP → depende do cadastro completo
- Apontamento → depende da OP existir
- Fechamento/eficiência → depende do apontamento completo
- Dashboard → depende do apontamento e parada em tempo real funcionando
- Qualidade → depende de apontamentos fechados existirem
- Relatório diário → depende de tudo acima já rodando

## 8. Riscos

| Risco | Mitigação |
|---|---|
| Tempo padrão cadastrado errado | Validar com cronoanálise real antes de ligar o sistema |
| Parada esquecida sem retorno acumulando | Aceito como dado correto; considerar alerta visual para paradas muito longas |
| Concorrência (2 operadores, mesma OP/máquina) | Trava por OP + máquina (regra 6) |
| Escopo crescendo além do previsto | Entregar em fases, uma de cada vez, sem pular etapas |
| Internet instável na fábrica afetando Supabase Cloud/Vercel | Avaliar hospedagem local (Postgres + Next.js em servidor próprio) se for um problema real |

## 9. Registro de mudanças

> Adicione uma linha aqui sempre que uma decisão mudar durante o desenvolvimento.

| Data | Mudança |
|---|---|
| — | Versão inicial do documento |

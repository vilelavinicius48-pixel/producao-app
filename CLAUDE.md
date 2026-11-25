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
10. **PCP** (`/pcp`, só gestor) — carteira de pedidos importada da planilha do sistema, geração de OP a partir do pedido, preparação (material/ferramenta/dispositivo/programa), fila por máquina, pendências e estoque de peças prontas
11. **Material do PCP** — catálogo de materiais (barra ou chapa), estoque de material em metros/folhas, necessidade de material (o que falta comprar) e pedidos de compra com previsão de chegada; o status "Material" da OP passa a ser calculado sozinho
12. **Pós-máquina** (em construção, por partes) — depois que a peça sai da máquina, segue sozinha um roteiro de etapas (rebarbação, lavagem, inspeção, tratamento externo, 2ª operação em máquina, etc.) até virar peça pronta, em vez do gestor decidir uma a uma. Parte 1 (pronta): cadastro de etapas/postos, tratamentos, fornecedores e motivos de refugo; roteiro e plano de medição por peça. Partes seguintes (ainda não feitas): caixa (sublote) gerada ao fechar o apontamento na máquina, Ficha da OP impressa com QR code, página do celular pra tocar o roteiro, quadro "onde está cada lote", tratamento externo (envio/retorno) e entrada automática no estoque ao concluir

## 4. Modelo de dados (entidades e relacionamentos)

```
pecas
 ├── código, descrição, tempo_padrao_por_unidade
 ├── maquinas_compativeis (N:N com maquinas)
 ├── materiais_necessarios (lista livre: material + quantidade por unidade — informativo, sem estoque)
 └── material (FK, opcional) + comprimento_consumido_mm (barra) ou pecas_por_folha (chapa)

maquinas
 ├── código, nome
 ├── status_atual (calculado: livre / rodando / parada)
 └── barra_comprimento_mm + barra_sobra_mm (vazio = não trabalha com barra)

materiais (catálogo)
 ├── formato: redonda | sextavada | quadrada | retangular | tubo | chapa
 ├── tipo (liga) + medidas (bitola/largura/altura/espessura conforme o formato)
 └── barra = controlado em metros · chapa = controlado em folhas

estoque_material_movimentos
 └── material (FK), tipo (entrada/saida/ajuste), quantidade (m ou folhas)

pedidos_compra_material
 ├── material (FK), quantidade, fornecedor, data_pedido
 ├── previsao_chegada (editável — fornecedor informa depois do pedido)
 └── status: pedido | recebido | cancelado

operadores
 ├── matrícula, nome, ativo
 └── perfil (operador / gestor / qualidade)

etapas (catálogo)
 ├── nome, tipo: manual | maquina | externo | inspecao
 └── manual = posto físico · maquina = gera OP de 2ª operação · externo = tratamento com
     fornecedor · inspecao = usa o módulo de Qualidade

tratamentos, fornecedores, motivos_refugo (catálogos simples)

peca_roteiro_etapas (roteiro da peça, ordenado)
 ├── peça (FK), etapa (FK), ordem
 ├── máquina (FK, obrigatório se etapa.tipo = 'maquina')
 └── tratamento (FK, obrigatório se etapa.tipo = 'externo')

peca_plano_medicao_cotas (plano de medição da peça, ordenado)
 ├── peça (FK), ordem, tipo (Comp/Ø/raio/ângulo/rosca/funcional/...)
 ├── eh_atributo (true = cota tipo OK/NOK, sem nominal/mín/máx)
 ├── nominal, mínimo, máximo (quando não é atributo)
 └── instrumento, frequência (opcionais)

pecas ganha: desenho_path + desenho_content_type (arquivo no bucket "desenhos" do Supabase
Storage, PNG/JPG/PDF, um arquivo atual por peça, substituível)

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
| 13 | Estados da OP agora: `planejada` → `aberta` (exibida como **Liberada**) → `setup` → `em_producao`/`parada` → `concluida`. Toda OP nova nasce `planejada`; setup/apontamento só iniciam em OP `aberta` |
| 14 | OP só é liberada quando material, ferramenta, dispositivo e programa estão `ok` ou `na` (não se aplica). OP liberada que ainda não começou o setup pode voltar para planejada |
| 15 | Carteira vem da planilha "Pedidos em Aberto por Cliente (Detalhado)" do sistema (.xls/.xlsx). Chave do item = nº pedido + código + data de entrega. O arquivo é a carteira **completa**: item aberto que não vier no arquivo é encerrado; se voltar, é reaberto. Linhas repetidas são somadas. Tudo é importado como está (atrasados, saldos fracionados, conjuntos) |
| 16 | Código de produto que não existe em `pecas` é criado automaticamente sem tempo padrão ("cadastro pendente"). Peça sem máquinas compatíveis aceita qualquer máquina, e a escolhida é gravada como compatível |
| 17 | Fila por máquina = OPs `planejada`/`aberta` ordenadas por `sequencia`; a primeira é a "próxima" e deve estar liberada antes da atual acabar (setup externo) |
| 18 | Estoque de peças prontas = soma de `estoque_movimentos` (entrada +, saída −, ajuste ±; contagem gera ajuste pela diferença). Na carteira, o estoque de cada peça cobre primeiro os itens com entrega mais cedo. Por enquanto não há baixa automática na conclusão da OP nem no faturamento |
| 19 | Material é tipo + formato (redonda, sextavada, quadrada, retangular, tubo ou chapa) + medidas. Formatos em barra são comprados/controlados em **metros**; chapa, em **folhas**. Cada máquina tem um tamanho de barra fixo (mm) + sobra de ponta não aproveitável; chapa não usa esses dois campos (o tamanho da folha é do material, não da máquina) |
| 20 | Peça tem um material (opcional) + comprimento consumido por peça (barra, já incluindo corte/sangria) **ou** peças por folha (chapa, digitado por quem cadastra — o corte de chapa segue um desenho de aproveitamento que o sistema não calcula sozinho) |
| 21 | Ao criar a OP (ou trocar a máquina), o sistema calcula e grava um retrato de quantas barras/folhas e quantos metros são necessários (peças por barra = (tamanho da barra − sobra) ÷ comprimento por peça). Esse retrato não se atualiza sozinho se o cadastro da peça mudar depois — igual ao tempo estimado |
| 22 | Status "Material" da OP é calculado automaticamente (OK / Aguardando / Pendente) a partir do estoque de material e dos pedidos de compra em aberto. Quando o estoque não cobre todas as OPs do mesmo material, prioridade é **entrega mais cedo primeiro** (vale também entre OPs de máquinas diferentes); a ordem da fila da máquina só desempata quando a entrega é igual ou inexistente. O gestor pode sobrescrever manualmente a qualquer momento — isso trava o recálculo automático dessa OP até clicar em "Recalcular material automático" |
| 23 | Pedido de compra de material: material, quantidade, fornecedor (texto livre), data do pedido e previsão de chegada (editável depois — o fornecedor costuma informar só após o pedido feito). Ao marcar "recebido", lança a entrada no estoque (quantidade recebida pode ser menor que a pedida, para entrega parcial) |
| 24 | Tela "Necessidade de material": para cada material, soma os metros/folhas de todas as OPs `planejada`/`aberta`, desconta estoque e pedidos de compra em aberto, mostra o que falta comprar e tem botão para copiar a lista em texto (para colar no WhatsApp) |
| 25 | Pós-máquina: a peça que sai da máquina segue sozinha o roteiro cadastrado dela (lista ordenada de etapas), em vez do gestor decidir manualmente o que fazer com cada lote |
| 26 | Etapa do tipo `maquina` (2ª operação) no roteiro já define a máquina fixa daquela etapa — não é escolhida na hora que a peça chega lá |
| 27 | Quando a inspeção de qualidade classifica como "retrabalho", a caixa fica numa lista separada aguardando decisão manual do gestor — não volta sozinha para nenhuma etapa do roteiro |
| 28 | No celular (abrindo pelo QR code da Ficha da OP), cada operador faz login com a própria matrícula, igual no resto do sistema — sem acesso sem login |
| 29 | Refugo registrado em qualquer etapa do roteiro que não seja a inspeção de qualidade pede o motivo (cadastro "Motivos de refugo"), igual já acontece hoje com parada de máquina |
| 30 | Peça sem roteiro pós-máquina cadastrado, ou sem plano de medição cadastrado, aparece como pendência de cadastro (igual já acontece com tempo padrão/máquina/material) |

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
| Consultas simultâneas (`Promise.all`) numa Server Action que muda dados podem derrubar a sessão do Supabase (renovação de token em corrida) | Nas Server Actions que escrevem no banco, rodar as consultas em sequência, não em paralelo. Página só de leitura pode usar `Promise.all` normalmente |
| Bug pré-existente conhecido: `/ordens/nova` (OPForm → `createOP`) desloga o usuário ao gerar a OP, mesmo sem erro nenhum no servidor — função raramente usada, já que o fluxo real é `/pcp/nova-op` (que funciona normalmente). Ainda não diagnosticado a fundo; investigar se for reativar essa tela | — |

## 9. Registro de mudanças

> Adicione uma linha aqui sempre que uma decisão mudar durante o desenvolvimento.

| Data | Mudança |
|---|---|
| — | Versão inicial do documento |
| 2026-11-24 | Módulo PCP (migração 0009): `pedido_itens`, `importacoes_pedidos`, `estoque_movimentos` + view `estoque_pecas`; OP ganhou `planejada`, preparo, `sequencia`, `pedido_item_id`; tempo padrão da peça passou a ser opcional; 12 máquinas cadastradas. Regras 13–18 |
| 2026-11-24 | Módulo de Material do PCP (migração 0010): catálogo `materiais` (barra/chapa), `estoque_material_movimentos` + view `estoque_materiais`, `pedidos_compra_material`; máquina ganhou tamanho de barra + sobra de ponta; peça ganhou material + comprimento consumido/peças por folha; OP ganhou retrato de material (barras/folhas/metros) + `material_status_manual`. Status "Material" da OP passou a ser calculado automaticamente. Telas novas: Cadastros → Materiais, PCP → Necessidade de material, PCP → Compras de material, Cadastros → Materiais → Importar estoque inicial. Regras 19–24 |
| 2026-11-24 | Importado o estoque inicial real de matéria-prima pela planilha "Controle de Matéria Prima" (322 materiais, ~156 lançamentos de estoque); 9 itens da planilha não se encaixam no modelo atual (perfil, cantoneira, disco, item avulso) e ficaram para cadastro manual, se forem matéria-prima de verdade |
| 2026-11-25 | Pós-máquina, Parte 1 (migração 0011): cadastros `etapas`, `tratamentos`, `fornecedores`, `motivos_refugo`; `peca_roteiro_etapas` e `peca_plano_medicao_cotas` por peça; peça ganhou `desenho_path`/`desenho_content_type` (bucket Supabase Storage "desenhos"). Telas novas: Cadastros → Etapas/Postos, Tratamentos, Fornecedores, Motivos de refugo; aba Roteiro e Plano de medição no cadastro da peça, cada uma com botão "copiar de outra peça". Regras 25–30. Partes seguintes (caixa, Ficha da OP com QR, página do celular, quadro de lotes, tratamento externo, entrada automática no estoque) ainda não foram feitas |

# Manual do Usuário — The Finance

> Sistema de gestão financeira e operacional para restaurantes.  
> Versão 1.0 · Última atualização: Mai/2026

---

## Sumário

1. [Introdução](#1-introdução)
2. [Primeiros Passos](#2-primeiros-passos)
3. [Atendimento — PDV do Garçom](#3-atendimento--pdv-do-garçom)
4. [Cozinha — KDS](#4-cozinha--kds)
5. [Caixa e Pagamentos](#5-caixa-e-pagamentos)
6. [Insumos e Estoque](#6-insumos-e-estoque)
7. [Produtos e Cardápio](#7-produtos-e-cardápio)
8. [Inventário Físico](#8-inventário-físico)
9. [Relatórios](#9-relatórios)
10. [Usuários e Acessos](#10-usuários-e-acessos)
11. [Configurações do Restaurante](#11-configurações-do-restaurante)
12. [Perguntas Frequentes (FAQ)](#12-perguntas-frequentes-faq)

---

## 1. Introdução

O **The Finance** é uma plataforma de gestão para restaurantes que integra:

| Módulo | O que faz |
|--------|-----------|
| PDV Garçom | Registro de pedidos por mesa via PIN |
| KDS Cozinha | Gerenciamento de pedidos em tempo real |
| Caixa | Fechamento de conta e processamento de pagamentos |
| Estoque | Controle de insumos, entradas, saídas e alertas |
| Relatórios | Análises de vendas, CMV, operação e estoque |
| Financeiro | Controle de margem de lucro por produto |

### Níveis de acesso

| Papel | Permissões |
|-------|-----------|
| `SUPER_ADMIN` | Acesso total — todas as funcionalidades e configurações |
| `ADMIN` | Acesso completo ao restaurante sem gestão de plataforma |
| `MANAGER` | Relatórios, estoque, usuários e configurações; sem assinatura |
| `STAFF` | Acesso definido pelo cargo personalizado |

### Formas de acesso

- **Dashboard administrativo** (`/dashboard`) — login com e-mail e senha
- **Telas operacionais** (`/[slug]/garcom`, `/cozinha`, `/caixa`) — login com PIN de 4 dígitos, sem necessidade de e-mail

> **Slug** é o identificador único do seu restaurante na URL, definido na configuração inicial.

---

## 2. Primeiros Passos

> Siga a ordem abaixo. Produtos dependem de insumos; pedidos dependem de mesas e produtos.

### Passo 1 — Primeiro acesso

1. Acesse o link de convite recebido por e-mail
2. Defina sua senha
3. Faça login em `/auth/login`

### Passo 2 — Configurar Ambientes e Mesas

1. Acesse **Configurações → Restaurante**
2. Na aba **Ambientes**, crie as seções do salão (ex.: Salão Principal, Varanda, Deck)
3. Na aba **Mesas**, cadastre cada mesa com: número, identificador e capacidade
4. Associe cada mesa a um ambiente

### Passo 3 — Configurar o PDV

1. Vá em **Configurações → Restaurante → Configuração PDV**
2. Defina a taxa de serviço (%)
3. Selecione as formas de pagamento aceitas: Dinheiro, Débito, Crédito, Pix

### Passo 4 — Cadastrar Insumos

1. Acesse **Estoque → Insumos → Novo Insumo**
2. Preencha: nome, categoria, unidade, quantidade atual, quantidade mínima e custo unitário
3. Repita para todos os ingredientes utilizados no cardápio

### Passo 5 — Cadastrar Produtos (Cardápio)

1. Acesse **Estoque → Produtos → Novo Produto**
2. Preencha: nome, categoria e preço de venda
3. Na aba **Receita**, adicione os insumos com a quantidade utilizada por porção
4. O sistema calcula custo e margem automaticamente

### Passo 6 — Convidar a Equipe

1. Acesse **Configurações → Usuários → Convidar Funcionário**
2. Informe nome, e-mail e cargo
3. O sistema envia o convite por e-mail
4. Configure o PIN para garçons, cozinheiros e caixas (veja seção 10)

### Passo 7 — Compartilhar links de acesso

Copie os links em **Configurações → Usuários** e envie para a equipe via WhatsApp ou fixe no dispositivo:

```
/[slug]/garcom   → PDV do Garçom
/[slug]/cozinha  → KDS da Cozinha
/[slug]/caixa    → Terminal do Caixa
```

---

## 3. Atendimento — PDV do Garçom

**Acesso:** `/{slug}/garcom` · **Autenticação:** PIN de 4 dígitos

### Fluxo completo

```
Selecionar usuário → Digitar PIN → Escolher mesa → Montar pedido → Enviar
```

### Passo a passo

**1. Login com PIN**
- Toque no seu nome/avatar na lista
- Insira o PIN de 4 dígitos no teclado numérico
- Use ⌫ para apagar

**2. Selecionar mesa**

| Cor | Status |
|-----|--------|
| 🟢 Verde | Livre |
| 🟡 Âmbar | Ocupada (pedido em aberto) |
| 🟣 Roxo | Reservada |

**3. Montar o pedido**
- Produtos organizados por categoria
- Toque para adicionar ao carrinho
- Use `+` / `-` para ajustar quantidade
- Ícone de nota → adicionar observações (ex.: "sem cebola")

**4. Enviar para a cozinha**
- Revise o carrinho
- Toque em **Enviar pedido**
- O pedido aparece imediatamente na tela da cozinha

**5. Adicionar itens a pedido existente**
- Ao selecionar uma mesa ocupada, o sistema carrega o pedido atual
- Adicione novos itens normalmente — são acrescentados sem cancelar os anteriores

> ⚠️ **Produto indisponível?** O produto fica cinza quando qualquer insumo da receita está zerado. Registre uma entrada em Estoque → Insumos.

---

## 4. Cozinha — KDS

**Acesso:** `/{slug}/cozinha` · **Autenticação:** PIN de 4 dígitos  
**Atualização:** Automática via WebSocket — sem necessidade de recarregar a página.

### Status dos pedidos

| Status | Significado |
|--------|-------------|
| 🔵 Aberto | Recebido, aguardando preparo |
| 🟡 Em Preparo | Cozinha iniciou o preparo |
| 🟢 Pronto | Pronto para ser servido |

### Passo a passo

1. Selecione seu usuário e insira o PIN
2. Pedidos novos chegam automaticamente no status **Aberto**
3. Toque no botão de avanço para mover o status: Aberto → Em Preparo → Pronto
4. O garçom e o caixa são notificados em tempo real
5. Para cancelar, use o botão de cancelar no card do pedido

> 💡 Pedidos mais antigos ficam no topo da fila. O horário de abertura é exibido em cada card — priorize os mais antigos para manter o tempo médio de preparo baixo.

> ⚠️ O cancelamento de pedidos **não** estorna o estoque automaticamente. Faça ajuste manual em Estoque → Insumos se necessário.

---

## 5. Caixa e Pagamentos

**Acesso:** `/{slug}/caixa` · **Autenticação:** PIN de 4 dígitos

### Passo a passo

1. Selecione seu usuário e insira o PIN
2. A tela exibe as mesas com pedidos em aberto
3. Toque na mesa do cliente
4. Revise os itens, subtotal e taxa de serviço
5. Selecione a forma de pagamento (conforme configurado no PDV)
6. Confirme o pagamento

**Resultado após finalizar:**
- Pedido marcado como **Finalizado**
- Mesa retorna ao status **Livre**
- Estoque dos insumos utilizados é baixado automaticamente

> 💡 As formas de pagamento disponíveis são configuradas em **Configurações → Restaurante → Configuração PDV**.

---

## 6. Insumos e Estoque

**Acesso:** Dashboard → **Estoque → Insumos**  
**Permissão necessária:** `estoque.ver`

### Cadastrar novo insumo

1. Clique em **Novo Insumo**
2. Preencha:
   - **Nome** e **Categoria**
   - **Unidade de medida** (kg, L, un, cx, etc.)
   - **Quantidade atual** — estoque inicial
   - **Quantidade mínima** — gatilho para alerta de reposição
   - **Custo unitário** — preço inicial (atualizado automaticamente com CMP nas entradas)

### Status de estoque

| Badge | Condição |
|-------|----------|
| 🟢 OK | Acima do mínimo |
| 🟡 Reposição | Abaixo do mínimo |
| 🔴 Crítico | Quantidade zero ou negativa |

### Registrar movimentação

Clique no ícone de movimentação ao lado do insumo e escolha o tipo:

| Tipo | Uso |
|------|-----|
| **Entrada** | Compra ou recebimento de mercadoria |
| **Saída** | Consumo manual ou transferência |
| **Ajuste** | Correção de quantidade (positiva ou negativa) |
| **Perda** | Quebra, acidente ou descarte |
| **Vencimento** | Descarte por validade expirada |
| **Uso interno** | Consumo da equipe ou uso operacional |

Para **entradas**, informe o custo unitário da nota fiscal. O sistema recalcula o **Custo Médio Ponderado (CMP)** automaticamente:

```
CMP = (Valor atual em estoque + Valor entrada) ÷ (Qtd atual + Qtd entrada)
```

### Histórico de movimentações

Clique em **Histórico** ao lado do insumo para ver todas as movimentações com: tipo, quantidade, custo unitário, custo total, motivo e data/hora.

> 💡 O Dashboard exibe um alerta em vermelho quando há insumos abaixo do mínimo. Use como checklist diário antes de abrir o restaurante.

> ⚠️ A baixa automática de estoque ocorre apenas quando um pedido é **finalizado** no caixa. Pedidos cancelados **não** estornam o estoque.

---

## 7. Produtos e Cardápio

**Acesso:** Dashboard → **Estoque → Produtos**  
**Permissão necessária:** `produtos.ver`

### Cadastrar novo produto

1. Clique em **Novo Produto**
2. Preencha nome, categoria e preço de venda
3. Na aba **Receita**, adicione os insumos com a quantidade por porção
4. O sistema calcula automaticamente:

| Métrica | Fórmula |
|---------|---------|
| **Custo** | Σ (quantidade × CMP do insumo) |
| **Margem R$** | Preço de venda − Custo |
| **Margem %** | Margem R$ ÷ Preço de venda × 100 |

### Indicador de margem

| Cor | Margem |
|-----|--------|
| 🟢 Verde | ≥ 30% |
| 🟡 Amarelo | 15% – 29% |
| 🔴 Vermelho | < 15% |

### Ativar / Desativar produto

Use o toggle de status para remover temporariamente um prato do cardápio sem excluí-lo. Útil para sazonalidade ou insumo em falta.

> 💡 Quando o CMP de um insumo muda (nova entrada com preço diferente), o custo e a margem de todos os produtos que usam esse insumo são recalculados automaticamente.

> ℹ️ Um produto fica **indisponível no PDV** automaticamente quando qualquer insumo da receita está com estoque zerado — mesmo que o produto esteja ativo.

---

## 8. Inventário Físico

**Acesso:** Dashboard → **Estoque → Inventário → aba Contagens Físicas**

O inventário físico compara as quantidades reais (contagem física) com o sistema, gerando ajustes automáticos nas diferenças.

### Passo a passo

**1. Criar nova contagem**
- Clique em **Nova Contagem**
- Informe o nome (ex.: "Inventário Semanal 29/05")
- O sistema cria uma sessão com todos os insumos cadastrados

**2. Registrar quantidades**
- Para cada insumo, insira a quantidade física encontrada
- O progresso é salvo automaticamente — pode ser feito em múltiplas sessões
- Use a busca para localizar insumos rapidamente

**3. Acompanhar diferenças**

| Diferença | Significado |
|-----------|-------------|
| 🟢 Positiva | Quantidade física maior que o sistema (sobra) |
| 🔴 Negativa | Quantidade física menor que o sistema (falta/perda) |

**4. Finalizar**
- Clique em **Finalizar Contagem**
- O sistema gera ajustes automáticos para todos os insumos com diferença
- O estoque é atualizado para refletir a realidade física

> ⚠️ A finalização é **irreversível**. Revise as diferenças antes de confirmar — diferenças grandes podem indicar erro de contagem.

> 💡 Realize inventários semanais ou quinzenais para detectar perdas ocultas e manter o sistema alinhado com a realidade.

---

## 9. Relatórios

**Acesso:** Dashboard → **Relatórios**  
**Permissão:** `SUPER_ADMIN`, `ADMIN` ou `MANAGER`

### Usar os filtros de período

Na barra superior, selecione o período:
- **Hoje** · **Ontem** · **Esta semana** · **Este mês** · **Este ano**
- **Personalizado** — selecione datas de início e fim

Clique em **Atualizar** para recarregar os dados com o período selecionado.

### Relatórios disponíveis

#### 1. Visão Geral de Vendas
KPIs principais com variação em relação ao período anterior:
- Total de Vendas, Nº de Pedidos, Ticket Médio, CMV (R$ e %)
- Gráfico de área com evolução diária (toggle para sobrepor CMV)
- Gráfico de distribuição por categoria (donut)
- Tabela de resumo diário ordenável por coluna

#### 2. Vendas por Produto
- Gráfico de barras horizontal: Top 10 por receita (verde = receita, cinza = custo)
- Tabela completa: quantidade, receita, margem R$ e %, ticket médio, classificação ABC
- Filtros: busca por nome, categoria e classe ABC (A/B/C)

#### 3. Comparativo de Períodos
- Dois seletores de período independentes
- Tabela: Métrica | Período 1 | Período 2 | Diferença | Variação %
- Gráfico de linha sobreposto por dia da semana

#### 4. Vendas por Operador
- Ranking de garçons por receita (cards com barra de progresso)
- Tabela: pedidos, receita, ticket médio, horário de pico, cancelamentos, taxa %

#### 5. Giro de Estoque
Mede a velocidade de consumo de cada insumo:

| Classificação | Índice de Giro |
|---------------|---------------|
| Alta | > 2 |
| Média | 0,5 – 2 |
| Baixa | < 0,5 |
| Parado | Sem movimentação no período |

Insumos parados são destacados em vermelho — candidatos a descarte ou renegociação.

#### 6. Curva ABC de Insumos
Análise de Pareto dos insumos por valor consumido:

| Classe | Representa | Ação recomendada |
|--------|------------|-----------------|
| A | 80% do custo total | Controle rigoroso, negociação de preços |
| B | 15% do custo total | Monitoramento regular |
| C | 5% do custo total | Revisão periódica |

Gráfico de Pareto (barras + linha acumulada) e tabela com filtro por classe.

#### 7. CMV Detalhado
- CMV por produto e por categoria
- Gráfico histórico com linha de referência em 35%
- Alerta automático quando CMV ultrapassa 35% por 3+ dias consecutivos
- Badges: ⭐ Produto estrela (alta margem + alto volume) · ⚠️ Alerta (margem < 20%)

> **Benchmark CMV:** 25%–35% é considerado saudável para restaurantes. Acima de 35% indica necessidade de revisão de preços ou fornecedores.

#### 8. Desempenho da Cozinha
- Tempo médio geral de preparo e por turno (Manhã 6h–12h, Tarde 12h–18h, Noite 18h–23h)
- Ranking de pratos por tempo médio de preparo
- Heatmap de pedidos por hora e dia da semana
- Lista de pedidos cancelados no período (data, operador, produtos)

### Exportar relatórios

| Formato | Características |
|---------|----------------|
| **CSV** | Separador ponto-e-vírgula, BOM UTF-8 — abre corretamente no Excel PT-BR |
| **Excel (.xlsx)** | Aba "Resumo Executivo" + abas por seção, cabeçalhos em negrito |
| **PDF** | Documento formatado com nome do restaurante, período e KPIs |

---

## 10. Usuários e Acessos

**Acesso:** Dashboard → **Configurações → Usuários**

### Convidar um funcionário

1. Clique em **Convidar Funcionário**
2. Preencha: nome, e-mail, cargo
3. O sistema envia convite por e-mail
4. O funcionário acessa o link, define a senha e é ativado

Status possíveis: 🟡 **Pendente** → 🟢 **Ativo** → ⚪ **Inativo**

### Configurar PIN de acesso

O PIN é necessário para acessar Garçom, Cozinha, Caixa e Estoque (telas operacionais).

1. Na lista de usuários, clique no menu de ações (⋮) do funcionário
2. Selecione **Redefinir PIN**
3. Defina um PIN de 4 dígitos
4. Informe o PIN ao funcionário pessoalmente

> ⚠️ O PIN é **diferente** da senha do dashboard. Um garçom pode ter PIN para o PDV sem ter acesso ao painel administrativo.

### Criar cargo personalizado

1. Acesse a aba **Cargos e Permissões**
2. Clique em **Novo Cargo**
3. Defina o nome e selecione as permissões por módulo:

| Módulo | Permissões disponíveis |
|--------|----------------------|
| Estoque | Ver, Criar, Editar, Excluir, Movimentar |
| Produtos | Ver, Criar, Editar, Excluir |
| Usuários | Ver, Gerenciar |
| Relatórios | Ver |
| Configurações | Ver, Editar |
| Cozinha | Ver, Gerenciar |

4. Atribua o cargo a funcionários editando o usuário desejado

### Links de acesso para a equipe

Disponíveis em **Configurações → Usuários** com botão de copiar:

```
/{slug}/garcom   → PDV do Garçom
/{slug}/cozinha  → KDS da Cozinha
/{slug}/caixa    → Terminal do Caixa
/{slug}/estoque  → Estoque (PIN)
```

---

## 11. Configurações do Restaurante

**Acesso:** Dashboard → **Configurações → Restaurante**

### Aba: Ambientes

Crie seções do salão (ex.: Área Interna, Varanda, Delivery). Cada ambiente agrupa mesas relacionadas.

### Aba: Mesas

Para cada mesa, informe:
- **Número** — identificador numérico
- **Identificador** — código ou nome (ex.: "VR-01")
- **Capacidade** — número de cadeiras
- **Ambiente** — a qual seção pertence

### Aba: Configuração PDV

| Campo | Descrição |
|-------|-----------|
| Taxa de serviço | Percentual cobrado automaticamente (ex.: 10%) |
| Couvert | Valor por pessoa (se aplicável) |
| Taxa de entrega | Para pedidos delivery |
| Formas de pagamento | Marque as que o restaurante aceita |

---

## 12. Perguntas Frequentes (FAQ)

**Por que um produto aparece indisponível para o garçom?**  
O produto fica indisponível automaticamente quando qualquer insumo da receita está com estoque zerado. Registre uma entrada do insumo em falta em **Estoque → Insumos**.

---

**O garçom não consegue fazer login com o PIN. O que fazer?**  
Verifique se o usuário está com status **Ativo** em Configurações → Usuários. Se o PIN foi esquecido, clique em **Redefinir PIN** no menu de ações e defina um novo PIN de 4 dígitos.

---

**Como alterar o preço de um produto?**  
Acesse **Estoque → Produtos**, clique no ícone de edição (✏️) ao lado do produto e altere o campo **Preço de venda**. A margem é recalculada automaticamente.

---

**O que é CMV e qual o benchmark saudável?**  
CMV (Custo da Mercadoria Vendida) é o percentual do custo dos insumos sobre a receita total. O benchmark ideal para restaurantes é **25%–35%**. Valores acima de 35% indicam necessidade de revisão de preços ou fornecedores. O sistema alerta automaticamente quando esse limite é ultrapassado por 3+ dias consecutivos.

---

**O que é a Curva ABC?**  
É uma análise de Pareto dos insumos por valor consumido. Classe A = ~20% dos itens que representam 80% do custo total — merecem controle rigoroso. Classe B = próximos 15% do custo. Classe C = últimos 5% — baixo impacto. Foque o controle nos itens Classe A.

---

**Como gerar link de acesso para a equipe?**  
Acesse **Configurações → Usuários**. Na seção inferior da página, encontre os links prontos para Garçom, Cozinha, Caixa e Estoque, com botão de copiar. Compartilhe via WhatsApp ou salve no dispositivo do salão como atalho.

---

**Posso usar o sistema em tablet ou celular?**  
Sim. As telas de Garçom, Cozinha e Caixa são otimizadas para dispositivos touch. O dashboard administrativo funciona melhor em telas maiores (notebook ou monitor), mas é acessível em qualquer dispositivo.

---

**Como reativar um funcionário desligado?**  
Acesse **Configurações → Usuários**, localize o usuário com status **Inativo** e clique no menu de ações → **Reativar**. O acesso é restaurado imediatamente.

---

**O inventário físico desconta o estoque dos pedidos em andamento?**  
Não. O inventário registra a quantidade contada como o novo valor de estoque, gerando um ajuste na diferença. Pedidos ainda não finalizados no caixa não são considerados — a baixa de insumos só ocorre ao finalizar o pedido.

---

**Como exportar relatórios para o Excel com formatação correta?**  
Use **Exportar → Excel (.xlsx)** na barra de filtros dos relatórios. O arquivo é gerado com separador e codificação adequados para PT-BR. Para CSV, o arquivo inclui BOM UTF-8 — abra diretamente no Excel sem necessidade de conversão.

---

**Por que o estoque não foi baixado após cancelar um pedido?**  
A baixa automática de estoque ocorre apenas quando um pedido é **finalizado** no caixa. Pedidos cancelados não geram estorno automático. Se os insumos já foram separados/utilizados, registre uma movimentação manual do tipo **Perda** ou **Ajuste**.

---

*The Finance · Documentação gerada automaticamente · v1.0.0*

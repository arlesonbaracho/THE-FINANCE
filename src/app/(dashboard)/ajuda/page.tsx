'use client'

import { useState } from 'react'
import {
  BookOpen, Rocket, UtensilsCrossed, ChefHat, CreditCard,
  BarChart3, Users, HelpCircle, ShoppingBasket, ClipboardList, Sparkles, Truck, MessageCircle,
  Network, ShoppingCart,
} from 'lucide-react'

type SectionId =
  | 'intro' | 'primeiros-passos' | 'garcom' | 'cozinha' | 'caixa'
  | 'insumos' | 'produtos' | 'inventario' | 'relatorios' | 'usuarios'
  | 'entrada-inteligente' | 'ifood' | 'whatsapp'
  | 'multi-unidade' | 'faq'

const SECTIONS: { id: SectionId; label: string; icon: React.ElementType; group?: string }[] = [
  { id: 'intro',                label: 'Introdução',                icon: BookOpen },
  { id: 'primeiros-passos',     label: 'Primeiros Passos',          icon: Rocket },
  { id: 'garcom',               label: 'Atendimento (Garçom)',      icon: UtensilsCrossed },
  { id: 'cozinha',              label: 'Cozinha (KDS)',             icon: ChefHat },
  { id: 'caixa',                label: 'Caixa e Pagamentos',        icon: CreditCard },
  { id: 'insumos',              label: 'Insumos e Estoque',         icon: ShoppingBasket },
  { id: 'produtos',             label: 'Produtos e Cardápio',       icon: ChefHat },
  { id: 'inventario',           label: 'Inventário Físico',         icon: ClipboardList },
  { id: 'entrada-inteligente',  label: 'Entrada Inteligente (IA)',  icon: Sparkles },
  { id: 'relatorios',           label: 'Relatórios',                icon: BarChart3 },
  { id: 'usuarios',             label: 'Usuários e Acessos',        icon: Users },
  { id: 'ifood',                label: 'Integração iFood',          icon: Truck },
  { id: 'whatsapp',             label: 'WhatsApp',                  icon: MessageCircle },
  { id: 'multi-unidade',        label: 'Multi-Unidade (Rede)',      icon: Network, group: 'Enterprise' },
  { id: 'faq',                  label: 'Perguntas Frequentes',      icon: HelpCircle },
]

function Tag({ children, color = 'green' }: { children: React.ReactNode; color?: 'green' | 'blue' | 'amber' | 'red' }) {
  const map = {
    green: { bg: 'var(--tf-green-ok-bg)', color: 'var(--tf-green-ok)', border: 'var(--tf-green-ok)' },
    blue:  { bg: 'var(--tf-primary-bg)',  color: 'var(--tf-primary)',  border: 'var(--tf-primary-bd)' },
    amber: { bg: 'var(--tf-yellow-bg)',   color: '#b45309',            border: '#f59e0b' },
    red:   { bg: 'var(--tf-red-bg)',      color: 'var(--tf-red)',      border: 'var(--tf-red-bd)' },
  }
  const s = map[color]
  return (
    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.border}`, display: 'inline-block' }}>
      {children}
    </span>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--tf-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>
        {n}
      </div>
      <div>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 4 }}>{title}</p>
        <div style={{ fontSize: 13, color: 'var(--tf-txt2)', lineHeight: 1.6 }}>{children}</div>
      </div>
    </div>
  )
}

function Tip({ children, type = 'tip' }: { children: React.ReactNode; type?: 'tip' | 'warning' | 'info' }) {
  const map = {
    tip:     { bg: 'var(--tf-green-ok-bg)', border: 'var(--tf-green-ok)', label: 'Dica',      color: 'var(--tf-green-ok)' },
    warning: { bg: 'var(--tf-yellow-bg)',   border: '#f59e0b',            label: 'Atenção',   color: '#b45309' },
    info:    { bg: 'var(--tf-primary-bg)',  border: 'var(--tf-primary-bd)',label: 'Info',     color: 'var(--tf-primary)' },
  }
  const s = map[type]
  return (
    <div style={{ display: 'flex', gap: 10, padding: '10px 14px', borderRadius: 8, background: s.bg, border: `1px solid ${s.border}`, marginBottom: 16 }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: s.color, flexShrink: 0, paddingTop: 1 }}>{s.label}</span>
      <div style={{ fontSize: 12.5, color: 'var(--tf-txt2)', lineHeight: 1.6 }}>{children}</div>
    </div>
  )
}

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)', marginBottom: 4 }}>{children}</h2>
      {sub && <p style={{ fontSize: 13, color: 'var(--tf-txt3)' }}>{sub}</p>}
      <div style={{ height: 2, width: 40, background: 'var(--tf-primary)', borderRadius: 2, marginTop: 10 }} />
    </div>
  )
}

function Sub({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--tf-txt)', marginTop: 28, marginBottom: 12 }}>{children}</h3>
}

function Intro() {
  return (
    <>
      <SectionTitle sub="Uma visão geral do que é o sistema e como ele funciona">Introdução ao The Finance</SectionTitle>
      <p style={{ fontSize: 14, color: 'var(--tf-txt2)', lineHeight: 1.8, marginBottom: 20 }}>
        O <strong style={{ color: 'var(--tf-txt)' }}>The Finance</strong> é um sistema de gestão financeira e operacional para restaurantes. Ele integra em uma única plataforma o controle de pedidos, gestão de estoque, análise de custos (CMV) e relatórios gerenciais — tudo em tempo real.
      </p>

      <Sub>Módulos do Sistema</Sub>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 24 }}>
        {[
          { icon: UtensilsCrossed, label: 'PDV Garçom', desc: 'Registro de pedidos por mesa', color: '#2a9d6f' },
          { icon: ChefHat,         label: 'KDS Cozinha', desc: 'Gerenciamento de pedidos em tempo real', color: '#f59e0b' },
          { icon: CreditCard,      label: 'Caixa', desc: 'Fechamento e pagamento de contas', color: '#6366f1' },
          { icon: ShoppingBasket,  label: 'Estoque', desc: 'Controle de insumos e movimentações', color: '#ef4444' },
          { icon: BarChart3,       label: 'Relatórios', desc: 'Análises de vendas, CMV e operação', color: '#0ea5e9' },
          { icon: Users,           label: 'Equipe', desc: 'Usuários, cargos e permissões', color: '#8b5cf6' },
        ].map(({ icon: Icon, label, desc, color }) => (
          <div key={label} style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
            <Icon size={16} style={{ color, marginBottom: 6 }} />
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 2 }}>{label}</p>
            <p style={{ fontSize: 11.5, color: 'var(--tf-txt3)' }}>{desc}</p>
          </div>
        ))}
      </div>

      <Sub>Níveis de Acesso</Sub>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {[
          { role: 'SUPER_ADMIN', desc: 'Acesso total — configurações, usuários, relatórios, financeiro', color: 'red' as const },
          { role: 'ADMIN',       desc: 'Acesso completo ao restaurante — mesmas permissões do dono', color: 'blue' as const },
          { role: 'MANAGER',     desc: 'Acesso a relatórios, estoque e configurações — sem gestão de assinatura', color: 'amber' as const },
          { role: 'STAFF',       desc: 'Acesso limitado ao que o cargo personalizado permitir', color: 'green' as const },
        ].map(({ role, desc, color }) => (
          <div key={role} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Tag color={color}>{role}</Tag>
            <span style={{ fontSize: 13, color: 'var(--tf-txt2)', paddingTop: 2 }}>{desc}</span>
          </div>
        ))}
      </div>

      <Tip type="info">
        O PDV do garçom, a tela da cozinha e o caixa são acessados via URL separada (ex.: <code style={{ fontSize: 12, background: 'var(--tf-surface2)', padding: '1px 5px', borderRadius: 4 }}>/seu-restaurante/garcom</code>) com autenticação por PIN — sem precisar de e-mail ou senha.
      </Tip>
    </>
  )
}

function PrimeirosPassos() {
  return (
    <>
      <SectionTitle sub="Como configurar o sistema do zero até o primeiro pedido">Primeiros Passos</SectionTitle>
      <Tip type="warning">Siga a ordem abaixo. Produtos dependem de insumos; pedidos dependem de mesas e produtos.</Tip>

      <Step n={1} title="Faça o primeiro login">
        Acesse o sistema com o e-mail e senha enviados no convite. Se necessário, use o link <strong>Esqueceu a senha?</strong> para redefinir.
      </Step>
      <Step n={2} title="Configure os Ambientes e Mesas">
        Vá em <strong>Configurações → Restaurante</strong>. Na aba <strong>Ambientes</strong>, crie as seções do salão (ex.: Salão Principal, Varanda). Na aba <strong>Mesas</strong>, cadastre cada mesa informando número, identificador e capacidade.
      </Step>
      <Step n={3} title="Cadastre as Categorias">
        Antes de criar insumos e produtos, crie as categorias correspondentes. No módulo <strong>Estoque → Insumos</strong>, use o formulário &ldquo;Novo Insumo&rdquo; e clique em <strong>+ Nova categoria</strong> para criar categorias de ingredientes. Repita para produtos em <strong>Estoque → Produtos</strong>.
      </Step>
      <Step n={4} title="Cadastre os Insumos (ingredientes)">
        Em <strong>Estoque → Insumos</strong>, clique em <strong>Novo Insumo</strong>. Preencha: nome, categoria, unidade de medida, quantidade atual, quantidade mínima e custo unitário. Cada insumo cadastrado passa a ter controle automático de estoque.
      </Step>
      <Step n={5} title="Cadastre os Produtos (cardápio)">
        Em <strong>Estoque → Produtos</strong>, clique em <strong>Novo Produto</strong>. Defina nome, categoria, preço de venda e, na aba <strong>Receita</strong>, adicione os insumos que compõem o prato e suas quantidades. O sistema calcula o custo e a margem automaticamente.
      </Step>
      <Step n={6} title="Convide a sua equipe">
        Em <strong>Configurações → Usuários</strong>, clique em <strong>Convidar Funcionário</strong>. Informe nome, e-mail e cargo. O sistema envia um convite por e-mail. Para garçons e cozinheiros, configure também o PIN (veja a seção <em>Usuários e Acessos</em>).
      </Step>
      <Step n={7} title="Configure o PDV">
        Em <strong>Configurações → Restaurante → Configuração PDV</strong>, defina: taxa de serviço (%), cobranças extras e formas de pagamento aceitas (Dinheiro, Débito, Crédito, Pix).
      </Step>
      <Step n={8} title="Compartilhe os links de acesso">
        Em <strong>Configurações → Usuários</strong>, copie os links de acesso para sua equipe:
        <ul style={{ marginTop: 6, paddingLeft: 16, lineHeight: 2 }}>
          <li>Garçom: <code style={{ fontSize: 12, background: 'var(--tf-surface2)', padding: '1px 5px', borderRadius: 4 }}>/{'{slug}'}/garcom</code></li>
          <li>Cozinha: <code style={{ fontSize: 12, background: 'var(--tf-surface2)', padding: '1px 5px', borderRadius: 4 }}>/{'{slug}'}/cozinha</code></li>
          <li>Caixa: <code style={{ fontSize: 12, background: 'var(--tf-surface2)', padding: '1px 5px', borderRadius: 4 }}>/{'{slug}'}/caixa</code></li>
        </ul>
      </Step>
      <Tip>Abra as telas de Garçom, Cozinha e Caixa em dispositivos separados (tablets ou monitores) para o melhor fluxo operacional.</Tip>
    </>
  )
}

function Garcom() {
  return (
    <>
      <SectionTitle sub="Como usar o PDV do garçom para registrar pedidos">Atendimento (Garçom)</SectionTitle>
      <Tip type="info">Acesse via <code style={{ fontSize: 12 }}>/{'{slug}'}/garcom</code> — sem e-mail, apenas PIN.</Tip>

      <Step n={1} title="Selecione seu usuário">
        Na tela inicial, toque no seu avatar/nome na lista de usuários disponíveis.
      </Step>
      <Step n={2} title="Digite o PIN">
        Use o teclado numérico para inserir seu PIN de 4 dígitos. Em caso de erro, pressione o botão de apagar (<strong>⌫</strong>).
      </Step>
      <Step n={3} title="Selecione a mesa">
        A tela exibe todas as mesas do restaurante. As cores indicam o status:
        <ul style={{ marginTop: 6, paddingLeft: 16, lineHeight: 2 }}>
          <li><Tag color="green">Verde</Tag> — Mesa livre</li>
          <li><Tag color="amber">Âmbar</Tag> — Mesa ocupada (pedido em aberto)</li>
          <li><Tag color="blue">Roxo</Tag> — Mesa reservada</li>
        </ul>
        Toque na mesa desejada para abrir o cardápio.
      </Step>
      <Step n={4} title="Monte o pedido">
        No cardápio, os produtos estão organizados por categoria. Toque em um produto para adicioná-lo ao carrinho. Use <strong>+</strong> e <strong>-</strong> para ajustar a quantidade. Para deixar uma observação (ex.: sem cebola), toque no ícone de nota ao lado do item.
      </Step>
      <Step n={5} title="Envie o pedido para a cozinha">
        Revise o carrinho e toque em <strong>Enviar pedido</strong>. O pedido vai aparecer imediatamente na tela da cozinha com status <Tag>Aberto</Tag>.
      </Step>
      <Step n={6} title="Adicione itens a um pedido existente">
        Se a mesa já tem pedido aberto, o sistema carrega os itens existentes. Adicione novos produtos normalmente — eles são acrescentados ao pedido atual sem cancelar os anteriores.
      </Step>

      <Tip type="warning">
        Produtos com estoque insuficiente aparecem com visual acinzentado e não podem ser adicionados ao pedido. Registre uma entrada de estoque antes de atender.
      </Tip>
    </>
  )
}

function Cozinha() {
  return (
    <>
      <SectionTitle sub="Como usar a tela KDS para gerenciar pedidos em tempo real">Cozinha (KDS)</SectionTitle>
      <Tip type="info">Acesse via <code style={{ fontSize: 12 }}>/{'{slug}'}/cozinha</code>. A tela atualiza automaticamente via WebSocket — não é preciso recarregar.</Tip>

      <Step n={1} title="Faça o login com PIN">
        Selecione seu usuário na lista e insira o PIN de 4 dígitos.
      </Step>
      <Step n={2} title="Entenda os status dos pedidos">
        Os pedidos são exibidos em colunas conforme o status:
        <ul style={{ marginTop: 6, paddingLeft: 16, lineHeight: 2 }}>
          <li><Tag color="blue">Aberto</Tag> — Pedido recebido, aguardando preparo</li>
          <li><Tag color="amber">Em Preparo</Tag> — Cozinha iniciou o preparo</li>
          <li><Tag color="green">Pronto</Tag> — Pedido pronto para ser servido</li>
        </ul>
      </Step>
      <Step n={3} title="Avance o status do pedido">
        Toque no botão de avanço dentro do card do pedido para mover de <Tag color="blue">Aberto</Tag> → <Tag color="amber">Em Preparo</Tag> → <Tag color="green">Pronto</Tag>. O garçom e o caixa são notificados em tempo real.
      </Step>
      <Step n={4} title="Cancele um pedido (se necessário)">
        Use o botão de cancelar no card do pedido. O pedido é marcado como <Tag color="red">Cancelado</Tag> e a mesa é liberada.
      </Step>

      <Tip>Os pedidos mais antigos ficam no topo da fila — priorize-os para manter o tempo médio de preparo baixo. O horário de abertura do pedido é exibido em cada card.</Tip>
      <Tip type="warning">O cancelamento de pedidos não estorna automaticamente o estoque de insumos que já foram separados. Faça um ajuste manual em <strong>Estoque → Insumos</strong> se necessário.</Tip>
    </>
  )
}

function Caixa() {
  return (
    <>
      <SectionTitle sub="Como fechar contas e processar pagamentos">Caixa e Pagamentos</SectionTitle>
      <Tip type="info">Acesse via <code style={{ fontSize: 12 }}>/{'{slug}'}/caixa</code>. Apenas usuários com permissão de caixa conseguem finalizar pedidos.</Tip>

      <Step n={1} title="Selecione seu usuário e faça login com PIN">
        Mesmo fluxo do garçom: escolha seu nome na lista e insira o PIN.
      </Step>
      <Step n={2} title="Visualize as mesas com pedido aberto">
        A tela exibe as mesas ocupadas. Toque na mesa do cliente que deseja pagar.
      </Step>
      <Step n={3} title="Revise o pedido">
        Confira todos os itens consumidos, subtotal, taxa de serviço (se configurada) e total geral.
      </Step>
      <Step n={4} title="Selecione a forma de pagamento">
        Escolha entre as formas habilitadas: <strong>Dinheiro</strong>, <strong>Débito</strong>, <strong>Crédito</strong> ou <strong>Pix</strong>.
      </Step>
      <Step n={5} title="Finalize o pagamento">
        Confirme o pagamento. O pedido é marcado como <Tag color="green">Finalizado</Tag>, a mesa retorna ao status <Tag color="green">Livre</Tag> e o sistema registra automaticamente a baixa dos insumos utilizados.
      </Step>

      <Tip>As formas de pagamento disponíveis são configuradas em <strong>Configurações → Restaurante → Configuração PDV</strong>. Somente formas habilitadas aparecem na tela do caixa.</Tip>
    </>
  )
}

function Insumos() {
  return (
    <>
      <SectionTitle sub="Como gerenciar ingredientes, entradas, saídas e alertas de estoque">Insumos e Estoque</SectionTitle>

      <Sub>Cadastrar um novo insumo</Sub>
      <Step n={1} title="Acesse Estoque → Insumos e clique em Novo Insumo">
        Preencha: nome, categoria, unidade de medida (kg, L, un, etc.), quantidade atual e quantidade mínima. O campo <strong>Custo unitário</strong> define o preço inicial; a partir da primeira entrada com nota fiscal, o sistema usa o Custo Médio Ponderado (CMP).
      </Step>
      <Step n={2} title="Salve e acompanhe o status">
        Após salvar, o insumo aparece na lista com um badge de status:
        <ul style={{ marginTop: 6, paddingLeft: 16, lineHeight: 2 }}>
          <li><Tag color="green">OK</Tag> — Estoque adequado</li>
          <li><Tag color="amber">Reposição</Tag> — Abaixo do mínimo</li>
          <li><Tag color="red">Crítico</Tag> — Quantidade zero ou negativa</li>
        </ul>
      </Step>

      <Sub>Registrar movimentações</Sub>
      <Step n={3} title="Clique no ícone de movimentação ao lado do insumo">
        Escolha o tipo de movimentação:
        <ul style={{ marginTop: 6, paddingLeft: 16, lineHeight: 2 }}>
          <li><strong>Entrada</strong> — Compra ou recebimento de mercadoria</li>
          <li><strong>Saída</strong> — Consumo manual ou transferência</li>
          <li><strong>Ajuste</strong> — Correção de quantidade (positiva ou negativa)</li>
          <li><strong>Perda</strong> — Quebra, acidente ou descarte</li>
          <li><strong>Vencimento</strong> — Descarte por validade expirada</li>
          <li><strong>Uso interno</strong> — Consumo da equipe ou uso operacional</li>
        </ul>
      </Step>
      <Step n={4} title="Informe a quantidade e o motivo">
        Para entradas, informe o custo unitário da nota fiscal — o sistema recalcula o CMP automaticamente. Adicione um motivo para manter o histórico auditável.
      </Step>

      <Sub>Consultar o histórico</Sub>
      <Step n={5} title="Clique em Histórico ao lado do insumo">
        A tela exibe todas as movimentações com tipo, quantidade, custo unitário, custo total, motivo e data/hora.
      </Step>

      <Tip>O Dashboard exibe um alerta em vermelho quando há insumos abaixo do mínimo. Use-o como checklist diário antes de abrir o restaurante.</Tip>
      <Tip type="warning">A baixa automática de estoque ocorre apenas quando um pedido é <strong>finalizado</strong> no caixa. Pedidos cancelados <strong>não</strong> estornam o estoque automaticamente.</Tip>
    </>
  )
}

function Produtos() {
  return (
    <>
      <SectionTitle sub="Como cadastrar pratos, definir receitas e entender a margem de lucro">Produtos e Cardápio</SectionTitle>

      <Step n={1} title="Acesse Estoque → Produtos e clique em Novo Produto">
        Preencha: nome, categoria, preço de venda e status (ativo/inativo). Produtos inativos não aparecem para o garçom.
      </Step>
      <Step n={2} title="Defina a receita (composição)">
        Na aba <strong>Receita</strong> do formulário, adicione os insumos que compõem o prato. Para cada insumo, informe a quantidade utilizada por porção. Ex.: Margherita → Massa 250g + Molho 80ml + Queijo 100g.
      </Step>
      <Step n={3} title="Analise a margem de lucro">
        Após salvar, o sistema calcula automaticamente:
        <ul style={{ marginTop: 6, paddingLeft: 16, lineHeight: 2 }}>
          <li><strong>Custo</strong> = soma de (quantidade × CMP do insumo)</li>
          <li><strong>Margem R$</strong> = Preço de venda − Custo</li>
          <li><strong>Margem %</strong> = Margem R$ ÷ Preço de venda × 100</li>
        </ul>
        A cor da margem indica a saúde financeira do prato: <Tag color="green">≥30%</Tag> <Tag color="amber">≥15%</Tag> <Tag color="red">&lt;15%</Tag>.
      </Step>
      <Step n={4} title="Ative ou desative produtos">
        Use o toggle de status para remover temporariamente um prato do cardápio sem excluí-lo. Útil para produtos fora de temporada ou com insumo em falta.
      </Step>

      <Tip>Mantenha as receitas atualizadas. Quando o CMP de um insumo muda (nova compra com preço diferente), o custo e a margem de todos os produtos que usam esse insumo são recalculados automaticamente.</Tip>
      <Tip type="info">Um produto fica indisponível para o garçom automaticamente se qualquer um de seus insumos estiver com estoque zerado — mesmo que o produto esteja ativo.</Tip>
    </>
  )
}

function Inventario() {
  return (
    <>
      <SectionTitle sub="Como realizar contagens físicas e reconciliar o estoque">Inventário Físico</SectionTitle>
      <p style={{ fontSize: 14, color: 'var(--tf-txt2)', lineHeight: 1.8, marginBottom: 20 }}>
        O inventário físico permite comparar as quantidades reais (contadas fisicamente) com as quantidades no sistema, gerando ajustes automáticos nas diferenças encontradas.
      </p>

      <Step n={1} title="Acesse Estoque → Inventário e clique em Nova Contagem">
        Dê um nome à contagem (ex.: &ldquo;Inventário Semanal 29/05&rdquo;) e confirme. O sistema cria uma sessão com todos os insumos cadastrados.
      </Step>
      <Step n={2} title="Registre as quantidades contadas">
        Para cada insumo, insira a quantidade física encontrada. Você pode fazer isso em múltiplas sessões — o progresso é salvo automaticamente. Use a busca para localizar insumos rapidamente.
      </Step>
      <Step n={3} title="Acompanhe as diferenças">
        A coluna <strong>Diferença</strong> mostra a variação entre a quantidade do sistema e a contada:
        <ul style={{ marginTop: 6, paddingLeft: 16, lineHeight: 2 }}>
          <li><Tag color="green">Positivo</Tag> — Quantidade maior que o sistema (sobra)</li>
          <li><Tag color="red">Negativo</Tag> — Quantidade menor que o sistema (falta)</li>
        </ul>
      </Step>
      <Step n={4} title="Finalize a contagem">
        Quando todos os itens estiverem contados, clique em <strong>Finalizar Contagem</strong>. O sistema gera automaticamente movimentos de <em>Ajuste</em> para cada insumo com diferença, atualizando o estoque para refletir a realidade física.
      </Step>

      <Tip type="warning">A finalização é irreversível. Revise as diferenças antes de confirmar — especialmente diferenças grandes, que podem indicar erro de contagem.</Tip>
      <Tip>Realize inventários semanais ou quinzenais para manter o estoque do sistema alinhado com a realidade e detectar perdas ocultas.</Tip>
    </>
  )
}

function Relatorios() {
  return (
    <>
      <SectionTitle sub="Como analisar vendas, custos e performance operacional">Relatórios</SectionTitle>
      <Tip type="info">Acesso restrito a <Tag color="red">SUPER_ADMIN</Tag> <Tag color="blue">ADMIN</Tag> <Tag color="amber">MANAGER</Tag>.</Tip>

      <p style={{ fontSize: 14, color: 'var(--tf-txt2)', lineHeight: 1.8, marginBottom: 20 }}>
        Na barra de filtros, selecione o período desejado (Hoje, Esta semana, Este mês, Este ano ou data personalizada). Clique em <strong>Atualizar</strong> para forçar um novo carregamento dos dados.
      </p>

      {[
        { title: 'Visão Geral de Vendas', desc: 'KPIs principais: Total de Vendas, Nº de Pedidos, Ticket Médio e CMV%. Inclui gráfico de área com evolução diária das vendas, gráfico de distribuição por categoria e tabela de resumo diário ordenável.' },
        { title: 'Vendas por Produto', desc: 'Ranking de produtos por receita. Gráfico de barras horizontal com receita vs. custo. Tabela com margem individual, quantidade vendida, ticket médio e classificação ABC de cada prato.' },
        { title: 'Comparativo de Períodos', desc: 'Selecione dois períodos independentes e compare métricas lado a lado (vendas, pedidos, ticket médio, CMV, margem). Gráfico de linha sobrepõe os dois períodos para identificar tendências.' },
        { title: 'Vendas por Operador', desc: 'Desempenho individual dos garçons: pedidos realizados, receita gerada, ticket médio, horário de pico e taxa de cancelamento.' },
        { title: 'Giro de Estoque', desc: 'Mede a velocidade de consumo de cada insumo. Classificação: Alta (giro > 2), Média (0,5–2), Baixa (< 0,5) e Parado (sem movimentação no período). Alerta destacado para insumos parados.' },
        { title: 'Curva ABC de Insumos', desc: 'Análise de Pareto dos insumos por valor consumido. Classe A = 80% do custo, B = 15%, C = 5%. Permite focar o controle nos itens de maior impacto financeiro.' },
        { title: 'CMV Detalhado', desc: 'Custo da Mercadoria Vendida por produto e categoria. Linha de referência em 35% no gráfico histórico. Alerta automático quando CMV ultrapassa 35% por 3+ dias consecutivos.' },
        { title: 'Desempenho da Cozinha', desc: 'Tempo médio de preparo por prato e por turno (Manhã/Tarde/Noite). Heatmap de pedidos por hora e dia da semana. Lista de pedidos cancelados no período.' },
      ].map(({ title, desc }, i) => (
        <div key={title} style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--tf-primary-bg)', color: 'var(--tf-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, border: '1px solid var(--tf-primary-bd)' }}>
            {i + 1}
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 3 }}>{title}</p>
            <p style={{ fontSize: 12.5, color: 'var(--tf-txt2)', lineHeight: 1.6 }}>{desc}</p>
          </div>
        </div>
      ))}

      <Sub>Exportação de Dados</Sub>
      <p style={{ fontSize: 13, color: 'var(--tf-txt2)', lineHeight: 1.7, marginBottom: 12 }}>
        Use o botão <strong>Exportar</strong> na barra de filtros para baixar os dados do relatório ativo:
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 3 }}>CSV</p>
          <p style={{ fontSize: 11.5, color: 'var(--tf-txt3)' }}>Separador ponto-e-vírgula, com BOM UTF-8. Abre corretamente no Excel em PT-BR.</p>
        </div>
        <div style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 3 }}>Excel (.xlsx)</p>
          <p style={{ fontSize: 11.5, color: 'var(--tf-txt3)' }}>Arquivo com aba &ldquo;Resumo Executivo&rdquo; e abas individuais por relatório.</p>
        </div>
        <div style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 3 }}>PDF</p>
          <p style={{ fontSize: 11.5, color: 'var(--tf-txt3)' }}>Documento formatado com nome do restaurante, período e tabela de KPIs.</p>
        </div>
      </div>
    </>
  )
}

function Usuarios() {
  return (
    <>
      <SectionTitle sub="Como gerenciar a equipe, definir acessos e configurar PINs">Usuários e Acessos</SectionTitle>

      <Sub>Convidar um novo funcionário</Sub>
      <Step n={1} title="Acesse Configurações → Usuários e clique em Convidar Funcionário">
        Preencha o nome, e-mail e o cargo do funcionário. O sistema envia um e-mail de convite com um link de acesso temporário.
      </Step>
      <Step n={2} title="O funcionário aceita o convite">
        Ao clicar no link, o funcionário define sua própria senha e é redirecionado ao dashboard. O status muda de <Tag color="amber">Pendente</Tag> para <Tag color="green">Ativo</Tag>.
      </Step>

      <Sub>Configurar PIN de acesso (Garçom / Cozinha / Caixa)</Sub>
      <Step n={3} title="Acesse Configurações → Usuários e clique no usuário">
        Na linha do funcionário, clique no ícone de ações e selecione <strong>Redefinir PIN</strong>.
      </Step>
      <Step n={4} title="Defina ou envie o PIN">
        O PIN tem 4 dígitos. Defina um PIN provisório e informe ao funcionário pessoalmente — por segurança, o sistema não envia PINs por e-mail.
      </Step>
      <Tip type="warning">O PIN é diferente da senha do dashboard. Um garçom pode ter PIN para o PDV mas não ter acesso ao painel administrativo.</Tip>

      <Sub>Criar um cargo personalizado</Sub>
      <Step n={5} title="Na aba Cargos e Permissões, clique em Novo Cargo">
        Dê um nome ao cargo (ex.: &ldquo;Auxiliar de Estoque&rdquo;) e selecione as permissões desejadas organizadas por módulo: Estoque, Produtos, Usuários, Relatórios, Configurações e Cozinha.
      </Step>
      <Step n={6} title="Atribua o cargo a usuários">
        Na aba Funcionários, edite o usuário desejado e altere o cargo para o novo cargo criado.
      </Step>

      <Sub>Links de acesso para a equipe</Sub>
      <p style={{ fontSize: 13, color: 'var(--tf-txt2)', lineHeight: 1.7, marginBottom: 12 }}>
        Na parte inferior da tela de Usuários, você encontra os links prontos para copiar e compartilhar com a equipe via WhatsApp ou fixar no dispositivo do salão:
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { label: 'Garçom', path: '/{slug}/garcom' },
          { label: 'Cozinha', path: '/{slug}/cozinha' },
          { label: 'Caixa', path: '/{slug}/caixa' },
          { label: 'Estoque', path: '/{slug}/estoque' },
        ].map(({ label, path }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderRadius: 7, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tf-txt)', width: 70 }}>{label}</span>
            <code style={{ fontSize: 12, color: 'var(--tf-txt3)', background: 'var(--tf-surface2)', padding: '2px 7px', borderRadius: 4 }}>{path}</code>
          </div>
        ))}
      </div>
    </>
  )
}

function EntradaInteligente() {
  return (
    <>
      <SectionTitle sub="Como usar a IA para lançar entradas de estoque a partir de Notas Fiscais">
        Entrada Inteligente de Estoque (IA)
      </SectionTitle>

      <Tip type="info">
        Acesse em <strong>Estoque → Entrada Inteligente</strong>. A IA lê a Nota Fiscal (foto, PDF ou texto) e
        sugere o lançamento no estoque automaticamente — você só revisa e confirma.
      </Tip>

      <Sub>Como funciona</Sub>
      <Step n={1} title="Envie a Nota Fiscal">
        Você tem três opções:
        <ul style={{ marginTop: 6, paddingLeft: 16, lineHeight: 2 }}>
          <li><strong>Foto / Imagem</strong> — Arraste ou clique na área de upload (JPG, PNG, HEIC — máx 10MB). Em dispositivos móveis, use o botão &ldquo;Tirar foto&rdquo; para fotografar a NF diretamente.</li>
          <li><strong>PDF</strong> — Faça upload do arquivo PDF da nota fiscal (máx 10MB).</li>
          <li><strong>Texto</strong> — Clique em &ldquo;Descrever em texto&rdquo; e descreva os itens manualmente (ex.: <em>5kg Farinha de Trigo R$22,50</em>).</li>
        </ul>
      </Step>
      <Step n={2} title="Aguarde o processamento">
        Após clicar em <strong>Processar com IA</strong>, o sistema envia o arquivo para a fila de processamento.
        A IA (Google Gemini) lê a nota e extrai: fornecedor, número da NF, data de emissão, valor total e todos os itens com quantidade e custo.
        O resultado aparece na zona direita da tela automaticamente — normalmente em 5 a 20 segundos.
      </Step>
      <Step n={3} title="Revise os itens extraídos">
        A tabela de revisão exibe cada item da NF com:
        <ul style={{ marginTop: 6, paddingLeft: 16, lineHeight: 2 }}>
          <li><strong>Descrição original</strong> — texto exato da NF (não editável)</li>
          <li><strong>Insumo no sistema</strong> — sugestão automática com badge de confiança:<br />
            <Tag color="green">Verde</Tag> ≥ 80% — match confiável &nbsp;|&nbsp;
            <Tag color="amber">Âmbar</Tag> ≥ 50% — verifique &nbsp;|&nbsp;
            <Tag color="red">Cinza</Tag> &lt; 50% — selecione manualmente
          </li>
          <li><strong>Quantidade e Custo</strong> — editáveis caso a IA tenha lido errado</li>
          <li><strong>Toggle incluir/ignorar</strong> — exclua itens não relevantes</li>
        </ul>
        Ajuste o fornecedor, número da NF e data de recebimento nos campos superiores.
      </Step>
      <Step n={4} title="Confirme o lançamento">
        Clique em <strong>Confirmar lançamento</strong>. O sistema:
        <ul style={{ marginTop: 6, paddingLeft: 16, lineHeight: 2 }}>
          <li>Cria movimentos de <em>Entrada</em> no estoque para cada item incluído</li>
          <li>Recalcula o Custo Médio Ponderado (CMP) de cada insumo</li>
          <li>Registra a NF em <strong>Estoque → Notas Fiscais</strong> para consulta futura</li>
        </ul>
      </Step>

      <Sub>Chat Assistente de Estoque</Sub>
      <p style={{ fontSize: 13, color: 'var(--tf-txt2)', lineHeight: 1.7, marginBottom: 12 }}>
        O ícone de chat flutuante no canto inferior direito de qualquer página de estoque abre o assistente de IA.
        Ele tem acesso em tempo real ao seu estoque, movimentações recentes e alertas ativos.
      </p>
      <p style={{ fontSize: 13, color: 'var(--tf-txt2)', lineHeight: 1.7, marginBottom: 12 }}>
        Exemplos de perguntas:
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {[
          'Quais insumos estão abaixo do estoque mínimo?',
          'Qual foi o último preço de compra da farinha de trigo?',
          'Quantas entradas de estoque foram feitas esta semana?',
          'Quais alertas estão ativos agora?',
        ].map((q) => (
          <div key={q} style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)', fontSize: 12.5, color: 'var(--tf-txt2)', fontStyle: 'italic' }}>
            &ldquo;{q}&rdquo;
          </div>
        ))}
      </div>

      <Sub>Histórico de Notas Fiscais</Sub>
      <p style={{ fontSize: 13, color: 'var(--tf-txt2)', lineHeight: 1.7, marginBottom: 12 }}>
        Acesse <strong>Estoque → Notas Fiscais</strong> para ver todas as NFs processadas. Filtre por fornecedor,
        período ou tipo de entrada. Use o botão <strong>Reprocessar</strong> para re-enviar uma NF ao agente sem
        precisar fazer upload novamente (disponível apenas para entradas via arquivo).
      </p>

      <Tip type="warning">
        O sistema tem um limite mensal de tokens de IA por plano. A barra de progresso discreta no rodapé do chat mostra o uso atual. Ao atingir 100%, o processamento de NFs e o chat ficam indisponíveis até o dia 1 do próximo mês.
      </Tip>
      <Tip>
        Para melhor resultado na extração, fotografe a NF com boa iluminação e certifique-se de que o texto esteja legível. Imagens borradas ou com muito reflexo podem reduzir a precisão da extração.
      </Tip>
    </>
  )
}

function IFoodHelp() {
  return (
    <>
      <SectionTitle sub="Como conectar e gerenciar pedidos recebidos pelo iFood">Integração iFood</SectionTitle>
      <Tip type="info">
        Acesse a configuração em <strong>Configurações → Integrações → iFood</strong>. Você precisa de credenciais de API geradas no Portal iFood Parceiros.
      </Tip>

      <Sub>Conectar ao iFood</Sub>
      <Step n={1} title="Acesse o Portal iFood Parceiros">
        Navegue até <strong>portal.ifood.com.br/apps</strong>, faça login com sua conta de restaurante e crie um novo aplicativo. Copie o <strong>Client ID</strong> e o <strong>Client Secret</strong> gerados.
      </Step>
      <Step n={2} title="Informe as credenciais no The Finance">
        Em <strong>Configurações → Integrações → iFood</strong>, siga o assistente de 5 passos: cole o Client ID e Client Secret, clique em <strong>Conectar</strong> e selecione a loja correta.
      </Step>
      <Step n={3} title="Confirme a integração">
        Após conectar, um card de status exibe <Tag color="green">Conectado</Tag> com o Merchant ID e a última sincronização. A partir daí, pedidos do iFood chegam automaticamente na cozinha.
      </Step>

      <Sub>Recebimento de Pedidos</Sub>
      <Step n={4} title="Pedidos aparecem no KDS com badge laranja 'iFood'">
        Assim que um cliente faz um pedido no iFood, ele aparece em tempo real na tela da cozinha. O card exibe o endereço de entrega no rodapé e a referência do pedido.
      </Step>
      <Step n={5} title="Confirmação automática">
        O sistema confirma automaticamente o pedido no iFood após 30 segundos, salvo se você rejeitar manualmente antes disso.
      </Step>
      <Step n={6} title="Rejeitar um pedido">
        No card do pedido iFood no KDS, clique em <strong>Rejeitar</strong>, selecione o motivo (Item indisponível, Problema operacional ou Restaurante fechado) e confirme.
      </Step>

      <Tip type="warning">
        O cronômetro do pedido fica vermelho após 8 minutos — sinal de que o tempo de preparo está além do recomendado pelo iFood.
      </Tip>

      <Sub>Mapeamento de Cardápio</Sub>
      <Step n={7} title="Acesse Configurações → Integrações → iFood → Cardápio">
        A tela lista todos os itens do seu cardápio no iFood. Para cada item, selecione o produto correspondente no The Finance. Itens sem vínculo aparecem com badge vermelho <Tag color="red">Não mapeado</Tag> — eles chegam no KDS mas não descontam estoque automaticamente.
      </Step>
      <Step n={8} title="Salve os mapeamentos">
        Clique em <strong>Salvar mapeamentos</strong>. A partir daí, ao receber um pedido iFood, o estoque dos insumos é descontado automaticamente pela ficha técnica de cada produto vinculado.
      </Step>

      <Sub>Sincronização de Disponibilidade</Sub>
      <p style={{ fontSize: 13, color: 'var(--tf-txt2)', lineHeight: 1.7, marginBottom: 16 }}>
        A cada 30 minutos, o sistema verifica se os insumos dos produtos mapeados têm estoque suficiente. Se um insumo zerar, o item correspondente é <strong>pausado automaticamente no iFood</strong> — evitando pedidos de itens que você não consegue preparar. Quando o estoque é reposto, o item é reativado.
      </p>
      <Tip>Você pode pausar ou reativar itens manualmente na tela de mapeamento de cardápio, sem precisar aguardar a sincronização automática.</Tip>

      <Sub>Relatório de Delivery</Sub>
      <p style={{ fontSize: 13, color: 'var(--tf-txt2)', lineHeight: 1.7, marginBottom: 16 }}>
        Em <strong>Relatórios → Delivery</strong> você encontra: total de pedidos, receita bruta, comissão iFood, receita líquida, ticket médio, taxa de rejeição, distribuição de vendas por canal (iFood vs. presencial) e os 5 produtos mais pedidos pelo delivery.
      </p>

      <Sub>Desconectar</Sub>
      <p style={{ fontSize: 13, color: 'var(--tf-txt2)', lineHeight: 1.7, marginBottom: 16 }}>
        Para desconectar, clique em <strong>Desconectar iFood</strong> no card de status e confirme. Os pedidos já recebidos continuam no histórico. Você pode reconectar a qualquer momento informando as credenciais novamente.
      </p>
      <Tip type="warning">Ao desconectar, a sincronização automática de disponibilidade é interrompida. Itens pausados no iFood não serão reativados automaticamente — faça isso manualmente no Portal iFood Parceiros.</Tip>
    </>
  )
}

function WhatsAppHelp() {
  return (
    <>
      <SectionTitle sub="Receba alertas no celular e cadastre itens pelo WhatsApp">WhatsApp</SectionTitle>
      <p style={{ fontSize: 14, color: 'var(--tf-txt2)', lineHeight: 1.8, marginBottom: 20 }}>
        O The Finance envia notificações diretamente para o WhatsApp do responsável pelo restaurante. Você também pode cadastrar insumos e produtos sem precisar abrir o sistema — basta enviar uma mensagem.
      </p>

      <Sub>1. Cadastre seu número</Sub>
      <Step n={1} title="Acesse Configurações → WhatsApp e clique em Adicionar contato">
        Preencha seu nome e número no formato internacional:
        <code style={{ fontSize: 12, background: 'var(--tf-surface2)', padding: '2px 7px', borderRadius: 4, margin: '0 4px' }}>+5511999999999</code>
        (código do país + DDD + número, sem espaços).
      </Step>
      <Step n={2} title="Escolha o que deseja receber">
        Ao adicionar o contato, selecione as opções:
        <ul style={{ marginTop: 6, paddingLeft: 16, lineHeight: 2.2 }}>
          <li>
            <strong>Recebe alertas críticos</strong> — você é avisado quando o estoque de algum insumo zera, o CMV do dia está alto ou outro alerta importante é gerado.
          </li>
          <li>
            <strong>Recebe resumo diário (23h)</strong> — todo dia às 23h chega um resumo automático com as vendas do dia, ticket médio, CMV e o produto mais vendido.
          </li>
          <li>
            <strong>Permite comandos ao bot</strong> — ative somente se quiser usar o WhatsApp para cadastrar insumos e produtos (veja abaixo).
          </li>
        </ul>
      </Step>
      <Step n={3} title="Clique em Salvar e envie uma mensagem de teste">
        Use o botão <strong>Enviar teste</strong> para confirmar que o número está recebendo corretamente. Se a mensagem chegar, está tudo configurado.
      </Step>

      <Tip>Você pode cadastrar mais de um número — por exemplo, o dono e o gerente do restaurante podem receber os alertas ao mesmo tempo.</Tip>

      <Sub>2. Cadastre insumos e produtos pelo WhatsApp</Sub>
      <p style={{ fontSize: 13, color: 'var(--tf-txt2)', lineHeight: 1.7, marginBottom: 14 }}>
        Com a opção <strong>Permite comandos ao bot</strong> ativada no seu contato, você pode enviar mensagens para o número do sistema e o bot cuida do cadastro automaticamente.
      </p>

      <Step n={4} title="Cadastrar um novo insumo">
        Envie uma mensagem com nome, unidade de medida e custo:
        <div style={{ margin: '10px 0', padding: '10px 14px', borderRadius: 8, background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', fontFamily: 'monospace', fontSize: 13, color: 'var(--tf-txt)' }}>
          Novo insumo: Farinha de trigo, kg, R$ 4,50
        </div>
        O bot vai responder com um resumo do que entendeu. Confirme com <strong>SIM</strong> para salvar ou <strong>NÃO</strong> para cancelar. O insumo aparece imediatamente em <strong>Estoque → Insumos</strong>.
      </Step>

      <Step n={5} title="Cadastrar um novo produto">
        Envie o nome do produto seguido dos ingredientes e quantidades:
        <div style={{ margin: '10px 0', padding: '10px 14px', borderRadius: 8, background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', fontFamily: 'monospace', fontSize: 13, color: 'var(--tf-txt)' }}>
          Novo produto: X-Burguer | pão 1un, carne 150g, queijo 2un
        </div>
        O bot verifica se os insumos já estão cadastrados e monta a ficha técnica. Confirme com <strong>SIM</strong> — o produto aparece em <strong>Estoque → Produtos</strong>.
      </Step>

      <Tip type="warning">
        Os insumos da ficha técnica precisam já estar cadastrados no estoque antes de criar o produto. Se algum não for encontrado, o bot avisa quais estão faltando.
      </Tip>
      <Tip>
        Não lembra do formato? Basta mandar qualquer mensagem — o bot responde com exemplos de como usar.
      </Tip>

      <Sub>O que cada notificação inclui</Sub>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Alerta crítico', desc: 'Nome do alerta, descrição do problema e link direto para a página de alertas.', color: '#e05252' },
          { label: 'Alerta alto', desc: 'Mesmo formato do crítico, mas para situações de atenção (estoque baixo, CMV acima do ideal).', color: '#f97316' },
          { label: 'Resumo diário (23h)', desc: 'Vendas totais, número de pedidos, ticket médio, CMV% e produto mais vendido no dia.', color: '#2a9d6f' },
          { label: 'Novo pedido iFood', desc: 'Referência do pedido, valor e endereço de entrega — enviado quando um pedido chega pelo iFood.', color: '#f97316' },
        ].map(({ label, desc, color }) => (
          <div key={label} style={{ display: 'flex', gap: 12, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
            <div style={{ width: 8, borderRadius: 4, background: color, flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 2 }}>{label}</p>
              <p style={{ fontSize: 12.5, color: 'var(--tf-txt2)' }}>{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <Tip type="info">
        O histórico das últimas 50 mensagens enviadas fica disponível em <strong>Configurações → WhatsApp → Histórico</strong>, com data, tipo e status de entrega de cada mensagem.
      </Tip>
    </>
  )
}

function MultiUnidade() {
  return (
    <>
      <SectionTitle sub="Gerencie múltiplas unidades da sua rede em um painel unificado">
        Multi-Unidade (Rede)
      </SectionTitle>
      <Tip type="info">
        Disponível exclusivamente no plano <strong>Enterprise</strong>. O módulo de rede aparece automaticamente no header quando sua conta está vinculada a uma Brand.
      </Tip>

      <Sub>O que é o módulo Multi-Unidade?</Sub>
      <p style={{ fontSize: 14, color: 'var(--tf-txt2)', lineHeight: 1.8, marginBottom: 20 }}>
        O módulo Multi-Unidade permite que donos de redes de restaurantes gerenciem todas as suas unidades em um painel consolidado. É possível comparar desempenho entre unidades, compartilhar cardápio, centralizar compras e visualizar relatórios agregados — sem precisar acessar cada unidade individualmente.
      </p>

      <Sub>Acessar o painel da rede</Sub>
      <Step n={1} title="Clique no ícone de rede no header">
        Ao lado do nome do restaurante, um ícone de rede (<strong>⬡</strong>) indica que você está em uma conta multi-unidade. Clique nele para abrir o seletor de unidades.
      </Step>
      <Step n={2} title="Escolha 'Visão consolidada'">
        A primeira opção do dropdown é <strong>Visão consolidada →</strong>. Ao clicar, você é levado ao <strong>/rede/dashboard</strong>, o painel central da rede. Para voltar a uma unidade específica, selecione-a no mesmo dropdown.
      </Step>

      <Sub>Dashboard Consolidado</Sub>
      <p style={{ fontSize: 13, color: 'var(--tf-txt2)', lineHeight: 1.7, marginBottom: 12 }}>
        Em <strong>/rede/dashboard</strong> você encontra:
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {[
          { label: '4 KPI cards', desc: 'Vendas totais, Total de pedidos, Ticket médio e CMV% — somados de todas as unidades no período selecionado.' },
          { label: 'Destaques', desc: 'Card da melhor unidade (badge verde) e da unidade em atenção (badge âmbar), identificadas automaticamente por faturamento.' },
          { label: 'Tabela comparativa', desc: 'Lista todas as unidades com Vendas, Pedidos, Ticket Médio, CMV% e alertas ativos. Clique em uma linha para ir direto ao dashboard daquela unidade.' },
          { label: 'Gráfico comparativo', desc: 'BarChart agrupado com toggle entre Vendas, Pedidos, CMV e Ticket Médio. Visualize qual unidade lidera em cada métrica.' },
          { label: 'Mapa', desc: 'Mapa Google Maps Embed com marcadores coloridos por performance (verde/âmbar/vermelho) — configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.' },
        ].map(({ label, desc }) => (
          <div key={label} style={{ display: 'flex', gap: 10, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--tf-primary)', flexShrink: 0, paddingTop: 2 }}>★</span>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 2 }}>{label}</p>
              <p style={{ fontSize: 12.5, color: 'var(--tf-txt2)' }}>{desc}</p>
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--tf-txt3)', marginBottom: 20 }}>
        Use os botões de período no topo (7d, 15d, 30d, 90d) para filtrar os dados de todas as seções da tela.
      </p>

      <Sub>Cardápio Compartilhado</Sub>
      <p style={{ fontSize: 13, color: 'var(--tf-txt2)', lineHeight: 1.7, marginBottom: 12 }}>
        Em <strong>/rede/cardapio</strong> você gerencia o cardápio centralizado da rede com duas abas:
      </p>
      <Step n={3} title="Aba 'Cardápio da rede'">
        Crie e edite produtos que são compartilhados com todas as unidades. Use o botão <strong>＋ Novo produto da rede</strong> para cadastrar um item. O botão <strong>Sincronizar</strong> ao lado de cada produto limpa os overrides de preço de todas as unidades, fazendo-as usar o preço base da rede.
      </Step>
      <Step n={4} title="Aba 'Overrides por unidade'">
        Selecione uma unidade e ajuste preços individualmente. Digite um preço override no campo — ele tem prioridade sobre o preço base da rede naquela unidade. Deixe vazio para usar o preço da rede. Use o toggle para ativar/desativar o produto em cada unidade.
      </Step>

      <Sub>Compras Centralizadas</Sub>
      <p style={{ fontSize: 13, color: 'var(--tf-txt2)', lineHeight: 1.7, marginBottom: 12 }}>
        Em <strong>/rede/compras</strong> o sistema consolida automaticamente as necessidades de compra de todas as unidades:
      </p>
      <Step n={5} title="Gerar pedido consolidado">
        Selecione o fornecedor e clique em <strong>Gerar pedido de compra</strong>. O sistema varre os alertas de estoque ativos em todas as unidades, agrupa por insumo (somando as quantidades necessárias) e cria um pedido único consolidado. Cada item registra de quais unidades a necessidade vem e em que quantidade.
      </Step>
      <Step n={6} title="Exportar o pedido">
        No histórico de pedidos, use os botões de ação para:
        <ul style={{ marginTop: 6, paddingLeft: 16, lineHeight: 2 }}>
          <li><strong>PDF</strong> — Documento formatado com itens, quantidades e distribuição por unidade</li>
          <li><strong>Excel</strong> — Planilha com todos os itens para enviar ao fornecedor</li>
          <li><strong>✓ Marcar recebido</strong> — Atualiza o status do pedido para Recebido</li>
        </ul>
      </Step>

      <Sub>Relatórios de Benchmark</Sub>
      <p style={{ fontSize: 13, color: 'var(--tf-txt2)', lineHeight: 1.7, marginBottom: 12 }}>
        Em <strong>/rede/relatorios</strong> você acessa o benchmark comparativo entre unidades:
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {[
          { label: 'CMV %', desc: 'Menor CMV% = líder (usa menos custo para gerar receita). Badge "Líder" na melhor unidade.' },
          { label: 'Ticket Médio', desc: 'Maior ticket = líder. Unidades com ticket abaixo de 80% da média ganham badge "Abaixo da média".' },
          { label: 'Margem Bruta %', desc: 'Maior margem = líder. Calculada como 100% − CMV%.' },
          { label: 'Linha de média da rede', desc: 'Rodapé da tabela exibe os valores médios da rede para cada coluna.' },
        ].map(({ label, desc }) => (
          <div key={label} style={{ display: 'flex', gap: 10 }}>
            <Tag color="blue">{label}</Tag>
            <span style={{ fontSize: 13, color: 'var(--tf-txt2)', paddingTop: 2 }}>{desc}</span>
          </div>
        ))}
      </div>

      <Tip type="warning">
        As métricas do dashboard consolidado são calculadas a partir dos snapshots diários de cada unidade. Se uma unidade não tiver movimentação no período selecionado, ela aparece com valores zero na tabela comparativa — isso é normal e não indica erro.
      </Tip>
      <Tip>
        Para que o Mapa exiba os marcadores corretamente, cada unidade precisa ter coordenadas de geolocalização configuradas. Isso é feito pelo Super Admin ao registrar as unidades na Brand.
      </Tip>
    </>
  )
}

function Faq() {
  const items = [
    {
      q: 'Por que um produto aparece como indisponível para o garçom?',
      a: 'O produto fica indisponível automaticamente quando qualquer insumo da sua receita está com estoque zerado. Registre uma entrada do insumo em falta em Estoque → Insumos e o produto volta a ficar disponível.',
    },
    {
      q: 'O garçom não consegue fazer login com o PIN. O que fazer?',
      a: 'Verifique se o usuário tem status Ativo em Configurações → Usuários. Se o PIN foi esquecido, clique em Redefinir PIN no menu de ações do usuário e defina um novo. Lembre-se de que o PIN tem exatamente 4 dígitos.',
    },
    {
      q: 'Como alterar o preço de venda de um produto?',
      a: 'Acesse Estoque → Produtos, clique no ícone de edição (lápis) ao lado do produto e altere o campo Preço de venda. A margem é recalculada automaticamente.',
    },
    {
      q: 'O que é CMV e qual o benchmark saudável?',
      a: 'CMV (Custo da Mercadoria Vendida) é o percentual do custo dos insumos sobre a receita total. Para restaurantes, o benchmark ideal fica entre 25% e 35%. Valores acima de 35% indicam que os custos estão altos — reveja preços ou fornecedores. O sistema sinaliza isso automaticamente nos relatórios.',
    },
    {
      q: 'O que é a Curva ABC?',
      a: 'É uma análise de Pareto dos insumos. Classe A: ~20% dos insumos que representam 80% do custo total — merecem controle rigoroso. Classe B: próximos 15% do custo. Classe C: últimos 5% — baixo impacto financeiro. Foque o controle nos itens Classe A.',
    },
    {
      q: 'Como gerar o link de acesso para minha equipe?',
      a: 'Acesse Configurações → Usuários. Na seção inferior da página, você encontra os links prontos para Garçom, Cozinha, Caixa e Estoque, com botão de copiar. Compartilhe via WhatsApp ou salve no dispositivo do salão.',
    },
    {
      q: 'Posso usar o sistema em tablet ou celular?',
      a: 'Sim. As telas de Garçom, Cozinha e Caixa são otimizadas para dispositivos touch. O dashboard administrativo funciona melhor em telas maiores (notebook ou monitor), mas é acessível em qualquer dispositivo.',
    },
    {
      q: 'Como reativar um funcionário desligado?',
      a: 'Acesse Configurações → Usuários, localize o usuário com status Inativo e clique no ícone de ações → Reativar. O acesso é restaurado imediatamente.',
    },
    {
      q: 'O inventário físico desconta o estoque dos pedidos em andamento?',
      a: 'Não. O inventário registra a quantidade contada como o novo valor de estoque, gerando um ajuste na diferença. Pedidos em andamento que ainda não foram finalizados no caixa não são considerados — a baixa de insumos só ocorre ao finalizar o pedido.',
    },
    {
      q: 'Como exportar relatórios para o Excel com formatação correta?',
      a: 'Use a opção Exportar → Excel (.xlsx) na barra de filtros dos relatórios. O arquivo é gerado com separador adequado e codificação correta para PT-BR. Para CSV, o arquivo inclui BOM UTF-8 — abra-o diretamente no Excel sem conversão.',
    },
    {
      q: 'A IA não reconheceu corretamente os itens da NF. O que fazer?',
      a: 'A tabela de revisão é totalmente editável. Selecione manualmente o insumo correto no combobox de cada linha, ajuste quantidade e custo se necessário, e desmarque itens que não devem ser lançados. Para fotos, verifique se a imagem está nítida e bem iluminada — isso melhora muito a precisão da extração.',
    },
    {
      q: 'O badge de confiança ficou cinza (< 50%). O que significa?',
      a: 'Significa que o sistema não encontrou um insumo com nome similar ao item da NF. Isso acontece quando o produto ainda não foi cadastrado no estoque ou quando a descrição na NF é muito diferente do nome no sistema. Selecione o insumo correto manualmente no combobox antes de confirmar o lançamento.',
    },
    {
      q: 'Atingi o limite de IA do mês. Quando volta a funcionar?',
      a: 'O limite é resetado automaticamente no dia 1 de cada mês. Enquanto isso, você ainda pode lançar entradas manualmente em Estoque → Insumos → Registrar Movimentação. O histórico de NFs anteriores continua acessível.',
    },
    {
      q: 'Como acesso o painel da rede (Multi-Unidade)?',
      a: 'Clique no ícone de rede (⬡) no header ao lado do nome do restaurante e selecione "Visão consolidada". Se o ícone não aparecer, sua conta não está vinculada a uma Brand Enterprise — entre em contato com o suporte.',
    },
    {
      q: 'Por que o gráfico do dashboard consolidado está vazio?',
      a: 'O dashboard usa snapshots diários. Se as unidades foram cadastradas recentemente ou não tiveram movimentação no período selecionado, os gráficos ficam vazios. Aguarde pelo menos um dia de operação após vincular as unidades à rede.',
    },
    {
      q: 'O pedido de compra consolidado inclui todas as unidades automaticamente?',
      a: 'Sim. Ao gerar um pedido, o sistema varre os alertas de estoque com status "Não lido" em todas as unidades da rede. Se uma unidade não tem alertas ativos, ela não aparece na distribuição do pedido. Você pode gerar um novo pedido a qualquer momento.',
    },
    {
      q: 'Posso ter preços diferentes por unidade no cardápio da rede?',
      a: 'Sim, usando Overrides. Na aba "Overrides por unidade" do cardápio da rede, selecione a unidade e informe o preço override para cada produto desejado. Para remover o override e usar o preço da rede, deixe o campo em branco ou clique em "Sincronizar" na aba do cardápio.',
    },
  ]

  return (
    <>
      <SectionTitle sub="Respostas para as dúvidas mais comuns">Perguntas Frequentes</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {items.map(({ q, a }) => (
          <div key={q} style={{ padding: '14px 16px', borderRadius: 10, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
            <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 8 }}>{q}</p>
            <p style={{ fontSize: 13, color: 'var(--tf-txt2)', lineHeight: 1.7 }}>{a}</p>
          </div>
        ))}
      </div>
    </>
  )
}

const CONTENT: Record<SectionId, React.ReactNode> = {
  intro:                  <Intro />,
  'primeiros-passos':     <PrimeirosPassos />,
  garcom:                 <Garcom />,
  cozinha:                <Cozinha />,
  caixa:                  <Caixa />,
  insumos:                <Insumos />,
  produtos:               <Produtos />,
  inventario:             <Inventario />,
  'entrada-inteligente':  <EntradaInteligente />,
  relatorios:             <Relatorios />,
  usuarios:               <Usuarios />,
  ifood:                  <IFoodHelp />,
  whatsapp:               <WhatsAppHelp />,
  'multi-unidade':        <MultiUnidade />,
  faq:                    <Faq />,
}

export default function AjudaPage() {
  const [active, setActive] = useState<SectionId>('intro')

  return (
    <div style={{ display: 'flex', height: '100%', margin: '-24px', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--tf-border)', background: 'var(--tf-surface)', overflowY: 'auto', padding: '16px 10px' }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--tf-txt3)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0 8px', marginBottom: 8 }}>Manual de Uso</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {SECTIONS.map(({ id, label, icon: Icon, group }, idx) => {
            const isActive = active === id
            const showGroupLabel = group && (idx === 0 || SECTIONS[idx - 1].group !== group)
            return (
              <div key={id}>
                {showGroupLabel && (
                  <p style={{
                    fontSize: 9.5, fontWeight: 700, color: 'var(--tf-primary)',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    padding: '10px 10px 4px',
                    borderTop: '1px solid var(--tf-border)',
                    marginTop: 6,
                  }}>
                    {group}
                  </p>
                )}
                <button
                  onClick={() => setActive(id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px', borderRadius: 7,
                    fontSize: 12.5, fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--tf-primary)' : 'var(--tf-txt2)',
                    background: isActive ? 'var(--tf-primary-bg)' : 'transparent',
                    border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
                    transition: 'background 100ms, color 100ms',
                  }}
                >
                  <Icon size={14} />
                  {label}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
        <div style={{ maxWidth: 720 }}>
          {CONTENT[active]}
        </div>
      </div>
    </div>
  )
}

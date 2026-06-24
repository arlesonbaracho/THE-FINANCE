import { TERMOS_VERSAO, DPO_CONTATO } from '@/lib/legal'
import { MinutaBanner } from '@/components/legal/MinutaBanner'

export const metadata = {
  title: 'Termos de Uso — THE FINANCE',
  description: 'Termos e condições de uso da plataforma THE FINANCE.',
}

const section: React.CSSProperties = {
  marginBottom: 32,
}

const h2Style: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: '#111',
  margin: '0 0 10px',
}

const pStyle: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.75,
  color: '#374151',
  margin: '0 0 12px',
}

const ulStyle: React.CSSProperties = {
  paddingLeft: 20,
  margin: '0 0 12px',
  color: '#374151',
  fontSize: 15,
  lineHeight: 1.75,
}

export default function TermosPage() {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' }}>
      <MinutaBanner />

      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#111', marginBottom: 4 }}>
        Termos de Uso
      </h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 40 }}>
        Versão {TERMOS_VERSAO}
      </p>

      {/* 1. Objeto */}
      <div style={section}>
        <h2 style={h2Style}>1. Objeto</h2>
        <p style={pStyle}>
          Estes Termos de Uso (&ldquo;Termos&rdquo;) regulam o acesso e a utilização da plataforma
          SaaS <strong>THE FINANCE</strong>, sistema de gestão integrado para restaurantes e
          estabelecimentos alimentícios, disponibilizado pela empresa mantenedora (razão social e CNPJ
          a serem preenchidos pela assessoria jurídica), doravante denominada <strong>&ldquo;THE FINANCE&rdquo;</strong>.
        </p>
        <p style={pStyle}>
          A plataforma compreende, conforme o plano contratado, funcionalidades de gestão financeira,
          estoque, cardápio digital, ponto de venda (PDV), emissão de notas fiscais (NF-e / NFC-e),
          integração com delivery, agente de inteligência artificial e demais recursos descritos na
          página de planos.
        </p>
        <p style={pStyle}>
          Ao criar uma conta ou ao utilizar os serviços, o usuário declara ter lido, compreendido e
          concordado com estes Termos e com a{' '}
          <a href="/privacidade" style={{ color: '#16a34a' }}>Política de Privacidade</a>.
        </p>
      </div>

      {/* 2. Cadastro e Conta */}
      <div style={section}>
        <h2 style={h2Style}>2. Cadastro e Conta</h2>
        <p style={pStyle}>
          Para utilizar o THE FINANCE, é necessário criar uma conta com informações verdadeiras,
          completas e atualizadas. O usuário é responsável por:
        </p>
        <ul style={ulStyle}>
          <li>Manter a confidencialidade de suas credenciais de acesso;</li>
          <li>Notificar imediatamente o THE FINANCE em caso de acesso não autorizado;</li>
          <li>Todas as ações realizadas por meio de sua conta, inclusive por colaboradores cadastrados;</li>
          <li>Manter os dados cadastrais (CNPJ, e-mail, telefone) atualizados.</li>
        </ul>
        <p style={pStyle}>
          É permitido apenas um titular de conta por CNPJ. Contas adicionais vinculadas ao mesmo
          grupo econômico devem ser contratadas separadamente ou mediante plano multi-unidade.
        </p>
      </div>

      {/* 3. Responsabilidades do usuário */}
      <div style={section}>
        <h2 style={h2Style}>3. Responsabilidades do Usuário</h2>
        <p style={pStyle}>
          O usuário concorda em utilizar a plataforma exclusivamente para fins lícitos e em
          conformidade com a legislação brasileira aplicável. É vedado:
        </p>
        <ul style={ulStyle}>
          <li>Usar o sistema para atividades ilegais, fraudulentas ou prejudiciais a terceiros;</li>
          <li>Tentar acessar, explorar ou modificar sistemas, dados ou funcionalidades além dos limites do seu plano;</li>
          <li>Reproduzir, sublicenciar, revender ou redistribuir acesso à plataforma sem autorização expressa;</li>
          <li>Inserir conteúdo que viole direitos autorais, marcas registradas ou outros direitos de propriedade intelectual;</li>
          <li>Praticar engenharia reversa, descompilar ou desmontar qualquer parte do software;</li>
          <li>Utilizar scripts automatizados ou bots para interagir com a plataforma sem consentimento prévio do THE FINANCE.</li>
        </ul>
        <p style={pStyle}>
          O usuário é o único responsável pela exatidão e regularidade das informações fiscais
          inseridas no sistema, bem como pelo cumprimento de suas obrigações tributárias perante os
          órgãos competentes.
        </p>
      </div>

      {/* 4. Planos e Pagamento */}
      <div style={section}>
        <h2 style={h2Style}>4. Planos e Pagamento</h2>
        <p style={pStyle}>
          O THE FINANCE oferece planos de assinatura mensais ou anuais, cujos valores, recursos e
          limites estão descritos na página de planos. Ao assinar um plano:
        </p>
        <ul style={ulStyle}>
          <li>
            O pagamento é processado pelo <strong>Mercado Pago</strong>, sujeito aos seus termos e
            condições. O THE FINANCE não armazena dados de cartão de crédito.
          </li>
          <li>
            As cobranças são recorrentes (mensais ou anuais) e renovadas automaticamente até o
            cancelamento pelo usuário.
          </li>
          <li>
            Eventuais reajustes de preço serão comunicados com antecedência mínima de 30 dias.
          </li>
          <li>
            Não há reembolso de períodos já faturados, exceto nos casos previstos no Código de
            Defesa do Consumidor (Lei 8.078/1990) ou em política de reembolso específica publicada
            pelo THE FINANCE.
          </li>
        </ul>
        <p style={pStyle}>
          O inadimplemento por mais de 7 (sete) dias corridos poderá resultar na suspensão do acesso
          à conta. Após 30 dias de inadimplência, a conta poderá ser encerrada e os dados retidos
          conforme a Política de Privacidade.
        </p>
      </div>

      {/* 5. Propriedade Intelectual */}
      <div style={section}>
        <h2 style={h2Style}>5. Propriedade Intelectual</h2>
        <p style={pStyle}>
          Todo o código-fonte, design, marca, interface, textos, logotipos e demais elementos da
          plataforma THE FINANCE são de propriedade exclusiva da empresa mantenedora e estão
          protegidos pela Lei de Propriedade Industrial (Lei 9.279/1996), pela Lei de Direitos
          Autorais (Lei 9.610/1998) e demais normas aplicáveis.
        </p>
        <p style={pStyle}>
          A assinatura concede ao usuário uma licença de uso limitada, não exclusiva, intransferível
          e revogável para acessar e utilizar a plataforma durante o período de vigência contratual,
          exclusivamente para as finalidades aqui previstas.
        </p>
        <p style={pStyle}>
          Os dados inseridos pelo usuário (cardápio, produtos, clientes, relatórios) permanecem de
          sua propriedade. O THE FINANCE não reivindica direitos sobre o conteúdo dos usuários,
          exceto a licença necessária para prestação dos serviços.
        </p>
      </div>

      {/* 6. Limitação de Responsabilidade */}
      <div style={section}>
        <h2 style={h2Style}>6. Limitação de Responsabilidade</h2>
        <p style={pStyle}>
          A plataforma é fornecida &ldquo;no estado em que se encontra&rdquo; (<em>as is</em>). O
          THE FINANCE envidar esforços razoáveis para garantir disponibilidade e estabilidade dos
          serviços, mas não garante operação ininterrupta ou livre de erros.
        </p>
        <p style={pStyle}>
          O THE FINANCE não será responsável por:
        </p>
        <ul style={ulStyle}>
          <li>Danos indiretos, lucros cessantes, perda de dados ou interrupção de negócio;</li>
          <li>Falhas decorrentes de indisponibilidade de serviços de terceiros (iFood, Mercado Pago, Focus NFe, operadoras de telefonia etc.);</li>
          <li>Atos ou omissões do usuário, incluindo incorreções em dados fiscais cadastrados;</li>
          <li>Eventos de força maior ou caso fortuito conforme o Código Civil Brasileiro.</li>
        </ul>
        <p style={pStyle}>
          A responsabilidade total do THE FINANCE, em qualquer hipótese, estará limitada ao valor
          pago pelo usuário nos últimos 3 (três) meses de assinatura.
        </p>
      </div>

      {/* 7. Rescisão */}
      <div style={section}>
        <h2 style={h2Style}>7. Rescisão</h2>
        <p style={pStyle}>
          O usuário pode cancelar sua conta a qualquer momento por meio das configurações da conta
          no sistema. O acesso permanece ativo até o final do período já pago.
        </p>
        <p style={pStyle}>
          O THE FINANCE poderá rescindir ou suspender o acesso do usuário, mediante aviso prévio
          de 15 dias, em caso de:
        </p>
        <ul style={ulStyle}>
          <li>Violação destes Termos;</li>
          <li>Inadimplência superior a 30 dias;</li>
          <li>Uso da plataforma para fins ilícitos;</li>
          <li>Encerramento do serviço (com prazo mínimo de 90 dias de notificação antecipada).</li>
        </ul>
        <p style={pStyle}>
          Após o cancelamento, o usuário poderá exportar seus dados pelo prazo de 30 dias. Decorrido
          esse prazo, os dados serão tratados conforme a Política de Privacidade.
        </p>
      </div>

      {/* 8. Lei aplicável e Foro */}
      <div style={section}>
        <h2 style={h2Style}>8. Lei Aplicável e Foro</h2>
        <p style={pStyle}>
          Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o Foro
          da Comarca de [Cidade/UF — a ser preenchido pela assessoria jurídica], com renúncia
          expressa a qualquer outro, por mais privilegiado que seja, para dirimir quaisquer
          controvérsias decorrentes destes Termos.
        </p>
        <p style={pStyle}>
          Nas relações de consumo, o usuário poderá optar pelo foro de seu domicílio, conforme
          faculta o Código de Defesa do Consumidor.
        </p>
      </div>

      {/* 9. Contato */}
      <div style={section}>
        <h2 style={h2Style}>9. Contato</h2>
        <p style={pStyle}>
          Para esclarecimentos sobre estes Termos de Uso, entre em contato:
        </p>
        <p style={pStyle}>
          <strong>{DPO_CONTATO.nome}</strong>
          <br />
          E-mail:{' '}
          <a href={`mailto:${DPO_CONTATO.email}`} style={{ color: '#16a34a' }}>
            {DPO_CONTATO.email}
          </a>
        </p>
      </div>
    </main>
  )
}

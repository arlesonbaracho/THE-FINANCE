import { POLITICA_VERSAO, DPO_CONTATO } from '@/lib/legal'
import { MinutaBanner } from '@/components/legal/MinutaBanner'

export const metadata = {
  title: 'Política de Privacidade — THE FINANCE',
  description: 'Política de Privacidade e tratamento de dados pessoais do sistema THE FINANCE.',
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

export default function PrivacidadePage() {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' }}>
      <MinutaBanner />

      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#111', marginBottom: 4 }}>
        Política de Privacidade
      </h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 40 }}>
        Versão {POLITICA_VERSAO}
      </p>

      {/* 1. Controladora e Encarregado */}
      <div style={section}>
        <h2 style={h2Style}>1. Controladora e Encarregado de Dados (DPO)</h2>
        <p style={pStyle}>
          A controladora responsável pelo tratamento dos dados pessoais descritos nesta Política é a
          empresa mantenedora da plataforma <strong>THE FINANCE</strong> (razão social e CNPJ a serem
          preenchidos pela assessoria jurídica antes da publicação em produção), doravante denominada
          simplesmente <strong>&ldquo;THE FINANCE&rdquo;</strong>.
        </p>
        <p style={pStyle}>
          Para o exercício de direitos, dúvidas e solicitações relacionadas a dados pessoais, o titular
          pode contatar nosso Encarregado de Proteção de Dados (DPO):
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

      {/* 2. Dados que coletamos */}
      <div style={section}>
        <h2 style={h2Style}>2. Dados que Coletamos</h2>
        <p style={pStyle}>
          Coletamos e tratamos as seguintes categorias de dados pessoais:
        </p>
        <p style={pStyle}><strong>a) Dados de cadastro do assinante:</strong></p>
        <ul style={ulStyle}>
          <li>Nome completo e e-mail do responsável pela conta;</li>
          <li>CNPJ e razão social do estabelecimento;</li>
          <li>Telefone de contato e endereço comercial;</li>
          <li>Dados de cobrança (processados pelo Mercado Pago, sem armazenamento de números de cartão pelo THE FINANCE).</li>
        </ul>
        <p style={pStyle}><strong>b) Dados de uso do sistema:</strong></p>
        <ul style={ulStyle}>
          <li>Logs de acesso (endereço IP, user-agent, data/hora das requisições);</li>
          <li>Preferências e configurações de interface;</li>
          <li>Eventos de auditoria e histórico de operações realizadas na plataforma.</li>
        </ul>
        <p style={pStyle}><strong>c) Dados de clientes do restaurante (tratados como operador):</strong></p>
        <p style={pStyle}>
          Quando o assinante cadastra seus próprios clientes (nome, telefone, endereço para delivery,
          histórico de pedidos), o THE FINANCE atua como <strong>operador</strong> dessas informações
          — o assinante permanece sendo o controlador perante a LGPD e é responsável por obter as
          bases legais adequadas junto aos seus clientes.
        </p>
      </div>

      {/* 3. Finalidades e bases legais */}
      <div style={section}>
        <h2 style={h2Style}>3. Finalidades e Bases Legais</h2>
        <p style={pStyle}>
          O tratamento dos dados pessoais ocorre com base nas seguintes hipóteses previstas na Lei
          Geral de Proteção de Dados (Lei 13.709/2018):
        </p>
        <ul style={ulStyle}>
          <li>
            <strong>Execução de contrato (art. 7º, V):</strong> criação e gestão de conta, emissão de
            notas fiscais, processamento de pagamentos e prestação de todos os recursos contratados.
          </li>
          <li>
            <strong>Cumprimento de obrigação legal ou regulatória (art. 7º, II):</strong> conservação
            de documentos fiscais e registros contábeis pelo prazo exigido pela legislação tributária.
          </li>
          <li>
            <strong>Legítimo interesse (art. 7º, IX):</strong> prevenção a fraudes, segurança da
            plataforma, melhoria de funcionalidades e comunicações operacionais (não marketing).
          </li>
          <li>
            <strong>Consentimento (art. 7º, I):</strong> envio de comunicações de marketing e novidades
            do produto, quando o titular optar por recebê-las.
          </li>
        </ul>
      </div>

      {/* 4. Compartilhamento com operadores */}
      <div style={section}>
        <h2 style={h2Style}>4. Compartilhamento com Operadores</h2>
        <p style={pStyle}>
          Para a prestação dos serviços contratados, o THE FINANCE compartilha dados pessoais com os
          seguintes operadores, que atuam sob contrato de confidencialidade e conforme suas próprias
          políticas de privacidade:
        </p>
        <ul style={ulStyle}>
          <li>
            <strong>Focus NFe:</strong> dados fiscais do estabelecimento e de destinatários para emissão
            de notas fiscais eletrônicas (NF-e / NFC-e) perante a SEFAZ.
          </li>
          <li>
            <strong>iFood:</strong> dados de pedidos e cardápio para integração com a plataforma de
            delivery, conforme contrato firmado diretamente entre o assinante e o iFood.
          </li>
          <li>
            <strong>Mercado Pago:</strong> dados de cobrança (e-mail, CPF/CNPJ, valor) para
            processamento de pagamentos de assinaturas e transações do PDV.
          </li>
          <li>
            <strong>WhatsApp / Evolution API:</strong> número de telefone e conteúdo de mensagens para
            notificações operacionais ao estabelecimento e, quando configurado, aos clientes finais.
          </li>
          <li>
            <strong>Cloudinary:</strong> imagens de produtos, cardápio e logotipos armazenados em
            nuvem para exibição no sistema e no cardápio digital.
          </li>
        </ul>
        <p style={pStyle}>
          Não vendemos, alugamos ou cedemos dados pessoais a terceiros para fins publicitários.
        </p>
      </div>

      {/* 5. Retenção */}
      <div style={section}>
        <h2 style={h2Style}>5. Retenção de Dados</h2>
        <p style={pStyle}>
          Os dados pessoais são retidos pelo tempo necessário às finalidades descritas nesta Política
          ou pelo prazo exigido por legislação aplicável:
        </p>
        <ul style={ulStyle}>
          <li>
            <strong>Dados de conta ativa:</strong> mantidos enquanto a assinatura estiver vigente.
          </li>
          <li>
            <strong>Dados após cancelamento:</strong> conservados por até 5 (cinco) anos para
            cumprimento de obrigações fiscais e eventuais disputas contratuais, após o que são
            anonimizados ou excluídos.
          </li>
          <li>
            <strong>Documentos fiscais:</strong> mantidos pelo prazo mínimo exigido pela Receita
            Federal e legislações estaduais aplicáveis (em geral 5 a 10 anos).
          </li>
          <li>
            <strong>Logs de segurança:</strong> retidos por 12 (doze) meses.
          </li>
        </ul>
      </div>

      {/* 6. Direitos do titular */}
      <div style={section}>
        <h2 style={h2Style}>6. Direitos do Titular</h2>
        <p style={pStyle}>
          Nos termos da LGPD (art. 18), o titular dos dados tem direito a:
        </p>
        <ul style={ulStyle}>
          <li><strong>Confirmação e acesso:</strong> confirmar a existência do tratamento e acessar os dados pessoais armazenados;</li>
          <li><strong>Correção:</strong> solicitar a atualização de dados incompletos, inexatos ou desatualizados;</li>
          <li><strong>Anonimização, bloqueio ou eliminação:</strong> de dados desnecessários, excessivos ou tratados em desconformidade com a lei;</li>
          <li><strong>Portabilidade:</strong> receber os dados em formato estruturado para transferência a outro fornecedor;</li>
          <li><strong>Eliminação dos dados tratados com consentimento;</strong></li>
          <li><strong>Revogação do consentimento</strong> a qualquer momento, sem prejuízo à legalidade do tratamento anterior;</li>
          <li><strong>Oposição</strong> ao tratamento realizado com base em legítimo interesse;</li>
          <li><strong>Informação</strong> sobre entidades públicas e privadas com as quais o controlador realizou uso compartilhado de dados.</li>
        </ul>
        <p style={pStyle}>
          Para exercer esses direitos, o titular pode usar os canais disponíveis no próprio sistema
          (área &ldquo;Minha conta&rdquo;) ou entrar em contato com o DPO pelo e-mail{' '}
          <a href={`mailto:${DPO_CONTATO.email}`} style={{ color: '#16a34a' }}>
            {DPO_CONTATO.email}
          </a>
          . Responderemos em até 15 (quinze) dias úteis.
        </p>
      </div>

      {/* 7. Cookies */}
      <div style={section}>
        <h2 style={h2Style}>7. Cookies e Tecnologias Semelhantes</h2>
        <p style={pStyle}>
          O THE FINANCE utiliza <strong>apenas cookies essenciais</strong> ao funcionamento da
          plataforma. Não utilizamos cookies de rastreamento, publicidade ou análise de comportamento
          de terceiros. Os cookies essenciais utilizados são:
        </p>
        <ul style={ulStyle}>
          <li><strong>Sessão / autenticação:</strong> identifica o usuário autenticado e mantém a sessão ativa durante o uso.</li>
          <li><strong>Impersonation:</strong> controla o modo de acesso administrativo em nome de um assinante (suporte).</li>
          <li><strong>Unidade ativa:</strong> armazena qual unidade / filial está selecionada na interface.</li>
        </ul>
        <p style={pStyle}>
          Esses cookies são estritamente necessários e não requerem consentimento separado, nos termos
          do art. 7º, II e V da LGPD e das orientações da ANPD.
        </p>
      </div>

      {/* 8. Segurança */}
      <div style={section}>
        <h2 style={h2Style}>8. Segurança da Informação</h2>
        <p style={pStyle}>
          Adotamos medidas técnicas e organizacionais adequadas para proteger os dados pessoais
          contra acesso não autorizado, perda acidental, alteração ou divulgação indevida, incluindo:
        </p>
        <ul style={ulStyle}>
          <li>Comunicações protegidas por TLS/HTTPS em trânsito;</li>
          <li>Criptografia em repouso para dados sensíveis;</li>
          <li>Controle de acesso por papéis (RBAC) com princípio do menor privilégio;</li>
          <li>Logs de auditoria de operações críticas;</li>
          <li>Revisões periódicas de segurança e gestão de vulnerabilidades.</li>
        </ul>
        <p style={pStyle}>
          Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos titulares,
          notificaremos a ANPD e os titulares afetados no prazo estabelecido pela legislação.
        </p>
      </div>

      {/* 9. Alterações desta política */}
      <div style={section}>
        <h2 style={h2Style}>9. Alterações desta Política</h2>
        <p style={pStyle}>
          Esta Política pode ser atualizada periodicamente para refletir mudanças na plataforma,
          na legislação aplicável ou em nossas práticas de privacidade. Alterações relevantes serão
          comunicadas por e-mail e/ou por aviso no sistema com antecedência mínima de 15 dias.
        </p>
        <p style={pStyle}>
          A versão vigente desta Política é sempre a publicada nesta página, identificada pela data de
          versão no topo. A continuidade do uso após a entrada em vigor da nova versão implica
          aceite dos termos atualizados. Caso não concorde, o titular pode solicitar o encerramento
          de sua conta.
        </p>
      </div>

      {/* 10. Contato */}
      <div style={section}>
        <h2 style={h2Style}>10. Contato</h2>
        <p style={pStyle}>
          Para qualquer dúvida sobre esta Política de Privacidade ou sobre o tratamento de seus dados
          pessoais, entre em contato com nosso DPO:
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

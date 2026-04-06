import { Link } from "react-router-dom";
import { MARKETING_SITE_ORIGIN } from "@/lib/marketing-site";

const LAST_UPDATED = "1º de abril de 2026";

export function PrivacyPolicyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Documento legal</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground">Política de Privacidade</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última atualização: {LAST_UPDATED}</p>

      <div className="prose prose-sm mt-10 max-w-none text-muted-foreground prose-headings:font-bold prose-headings:text-foreground prose-p:leading-relaxed prose-li:marker:text-primary">
        <p>
          O <strong className="text-foreground">Ativa Dash</strong> (&quot;Plataforma&quot;, &quot;nós&quot;) respeita a sua
          privacidade e descreve neste documento como tratamos dados pessoais no uso do serviço de software como serviço
          (SaaS) de analytics e performance de marketing, incluindo integrações opcionais com Meta Ads, Google Ads,
          WhatsApp/CRM, webhooks e compartilhamento de painéis.
        </p>

        <h2>1. Controlador e contato</h2>
        <p>
          O responsável pelo tratamento dos dados pessoais tratados no âmbito desta Política é a empresa titular do
          domínio e da conta contratada no Ativa Dash. Para exercer direitos ou dúvidas sobre privacidade, utilize o
          canal indicado no painel (por exemplo, e-mail de suporte ou contato comercial) ou{" "}
          <a href="mailto:contato@ativadash.com" className="text-primary underline-offset-2 hover:underline">
            contato@ativadash.com
          </a>
          .
        </p>

        <h2>2. Quais dados coletamos</h2>
        <p>Dependendo do uso da Plataforma, podemos tratar categorias como:</p>
        <ul>
          <li>
            <strong className="text-foreground">Conta e acesso:</strong> nome, e-mail, credenciais de login (senha
            armazenada de forma segura), função na organização e preferências de perfil.
          </li>
          <li>
            <strong className="text-foreground">Dados da organização:</strong> nome da empresa, identificadores
            internos, configurações de workspace, metas, alertas e integrações autorizadas.
          </li>
          <li>
            <strong className="text-foreground">Dados de marketing e anúncios:</strong> métricas agregadas obtidas via
            APIs oficiais (Meta, Google Ads etc.) conforme as permissões que você conceder, como gasto, impressões,
            cliques, conversões e identificadores de campanha/conta necessários à operação do painel.
          </li>
          <li>
            <strong className="text-foreground">Dados inseridos manualmente:</strong> por exemplo, valores de receita
            atribuída manualmente a campanhas, notas operacionais ou parâmetros configurados por usuários autorizados.
          </li>
          <li>
            <strong className="text-foreground">Dados técnicos:</strong> logs, endereço IP, tipo de navegador,
            identificadores de sessão e registros de auditoria para segurança, diagnóstico e cumprimento legal.
          </li>
          <li>
            <strong className="text-foreground">Dados de integrações de terceiros:</strong> quando você conecta CRM,
            WhatsApp ou webhooks, o conteúdo tratado depende do que esses sistemas enviam e das configurações que você
            definir, sempre no limite do necessário para a funcionalidade contratada.
          </li>
        </ul>

        <h2>3. Finalidades</h2>
        <p>Utilizamos os dados para:</p>
        <ul>
          <li>Prestar o serviço: dashboards, relatórios, funil, alertas e automações conforme o plano;</li>
          <li>Autenticar usuários e gerir permissões (incluindo multiempresa e revenda, quando aplicável);</li>
          <li>Manter a segurança, prevenir fraudes e cumprir obrigações legais;</li>
          <li>Comunicar atualizações relevantes do serviço e suporte;</li>
          <li>Melhorar a estabilidade e a experiência do produto (análises agregadas quando possível).</li>
        </ul>

        <h2>4. Base legal (LGPD)</h2>
        <p>
          O tratamento fundamenta-se nos seguintes termos, conforme o caso: execução de contrato ou de procedimentos
          preliminares; cumprimento de obrigação legal; legítimo interesse (segurança, melhoria do serviço, com
          balanceamento de direitos); e consentimento quando exigido (por exemplo, para comunicações opcionais ou
          cookies não essenciais, quando aplicável).
        </p>

        <h2>5. Compartilhamento</h2>
        <p>
          Podemos compartilhar dados com provedores de infraestrutura, hospedagem e ferramentas de suporte, sempre sob
          obrigações contratuais de confidencialidade e proteção. Integrações com Meta, Google e outros terceiros
          seguem as políticas desses provedores e as permissões que você conceder nas respectivas contas. Não vendemos
          dados pessoais.
        </p>

        <h2>6. Retenção</h2>
        <p>
          Mantemos os dados pelo tempo necessário para prestar o serviço, cumprir obrigações legais e resolver disputas.
          Após encerramento da conta, poderemos manter informações mínimas por prazo legal ou legítimo, conforme a
          política interna de retenção.
        </p>

        <h2>7. Segurança</h2>
        <p>
          Adotamos medidas técnicas e organizacionais adequadas ao risco, incluindo controles de acesso, comunicação
          criptografada quando aplicável e boas práticas de desenvolvimento. Nenhum sistema é 100% invulnerável; em caso
          de incidente relevante, comunicaremos conforme a lei aplicável.
        </p>

        <h2>8. Direitos do titular (Brasil)</h2>
        <p>
          Você pode solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação de
          dados desnecessários, informação sobre compartilhamentos e revogação de consentimento, quando cabível. Em
          certos casos, a lei permite manter dados tratados. Para pedidos de exclusão, veja também a página{" "}
          <Link to="/exclusao-dados" className="font-semibold text-primary underline-offset-4 hover:underline">
            Exclusão de dados
          </Link>
          .
        </p>

        <h2>9. Transferência internacional</h2>
        <p>
          Se utilizarmos serviços com servidores fora do Brasil, adotaremos garantias compatíveis com a LGPD e
          contratos de transferência quando necessário.
        </p>

        <h2>10. Cookies e tecnologias similares</h2>
        <p>
          O uso de cookies ou armazenamento local pode ocorrer para sessão, preferências e segurança. Ajustes adicionais
          podem ser comunicados em aviso específico se forem introduzidas categorias não essenciais.
        </p>

        <h2>11. Menores</h2>
        <p>O serviço não se destina a menores de 16 anos. Não coletamos dados de menores de forma intencional.</p>

        <h2>12. Alterações</h2>
        <p>
          Podemos atualizar esta Política. Publicaremos a nova versão nesta página com a data de atualização. O uso
          continuado após alterações relevantes pode implicar aceitação, conforme contrato e lei.
        </p>

        <h2>13. Links externos</h2>
        <p>
          O site ou o painel podem conter links para terceiros (Meta, Google, etc.). Não controlamos esses sites; leia as
          políticas de privacidade deles.
        </p>

        <p className="mt-10 text-sm">
          <a href={MARKETING_SITE_ORIGIN} className="font-semibold text-primary underline-offset-4 hover:underline">
            Voltar ao início
          </a>
          {" · "}
          <Link to="/termos-de-servico" className="font-semibold text-primary underline-offset-4 hover:underline">
            Termos de Serviço
          </Link>
        </p>
      </div>
    </article>
  );
}

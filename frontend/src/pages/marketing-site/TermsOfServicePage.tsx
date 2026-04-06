import { Link } from "react-router-dom";
import { MARKETING_SITE_ORIGIN } from "@/lib/marketing-site";

const LAST_UPDATED = "1º de abril de 2026";

export function TermsOfServicePage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Documento legal</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground">Termos de Serviço</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última atualização: {LAST_UPDATED}</p>

      <div className="prose prose-sm mt-10 max-w-none text-muted-foreground prose-headings:font-bold prose-headings:text-foreground prose-p:leading-relaxed prose-li:marker:text-primary">
        <p>
          Estes Termos de Serviço (&quot;Termos&quot;) regem o uso da plataforma <strong className="text-foreground">Ativa Dash</strong>{" "}
          (&quot;Serviço&quot;, &quot;Plataforma&quot;) oferecida pelo titular do produto. Ao criar uma conta, acessar ou
          usar o Serviço, você (&quot;Cliente&quot;, &quot;Usuário&quot;) concorda com estes Termos.
        </p>

        <h2>1. Descrição do Serviço</h2>
        <p>
          O Ativa Dash é uma solução em nuvem para visualização e gestão de performance de marketing digital, incluindo
          mas não se limitando a painéis de anúncios (Meta, Google), funil, métricas, alertas, automações, integrações
          opcionais (CRM, WhatsApp, webhooks), compartilhamento de painéis somente leitura e recursos de exportação
          (PDF/CSV), conforme o plano contratado.
        </p>

        <h2>2. Elegibilidade e conta</h2>
        <p>
          Você declara ter capacidade legal para contratar. É responsável pela veracidade dos dados cadastrais e pela
          segurança das credenciais. O responsável pela organização pode convidar usuários e definir permissões
          conforme a estrutura do produto.
        </p>

        <h2>3. Uso aceitável</h2>
        <p>É vedado ao Usuário:</p>
        <ul>
          <li>Violar lei, direitos de terceiros ou estes Termos;</li>
          <li>Tentar acessar dados ou sistemas sem autorização (incluindo engenharia reversa maliciosa);</li>
          <li>Sobrecarregar ou comprometer a disponibilidade do Serviço;</li>
          <li>Utilizar o Serviço para envio de spam ou conteúdo ilícito;</li>
          <li>Revender ou sublicenciar o acesso sem autorização prévia quando o plano não permitir.</li>
        </ul>

        <h2>4. Integrações e dados de terceiros</h2>
        <p>
          O Cliente é responsável por obter as permissões necessárias nas contas Meta, Google e demais sistemas
          conectados. O Ativa Dash atua como ferramenta de processamento conforme as autorizações concedidas; o
          cumprimento das políticas de cada plataforma (Meta, Google, etc.) é de responsabilidade do Cliente.
        </p>

        <h2>5. Planos, preços e pagamento</h2>
        <p>
          Os valores, limites e condições comerciais constam da proposta, contrato ou página de planos aplicável. O não
          pagamento pode resultar em suspensão ou encerramento do acesso, conforme contrato e lei.
        </p>

        <h2>6. Propriedade intelectual</h2>
        <p>
          O software, marca, layout e documentação do Ativa Dash são protegidos. O Cliente concede licença para
          processar os dados necessários à prestação do Serviço. O Cliente mantém a titularidade sobre seus próprios
          dados e conteúdos inseridos.
        </p>

        <h2>7. Disponibilidade e suporte</h2>
        <p>
          Empregamos esforços para manter o Serviço disponível, mas não garantimos operação ininterrupta. Manutenções
          programadas ou emergenciais podem ocorrer. O suporte segue os canais e SLAs acordados no plano contratado.
        </p>

        <h2>8. Limitação de responsabilidade</h2>
        <p>
          Na medida máxima permitida pela lei aplicável, o Serviço é fornecido &quot;como está&quot;. Não nos
          responsabilizamos por decisões de negócio tomadas com base nos dashboards, por indisponibilidade de APIs de
          terceiros, nem por lucros cessantes ou danos indiretos, salvo disposição legal imperativa em contrário.
        </p>

        <h2>9. Rescisão</h2>
        <p>
          O Cliente pode encerrar a conta conforme instruções no painel. Podemos suspender ou encerrar o acesso em caso
          de violação grave destes Termos, fraude ou ordem legal. As cláusulas que por natureza devam subsistir
          permanecem válidas após o término.
        </p>

        <h2>10. Alterações nos Termos</h2>
        <p>
          Podemos atualizar estes Termos. A data no topo desta página será revisada. Para mudanças relevantes, poderemos
          notificar por e-mail ou aviso no painel. O uso continuado após a vigência pode constituir aceitação.
        </p>

        <h2>11. Lei e foro</h2>
        <p>
          Para questões não reguladas por arbitragem ou contrato específico, aplica-se a legislação brasileira. Fica
          eleito o foro da comarca da sede do fornecedor, salvo prerrogativa legal do consumidor.
        </p>

        <h2>12. Privacidade</h2>
        <p>
          O tratamento de dados pessoais é descrito na{" "}
          <Link to="/politica-privacidade" className="font-semibold text-primary underline-offset-4 hover:underline">
            Política de Privacidade
          </Link>
          , parte integrante destes Termos.
        </p>

        <p className="mt-10 text-sm">
          <a href={MARKETING_SITE_ORIGIN} className="font-semibold text-primary underline-offset-4 hover:underline">
            Voltar ao início
          </a>
          {" · "}
          <Link to="/politica-privacidade" className="font-semibold text-primary underline-offset-4 hover:underline">
            Política de Privacidade
          </Link>
        </p>
      </div>
    </article>
  );
}

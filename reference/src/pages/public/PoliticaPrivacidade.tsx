import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

const APP_URL = 'https://app.ativafix.com';

export default function PoliticaPrivacidade() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Política de Privacidade – Ativa FIX</title>
        <meta name="description" content="Política de privacidade do sistema Ativa FIX." />
      </Helmet>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link to="/" className="text-sm text-muted-foreground hover:underline mb-6 inline-block">
          ← Voltar
        </Link>
        <h1 className="text-2xl font-bold mb-6">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-4 text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">1. Dados que coletamos</h2>
            <p>
              Coletamos dados necessários ao uso do sistema: cadastro de usuários, empresas, clientes, 
              ordens de serviço, transações financeiras e demais informações que você insere no Ativa FIX.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">2. Finalidade</h2>
            <p>
              Os dados são utilizados para operar o sistema, prestar o serviço, cumprir obrigações legais 
              e melhorar a experiência e a segurança do produto.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">3. Compartilhamento</h2>
            <p>
              Não vendemos seus dados. Podemos compartilhar dados com prestadores de serviço essenciais 
              à operação (hospedagem, e-mail, etc.) ou quando exigido por lei.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">4. Segurança e retenção</h2>
            <p>
              Adotamos medidas para proteger os dados. Os dados são mantidos enquanto necessário à prestação 
              do serviço e às obrigações legais.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">5. Seus direitos</h2>
            <p>
              Você pode solicitar acesso, correção, exclusão ou portabilidade dos seus dados, na medida 
              permitida pela lei, entrando em contato conosco.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">6. Contato</h2>
            <p>
              Dúvidas sobre esta política: utilize o canal de contato disponibilizado no site ou no Sistema.
            </p>
          </section>
        </div>

        <p className="mt-10 text-sm text-muted-foreground">
          <Link to="/termos-de-uso" className="underline hover:no-underline">Termos de Uso</Link>
          {' · '}
          <a href={APP_URL} className="underline hover:no-underline">Acessar o Sistema</a>
        </p>
      </div>
    </div>
  );
}

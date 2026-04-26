import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

const APP_URL = 'https://app.ativafix.com';

export default function TermosDeUso() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Termos de Uso – Ativa FIX</title>
        <meta name="description" content="Termos de uso do sistema Ativa FIX." />
      </Helmet>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link to="/" className="text-sm text-muted-foreground hover:underline mb-6 inline-block">
          ← Voltar
        </Link>
        <h1 className="text-2xl font-bold mb-6">Termos de Uso</h1>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-4 text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">1. Aceitação</h2>
            <p>
              Ao acessar e utilizar o sistema Ativa FIX (“Sistema”), você concorda com estes Termos de Uso. 
              Se não concordar, não utilize o Sistema.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">2. Uso do serviço</h2>
            <p>
              O Ativa FIX é um sistema de gestão para assistência técnica. O uso deve ser responsável, 
              em conformidade com a lei e sem prejudicar terceiros ou a operação do serviço.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">3. Conta e dados</h2>
            <p>
              Você é responsável pela confidencialidade de sua conta e pelos dados que inserir no Sistema. 
              Os dados são armazenados e processados conforme nossa Política de Privacidade.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">4. Alterações</h2>
            <p>
              Podemos alterar estes Termos de Uso. Alterações relevantes serão comunicadas quando possível. 
              O uso continuado do Sistema após mudanças constitui aceitação dos novos termos.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground mt-6 mb-2">5. Contato</h2>
            <p>
              Dúvidas sobre estes termos: entre em contato pelo canal disponibilizado no site ou no próprio Sistema.
            </p>
          </section>
        </div>

        <p className="mt-10 text-sm text-muted-foreground">
          <Link to="/politica-de-privacidade" className="underline hover:no-underline">Política de Privacidade</Link>
          {' · '}
          <a href={APP_URL} className="underline hover:no-underline">Acessar o Sistema</a>
        </p>
      </div>
    </div>
  );
}

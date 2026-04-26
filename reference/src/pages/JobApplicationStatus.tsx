import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useJobApplicationStatus } from '@/hooks/useJobSurveys';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  CheckCircle, 
  Clock, 
  XCircle, 
  Search, 
  FileText, 
  Calendar,
  Mail,
  ArrowLeft,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ThemeToggle } from '@/components/ThemeToggle';

const themeCSS = `
  :root {
    --job-application: 0 0% 99%;
    --job-card: 0 0% 100%;
    --job-card-border: 220 13% 91%;
    --job-text: 222 47% 11%;
    --job-text-muted: 215 16% 47%;
    --job-primary: 358 75% 52%;
  }
  .dark {
    --job-application: 222 22% 10%;
    --job-card: 220 13% 18%;
    --job-card-border: 220 13% 28%;
    --job-text: 210 40% 98%;
    --job-text-muted: 215 20% 70%;
    --job-primary: 358 82% 56%;
  }
`;

const statusConfig = {
  received: {
    label: 'Recebida',
    icon: CheckCircle,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    description: 'Sua candidatura foi recebida e está aguardando análise.'
  },
  reviewing: {
    label: 'Em Análise',
    icon: Clock,
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950',
    description: 'Nossa equipe está analisando sua candidatura.'
  },
  interview: {
    label: 'Entrevista',
    icon: Calendar,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950',
    description: 'Você foi selecionado para uma entrevista!'
  },
  approved: {
    label: 'Aprovado',
    icon: CheckCircle,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950',
    description: 'Parabéns! Você foi aprovado para esta vaga.'
  },
  rejected: {
    label: 'Não Selecionado',
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950',
    description: 'Infelizmente você não foi selecionado para esta vaga.'
  }
};

export default function JobApplicationStatus() {
  const { protocol: urlProtocol } = useParams();
  const navigate = useNavigate();
  const [protocol, setProtocol] = useState(urlProtocol || '');
  const [email, setEmail] = useState('');
  const [searchProtocol, setSearchProtocol] = useState(protocol);

  const { data: application, isLoading, error } = useJobApplicationStatus(
    searchProtocol,
    email || undefined
  );

  const handleSearch = () => {
    if (!protocol.trim()) {
      return;
    }
    setSearchProtocol(protocol.trim());
  };

  const status = application?.status || 'received';
  const config = statusConfig[status] || statusConfig.received;
  const StatusIcon = config.icon;

  return (
    <>
      <Helmet>
        <title>Acompanhar Candidatura - Prime Camp</title>
        <meta
          name="description"
          content="Acompanhe o status da sua candidatura usando o protocolo recebido."
        />
        <style>{themeCSS}</style>
      </Helmet>

      <div
        className="min-h-screen"
        style={{ backgroundColor: 'hsl(var(--job-application))' }}
      >
        {/* Header */}
        <header
          style={{
            backgroundColor: 'hsl(var(--job-card))',
            borderColor: 'hsl(var(--job-card-border))',
          }}
          className="border-b shadow-sm"
        >
          <div className="mx-auto max-w-4xl px-4 py-6 text-center relative">
            <div className="absolute top-4 right-4">
              <ThemeToggle />
            </div>

            <div className="flex items-center justify-center gap-4 mb-3">
              <a href="/" aria-label="Home">
                <img
                  src="https://api.ativacrm.com/public/logoBanner-1744208731220-626790695.png"
                  alt="Prime Camp"
                  className="h-12 sm:h-14 md:h-16 w-auto object-contain"
                  loading="eager"
                  decoding="async"
                />
              </a>
            </div>
            <h1
              className="text-2xl sm:text-3xl font-bold"
              style={{ color: 'hsl(var(--job-text))' }}
            >
              Acompanhar Candidatura
            </h1>
            <p
              className="max-w-2xl mx-auto mt-2 text-sm sm:text-base"
              style={{ color: 'hsl(var(--job-text-muted))' }}
            >
              Digite o protocolo recebido para verificar o status da sua candidatura
            </p>
          </div>
        </header>

        <main className="mx-auto max-w-4xl p-4 py-8">
          {!urlProtocol && (
            <Card
              className="mb-6"
              style={{
                backgroundColor: 'hsl(var(--job-card))',
                borderColor: 'hsl(var(--job-card-border))',
              }}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Buscar Candidatura
                </CardTitle>
                <CardDescription>
                  Informe o protocolo recebido por email após sua candidatura
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="protocol">Protocolo *</Label>
                  <Input
                    id="protocol"
                    placeholder="Ex: ABC123XYZ"
                    value={protocol}
                    onChange={(e) => setProtocol(e.target.value.toUpperCase())}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (opcional, para maior segurança)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                <Button
                  onClick={handleSearch}
                  disabled={!protocol.trim()}
                  className="w-full"
                  style={{
                    backgroundColor: 'hsl(var(--job-primary))',
                    color: 'white',
                  }}
                >
                  <Search className="h-4 w-4 mr-2" />
                  Buscar
                </Button>
              </CardContent>
            </Card>
          )}

          {isLoading && (
            <Card
              style={{
                backgroundColor: 'hsl(var(--job-card))',
                borderColor: 'hsl(var(--job-card-border))',
              }}
            >
              <CardContent className="py-12">
                <div className="space-y-4">
                  <Skeleton className="h-8 w-64 mx-auto" />
                  <Skeleton className="h-4 w-96 mx-auto" />
                  <Skeleton className="h-32 w-full" />
                </div>
              </CardContent>
            </Card>
          )}

          {error && searchProtocol && (
            <Card
              className="border-red-200 dark:border-red-800"
              style={{
                backgroundColor: 'hsl(var(--job-card))',
              }}
            >
              <CardContent className="py-12 text-center space-y-4">
                <AlertCircle className="h-12 w-12 mx-auto text-red-600 dark:text-red-400" />
                <div>
                  <h3 className="text-lg font-semibold mb-2">Candidatura não encontrada</h3>
                  <p className="text-sm text-muted-foreground">
                    Verifique se o protocolo está correto ou tente novamente mais tarde.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setProtocol('');
                    setSearchProtocol('');
                    setEmail('');
                  }}
                >
                  Nova Busca
                </Button>
              </CardContent>
            </Card>
          )}

          {application && !isLoading && (
            <div className="space-y-6">
              {/* Status Card */}
              <Card
                className={`${config.bgColor} border-2`}
                style={{
                  borderColor: 'hsl(var(--job-card-border))',
                }}
              >
                <CardContent className="py-8 text-center space-y-4">
                  <StatusIcon className={`h-16 w-16 mx-auto ${config.color}`} />
                  <div>
                    <h2 className="text-2xl font-bold mb-2">{config.label}</h2>
                    <p className="text-sm text-muted-foreground">{config.description}</p>
                  </div>
                  <Badge
                    variant="secondary"
                    className="text-lg px-4 py-2 font-mono"
                  >
                    Protocolo: {application.protocol}
                  </Badge>
                </CardContent>
              </Card>

              {/* Detalhes da Candidatura */}
              <Card
                style={{
                  backgroundColor: 'hsl(var(--job-card))',
                  borderColor: 'hsl(var(--job-card-border))',
                }}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Detalhes da Candidatura
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Nome</Label>
                      <p className="font-medium">{application.name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Email</Label>
                      <p className="font-medium flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {application.email}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Vaga</Label>
                      <p className="font-medium">
                        {application.survey?.title || application.survey?.position_title || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Data da Candidatura</Label>
                      <p className="font-medium flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(application.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Próximos Passos */}
              {status === 'received' && (
                <Card
                  style={{
                    backgroundColor: 'hsl(var(--job-card))',
                    borderColor: 'hsl(var(--job-card-border))',
                  }}
                >
                  <CardHeader>
                    <CardTitle>Próximos Passos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>Sua candidatura foi recebida com sucesso</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Clock className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <span>Nossa equipe analisará seu perfil em até 5 dias úteis</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Mail className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <span>Você receberá atualizações por email</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Ações */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  variant="outline"
                  onClick={() => navigate('/vagas')}
                  className="flex-1"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Ver Outras Vagas
                </Button>
                <Button
                  onClick={() => {
                    setProtocol('');
                    setSearchProtocol('');
                    setEmail('');
                  }}
                  className="flex-1"
                  style={{
                    backgroundColor: 'hsl(var(--job-primary))',
                    color: 'white',
                  }}
                >
                  <Search className="h-4 w-4 mr-2" />
                  Nova Busca
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}


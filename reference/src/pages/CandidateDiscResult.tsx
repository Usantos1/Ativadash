import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DiscTestResults } from '@/components/DiscTestResults';
import { from } from '@/integrations/db/client';
import { toast } from 'sonner';
import { ArrowLeft, Share2, Calendar, Clock, CheckCircle } from 'lucide-react';
import logoImage from '@/assets/prime-camp-logo.png';

interface CandidateResult {
  id: string;
  name: string;
  d_score: number;
  i_score: number;
  s_score: number;
  c_score: number;
  dominant_profile: string;
  completion_date: string;
  created_at: string;
}

const CandidateDiscResult = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [result, setResult] = useState<CandidateResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [pollingAttempts, setPollingAttempts] = useState(0);
  
  const sessionId = searchParams.get('session');

  useEffect(() => {
    if (!sessionId) {
      setError('ID da sessão não fornecido');
      setLoading(false);
      return;
    }

    loadResult();
  }, [sessionId]);

  const loadResult = async (isPollingCall = false) => {
    try {
      if (!isPollingCall) {
        setLoading(true);
        setError(null);
      }
      
      // First try to get completed result by session ID
      const { data: completedData, error: completedError } = await from('candidate_responses')
        .select('*')
        .eq('test_id', sessionId)
        .eq('is_completed', true)
        .maybeSingle();

      if (completedError) {
        console.error('Error loading completed result:', completedError);
        throw completedError;
      }

      if (completedData) {
        console.log('✅ Found completed result:', completedData);
        setResult(completedData);
        setIsPolling(false);
        setLoading(false);
        return;
      }

      // If no completed result, check if test session exists at all
      const { data: sessionData, error: sessionError } = await from('candidate_responses')
        .select('*')
        .eq('test_id', sessionId)
        .maybeSingle();

      if (sessionError) {
        console.error('Error checking session:', sessionError);
        throw sessionError;
      }

      // If session doesn't exist or is empty, try to find a completed session for any candidate
      if (!sessionData || (sessionData && !sessionData.is_completed && (!sessionData.responses || (Array.isArray(sessionData.responses) ? sessionData.responses.length === 0 : JSON.parse(sessionData.responses as string).length === 0)))) {
        console.log('🔍 Session not found or empty, searching for completed session...');
        
        // Try to find any completed session (most recent one)
        const { data: completedSessions, error: searchError } = await from('candidate_responses')
          .select('*')
          .eq('is_completed', true)
          .order('completion_date', { ascending: false })
          .limit(1)
          .execute();

        if (completedSessions && completedSessions.length > 0 && !searchError) {
          // Force immediate redirect to the completed session
          const latestSession = completedSessions[0];
          console.log('🎯 Found completed session, forcing redirect...', latestSession.test_id);
          
          // Use replace to force navigation and stop current page processing
          window.location.replace(`/candidato-disc/resultado?session=${latestSession.test_id}`);
          setLoading(false);
          return;
        }

        setError('Nenhum resultado encontrado. O teste pode não ter sido completado.');
        setLoading(false);
        return;
      }

      // Session exists but not completed yet
      const responsesCount = Array.isArray(sessionData.responses) ? sessionData.responses.length : 
                           (typeof sessionData.responses === 'string' ? JSON.parse(sessionData.responses).length : 0);
      console.log(`📋 Session found but not completed: ${responsesCount}/20 responses`);

      // If it's a polling call and no result yet, continue polling
      if (isPollingCall && pollingAttempts < 20) { // Reduced attempts for faster failure
        setPollingAttempts(prev => prev + 1);
        setTimeout(() => loadResult(true), 500); // Faster polling
        return;
      }

      // After max polling attempts, show error
      setError('O teste ainda está sendo processado. Tente novamente em alguns instantes.');

    } catch (error) {
      console.error('Error loading candidate result:', error);
      if (!isPollingCall) {
        setError('Erro ao carregar resultado. Verifique sua conexão e tente novamente.');
        toast.error('Erro ao carregar resultado');
      }
    } finally {
      if (!isPollingCall) {
        setLoading(false);
      }
    }
  };

  // Start polling immediately if no result found
  useEffect(() => {
    if (!result && !error && !loading && sessionId && !isPolling) {
      setIsPolling(true);
      setPollingAttempts(0);
      loadResult(true);
    }
  }, [result, error, loading, sessionId, isPolling]);

  const handleShareResult = async () => {
    try {
      const shareData = {
        title: `Resultado do Teste DISC - ${result?.name}`,
        text: `Perfil dominante: ${result?.dominant_profile}`,
        url: window.location.href
      };

      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Link copiado para a área de transferência!');
      }
    } catch (error) {
      console.error('Error sharing result:', error);
      // Fallback to copying URL
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Link copiado para a área de transferência!');
      } catch (copyError) {
        toast.error('Erro ao compartilhar resultado');
      }
    }
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading || isPolling) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex justify-center mb-2">
              <img src={logoImage} alt="Prime Camp" className="h-8 w-auto" loading="lazy" decoding="async" />
            </div>
            <CardTitle className="text-center">Carregando Resultado</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="space-y-2">
              <p className="text-muted-foreground">
                {loading ? 'Carregando resultado...' : `Aguardando processamento... (${pollingAttempts}/20)`}
              </p>
              {isPolling && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Verificando se o teste foi concluído
                  </p>
                  <p className="text-xs text-yellow-600">
                    Este processo pode levar alguns segundos
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-destructive">Ops! Algo deu errado</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">{error}</p>
            <div className="flex flex-col gap-2">
              <Button 
                onClick={() => navigate('/candidato-disc')}
                variant="outline"
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar ao Teste
              </Button>
              <Button onClick={() => loadResult()}>
                Tentar Novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate percentages
  const total = result.d_score + result.i_score + result.s_score + result.c_score;
  const percentages = {
    D: Math.round((result.d_score / total) * 100),
    I: Math.round((result.i_score / total) * 100),
    S: Math.round((result.s_score / total) * 100),
    C: Math.round((result.c_score / total) * 100)
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <img src={logoImage} alt="Prime Camp" className="h-12 w-auto" loading="lazy" decoding="async" />
            </div>
            <CardTitle className="text-2xl md:text-3xl bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              Resultado do Teste DISC
            </CardTitle>
            <div className="flex items-center justify-center gap-4 mt-4">
              <Badge variant="secondary" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Teste Concluído
              </Badge>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {formatDate(result.completion_date)}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Candidate Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Olá, {result.name}!</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Status: <strong>Teste Concluído</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                <span>Concluído em: <strong>{formatDate(result.completion_date)}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <span>Perfil Dominante: <strong>{result.dominant_profile}</strong></span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <DiscTestResults 
          result={{
            d_score: result.d_score,
            i_score: result.i_score,
            s_score: result.s_score,
            c_score: result.c_score,
            dominant_profile: result.dominant_profile,
            percentages
          }} 
          onRestart={() => navigate('/candidato-disc')}
        />

        {/* Actions */}
        <Card className="border-dashed bg-gradient-to-r from-accent/20 to-accent/10">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <h3 className="font-semibold text-lg">Compartilhe seu resultado</h3>
              <p className="text-muted-foreground">
                Este link é único e permanente. Você pode compartilhá-lo ou salvá-lo para consultas futuras.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button 
                  onClick={handleShareResult}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Share2 className="h-4 w-4" />
                  Compartilhar
                </Button>
                <Button 
                  onClick={() => navigate('/candidato-disc')}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Fazer Novo Teste
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Thank You Message */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6 text-center">
            <h3 className="font-semibold text-lg mb-2 text-primary">
              Obrigado por participar!
            </h3>
            <p className="text-muted-foreground">
              Seu resultado foi salvo e nossa equipe entrará em contato em breve para os próximos passos do processo seletivo.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CandidateDiscResult;
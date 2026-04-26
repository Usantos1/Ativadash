import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, User, ExternalLink, Building2, Award } from 'lucide-react';
import { from } from '@/integrations/db/client';
import { DiscTestResults } from '@/components/DiscTestResults';

const scrollCSS = `
  html {
    overflow-x: hidden;
    overflow-y: auto !important;
    height: auto !important;
  }
  
  body {
    overflow-x: hidden;
    overflow-y: auto !important;
    height: auto !important;
    min-height: 100vh;
  }
  
  #root {
    height: auto !important;
    min-height: 100vh;
    overflow: visible !important;
  }
`;

export default function JobSuccess() {
  const { protocol: urlProtocol } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [discResult, setDiscResult] = useState<any>(null);
  const [loadingDisc, setLoadingDisc] = useState(true);
  
  // Suporta protocolo tanto como parâmetro da URL quanto como query parameter
  const protocol = urlProtocol || searchParams.get('proto');

  useEffect(() => {
    setMounted(true);
    loadDiscResult();
  }, [protocol]);

  const loadDiscResult = async () => {
    if (!protocol) {
      setLoadingDisc(false);
      return;
    }

    try {
      setLoadingDisc(true);
      
      // Extrair primeira parte do UUID do protocolo
      const uuidStart = protocol.replace('APP-', '').toLowerCase();
      
      // Buscar job_response pelo protocolo
      const { data: responses, error: responsesError } = await from('job_responses')
        .select('*')
        .execute();
      
      if (responsesError) {
        console.error('Erro ao buscar candidatura:', responsesError);
        setLoadingDisc(false);
        return;
      }

      const jobResponse = responses?.find((r: any) => 
        r.id.toLowerCase().startsWith(uuidStart)
      );

      if (!jobResponse || !jobResponse.email) {
        setLoadingDisc(false);
        return;
      }

      // Buscar resultado do DISC pelo email do candidato
      const { data: discResults, error: discError } = await from('candidate_responses')
        .select('*')
        .eq('email', jobResponse.email.toLowerCase())
        .eq('is_completed', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .execute();

      if (discError) {
        console.error('Erro ao buscar resultado DISC:', discError);
        setLoadingDisc(false);
        return;
      }

      if (discResults && discResults.length > 0) {
        const result = discResults[0];
        const total = (result.d_score || 0) + (result.i_score || 0) + (result.s_score || 0) + (result.c_score || 0);
        
        setDiscResult({
          ...result,
          percentages: {
            D: total > 0 ? Math.round((result.d_score || 0) / total * 100) : 0,
            I: total > 0 ? Math.round((result.i_score || 0) / total * 100) : 0,
            S: total > 0 ? Math.round((result.s_score || 0) / total * 100) : 0,
            C: total > 0 ? Math.round((result.c_score || 0) / total * 100) : 0,
          }
        });
      }
    } catch (error) {
      console.error('Erro ao carregar resultado DISC:', error);
    } finally {
      setLoadingDisc(false);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse">Carregando...</div>
      </div>
    );
  }

  if (!protocol) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Protocolo inválido</p>
            <Button onClick={() => navigate('/vagas')} className="mt-4">
              Ver Outras Vagas
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <style>{scrollCSS}</style>
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 p-4 pb-8">
        <div className="max-w-2xl mx-auto space-y-6 pt-8">
        {/* Header */}
        <Card className="border-0 shadow-lg bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
          <CardHeader className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
              <Building2 className="h-8 w-8" />
              <span className="text-2xl font-bold">Prime Camp</span>
            </div>
            <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400 mx-auto" />
            <div>
              <CardTitle className="text-3xl font-bold text-green-800 dark:text-green-200">
                Candidatura Enviada com Sucesso!
              </CardTitle>
            </div>
          </CardHeader>
        </Card>

        {/* Sucesso e próximos passos */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-green-800 dark:text-green-200">
              Candidatura Recebida!
            </CardTitle>
            <CardDescription>
              Recebemos sua candidatura com sucesso. Você já faz parte do nosso banco de talentos!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Nossa equipe analisará sua candidatura e entraremos em contato em breve caso haja interesse.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Resultado do Teste DISC */}
        {!loadingDisc && discResult && (
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
            <CardHeader className="text-center">
              <div className="flex items-center justify-center gap-2 text-primary mb-2">
                <Award className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl">Seu Perfil Comportamental DISC</CardTitle>
              <CardDescription>
                Resultado do seu teste de perfil comportamental
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DiscTestResults
                result={{
                  d_score: discResult.d_score || 0,
                  i_score: discResult.i_score || 0,
                  s_score: discResult.s_score || 0,
                  c_score: discResult.c_score || 0,
                  dominant_profile: discResult.dominant_profile || 'BALANCED',
                  percentages: discResult.percentages
                }}
                onRestart={() => navigate('/vagas')}
              />
            </CardContent>
          </Card>
        )}

        {/* Botão Ver Outras Vagas */}
        <div className="flex justify-center">
          <Button 
            variant="outline" 
            onClick={() => navigate('/vagas')}
            className="w-full sm:w-auto"
          >
            Ver Outras Vagas
          </Button>
        </div>

        {/* Rodapé */}
        <div className="text-center text-muted-foreground text-sm">
          <p>
            Tem dúvidas? Entre em contato conosco através dos nossos canais oficiais.
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
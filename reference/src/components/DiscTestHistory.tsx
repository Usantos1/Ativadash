import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { from } from '@/integrations/db/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, TrendingUp, Eye } from 'lucide-react';
import { DiscTestResults } from './DiscTestResults';
import { DiscTestEvolution } from './DiscTestEvolution';

interface HistoryTest {
  id: string;
  completion_date: string;
  d_score: number;
  i_score: number;
  s_score: number;
  c_score: number;
  dominant_profile: string;
}

export const DiscTestHistory = () => {
  const { user } = useAuth();
  const [tests, setTests] = useState<HistoryTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTest, setSelectedTest] = useState<HistoryTest | null>(null);

  useEffect(() => {
    if (user) {
      fetchTestHistory();
    }
  }, [user]);

  const fetchTestHistory = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('disc_responses')
        .select('id, completion_date, d_score, i_score, s_score, c_score, dominant_profile')
        .execute().eq('user_id', user.id)
        .eq('is_completed', true)
        .order('completion_date', { ascending: false });

      if (error) throw error;
      setTests(data || []);
    } catch (error) {
      console.error('Error fetching test history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProfileName = (profile: string) => {
    const names = {
      D: 'Dominante',
      I: 'Influente',
      S: 'Estável',
      C: 'Cauteloso'
    };
    return names[profile as keyof typeof names] || profile;
  };

  const getProfileColor = (profile: string) => {
    const colors = {
      D: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      I: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      S: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      C: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    };
    return colors[profile as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const calculatePercentages = (test: HistoryTest) => {
    const total = test.d_score + test.i_score + test.s_score + test.c_score;
    return {
      D: Math.round((test.d_score / total) * 100),
      I: Math.round((test.i_score / total) * 100),
      S: Math.round((test.s_score / total) * 100),
      C: Math.round((test.c_score / total) * 100)
    };
  };

  if (selectedTest) {
    const percentages = calculatePercentages(selectedTest);
    const result = {
      d_score: selectedTest.d_score,
      i_score: selectedTest.i_score,
      s_score: selectedTest.s_score,
      c_score: selectedTest.c_score,
      dominant_profile: selectedTest.dominant_profile,
      percentages
    };

    return (
      <div className="space-y-4">
        <Button 
          variant="outline" 
          onClick={() => setSelectedTest(null)}
          className="mb-4"
        >
          ← Voltar ao Histórico
        </Button>
        <DiscTestResults 
          result={result} 
          onRestart={() => setSelectedTest(null)}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center space-y-2">
            <Clock className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p>Carregando histórico...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (tests.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <div className="space-y-2">
            <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="text-lg font-semibold">Nenhum teste realizado</h3>
            <p className="text-muted-foreground">
              Você ainda não completou nenhum teste DISC. Faça seu primeiro teste para começar a acompanhar sua evolução!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Histórico de Testes DISC
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Visualize seus testes anteriores e acompanhe a evolução do seu perfil comportamental ao longo do tempo.
          </p>
          
          <Tabs defaultValue="list" className="w-full">
            <TabsList>
              <TabsTrigger value="list">Lista de Testes</TabsTrigger>
              <TabsTrigger value="evolution">Evolução</TabsTrigger>
            </TabsList>
            
            <TabsContent value="list" className="space-y-4">
              {tests.map((test, index) => {
                const percentages = calculatePercentages(test);
                return (
                  <Card key={test.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <Badge className={getProfileColor(test.dominant_profile)}>
                              {test.dominant_profile} - {getProfileName(test.dominant_profile)}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(test.completion_date), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">D:</span> {percentages.D}%
                            </div>
                            <div>
                              <span className="text-muted-foreground">I:</span> {percentages.I}%
                            </div>
                            <div>
                              <span className="text-muted-foreground">S:</span> {percentages.S}%
                            </div>
                            <div>
                              <span className="text-muted-foreground">C:</span> {percentages.C}%
                            </div>
                          </div>
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedTest(test)}
                          className="flex items-center gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          Ver Detalhes
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
            
            <TabsContent value="evolution">
              <DiscTestEvolution />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
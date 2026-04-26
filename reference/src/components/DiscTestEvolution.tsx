import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { from } from '@/integrations/db/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, Calendar, Award, Target } from 'lucide-react';

interface EvolutionTest {
  id: string;
  completion_date: string;
  d_score: number;
  i_score: number;
  s_score: number;
  c_score: number;
  dominant_profile: string;
  percentages: {
    D: number;
    I: number;
    S: number;
    C: number;
  };
}

export const DiscTestEvolution = () => {
  const { user } = useAuth();
  const [tests, setTests] = useState<EvolutionTest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchEvolutionData();
    }
  }, [user]);

  const fetchEvolutionData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('disc_responses')
        .select('id, completion_date, d_score, i_score, s_score, c_score, dominant_profile')
        .execute().eq('user_id', user.id)
        .eq('is_completed', true)
        .order('completion_date', { ascending: true });

      if (error) throw error;

      const testsWithPercentages = (data || []).map(test => {
        const total = test.d_score + test.i_score + test.s_score + test.c_score;
        return {
          ...test,
          percentages: {
            D: Math.round((test.d_score / total) * 100),
            I: Math.round((test.i_score / total) * 100),
            S: Math.round((test.s_score / total) * 100),
            C: Math.round((test.c_score / total) * 100)
          }
        };
      });

      setTests(testsWithPercentages);
    } catch (error) {
      console.error('Error fetching evolution data:', error);
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

  const chartData = tests.map((test, index) => ({
    teste: `Teste ${index + 1}`,
    data: format(new Date(test.completion_date), 'dd/MM/yy'),
    D: test.percentages.D,
    I: test.percentages.I,
    S: test.percentages.S,
    C: test.percentages.C
  }));

  const getDominantProfileChanges = () => {
    const changes = [];
    for (let i = 1; i < tests.length; i++) {
      if (tests[i].dominant_profile !== tests[i - 1].dominant_profile) {
        changes.push({
          from: tests[i - 1].dominant_profile,
          to: tests[i].dominant_profile,
          date: tests[i].completion_date,
          testNumber: i + 1
        });
      }
    }
    return changes;
  };

  const getAverageScores = () => {
    if (tests.length === 0) return null;
    
    const totals = tests.reduce((acc, test) => ({
      D: acc.D + test.percentages.D,
      I: acc.I + test.percentages.I,
      S: acc.S + test.percentages.S,
      C: acc.C + test.percentages.C
    }), { D: 0, I: 0, S: 0, C: 0 });

    return {
      D: Math.round(totals.D / tests.length),
      I: Math.round(totals.I / tests.length),
      S: Math.round(totals.S / tests.length),
      C: Math.round(totals.C / tests.length)
    };
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center space-y-2">
            <TrendingUp className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p>Carregando dados de evolução...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (tests.length < 2) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <div className="space-y-4">
            <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold">Evolução Indisponível</h3>
              <p className="text-muted-foreground">
                Você precisa ter pelo menos 2 testes completados para visualizar sua evolução.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Testes realizados: {tests.length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const profileChanges = getDominantProfileChanges();
  const averageScores = getAverageScores();

  return (
    <div className="space-y-6">
      {/* Estatísticas gerais */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{tests.length}</p>
                <p className="text-sm text-muted-foreground">Testes Realizados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Award className="h-8 w-8 text-primary" />
              <div>
                <p className="text-lg font-bold">{tests[tests.length - 1].dominant_profile}</p>
                <p className="text-sm text-muted-foreground">Perfil Atual</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Target className="h-8 w-8 text-primary" />
              <div>
                <p className="text-lg font-bold">{profileChanges.length}</p>
                <p className="text-sm text-muted-foreground">Mudanças de Perfil</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de evolução */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Evolução dos Percentuais DISC
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="teste" 
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  domain={[0, 100]}
                  tick={{ fontSize: 12 }}
                  label={{ value: 'Percentual (%)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  formatter={(value: number, name: string) => [`${value}%`, name]}
                  labelFormatter={(label) => {
                    const item = chartData.find(d => d.teste === label);
                    return item ? `${label} (${item.data})` : label;
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="D" 
                  stroke="#dc2626" 
                  strokeWidth={2}
                  name="Dominância"
                />
                <Line 
                  type="monotone" 
                  dataKey="I" 
                  stroke="#2563eb" 
                  strokeWidth={2}
                  name="Influência"
                />
                <Line 
                  type="monotone" 
                  dataKey="S" 
                  stroke="#16a34a" 
                  strokeWidth={2}
                  name="Estabilidade"
                />
                <Line 
                  type="monotone" 
                  dataKey="C" 
                  stroke="#ca8a04" 
                  strokeWidth={2}
                  name="Conformidade"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Médias históricas */}
      {averageScores && (
        <Card>
          <CardHeader>
            <CardTitle>Médias Históricas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{averageScores.D}%</div>
                <p className="text-sm text-muted-foreground">Dominância</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{averageScores.I}%</div>
                <p className="text-sm text-muted-foreground">Influência</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{averageScores.S}%</div>
                <p className="text-sm text-muted-foreground">Estabilidade</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{averageScores.C}%</div>
                <p className="text-sm text-muted-foreground">Conformidade</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mudanças de perfil */}
      {profileChanges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Mudanças de Perfil Dominante</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {profileChanges.map((change, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge className={getProfileColor(change.from)}>
                      {change.from} - {getProfileName(change.from)}
                    </Badge>
                    <span className="text-muted-foreground">→</span>
                    <Badge className={getProfileColor(change.to)}>
                      {change.to} - {getProfileName(change.to)}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(change.date), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
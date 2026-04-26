import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Download, RotateCcw, Trophy } from "lucide-react";
import { DiscResult } from "@/hooks/useDiscTest";

interface DiscTestResultsProps {
  result: DiscResult;
  onRestart?: () => void;
  onExportPDF?: () => void;
  hideRestartButton?: boolean;
}

const PROFILE_DESCRIPTIONS = {
  D: {
    title: "Dominante",
    description: "Você é uma pessoa assertiva, orientada a resultados e toma decisões rapidamente. Gosta de desafios e prefere assumir o controle das situações.",
    traits: ["Assertivo", "Decidido", "Orientado a resultados", "Competitivo", "Direto"],
    strengths: ["Liderança natural", "Toma decisões rápidas", "Foco em objetivos", "Coragem para assumir riscos"],
    challenges: ["Pode ser impaciente", "Às vezes negligencia detalhes", "Pode parecer agressivo"]
  },
  I: {
    title: "Influente",
    description: "Você é uma pessoa sociável, otimista e comunicativa. Tem facilidade para influenciar e motivar outras pessoas através do seu entusiasmo.",
    traits: ["Sociável", "Otimista", "Persuasivo", "Entusiástico", "Expressivo"],
    strengths: ["Excelente comunicador", "Motiva equipes", "Cria relacionamentos", "Visão positiva"],
    challenges: ["Pode ser desorganizado", "Às vezes falta foco", "Evita confrontos"]
  },
  S: {
    title: "Estável",
    description: "Você é uma pessoa paciente, leal e confiável. Valoriza estabilidade, trabalho em equipe e prefere mudanças graduais.",
    traits: ["Paciente", "Leal", "Confiável", "Colaborativo", "Compreensivo"],
    strengths: ["Excelente trabalho em equipe", "Consistente", "Bom ouvinte", "Apoiador"],
    challenges: ["Resistente a mudanças", "Pode evitar confrontos", "Às vezes indeciso"]
  },
  C: {
    title: "Cauteloso",
    description: "Você é uma pessoa analítica, precisa e orientada a detalhes. Valoriza qualidade, precisão e prefere basear decisões em dados.",
    traits: ["Analítico", "Preciso", "Detalhista", "Sistemático", "Cauteloso"],
    strengths: ["Alta qualidade no trabalho", "Analisa riscos", "Organizado", "Busca excelência"],
    challenges: ["Pode ser perfeccionista", "Lento para decidir", "Crítico demais"]
  }
};

const COLORS = ['#dc2626', '#2563eb', '#16a34a', '#ca8a04'];

export const DiscTestResults = ({ result, onRestart, onExportPDF, hideRestartButton = false }: DiscTestResultsProps) => {
  const dominantProfile = PROFILE_DESCRIPTIONS[result.dominant_profile as keyof typeof PROFILE_DESCRIPTIONS];
  
  const chartData = [
    { name: 'D - Dominante', value: result.percentages.D, color: COLORS[0] },
    { name: 'I - Influente', value: result.percentages.I, color: COLORS[1] },
    { name: 'S - Estável', value: result.percentages.S, color: COLORS[2] },
    { name: 'C - Cauteloso', value: result.percentages.C, color: COLORS[3] }
  ];

  const barData = [
    { type: 'D', score: result.d_score, percentage: result.percentages.D, fill: COLORS[0] },
    { type: 'I', score: result.i_score, percentage: result.percentages.I, fill: COLORS[1] },
    { type: 'S', score: result.s_score, percentage: result.percentages.S, fill: COLORS[2] },
    { type: 'C', score: result.c_score, percentage: result.percentages.C, fill: COLORS[3] }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header de Resultado */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Trophy className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl">Seu Perfil DISC</CardTitle>
          </div>
          <div className="space-y-2">
            <Badge variant="secondary" className="text-lg px-4 py-2">
              Perfil Dominante: {dominantProfile.title} ({result.dominant_profile})
            </Badge>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {dominantProfile.description}
            </p>
          </div>
        </CardHeader>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Gráfico de Pizza */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Distribuição dos Perfis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [`${value}%`, 'Percentual']}
                    labelStyle={{ color: '#000' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico de Barras */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Pontuação por Perfil</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="type" />
                  <YAxis domain={[0, 20]} />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'percentage' ? `${value}%` : value,
                      name === 'percentage' ? 'Percentual' : 'Pontuação'
                    ]}
                  />
                  <Bar dataKey="score" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Percentuais Detalhados */}
      <Card>
        <CardHeader>
          <CardTitle>Percentuais Detalhados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {barData.map((item, index) => (
            <div key={item.type} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-medium">
                  {item.type} - {chartData[index].name.split(' - ')[1]}
                </span>
                <span className="text-sm text-muted-foreground">
                  {item.percentage}% ({item.score}/20)
                </span>
              </div>
              <Progress value={item.percentage} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Características do Perfil Dominante */}
      <Card>
        <CardHeader>
          <CardTitle>Características do Perfil {dominantProfile.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold mb-3 text-primary">Características</h4>
              <div className="space-y-2">
                {dominantProfile.traits.map((trait, index) => (
                  <Badge key={index} variant="outline" className="mr-2 mb-2">
                    {trait}
                  </Badge>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3 text-green-600">Pontos Fortes</h4>
              <ul className="space-y-1 text-sm">
                {dominantProfile.strengths.map((strength, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">•</span>
                    {strength}
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3 text-amber-600">Áreas de Desenvolvimento</h4>
              <ul className="space-y-1 text-sm">
                {dominantProfile.challenges.map((challenge, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-amber-500 mt-1">•</span>
                    {challenge}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        {onExportPDF && (
          <Button onClick={onExportPDF} variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Exportar PDF
          </Button>
        )}
        {!hideRestartButton && onRestart && (
          <Button onClick={onRestart} className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Fazer Novo Teste
          </Button>
        )}
      </div>
    </div>
  );
};
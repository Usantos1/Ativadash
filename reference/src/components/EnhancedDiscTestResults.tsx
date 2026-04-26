import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Download, RotateCcw, Trophy, Target, Lightbulb, Users, BookOpen, Share2, Star } from "lucide-react";
import { DiscResult } from "@/hooks/useDiscTest";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useRef } from 'react';

interface DiscTestResultsProps {
  result: DiscResult;
  onRestart: () => void;
}

const PROFILE_DESCRIPTIONS = {
  D: {
    title: "Dominante",
    description: "Você é uma pessoa assertiva, orientada a resultados e toma decisões rapidamente. Gosta de desafios e prefere assumir o controle das situações.",
    traits: ["Assertivo", "Decidido", "Orientado a resultados", "Competitivo", "Direto"],
    strengths: ["Liderança natural", "Toma decisões rápidas", "Foco em objetivos", "Coragem para assumir riscos"],
    challenges: ["Pode ser impaciente", "Às vezes negligencia detalhes", "Pode parecer agressivo"],
    improvements: [
      "Pratique a escuta ativa antes de tomar decisões",
      "Dedique tempo para analisar detalhes importantes",
      "Desenvolva paciência ao trabalhar com ritmos diferentes",
      "Cultive a diplomacia na comunicação"
    ],
    workApplication: [
      "Lidere projetos desafiadores e urgentes",
      "Seja o porta-voz em apresentações importantes", 
      "Tome decisões rápidas em situações de crise",
      "Motive a equipe com metas ambiciosas"
    ],
    teamInteraction: "Trabalha bem com perfis S e C que podem complementar com análise e estabilidade"
  },
  I: {
    title: "Influente", 
    description: "Você é uma pessoa sociável, otimista e comunicativa. Tem facilidade para influenciar e motivar outras pessoas através do seu entusiasmo.",
    traits: ["Sociável", "Otimista", "Persuasivo", "Entusiástico", "Expressivo"],
    strengths: ["Excelente comunicador", "Motiva equipes", "Cria relacionamentos", "Visão positiva"],
    challenges: ["Pode ser desorganizado", "Às vezes falta foco", "Evita confrontos"],
    improvements: [
      "Use ferramentas de organização e planejamento",
      "Estabeleça prazos claros e siga cronogramas",
      "Pratique feedback direto e construtivo",
      "Balanceie otimismo com análise realista"
    ],
    workApplication: [
      "Conduza apresentações e reuniões de equipe",
      "Desenvolva relacionamentos com clientes",
      "Lidere iniciativas de mudança organizacional",
      "Facilite brainstormings e sessões criativas"
    ],
    teamInteraction: "Combina bem com perfis D para execução e C para organização e detalhamento"
  },
  S: {
    title: "Estável",
    description: "Você é uma pessoa paciente, leal e confiável. Valoriza estabilidade, trabalho em equipe e prefere mudanças graduais.",
    traits: ["Paciente", "Leal", "Confiável", "Colaborativo", "Compreensivo"],
    strengths: ["Excelente trabalho em equipe", "Consistente", "Bom ouvinte", "Apoiador"],
    challenges: ["Resistente a mudanças", "Pode evitar confrontos", "Às vezes indeciso"],
    improvements: [
      "Pratique expressar opiniões e necessidades claramente",
      "Desenvolva flexibilidade para mudanças necessárias", 
      "Tome iniciativa em situações apropriadas",
      "Estabeleça limites saudáveis no trabalho"
    ],
    workApplication: [
      "Seja o mediador em conflitos de equipe",
      "Mantenha a estabilidade durante mudanças",
      "Ofereça suporte consistente aos colegas",
      "Garanta a qualidade em processos contínuos"
    ],
    teamInteraction: "Equilibra bem equipes com perfis D e I, oferecendo estabilidade e suporte"
  },
  C: {
    title: "Cauteloso",
    description: "Você é uma pessoa analítica, precisa e orientada a detalhes. Valoriza qualidade, precisão e prefere basear decisões em dados.",
    traits: ["Analítico", "Preciso", "Detalhista", "Sistemático", "Cauteloso"],
    strengths: ["Alta qualidade no trabalho", "Analisa riscos", "Organizado", "Busca excelência"],
    challenges: ["Pode ser perfeccionista", "Lento para decidir", "Crítico demais"],
    improvements: [
      "Pratique tomar decisões com informações suficientes (não perfeitas)",
      "Desenvolva habilidades de comunicação interpessoal",
      "Equilibre crítica com reconhecimento positivo",
      "Estabeleça prazos realistas para análises"
    ],
    workApplication: [
      "Lidere análises de dados e relatórios detalhados",
      "Garanta qualidade e conformidade em processos",
      "Desenvolva sistemas e procedimentos eficientes",
      "Forneça análises críticas para tomada de decisão"
    ],
    teamInteraction: "Complementa perfis D e I com análise detalhada e planejamento estruturado"
  }
};

const COLORS = ['#dc2626', '#2563eb', '#16a34a', '#ca8a04'];

export const EnhancedDiscTestResults = ({ result, onRestart }: DiscTestResultsProps) => {
  const resultsRef = useRef<HTMLDivElement>(null);
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

  const handleExportPDF = async () => {
    if (!resultsRef.current) return;

    try {
      const canvas = await html2canvas(resultsRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Primeira página
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Páginas adicionais se necessário
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Resultado_DISC_${result.dominant_profile}_${new Date().toLocaleDateString('pt-BR')}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
    }
  };

  const getProfileIcon = (type: string) => {
    switch (type) {
      case 'D': return <Target className="h-5 w-5" />;
      case 'I': return <Users className="h-5 w-5" />;
      case 'S': return <Star className="h-5 w-5" />;
      case 'C': return <BookOpen className="h-5 w-5" />;
      default: return <Star className="h-5 w-5" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div ref={resultsRef} className="space-y-6 bg-background p-6 rounded-lg">
        {/* Header Premium */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/10 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
          <CardHeader className="text-center relative z-10">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-4 rounded-full bg-primary/10 backdrop-blur-sm">
                <Trophy className="h-8 w-8 text-primary" />
              </div>
              <div>
                <CardTitle className="text-3xl bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                  Seu Perfil DISC
                </CardTitle>
                <p className="text-muted-foreground mt-1">Análise Comportamental Completa</p>
              </div>
            </div>
            <div className="space-y-3">
              <Badge variant="secondary" className="text-xl px-6 py-3 bg-primary/10">
                <span className="flex items-center gap-2">
                  {getProfileIcon(result.dominant_profile)}
                  Perfil Dominante: {dominantProfile.title} ({result.dominant_profile})
                </span>
              </Badge>
              <p className="text-muted-foreground max-w-3xl mx-auto text-lg leading-relaxed">
                {dominantProfile.description}
              </p>
            </div>
          </CardHeader>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Gráfico de Pizza Premium */}
          <Card className="border-primary/10">
            <CardHeader>
              <CardTitle className="text-center flex items-center justify-center gap-2">
                <div className="p-2 rounded-full bg-primary/10">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                Distribuição dos Perfis
              </CardTitle>
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

          {/* Gráfico de Barras Premium */}
          <Card className="border-primary/10">
            <CardHeader>
              <CardTitle className="text-center flex items-center justify-center gap-2">
                <div className="p-2 rounded-full bg-primary/10">
                  <Star className="h-5 w-5 text-primary" />
                </div>
                Pontuação por Perfil
              </CardTitle>
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
                    <Bar dataKey="score" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Percentuais Detalhados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              Percentuais Detalhados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {barData.map((item, index) => (
              <div key={item.type} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium flex items-center gap-2">
                    {getProfileIcon(item.type)}
                    {item.type} - {chartData[index].name.split(' - ')[1]}
                  </span>
                  <span className="text-sm text-muted-foreground font-medium">
                    {item.percentage}% ({item.score}/20)
                  </span>
                </div>
                <Progress value={item.percentage} className="h-3" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Análise Completa do Perfil */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Características e Pontos Fortes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Trophy className="h-5 w-5" />
                Perfil {dominantProfile.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2 text-primary">
                  <Star className="h-4 w-4" />
                  Características
                </h4>
                <div className="flex flex-wrap gap-2">
                  {dominantProfile.traits.map((trait, index) => (
                    <Badge key={index} variant="outline" className="bg-primary/5">
                      {trait}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2 text-green-600">
                  <Target className="h-4 w-4" />
                  Pontos Fortes
                </h4>
                <ul className="space-y-2 text-sm">
                  {dominantProfile.strengths.map((strength, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-green-500 mt-1 text-lg">•</span>
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Áreas de Desenvolvimento */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-600">
                <Lightbulb className="h-5 w-5" />
                Desenvolvimento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2 text-amber-600">
                  <Lightbulb className="h-4 w-4" />
                  Áreas de Atenção
                </h4>
                <ul className="space-y-2 text-sm">
                  {dominantProfile.challenges.map((challenge, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-amber-500 mt-1 text-lg">•</span>
                      <span>{challenge}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2 text-blue-600">
                  <Target className="h-4 w-4" />
                  Sugestões de Melhoria
                </h4>
                <ul className="space-y-2 text-sm">
                  {dominantProfile.improvements.map((improvement, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-blue-500 mt-1 text-lg">•</span>
                      <span>{improvement}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Aplicação no Trabalho */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-600">
              <Users className="h-5 w-5" />
              Como Aplicar no Ambiente de Trabalho
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2 text-purple-600">
                  <Star className="h-4 w-4" />
                  Atividades Ideais
                </h4>
                <ul className="space-y-2 text-sm">
                  {dominantProfile.workApplication.map((application, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-purple-500 mt-1 text-lg">•</span>
                      <span>{application}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2 text-indigo-600">
                  <Users className="h-4 w-4" />
                  Interação com a Equipe
                </h4>
                <p className="text-sm bg-indigo-50 dark:bg-indigo-950 p-3 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  {dominantProfile.teamInteraction}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ações Premium */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button onClick={handleExportPDF} variant="outline" size="lg" className="flex items-center gap-2 bg-gradient-to-r from-primary/10 to-accent/10 hover:from-primary/20 hover:to-accent/20">
          <Download className="h-5 w-5" />
          Exportar PDF Completo
        </Button>
        <Button onClick={onRestart} size="lg" className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80">
          <RotateCcw className="h-5 w-5" />
          Fazer Novo Teste
        </Button>
      </div>
    </div>
  );
};
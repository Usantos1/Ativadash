import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, FileText, User, Calendar, Building } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { DiscQuestionsDetail } from './DiscQuestionsDetail';
import { toast } from 'sonner';

interface AdminDiscDetailedViewProps {
  result: any;
  onBack: () => void;
  isCandidate?: boolean;
}

export const AdminDiscDetailedView = ({ result, onBack, isCandidate = false }: AdminDiscDetailedViewProps) => {
  const [activeTab, setActiveTab] = useState<'questions' | 'analysis'>('questions');
  const contentRef = useRef<HTMLDivElement>(null);

  const getProfileName = (profile: string) => {
    const profiles: Record<string, string> = {
      'D': 'Dominante',
      'I': 'Influente', 
      'S': 'Estável',
      'C': 'Cauteloso'
    };
    return profiles[profile] || profile;
  };

  const getProfileColor = (profile: string) => {
    const colors: Record<string, string> = {
      'D': 'bg-red-500',
      'I': 'bg-yellow-500',
      'S': 'bg-green-500', 
      'C': 'bg-blue-500'
    };
    return colors[profile] || 'bg-gray-500';
  };

  const handleExportPDF = async () => {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);
      let yPosition = margin;

      // Helper function to add text with automatic line breaking
      const addText = (text: string, fontSize: number = 10, isBold: boolean = false, color: string = '#000000') => {
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
        pdf.setTextColor(color);
        
        const lines = pdf.splitTextToSize(text, contentWidth);
        lines.forEach((line: string) => {
          if (yPosition > pageHeight - margin) {
            pdf.addPage();
            yPosition = margin;
          }
          pdf.text(line, margin, yPosition);
          yPosition += fontSize * 0.4;
        });
        yPosition += 3;
      };

      // Header
      pdf.setFillColor(66, 133, 244);
      pdf.rect(0, 0, pageWidth, 40, 'F');
      pdf.setTextColor('#FFFFFF');
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('RELATÓRIO DISC COMPLETO', pageWidth / 2, 25, { align: 'center' });
      
      yPosition = 50;

      // User Information
      addText('INFORMAÇÕES DO CANDIDATO', 16, true, '#1a56db');
      addText(`Nome: ${result.name || result.display_name}`, 12);
      
      if (result.age) addText(`Idade: ${result.age} anos`, 12);
      if (result.email) addText(`Email: ${result.email}`, 12);
      if (result.whatsapp) addText(`WhatsApp: ${result.whatsapp}`, 12);
      if (result.company) addText(`Empresa: ${result.company}`, 12);
      
      addText(`Data de Conclusão: ${format(new Date(result.completion_date), 'dd/MM/yyyy - HH:mm', { locale: ptBR })}`, 12);
      addText(`Perfil Dominante: ${getProfileName(result.dominant_profile)}`, 12, true);

      yPosition += 10;

      // DISC Scores
      addText('PONTUAÇÃO DISC', 16, true, '#1a56db');
      addText(`Dominante (D): ${result.d_score}`, 12);
      addText(`Influente (I): ${result.i_score}`, 12);
      addText(`Estável (S): ${result.s_score}`, 12);
      addText(`Cauteloso (C): ${result.c_score}`, 12);

      yPosition += 10;

      // Analysis
      addText('ANÁLISE COMPORTAMENTAL', 16, true, '#1a56db');
      addText(`Características Principais:`, 12, true);
      addText(`Com perfil dominante ${getProfileName(result.dominant_profile)}, esta pessoa tende a demonstrar características específicas em suas interações profissionais e pessoais.`, 10);

      // Distribution percentages
      const total = result.d_score + result.i_score + result.s_score + result.c_score;
      yPosition += 5;
      addText('Distribuição dos Tipos:', 12, true);
      ['D', 'I', 'S', 'C'].forEach((type) => {
        const score = result[`${type.toLowerCase()}_score`];
        const percentage = Math.round((score / total) * 100);
        addText(`${getProfileName(type)}: ${percentage}%`, 10);
      });

      yPosition += 10;

      // Questions and Answers
      addText('PERGUNTAS E RESPOSTAS DETALHADAS', 16, true, '#1a56db');
      
      if (result.responses && Array.isArray(result.responses)) {
        result.responses.forEach((response: any, index: number) => {
          if (yPosition > pageHeight - 40) {
            pdf.addPage();
            yPosition = margin;
          }
          
          addText(`Pergunta ${index + 1}:`, 11, true);
          addText(`Resposta selecionada: Tipo ${response.selectedType}`, 10);
          yPosition += 3;
        });
      }

      // Footer
      const totalPages = pdf.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor('#666666');
        pdf.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
        pdf.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, margin, pageHeight - 10);
      }

      const fileName = `DISC_Completo_${result.name || result.display_name}_${format(new Date(), 'dd-MM-yyyy')}.pdf`;
      pdf.save(fileName);
      toast.success('PDF exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF. Tente novamente.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header com ações */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar à Lista
        </Button>
        <Button onClick={handleExportPDF} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Exportar PDF Completo
        </Button>
      </div>

      <div ref={contentRef} className="space-y-6">
        {/* Informações do usuário/candidato */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informações do {isCandidate ? 'Candidato' : 'Usuário'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col space-y-1">
                <span className="text-sm font-medium text-muted-foreground">Nome</span>
                <span className="font-semibold">{result.name || result.display_name}</span>
              </div>
              
              {result.age && (
                <div className="flex flex-col space-y-1">
                  <span className="text-sm font-medium text-muted-foreground">Idade</span>
                  <span>{result.age} anos</span>
                </div>
              )}
              
              {result.whatsapp && (
                <div className="flex flex-col space-y-1">
                  <span className="text-sm font-medium text-muted-foreground">WhatsApp</span>
                  <span>{result.whatsapp}</span>
                </div>
              )}
              
              {result.email && (
                <div className="flex flex-col space-y-1">
                  <span className="text-sm font-medium text-muted-foreground">Email</span>
                  <span>{result.email}</span>
                </div>
              )}
              
              {result.company && (
                <div className="flex flex-col space-y-1">
                  <span className="text-sm font-medium text-muted-foreground">Empresa</span>
                  <span className="flex items-center gap-1">
                    <Building className="h-4 w-4" />
                    {result.company}
                  </span>
                </div>
              )}
              
              <div className="flex flex-col space-y-1">
                <span className="text-sm font-medium text-muted-foreground">Data de Conclusão</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(result.completion_date), 'dd/MM/yyyy - HH:mm', { locale: ptBR })}
                </span>
              </div>
              
              <div className="flex flex-col space-y-1">
                <span className="text-sm font-medium text-muted-foreground">Perfil Dominante</span>
                <Badge className={`${getProfileColor(result.dominant_profile)} text-white w-fit`}>
                  {getProfileName(result.dominant_profile)}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scores DISC */}
        <Card>
          <CardHeader>
            <CardTitle>Pontuação DISC</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{result.d_score}</div>
                <div className="text-sm text-muted-foreground">Dominante</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{result.i_score}</div>
                <div className="text-sm text-muted-foreground">Influente</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{result.s_score}</div>
                <div className="text-sm text-muted-foreground">Estável</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{result.c_score}</div>
                <div className="text-sm text-muted-foreground">Cauteloso</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs para questões e análise */}
        <div className="space-y-4">
          <div className="flex space-x-1 bg-muted p-1 rounded-lg">
            <Button
              variant={activeTab === 'questions' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('questions')}
              className="flex-1"
            >
              <FileText className="h-4 w-4 mr-2" />
              Perguntas e Respostas
            </Button>
            <Button
              variant={activeTab === 'analysis' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('analysis')}
              className="flex-1"
            >
              Análise Comportamental
            </Button>
          </div>

          {activeTab === 'questions' && (
            <DiscQuestionsDetail 
              responses={result.responses} 
              dominantProfile={result.dominant_profile}
            />
          )}

          {activeTab === 'analysis' && (
            <Card>
              <CardHeader>
                <CardTitle>Análise Comportamental Completa</CardTitle>
                <CardDescription>
                  Análise detalhada baseada no perfil dominante {getProfileName(result.dominant_profile)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Características Principais</h4>
                  <p className="text-muted-foreground">
                    Com perfil dominante <strong>{getProfileName(result.dominant_profile)}</strong>, esta pessoa tende a demonstrar características específicas em suas interações profissionais e pessoais.
                  </p>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Distribuição dos Tipos</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {['D', 'I', 'S', 'C'].map((type) => {
                      const score = result[`${type.toLowerCase()}_score`];
                      const total = result.d_score + result.i_score + result.s_score + result.c_score;
                      const percentage = Math.round((score / total) * 100);
                      
                      return (
                        <div key={type} className="text-center">
                          <div className="w-16 h-16 mx-auto mb-2 rounded-full flex items-center justify-center text-white font-bold text-lg" 
                               style={{ backgroundColor: type === 'D' ? '#dc2626' : type === 'I' ? '#ca8a04' : type === 'S' ? '#16a34a' : '#2563eb' }}>
                            {percentage}%
                          </div>
                          <div className="text-sm font-medium">{getProfileName(type)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
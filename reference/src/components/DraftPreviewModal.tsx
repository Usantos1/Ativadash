import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Mail, Phone, MapPin, Calendar, FileText, User, MessageCircle, Instagram, Linkedin, Eye } from "lucide-react";

interface DraftPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  draft: any;
  surveyTitle?: string;
  questions?: any[];
}

export const DraftPreviewModal = ({ isOpen, onClose, draft, surveyTitle, questions = [] }: DraftPreviewModalProps) => {
  if (!draft) return null;

  // Helper para buscar o texto da pergunta pelo ID
  const getQuestionText = (questionId: string): string => {
    const question = questions.find((q: any) => q.id === questionId);
    return question?.title || question?.question || `Pergunta ID: ${questionId}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Visualizar Lead Parcial
          </DialogTitle>
          <DialogDescription>
            Dados salvos do candidato que não finalizou o formulário
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações da Vaga */}
          {surveyTitle && (
            <div className="p-4 rounded-lg border bg-muted/50">
              <h3 className="font-semibold mb-2">Vaga</h3>
              <p className="text-sm text-muted-foreground">{surveyTitle}</p>
            </div>
          )}

          {/* Dados Pessoais */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <User className="h-5 w-5" />
              Dados Pessoais
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {draft.name && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Nome</p>
                  <p className="text-base">{draft.name}</p>
                </div>
              )}
              {draft.email && !draft.email.includes('@temp.primecamp') && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    Email
                  </p>
                  <p className="text-base break-all">{draft.email}</p>
                </div>
              )}
              {draft.phone && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Telefone
                  </p>
                  <p className="text-base">{draft.phone}</p>
                </div>
              )}
              {draft.whatsapp && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    WhatsApp
                  </p>
                  <p className="text-base">{draft.whatsapp}</p>
                </div>
              )}
              {draft.age && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Idade</p>
                  <p className="text-base">{draft.age} anos</p>
                </div>
              )}
              {draft.cep && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    CEP
                  </p>
                  <p className="text-base">{draft.cep}</p>
                </div>
              )}
              {draft.address && (
                <div className="md:col-span-2">
                  <p className="text-sm font-medium text-muted-foreground">Endereço</p>
                  <p className="text-base">{draft.address}</p>
                </div>
              )}
              {draft.instagram && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Instagram className="h-3 w-3" />
                    Instagram
                  </p>
                  <p className="text-base">{draft.instagram}</p>
                </div>
              )}
              {draft.linkedin && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Linkedin className="h-3 w-3" />
                    LinkedIn
                  </p>
                  <p className="text-base break-all">{draft.linkedin}</p>
                </div>
              )}
            </div>
          </div>

          {/* Progresso */}
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Progresso
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Etapa {draft.current_step + 1}</Badge>
              <span className="text-sm text-muted-foreground">
                Última atualização: {format(new Date(draft.last_saved_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
              </span>
            </div>
          </div>

          {/* Respostas */}
          {draft.responses && Object.keys(draft.responses).length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Respostas Parciais
              </h3>
              <div className="space-y-3">
                {Object.entries(draft.responses).map(([key, value]: [string, any]) => {
                  const questionText = getQuestionText(key);
                  return (
                    <div key={key} className="p-3 rounded-lg border">
                      <p className="text-sm font-medium text-muted-foreground mb-1">{questionText}</p>
                      <p className="text-base">
                        {Array.isArray(value) ? value.join(', ') : String(value || 'Sem resposta')}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dados Completos (JSON) */}
          {draft.form_data && (
            <details className="space-y-2">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                Ver dados completos (JSON)
              </summary>
              <pre className="p-3 rounded-lg border bg-muted/50 text-xs overflow-x-auto">
                {JSON.stringify(draft.form_data, null, 2)}
              </pre>
            </details>
          )}

          {/* Ações */}
          <div className="flex gap-2 pt-4 border-t">
            {draft.whatsapp && (
              <Button
                variant="outline"
                onClick={() => window.open(`https://wa.me/55${draft.whatsapp.replace(/\D/g, '')}`, '_blank')}
                className="text-green-600 hover:text-green-700"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>
            )}
            {draft.phone && !draft.whatsapp && (
              <Button
                variant="outline"
                onClick={() => window.open(`tel:${draft.phone.replace(/\D/g, '')}`, '_blank')}
              >
                <Phone className="h-4 w-4 mr-2" />
                Ligar
              </Button>
            )}
            {draft.email && !draft.email.includes('@temp.primecamp') && (
              <Button
                variant="outline"
                onClick={() => window.open(`mailto:${draft.email}`, '_blank')}
              >
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
            )}
            <Button variant="outline" onClick={onClose} className="ml-auto">
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};


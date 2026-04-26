import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface Question {
  id: string;
  type: string;
  title: string;
  description?: string;
  required?: boolean;
  options?: string[];
}

interface JobResponse {
  id: string;
  name: string;
  email: string;
  phone?: string;
  age?: number;
  whatsapp?: string;
  address?: string;
  cep?: string;
  instagram?: string;
  linkedin?: string;
  responses: Record<string, any>;
  created_at: string;
}

interface ResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  response: JobResponse | null;
  questions: Question[];
}

export const ResponseModal = ({ isOpen, onClose, response, questions }: ResponseModalProps) => {
  if (!response) return null;

  const getQuestionById = (questionId: string) => {
    return questions.find(q => q.id === questionId);
  };

  const formatResponse = (questionId: string, value: any) => {
    const question = getQuestionById(questionId);
    if (!question) return value?.toString() || 'N/A';

    switch (question.type) {
      case 'checkbox':
        return Array.isArray(value) ? value.join(', ') : 'Nenhuma opção selecionada';
      case 'radio':
      case 'select':
        return value || 'Não respondido';
      case 'number':
        return value ? `${value}` : 'Não informado';
      default:
        return value || 'Não respondido';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Respostas do Candidato</DialogTitle>
          <DialogDescription>
            Detalhes completos da candidatura de {response.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações pessoais */}
          <div className="bg-muted/30 p-4 rounded-lg">
            <h3 className="font-semibold text-lg mb-3">Informações Pessoais</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium text-muted-foreground">Nome:</span>
                <p className="font-medium">{response.name}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">Email:</span>
                <p className="font-medium">{response.email}</p>
              </div>
              {response.phone && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Telefone:</span>
                  <p className="font-medium">{response.phone}</p>
                </div>
              )}
              {response.age && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Idade:</span>
                  <p className="font-medium">{response.age} anos</p>
                </div>
              )}
              {response.address && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Endereço:</span>
                  <p className="font-medium">{response.address}</p>
                </div>
              )}
              {response.cep && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">CEP:</span>
                  <p className="font-medium">{response.cep}</p>
                </div>
              )}
              {response.whatsapp && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">WhatsApp:</span>
                  <p className="font-medium">{response.whatsapp}</p>
                </div>
              )}
              {response.instagram && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Instagram:</span>
                  <p className="font-medium">{response.instagram}</p>
                </div>
              )}
              {response.linkedin && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">LinkedIn:</span>
                  <p className="font-medium">{response.linkedin}</p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Respostas do questionário */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Respostas do Questionário</h3>
            <div className="space-y-4">
              {questions.map((question) => {
                const answer = response.responses[question.id];
                return (
                  <div key={question.id} className="border rounded-lg p-4 bg-card">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-base leading-tight">
                        {question.title}
                      </h4>
                      {question.required && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Obrigatório
                        </Badge>
                      )}
                    </div>
                    
                    {question.description && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {question.description}
                      </p>
                    )}

                    <div className="mt-3 p-3 bg-muted/20 rounded border-l-4 border-l-primary">
                      <p className="text-sm font-medium">
                        {formatResponse(question.id, answer)}
                      </p>
                    </div>

                    {question.type === 'checkbox' && question.options && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground">
                          Opções disponíveis: {question.options.join(', ')}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Informações da submissão */}
          <Separator />
          
          <div className="bg-muted/20 p-3 rounded text-sm text-muted-foreground">
            <p>
              <strong>Data de submissão:</strong> {new Date(response.created_at).toLocaleString('pt-BR')}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
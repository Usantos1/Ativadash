import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Star, Clock, CheckCircle, AlertCircle, XCircle, UserCheck, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { from } from '@/integrations/db/client';

export interface JobResponse {
  id: string;
  survey_id: string;
  name: string;
  email: string;
  phone?: string;
  age?: number;
  whatsapp?: string;
  address?: string;
  instagram?: string;
  linkedin?: string;
  responses: any;
  created_at: string;
}

export interface CandidateEvaluation {
  id: string;
  job_response_id: string;
  evaluator_id: string;
  status: 'pending' | 'analyzing' | 'qualified' | 'interview' | 'approved' | 'rejected';
  rating?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface CandidateEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: JobResponse | null;
  evaluation?: CandidateEvaluation | null;
  onEvaluationSaved: () => void;
}

const statusConfig = {
  pending: {
    label: 'Pendente',
    icon: Clock,
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    badge: 'secondary'
  },
  analyzing: {
    label: 'Analisando',
    icon: AlertCircle,
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    badge: 'default'
  },
  qualified: {
    label: 'Qualificado',
    icon: CheckCircle,
    color: 'bg-green-100 text-green-800 border-green-200',
    badge: 'default'
  },
  interview: {
    label: 'Entrevista',
    icon: Users,
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    badge: 'default'
  },
  approved: {
    label: 'Aprovado',
    icon: UserCheck,
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    badge: 'default'
  },
  rejected: {
    label: 'Rejeitado',
    icon: XCircle,
    color: 'bg-red-100 text-red-800 border-red-200',
    badge: 'destructive'
  }
} as const;

export const CandidateEvaluationModal = ({ 
  isOpen, 
  onClose, 
  candidate, 
  evaluation, 
  onEvaluationSaved 
}: CandidateEvaluationModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    status: 'pending' as keyof typeof statusConfig,
    rating: 0,
    notes: ''
  });

  useEffect(() => {
    if (evaluation) {
      setFormData({
        status: evaluation.status as keyof typeof statusConfig,
        rating: evaluation.rating || 0,
        notes: evaluation.notes || ''
      });
    } else {
      setFormData({
        status: 'pending',
        rating: 0,
        notes: ''
      });
    }
  }, [evaluation, isOpen]);

  const handleSave = async () => {
    if (!candidate || !user?.id) return;
    
    setLoading(true);
    try {
      const { data: profile } = await from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      const evaluationData = {
        job_response_id: candidate.id,
        evaluator_id: profile.id,
        status: formData.status,
        rating: formData.rating > 0 ? formData.rating : null,
        notes: formData.notes.trim() || null
      };

      if (evaluation) {
        // Update existing evaluation
        const { error } = await from('job_candidate_evaluations')
          .update(evaluationData)
          .eq('id', evaluation.id)
          .execute();

        if (error) throw error;
      } else {
        // Create new evaluation
        const { error } = await from('job_candidate_evaluations')
          .insert(evaluationData)
          .execute();

        if (error) throw error;
      }

      toast({
        title: "Sucesso!",
        description: "Avaliação salva com sucesso!",
      });
      
      onEvaluationSaved();
      onClose();
    } catch (error) {
      console.error('Erro ao salvar avaliação:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar avaliação",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStarRating = () => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-6 w-6 cursor-pointer transition-colors ${
              star <= formData.rating 
                ? 'fill-yellow-400 text-yellow-400' 
                : 'text-gray-300 hover:text-yellow-300'
            }`}
            onClick={() => setFormData(prev => ({ 
              ...prev, 
              rating: star === formData.rating ? 0 : star 
            }))}
          />
        ))}
        {formData.rating > 0 && (
          <span className="ml-2 text-sm text-muted-foreground">
            {formData.rating}/5
          </span>
        )}
      </div>
    );
  };

  if (!candidate) return null;

  const StatusIcon = statusConfig[formData.status].icon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Avaliar Candidato</DialogTitle>
          <DialogDescription>
            Avalie e gerencie o status do candidato no processo seletivo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Candidate Info */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <h3 className="font-semibold mb-2">{candidate.name}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Email:</span>
                <p className="font-medium">{candidate.email}</p>
              </div>
              {candidate.phone && (
                <div>
                  <span className="text-muted-foreground">Telefone:</span>
                  <p className="font-medium">{candidate.phone}</p>
                </div>
              )}
              {candidate.age && (
                <div>
                  <span className="text-muted-foreground">Idade:</span>
                  <p className="font-medium">{candidate.age} anos</p>
                </div>
              )}
              {candidate.address && (
                <div>
                  <span className="text-muted-foreground">Endereço:</span>
                  <p className="font-medium">{candidate.address}</p>
                </div>
              )}
            </div>
          </div>

          {/* Status Selection */}
          <div className="space-y-2">
            <Label>Status do Candidato</Label>
            <Select 
              value={formData.status} 
              onValueChange={(value) => setFormData(prev => ({ 
                ...prev, 
                status: value as keyof typeof statusConfig 
              }))}
            >
              <SelectTrigger>
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <StatusIcon className="h-4 w-4" />
                    <span>{statusConfig[formData.status].label}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusConfig).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span>{config.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Rating */}
          <div className="space-y-2">
            <Label>Avaliação (Opcional)</Label>
            {renderStarRating()}
            <p className="text-xs text-muted-foreground">
              Clique nas estrelas para avaliar o candidato de 1 a 5
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Adicione observações sobre o candidato..."
              rows={4}
            />
          </div>

          {/* Previous Evaluation Info */}
          {evaluation && (
            <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/20 p-3">
              <p className="text-sm text-muted-foreground">
                Avaliação anterior salva em {new Date(evaluation.updated_at).toLocaleString('pt-BR')}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar Avaliação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
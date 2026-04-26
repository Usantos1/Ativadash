import { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { from } from '@/integrations/db/client';
import { apiClient } from '@/integrations/api/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle, Building2, MapPin, Briefcase, UserCheck, Clock, DollarSign, Eye } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

interface JobSurvey {
  id: string;
  title: string;
  description: string;
  position_title: string;
  department: string;
  work_schedule?: string;
  work_modality?: string;
  company_name?: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  questions: any;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  age: string;
  address: string;
  cep: string;
  whatsapp: string;
  instagram: string;
  linkedin: string;
  responses: Record<string, any>;
}

export default function JobApplication() {
  const { surveyId } = useParams();
  const [survey, setSurvey] = useState<JobSurvey | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    age: '',
    address: '',
    cep: '',
    whatsapp: '',
    instagram: '',
    linkedin: '',
    responses: {}
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (surveyId) {
      fetchSurvey();
    }
  }, [surveyId]);

  const fetchSurvey = async () => {
    try {
      const { data, error } = await from('job_surveys')
        .select('*')
        .eq('id', surveyId)
        .eq('is_active', true)
        .single()
        .execute();

      if (error) throw error;
      setSurvey(data);
    } catch (error) {
      console.error('Erro ao carregar formulário:', error);
      toast.error('Formulário não encontrado ou inativo');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Nome é obrigatório';
    if (!formData.email.trim()) newErrors.email = 'Email é obrigatório';
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }
    if (!formData.age.trim()) newErrors.age = 'Idade é obrigatória';
    if (formData.age && (parseInt(formData.age) < 16 || parseInt(formData.age) > 100)) {
      newErrors.age = 'Idade deve estar entre 16 e 100 anos';
    }
    if (!formData.address.trim()) newErrors.address = 'Endereço é obrigatório';
    if (!formData.cep.trim()) newErrors.cep = 'CEP é obrigatório';
    if (formData.cep && !/^\d{5}-?\d{3}$/.test(formData.cep)) {
      newErrors.cep = 'CEP deve ter o formato 00000-000';
    }

    // Validate survey questions
    survey?.questions.forEach((question: any) => {
      if (question.required && !formData.responses[question.id]) {
        newErrors[`question_${question.id}`] = 'Este campo é obrigatório';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Por favor, corrija os erros no formulário');
      return;
    }

    setSubmitting(true);
    
    try {
      console.log("Submitting job application:", {
        survey_id: surveyId,
        formData: formData
      });

      // Generate idempotency key to prevent duplicates
      const idempotencyKey = `${surveyId}-${formData.email}-${Date.now()}`;

      // Use edge function for proper handling
      const { data, error } = await apiClient.invokeFunction('job-application-submit', {
          survey_id: surveyId,
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone?.trim() || null,
          age: formData.age ? parseInt(formData.age) : null,
          address: formData.address?.trim() || null,
          cep: formData.cep?.trim() || null,
          whatsapp: formData.whatsapp?.trim() || null,
          instagram: formData.instagram?.trim() || null,
          linkedin: formData.linkedin?.trim() || null,
          responses: formData.responses || {},
          idempotency_key: idempotencyKey
      });

      if (error) {
        console.error("Edge function error:", error);
        throw error;
      }

      console.log("Submission successful:", data);

      // Redirect to success page with protocol
      if (data?.protocol) {
        window.location.href = `/vaga/sucesso/${data.protocol}`;
      } else {
        setSubmitted(true);
        toast.success('Candidatura enviada com sucesso!');
      }
    } catch (error: any) {
      console.error('Erro ao enviar candidatura:', error);
      toast.error(`Erro ao enviar candidatura: ${error.message || 'Tente novamente'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResponseChange = (questionId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      responses: {
        ...prev.responses,
        [questionId]: value
      }
    }));
    
    // Clear error when user starts typing
    if (errors[`question_${questionId}`]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`question_${questionId}`];
        return newErrors;
      });
    }
  };

  const renderQuestion = (question: any) => {
    const questionId = question.id;
    const value = formData.responses[questionId] || '';
    const hasError = errors[`question_${questionId}`];

    switch (question.type) {
      case 'text':
        return (
          <div className="space-y-2">
            <Input
              id={questionId}
              value={value}
              onChange={(e) => handleResponseChange(questionId, e.target.value)}
              className={`job-input ${hasError ? 'border-job-primary focus:border-job-primary' : ''}`}
              placeholder="Digite sua resposta"
            />
            {hasError && <p className="text-xs text-job-primary mt-1">{hasError}</p>}
          </div>
        );

      case 'textarea':
        return (
          <div className="space-y-2">
            <Textarea
              id={questionId}
              value={value}
              onChange={(e) => handleResponseChange(questionId, e.target.value)}
              className={`job-input ${hasError ? 'border-job-primary focus:border-job-primary' : ''}`}
              rows={4}
              placeholder="Digite sua resposta detalhada"
            />
            {hasError && <p className="text-xs text-job-primary mt-1">{hasError}</p>}
          </div>
        );

      case 'number':
        return (
          <div className="space-y-2">
            <Input
              id={questionId}
              type="number"
              value={value}
              onChange={(e) => handleResponseChange(questionId, e.target.value)}
              className={`job-input ${hasError ? 'border-job-primary focus:border-job-primary' : ''}`}
              placeholder="Digite um número"
            />
            {hasError && <p className="text-xs text-job-primary mt-1">{hasError}</p>}
          </div>
        );

      case 'select':
        return (
          <div className="space-y-2">
            <Select
              value={value}
              onValueChange={(selectedValue) => handleResponseChange(questionId, selectedValue)}
            >
              <SelectTrigger className={hasError ? 'border-destructive' : ''}>
                <SelectValue placeholder="Selecione uma opção" />
              </SelectTrigger>
              <SelectContent>
                {question.options?.map((option: string, index: number) => (
                  <SelectItem key={index} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasError && <p className="text-xs text-job-primary mt-1">{hasError}</p>}
          </div>
        );

      case 'radio':
        return (
          <div className="space-y-3">
            <RadioGroup
              value={value}
              onValueChange={(selectedValue) => handleResponseChange(questionId, selectedValue)}
              className={`space-y-2 ${hasError ? 'border border-job-primary rounded-lg p-3' : ''}`}
            >
              {question.options?.map((option: string, index: number) => (
                <div key={index} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`${questionId}_${index}`} />
                  <Label htmlFor={`${questionId}_${index}`} className="text-sm md:text-base cursor-pointer text-job-text">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {hasError && <p className="text-xs text-job-primary mt-1">{hasError}</p>}
          </div>
        );

      case 'checkbox':
        return (
          <div className="space-y-3">
            <div className={`space-y-2 ${hasError ? 'border border-job-primary rounded-lg p-3' : ''}`}>
              {question.options?.map((option: string, index: number) => {
                const selectedOptions = Array.isArray(value) ? value : [];
                return (
                  <div key={index} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${questionId}_${index}`}
                      checked={selectedOptions.includes(option)}
                      onCheckedChange={(checked) => {
                        const currentOptions = Array.isArray(value) ? value : [];
                        if (checked) {
                          handleResponseChange(questionId, [...currentOptions, option]);
                        } else {
                          handleResponseChange(questionId, currentOptions.filter((o: string) => o !== option));
                        }
                      }}
                    />
                    <Label htmlFor={`${questionId}_${index}`} className="text-sm md:text-base cursor-pointer text-job-text">
                      {option}
                    </Label>
                  </div>
                );
              })}
            </div>
            {hasError && <p className="text-xs text-job-primary mt-1">{hasError}</p>}
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'hsl(var(--job-application))' }}>
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'hsl(var(--job-primary))' }} />
          <span style={{ color: 'hsl(var(--job-text))' }}>Carregando formulário...</span>
        </div>
      </div>
    );
  }

  if (!survey) {
    return <Navigate to="/404" replace />;
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'hsl(var(--job-application))' }}>
        <div className="w-full max-w-lg space-y-6">
          <Card style={{ backgroundColor: 'hsl(var(--job-card))', borderColor: 'hsl(var(--job-card-border))' }}>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <CheckCircle className="h-16 w-16 mx-auto" style={{ color: 'hsl(var(--job-primary))' }} />
                <h2 className="text-2xl font-bold" style={{ color: 'hsl(var(--job-text))' }}>Candidatura Enviada!</h2>
                <p style={{ color: 'hsl(var(--job-text-muted))' }}>
                  Obrigado por se candidatar à vaga de {survey.position_title}. 
                  Entraremos em contato em breve.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Teste DISC Opcional */}
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
            <CardHeader className="text-center">
              <div className="flex items-center justify-center gap-2 text-primary mb-2">
                <UserCheck className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl">Teste DISC Opcional</CardTitle>
              <CardDescription>
                Que tal fazer um teste de perfil comportamental? É rápido, gratuito e pode ajudar no seu processo seletivo!
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  • Avalia seu perfil comportamental
                </p>
                <p className="text-sm text-muted-foreground">
                  • Leva apenas 5 minutos
                </p>
                <p className="text-sm text-muted-foreground">
                  • Pode destacar sua candidatura
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button 
                  onClick={() => window.open('/disc-candidato', '_blank')}
                  className="flex-1"
                >
                  Fazer Teste DISC
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.close()}
                  className="flex-1"
                >
                  Agora Não
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const formatSalary = () => {
    if (survey?.salary_min && survey?.salary_max) {
      return `R$ ${survey.salary_min.toLocaleString()} - R$ ${survey.salary_max.toLocaleString()}`;
    }
    if (survey?.salary_min) {
      return `A partir de R$ ${survey.salary_min.toLocaleString()}`;
    }
    return 'A combinar';
  };

  const totalSteps = 2; // Personal data + Survey questions

  // Step validation
  const validateStep = (step: number) => {
    if (step === 1) {
      const personalErrors: Record<string, string> = {};
      if (!formData.name.trim()) personalErrors.name = 'Nome é obrigatório';
      if (!formData.email.trim()) personalErrors.email = 'Email é obrigatório';
      if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
        personalErrors.email = 'Email inválido';
      }
      if (!formData.age.trim()) personalErrors.age = 'Idade é obrigatória';
      if (formData.age && (parseInt(formData.age) < 16 || parseInt(formData.age) > 100)) {
        personalErrors.age = 'Idade deve estar entre 16 e 100 anos';
      }
      if (!formData.address.trim()) personalErrors.address = 'Endereço é obrigatório';
      if (!formData.cep.trim()) personalErrors.cep = 'CEP é obrigatório';
      if (formData.cep && !/^\d{5}-?\d{3}$/.test(formData.cep)) {
        personalErrors.cep = 'CEP deve ter o formato 00000-000';
      }
      setErrors(personalErrors);
      return Object.keys(personalErrors).length === 0;
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
      // Focus first field of next step
      setTimeout(() => {
        const firstInput = document.querySelector('input, select, textarea') as HTMLElement;
        firstInput?.focus();
      }, 100);
    } else {
      toast.error('Por favor, preencha os campos obrigatórios');
    }
  };

  const handlePreviousStep = () => {
    setCurrentStep(prev => prev - 1);
  };

  return (
    <div className="min-h-screen bg-job-application p-4">
      <div className="mx-auto max-w-[960px] px-4 md:px-6 space-y-4 md:space-y-6">
        {/* Compact Header */}
        <Card className="rounded-lg border backdrop-blur p-4 md:p-6 shadow-elegant text-center relative" style={{ backgroundColor: 'hsl(var(--job-card))', borderColor: 'hsl(var(--job-card-border))' }}>
          {/* Theme Toggle */}
          <div className="absolute top-4 right-4">
            <ThemeToggle />
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 text-job-primary">
              <Building2 className="h-6 w-6" />
              <span className="text-lg font-semibold">Prime Camp</span>
            </div>
            
            <div>
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-job-text">
                {survey.title}
              </h1>
              <p className="text-sm md:text-base text-job-text-muted mt-1">
                {survey.position_title}
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              {survey.company_name && (
                <Badge variant="secondary" className="gap-1 bg-job-badge text-job-text">
                  <Building2 className="h-3 w-3" />
                  {survey.company_name}
                </Badge>
              )}
              {survey.location && (
                <Badge variant="secondary" className="gap-1 bg-job-badge text-job-text">
                  <MapPin className="h-3 w-3" />
                  {survey.location}
                </Badge>
              )}
              {survey.work_modality && (
                <Badge variant="secondary" className="gap-1 bg-job-badge text-job-text">
                  <Briefcase className="h-3 w-3" />
                  {survey.work_modality}
                </Badge>
              )}
              <Badge variant="secondary" className="gap-1 bg-job-badge text-job-text">
                <DollarSign className="h-3 w-3" />
                {formatSalary()}
              </Badge>
              {survey.work_schedule && (
                <Badge variant="secondary" className="gap-1 bg-job-badge text-job-text">
                  <Clock className="h-3 w-3" />
                  {survey.work_schedule}
                </Badge>
              )}
            </div>
          </div>
        </Card>

        {/* Job Description Preview */}
        {survey.description && (
          <Card className="rounded-lg border bg-job-card p-4 md:p-6 shadow-elegant text-center">
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-job-text">Sobre a vaga</h2>
              <p className="text-sm text-job-text-muted line-clamp-3">
                {survey.description}
              </p>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 job-button-secondary">
                    <Eye className="h-3 w-3" />
                    Ver detalhes
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{survey.title}</DialogTitle>
                    <DialogDescription className="sr-only">
                      Descrição completa da vaga
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-4">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {survey.description}
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </Card>
        )}

        {/* Progress Indicator with Percentage */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-sm text-job-text-muted">
            <span>Progresso: {Math.round((currentStep / totalSteps) * 100)}%</span>
          </div>
          <div 
            className="flex items-center justify-center gap-2 md:gap-3 select-none"
            aria-hidden="true"
          >
            {[...Array(totalSteps)].map((_, i) => (
              <span
                key={i}
                className={`h-3 w-3 md:h-4 md:w-4 rounded-full transition-all duration-300 ${
                  i + 1 <= currentStep ? 'bg-job-primary shadow-job-glow' : 'bg-job-progress-inactive'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Form Card */}
        <Card className="rounded-lg border bg-job-card p-4 md:p-6 shadow-elegant">
          <form onSubmit={handleSubmit} className="space-y-6 text-center">
            {currentStep === 1 && (
              <>
                <div className="space-y-2 mb-4 md:mb-6 text-center">
                  <h2 className="text-lg md:text-xl font-semibold tracking-tight text-job-text">
                    Dados Pessoais
                  </h2>
                  <p className="text-sm text-job-text-muted">
                    Preencha seus dados para iniciar sua candidatura
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 text-left">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="flex items-center gap-1 text-job-text">
                      Nome completo
                      <span className="text-job-primary">*</span>
                    </Label>
                    <Input
                      id="name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, name: e.target.value }));
                        if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                      }}
                      className={`job-input ${errors.name ? 'border-job-primary focus:border-job-primary' : ''}`}
                      placeholder="Seu nome completo"
                    />
                    {errors.name && <p className="text-xs text-job-primary mt-1">{errors.name}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-1 text-job-text">
                      Email
                      <span className="text-job-primary">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, email: e.target.value }));
                        if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                      }}
                      className={`job-input ${errors.email ? 'border-job-primary focus:border-job-primary' : ''}`}
                      placeholder="seu@email.com"
                    />
                    {errors.email && <p className="text-xs text-job-primary mt-1">{errors.email}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-job-text">Telefone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        const formattedValue = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
                        setFormData(prev => ({ ...prev, phone: formattedValue }));
                      }}
                      className="job-input"
                      placeholder="(00) 00000-0000"
                      maxLength={15}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="age" className="flex items-center gap-1 text-job-text">
                      Idade
                      <span className="text-job-primary">*</span>
                    </Label>
                    <Input
                      id="age"
                      type="number"
                      value={formData.age}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, age: e.target.value }));
                        if (errors.age) setErrors(prev => ({ ...prev, age: '' }));
                      }}
                      className={`job-input ${errors.age ? 'border-job-primary focus:border-job-primary' : ''}`}
                      min="16"
                      max="100"
                      placeholder="Sua idade"
                    />
                    {errors.age && <p className="text-xs text-job-primary mt-1">{errors.age}</p>}
                  </div>

                   <div className="space-y-2">
                     <Label htmlFor="address" className="flex items-center gap-1 text-job-text">
                       Endereço
                       <span className="text-job-primary">*</span>
                     </Label>
                     <Input
                       id="address"
                       type="text"
                       value={formData.address}
                       onChange={(e) => {
                         setFormData(prev => ({ ...prev, address: e.target.value }));
                         if (errors.address) setErrors(prev => ({ ...prev, address: '' }));
                       }}
                       className={`job-input ${errors.address ? 'border-job-primary focus:border-job-primary' : ''}`}
                       placeholder="Rua, número, bairro, cidade"
                     />
                     {errors.address && <p className="text-xs text-job-primary mt-1">{errors.address}</p>}
                   </div>

                   <div className="space-y-2">
                     <Label htmlFor="cep" className="flex items-center gap-1 text-job-text">
                       CEP
                       <span className="text-job-primary">*</span>
                     </Label>
                     <Input
                       id="cep"
                       type="text"
                       value={formData.cep}
                       onChange={(e) => {
                         const value = e.target.value.replace(/\D/g, '');
                         const formattedValue = value.replace(/(\d{5})(\d{3})/, '$1-$2');
                         setFormData(prev => ({ ...prev, cep: formattedValue }));
                         if (errors.cep) setErrors(prev => ({ ...prev, cep: '' }));
                       }}
                       className={`job-input ${errors.cep ? 'border-job-primary focus:border-job-primary' : ''}`}
                       placeholder="00000-000"
                       maxLength={9}
                     />
                     {errors.cep && <p className="text-xs text-job-primary mt-1">{errors.cep}</p>}
                   </div>

                  <div className="space-y-2">
                    <Label htmlFor="whatsapp" className="text-job-text">WhatsApp</Label>
                    <Input
                      id="whatsapp"
                      type="tel"
                      value={formData.whatsapp}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        const formattedValue = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
                        setFormData(prev => ({ ...prev, whatsapp: formattedValue }));
                      }}
                      className="job-input"
                      placeholder="(00) 00000-0000"
                      maxLength={15}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="instagram" className="text-job-text">Instagram</Label>
                    <Input
                      id="instagram"
                      type="text"
                      value={formData.instagram}
                      onChange={(e) => setFormData(prev => ({ ...prev, instagram: e.target.value }))}
                      className="job-input"
                      placeholder="@seuusuario"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="linkedin" className="text-job-text">LinkedIn</Label>
                    <Input
                      id="linkedin"
                      type="url"
                      value={formData.linkedin}
                      onChange={(e) => setFormData(prev => ({ ...prev, linkedin: e.target.value }))}
                      className="job-input"
                      placeholder="https://linkedin.com/in/seu-perfil"
                    />
                  </div>
                </div>
              </>
            )}

            {currentStep === 2 && survey.questions && survey.questions.length > 0 && (
              <>
                <div className="space-y-2 mb-4 md:mb-6 text-center">
                  <h2 className="text-lg md:text-xl font-semibold tracking-tight text-job-text">
                    Questionário
                  </h2>
                  <p className="text-sm text-job-text-muted">
                    Responda as perguntas abaixo para completar sua candidatura
                  </p>
                </div>

                <div className="space-y-6 text-left">
                  {survey.questions.map((question: any, index: number) => (
                    <div key={question.id} className="space-y-3">
                      <div className="space-y-1">
                        <h3 className="text-lg md:text-xl font-semibold tracking-tight text-job-text">
                          {question.title}
                          {question.required && <span className="text-job-primary ml-1">*</span>}
                        </h3>
                        {question.description && (
                          <p className="text-sm text-job-text-muted">
                            {question.description}
                          </p>
                        )}
                      </div>
                      <div className="pt-2">
                        {renderQuestion(question)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Footer Navigation */}
            <div className="pt-6 border-t border-job-card-border mt-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-xs md:text-sm text-job-text-muted">
                  Etapa {currentStep} de {totalSteps}
                </span>
                <div className="flex-1 max-w-xs mx-3 h-2 rounded-lg bg-job-progress-bg overflow-hidden">
                  <div 
                    className="h-full rounded-lg bg-job-primary transition-all duration-500 shadow-job-glow"
                    style={{ width: `${((currentStep / totalSteps) * 100)}%` }}
                  />
                </div>
                <div className="flex gap-3">
                  {currentStep > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handlePreviousStep}
                      className="job-button-secondary min-w-[80px] h-11"
                    >
                      Anterior
                    </Button>
                  )}
                  {currentStep < totalSteps ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleNextStep}
                      className="job-button-primary min-w-[100px] h-11 px-6"
                    >
                      Próxima
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      size="sm"
                      disabled={submitting}
                      className="job-button-primary min-w-[140px] h-11 px-6 gap-2"
                    >
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      {submitting ? 'Enviando...' : 'Enviar Candidatura'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
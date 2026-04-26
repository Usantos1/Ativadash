import { z } from 'zod';

// Validações comuns reutilizáveis
const emailSchema = z.string()
  .min(1, 'Email é obrigatório')
  .email('Email inválido')
  .max(255, 'Email muito longo');

const phoneSchema = z.string()
  .min(1, 'Telefone é obrigatório')
  .regex(/^\+?[0-9\s\-()]{10,20}$/, 'Telefone inválido');

const cepSchema = z.string()
  .min(1, 'CEP é obrigatório')
  .regex(/^\d{5}-?\d{3}$/, 'CEP inválido (formato: 00000-000)');

const ageSchema = z.string()
  .min(1, 'Idade é obrigatória')
  .refine(
    (val) => {
      const age = parseInt(val, 10);
      return !isNaN(age) && age >= 16 && age <= 100;
    },
    { message: 'Idade deve estar entre 16 e 100 anos' }
  );

export const jobApplicationSchema = z.object({
  name: z.string()
    .min(1, 'Nome é obrigatório')
    .max(200, 'Nome muito longo'),
  
  email: emailSchema,
  
  phone: phoneSchema,
  
  age: ageSchema,
  
  address: z.string()
    .min(1, 'Endereço é obrigatório')
    .max(500, 'Endereço muito longo'),
  
  cep: cepSchema,
  
  whatsapp: z.string()
    .regex(/^\+?[0-9\s\-()]{10,20}$/, 'WhatsApp inválido')
    .optional()
    .or(z.literal('')),
  
  instagram: z.string()
    .max(100, 'Instagram muito longo')
    .optional()
    .or(z.literal('')),
  
  linkedin: z.string()
    .max(200, 'LinkedIn muito longo')
    .optional()
    .or(z.literal('')),
  
  responses: z.record(z.any()).default({}),
});

export type JobApplicationFormData = z.infer<typeof jobApplicationSchema>;

// Schema para validação de perguntas específicas
export const createQuestionResponseSchema = (questions: Array<{ id: string; required: boolean }>) => {
  const responsesSchema: Record<string, z.ZodTypeAny> = {};
  
  questions.forEach(question => {
    if (question.required) {
      responsesSchema[question.id] = z.any().refine(
        (val) => {
          if (val === undefined || val === null || val === '') return false;
          if (typeof val === 'string' && !val.trim()) return false;
          if (Array.isArray(val) && val.length === 0) return false;
          return true;
        },
        { message: 'Esta pergunta é obrigatória' }
      );
    } else {
      responsesSchema[question.id] = z.any().optional();
    }
  });
  
  return z.object({
    ...jobApplicationSchema.shape,
    responses: z.object(responsesSchema),
  });
};










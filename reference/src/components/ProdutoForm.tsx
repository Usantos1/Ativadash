import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Produto, useCreateProduct, useUpdateProduct } from '@/hooks/useProducts';
import { parseBRLInput, maskBRL } from '@/utils/currency';
import { useQualidades } from '@/hooks/useQualidades';
import { QualidadeManager } from './QualidadeManager';
import { Settings } from 'lucide-react';

/** Schema */
const produtoSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  marca: z.string().min(1, 'Marca é obrigatória'),
  modelo: z.string().min(1, 'Modelo é obrigatório'),
  qualidade: z.string().min(1, 'Qualidade é obrigatória'),
  valor_dinheiro_pix_display: z.string().min(1, 'Valor dinheiro/Pix é obrigatório'),
  valor_parcelado_6x_display: z.string().optional(),
});

type ProdutoFormData = z.infer<typeof produtoSchema>;

type ProdutoFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Partial<Produto> | null;
};

export function ProdutoForm({ open, onOpenChange, product }: ProdutoFormProps) {
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const isEditing = Boolean(product && (product as any).id);
  const { data: qualidades } = useQualidades();
  const [isQualidadeManagerOpen, setIsQualidadeManagerOpen] = useState(false);

  const form = useForm<ProdutoFormData>({
    resolver: zodResolver(produtoSchema),
    defaultValues: {
      nome: '',
      marca: '',
      modelo: '',
      qualidade: '',
      valor_dinheiro_pix_display: '',
      valor_parcelado_6x_display: '',
    },
  });

  /** Carrega dados no editar / limpa no novo */
  useEffect(() => {
    if (product) {
      form.reset({
        nome: product.nome,
        marca: product.marca,
        modelo: product.modelo,
        qualidade: product.qualidade,
        valor_dinheiro_pix_display: maskBRL(String(product.valor_dinheiro_pix ?? '')),
        valor_parcelado_6x_display: maskBRL(String(product.valor_parcelado_6x ?? '')),
      });
    } else {
      form.reset({
        nome: '',
        marca: '',
        modelo: '',
        qualidade: '',
        valor_dinheiro_pix_display: '',
        valor_parcelado_6x_display: '',
      });
    }
  }, [product, form]);

  /** Submit */
  const onSubmit = (data: ProdutoFormData) => {
    console.log('🔍 ProdutoForm onSubmit - Debug Info:', {
      isEditing,
      hasProduct: !!product,
      productId: product?.id,
      productKeys: product ? Object.keys(product) : [],
    });

    const produtoData = {
      nome: data.nome,
      marca: data.marca,
      modelo: data.modelo,
      qualidade: data.qualidade,
      valor_dinheiro_pix: parseBRLInput(data.valor_dinheiro_pix_display),
      valor_parcelado_6x: data.valor_parcelado_6x_display ? parseBRLInput(data.valor_parcelado_6x_display) : undefined,
    };

    if (isEditing && product && product.id) {
      console.log('✏️ Modo UPDATE - ID:', product.id);
      updateMutation.mutate(
        { id: product.id, data: produtoData },
        {
          onSuccess: () => {
            onOpenChange(false);
            form.reset();
          },
        }
      );
    } else {
      console.log('➕ Modo CREATE - Criando novo produto');
      createMutation.mutate(produtoData, {
        onSuccess: () => {
          onOpenChange(false);
          form.reset();
        },
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Produto/Serviço' : 'Novo Produto/Serviço'}</DialogTitle>
          <p className="text-sm text-muted-foreground">Preencha os dados e salve para {isEditing ? 'atualizar' : 'criar'} o produto.</p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nome */}
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex: Tela Samsung Galaxy A20S" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Marca */}
              <FormField
                control={form.control}
                name="marca"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marca *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex: Samsung, Apple, Xiaomi" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Modelo */}
              <FormField
                control={form.control}
                name="modelo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modelo *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex: A20S, iPhone 12, Poco X5" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Qualidade */}
              <FormField
                control={form.control}
                name="qualidade"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Qualidade *</FormLabel>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsQualidadeManagerOpen(true)}
                        className="h-8 px-2"
                      >
                        <Settings className="w-4 h-4 mr-1" />
                        Gerenciar
                      </Button>
                    </div>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a qualidade" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {qualidades && qualidades.length > 0 ? (
                          qualidades.map((qualidade) => (
                            <SelectItem key={qualidade.id} value={qualidade.name}>
                              {qualidade.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-options" disabled>
                            Nenhuma qualidade cadastrada
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Valor Dinheiro/Pix */}
              <FormField
                control={form.control}
                name="valor_dinheiro_pix_display"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Dinheiro/Pix *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(e) => field.onChange(maskBRL(e.target.value))}
                        placeholder="R$ 0,00"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Valor Parcelado 6x */}
              <FormField
                control={form.control}
                name="valor_parcelado_6x_display"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Parcelado 6x</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(e) => field.onChange(maskBRL(e.target.value))}
                        placeholder="R$ 0,00"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : isEditing ? 'Atualizar' : 'Criar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    <QualidadeManager
      open={isQualidadeManagerOpen}
      onOpenChange={setIsQualidadeManagerOpen}
    />
  </>
  );
}

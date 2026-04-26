import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import type { AlertCatalogItem, AlertConfigItem } from '@/hooks/useAlerts';

/** Valores de exemplo para teste de envio — mensagem não sai "vazia" com [var]. */
const SAMPLE_PAYLOAD: Record<string, string> = {
  cliente: 'Maria Silva',
  numero_os: '7111',
  marca: 'Apple',
  modelo: 'iPhone 11',
  usuario: 'Atendente',
  link_os: 'https://exemplo.com/acompanhar-os/123',
  defeito: 'Sem áudio / troca de alto-falante',
  empresa: 'Minha Empresa',
  status: 'Aberta',
  valor: 'R$ 150,00',
  total_vendas: 'R$ 2.500,00',
  quantidade_vendas: '18',
  ticket_medio: 'R$ 138,89',
  dias: '3',
  data_vencimento: '25/02/2026',
  descricao: 'Manutenção preventiva',
  meta: 'R$ 10.000,00',
  valor_abertura: 'R$ 500,00',
  valor_fechamento: 'R$ 1.200,00',
  horario: '20:00',
  tipo: 'Venda',
  id: '123',
  campo: 'status',
  valor_anterior: 'Aberta',
  valor_novo: 'Finalizada',
  limite: 'R$ 5.000,00',
  mota: 'R$ 8.000,00', // typo comum no catálogo (meta)
};

function getSampleValue(varName: string): string {
  const key = varName.toLowerCase().replace(/\s/g, '_');
  return SAMPLE_PAYLOAD[key] ?? SAMPLE_PAYLOAD[varName] ?? `(exemplo: ${varName})`;
}

export function AlertRow({
  catalogItem,
  config,
  onSave,
  onPreview,
  onTest,
}: {
  catalogItem: AlertCatalogItem;
  config?: AlertConfigItem;
  onSave: (args: { codigo: string; data: Partial<AlertConfigItem> }) => Promise<unknown>;
  onPreview: (args: { template: string; payload?: Record<string, unknown> }) => Promise<string>;
  onTest?: (args: { codigo_alerta: string; payload?: Record<string, unknown> }) => Promise<unknown>;
}) {
  const ativoDefault = config?.ativo ?? catalogItem.ativo_por_padrao ?? false;
  const templateDefault = config?.template_mensagem ?? catalogItem.template_padrao ?? '';
  const templateOriginal = catalogItem.template_padrao ?? '';
  const [ativo, setAtivo] = useState(ativoDefault);
  const [template, setTemplate] = useState(templateDefault);
  const [previewText, setPreviewText] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const vars = catalogItem.variaveis_disponiveis ?? [];
  const isTemplateModified = template !== templateOriginal;

  useEffect(() => {
    setAtivo(config?.ativo ?? catalogItem.ativo_por_padrao ?? false);
    setTemplate(config?.template_mensagem ?? catalogItem.template_padrao ?? '');
  }, [config?.ativo, config?.template_mensagem, catalogItem.ativo_por_padrao, catalogItem.template_padrao]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        codigo: catalogItem.codigo_alerta,
        data: { ativo, template_mensagem: template || undefined },
      });
      toast.success(`Configuração de "${catalogItem.nome}" salva.`);
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    const payload: Record<string, string> = {};
    vars.forEach((v) => (payload[v] = `[${v}]`));
    try {
      const msg = await onPreview({ template, payload });
      setPreviewText(msg);
    } catch {
      setPreviewText('(erro ao gerar pré-visualização)');
    }
  };

  const handleTest = async () => {
    if (!onTest) return;
    const payload: Record<string, string> = {};
    vars.forEach((v) => (payload[v] = getSampleValue(v)));
    setTesting(true);
    try {
      await onTest({ codigo_alerta: catalogItem.codigo_alerta, payload });
      toast.success('Mensagem de teste enviada para os números configurados.');
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Erro ao enviar teste.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{catalogItem.nome}</p>
          {catalogItem.descricao && (
            <p className="text-sm text-muted-foreground">{catalogItem.descricao}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={ativo} onCheckedChange={setAtivo} />
          <span className="text-sm">{ativo ? 'Ativo' : 'Inativo'}</span>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Template da mensagem</Label>
        <Textarea
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          placeholder="Use variáveis como {cliente}, {numero_os}, {valor}..."
          rows={6}
          className="resize-y min-h-[120px] font-mono text-sm"
        />
        <div className="flex items-center justify-between">
          {vars.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Variáveis: {vars.map((v) => `{${v}}`).join(', ')}
            </p>
          )}
          {isTemplateModified && templateOriginal && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs h-6 px-2"
              onClick={() => setTemplate(templateOriginal)}
            >
              Restaurar padrão
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Envia via <strong>WhatsApp</strong> para os números configurados em <strong>Configurações</strong> do painel.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={handlePreview}>
          Pré-visualizar
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar este alerta'}
        </Button>
        {onTest && (
          <Button size="sm" variant="secondary" onClick={handleTest} disabled={testing}>
            <Send className="h-3.5 w-3.5 mr-1.5" />
            {testing ? 'Enviando...' : 'Testar mensagem'}
          </Button>
        )}
      </div>
      {previewText && (
        <div className="rounded bg-muted p-3 text-sm whitespace-pre-wrap">{previewText}</div>
      )}
    </div>
  );
}

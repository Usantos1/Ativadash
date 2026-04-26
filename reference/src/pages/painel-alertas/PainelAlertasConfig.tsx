/**
 * Painel de Alertas — Configurações gerais (rota /painel-alertas/configuracoes)
 */
import { useState, useEffect } from 'react';
import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAlertsPanel, useAlertsTest, type PanelConfig } from '@/hooks/useAlerts';
import { Send } from 'lucide-react';
import { DIAS_SEMANA } from './constants';
import { PainelAlertasNav } from './PainelAlertasNav';

export default function PainelAlertasConfig() {
  const { panel, panelLoading, savePanel, savePanelLoading } = useAlertsPanel();
  const { sendTest, testLoading } = useAlertsTest();
  const [form, setForm] = useState<Partial<PanelConfig>>({
    nome_painel: 'Painel de Alertas',
    ativo: false,
    numero_principal: '',
    numeros_adicionais: [],
    horario_inicio_envio: '08:00',
    horario_fim_envio: '22:00',
    timezone: 'America/Sao_Paulo',
    relatorio_diario_ativo: false,
    horario_relatorio_diario: '19:00',
    resumo_semanal_ativo: false,
    dia_resumo_semanal: 0,
    horario_resumo_semanal: '09:00',
    canal_padrao: 'whatsapp',
  });
  const [numerosAdicionaisText, setNumerosAdicionaisText] = useState('');

  useEffect(() => {
    if (panel) {
      setForm({
        nome_painel: panel.nome_painel ?? 'Painel de Alertas',
        ativo: panel.ativo ?? false,
        numero_principal: panel.numero_principal ?? '',
        numeros_adicionais: panel.numeros_adicionais ?? [],
        horario_inicio_envio: panel.horario_inicio_envio ?? '08:00',
        horario_fim_envio: panel.horario_fim_envio ?? '22:00',
        timezone: panel.timezone ?? 'America/Sao_Paulo',
        relatorio_diario_ativo: panel.relatorio_diario_ativo ?? false,
        horario_relatorio_diario: panel.horario_relatorio_diario ?? '19:00',
        resumo_semanal_ativo: panel.resumo_semanal_ativo ?? false,
        dia_resumo_semanal: panel.dia_resumo_semanal ?? 0,
        horario_resumo_semanal: panel.horario_resumo_semanal ?? '09:00',
        canal_padrao: panel.canal_padrao ?? 'whatsapp',
      });
      setNumerosAdicionaisText((panel.numeros_adicionais ?? []).join(', '));
    }
  }, [panel]);

  const handleSavePanel = async () => {
    const numeros = numerosAdicionaisText
      .split(/[\n,;]+/)
      .map((n) => n.trim().replace(/\D/g, ''))
      .filter(Boolean);
    try {
      await savePanel({ ...form, numeros_adicionais: numeros });
      toast.success('Configurações salvas com sucesso.');
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Erro ao salvar.');
    }
  };

  const handleTestSend = async () => {
    try {
      await sendTest({ mensagem: 'Teste do Painel de Alertas. Envio funcionando!' });
      toast.success('Mensagem de teste enviada.');
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Erro ao enviar teste.');
    }
  };

  return (
    <ModernLayout
      title="Painel de Alertas"
      subtitle="Configurações gerais — notificações por WhatsApp (Ativa CRM)"
    >
      <div className="h-full flex flex-col min-h-0 p-4 md:p-6 w-full">
        <PainelAlertasNav />
        {panelLoading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-6 pb-4 overflow-auto">
            <Card>
              <CardHeader>
                <CardTitle>Configurações gerais</CardTitle>
                <CardDescription>
                  Ative o painel, defina o número principal e a janela de envio. Todas as configurações são exclusivas da sua empresa.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <Label>Ativar Painel de Alertas</Label>
                    <p className="text-xs text-muted-foreground">Quando desativado, nenhum alerta é enviado.</p>
                  </div>
                  <Switch
                    checked={form.ativo ?? false}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="nome_painel">Nome do painel</Label>
                    <Input
                      id="nome_painel"
                      value={form.nome_painel ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, nome_painel: e.target.value }))}
                      placeholder="Ex.: Painel de Alertas"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numero_principal">Número principal (WhatsApp)</Label>
                    <Input
                      id="numero_principal"
                      value={form.numero_principal ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, numero_principal: e.target.value }))}
                      placeholder="Ex.: 5511999999999"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numeros_adicionais">Números adicionais (separados por vírgula ou linha)</Label>
                  <Textarea
                    id="numeros_adicionais"
                    value={numerosAdicionaisText}
                    onChange={(e) => setNumerosAdicionaisText(e.target.value)}
                    placeholder="5511888888888, 5511777777777"
                    rows={2}
                    className="resize-none"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="horario_inicio">Horário inicial permitido para envio</Label>
                    <Input
                      id="horario_inicio"
                      type="time"
                      value={form.horario_inicio_envio ?? '08:00'}
                      onChange={(e) => setForm((f) => ({ ...f, horario_inicio_envio: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="horario_fim">Horário final permitido para envio</Label>
                    <Input
                      id="horario_fim"
                      type="time"
                      value={form.horario_fim_envio ?? '22:00'}
                      onChange={(e) => setForm((f) => ({ ...f, horario_fim_envio: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone da empresa</Label>
                  <Select
                    value={form.timezone ?? 'America/Sao_Paulo'}
                    onValueChange={(v) => setForm((f) => ({ ...f, timezone: v }))}
                  >
                    <SelectTrigger id="timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/Sao_Paulo">America/Sao_Paulo (Brasil)</SelectItem>
                      <SelectItem value="America/Manaus">America/Manaus</SelectItem>
                      <SelectItem value="America/Fortaleza">America/Fortaleza</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.relatorio_diario_ativo ?? false}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, relatorio_diario_ativo: v }))}
                    />
                    <Label>Ativar relatório diário automático</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-muted-foreground">Horário:</Label>
                    <Input
                      type="time"
                      value={form.horario_relatorio_diario ?? '19:00'}
                      onChange={(e) => setForm((f) => ({ ...f, horario_relatorio_diario: e.target.value }))}
                      className="w-32"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.resumo_semanal_ativo ?? false}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, resumo_semanal_ativo: v }))}
                    />
                    <Label>Ativar resumo semanal</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-muted-foreground">Dia:</Label>
                    <Select
                      value={String(form.dia_resumo_semanal ?? 0)}
                      onValueChange={(v) => setForm((f) => ({ ...f, dia_resumo_semanal: parseInt(v, 10) }))}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DIAS_SEMANA.map((d) => (
                          <SelectItem key={d.value} value={String(d.value)}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Label className="text-muted-foreground">Horário:</Label>
                    <Input
                      type="time"
                      value={form.horario_resumo_semanal ?? '09:00'}
                      onChange={(e) => setForm((f) => ({ ...f, horario_resumo_semanal: e.target.value }))}
                      className="w-32"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button onClick={handleSavePanel} disabled={savePanelLoading}>
                    {savePanelLoading ? 'Salvando...' : 'Salvar configurações'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleTestSend}
                    disabled={testLoading || !form.numero_principal}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {testLoading ? 'Enviando...' : 'Testar envio'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </ModernLayout>
  );
}

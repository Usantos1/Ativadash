/**
 * Painel de Alertas — configuração de notificações automáticas por empresa.
 * Integração Ativa FIX ↔ Ativa CRM (envio via WhatsApp).
 * Multi-tenant: cada empresa tem suas próprias configurações.
 */

import { useState, useEffect, useMemo } from 'react';
import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  useAlertsPanel,
  useAlertsCatalog,
  useAlertsConfigs,
  useAlertsLogs,
  useAlertsTest,
  useAlertsPreview,
  type PanelConfig,
  type AlertCatalogItem,
  type AlertConfigItem,
} from '@/hooks/useAlerts';
import { Activity, Send, Settings, Bell, History } from 'lucide-react';

const CATEGORIAS: Record<string, string> = {
  operacional: 'Operacional',
  financeiro: 'Financeiro',
  comercial: 'Comercial',
  gestao: 'Gestão',
};

const DIAS_SEMANA = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
];

export default function PainelAlertas() {
  const [activeTab, setActiveTab] = useState('geral');
  const { panel, panelLoading, savePanel, savePanelLoading } = useAlertsPanel();
  const { catalog, catalogLoading } = useAlertsCatalog();
  const { configs, configsLoading, saveOneConfig } = useAlertsConfigs();
  const { sendTest, testLoading } = useAlertsTest();
  const { preview } = useAlertsPreview();

  // Estado local do formulário de configuração geral
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
      await savePanel({
        ...form,
        numeros_adicionais: numeros,
      });
      toast.success('Configurações salvas com sucesso.');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar.');
    }
  };

  const handleTestSend = async () => {
    try {
      await sendTest({ mensagem: 'Teste do Painel de Alertas. Envio funcionando!' });
      toast.success('Mensagem de teste enviada.');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao enviar teste.');
    }
  };

  const configByCodigo = useMemo(() => {
    const map: Record<string, AlertConfigItem> = {};
    for (const c of configs) map[c.codigo_alerta] = c;
    return map;
  }, [configs]);

  const catalogByCategory = useMemo(() => {
    const map: Record<string, AlertCatalogItem[]> = {};
    for (const item of catalog) {
      const cat = item.categoria || 'outros';
      if (!map[cat]) map[cat] = [];
      map[cat].push(item);
    }
    return map;
  }, [catalog]);

  return (
    <ModernLayout
      title="Painel de Alertas"
      subtitle="Configure notificações automáticas por WhatsApp (Ativa CRM)"
    >
      <div className="h-full flex flex-col min-h-0 p-4 md:p-6 space-y-4 w-full">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md shrink-0">
            <TabsTrigger value="geral" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Configurações</span>
            </TabsTrigger>
            <TabsTrigger value="alertas" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Alertas</span>
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Histórico</span>
            </TabsTrigger>
          </TabsList>

          {/* ─── Tab Configurações gerais ───────────────────────────────────── */}
          <TabsContent value="geral" className="mt-4 flex-1 flex flex-col min-h-0 overflow-auto data-[state=inactive]:hidden">
            {panelLoading ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : (
              <div className="space-y-6 pb-4">
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
                      <Button variant="outline" onClick={handleTestSend} disabled={testLoading || !form.numero_principal}>
                        <Send className="h-4 w-4 mr-2" />
                        {testLoading ? 'Enviando...' : 'Testar envio'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* ─── Tab Alertas por categoria ─────────────────────────────────── */}
          <TabsContent value="alertas" className="mt-4 flex-1 flex flex-col min-h-0 overflow-auto data-[state=inactive]:hidden">
            {catalogLoading || configsLoading ? (
              <p className="text-muted-foreground">Carregando catálogo...</p>
            ) : (
              <div className="space-y-8">
                {(['operacional', 'financeiro', 'comercial', 'gestao'] as const).map((cat) => {
                  const items = catalogByCategory[cat] ?? [];
                  if (items.length === 0) return null;
                  return (
                    <Card key={cat}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Activity className="h-5 w-5" />
                          {CATEGORIAS[cat] ?? cat}
                        </CardTitle>
                        <CardDescription>Ative os alertas que deseja receber e personalize o texto quando permitido.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {items.map((item) => (
                          <AlertRow
                            key={item.codigo_alerta}
                            catalogItem={item}
                            config={configByCodigo[item.codigo_alerta]}
                            onSave={saveOneConfig}
                            onPreview={preview}
                          />
                        ))}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ─── Tab Histórico ───────────────────────────────────────────────── */}
          <TabsContent value="historico" className="mt-4 flex-1 flex flex-col min-h-0 overflow-auto data-[state=inactive]:hidden">
            <HistoricoTab />
          </TabsContent>
        </Tabs>
      </div>
    </ModernLayout>
  );
}

function AlertRow({
  catalogItem,
  config,
  onSave,
  onPreview,
}: {
  catalogItem: AlertCatalogItem;
  config?: AlertConfigItem;
  onSave: (args: { codigo: string; data: Partial<AlertConfigItem> }) => Promise<unknown>;
  onPreview: (args: { template: string; payload?: Record<string, unknown> }) => Promise<string>;
}) {
  const ativoDefault = config?.ativo ?? catalogItem.ativo_por_padrao ?? false;
  const templateDefault = config?.template_mensagem ?? catalogItem.template_padrao ?? '';
  const [ativo, setAtivo] = useState(ativoDefault);
  const [template, setTemplate] = useState(templateDefault);
  const [previewText, setPreviewText] = useState('');
  const [saving, setSaving] = useState(false);
  const vars = catalogItem.variaveis_disponiveis ?? [];

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
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar.');
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
  }

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
          rows={4}
          className="resize-none font-mono text-sm"
        />
        {vars.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Variáveis: {vars.map((v) => `{${v}}`).join(', ')}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={handlePreview}>
          Pré-visualizar
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar este alerta'}
        </Button>
      </div>
      {previewText && (
        <div className="rounded bg-muted p-3 text-sm whitespace-pre-wrap">{previewText}</div>
      )}
    </div>
  );
}

function HistoricoTab() {
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim, setPeriodoFim] = useState('');
  const [categoria, setCategoria] = useState('');
  const [status, setStatus] = useState('');
  const filters = useMemo(() => ({
    periodo_inicio: periodoInicio || undefined,
    periodo_fim: periodoFim || undefined,
    categoria: categoria || undefined,
    status: status || undefined,
    limit: 100,
    offset: 0,
  }), [periodoInicio, periodoFim, categoria, status]);
  const { logs, logsTotal, logsLoading } = useAlertsLogs(filters);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de alertas</CardTitle>
        <CardDescription>
          Últimos alertas enviados. Filtre por período, categoria e status.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Início</Label>
            <Input
              type="date"
              value={periodoInicio}
              onChange={(e) => setPeriodoInicio(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fim</Label>
            <Input
              type="date"
              value={periodoFim}
              onChange={(e) => setPeriodoFim(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Categoria</Label>
            <Select value={categoria || '__all__'} onValueChange={(v) => setCategoria(v === '__all__' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                {Object.entries(CATEGORIAS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={status || '__all__'} onValueChange={(v) => setStatus(v === '__all__' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                <SelectItem value="enviado">Enviado</SelectItem>
                <SelectItem value="erro">Erro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {logsLoading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : (
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="max-w-[200px]">Mensagem</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhum registro no período.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {row.created_at ? new Date(row.created_at).toLocaleString('pt-BR') : '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.codigo_alerta}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{CATEGORIAS[row.categoria ?? ''] ?? row.categoria ?? '-'}</Badge>
                      </TableCell>
                      <TableCell>{row.destino}</TableCell>
                      <TableCell>
                        <Badge variant={row.status === 'enviado' ? 'default' : 'destructive'}>
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm" title={row.mensagem_final}>
                        {row.mensagem_final ?? '-'}
                      </TableCell>
                      <TableCell className="text-destructive text-xs max-w-[150px] truncate" title={row.erro}>
                        {row.erro ?? '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
        {logsTotal > 0 && (
          <p className="text-sm text-muted-foreground">Total: {logsTotal} registro(s)</p>
        )}
      </CardContent>
    </Card>
  );
}

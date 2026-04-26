import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, Copy, Trash2, Eye, CheckCircle, XCircle, 
  Webhook, Link, Clock, AlertTriangle, ExternalLink, FlaskConical, ArrowRight,
  Radio, Square, Play, Loader2
} from 'lucide-react';
import { useWebhooks, useWebhookLogs, WebhookConfig } from '@/hooks/useWebhooks';
import { dateFormatters } from '@/utils/formatters';
import { LoadingButton } from '@/components/LoadingButton';
import { useToast } from '@/hooks/use-toast';

const apiUrl = import.meta.env.VITE_API_URL || 'https://api.ativafix.com';

// Função para extrair valor de um caminho aninhado (ex: "contact.name")
const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
};

// Função para mapear campos do payload para o lead
const mapPayloadToLead = (payload: any) => {
  // Normaliza chaves removendo : e espaços extras
  const normalizeKey = (key: string) => key.toLowerCase().replace(/[:\s]+/g, '').trim();
  
  // Primeiro, tenta detectar o formato do payload
  const isAtivaCRMTicket = payload.ticket && payload.contact;
  const isElementorForm = payload['Nome:'] || payload['E-mail:'] || payload.form_id;
  
  // Se for formato AtivaCRM (ticket de WhatsApp), extrair dados do contact
  if (isAtivaCRMTicket) {
    const contact = payload.contact || {};
    const rawMessage = payload.rawMessage?.Info || {};
    const messages = payload.messages || [];
    const lastMessage = messages[0]?.body || payload.ticket?.lastMessage || '';
    
    return {
      mapped: {
        nome: { value: contact.name || rawMessage.PushName || '', originalKey: 'contact.name' },
        telefone: { value: contact.number || rawMessage.Sender || '', originalKey: 'contact.number' },
        whatsapp: { value: contact.number || rawMessage.Sender || '', originalKey: 'contact.number' },
        email: { value: contact.email || '', originalKey: 'contact.email' },
        observacoes: { value: lastMessage, originalKey: 'messages[0].body' },
        utm_source: { value: 'ativacrm_whatsapp', originalKey: 'auto' },
      },
      unmapped: {
        ticket_id: payload.ticket?.id,
        ticket_status: payload.ticket?.status,
        queue_name: payload.ticket?.queueName,
        company_name: payload.company?.name,
        whatsapp_name: payload.whatsapp?.name,
        profile_pic: contact.profilePicUrl,
      },
      format: 'AtivaCRM WhatsApp Ticket'
    };
  }
  
  // Formato padrão (Elementor, formulários, etc.)
  const normalizedPayload: Record<string, any> = {};
  for (const [key, value] of Object.entries(payload)) {
    normalizedPayload[normalizeKey(key)] = value;
  }
  
  // Mapeamentos de campos conhecidos
  const mappings: Record<string, string[]> = {
    nome: ['nome', 'name', 'fullname', 'full_name', 'nomecompleto'],
    email: ['email', 'e-mail', 'emailaddress'],
    telefone: ['telefone', 'phone', 'fone', 'tel', 'dddtelefone', 'ddd+telefone'],
    whatsapp: ['whatsapp', 'celular', 'mobile'],
    cidade: ['cidade', 'city'],
    estado: ['estado', 'state', 'uf'],
    interesse: ['interesse', 'interest', 'produto', 'servico', 'mensagem', 'message'],
    observacoes: ['observacoes', 'notes', 'obs', 'mensagem', 'message'],
    utm_source: ['utm_source', 'utmsource', 'source'],
    utm_medium: ['utm_medium', 'utmmedium', 'medium'],
    utm_campaign: ['utm_campaign', 'utmcampaign', 'campaign', 'campanha'],
    utm_term: ['utm_term', 'utmterm', 'term'],
  };
  
  const result: Record<string, { value: string; originalKey: string }> = {};
  
  for (const [field, aliases] of Object.entries(mappings)) {
    for (const alias of aliases) {
      if (normalizedPayload[alias] !== undefined && typeof normalizedPayload[alias] !== 'object') {
        // Encontra a chave original
        const originalKey = Object.keys(payload).find(k => normalizeKey(k) === alias) || alias;
        result[field] = { 
          value: String(normalizedPayload[alias] || ''), 
          originalKey 
        };
        break;
      }
    }
  }
  
  // Campos não mapeados
  const mappedAliases = new Set<string>();
  for (const aliases of Object.values(mappings)) {
    aliases.forEach(a => mappedAliases.add(a));
  }
  
  const unmapped: Record<string, any> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!mappedAliases.has(normalizeKey(key))) {
      unmapped[key] = value;
    }
  }
  
  return { mapped: result, unmapped, format: isElementorForm ? 'Elementor Form' : 'Generic' };
};

export function WebhookManager() {
  const { toast } = useToast();
  const { webhooks, isLoading, createWebhook, updateWebhook, deleteWebhook, getWebhookUrl, isCreating, isUpdating } = useWebhooks();
  
  const [activeTab, setActiveTab] = useState<'config' | 'test'>('config');
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLogsDialog, setShowLogsDialog] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookConfig | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    nome: '',
    fonte_padrao: 'ativacrm',
    descricao: '',
  });

  // Estados para teste de webhook em tempo real
  const [testSession, setTestSession] = useState<{ sessionId: string; testUrl: string } | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [testEvents, setTestEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [mappedResult, setMappedResult] = useState<{ mapped: Record<string, { value: string; originalKey: string }>; unmapped: Record<string, any> } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [lastPoll, setLastPoll] = useState<Date | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const { logs, isLoading: logsLoading } = useWebhookLogs(selectedWebhook?.id || null);

  // Iniciar sessão de teste
  const startTestSession = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${apiUrl}/api/webhook/test/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setTestSession({ sessionId: data.sessionId, testUrl: data.testUrl });
        setTestEvents([]);
        setSelectedEvent(null);
        setMappedResult(null);
        setIsListening(true);
        toast({ title: 'Sessão de teste iniciada!', description: 'Envie webhooks para a URL de teste' });
        
        // Iniciar polling
        startPolling(data.sessionId);
      } else {
        toast({ title: 'Erro', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Erro', description: 'Falha ao criar sessão de teste', variant: 'destructive' });
    }
  };
  
  // Polling para buscar eventos
  const startPolling = (sessionId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    
    const fetchEvents = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${apiUrl}/api/webhook/test/${sessionId}/events`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          setConnectionStatus('error');
          console.error('Erro na resposta:', response.status);
          return;
        }
        
        const data = await response.json();
        setConnectionStatus('connected');
        setLastPoll(new Date());
        
        if (data.success && data.events) {
          setTestEvents(prev => {
            // Mesclar eventos novos
            const existingIds = new Set(prev.map(e => e.id));
            const newEvents = data.events.filter((e: any) => !existingIds.has(e.id));
            if (newEvents.length > 0) {
              toast({ title: `🎉 ${newEvents.length} novo(s) evento(s) recebido(s)!`, description: 'Clique no evento para analisar' });
            }
            return [...prev, ...newEvents];
          });
        }
      } catch (error) {
        console.error('Erro ao buscar eventos:', error);
        setConnectionStatus('error');
      }
    };
    
    // Buscar imediatamente e depois a cada 2 segundos
    setConnectionStatus('connecting');
    fetchEvents();
    pollingRef.current = setInterval(fetchEvents, 2000);
  };
  
  // Parar sessão de teste
  const stopTestSession = async () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    
    if (testSession) {
      try {
        const token = localStorage.getItem('auth_token');
        await fetch(`${apiUrl}/api/webhook/test/${testSession.sessionId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (error) {
        console.error('Erro ao encerrar sessão:', error);
      }
    }
    
    setIsListening(false);
    toast({ title: 'Sessão encerrada' });
  };
  
  // Analisar evento selecionado
  const analyzeEvent = (event: any) => {
    setSelectedEvent(event);
    const result = mapPayloadToLead(event.payload);
    setMappedResult(result);
  };
  
  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const resetForm = () => {
    setForm({ nome: '', fonte_padrao: 'ativacrm', descricao: '' });
    setSelectedWebhook(null);
  };

  const handleOpenDialog = (webhook?: WebhookConfig) => {
    if (webhook) {
      setSelectedWebhook(webhook);
      setForm({
        nome: webhook.nome,
        fonte_padrao: webhook.fonte_padrao,
        descricao: webhook.descricao || '',
      });
    } else {
      resetForm();
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (selectedWebhook) {
      await updateWebhook({ id: selectedWebhook.id, ...form });
    } else {
      await createWebhook(form);
    }
    setShowDialog(false);
    resetForm();
  };

  const handleDelete = async () => {
    if (deletingId) {
      await deleteWebhook(deletingId);
      setShowDeleteDialog(false);
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (webhook: WebhookConfig) => {
    await updateWebhook({ id: webhook.id, is_active: !webhook.is_active });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'URL copiada!' });
  };

  const handleViewLogs = (webhook: WebhookConfig) => {
    setSelectedWebhook(webhook);
    setShowLogsDialog(true);
  };

  return (
    <div className="space-y-4">
      {/* Tabs: Configuração e Teste */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'config' | 'test')}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="config" className="text-xs">
              <Webhook className="h-3.5 w-3.5 mr-1.5" />
              Configuração
            </TabsTrigger>
            <TabsTrigger value="test" className="text-xs">
              <FlaskConical className="h-3.5 w-3.5 mr-1.5" />
              Testar Payload
            </TabsTrigger>
          </TabsList>
          
          {activeTab === 'config' && (
            <Button onClick={() => handleOpenDialog()} size="sm" className="h-8">
              <Plus className="h-4 w-4 mr-1" />Novo Webhook
            </Button>
          )}
        </div>

        {/* Tab de Teste de Payload em Tempo Real */}
        <TabsContent value="test" className="space-y-4 mt-4">
          {/* Controles do Listener */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Radio className={`h-5 w-5 ${isListening ? 'text-green-500 animate-pulse' : 'text-muted-foreground'}`} />
                Listener de Webhook em Tempo Real
              </CardTitle>
              <CardDescription>
                Inicie a escuta para receber e analisar webhooks de teste automaticamente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isListening ? (
                <Button onClick={startTestSession} className="w-full" size="lg">
                  <Play className="h-4 w-4 mr-2" />
                  Iniciar Escuta
                </Button>
              ) : (
                <div className="space-y-4">
                  {/* Status da Conexão */}
                  <div className={`rounded-lg p-3 border ${
                    connectionStatus === 'connected' ? 'bg-green-50 dark:bg-green-950/20 border-green-300' :
                    connectionStatus === 'error' ? 'bg-red-50 dark:bg-red-950/20 border-red-300' :
                    'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {connectionStatus === 'connected' ? (
                          <>
                            <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-sm font-medium text-green-700 dark:text-green-300">Conectado - Aguardando webhooks</span>
                          </>
                        ) : connectionStatus === 'error' ? (
                          <>
                            <div className="h-3 w-3 bg-red-500 rounded-full" />
                            <span className="text-sm font-medium text-red-700 dark:text-red-300">Erro de conexão</span>
                          </>
                        ) : (
                          <>
                            <Loader2 className="h-3 w-3 text-yellow-600 animate-spin" />
                            <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Conectando...</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{testEvents.length} evento(s)</Badge>
                        {lastPoll && (
                          <span className="text-[10px] text-muted-foreground">
                            Último check: {lastPoll.toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* URL de Teste */}
                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 rounded-lg p-4">
                    <Label className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      📋 URL de Teste - Copie e cole no sistema de origem:
                    </Label>
                    <div className="flex items-center gap-2 mt-2">
                      <Input 
                        value={testSession?.testUrl || ''} 
                        readOnly 
                        className="font-mono text-xs bg-white dark:bg-gray-900"
                      />
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(testSession?.testUrl || '');
                          toast({ title: '✅ URL copiada!', description: 'Cole no sistema de origem e envie um teste' });
                        }}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copiar
                      </Button>
                    </div>
                    
                    <div className="mt-3 p-3 bg-white dark:bg-gray-900 rounded border">
                      <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-2">📌 Passos para testar:</p>
                      <ol className="text-xs text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
                        <li>Copie a URL acima</li>
                        <li>Cole no AtivaCRM, Elementor ou outro sistema</li>
                        <li>Envie um webhook de teste</li>
                        <li>O evento aparecerá automaticamente na lista abaixo</li>
                      </ol>
                    </div>
                    
                    {/* Botão de Teste Manual */}
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="w-full mt-2"
                      onClick={async () => {
                        try {
                          const response = await fetch(testSession?.testUrl || '', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              'Nome:': 'Lead de Teste',
                              'E-mail:': 'teste@exemplo.com',
                              'DDD + Telefone:': '+5519999999999',
                              'Mensagem:': 'Este é um webhook de teste enviado manualmente',
                              'utm_source': 'teste_manual',
                              'Data': new Date().toLocaleDateString('pt-BR'),
                              'Horário': new Date().toLocaleTimeString('pt-BR')
                            })
                          });
                          if (response.ok) {
                            toast({ title: '✅ Webhook de teste enviado!', description: 'Aguarde aparecer na lista abaixo' });
                          } else {
                            toast({ title: '❌ Erro ao enviar', description: 'Verifique se o backend está atualizado', variant: 'destructive' });
                          }
                        } catch (error) {
                          toast({ title: '❌ Erro de conexão', description: 'Não foi possível enviar o teste', variant: 'destructive' });
                        }
                      }}
                    >
                      <FlaskConical className="h-4 w-4 mr-2" />
                      Enviar Webhook de Teste Manual
                    </Button>
                  </div>
                  
                  <Button onClick={stopTestSession} variant="destructive" className="w-full">
                    <Square className="h-4 w-4 mr-2" />
                    Parar Escuta
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Lista de Eventos Recebidos */}
          {testEvents.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Eventos Recebidos</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {testEvents.map((event, index) => (
                      <div 
                        key={event.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedEvent?.id === event.id 
                            ? 'bg-primary/10 border-primary' 
                            : 'bg-muted/50 hover:bg-muted'
                        }`}
                        onClick={() => analyzeEvent(event)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">#{testEvents.length - index}</Badge>
                            <span className="text-xs font-medium">
                              {event.payload?.nome || event.payload?.name || event.payload?.['Nome:'] || 'Payload recebido'}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 truncate">
                          {Object.keys(event.payload || {}).join(', ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
          
          {/* Análise do Evento Selecionado */}
          {selectedEvent && mappedResult && (
            <div className="space-y-4">
              {/* Formato Detectado */}
              {(mappedResult as any).format && (
                <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-purple-600">Formato Detectado</Badge>
                    <span className="font-medium text-purple-800 dark:text-purple-200">
                      {(mappedResult as any).format}
                    </span>
                  </div>
                </div>
              )}
              
              {/* Payload Original */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Payload Original Recebido</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto max-h-[200px]">
{JSON.stringify(selectedEvent.payload, null, 2)}
                  </pre>
                </CardContent>
              </Card>
              
              {/* Campos Mapeados */}
              <Card className="bg-green-50 dark:bg-green-950/20 border-green-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-green-800 dark:text-green-200">
                    <CheckCircle className="h-4 w-4" />
                    Campos Mapeados ({Object.keys(mappedResult.mapped).length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Campo Original</TableHead>
                        <TableHead className="text-xs">→</TableHead>
                        <TableHead className="text-xs">Campo do Lead</TableHead>
                        <TableHead className="text-xs">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(mappedResult.mapped).map(([field, { value, originalKey }]) => (
                        <TableRow key={field}>
                          <TableCell className="font-mono text-xs">{originalKey}</TableCell>
                          <TableCell><ArrowRight className="h-3 w-3 text-muted-foreground" /></TableCell>
                          <TableCell className="font-medium text-xs text-green-700 dark:text-green-300">{field}</TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">{value || <span className="text-muted-foreground">(vazio)</span>}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              
              {/* Campos Não Mapeados */}
              {Object.keys(mappedResult.unmapped).length > 0 && (
                <Card className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                      <AlertTriangle className="h-4 w-4" />
                      Campos Não Mapeados ({Object.keys(mappedResult.unmapped).length})
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Estes campos são recebidos mas não são salvos automaticamente no lead
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Campo</TableHead>
                          <TableHead className="text-xs">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(mappedResult.unmapped).map(([key, value]) => (
                          <TableRow key={key}>
                            <TableCell className="font-mono text-xs">{key}</TableCell>
                            <TableCell className="text-xs max-w-[300px] truncate">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
              
              {/* Preview do Lead */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Preview: Lead que seria criado</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{JSON.stringify({
  nome: mappedResult.mapped.nome?.value || '',
  email: mappedResult.mapped.email?.value || '',
  telefone: mappedResult.mapped.telefone?.value || '',
  whatsapp: mappedResult.mapped.whatsapp?.value || mappedResult.mapped.telefone?.value || '',
  cidade: mappedResult.mapped.cidade?.value || '',
  estado: mappedResult.mapped.estado?.value || '',
  interesse: mappedResult.mapped.interesse?.value || '',
  observacoes: mappedResult.mapped.observacoes?.value || '',
  utm_source: mappedResult.mapped.utm_source?.value || '',
  utm_medium: mappedResult.mapped.utm_medium?.value || '',
  utm_campaign: mappedResult.mapped.utm_campaign?.value || '',
}, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Referência de Campos */}
          <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
            <CardContent className="p-4">
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Campos Suportados</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-blue-700 dark:text-blue-300">
                <div><strong>nome:</strong> nome, name, fullname</div>
                <div><strong>email:</strong> email, e-mail</div>
                <div><strong>telefone:</strong> telefone, phone, ddd+telefone</div>
                <div><strong>whatsapp:</strong> whatsapp, celular, mobile</div>
                <div><strong>cidade:</strong> cidade, city</div>
                <div><strong>estado:</strong> estado, state, uf</div>
                <div><strong>interesse:</strong> interesse, produto, mensagem</div>
                <div><strong>utm_source:</strong> utm_source, source</div>
                <div><strong>utm_campaign:</strong> utm_campaign, campaign</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab de Configuração */}
        <TabsContent value="config" className="space-y-4 mt-4">
      {/* Lista de Webhooks */}
      {webhooks.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Webhook className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">Nenhum webhook configurado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crie um webhook para receber leads automaticamente do AtivaCRM ou outras fontes.
            </p>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-1" />Criar Webhook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {webhooks.map((webhook) => (
            <Card key={webhook.id} className={!webhook.is_active ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium truncate">{webhook.nome}</h4>
                      <Badge variant={webhook.is_active ? 'default' : 'secondary'} className="text-[10px]">
                        {webhook.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    
                    {webhook.descricao && (
                      <p className="text-xs text-muted-foreground mb-2">{webhook.descricao}</p>
                    )}
                    
                    {/* URL do Webhook */}
                    <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-lg">
                      <Link className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <code className="text-[10px] md:text-xs text-muted-foreground truncate flex-1">
                        {getWebhookUrl(webhook.webhook_key)}
                      </code>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 shrink-0"
                        onClick={() => copyToClipboard(getWebhookUrl(webhook.webhook_key))}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    {/* Stats */}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        {webhook.leads_recebidos || 0} leads
                      </span>
                      {webhook.ultimo_lead_em && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Último: {dateFormatters.short(webhook.ultimo_lead_em)}
                        </span>
                      )}
                      <span>Fonte: {webhook.fonte_padrao}</span>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch 
                      checked={webhook.is_active} 
                      onCheckedChange={() => handleToggleActive(webhook)}
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewLogs(webhook)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(webhook)}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8" 
                      onClick={() => { setDeletingId(webhook.id); setShowDeleteDialog(true); }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info de integração */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
        <CardContent className="p-4">
          <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Como integrar com AtivaCRM</h4>
          <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
            <li>Crie um webhook acima e copie a URL</li>
            <li>No AtivaCRM, vá em Configurações → Webhooks</li>
            <li>Cole a URL e configure os campos a serem enviados</li>
            <li>Teste enviando um lead e verifique os logs</li>
          </ol>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
            Campos suportados: nome, email, telefone, whatsapp, cidade, estado, interesse, utm_source, utm_medium, utm_campaign, utm_term, mensagem
          </p>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de criação/edição */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedWebhook ? 'Editar Webhook' : 'Novo Webhook'}</DialogTitle>
            <DialogDescription>
              Configure um webhook para receber leads automaticamente
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Nome do Webhook *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: AtivaCRM - Campanhas Google"
              />
            </div>
            
            <div>
              <Label>Fonte Padrão</Label>
              <Input
                value={form.fonte_padrao}
                onChange={(e) => setForm({ ...form, fonte_padrao: e.target.value })}
                placeholder="Ex: ativacrm, google_ads, meta_ads"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Usado quando o payload não especificar a fonte
              </p>
            </div>
            
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Descrição opcional do webhook..."
                rows={2}
              />
            </div>

            {selectedWebhook && (
              <div className="bg-muted/50 p-3 rounded-lg">
                <Label className="text-xs">URL do Webhook</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-xs flex-1 truncate">
                    {getWebhookUrl(selectedWebhook.webhook_key)}
                  </code>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => copyToClipboard(getWebhookUrl(selectedWebhook.webhook_key))}
                  >
                    <Copy className="h-3 w-3 mr-1" />Copiar
                  </Button>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <LoadingButton loading={isCreating || isUpdating} onClick={handleSave} disabled={!form.nome}>
              {selectedWebhook ? 'Salvar' : 'Criar Webhook'}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de logs */}
      <Dialog open={showLogsDialog} onOpenChange={setShowLogsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Logs - {selectedWebhook?.nome}</DialogTitle>
            <DialogDescription>
              Últimos leads e eventos recebidos por este webhook
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[400px]">
            {logsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum log registrado ainda
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Detalhes</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs">
                        {dateFormatters.short(log.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={log.tipo === 'lead_recebido' ? 'default' : log.tipo === 'erro' ? 'destructive' : 'secondary'}
                          className="text-[10px]"
                        >
                          {log.tipo === 'lead_recebido' ? 'Lead' : log.tipo === 'erro' ? 'Erro' : 'Teste'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">
                        {log.erro || (log.payload?.nome || log.payload?.name) || '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.ip_origem || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os logs serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


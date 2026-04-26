import { useState } from 'react';
import { useApiTokens, ApiToken, API_PERMISSIONS } from '@/hooks/useApiTokens';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Key, 
  Plus, 
  Copy, 
  Eye, 
  EyeOff, 
  Trash2, 
  Settings, 
  Activity,
  Clock,
  Shield,
  Code,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Zap
} from 'lucide-react';

export function ApiManager() {
  const { 
    tokens, 
    isLoading, 
    createToken, 
    updateToken, 
    deleteToken, 
    fetchLogs,
    isCreating 
  } = useApiTokens();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedToken, setSelectedToken] = useState<ApiToken | null>(null);
  const [showTokenValue, setShowTokenValue] = useState<Record<string, boolean>>({});
  const [tokenLogs, setTokenLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    permissoes: ['produtos:read'] as string[],
    expires_at: '',
  });

  const handleCreate = async () => {
    await createToken({
      nome: formData.nome,
      descricao: formData.descricao,
      permissoes: formData.permissoes,
      expires_at: formData.expires_at || undefined,
    });
    setShowCreateDialog(false);
    setFormData({ nome: '', descricao: '', permissoes: ['produtos:read'], expires_at: '' });
  };

  const handleToggleActive = async (token: ApiToken) => {
    await updateToken({ id: token.id, data: { ativo: !token.ativo } });
  };

  const handleDelete = async () => {
    if (selectedToken) {
      await deleteToken(selectedToken.id);
      setShowDeleteDialog(false);
      setSelectedToken(null);
    }
  };

  const handleCopyToken = (token: string) => {
    navigator.clipboard.writeText(token);
  };

  const handleViewLogs = async (token: ApiToken) => {
    setSelectedToken(token);
    setLoadingLogs(true);
    const logs = await fetchLogs(token.id);
    setTokenLogs(logs);
    setLoadingLogs(false);
  };

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.ativafix.com/api';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Key className="h-5 w-5" />
            Tokens de API
          </h3>
          <p className="text-sm text-muted-foreground">
            Gerencie tokens para integração com sistemas externos e agentes de IA
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Token
        </Button>
      </div>

      {/* Documentação Rápida */}
      <Collapsible>
        <Card className="border-blue-200 bg-blue-50/50">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-base text-blue-900">Documentação da API</CardTitle>
                </div>
                <ChevronDown className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">URL Base</h4>
                  <code className="block p-2 bg-white rounded text-xs break-all">
                    {API_BASE_URL}/v1
                  </code>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Autenticação</h4>
                  <code className="block p-2 bg-white rounded text-xs">
                    Authorization: Bearer &lt;seu_token&gt;
                  </code>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-sm">Endpoints Disponíveis</h4>
                <div className="grid gap-2 text-xs">
                  <div className="p-2 bg-white rounded flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">GET</Badge>
                    <code>/v1/produtos</code>
                    <span className="text-muted-foreground ml-auto">Buscar produtos</span>
                  </div>
                  <div className="p-2 bg-white rounded flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">GET</Badge>
                    <code>/v1/produtos/:id</code>
                    <span className="text-muted-foreground ml-auto">Buscar por ID/código</span>
                  </div>
                  <div className="p-2 bg-white rounded flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">GET</Badge>
                    <code>/v1/marcas</code>
                    <span className="text-muted-foreground ml-auto">Listar marcas</span>
                  </div>
                  <div className="p-2 bg-white rounded flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">GET</Badge>
                    <code>/v1/modelos</code>
                    <span className="text-muted-foreground ml-auto">Listar modelos</span>
                  </div>
                  <div className="p-2 bg-white rounded flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">GET</Badge>
                    <code>/v1/grupos</code>
                    <span className="text-muted-foreground ml-auto">Listar grupos</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-sm">Parâmetros de Busca (produtos)</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <code className="p-1 bg-white rounded">busca</code>
                  <code className="p-1 bg-white rounded">modelo</code>
                  <code className="p-1 bg-white rounded">marca</code>
                  <code className="p-1 bg-white rounded">grupo</code>
                  <code className="p-1 bg-white rounded">codigo</code>
                  <code className="p-1 bg-white rounded">referencia</code>
                  <code className="p-1 bg-white rounded">codigo_barras</code>
                  <code className="p-1 bg-white rounded">localizacao</code>
                  <code className="p-1 bg-white rounded">estoque_min</code>
                  <code className="p-1 bg-white rounded">estoque_max</code>
                  <code className="p-1 bg-white rounded">preco_min</code>
                  <code className="p-1 bg-white rounded">preco_max</code>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-sm">Exemplo de Uso (cURL)</h4>
                <code className="block p-2 bg-gray-900 text-green-400 rounded text-xs overflow-x-auto">
                  curl -X GET "{API_BASE_URL}/v1/produtos?modelo=iPhone%2015" \<br />
                  &nbsp;&nbsp;-H "Authorization: Bearer SEU_TOKEN_AQUI"
                </code>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-sm">Exemplo para Agente de IA</h4>
                <div className="p-3 bg-white rounded text-xs space-y-2">
                  <p className="text-muted-foreground">
                    Use esta API quando o cliente perguntar sobre preços, disponibilidade ou características de produtos.
                  </p>
                  <p>
                    <strong>Pergunta:</strong> "Qual o preço da tela do iPhone 15?"
                  </p>
                  <p>
                    <strong>Requisição:</strong> <code>GET /v1/produtos?modelo=iPhone 15&busca=tela</code>
                  </p>
                </div>
              </div>

              <Button variant="outline" size="sm" asChild>
                <a href={`${API_BASE_URL}/v1/docs`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver Documentação Completa
                </a>
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Lista de Tokens */}
      <div className="space-y-3">
        {isLoading ? (
          <Card className="p-6">
            <div className="flex items-center justify-center text-muted-foreground">
              <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              Carregando tokens...
            </div>
          </Card>
        ) : tokens.length === 0 ? (
          <Card className="p-6">
            <div className="text-center text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum token criado ainda.</p>
              <p className="text-sm">Crie um token para começar a usar a API.</p>
            </div>
          </Card>
        ) : (
          tokens.map((token) => (
            <Card key={token.id} className={!token.ativo ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{token.nome}</h4>
                      {token.ativo ? (
                        <Badge variant="default" className="bg-green-500">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </div>
                    
                    {token.descricao && (
                      <p className="text-sm text-muted-foreground">{token.descricao}</p>
                    )}

                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                        {showTokenValue[token.id] ? token.token : `${token.token.substring(0, 12)}...`}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setShowTokenValue(prev => ({ ...prev, [token.id]: !prev[token.id] }))}
                      >
                        {showTokenValue[token.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleCopyToken(token.token)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {(token.permissoes || []).map((perm) => (
                        <Badge key={perm} variant="outline" className="text-[10px]">
                          <Shield className="h-2.5 w-2.5 mr-1" />
                          {perm}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        {token.uso_count} requisições
                      </span>
                      {token.ultimo_uso && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Último uso: {formatDistanceToNow(new Date(token.ultimo_uso), { addSuffix: true, locale: ptBR })}
                        </span>
                      )}
                      {token.expires_at && (
                        <span className="flex items-center gap-1">
                          Expira: {format(new Date(token.expires_at), 'dd/MM/yyyy')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={token.ativo}
                      onCheckedChange={() => handleToggleActive(token)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleViewLogs(token)}
                    >
                      <Activity className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => { setSelectedToken(token); setShowDeleteDialog(true); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Dialog Criar Token */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Criar Token de API
            </DialogTitle>
            <DialogDescription>
              Crie um novo token para acessar a API externamente
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Token *</Label>
              <Input
                id="nome"
                placeholder="Ex: Agente IA WhatsApp"
                value={formData.nome}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                placeholder="Descreva o uso deste token"
                value={formData.descricao}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Permissões</Label>
              <div className="space-y-2">
                {API_PERMISSIONS.map((perm) => (
                  <div key={perm.value} className="flex items-start gap-2">
                    <Checkbox
                      id={perm.value}
                      checked={formData.permissoes.includes(perm.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData(prev => ({ ...prev, permissoes: [...prev.permissoes, perm.value] }));
                        } else {
                          setFormData(prev => ({ ...prev, permissoes: prev.permissoes.filter(p => p !== perm.value) }));
                        }
                      }}
                    />
                    <div className="grid gap-0.5 leading-none">
                      <label htmlFor={perm.value} className="text-sm font-medium cursor-pointer">
                        {perm.label}
                      </label>
                      <p className="text-xs text-muted-foreground">{perm.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expires_at">Data de Expiração (opcional)</Label>
              <Input
                id="expires_at"
                type="date"
                value={formData.expires_at}
                onChange={(e) => setFormData(prev => ({ ...prev, expires_at: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Deixe em branco para criar um token sem expiração
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={!formData.nome || isCreating}>
              <Zap className="h-4 w-4 mr-2" />
              Criar Token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Excluir Token */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Token</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o token <strong>"{selectedToken?.nome}"</strong>?
              <br /><br />
              Esta ação é irreversível e todas as integrações que usam este token deixarão de funcionar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Logs */}
      <Dialog open={selectedToken !== null && !showDeleteDialog} onOpenChange={() => setSelectedToken(null)}>
        <DialogContent className="max-w-6xl max-h-[95vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5" />
              Logs de Acesso - {selectedToken?.nome}
            </DialogTitle>
            <DialogDescription className="text-sm">
              Últimas 100 requisições feitas com este token
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[75vh] min-h-[360px]">
            {loadingLogs ? (
              <div className="flex items-center justify-center py-8 text-base">
                <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                Carregando logs...
              </div>
            ) : tokenLogs.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 text-base">
                Nenhum acesso registrado ainda
              </div>
            ) : (
              <div className="space-y-2">
                {tokenLogs.map((log) => {
                  const payloadStr = log.request_body
                    ? (typeof log.request_body === 'string' ? log.request_body : JSON.stringify(log.request_body, null, 2))
                    : (log.query_params && Object.keys(log.query_params).length > 0 ? JSON.stringify(log.query_params, null, 2) : null);
                  const responseStr = log.response_body
                    ? (typeof log.response_body === 'string' ? log.response_body : JSON.stringify(log.response_body, null, 2))
                    : null;
                  return (
                    <div key={log.id} className="p-4 border rounded text-base">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-sm">{log.method}</Badge>
                          <code className="text-sm">{log.endpoint}</code>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(log.created_at), 'dd/MM HH:mm:ss')}
                        </span>
                      </div>
                      <div className="mt-1.5 text-sm text-muted-foreground">
                        IP: {log.ip_address} • {log.user_agent?.substring(0, 50)}...
                      </div>
                      {payloadStr && (
                        <div className="mt-2.5">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-xs font-medium text-muted-foreground">Payload (Requisição):</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={() => navigator.clipboard.writeText(payloadStr)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          <pre className="text-xs bg-muted p-3 rounded max-h-52 overflow-auto whitespace-pre-wrap break-all">
                            {payloadStr}
                          </pre>
                        </div>
                      )}
                      {responseStr && (
                        <div className="mt-2.5">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-xs font-medium text-muted-foreground">
                              Resposta {log.response_status && `(${log.response_status})`}:
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={() => navigator.clipboard.writeText(responseStr)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          <pre className="text-xs bg-green-50 dark:bg-green-950 p-3 rounded max-h-52 overflow-auto whitespace-pre-wrap break-all">
                            {responseStr}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}


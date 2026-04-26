import { useNavigate } from 'react-router-dom';
import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Users, Package, Wrench, UserCircle, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useOrdensServicoSupabase as useOrdensServico } from '@/hooks/useOrdensServicoSupabase';
import { useProdutosSupabase as useProdutos } from '@/hooks/useProdutosSupabase';
import { useClientesSupabase as useClientes } from '@/hooks/useClientesSupabase';

export default function PDV() {
  const navigate = useNavigate();
  const { getEstatisticas } = useOrdensServico();
  const { produtos } = useProdutos();
  const { clientes } = useClientes();

  const stats = getEstatisticas();
  
  // Contar produtos com estoque baixo (menos de 5 unidades)
  const produtosEstoqueBaixo = produtos.filter(p => (p.estoque_atual || 0) < 5 && (p.estoque_atual || 0) > 0).length;
  const produtosSemEstoque = produtos.filter(p => (p.estoque_atual || 0) === 0).length;

  return (
    <ModernLayout 
      title="PDV - Assistência Técnica" 
      subtitle="Visão geral e acesso rápido às funcionalidades."
    >
      <div className="space-y-4 md:space-y-6 px-1 md:px-0">
        {/* Estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 px-4 md:px-0">
          <Card className="border-2 border-l-4 border-l-blue-500 border-gray-300 cursor-pointer hover:shadow-md active:scale-95 md:active:scale-100 bg-blue-50/50 dark:bg-blue-950/10 md:bg-transparent md:dark:bg-transparent">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 pt-2 md:pt-3 px-2 md:px-6">
              <CardTitle className="text-[10px] md:text-sm font-medium">Total de OS</CardTitle>
              <Wrench className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-2 md:px-6 pb-2 md:pb-3">
              <div className="flex items-center justify-between md:flex-col md:items-start md:justify-start">
                <div className="text-base md:text-2xl font-bold">{stats.total}</div>
                <p className="text-[10px] md:text-xs text-muted-foreground md:mt-1">
                  {stats.abertas} abertas
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-l-4 border-l-purple-500 border-gray-300 cursor-pointer hover:shadow-md active:scale-95 md:active:scale-100 bg-purple-50/50 dark:bg-purple-950/10 md:bg-transparent md:dark:bg-transparent">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 pt-2 md:pt-3 px-2 md:px-6">
              <CardTitle className="text-[10px] md:text-sm font-medium">Em Andamento</CardTitle>
              <Wrench className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-2 md:px-6 pb-2 md:pb-3">
              <div className="flex items-center justify-between md:flex-col md:items-start md:justify-start">
                <div className="text-base md:text-2xl font-bold">{stats.emAndamento}</div>
                <p className="text-[10px] md:text-xs text-muted-foreground md:mt-1">
                  {stats.aguardandoPeca > 0 && `${stats.aguardandoPeca} aguardando peça`}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-l-4 border-l-green-500 border-gray-300 cursor-pointer hover:shadow-md active:scale-95 md:active:scale-100 bg-green-50/50 dark:bg-green-950/10 md:bg-transparent md:dark:bg-transparent">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 pt-2 md:pt-3 px-2 md:px-6">
              <CardTitle className="text-[10px] md:text-sm font-medium">Finalizadas</CardTitle>
              <Wrench className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-2 md:px-6 pb-2 md:pb-3">
              <div className="flex items-center justify-between md:flex-col md:items-start md:justify-start">
                <div className="text-base md:text-2xl font-bold">{stats.finalizadas}</div>
                <p className="text-[10px] md:text-xs text-muted-foreground md:mt-1">
                  {stats.aguardandoRetirada > 0 && `${stats.aguardandoRetirada} aguardando retirada`}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-l-4 border-l-orange-500 border-gray-300 cursor-pointer hover:shadow-md active:scale-95 md:active:scale-100 bg-orange-50/50 dark:bg-orange-950/10 md:bg-transparent md:dark:bg-transparent">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 pt-2 md:pt-3 px-2 md:px-6">
              <CardTitle className="text-[10px] md:text-sm font-medium">Clientes</CardTitle>
              <Users className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-2 md:px-6 pb-2 md:pb-3">
              <div className="flex items-center justify-between md:flex-col md:items-start md:justify-start">
                <div className="text-base md:text-2xl font-bold">{clientes.length}</div>
                <p className="text-[10px] md:text-xs text-muted-foreground md:mt-1">
                  Cadastrados
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ações Rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 px-4 md:px-0">
          <Card 
            className="border-2 border-gray-300 cursor-pointer hover:shadow-md hover:border-blue-400 transition-all active:scale-95 md:active:scale-100 bg-gradient-to-br from-blue-50/50 to-blue-100/30 dark:from-blue-950/10 dark:to-blue-900/5 md:bg-transparent md:dark:bg-transparent" 
            onClick={() => navigate('/os/nova')}
          >
            <CardHeader className="pb-2 md:pb-3 pt-3 md:pt-6 px-3 md:px-6">
              <CardTitle className="text-xs md:text-base flex items-center gap-2">
                <Plus className="h-4 w-4 md:h-5 md:w-5" />
                <span className="line-clamp-1">Nova OS</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
              <p className="text-[10px] md:text-sm text-muted-foreground line-clamp-2">
                Criar uma nova ordem de serviço
              </p>
            </CardContent>
          </Card>

          <Card 
            className="border-2 border-gray-300 cursor-pointer hover:shadow-md hover:border-orange-400 transition-all active:scale-95 md:active:scale-100 bg-gradient-to-br from-orange-50/50 to-orange-100/30 dark:from-orange-950/10 dark:to-orange-900/5 md:bg-transparent md:dark:bg-transparent" 
            onClick={() => navigate('/clientes')}
          >
            <CardHeader className="pb-2 md:pb-3 pt-3 md:pt-6 px-3 md:px-6">
              <CardTitle className="text-xs md:text-base flex items-center gap-2">
                <UserCircle className="h-4 w-4 md:h-5 md:w-5" />
                Clientes
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
              <p className="text-[10px] md:text-sm text-muted-foreground line-clamp-2">
                {clientes.length} clientes cadastrados
              </p>
            </CardContent>
          </Card>

          <Card 
            className="border-2 border-gray-300 cursor-pointer hover:shadow-md hover:border-purple-400 transition-all active:scale-95 md:active:scale-100 bg-gradient-to-br from-purple-50/50 to-purple-100/30 dark:from-purple-950/10 dark:to-purple-900/5 md:bg-transparent md:dark:bg-transparent" 
            onClick={() => navigate('/pdv/produtos')}
          >
            <CardHeader className="pb-2 md:pb-3 pt-3 md:pt-6 px-3 md:px-6">
              <CardTitle className="text-xs md:text-base flex items-center gap-2">
                <Package className="h-4 w-4 md:h-5 md:w-5" />
                Produtos
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
              <p className="text-[10px] md:text-sm text-muted-foreground line-clamp-2">
                {produtos.length} produtos cadastrados
              </p>
            </CardContent>
          </Card>

          <Card 
            className="border-2 border-gray-300 cursor-pointer hover:shadow-md hover:border-green-400 transition-all active:scale-95 md:active:scale-100 bg-gradient-to-br from-green-50/50 to-green-100/30 dark:from-green-950/10 dark:to-green-900/5 md:bg-transparent md:dark:bg-transparent" 
            onClick={() => navigate('/os')}
          >
            <CardHeader className="pb-2 md:pb-3 pt-3 md:pt-6 px-3 md:px-6">
              <CardTitle className="text-xs md:text-base flex items-center gap-2">
                <Wrench className="h-4 w-4 md:h-5 md:w-5" />
                <span className="line-clamp-1">Ordens de Serviço</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
              <p className="text-[10px] md:text-sm text-muted-foreground line-clamp-2">
                {stats.total} ordens no total
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Informações Adicionais */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 px-4 md:px-0">
          <Card className="border-2 border-gray-300">
            <CardHeader className="pb-2 md:pb-3 pt-3 md:pt-6">
              <CardTitle className="text-sm md:text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Resumo do Dia
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6 space-y-3">
              <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                <span className="text-xs md:text-sm text-muted-foreground">OS criadas hoje:</span>
                <span className="text-xs md:text-sm font-medium">{stats.hoje}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                <span className="text-xs md:text-sm text-muted-foreground">OS com prazo hoje:</span>
                <span className="text-xs md:text-sm font-medium">{stats.prazoHoje}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs md:text-sm text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-red-500" />
                  OS em atraso:
                </span>
                <span className="text-xs md:text-sm font-medium text-red-600">{stats.emAtraso}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-gray-300">
            <CardHeader className="pb-2 md:pb-3 pt-3 md:pt-6">
              <CardTitle className="text-sm md:text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Estoque
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6 space-y-3">
              <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                <span className="text-xs md:text-sm text-muted-foreground">Total de produtos:</span>
                <span className="text-xs md:text-sm font-medium">{produtos.length}</span>
              </div>
              {produtosEstoqueBaixo > 0 && (
                <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                  <span className="text-xs md:text-sm text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 text-yellow-500" />
                    Estoque baixo:
                  </span>
                  <span className="text-xs md:text-sm font-medium text-yellow-600">{produtosEstoqueBaixo} produtos</span>
                </div>
              )}
              {produtosSemEstoque > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs md:text-sm text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 text-red-500" />
                    Sem estoque:
                  </span>
                  <span className="text-xs md:text-sm font-medium text-red-600">{produtosSemEstoque} produtos</span>
                </div>
              )}
              {produtosEstoqueBaixo === 0 && produtosSemEstoque === 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs md:text-sm text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    Estoque OK
                  </span>
                  <span className="text-xs md:text-sm font-medium text-green-600">Todos os produtos com estoque</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ModernLayout>
  );
}

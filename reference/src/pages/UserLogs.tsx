import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useUserLogs } from '@/hooks/useUserLogs';
import { Activity, User, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function UserLogs() {
  const { logs, loading } = useUserLogs();

  const getActivityBadge = (activityType: string) => {
    const activityConfig = {
      login: { label: 'Login', color: 'bg-green-500' },
      logout: { label: 'Logout', color: 'bg-red-500' },
      create: { label: 'Criação', color: 'bg-blue-500' },
      update: { label: 'Atualização', color: 'bg-yellow-500' },
      delete: { label: 'Exclusão', color: 'bg-red-600' },
      view: { label: 'Visualização', color: 'bg-gray-500' }
    };
    
    const config = activityConfig[activityType as keyof typeof activityConfig] || 
                   { label: activityType, color: 'bg-gray-500' };
    
    return (
      <Badge className={`${config.color} text-white`}>
        {config.label}
      </Badge>
    );
  };

  return (
    <ModernLayout
      title="Logs de Atividades"
      subtitle="Registro de atividades dos usuários no sistema"
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Atividades Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma atividade registrada</p>
              <p className="text-sm">As atividades dos usuários aparecerão aqui</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Atividade</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Entidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div className="text-sm">
                          <div>{format(new Date(log.created_at), "d 'de' MMM, yyyy", { locale: ptBR })}</div>
                          <div className="text-muted-foreground">
                            {format(new Date(log.created_at), 'HH:mm:ss')}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{log.user_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getActivityBadge(log.activity_type)}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{log.description}</span>
                    </TableCell>
                    <TableCell>
                      {log.entity_type ? (
                        <Badge variant="outline">
                          {log.entity_type}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </ModernLayout>
  );
}
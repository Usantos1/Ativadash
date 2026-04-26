import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Shield, Mail } from 'lucide-react';

const PendingApproval = () => {
  const { signOut, profile } = useAuth();

  return (
    <div className="min-h-screen bg-muted/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Clock className="h-16 w-16 text-yellow-500" />
              <div className="absolute -top-1 -right-1">
                <Shield className="h-6 w-6 text-primary bg-background rounded-full" />
              </div>
            </div>
          </div>
          <CardTitle className="text-xl">Aguardando Aprovação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <div className="space-y-2">
            <p className="text-muted-foreground">
              Olá, <strong>{profile?.display_name || 'usuário'}</strong>!
            </p>
            <p className="text-sm text-muted-foreground">
              Sua conta foi criada com sucesso, mas ainda precisa ser aprovada por um administrador para acessar o sistema.
            </p>
          </div>

          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex items-center justify-center gap-2 text-sm">
              <Mail className="h-4 w-4" />
              <span>Status da conta:</span>
            </div>
            <Badge variant="secondary" className="px-3 py-1">
              Pendente de Aprovação
            </Badge>
          </div>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Você receberá acesso ao sistema assim que um administrador aprovar sua conta.
            </p>
            <p>
              Entre em contato com sua equipe de TI se precisar de acesso urgente.
            </p>
          </div>

          <div className="pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={signOut}
              className="w-full"
            >
              Sair da Conta
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingApproval;
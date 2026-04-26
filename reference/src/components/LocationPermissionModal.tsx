import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MapPin, AlertCircle, Check, Settings2 } from 'lucide-react';

interface LocationPermissionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPermissionGranted: () => void;
  onPermissionDenied: () => void;
}

export const LocationPermissionModal: React.FC<LocationPermissionModalProps> = ({
  open,
  onOpenChange,
  onPermissionGranted,
  onPermissionDenied
}) => {
  const [permissionState, setPermissionState] = useState<'unknown' | 'checking' | 'granted' | 'denied' | 'prompt'>('unknown');
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    if (open) {
      checkCurrentPermission();
    }
  }, [open]);

  const checkCurrentPermission = async () => {
    setPermissionState('checking');
    
    if (!navigator.geolocation) {
      setPermissionState('denied');
      return;
    }

    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      setPermissionState(permission.state);
      
      if (permission.state === 'granted') {
        onPermissionGranted();
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error checking permission:', error);
      setPermissionState('unknown');
    }
  };

  const requestPermission = async () => {
    setIsRequesting(true);
    
    if (!navigator.geolocation) {
      setPermissionState('denied');
      setIsRequesting(false);
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          { 
            enableHighAccuracy: true, 
            timeout: 10000, 
            maximumAge: 0 
          }
        );
      });

      setPermissionState('granted');
      onPermissionGranted();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Geolocation error:', error);
      
      if (error.code === error.PERMISSION_DENIED) {
        setPermissionState('denied');
        onPermissionDenied();
      } else {
        setPermissionState('denied');
      }
    } finally {
      setIsRequesting(false);
    }
  };

  const openBrowserSettings = () => {
    // Instruções específicas do navegador
    const userAgent = navigator.userAgent;
    let instructions = '';
    
    if (userAgent.includes('Chrome')) {
      instructions = 'No Chrome: Clique no ícone de localização na barra de endereços e selecione "Sempre permitir"';
    } else if (userAgent.includes('Firefox')) {
      instructions = 'No Firefox: Clique no ícone de escudo na barra de endereços e permita localização';
    } else if (userAgent.includes('Safari')) {
      instructions = 'No Safari: Vá em Configurações > Safari > Localização e permita para este site';
    } else {
      instructions = 'Procure o ícone de localização na barra de endereços e permita o acesso';
    }
    
    alert(instructions);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md mx-4">
        <DialogHeader className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <MapPin className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-xl font-bold">
            Permissão de Localização Necessária
          </DialogTitle>
          <DialogDescription className="text-left space-y-3">
            <p>
              Para registrar seu ponto eletrônico, precisamos acessar sua localização. 
              Isso garante a veracidade dos registros de presença.
            </p>
            
            {permissionState === 'denied' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Permissão negada. Você precisa habilitar a localização nas configurações do navegador.
                </AlertDescription>
              </Alert>
            )}
            
            {permissionState === 'granted' && (
              <Alert>
                <Check className="h-4 w-4" />
                <AlertDescription>
                  Localização permitida com sucesso!
                </AlertDescription>
              </Alert>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-6">
          {permissionState === 'denied' ? (
            <>
              <Button 
                onClick={openBrowserSettings}
                variant="outline" 
                className="w-full"
              >
                <Settings2 className="h-4 w-4 mr-2" />
                Abrir Configurações do Navegador
              </Button>
              <Button 
                onClick={checkCurrentPermission}
                className="w-full"
              >
                Verificar Novamente
              </Button>
              <Button 
                onClick={() => onOpenChange(false)}
                variant="ghost" 
                className="w-full"
              >
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button 
                onClick={requestPermission}
                disabled={isRequesting || permissionState === 'checking'}
                className="w-full"
              >
                {isRequesting || permissionState === 'checking' ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Solicitando...
                  </>
                ) : (
                  <>
                    <MapPin className="h-4 w-4 mr-2" />
                    Permitir Localização
                  </>
                )}
              </Button>
              <Button 
                onClick={() => onOpenChange(false)}
                variant="outline" 
                className="w-full"
              >
                Cancelar
              </Button>
            </>
          )}
        </div>

        <div className="mt-4 p-3 bg-muted/30 rounded-lg">
          <p className="text-xs text-muted-foreground">
            💡 <strong>Dica:</strong> Sua localização é usada apenas para validar registros de ponto e nunca é compartilhada com terceiros.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
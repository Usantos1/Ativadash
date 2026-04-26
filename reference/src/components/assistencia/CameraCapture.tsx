import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, X, Check, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CameraCaptureProps {
  onCapture: (files: File[]) => void;
  multiple?: boolean;
  disabled?: boolean;
}

export function CameraCapture({ onCapture, multiple = true, disabled = false }: CameraCaptureProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<File[]>([]);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Iniciar câmera quando o dialog abrir
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setCapturedPhotos([]);
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    try {
      // Verificar se getUserMedia está disponível
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Seu navegador não suporta acesso à câmera. Use Chrome, Firefox ou Edge.');
      }

      // Detectar se é mobile
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      // No mobile, usar facingMode; no desktop, tentar usar qualquer câmera
      if (isMobile && facingMode) {
        (constraints.video as any).facingMode = facingMode;
      } else {
        // Desktop: tentar usar a câmera traseira primeiro, depois qualquer uma
        try {
          (constraints.video as any).facingMode = 'environment';
        } catch {
          // Se não suportar, deixa o navegador escolher
        }
      }

      console.log('[CameraCapture] Solicitando acesso à câmera com constraints:', constraints);
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('[CameraCapture] Câmera acessada com sucesso');
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Aguardar o vídeo estar pronto
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = resolve;
          }
        });
      }
    } catch (error: any) {
      console.error('[CameraCapture] Erro ao acessar câmera:', error);
      const errorMessage = error.message || 'Permissão negada ou câmera não disponível';
      alert(`Erro ao acessar a câmera: ${errorMessage}\n\nCertifique-se de:\n- Permitir o acesso à câmera quando solicitado\n- Usar HTTPS ou localhost\n- Ter uma câmera conectada`);
      setIsOpen(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Ajustar canvas ao tamanho do vídeo
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Desenhar frame do vídeo no canvas
    context.drawImage(video, 0, 0);

    // Converter canvas para blob e depois para File
    canvas.toBlob((blob) => {
      if (blob) {
        const timestamp = new Date().getTime();
        const file = new File([blob], `foto_${timestamp}.jpg`, { type: 'image/jpeg' });
        
        if (multiple) {
          setCapturedPhotos(prev => [...prev, file]);
        } else {
          setCapturedPhotos([file]);
        }
      }
    }, 'image/jpeg', 0.9);
  };

  const removePhoto = (index: number) => {
    setCapturedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const toggleCamera = () => {
    stopCamera();
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const handleConfirm = () => {
    if (capturedPhotos.length > 0) {
      onCapture(capturedPhotos);
      setIsOpen(false);
      setCapturedPhotos([]);
    }
  };

  return (
    <>
      <Button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(true)}
        className="gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 active:scale-95"
      >
        <Camera className="h-4 w-4 md:h-5 md:w-5" />
        <span className="hidden md:inline">Tirar Fotos</span>
        <span className="md:hidden">Câmera</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl w-full p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>Tirar Fotos</DialogTitle>
            <DialogDescription>
              {multiple ? 'Tire quantas fotos quiser. Clique em "Tirar Foto" para cada foto.' : 'Tire uma foto do aparelho.'}
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-4 space-y-4">
            {/* Preview do vídeo */}
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
              />
              {!stream && (
                <div className="absolute inset-0 flex items-center justify-center text-white">
                  Carregando câmera...
                </div>
              )}
            </div>

            {/* Fotos capturadas */}
            {capturedPhotos.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Fotos capturadas ({capturedPhotos.length}):</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                  {capturedPhotos.map((photo, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(photo)}
                        alt={`Foto ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border-2 border-blue-300 shadow-md group-hover:border-blue-500 group-hover:shadow-lg transition-all duration-200"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <div className="absolute bottom-1 left-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full shadow-md">
                        {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Canvas oculto para captura */}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <DialogFooter className="px-6 pb-6 flex flex-col sm:flex-row gap-2">
            <div className="flex gap-2 flex-1">
              <Button
                type="button"
                variant="outline"
                onClick={toggleCamera}
                className="gap-2 border-2 hover:bg-gray-50 transition-all duration-200"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="hidden sm:inline">Trocar Câmera</span>
                <span className="sm:hidden">Trocar</span>
              </Button>
              <Button
                type="button"
                onClick={capturePhoto}
                disabled={!stream}
                className="flex-1 gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Camera className="h-4 w-4" />
                Tirar Foto
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={capturedPhotos.length === 0}
                className="gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Check className="h-4 w-4" />
                Confirmar ({capturedPhotos.length})
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


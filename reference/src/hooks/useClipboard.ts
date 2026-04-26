import { useState, useCallback } from 'react';
import { useToast } from './use-toast';

interface UseClipboardOptions {
  timeout?: number;
  successMessage?: string;
  errorMessage?: string;
}

/**
 * Hook para copiar texto para a área de transferência
 */
export function useClipboard(options: UseClipboardOptions = {}) {
  const {
    timeout = 2000,
    successMessage = 'Copiado para a área de transferência!',
    errorMessage = 'Erro ao copiar. Tente novamente.',
  } = options;

  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const copy = useCallback(
    async (text: string, showToast = true) => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          // Fallback para navegadores mais antigos
          const textArea = document.createElement('textarea');
          textArea.value = text;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          textArea.style.top = '-999999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          
          if (!successful) {
            throw new Error('Falha ao copiar texto');
          }
        }

        setCopied(true);
        setError(null);

        if (showToast) {
          toast({
            title: successMessage,
            duration: 2000,
          });
        }

        // Reset após timeout
        setTimeout(() => {
          setCopied(false);
        }, timeout);

        return true;
      } catch (err: any) {
        const error = err instanceof Error ? err : new Error(errorMessage);
        setError(error);
        setCopied(false);

        if (showToast) {
          toast({
            title: errorMessage,
            variant: 'destructive',
          });
        }

        return false;
      }
    },
    [toast, successMessage, errorMessage, timeout]
  );

  const reset = useCallback(() => {
    setCopied(false);
    setError(null);
  }, []);

  return {
    copy,
    copied,
    error,
    reset,
  };
}

/**
 * Hook para ler texto da área de transferência
 */
export function useClipboardRead() {
  const [text, setText] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const read = useCallback(async () => {
    setReading(true);
    setError(null);

    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        throw new Error('Clipboard API não suportada');
      }

      const clipboardText = await navigator.clipboard.readText();
      setText(clipboardText);
      return clipboardText;
    } catch (err: any) {
      const error = err instanceof Error ? err : new Error('Erro ao ler área de transferência');
      setError(error);
      toast({
        title: 'Erro ao ler área de transferência',
        description: 'Verifique as permissões do navegador.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setReading(false);
    }
  }, [toast]);

  return {
    text,
    read,
    reading,
    error,
  };
}


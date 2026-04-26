/**
 * Utilitário para upload de fotos para Google Drive
 * Estrutura de organização:
 * 
 * /PrimeCamp OS/
 *   ├── OS-{numero}/
 *   │   ├── Entrada/
 *   │   │   ├── OS-{numero}-entrada-{timestamp}-{index}.jpg
 *   │   │   └── ...
 *   │   ├── Saida/
 *   │   │   ├── OS-{numero}-saida-{timestamp}-{index}.jpg
 *   │   │   └── ...
 *   │   └── Processo/
 *   │       ├── OS-{numero}-processo-{timestamp}-{index}.jpg
 *   │       └── ...
 */

import { from } from '@/integrations/db/client';
import { authAPI } from '@/integrations/auth/api-client';
import { apiClient } from '@/integrations/api/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DriveUploadResult {
  success: boolean;
  fileId?: string;
  webViewLink?: string;
  folderId?: string;
  subFolderId?: string;
  error?: string;
}

export interface DriveFolderStructure {
  rootFolderId?: string; // ID da pasta "PrimeCamp OS"
  osFolderId?: string; // ID da pasta "OS-{numero}"
  entradaFolderId?: string; // ID da pasta "Entrada"
  saidaFolderId?: string; // ID da pasta "Saida"
  processoFolderId?: string; // ID da pasta "Processo"
}

/**
 * Estrutura de pastas no Google Drive:
 * 
 * PrimeCamp OS/ (pasta raiz)
 *   └── OS-{numero}/ (pasta da ordem de serviço)
 *       ├── Entrada/ (fotos tiradas na entrada do aparelho)
 *       ├── Saida/ (fotos tiradas na saída/entrega)
 *       └── Processo/ (fotos durante o processo de reparo)
 * 
 * Nomenclatura dos arquivos:
 * - Entrada: OS-{numero}-entrada-{YYYYMMDD}-{HHMMSS}-{index}.jpg
 * - Saida: OS-{numero}-saida-{YYYYMMDD}-{HHMMSS}-{index}.jpg
 * - Processo: OS-{numero}-processo-{YYYYMMDD}-{HHMMSS}-{index}.jpg
 * 
 * Exemplo:
 * - OS-123-entrada-20250116-143022-1.jpg
 * - OS-123-entrada-20250116-143022-2.jpg
 * - OS-123-saida-20250116-180000-1.jpg
 */

export function generateFileName(
  osNumero: number | string,
  tipo: 'entrada' | 'saida' | 'processo',
  index: number = 1
): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '').substring(0, 6);
  return `OS-${osNumero}-${tipo}-${dateStr}-${timeStr}-${index}.jpg`;
}

export function getFolderPath(osNumero: number | string): string {
  return `PrimeCamp OS/OS-${osNumero}`;
}

export function getSubFolderPath(
  osNumero: number | string,
  tipo: 'entrada' | 'saida' | 'processo'
): string {
  return `${getFolderPath(osNumero)}/${tipo === 'entrada' ? 'Entrada' : tipo === 'saida' ? 'Saida' : 'Processo'}`;
}

/**
 * Comprimir e redimensionar imagem
 */
export function compressImage(file: File, maxWidth: number = 1920, maxHeight: number = 1920, quality: number = 0.8): Promise<File> {
  return new Promise((resolve, reject) => {
    // Se não for imagem, retorna o arquivo original
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Calcular novas dimensões mantendo proporção
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }

        // Criar canvas e redimensionar
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Não foi possível criar contexto do canvas'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Converter para blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Falha ao comprimir imagem'));
              return;
            }
            
            // Criar novo File com o blob comprimido
            const compressedFile = new File([blob], file.name, {
              type: file.type || 'image/jpeg',
              lastModified: Date.now(),
            });
            
            console.log('[driveUpload] Imagem comprimida:', {
              original: file.size,
              compressed: compressedFile.size,
              reducao: `${((1 - compressedFile.size / file.size) * 100).toFixed(1)}%`
            });
            
            resolve(compressedFile);
          },
          file.type || 'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Erro ao carregar imagem'));
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Converter File para Base64
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remover o prefixo "data:image/jpeg;base64,"
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Fazer upload de foto para o Google Drive via Edge Function
 */
export async function uploadPhotoToDrive(
  file: File,
  osNumero: number | string,
  tipo: 'entrada' | 'saida' | 'processo',
  folderId?: string
): Promise<DriveUploadResult> {
  try {
    // Verificar autenticação primeiro
    const { data: { user }, error: authError } = await authAPI.getUser();
    
    if (authError || !user) {
      console.error('[driveUpload] Erro de autenticação:', authError);
      return {
        success: false,
        error: 'Usuário não autenticado. Faça login novamente.',
      };
    }

    console.log('[driveUpload] Usuário autenticado:', user.id);
    console.log('[driveUpload] Arquivo original:', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    // Comprimir imagem se necessário (máximo 1.5MB após compressão)
    let fileToUpload = file;
    if (file.size > 500 * 1024) { // Se maior que 500KB, comprimir
      console.log('[driveUpload] Comprimindo imagem...');
      try {
        fileToUpload = await compressImage(file, 1920, 1920, 0.75);
        
        // Se ainda estiver muito grande após compressão, reduzir mais
        if (fileToUpload.size > 1.5 * 1024 * 1024) {
          console.log('[driveUpload] Imagem ainda grande, comprimindo mais...');
          fileToUpload = await compressImage(fileToUpload, 1280, 1280, 0.7);
        }
      } catch (error) {
        console.warn('[driveUpload] Erro ao comprimir imagem, usando original:', error);
        // Continua com o arquivo original se a compressão falhar
      }
    }

    // Gerar nome do arquivo
    const fileName = generateFileName(osNumero, tipo);
    
    // Converter arquivo para base64
    const base64File = await fileToBase64(fileToUpload);
    
    // Chamar Edge Function
    console.log('[driveUpload] Iniciando upload:', { 
      fileName, 
      osNumero, 
      tipo, 
      originalSize: file.size,
      compressedSize: fileToUpload.size,
      base64Length: base64File.length,
      userId: user.id
    });
    
    // Verificar se o payload não é muito grande (limite de 2MB em base64 para Edge Functions)
    if (base64File.length > 2 * 1024 * 1024) {
      return {
        success: false,
        error: 'Arquivo muito grande para upload. Tamanho máximo após compressão: 2MB. Tente uma imagem menor.',
      };
    }
    
    try {
      console.log('[driveUpload] Chamando Edge Function upload-to-drive...');
      console.log('[driveUpload] Tamanho do payload base64:', base64File.length, 'bytes');
      
      // Verificar se temos um token de autenticação
      const { data: { session } } = await authAPI.getSession();
      if (!session) {
        return {
          success: false,
          error: 'Sessão expirada. Faça login novamente.',
        };
      }
      
      console.log('[driveUpload] Token de autenticação presente:', !!session.access_token);
      console.log('[driveUpload] Chamando Edge Function upload-to-drive...');
      console.log('[driveUpload] Payload size:', base64File.length, 'bytes');
      console.log('[driveUpload] File name:', fileName);
      console.log('[driveUpload] OS número:', osNumero);
      console.log('[driveUpload] Tipo:', tipo);
      
      let data, error;
      try {
        const result = await apiClient.invokeFunction('upload-to-drive', {
          file: base64File,
          fileName: fileName,
          osNumero: String(osNumero), // Garantir que é string
          tipo: tipo,
          mimeType: fileToUpload.type || 'image/jpeg',
          folderId: folderId || undefined,
        });
        data = result.data;
        error = result.error;
      } catch (invokeErr: any) {
        console.error('[driveUpload] Exceção ao invocar função:', invokeErr);
        error = {
          message: invokeErr.message || 'Erro desconhecido ao chamar Edge Function',
          name: invokeErr.name || 'Error',
          stack: invokeErr.stack,
        };
        data = null;
      }

      console.log('[driveUpload] Resposta da Edge Function:', { data, error });

      if (error) {
        console.error('[driveUpload] Erro ao chamar Edge Function:', error);
        console.error('[driveUpload] Detalhes do erro:', {
          message: error.message,
          name: error.name,
          stack: error.stack,
        });
        
        // Verificar se é erro de função não encontrada
        if (error.message?.includes('not found') || error.message?.includes('404')) {
          return {
            success: false,
            error: 'Endpoint de upload não encontrado. Verifique se o endpoint /api/functions/upload-to-drive está configurado no backend',
          };
        }
        
        // Verificar se é erro de autenticação
        if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
          return {
            success: false,
            error: 'Erro de autenticação. Faça login novamente.',
          };
        }
        
        // Verificar se é erro de rede/timeout
        if (error.message?.includes('Failed to send') || error.message?.includes('network') || error.message?.includes('timeout')) {
          console.error('[driveUpload] Erro de rede detectado. Possíveis causas:');
          console.error('  - Payload muito grande (tamanho atual:', base64File.length, 'bytes)');
          console.error('  - Problema de conexão com Supabase');
          console.error('  - Edge Function não está respondendo');
          
          return {
            success: false,
            error: `Erro de conexão: ${error.message}. Verifique sua conexão e tente novamente. Se o problema persistir, verifique os logs da Edge Function no Supabase Dashboard.`,
          };
        }
        
        return {
          success: false,
          error: error.message || 'Erro ao fazer upload. Verifique os logs da Edge Function.',
        };
      }

      if (!data) {
        return {
          success: false,
          error: 'Nenhuma resposta da Edge Function',
        };
      }

      if (!data.success) {
        console.error('[driveUpload] Erro na resposta:', data);
        return {
          success: false,
          error: data?.error || 'Erro desconhecido no upload',
        };
      }

      return {
        success: true,
        fileId: data.fileId,
        webViewLink: data.webViewLink,
        folderId: data.folderId,
        subFolderId: data.subFolderId,
      };
    } catch (invokeError: any) {
      console.error('[driveUpload] Erro ao invocar função:', invokeError);
      return {
        success: false,
        error: invokeError.message || 'Erro ao chamar Edge Function. Verifique se está deployada.',
      };
    }
  } catch (error: any) {
    console.error('[driveUpload] Erro geral:', error);
    return {
      success: false,
      error: error.message || 'Erro ao fazer upload',
    };
  }
}

/**
 * Upload múltiplo de fotos
 */
export async function uploadMultiplePhotos(
  files: File[],
  osNumero: number | string,
  tipo: 'entrada' | 'saida' | 'processo',
  folderId?: string
): Promise<DriveUploadResult[]> {
  console.log('[uploadMultiplePhotos] Iniciando upload de múltiplas fotos:', {
    quantidade: files.length,
    osNumero,
    tipo,
    folderId
  });

  const results: DriveUploadResult[] = [];
  let currentFolderId = folderId;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`[uploadMultiplePhotos] Processando foto ${i + 1}/${files.length}:`, {
      name: file.name,
      size: file.size,
      type: file.type
    });

    try {
      const result = await uploadPhotoToDrive(file, osNumero, tipo, currentFolderId);
      
      console.log(`[uploadMultiplePhotos] Resultado foto ${i + 1}:`, {
        success: result.success,
        error: result.error,
        folderId: result.folderId
      });

      results.push(result);
      
      // Usar o folderId retornado para os próximos uploads
      if (result.success && result.folderId && !currentFolderId) {
        currentFolderId = result.folderId;
        console.log('[uploadMultiplePhotos] Folder ID atualizado:', currentFolderId);
      }
    } catch (error: any) {
      console.error(`[uploadMultiplePhotos] Erro ao processar foto ${i + 1}:`, error);
      results.push({
        success: false,
        error: error.message || 'Erro desconhecido no upload'
      });
    }
  }

  const sucesso = results.filter(r => r.success).length;
  const falhas = results.filter(r => !r.success).length;

  console.log('[uploadMultiplePhotos] Upload concluído:', {
    total: results.length,
    sucesso,
    falhas
  });

  return results;
}

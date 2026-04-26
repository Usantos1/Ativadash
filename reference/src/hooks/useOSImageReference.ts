import { useState, useEffect } from 'react';
import { from } from '@/integrations/db/client';
import { apiClient } from '@/integrations/api/client';
import { useAuth } from '@/contexts/AuthContext';

interface OSImageReferenceConfig {
  imageUrl?: string;
  uploadedAt?: string;
}

const STORAGE_BUCKET = 'os-reference-images';
const CONFIG_KEY = 'os_image_reference';

export function useOSImageReference() {
  const { isAdmin } = useAuth();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Carregar URL da imagem de referência
  useEffect(() => {
    loadImageReference();
  }, []);

  const loadImageReference = async () => {
    try {
      const { data, error } = await from('kv_store_2c4defad')
        .select('value')
        .eq('key', CONFIG_KEY)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao carregar imagem de referência:', error);
        return;
      }

      if (data?.value) {
        const config = data.value as OSImageReferenceConfig;
        setImageUrl(config.imageUrl || null);
      }
    } catch (error) {
      console.error('Erro ao carregar imagem de referência:', error);
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!isAdmin) {
      throw new Error('Apenas administradores podem fazer upload de imagens');
    }

    // Validar tamanho (máximo 2MB)
    if (file.size > 2 * 1024 * 1024) {
      throw new Error('A imagem deve ter no máximo 2MB');
    }

    // Validar tipo
    if (!file.type.match(/^image\/(png|jpeg|jpg)$/)) {
      throw new Error('Apenas imagens PNG ou JPG são permitidas');
    }

    setUploading(true);
    try {
      // Gerar nome único para o arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `celular-referencia-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Fazer upload para API de Storage
      const { data: uploadData, error: uploadError } = await apiClient.uploadFile(
        '/storage/upload',
        file,
        'file',
        {
          bucket: STORAGE_BUCKET,
          path: filePath,
          cacheControl: '3600',
          upsert: true,
          contentType: file.type
        }
      );

      if (uploadError) {
        const errorMsg = new Error(
          'Erro ao fazer upload da imagem. Verifique se o endpoint /api/storage/upload está configurado no backend.'
        );
        (errorMsg as any).code = 'UPLOAD_ERROR';
        throw errorMsg;
      }

      // URL pública será retornada no response.data.url
      const publicUrl = uploadData?.url || '';

      // Salvar URL na configuração
      const config: OSImageReferenceConfig = {
        imageUrl: publicUrl,
        uploadedAt: new Date().toISOString(),
      };

      const result = await from('kv_store_2c4defad')
        .upsert({
          key: CONFIG_KEY,
          value: config,
        }, {
          onConflict: 'key',
        });

      if (result.error) throw result.error;

      setImageUrl(publicUrl);
      return publicUrl;
    } catch (error: any) {
      console.error('Erro ao fazer upload da imagem:', error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const deleteImage = async () => {
    if (!isAdmin) {
      throw new Error('Apenas administradores podem deletar imagens');
    }

    setLoading(true);
    try {
      // Remover da configuração
      const { error } = await from('kv_store_2c4defad')
        .delete()
        .eq('key', CONFIG_KEY)
        .execute();

      if (error) throw error;

      setImageUrl(null);
    } catch (error: any) {
      console.error('Erro ao deletar imagem:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    imageUrl,
    loading,
    uploading,
    uploadImage,
    deleteImage,
    reload: loadImageReference,
  };
}


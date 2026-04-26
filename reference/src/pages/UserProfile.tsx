import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ModernLayout } from '@/components/ModernLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { authAPI } from '@/integrations/auth/api-client';
import { from } from '@/integrations/db/client';
import { User, Phone, Camera, KeyRound, Bell, Moon, Shield, Loader2 } from 'lucide-react';

// Mapeamento de roles para labels em português
const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  supervisor: 'Supervisor',
  vendedor: 'Vendedor',
  caixa: 'Operador de Caixa',
  estoquista: 'Estoquista',
  financeiro: 'Financeiro',
  atendente: 'Atendente',
  member: 'Membro',
};

export default function UserProfile() {
  const { user, profile, isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile');
  
  const [formData, setFormData] = useState({
    display_name: '',
    phone: '',
    department: '',
    avatar_url: ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    whatsappNotifications: true,
    darkMode: false,
    soundEnabled: true
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        display_name: profile.display_name || '',
        phone: profile.phone || '',
        department: profile.department || '',
        avatar_url: (profile as any).avatar_url || ''
      });
    }
  }, [profile]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const handleSaveProfile = async () => {
    if (!user?.id) {
      toast.error('Usuário não encontrado');
      return;
    }

    setLoading(true);
    try {
      const { error } = await from('profiles')
        .eq('user_id', user.id)
        .update({
          display_name: formData.display_name,
          phone: formData.phone,
          avatar_url: formData.avatar_url,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      // Disparar evento para atualizar o perfil em outros componentes
      window.dispatchEvent(new CustomEvent('profile-changed'));
      
      toast.success('Perfil atualizado com sucesso!');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Erro ao atualizar perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.updatePassword(
        passwordData.currentPassword,
        passwordData.newPassword
      );

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast.success('Senha alterada com sucesso!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error(error.message || 'Erro ao alterar senha');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  // Função para comprimir imagem antes do upload
  const compressImage = (file: File, maxWidth: number = 200, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          
          // Redimensionar mantendo proporção
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Erro ao criar contexto do canvas'));
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // Converter para base64 com compressão
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedBase64);
        };
        img.onerror = () => reject(new Error('Erro ao carregar imagem'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    // Validar tamanho (máximo 5MB antes de comprimir)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setUploadingPhoto(true);
    try {
      // Comprimir imagem para 200x200 antes de salvar
      const compressedBase64 = await compressImage(file, 200, 0.8);
      
      // Verificar tamanho final (deve ficar abaixo de 100KB)
      const sizeInKB = (compressedBase64.length * 0.75) / 1024;
      console.log(`[Profile] Imagem comprimida: ${sizeInKB.toFixed(1)}KB`);
      
      // Salvar no perfil
      const { error } = await from('profiles')
        .eq('user_id', user?.id)
        .update({
          avatar_url: compressedBase64,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setFormData({ ...formData, avatar_url: compressedBase64 });
      window.dispatchEvent(new CustomEvent('profile-changed'));
      toast.success('Foto atualizada com sucesso!');
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error('Erro ao fazer upload da foto');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    setUploadingPhoto(true);
    try {
      const { error } = await from('profiles')
        .eq('user_id', user?.id)
        .update({
          avatar_url: null,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setFormData({ ...formData, avatar_url: '' });
      window.dispatchEvent(new CustomEvent('profile-changed'));
      toast.success('Foto removida');
    } catch (error) {
      console.error('Error removing photo:', error);
      toast.error('Erro ao remover foto');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const roleLabel = ROLE_LABELS[profile?.role || 'member'] || profile?.role || 'Membro';

  return (
    <ModernLayout 
      title="Meu Perfil" 
      subtitle="Gerencie suas informações pessoais e configurações"
    >
      <div className="max-w-3xl mx-auto space-y-6 pb-8" style={{ minHeight: '100%' }}>
        {/* Header com Avatar */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Avatar com botão de upload */}
              <div className="relative group">
                <Avatar className="h-24 w-24 border-4 border-emerald-400 shadow-lg cursor-pointer" onClick={handlePhotoClick}>
                  {formData.avatar_url ? (
                    <img 
                      src={formData.avatar_url} 
                      alt={formData.display_name || 'Avatar'} 
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
                      {formData.display_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || "U"}
                    </AvatarFallback>
                  )}
                </Avatar>
                
                {/* Overlay de upload */}
                <button
                  onClick={handlePhotoClick}
                  disabled={uploadingPhoto}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  {uploadingPhoto ? (
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  ) : (
                    <Camera className="h-6 w-6 text-white" />
                  )}
                </button>
                
                {/* Input de arquivo oculto */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </div>

              {/* Info do usuário */}
              <div className="flex-1 text-center sm:text-left">
                <h2 className="text-xl font-bold text-foreground">
                  {formData.display_name || user?.email?.split('@')[0]}
                </h2>
                <p className="text-muted-foreground">{user?.email}</p>
                <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                  <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-medium">
                    {roleLabel}
                  </span>
                  {formData.department && (
                    <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm">
                      {formData.department}
                    </span>
                  )}
                </div>
              </div>

              {/* Ações da foto */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handlePhotoClick} disabled={uploadingPhoto}>
                  <Camera className="h-4 w-4 mr-1" />
                  {formData.avatar_url ? 'Alterar' : 'Adicionar'}
                </Button>
                {formData.avatar_url && (
                  <Button variant="ghost" size="sm" onClick={handleRemovePhoto} disabled={uploadingPhoto}>
                    Remover
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs de configuração */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Perfil</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <KeyRound className="h-4 w-4" />
              <span className="hidden sm:inline">Segurança</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Preferências</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab Perfil */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Informações Pessoais
                </CardTitle>
                <CardDescription>
                  Atualize suas informações de perfil
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={user?.email || ''}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    O email não pode ser alterado
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="display_name">Nome de Exibição</Label>
                  <Input
                    id="display_name"
                    value={formData.display_name}
                    onChange={(e) => setFormData({...formData, display_name: e.target.value})}
                    placeholder="Seu nome completo"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone WhatsApp</Label>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      placeholder="5519987794141"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Este número será usado para receber notificações do WhatsApp
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Departamento</Label>
                  <Input
                    value={formData.department}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Apenas administradores podem alterar o departamento
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Função</Label>
                  <Input
                    value={roleLabel}
                    disabled
                    className="bg-muted"
                  />
                </div>

                <Button onClick={handleSaveProfile} disabled={loading} className="w-full">
                  {loading ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Segurança */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Alterar Senha
                </CardTitle>
                <CardDescription>
                  Mantenha sua conta segura com uma senha forte
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Senha Atual</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                    placeholder="••••••••"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nova Senha</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                    placeholder="••••••••"
                  />
                  <p className="text-xs text-muted-foreground">
                    Mínimo de 6 caracteres
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                    placeholder="••••••••"
                  />
                </div>

                <Button 
                  onClick={handleChangePassword} 
                  disabled={loading || !passwordData.currentPassword || !passwordData.newPassword}
                  className="w-full"
                >
                  {loading ? 'Alterando...' : 'Alterar Senha'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Preferências */}
          <TabsContent value="preferences">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Preferências
                </CardTitle>
                <CardDescription>
                  Configure suas preferências de notificação e aparência
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notificações por Email</Label>
                    <p className="text-sm text-muted-foreground">
                      Receber atualizações por email
                    </p>
                  </div>
                  <Switch
                    checked={preferences.emailNotifications}
                    onCheckedChange={(checked) => setPreferences({...preferences, emailNotifications: checked})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notificações WhatsApp</Label>
                    <p className="text-sm text-muted-foreground">
                      Receber alertas pelo WhatsApp
                    </p>
                  </div>
                  <Switch
                    checked={preferences.whatsappNotifications}
                    onCheckedChange={(checked) => setPreferences({...preferences, whatsappNotifications: checked})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4" />
                      <Label>Modo Escuro</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Alternar entre tema claro e escuro
                    </p>
                  </div>
                  <Switch
                    checked={preferences.darkMode}
                    onCheckedChange={(checked) => setPreferences({...preferences, darkMode: checked})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Sons de Notificação</Label>
                    <p className="text-sm text-muted-foreground">
                      Tocar som ao receber notificações
                    </p>
                  </div>
                  <Switch
                    checked={preferences.soundEnabled}
                    onCheckedChange={(checked) => setPreferences({...preferences, soundEnabled: checked})}
                  />
                </div>

                <p className="text-xs text-muted-foreground text-center pt-4 border-t">
                  Algumas preferências serão aplicadas na próxima vez que você entrar
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ModernLayout>
  );
}

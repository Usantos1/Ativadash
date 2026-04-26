import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings, Moon, Sun, Save, Building, Palette, Upload, Image as ImageIcon, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useThemeConfig } from '@/contexts/ThemeConfigContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import { apiClient } from '@/integrations/api/client';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { theme, setTheme } = useTheme();
  const { config, updateConfig, refreshConfig } = useThemeConfig();
  const { hasPermission, isAdmin } = usePermissions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [systemName, setSystemName] = useState('Prime Camp | Gestão de Processos');
  const [autoSave, setAutoSave] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [compactMode, setCompactMode] = useState(false);
  const [navigationVariant, setNavigationVariant] = useState<'default' | 'miui'>('default');
  const canManageNavigationVariant = isAdmin || hasPermission('admin.config');

  // Ao abrir o modal: preferências locais do localStorage; tema (nome, logo, cores) do context (vindo da VPS)
  useEffect(() => {
    if (isOpen) {
      try {
        const saved = localStorage.getItem('systemSettings');
        if (saved) {
          const parsed = JSON.parse(saved) as { systemName?: string; autoSave?: boolean; notifications?: boolean; compactMode?: boolean };
          if (parsed.autoSave != null) setAutoSave(parsed.autoSave);
          if (parsed.notifications != null) setNotifications(parsed.notifications);
          if (parsed.compactMode != null) setCompactMode(parsed.compactMode);
        }
        setSystemName(config.companyName || 'Prime Camp | Gestão de Processos');
        setLogoPreview(config.logo || null);
        setPrimaryColor(config.colors.primary);
        setSidebarColor(config.colors.sidebar || config.colors.primary);
        setButtonColor(config.colors.button || config.colors.primary);
        setNavigationVariant(config.navigationVariant || 'default');
      } catch (_) {}
    }
  }, [isOpen, config.companyName, config.logo, config.colors.primary, config.colors.sidebar, config.colors.button, config.navigationVariant]);
  
  // Cores do tema
  const [primaryColor, setPrimaryColor] = useState(config.colors.primary);
  const [sidebarColor, setSidebarColor] = useState(config.colors.sidebar || config.colors.primary);
  const [buttonColor, setButtonColor] = useState(config.colors.button || config.colors.primary);
  const [logoPreview, setLogoPreview] = useState<string | null>(config.logo || null);

  const handleSave = async () => {
    try {
      const nameToSave = (systemName || '').trim() || 'Prime Camp | Gestão de Processos';
      localStorage.setItem('systemSettings', JSON.stringify({
        systemName: nameToSave,
        autoSave,
        notifications,
        compactMode
      }));

      const newConfig = {
        companyName: nameToSave,
        colors: {
          primary: primaryColor,
          primaryForeground: config.colors.primaryForeground,
          secondary: config.colors.secondary,
          accent: primaryColor,
          sidebar: sidebarColor,
          button: buttonColor,
        },
        logo: logoPreview || config.logo,
        navigationVariant,
      };

      // Salvar tema (cores, logo, nome) na VPS — reflete para todos os clientes do domínio
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      const payload = {
        host,
        companyName: nameToSave,
        logo: logoPreview || undefined,
        navigationVariant,
        colors: {
          primary: primaryColor,
          sidebar: sidebarColor,
          button: buttonColor,
        },
      };
      const { data, error } = await apiClient.post('/theme-config', payload);

      // Aplica na interface em qualquer caso (nome e logo mudam na sessão atual)
      updateConfig(newConfig);
      document.title = nameToSave;

      if (error) {
        const status = (error as { status?: number })?.status;
        if (status === 404) {
          toast.warning(
            'Tema aplicado aqui, mas não foi salvo na VPS (servidor desatualizado). Faça o deploy da última versão na VPS para persistir para todos.'
          );
        } else if (status === 401) {
          toast.error('Sessão expirada. Faça login novamente e tente salvar o tema de novo.');
        } else {
          toast.error(error?.message || (error as { message?: string })?.message || 'Erro ao salvar tema na VPS');
        }
      } else {
        if (data?.config) {
          updateConfig(data.config);
        }
        await refreshConfig();
        toast.success('Configurações salvas. O tema foi atualizado na VPS para todos os dispositivos.');
      }
      onClose();
    } catch (error) {
      toast.error('Erro ao salvar configurações');
    }
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Formato não aceito. Use PNG, JPG ou SVG.');
      event.target.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => {
      toast.error('Erro ao ler o arquivo. Tente outra imagem.');
      event.target.value = '';
    };
    reader.onloadend = () => {
      try {
        const result = reader.result as string;
        if (!result || !result.startsWith('data:image/')) {
          toast.error('Arquivo inválido. Use PNG, JPG ou SVG.');
          return;
        }
        setLogoPreview(result);
      } catch {
        toast.error('Erro ao processar a imagem.');
      }
      event.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Converter HSL para RGB para o input color
  const hslToHex = (hsl: string): string => {
    const [h, s, l] = hsl.split(' ').map(v => parseFloat(v));
    const hNorm = h / 360;
    const sNorm = s / 100;
    const lNorm = l / 100;
    
    let r, g, b;
    if (sNorm === 0) {
      r = g = b = lNorm;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
      const p = 2 * lNorm - q;
      r = hue2rgb(p, q, hNorm + 1/3);
      g = hue2rgb(p, q, hNorm);
      b = hue2rgb(p, q, hNorm - 1/3);
    }
    
    const toHex = (c: number) => {
      const hex = Math.round(c * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  // Converter Hex para HSL
  const hexToHsl = (hex: string): string => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações do Sistema
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* System Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building className="h-4 w-4" />
                Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="system-name">Nome do Sistema</Label>
                <Input
                  id="system-name"
                  value={systemName}
                  onChange={(e) => setSystemName(e.target.value)}
                  placeholder="Digite o nome do sistema"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Salvamento Automático</Label>
                  <p className="text-sm text-muted-foreground">
                    Salva automaticamente as alterações
                  </p>
                </div>
                <Switch
                  checked={autoSave}
                  onCheckedChange={setAutoSave}
                />
              </div>
            </CardContent>
          </Card>

          {/* Appearance Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Palette className="h-4 w-4" />
                Aparência
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Tema Escuro</Label>
                  <p className="text-sm text-muted-foreground">
                    Alterna entre tema claro e escuro
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4" />
                  <Switch
                    checked={theme === 'dark'}
                    onCheckedChange={toggleTheme}
                  />
                  <Moon className="h-4 w-4" />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Modo Compacto</Label>
                  <p className="text-sm text-muted-foreground">
                    Reduz o espaçamento da interface
                  </p>
                </div>
                <Switch
                  checked={compactMode}
                  onCheckedChange={setCompactMode}
                />
              </div>

              {canManageNavigationVariant && (
                <div className="space-y-2">
                  <Label>Experiência de navegação</Label>
                  <Select
                    value={navigationVariant}
                    onValueChange={(value: 'default' | 'miui') => setNavigationVariant(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a interface" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Padrão</SelectItem>
                      <SelectItem value="miui">MIUI</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Define, por empresa, se o topo usa o appbar atual ou a nova MIUI com busca global via Ctrl+K.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Logo Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ImageIcon className="h-4 w-4" />
                Logo do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Logo</Label>
                {logoPreview ? (
                  <div className="relative inline-block">
                    <img 
                      src={logoPreview} 
                      alt="Logo preview" 
                      className="h-20 w-auto object-contain rounded border"
                      onError={() => {
                        toast.error('Não foi possível exibir a logo. Tente outro arquivo.');
                        setLogoPreview(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={handleRemoveLogo}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Nenhuma logo selecionada
                    </p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {logoPreview ? 'Alterar Logo' : 'Upload Logo'}
                  </Button>
                  {logoPreview && (
                    <Button
                      variant="outline"
                      onClick={handleRemoveLogo}
                      className="gap-2"
                    >
                      <X className="h-4 w-4" />
                      Remover
                    </Button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <p className="text-xs text-muted-foreground">
                  Formatos aceitos: PNG, JPG, SVG. Tamanho máximo: 2MB
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Color Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Palette className="h-4 w-4" />
                Cores do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Cor Principal (AppBar)</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={hslToHex(primaryColor)}
                    onChange={(e) => {
                      const hex = e.target.value;
                      setPrimaryColor(hexToHsl(hex));
                      setSidebarColor(hexToHsl(hex));
                      setButtonColor(hexToHsl(hex));
                    }}
                    className="h-10 w-20 rounded border cursor-pointer"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => {
                      setPrimaryColor(e.target.value);
                      setSidebarColor(e.target.value);
                      setButtonColor(e.target.value);
                    }}
                    placeholder="198 100% 35%"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Formato HSL: H S% L%
                </p>
              </div>

              <div className="space-y-2">
                <Label>Cor do Sidebar</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={hslToHex(sidebarColor)}
                    onChange={(e) => setSidebarColor(hexToHsl(e.target.value))}
                    className="h-10 w-20 rounded border cursor-pointer"
                  />
                  <Input
                    value={sidebarColor}
                    onChange={(e) => setSidebarColor(e.target.value)}
                    placeholder="198 100% 35%"
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Cor dos Botões</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={hslToHex(buttonColor)}
                    onChange={(e) => setButtonColor(hexToHsl(e.target.value))}
                    className="h-10 w-20 rounded border cursor-pointer"
                  />
                  <Input
                    value={buttonColor}
                    onChange={(e) => setButtonColor(e.target.value)}
                    placeholder="198 100% 35%"
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                <div className="flex gap-2">
                  <div 
                    className="h-8 w-20 rounded"
                    style={{ backgroundColor: `hsl(${primaryColor})` }}
                  />
                  <div 
                    className="h-8 w-20 rounded"
                    style={{ backgroundColor: `hsl(${sidebarColor})` }}
                  />
                  <div 
                    className="h-8 w-20 rounded"
                    style={{ backgroundColor: `hsl(${buttonColor})` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notificações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Notificações Push</Label>
                  <p className="text-sm text-muted-foreground">
                    Receba notificações sobre tarefas e processos
                  </p>
                </div>
                <Switch
                  checked={notifications}
                  onCheckedChange={setNotifications}
                />
              </div>
            </CardContent>
          </Card>

        </div>

        <Separator />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            Salvar Configurações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
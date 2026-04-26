import { createContext, useContext, useState, useEffect, useLayoutEffect, ReactNode } from 'react';
import { getApiUrl } from '@/utils/apiUrl';

interface ThemeColors {
  primary: string;
  primaryForeground: string;
  secondary: string;
  accent: string;
  sidebar?: string;
  button?: string;
}

interface ThemeConfig {
  logo?: string;
  logoAlt?: string;
  colors: ThemeColors;
  companyName?: string;
  navigationVariant?: 'default' | 'miui';
}

// Cores fixas do sistema — uma vez definidas valem para todos os usuários (AppBar, Sidebar, Botões)
const SYSTEM_PRIMARY_HSL = '0 100% 47%';

const defaultConfigPrimeCamp: ThemeConfig = {
  logo: "https://primecamp.com.br/wp-content/uploads/2025/07/Design-sem-nome-4.png",
  logoAlt: "Prime Camp Logo",
  colors: {
    primary: SYSTEM_PRIMARY_HSL,
    primaryForeground: '0 0% 100%',
    secondary: '210 40% 95%',
    accent: SYSTEM_PRIMARY_HSL,
    sidebar: SYSTEM_PRIMARY_HSL,
    button: SYSTEM_PRIMARY_HSL,
  },
  companyName: 'Prime Camp',
  navigationVariant: 'default',
};

/** Na tela de login e padrão: logo e cores da empresa 1 (sem amarelo). API pode sobrescrever com tema salvo. */
export function getDefaultConfigByHost(): ThemeConfig {
  if (typeof window === 'undefined') return defaultConfigPrimeCamp;
  const h = window.location.hostname;
  const isAtivaFix = h === 'ativafix.com' || h === 'www.ativafix.com' || h === 'app.ativafix.com' || h === 'localhost' || h === '127.0.0.1';
  if (isAtivaFix) {
    const origin = window.location.origin;
    return {
      ...defaultConfigPrimeCamp,
      logo: defaultConfigPrimeCamp.logo || `${origin}/logo-ativafix.png`,
      logoAlt: defaultConfigPrimeCamp.logoAlt || 'Logo',
      companyName: defaultConfigPrimeCamp.companyName || 'Sistema de Processos',
      colors: {
        ...defaultConfigPrimeCamp.colors,
        primary: defaultConfigPrimeCamp.colors.primary,
        accent: defaultConfigPrimeCamp.colors.accent,
        sidebar: defaultConfigPrimeCamp.colors.sidebar ?? defaultConfigPrimeCamp.colors.primary,
        button: defaultConfigPrimeCamp.colors.button ?? defaultConfigPrimeCamp.colors.primary,
      },
    };
  }
  return defaultConfigPrimeCamp;
}

const defaultConfig = defaultConfigPrimeCamp;

interface ThemeConfigContextType {
  config: ThemeConfig;
  updateConfig: (newConfig: Partial<ThemeConfig>) => void;
  resetConfig: () => void;
  refreshConfig: () => Promise<void>;
}

const ThemeConfigContext = createContext<ThemeConfigContextType | undefined>(undefined);

export function ThemeConfigProvider({ children }: { children: ReactNode }) {
  const baseConfig = getDefaultConfigByHost();
  const [config, setConfig] = useState<ThemeConfig>(baseConfig);

  const mergeIncomingConfig = (prev: ThemeConfig, data: Partial<ThemeConfig> | null): ThemeConfig => {
    if (!data || typeof data !== 'object') return prev;

    return {
      ...prev,
      ...(data.companyName != null && { companyName: data.companyName }),
      ...(data.logo && typeof data.logo === 'string' && { logo: data.logo }),
      ...(data.logoAlt != null && { logoAlt: data.logoAlt }),
      navigationVariant: data.navigationVariant === 'miui' ? 'miui' : 'default',
      colors: {
        ...prev.colors,
        ...(data.colors && typeof data.colors === 'object' ? data.colors : {}),
      },
    };
  };

  const refreshConfig = async () => {
    if (typeof window === 'undefined') return;
    const host = window.location.hostname;
    const base = getApiUrl();
    const url = new URL('theme-config', base.endsWith('/') ? base : base + '/');
    url.searchParams.set('host', host);
    url.searchParams.set('_ts', String(Date.now()));
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch(url.toString(), {
        headers,
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      setConfig((prev) => mergeIncomingConfig(prev, data));
    } catch {
      // noop
    }
  };

  // Buscar tema: logado = tema da empresa (company); não logado = tema do domínio (host)
  useEffect(() => {
    refreshConfig();
  }, []);

  // Título da aba: useLayoutEffect para atualizar antes da pintura e evitar flash "Prime Camp" ao carregar
  useLayoutEffect(() => {
    if (config.companyName) {
      document.title = config.companyName;
    }
  }, [config.companyName]);

  const updateConfig = (newConfig: Partial<ThemeConfig>) => {
    setConfig((prev) => {
      const merged = mergeIncomingConfig(prev, newConfig);
      applyThemeConfig(merged);
      return merged;
    });
  };

  const resetConfig = () => {
    const base = getDefaultConfigByHost();
    setConfig(base);
    applyThemeConfig(base);
  };

  // Aplicar configurações de tema no CSS
  const applyThemeConfig = (themeConfig: ThemeConfig) => {
    const root = document.documentElement;
    
    // Cor principal (usada como fallback)
    root.style.setProperty('--primary', themeConfig.colors.primary);
    root.style.setProperty('--primary-foreground', themeConfig.colors.primaryForeground);
    root.style.setProperty('--secondary', themeConfig.colors.secondary);
    root.style.setProperty('--accent', themeConfig.colors.accent);
    
    // Cor do Sidebar (navegação)
    const sidebarColor = themeConfig.colors.sidebar || themeConfig.colors.primary;
    root.style.setProperty('--sidebar-primary', sidebarColor);
    root.style.setProperty('--sidebar-primary-foreground', '0 0% 100%');
    
    // Cor dos Botões - aplica em --primary para que todos os botões usem
    const buttonColor = themeConfig.colors.button || themeConfig.colors.primary;
    root.style.setProperty('--button-primary', buttonColor);
    // Atualizar --primary para que os botões default usem a cor configurada
    root.style.setProperty('--primary', buttonColor);
    root.dataset.navigationVariant = themeConfig.navigationVariant || 'default';
  };

  // Aplicar configurações ao carregar
  useEffect(() => {
    applyThemeConfig(config);
  }, [config]);

  return (
    <ThemeConfigContext.Provider value={{ config, updateConfig, resetConfig, refreshConfig }}>
      {children}
    </ThemeConfigContext.Provider>
  );
}

export function useThemeConfig() {
  const context = useContext(ThemeConfigContext);
  if (context === undefined) {
    throw new Error('useThemeConfig must be used within a ThemeConfigProvider');
  }
  return context;
}

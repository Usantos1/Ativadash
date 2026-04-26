import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '@/integrations/auth/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Sparkles } from 'lucide-react';
import { useThemeConfig, getDefaultConfigByHost } from '@/contexts/ThemeConfigContext';
import { DEMO_SESSION_KEY } from '@/utils/demoMode';

export default function DemoLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { config } = useThemeConfig();
  const logoUrl = config.logo || getDefaultConfigByHost().logo || '/logo-ativafix.png';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoLoginDone = useRef(false);

  const autoLogin = searchParams.get('auto') === '1' || searchParams.get('auto') === 'true';

  if (!authLoading && user) {
    navigate('/', { replace: true });
    return null;
  }

  useEffect(() => {
    if (!autoLogin || autoLoginDone.current) return;
    autoLoginDone.current = true;
    setLoading(true);
    setError(null);
    authAPI.loginDemo()
      .then((response) => {
        if (response.error) {
          setError(response.error.message || 'Não foi possível entrar na demonstração.');
          return;
        }
        try {
          sessionStorage.setItem(DEMO_SESSION_KEY, '1');
        } catch {}
        window.location.href = autoLogin ? '/?embed=1' : '/';
      })
      .catch((e: unknown) => {
        setError(e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Erro ao conectar.');
      })
      .finally(() => setLoading(false));
  }, [autoLogin]);

  const handleDemoLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await authAPI.loginDemo();
      if (response.error) {
        setError(response.error.message || 'Não foi possível entrar na demonstração.');
        return;
      }
      try {
        sessionStorage.setItem(DEMO_SESSION_KEY, '1');
      } catch {}
      window.location.href = '/';
    } catch (e: any) {
      setError(e?.message || 'Erro ao conectar.');
    } finally {
      setLoading(false);
    }
  };

  if (autoLogin && (loading || !error)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Entrando na demonstração…</p>
        {error && (
          <div className="rounded-lg bg-destructive/10 text-destructive text-sm p-3 max-w-md text-center">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={logoUrl} alt="Ativa FIX" className="h-12 w-auto object-contain" />
          </div>
          <CardTitle className="text-xl">Experimentar o sistema</CardTitle>
          <CardDescription>
            Você verá o Ativa FIX real: dashboard, ordens de serviço, PDV, financeiro e alertas, com dados de exemplo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 text-destructive text-sm p-3">
              {error}
            </div>
          )}
          <Button
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full h-12 text-base font-semibold"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Entrando...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Entrar na demonstração
              </>
            )}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Ao entrar, você usa o sistema completo com dados de exemplo. Nada é enviado para produção.
          </p>
          <div className="pt-2 border-t text-center">
            <Button variant="ghost" className="text-muted-foreground" onClick={() => navigate('/login')}>
              Já tenho conta — Fazer login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

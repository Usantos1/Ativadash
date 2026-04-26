import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authAPI } from "@/integrations/auth/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogIn, UserPlus, Phone, Palette, Eye, EyeOff } from "lucide-react";
import { useTheme } from "next-themes";
import { useThemeConfig, getDefaultConfigByHost } from "@/contexts/ThemeConfigContext";
import { ThemeToggle } from "@/components/ThemeToggle";

const Auth = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { setTheme } = useTheme();
  const { config } = useThemeConfig();
  const logoUrl = config.logo || getDefaultConfigByHost().logo || "https://primecamp.com.br/wp-content/uploads/2025/07/Design-sem-nome-4.png";

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedTheme, setSelectedTheme] = useState("light");
  // Bloqueio de novas tentativas após 429 (muitas tentativas) — evita enviar mais requisições e piorar o bloqueio
  const [lockLoginUntil, setLockLoginUntil] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirm, setShowSignupConfirm] = useState(false);

  useEffect(() => {
    // Se já está autenticado, redirecionar
    if (!authLoading && user) {
      navigate("/");
    }
  }, [user, authLoading, navigate]);

  // Contagem regressiva do bloqueio de login (atualiza a cada segundo)
  const [lockSecondsLeft, setLockSecondsLeft] = useState(0);
  useEffect(() => {
    if (lockLoginUntil == null) {
      setLockSecondsLeft(0);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((lockLoginUntil - Date.now()) / 1000));
      setLockSecondsLeft(left);
      if (left <= 0) setLockLoginUntil(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockLoginUntil]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockLoginUntil != null && Date.now() < lockLoginUntil) return;

    if (!email || !password) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      console.log('[Auth] Tentando fazer login via API PostgreSQL:', { email });

      const response = await authAPI.login(email, password);

      if (response.error) {
        throw new Error(response.error.message || "Erro ao fazer login");
      }

      toast({
        title: "Login realizado",
        description: "Bem-vindo de volta!",
      });

      window.location.href = "/";
    } catch (error: any) {
      console.error("[Auth] Erro no login:", error);
      const msg = error?.message || "Email ou senha incorretos.";
      const isTooManyRequests = typeof msg === "string" && (msg.includes("Muitas tentativas") || msg.includes("429"));
      if (isTooManyRequests) {
        setLockLoginUntil(Date.now() + 45 * 1000); // 45 segundos (evita novo 429 ao tentar de novo)
      }
      toast({
        title: "Erro no login",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !confirmPassword) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter pelo menos 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      console.log('[Auth] Tentando criar conta via API PostgreSQL:', { email });
      
      await authAPI.signup({
        email,
        password,
        display_name: displayName || email,
        phone: phone || undefined,
      });

      setTheme(selectedTheme);
      toast({
        title: "Cadastro realizado",
        description: "Conta criada com sucesso! Você já pode fazer login.",
      });
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setDisplayName("");
      setPhone("");
      setSelectedTheme("light");
      
      // Recarregar página para atualizar AuthContext
      window.location.href = "/";
    } catch (error: any) {
      console.error('[Auth] Erro no cadastro:', error);
      toast({
        title: "Erro no cadastro",
        description: error.message?.includes("já está cadastrado") || error.message?.includes("already registered")
          ? "Este email já está cadastrado. Tente fazer login."
          : error.message || "Erro inesperado ao criar conta",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, digite seu email",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      console.log('[Auth] Solicitando reset de senha via API PostgreSQL:', { email });
      
      // Usar authAPI para solicitar reset
      await authAPI.requestPasswordReset(email);

      toast({
        title: "Email enviado",
        description: "Se o email existir, você receberá um link para redefinir sua senha.",
      });
      setEmail("");
    } catch (error: any) {
      console.error('[Auth] Erro ao solicitar reset:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao enviar email de redefinição",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/50 p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle variant="button" size="sm" aria-label="Alternar tema claro/escuro" />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={logoUrl} alt={config.logoAlt || "Logo"} className="h-16 w-auto max-w-[200px] object-contain" loading="lazy" decoding="async" />
          </div>
          <CardTitle className="text-2xl font-bold">{config.companyName || 'Sistema de Processos'}</CardTitle>
          <CardDescription>Faça login ou crie sua conta para continuar</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
              <TabsTrigger value="reset">Redefinir Senha</TabsTrigger>
            </TabsList>

            {/* Login */}
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="signin-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                      tabIndex={-1}
                      aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading || lockSecondsLeft > 0}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : lockSecondsLeft > 0 ? (
                    <>Aguarde {lockSecondsLeft} s para tentar de novo</>
                  ) : (
                    <>
                      <LogIn className="mr-2 h-4 w-4" />
                      Entrar
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* Cadastro */}
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Nome (opcional)</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Seu nome"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-phone">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Celular (opcional)
                    </div>
                  </Label>
                  <Input
                    id="signup-phone"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showSignupPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                      tabIndex={-1}
                      aria-label={showSignupPassword ? "Ocultar senha" : "Exibir senha"}
                    >
                      {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm">Confirmar Senha</Label>
                  <div className="relative">
                    <Input
                      id="signup-confirm"
                      type={showSignupConfirm ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={loading}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupConfirm((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                      tabIndex={-1}
                      aria-label={showSignupConfirm ? "Ocultar senha" : "Exibir senha"}
                    >
                      {showSignupConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="theme-select">
                    <div className="flex items-center gap-2">
                      <Palette className="h-4 w-4" />
                      Tema
                    </div>
                  </Label>
                  <Select value={selectedTheme} onValueChange={setSelectedTheme} disabled={loading}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha um tema" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Claro</SelectItem>
                      <SelectItem value="dark">Escuro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando conta...
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Criar Conta
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* Redefinir Senha */}
            <TabsContent value="reset">
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <p className="text-sm text-muted-foreground text-center mb-4">
                  Digite seu email para receber um link de redefinição de senha
                </p>
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "Enviar Link de Redefinição"
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;

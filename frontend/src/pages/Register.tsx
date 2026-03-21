import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";
import { API_BASE } from "@/lib/api";
import { cn } from "@/lib/utils";

const fullSchema = z
  .object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    organizationName: z
      .string()
      .min(2, "Nome da empresa deve ter pelo menos 2 caracteres")
      .max(120, "Nome da empresa muito longo"),
    email: z.string().email("E-mail inválido"),
    password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Senhas não conferem",
    path: ["confirmPassword"],
  });

const inviteSchema = z
  .object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Senhas não conferem",
    path: ["confirmPassword"],
  });

type FullForm = z.infer<typeof fullSchema>;
type InviteForm = z.infer<typeof inviteSchema>;

type InvitePreview = { organizationName: string; email: string; role: string };

export function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setAuth = useAuthStore((s) => s.setAuth);

  const inviteMode = Boolean(inviteToken && invitePreview);

  useEffect(() => {
    if (!inviteToken) {
      setInvitePreview(null);
      setPreviewError(null);
      return;
    }
    let cancelled = false;
    setPreviewError(null);
    fetch(`${API_BASE}/auth/invite-preview?token=${encodeURIComponent(inviteToken)}`)
      .then(async (res) => {
        const json = (await res.json()) as InvitePreview & { message?: string };
        if (!res.ok) throw new Error(json.message || "Convite inválido");
        return json;
      })
      .then((data) => {
        if (!cancelled) setInvitePreview(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setInvitePreview(null);
          setPreviewError(e instanceof Error ? e.message : "Convite inválido");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  const fullForm = useForm<FullForm>({
    resolver: zodResolver(fullSchema),
    defaultValues: {
      name: "",
      organizationName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const inviteForm = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { name: "", password: "", confirmPassword: "" },
  });

  async function onSubmitFull(data: FullForm) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          organizationName: data.organizationName.trim(),
          email: data.email,
          password: data.password,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Erro ao cadastrar");
      setAuth(json.user, json.accessToken, json.refreshToken, {
        memberships: json.memberships ?? null,
        managedOrganizations: null,
      });
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao cadastrar");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmitInvite(data: InviteForm) {
    if (!inviteToken) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register-with-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: inviteToken,
          name: data.name,
          password: data.password,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Erro ao cadastrar");
      setAuth(json.user, json.accessToken, json.refreshToken, {
        memberships: json.memberships ?? null,
        managedOrganizations: json.managedOrganizations ?? null,
      });
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao cadastrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 px-4 py-8 supports-[padding:max(0px)]:px-[max(1rem,env(safe-area-inset-left))] supports-[padding:max(0px)]:pr-[max(1rem,env(safe-area-inset-right))] supports-[padding:max(0px)]:pb-[max(2rem,env(safe-area-inset-bottom))] supports-[padding:max(0px)]:pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex justify-center">
          <Link to="/" className="flex items-center gap-2 font-semibold text-primary">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <span className="text-xl">Ativa Dash</span>
          </Link>
        </div>
        <Card className="border-0 shadow-lg">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl">{inviteMode ? "Aceitar convite" : "Criar conta"}</CardTitle>
            <CardDescription>
              {inviteMode ? (
                <>
                  Você foi convidado para <strong className="text-foreground">{invitePreview?.organizationName}</strong>
                  . Defina sua senha para entrar.
                </>
              ) : (
                <>
                  Você cria seu usuário e <strong className="font-medium text-foreground">uma empresa</strong> (espaço de
                  trabalho). Depois, no painel, o menu <strong className="font-medium text-foreground">Clientes</strong>{" "}
                  é só para organizar contas comerciais — não confunde com criar outra empresa.
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {inviteToken && !invitePreview && !previewError && (
              <p className="mb-4 text-center text-sm text-muted-foreground">Carregando convite…</p>
            )}
            {previewError && (
              <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {previewError}
              </div>
            )}

            {inviteMode ? (
              <form onSubmit={inviteForm.handleSubmit(onSubmitInvite)} className="space-y-4">
                {error && (
                  <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
                )}
                <div className="rounded-md bg-muted/60 px-3 py-2 text-sm">
                  <p className="text-muted-foreground">E-mail convidado</p>
                  <p className="font-medium text-foreground">{invitePreview?.email}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    placeholder="Seu nome"
                    autoComplete="name"
                    {...inviteForm.register("name")}
                    className={cn(inviteForm.formState.errors.name && "border-destructive")}
                  />
                  {inviteForm.formState.errors.name && (
                    <p className="text-sm text-destructive">{inviteForm.formState.errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                    {...inviteForm.register("password")}
                    className={cn(inviteForm.formState.errors.password && "border-destructive")}
                  />
                  {inviteForm.formState.errors.password && (
                    <p className="text-sm text-destructive">{inviteForm.formState.errors.password.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Repita a senha"
                    autoComplete="new-password"
                    {...inviteForm.register("confirmPassword")}
                    className={cn(inviteForm.formState.errors.confirmPassword && "border-destructive")}
                  />
                  {inviteForm.formState.errors.confirmPassword && (
                    <p className="text-sm text-destructive">{inviteForm.formState.errors.confirmPassword.message}</p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Cadastrando..." : "Criar acesso e entrar"}
                </Button>
              </form>
            ) : (
              !inviteToken && (
                <form onSubmit={fullForm.handleSubmit(onSubmitFull)} className="space-y-4">
                  {error && (
                    <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      placeholder="Seu nome"
                      autoComplete="name"
                      {...fullForm.register("name")}
                      className={cn(fullForm.formState.errors.name && "border-destructive")}
                    />
                    {fullForm.formState.errors.name && (
                      <p className="text-sm text-destructive">{fullForm.formState.errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="organizationName">Nome da empresa (organização)</Label>
                    <Input
                      id="organizationName"
                      placeholder="Ex.: Minha agência, Minha marca, Nome do time"
                      autoComplete="organization"
                      {...fullForm.register("organizationName")}
                      className={cn(fullForm.formState.errors.organizationName && "border-destructive")}
                    />
                    {fullForm.formState.errors.organizationName && (
                      <p className="text-sm text-destructive">{fullForm.formState.errors.organizationName.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Cria o <strong className="font-medium text-foreground">ambiente</strong> onde ficam integrações,
                      métricas e cadastros. O menu <strong className="font-medium text-foreground">Clientes</strong>{" "}
                      (depois do login) serve para outra coisa: contas comerciais dentro deste ambiente.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      autoComplete="email"
                      {...fullForm.register("email")}
                      className={cn(fullForm.formState.errors.email && "border-destructive")}
                    />
                    {fullForm.formState.errors.email && (
                      <p className="text-sm text-destructive">{fullForm.formState.errors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      autoComplete="new-password"
                      {...fullForm.register("password")}
                      className={cn(fullForm.formState.errors.password && "border-destructive")}
                    />
                    {fullForm.formState.errors.password && (
                      <p className="text-sm text-destructive">{fullForm.formState.errors.password.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar senha</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Repita a senha"
                      autoComplete="new-password"
                      {...fullForm.register("confirmPassword")}
                      className={cn(fullForm.formState.errors.confirmPassword && "border-destructive")}
                    />
                    {fullForm.formState.errors.confirmPassword && (
                      <p className="text-sm text-destructive">{fullForm.formState.errors.confirmPassword.message}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Cadastrando..." : "Cadastrar"}
                  </Button>
                </form>
              )
            )}

            <p className="mt-4 text-center text-sm text-muted-foreground">
              Já tem conta?{" "}
              <Link to="/login" className="font-medium text-primary hover:underline">
                Entrar
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

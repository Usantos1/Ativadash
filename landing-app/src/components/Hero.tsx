import { ArrowRight, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { APP_URL } from "@/lib/env";
import { DashboardMockup } from "./DashboardMockup";

export function Hero() {
  return (
    <section id="topo" className="relative overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-50" aria-hidden />
      <div className="container-page relative pb-16 pt-12 sm:pb-24 sm:pt-20 lg:pb-32 lg:pt-28">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-6">
            <span className="badge animate-fade-up">
              <Sparkles className="h-3.5 w-3.5" />
              Analytics & performance · multi-tenant
            </span>

            <h1
              className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl animate-fade-up"
              style={{ animationDelay: "60ms" }}
            >
              Painel de marketing que <span className="text-brand-700">unifica Meta, Google</span> e fecha o funil.
            </h1>

            <p
              className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg animate-fade-up"
              style={{ animationDelay: "120ms" }}
            >
              Para agências, gestores de tráfego e marcas: investimento, captação, conversão e receita real
              em uma só tela. Conecta integrações em minutos, define metas, dispara alertas e entrega white-label
              pra cada cliente.
            </p>

            <div
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center animate-fade-up"
              style={{ animationDelay: "180ms" }}
            >
              <a href="#contato" className="btn-primary text-base">
                Solicitar acesso
                <ArrowRight className="h-4 w-4" />
              </a>
              <a href={`${APP_URL}/login`} className="btn-outline text-base">
                Já tenho conta — entrar
              </a>
            </div>

            <ul
              className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600 animate-fade-up"
              style={{ animationDelay: "240ms" }}
            >
              <li className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-brand-700" />
                Dados isolados por organização
              </li>
              <li className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-brand-700" />
                Setup em 10 minutos
              </li>
              <li className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-brand-700" />
                Painel para cada cliente
              </li>
            </ul>
          </div>

          <div className="relative lg:col-span-6">
            <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-brand-300/40 via-brand-200/30 to-transparent blur-2xl" aria-hidden />
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

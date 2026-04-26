import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeConfigProvider } from "@/contexts/ThemeConfigContext";
import { ThemeProvider } from "next-themes";
import { NotificationManager } from "@/components/NotificationManager";
import { HelmetProvider } from "react-helmet-async";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PermissionRoute } from "@/components/PermissionRoute";
import { RecrutamentoGuard } from "@/components/RecrutamentoGuard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import DashboardGestao from "./pages/DashboardGestao";
import Auth from "./pages/Auth";
import DemoLoginPage from "./pages/DemoLoginPage";
import Admin from "./pages/Admin";
import PendingApproval from "./pages/PendingApproval";
import NotFound from "./pages/NotFound";
import Reports from "./pages/Reports";
import Users from "./pages/Users";
import Integration from "./pages/Integration";
import UserProfile from "./pages/UserProfile";
import TimeClock from "./pages/TimeClock";
import UserLogs from "./pages/UserLogs";
import DiscTest from "./pages/DiscTest";
// TestAuth será definido inline abaixo
import CandidateDisc from "./pages/CandidateDisc";
import CandidateDiscResult from "./pages/CandidateDiscResult";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminTimeClock from "./pages/admin/AdminTimeClock";
import AdminDisc from "./pages/admin/AdminDisc";
import AdminFinanceiro from "./pages/admin/AdminFinanceiro";
import FinanceiroCaixaPage from "./pages/financeiro/FinanceiroCaixaPage";
import FinanceiroContasPage from "./pages/financeiro/FinanceiroContasPage";
import FinanceiroTransacoesPage from "./pages/financeiro/FinanceiroTransacoesPage";
import CategoriasFinanceiras from "./pages/financeiro/CategoriasFinanceiras";
import AdminReseller from "./pages/admin/AdminReseller";
import CompanyDashboardPage from "./pages/CompanyDashboardPage";
import SubscriptionPage from "./pages/SubscriptionPage";
import EstruturaOrganizacional from "./pages/admin/EstruturaOrganizacional";
import AdminDepartments from "./pages/admin/AdminDepartments";
import CadastrosBase from "./pages/admin/CadastrosBase";
import RH from "./pages/RH";
import AdminJobSurveys from "./pages/admin/AdminJobSurveys";
import JobSurveyDetail from "./pages/admin/JobSurveyDetail";
import TalentBank from "./pages/admin/TalentBank";
import AdminLogs from "./pages/admin/AdminLogs";
import AdminInterviews from "./pages/admin/AdminInterviews";
import InterviewEvaluation from "./pages/admin/InterviewEvaluation";
import RecruitmentManager from "./pages/admin/RecruitmentManager";
import PaymentMethodsConfig from "./pages/admin/PaymentMethodsConfig";
import JobApplication from "./pages/JobApplication";
import JobApplicationSteps from "./pages/JobApplicationSteps";
import JobSuccess from "./pages/JobSuccess";
import JobPortal from "./pages/JobPortal";
import JobApplicationStatus from "./pages/JobApplicationStatus";
import { OrdensServico as AssistenciaOS, OrdemServicoForm, Clientes as AssistenciaClientes, Produtos as AssistenciaProdutos, PDV, MarcasModelos as AssistenciaMarcasModelos, ConfiguracaoStatus as AssistenciaConfiguracaoStatus, FollowupPosVendaConfig } from "./pages/assistencia";
import Vendas from "./pages/pdv/Vendas";
import NovaVenda from "./pages/pdv/NovaVenda";
import Caixa from "./pages/pdv/Caixa";
import Relatorios from "./pages/Relatorios";
import Pedidos from "./pages/Pedidos";
import Inventario from "./pages/Inventario";
import Orcamentos from "./pages/Orcamentos";
import Veiculos from "./pages/Veiculos";
import ConfiguracaoCupom from "./pages/pdv/ConfiguracaoCupom";
import Devolucoes from "./pages/pdv/Devolucoes";
import Configuracoes from "./pages/admin/Configuracoes";
import CupomView from "./pages/pdv/CupomView";
import AcompanharOS from "./pages/public/AcompanharOS";
import TermosDeUso from "./pages/public/TermosDeUso";
import PoliticaPrivacidade from "./pages/public/PoliticaPrivacidade";
import LandingPage from "./pages/landing/LandingPage";
import DashboardExecutivo from "./pages/financeiro/DashboardExecutivo";
import DRE from "./pages/financeiro/DRE";
import PlanejamentoAnual from "./pages/financeiro/PlanejamentoAnual";
import FluxoDeCaixa from "./pages/financeiro/FluxoDeCaixa";
import PainelAlertasConfig from "./pages/painel-alertas/PainelAlertasConfig";
import PainelAlertasCategoria from "./pages/painel-alertas/PainelAlertasCategoria";
import PainelAlertasHistorico from "./pages/painel-alertas/PainelAlertasHistorico";

const queryClient = new QueryClient();

/** ativafix.com / www = LP de vendas. Se o main.tsx não tiver rodado a branch certa (cache/build antigo), este fallback garante a LP. */
function isLandingHost() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname.toLowerCase();
  return h === 'ativafix.com' || h === 'www.ativafix.com';
}

/** Dispara evento para AuthContext atualizar sessão/permissões ao trocar de página (não ao alternar aba do Chrome). */
function AuthSyncOnNavigate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    window.dispatchEvent(new CustomEvent('auth-check-on-navigate'));
  }, [location.pathname]);
  return <>{children}</>;
}

const App = () => {
  if (isLandingHost()) return <LandingPage />;
  return (
  <ErrorBoundary>
    <HelmetProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <ThemeConfigProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <NotificationManager>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
            <AuthSyncOnNavigate>
            <Routes>
            {/* Rotas públicas de autenticação */}
            <Route path="/login" element={<Auth />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/demo" element={<DemoLoginPage />} />
            {/* Páginas legais e LP (acessíveis sem login; no topo para bater antes do restante) */}
            <Route path="/termos-de-uso" element={<TermosDeUso />} />
            <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
            <Route path="/lp" element={<LandingPage />} />
            {/* Rotas removidas -> 404 */}
            <Route path="/reset-password" element={<NotFound />} />
            <Route path="/reset-senha" element={<NotFound />} />
            <Route path="/recuperar-acesso" element={<NotFound />} />
            <Route path="/process-analytics" element={<NotFound />} />
            <Route path="/processos/*" element={<NotFound />} />
            <Route path="/processo/:processId" element={<NotFound />} />
            <Route path="/processo/:processId/edit" element={<NotFound />} />
            <Route path="/tarefas/*" element={<NotFound />} />
            <Route path="/calendario" element={<NotFound />} />
            <Route path="/nps" element={<NotFound />} />
            <Route path="/admin/nps" element={<NotFound />} />
            <Route path="/metas" element={<NotFound />} />
            <Route path="/metricas" element={<NotFound />} />
            <Route path="/admin/categories" element={<NotFound />} />
            <Route path="/admin/tags" element={<NotFound />} />
            <Route path="/admin/departments" element={<ProtectedRoute><AdminDepartments /></ProtectedRoute>} />
            <Route path="/notifications" element={<NotFound />} />
            <Route path="/search" element={<NotFound />} />
            <Route path="/productivity" element={<NotFound />} />
            {/* Rota de teste - DEVE estar antes do catch-all */}
            <Route path="/test-auth" element={
              <div style={{ padding: '50px', textAlign: 'center' }}>
                <h1 style={{ color: 'green' }}>✅ FUNCIONANDO!</h1>
                <p>Rota /test-auth está funcionando!</p>
                <p>API: {import.meta.env.VITE_API_URL || 'https://api.ativafix.com/api'}</p>
                <button onClick={() => fetch(`${import.meta.env.VITE_API_URL || 'https://api.ativafix.com/api'}/health`).then(r => r.json()).then(d => alert(JSON.stringify(d))).catch(e => alert('Erro: ' + e.message))}>
                  Testar API
                </button>
              </div>
            } />
          <Route path="/candidato-disc" element={<CandidateDisc />} />
          <Route path="/disc-externo" element={<CandidateDisc />} />
          <Route path="/candidato-disc/resultado" element={<CandidateDiscResult />} />
            {/* Dashboard - acesso livre para usuários autenticados, controle interno por perfil */}
              <Route 
                path="/" 
                element={<ProtectedRoute><Index /></ProtectedRoute>} 
              />
              <Route path="/gestao" element={<PermissionRoute permission="dashboard.gestao"><DashboardGestao /></PermissionRoute>} />
              <Route path="/usuarios" element={<ProtectedRoute><Users /></ProtectedRoute>} />
              <Route path="/pending-approval" element={<ProtectedRoute><PendingApproval /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
              <Route path="/admin/users" element={<PermissionRoute permission="admin.users"><AdminUsers /></PermissionRoute>} />
              <Route path="/admin/timeclock" element={<PermissionRoute permission="admin.timeclock"><AdminTimeClock /></PermissionRoute>} />
              <Route path="/admin/disc" element={<PermissionRoute permission="admin.disc"><AdminDisc /></PermissionRoute>} />
              <Route path="/admin/financeiro/*" element={<PermissionRoute permission="relatorios.financeiro"><AdminFinanceiro /></PermissionRoute>} />
              <Route path="/admin/revenda" element={<ProtectedRoute><AdminReseller /></ProtectedRoute>} />
              <Route path="/admin/configuracoes/pagamentos" element={<PermissionRoute permission="admin.view"><PaymentMethodsConfig /></PermissionRoute>} />
              <Route path="/minha-empresa" element={<ProtectedRoute><CompanyDashboardPage /></ProtectedRoute>} />
              <Route path="/assinatura" element={<ProtectedRoute><SubscriptionPage /></ProtectedRoute>} />
              <Route path="/admin/job-surveys" element={<ProtectedRoute><RecrutamentoGuard><RecruitmentManager /></RecrutamentoGuard></ProtectedRoute>} />
              <Route path="/admin/job-surveys/:id" element={<ProtectedRoute><RecrutamentoGuard><JobSurveyDetail /></RecrutamentoGuard></ProtectedRoute>} />
              <Route path="/admin/talent-bank" element={<ProtectedRoute><RecrutamentoGuard><TalentBank /></RecrutamentoGuard></ProtectedRoute>} />
              <Route path="/admin/interviews" element={<ProtectedRoute><RecrutamentoGuard><RecruitmentManager /></RecrutamentoGuard></ProtectedRoute>} />
              <Route path="/admin/interviews/evaluate/:interview_id" element={<ProtectedRoute><RecrutamentoGuard><InterviewEvaluation /></RecrutamentoGuard></ProtectedRoute>} />
              <Route path="/admin/logs" element={<PermissionRoute permission="admin.logs"><AdminLogs /></PermissionRoute>} />
              <Route path="/admin/estrutura" element={<ProtectedRoute><EstruturaOrganizacional /></ProtectedRoute>} />
              <Route path="/admin/cadastros" element={<ProtectedRoute><CadastrosBase /></ProtectedRoute>} />
              <Route path="/admin/configuracoes" element={<PermissionRoute permission="admin.config"><Configuracoes /></PermissionRoute>} />
              <Route path="/rh" element={<PermissionRoute permission="rh.view"><RH /></PermissionRoute>} />
              
              {/* Public job application routes */}
              <Route path="/job-application/:surveyId" element={<JobApplication />} />
              <Route path="/vaga/:slug" element={<JobApplicationSteps />} />
              <Route path="/vaga/sucesso/:protocol" element={<JobSuccess />} />
              <Route path="/vagas" element={<JobPortal />} />
              <Route path="/candidatura/:protocol?" element={<JobApplicationStatus />} />
              <Route path="/acompanhar-candidatura/:protocol?" element={<JobApplicationStatus />} />
              
              {/* Public OS tracking route */}
              <Route path="/acompanhar-os/:id" element={<AcompanharOS />} />
              <Route path="/integracoes" element={<ProtectedRoute><Integration /></ProtectedRoute>} />
              <Route path="/integracoes/:tab" element={<ProtectedRoute><Integration /></ProtectedRoute>} />
              <Route path="/perfil" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
            <Route path="/ponto" element={<PermissionRoute permission="rh.ponto"><TimeClock /></PermissionRoute>} />
            <Route path="/logs" element={<ProtectedRoute><UserLogs /></ProtectedRoute>} />
            <Route path="/teste-disc" element={<PermissionRoute permission="admin.disc"><DiscTest /></PermissionRoute>} />
              <Route path="/produtos" element={<PermissionRoute permission="produtos.view"><AssistenciaProdutos /></PermissionRoute>} />
              <Route path="/pedidos" element={<PermissionRoute permission="produtos.view"><Pedidos /></PermissionRoute>} />
              <Route path="/inventario" element={<PermissionRoute permission="produtos.view"><Inventario /></PermissionRoute>} />
              
              {/* PDV - Frente de Caixa */}
              <Route path="/pdv" element={<PermissionRoute permission="vendas.create"><NovaVenda /></PermissionRoute>} />
              <Route path="/pdv/nova" element={<PermissionRoute permission="vendas.create"><NovaVenda /></PermissionRoute>} />
              <Route path="/pdv/vendas" element={<PermissionRoute permission="vendas.view"><Vendas /></PermissionRoute>} />
              {/* Dashboard Assistência Técnica */}
              <Route path="/assistencia" element={<PermissionRoute permission="os.view"><PDV /></PermissionRoute>} />
              <Route path="/pdv/venda/nova" element={<PermissionRoute permission="vendas.create"><NovaVenda /></PermissionRoute>} />
              <Route path="/pdv/venda/:id" element={<PermissionRoute permission="vendas.view"><NovaVenda /></PermissionRoute>} />
              <Route path="/pdv/venda/:id/editar" element={<PermissionRoute permission="vendas.edit"><NovaVenda /></PermissionRoute>} />
              <Route path="/pdv/caixa" element={<PermissionRoute permission="caixa.view"><Caixa /></PermissionRoute>} />
              <Route path="/relatorios" element={<PermissionRoute permission={["relatorios.vendas", "relatorios.financeiro", "relatorios.geral"]}><Relatorios /></PermissionRoute>} />
              <Route path="/relatorios/:tab" element={<PermissionRoute permission={["relatorios.vendas", "relatorios.financeiro", "relatorios.geral"]}><Relatorios /></PermissionRoute>} />
              <Route path="/pdv/relatorios" element={<Navigate to="/relatorios" replace />} />
              <Route path="/pdv/relatorios/:tab" element={<Navigate to="/relatorios" replace />} />
              <Route path="/pdv/configuracao-cupom" element={<PermissionRoute permission={["vendas.manage", "vendas.create"]}><ConfiguracaoCupom /></PermissionRoute>} />
              <Route path="/pdv/devolucoes" element={<PermissionRoute permission="vendas.manage"><Devolucoes /></PermissionRoute>} />
              <Route path="/cupom/:id" element={<CupomView />} />
              
              {/* Sistema IA-First Financeiro */}
              <Route path="/financeiro" element={<PermissionRoute permission={["financeiro.view", "relatorios.financeiro"]}><DashboardExecutivo /></PermissionRoute>} />
              <Route path="/financeiro/dashboard" element={<PermissionRoute permission={["financeiro.view", "relatorios.financeiro"]}><DashboardExecutivo /></PermissionRoute>} />
              <Route path="/financeiro/dre" element={<PermissionRoute permission={["financeiro.view", "relatorios.financeiro"]}><DRE /></PermissionRoute>} />
              <Route path="/financeiro/planejamento-anual" element={<PermissionRoute permission={["financeiro.view", "relatorios.financeiro"]}><PlanejamentoAnual /></PermissionRoute>} />
              <Route path="/financeiro/precificacao" element={<PermissionRoute permission={["financeiro.view", "relatorios.financeiro"]}><FluxoDeCaixa /></PermissionRoute>} />
              <Route path="/financeiro/fluxo-de-caixa" element={<PermissionRoute permission={["financeiro.view", "relatorios.financeiro"]}><FluxoDeCaixa /></PermissionRoute>} />
              <Route path="/financeiro/caixa" element={<PermissionRoute permission={["financeiro.view", "relatorios.financeiro"]}><FinanceiroCaixaPage /></PermissionRoute>} />
              <Route path="/financeiro/contas" element={<PermissionRoute permission={["financeiro.view", "relatorios.financeiro"]}><FinanceiroContasPage /></PermissionRoute>} />
              <Route path="/financeiro/transacoes" element={<PermissionRoute permission={["financeiro.view", "relatorios.financeiro"]}><FinanceiroTransacoesPage /></PermissionRoute>} />
              <Route path="/financeiro/categorias" element={<PermissionRoute permission={["financeiro.view", "relatorios.financeiro"]}><CategoriasFinanceiras /></PermissionRoute>} />
              <Route path="/painel-alertas" element={<PermissionRoute permission="alertas.view"><Navigate to="/painel-alertas/configuracoes" replace /></PermissionRoute>} />
              <Route path="/painel-alertas/configuracoes" element={<PermissionRoute permission="alertas.config"><PainelAlertasConfig /></PermissionRoute>} />
              <Route path="/painel-alertas/alertas/:categoria" element={<PermissionRoute permission="alertas.view"><PainelAlertasCategoria /></PermissionRoute>} />
              <Route path="/painel-alertas/historico" element={<PermissionRoute permission="alertas.view"><PainelAlertasHistorico /></PermissionRoute>} />
              
              {/* Orçamentos (oficina / assistência) */}
              <Route path="/orcamentos" element={<PermissionRoute permission="os.view"><Orcamentos /></PermissionRoute>} />
              {/* Rotas de OS - simplificadas para /os */}
              <Route path="/os" element={<PermissionRoute permission="os.view"><AssistenciaOS /></PermissionRoute>} />
              <Route path="/os/nova" element={<PermissionRoute permission="os.create"><OrdemServicoForm /></PermissionRoute>} />
              <Route path="/os/nova/:tab" element={<PermissionRoute permission="os.create"><OrdemServicoForm /></PermissionRoute>} />
              <Route path="/os/:id" element={<PermissionRoute permission="os.view"><OrdemServicoForm /></PermissionRoute>} />
              <Route path="/os/:id/:tab" element={<PermissionRoute permission="os.view"><OrdemServicoForm /></PermissionRoute>} />
              <Route path="/os/:id/editar" element={<PermissionRoute permission="os.edit"><OrdemServicoForm /></PermissionRoute>} />
              <Route path="/os/:id/editar/:tab" element={<PermissionRoute permission="os.edit"><OrdemServicoForm /></PermissionRoute>} />
              {/* Redirect antigo /pdv/os para /os */}
              <Route path="/pdv/os" element={<Navigate to="/os" replace />} />
              <Route path="/pdv/os/*" element={<Navigate to="/os" replace />} />
              {/* Veículos (oficina / assistência) */}
              <Route path="/veiculos" element={<PermissionRoute permission="clientes.view"><Veiculos /></PermissionRoute>} />
              <Route path="/clientes" element={<PermissionRoute permission="clientes.view"><AssistenciaClientes /></PermissionRoute>} />
              <Route path="/pdv/clientes" element={<Navigate to="/clientes" replace />} />
              <Route path="/pdv/marcas-modelos" element={<PermissionRoute permission="produtos.manage"><AssistenciaMarcasModelos /></PermissionRoute>} />
              <Route path="/pdv/configuracao-status" element={<PermissionRoute permission="os.config.status"><AssistenciaConfiguracaoStatus /></PermissionRoute>} />
              <Route path="/pos-venda" element={<PermissionRoute permission="pos_venda.view"><FollowupPosVendaConfig /></PermissionRoute>} />
              <Route path="/pdv/followup-pos-venda" element={<PermissionRoute permission="pos_venda.view"><Navigate to="/pos-venda" replace /></PermissionRoute>} />
              
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthSyncOnNavigate>
            </BrowserRouter>
            </TooltipProvider>
            </NotificationManager>
          </AuthProvider>
        </QueryClientProvider>
        </ThemeConfigProvider>
    </ThemeProvider>
  </HelmetProvider>
  </ErrorBoundary>
  );
};

export default App;

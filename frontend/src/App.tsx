import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MainLayout } from "@/components/layout/MainLayout";
import { Login } from "@/pages/Login";
import { Register } from "@/pages/Register";
import { ForgotPassword } from "@/pages/ForgotPassword";
import { Dashboard } from "@/pages/Dashboard";
import { Marketing } from "@/pages/Marketing";
import { IntegrationsHubPage } from "@/pages/integrations/IntegrationsHubPage";
import { GoogleAdsIntegrationPage } from "@/pages/integrations/GoogleAdsIntegrationPage";
import { MetaAdsIntegrationPage } from "@/pages/integrations/MetaAdsIntegrationPage";
import { WhatsAppIntegrationPage } from "@/pages/integrations/WhatsAppIntegrationPage";
import { WebhooksIntegrationPage } from "@/pages/integrations/WebhooksIntegrationPage";
import { IntegrationComingSoonPage } from "@/pages/integrations/IntegrationComingSoonPage";
import { MarketingSettings } from "@/pages/MarketingSettings";
import { MarketingAdsOperationalPage } from "@/pages/MarketingAdsOperationalPage";
import { MetasAlertasPage } from "@/pages/MetasAlertasPage";
import { MarketingFunnelPage } from "@/pages/MarketingFunnelPage";
import { ClientsPage } from "@/pages/ClientsPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { LaunchesPage } from "@/pages/LaunchesPage";
import { SettingsHubPage } from "@/pages/SettingsHubPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { CompanySettingsPage } from "@/pages/CompanySettingsPage";
import { TeamPage } from "@/pages/TeamPage";
import { RevendaLayout } from "@/pages/revenda/RevendaLayout";
import { RevendaOverviewPage } from "@/pages/revenda/RevendaOverviewPage";
import { RevendaTenantsPage } from "@/pages/revenda/RevendaTenantsPage";
import { RevendaUsersPage } from "@/pages/revenda/RevendaUsersPage";
import { RevendaPlansPage } from "@/pages/revenda/RevendaPlansPage";
import { RevendaModulesPage } from "@/pages/revenda/RevendaModulesPage";
import { RevendaHealthPage } from "@/pages/revenda/RevendaHealthPage";
import { RevendaAuditPage } from "@/pages/revenda/RevendaAuditPage";
import { AdminPage } from "@/pages/AdminPage";
import { AdminSettingsPage } from "@/pages/AdminSettingsPage";
import { PlatformPage } from "@/pages/PlatformPage";
import { PublicDashboardSharePage } from "@/pages/PublicDashboardSharePage";

function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <MainLayout />
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/share/d/:token" element={<PublicDashboardSharePage />} />
        <Route path="/" element={<ProtectedLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="marketing" element={<Marketing />} />
          <Route path="marketing/captacao" element={<MarketingFunnelPage variant="captacao" />} />
          <Route path="marketing/conversao" element={<MarketingFunnelPage variant="conversao" />} />
          <Route path="marketing/receita" element={<MarketingFunnelPage variant="receita" />} />
          <Route path="marketing/integracoes" element={<IntegrationsHubPage />} />
          <Route path="marketing/integracoes/google-ads" element={<GoogleAdsIntegrationPage />} />
          <Route path="marketing/integracoes/meta-ads" element={<MetaAdsIntegrationPage />} />
          <Route path="marketing/integracoes/ativa-crm" element={<WhatsAppIntegrationPage />} />
          <Route path="marketing/integracoes/whatsapp" element={<WhatsAppIntegrationPage />} />
          <Route path="marketing/integracoes/webhook" element={<WebhooksIntegrationPage />} />
          <Route path="marketing/integracoes/:slug" element={<IntegrationComingSoonPage />} />
          <Route path="marketing/configuracoes" element={<MarketingSettings />} />
          <Route path="ads/metas-alertas" element={<MetasAlertasPage />} />
          <Route path="ads/metas-operacao" element={<MarketingAdsOperationalPage />} />
          <Route path="clientes" element={<ClientsPage />} />
          <Route path="projetos" element={<ProjectsPage />} />
          <Route path="lancamentos" element={<LaunchesPage />} />
          <Route path="configuracoes" element={<SettingsHubPage />} />
          <Route path="configuracoes/empresa" element={<CompanySettingsPage />} />
          <Route path="configuracoes/admin" element={<AdminSettingsPage />} />
          <Route path="perfil" element={<ProfilePage />} />
          <Route path="usuarios" element={<TeamPage />} />
          <Route path="revenda" element={<RevendaLayout />}>
            <Route index element={<RevendaOverviewPage />} />
            <Route path="empresas" element={<RevendaTenantsPage kind="CLIENT" />} />
            <Route path="agencias" element={<RevendaTenantsPage kind="AGENCY" />} />
            <Route path="usuarios" element={<RevendaUsersPage />} />
            <Route path="planos" element={<RevendaPlansPage />} />
            <Route path="modulos" element={<RevendaModulesPage />} />
            <Route path="saude" element={<RevendaHealthPage />} />
            <Route path="auditoria" element={<RevendaAuditPage />} />
            <Route path="plataforma" element={<PlatformPage />} />
          </Route>
          <Route path="assinatura" element={<Navigate to="/revenda" replace />} />
          <Route path="planos" element={<Navigate to="/revenda" replace />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="plataforma" element={<Navigate to="/revenda/plataforma" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

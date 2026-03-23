import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MainLayout } from "@/components/layout/MainLayout";
import { Login } from "@/pages/Login";
import { Register } from "@/pages/Register";
import { ForgotPassword } from "@/pages/ForgotPassword";
import { Dashboard } from "@/pages/Dashboard";
import { Marketing } from "@/pages/Marketing";
import { Integrations } from "@/pages/Integrations";
import { MarketingSettings } from "@/pages/MarketingSettings";
import { MarketingFunnelPage } from "@/pages/MarketingFunnelPage";
import { ClientsPage } from "@/pages/ClientsPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { LaunchesPage } from "@/pages/LaunchesPage";
import { SettingsHubPage } from "@/pages/SettingsHubPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { CompanySettingsPage } from "@/pages/CompanySettingsPage";
import { TeamPage } from "@/pages/TeamPage";
import { RevendaWorkspacesPage } from "@/pages/RevendaWorkspacesPage";
import { AdminPage } from "@/pages/AdminPage";
import { PlatformPage } from "@/pages/PlatformPage";

function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <MainLayout />
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/" element={<ProtectedLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="marketing" element={<Marketing />} />
          <Route path="marketing/captacao" element={<MarketingFunnelPage variant="captacao" />} />
          <Route path="marketing/conversao" element={<MarketingFunnelPage variant="conversao" />} />
          <Route path="marketing/receita" element={<MarketingFunnelPage variant="receita" />} />
          <Route path="marketing/integracoes" element={<Integrations />} />
          <Route path="marketing/configuracoes" element={<MarketingSettings />} />
          <Route path="clientes" element={<ClientsPage />} />
          <Route path="projetos" element={<ProjectsPage />} />
          <Route path="lancamentos" element={<LaunchesPage />} />
          <Route path="configuracoes" element={<SettingsHubPage />} />
          <Route path="configuracoes/empresa" element={<CompanySettingsPage />} />
          <Route path="perfil" element={<ProfilePage />} />
          <Route path="usuarios" element={<TeamPage />} />
          <Route path="revenda" element={<RevendaWorkspacesPage />} />
          <Route path="assinatura" element={<Navigate to="/revenda" replace />} />
          <Route path="planos" element={<Navigate to="/revenda" replace />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="plataforma" element={<PlatformPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

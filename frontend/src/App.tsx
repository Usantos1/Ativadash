import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MainLayout } from "@/components/layout/MainLayout";
import { Login } from "@/pages/Login";
import { Register } from "@/pages/Register";
import { ForgotPassword } from "@/pages/ForgotPassword";
import { Dashboard } from "@/pages/Dashboard";
import { Marketing } from "@/pages/Marketing";
import { PlaceholderPage } from "@/pages/PlaceholderPage";
import { Integrations } from "@/pages/Integrations";
import { MarketingSettings } from "@/pages/MarketingSettings";
import { MarketingFunnelPage } from "@/pages/MarketingFunnelPage";

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
          <Route path="clientes" element={<PlaceholderPage title="Clientes" />} />
          <Route path="projetos" element={<PlaceholderPage title="Projetos" />} />
          <Route path="lancamentos" element={<PlaceholderPage title="Lançamentos" />} />
          <Route path="configuracoes" element={<PlaceholderPage title="Configurações" />} />
          <Route path="perfil" element={<PlaceholderPage title="Perfil" />} />
          <Route path="usuarios" element={<PlaceholderPage title="Usuários" />} />
          <Route path="planos" element={<PlaceholderPage title="Planos" />} />
          <Route path="admin" element={<PlaceholderPage title="Admin" />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

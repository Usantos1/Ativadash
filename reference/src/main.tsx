import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import App from "./App.tsx";
import LandingPage from "./pages/landing/LandingPage.tsx";
import "./index.css";

// ativafix.com e www.ativafix.com = só landing de vendas. app.ativafix.com e localhost = app completo.
function isLandingDomain() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname.toLowerCase();
  return h === 'ativafix.com' || h === 'www.ativafix.com';
}

// Limpar tokens antigos/inválidos do localStorage
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('gogxicjaq'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log('[App] Removido token inválido:', key);
    });
  } catch (e) {
    // Ignorar erros de localStorage
  }
}

const Root = isLandingDomain() ? (
  <StrictMode>
    <LandingPage />
  </StrictMode>
) : (
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <App />
    </ThemeProvider>
  </StrictMode>
);

createRoot(document.getElementById("root")!).render(Root);

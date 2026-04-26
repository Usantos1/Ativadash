import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/AppSidebar"
import { useState, useEffect } from "react"
import { NotificationPanel } from "./NotificationPanel"
import { SettingsModal } from "./SettingsModal"
import { DemoBanner } from "./DemoBanner"
import { useAuth } from "@/contexts/AuthContext"
import { useThemeConfig } from "@/contexts/ThemeConfigContext"
import { GlobalCommandPalette } from "@/components/GlobalCommandPalette"
import { usePermissions } from "@/hooks/usePermissions"
import { HeaderDefault } from "./HeaderDefault"
import { HeaderMiui } from "./HeaderMiui"

/** Apenas a empresa 1 (administradora) pode alterar nome e cores do sistema. */
const ADMIN_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

/** True se o app está embutido no iframe da LP (não mostrar banner para não duplicar). */
function isEmbeddedInLp(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (new URLSearchParams(window.location.search).get('embed') === '1') return true
    return window.self !== window.top
  } catch {
    return true
  }
}

interface ModernLayoutProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  headerActions?: React.ReactNode
}

export function ModernLayout({ children, title, subtitle, headerActions }: ModernLayoutProps) {
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [notificationCount, setNotificationCount] = useState(3)
  const [currentTime, setCurrentTime] = useState(new Date())
  const { user, profile } = useAuth()
  const { hasPermission, isAdmin } = usePermissions()
  const { config } = useThemeConfig()
  const isAdminCompany = user?.company_id === ADMIN_COMPANY_ID
  const isMiuiNavigation = config.navigationVariant === 'miui'
  const canOpenSettings = isAdminCompany ? hasPermission('admin.config') : (isAdmin || hasPermission('admin.config'))

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const openPanel = () => setIsNotificationOpen(true)
    window.addEventListener('open-notification-panel', openPanel)
    return () => window.removeEventListener('open-notification-panel', openPanel)
  }, [])

  const hideDemoBanner = isEmbeddedInLp()

  return (
    <SidebarProvider>
      <div className="h-screen h-[100dvh] flex flex-col w-full bg-background overflow-hidden">
        {!hideDemoBanner && <DemoBanner />}

        <div className="flex-1 flex min-h-0 w-full overflow-hidden transition-all duration-300 ease-in-out">
          {!isMiuiNavigation && <AppSidebar />}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {isMiuiNavigation ? (
              <HeaderMiui
                notificationCount={notificationCount}
                canOpenSettings={canOpenSettings}
                onOpenNotifications={() => setIsNotificationOpen(true)}
                onOpenSettings={() => setIsSettingsOpen(true)}
                headerActions={headerActions}
                profileName={profile?.display_name}
                currentTime={currentTime}
              />
            ) : (
              <HeaderDefault
                title={title}
                profileName={profile?.display_name}
                currentTime={currentTime}
                notificationCount={notificationCount}
                canOpenSettings={canOpenSettings}
                onOpenNotifications={() => setIsNotificationOpen(true)}
                onOpenSettings={() => setIsSettingsOpen(true)}
                headerActions={headerActions}
              />
            )}

            {/* Main Content — mobile: página rola; desktop: scroll interno */}
            <main className="flex-1 flex flex-col min-h-0 overflow-x-hidden overflow-y-auto md:overflow-hidden">
              <div 
                className="flex-1 min-h-0 p-1 sm:p-2 md:p-4 pt-1 sm:pt-2 md:pt-4 overflow-x-hidden md:overflow-y-auto scrollbar-thin min-w-0"
              >
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
      
      <NotificationPanel 
        isOpen={isNotificationOpen} 
        onClose={() => setIsNotificationOpen(false)}
        onNotificationChange={(count) => setNotificationCount(count)}
      />
      
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
      <GlobalCommandPalette />
    </SidebarProvider>
  )
}
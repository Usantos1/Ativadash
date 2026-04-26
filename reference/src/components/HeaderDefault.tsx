import { SidebarTrigger } from "@/components/ui/sidebar";
import { AppBar } from "@/components/AppBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Bell, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface HeaderDefaultProps {
  title?: string;
  profileName?: string | null;
  currentTime: Date;
  notificationCount: number;
  canOpenSettings: boolean;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  headerActions?: React.ReactNode;
}

export function HeaderDefault({
  title,
  profileName,
  currentTime,
  notificationCount,
  canOpenSettings,
  onOpenNotifications,
  onOpenSettings,
  headerActions,
}: HeaderDefaultProps) {
  return (
    <>
      <header className="bg-background/95 backdrop-blur-sm sticky top-0 z-40 md:hidden flex flex-col border-b border-gray-100 dark:border-gray-800 shrink-0">
        <div className="h-10 flex items-center px-2 min-h-[40px]">
          <SidebarTrigger className="h-8 w-8 p-1 shrink-0" />
          {title && (
            <div className="ml-2 min-w-0 flex-1">
              <h1 className="font-medium text-sm truncate text-foreground">{title}</h1>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="relative shrink-0"
            onClick={onOpenNotifications}
          >
            <Bell className="h-4 w-4" />
            {notificationCount > 0 && (
              <Badge className="absolute -top-0.5 -right-0.5 h-4 w-4 min-w-4 p-0 flex items-center justify-center bg-red-500 text-white text-[10px]">
                {notificationCount}
              </Badge>
            )}
          </Button>
          <ThemeToggle variant="button" size="sm" />
        </div>
        <div className="min-h-0 min-w-0 overflow-x-auto overflow-y-hidden">
          <AppBar />
        </div>
      </header>

      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-40 hidden md:block app-header">
        <div className="h-16 flex items-center justify-between px-6 gap-4">
          <div className="flex items-center">
            <SidebarTrigger className="h-8 w-8" />
          </div>

          <div className="flex-1 flex items-center justify-center">
            <AppBar />
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center text-sm text-muted-foreground font-mono">
              <span>{currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              {profileName && (
                <>
                  <span className="mx-2 text-gray-300 dark:text-gray-600">|</span>
                  <span className="font-sans font-medium text-foreground">{profileName.split(' ')[0]}</span>
                </>
              )}
            </div>

            <div className="h-4 w-px bg-border hidden lg:block" />

            <ThemeToggle variant="button" size="sm" />
            <Button
              variant="ghost"
              size="sm"
              className="relative"
              onClick={onOpenNotifications}
            >
              <Bell className="h-4 w-4" />
              {notificationCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-red-500 text-white text-xs">
                  {notificationCount}
                </Badge>
              )}
            </Button>
            {canOpenSettings && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenSettings}
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}

            {headerActions}
          </div>
        </div>
      </header>
    </>
  );
}

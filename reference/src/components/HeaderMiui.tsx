import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Bell, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AppBarMiui } from "@/components/AppBarMiui";

interface HeaderMiuiProps {
  notificationCount: number;
  canOpenSettings: boolean;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  headerActions?: React.ReactNode;
  profileName?: string | null;
  currentTime: Date;
}

export function HeaderMiui({
  notificationCount,
  canOpenSettings,
  onOpenNotifications,
  onOpenSettings,
  headerActions,
  profileName,
  currentTime,
}: HeaderMiuiProps) {
  return (
    <header className="sticky top-0 z-40 shrink-0 border-b border-emerald-100/70 bg-background/95 backdrop-blur-xl dark:border-emerald-950/30">
      <div className="px-3 py-2.5 md:px-4 md:py-3">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <AppBarMiui />
          </div>

          <div className="hidden xl:flex items-center text-sm text-muted-foreground font-mono shrink-0">
            <span>{currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            {profileName && (
              <>
                <span className="mx-2 text-gray-300 dark:text-gray-600">|</span>
                <span className="font-sans font-medium text-foreground">{profileName.split(' ')[0]}</span>
              </>
            )}
          </div>

          <ThemeToggle variant="button" size="sm" />
          <Button
            variant="ghost"
            size="sm"
            className="relative shrink-0 rounded-2xl"
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
              className="rounded-2xl"
              onClick={onOpenSettings}
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
          {headerActions}
        </div>
      </div>
    </header>
  );
}

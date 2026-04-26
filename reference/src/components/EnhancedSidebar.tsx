import { Home, Users, Settings, BarChart3 } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const mainNavItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
  { title: "Usuários", url: "/usuarios", icon: Users },
  { title: "Admin", url: "/admin", icon: Settings, adminOnly: true },
];

export function EnhancedSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { isAdmin } = useAuth();

  const currentPath = location.pathname;
  const isActive = (path: string) => currentPath === path;
  
  const getNavClasses = (path: string) => 
    isActive(path) 
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium border-r-2 border-sidebar-primary" 
      : "hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground";

  const collapsed = state === "collapsed";

  return (
    <Sidebar
      className={cn(
        "transition-all duration-300",
        collapsed ? "w-16" : "w-72"
      )}
      collapsible="icon"
    >
      <SidebarContent>
        {/* Header */}
        <div className={cn(
          "flex items-center justify-center p-4 border-b border-sidebar-border",
          collapsed ? "px-2" : "px-6"
        )}>
          {collapsed ? (
            <div className="w-8 h-8 bg-sidebar-primary rounded-md flex items-center justify-center">
              <span className="text-sidebar-primary-foreground font-bold text-sm">PC</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-sidebar-primary rounded-md flex items-center justify-center">
                <span className="text-sidebar-primary-foreground font-bold text-sm">PC</span>
              </div>
              <h1 className="text-lg font-bold text-sidebar-foreground">Prime Camp</h1>
            </div>
          )}
        </div>

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? "sr-only" : ""}>
            Navegação Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => {
                if (item.adminOnly && !isAdmin) return null;
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink 
                        to={item.url} 
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-md transition-colors",
                          getNavClasses(item.url),
                          collapsed && "justify-center"
                        )}
                      >
                        <item.icon className={cn(
                          "h-5 w-5 flex-shrink-0",
                          collapsed ? "mx-auto" : ""
                        )} />
                        {!collapsed && (
                          <span className="font-medium">{item.title}</span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Collapsed state trigger */}
        {collapsed && (
          <div className="fixed bottom-4 left-4">
            <SidebarTrigger className="h-8 w-8" />
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
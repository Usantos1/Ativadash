import { useState } from "react";
import { Home, Users, Settings, BarChart3, ChevronDown, ChevronRight } from "lucide-react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface MenuGroup {
  id: string;
  label: string;
  icon: any;
  items: MenuItem[];
  badge?: number;
}

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  badge?: number;
  adminOnly?: boolean;
  subItems?: MenuItem[];
}

export function ProfessionalSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { isAdmin } = useAuth();
  
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    main: true,
    management: isAdmin
  });

  const currentPath = location.pathname;
  const isActive = (path: string) => currentPath === path || currentPath.startsWith(path + '/');
  
  const getNavClasses = (path: string) => 
    isActive(path) 
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium border-r-2 border-sidebar-primary" 
      : "hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground";

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const collapsed = state === "collapsed";

  const menuGroups: MenuGroup[] = [
    {
      id: "main",
      label: "Principal",
      icon: Home,
      items: [
        { title: "Dashboard", url: "/", icon: Home },
        { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
      ]
    },
  ];

  if (isAdmin) {
    menuGroups.push({
      id: "management",
      label: "Administração",
      icon: Settings,
      items: [
        { title: "Usuários", url: "/usuarios", icon: Users, adminOnly: true },
        { title: "Configurações", url: "/admin", icon: Settings, adminOnly: true },
      ]
    });
  }

  return (
    <Sidebar
      className={cn(
        "transition-all duration-300 border-r border-sidebar-border",
        collapsed ? "w-16" : "w-80"
      )}
      collapsible="icon"
    >
      <SidebarContent className="px-0">
        {/* Header */}
        <div className={cn(
          "flex items-center justify-center p-4 border-b border-sidebar-border bg-sidebar-accent/5",
          collapsed ? "px-2" : "px-6"
        )}>
          {collapsed ? (
            <div className="w-10 h-10 bg-gradient-to-br from-sidebar-primary to-sidebar-primary/80 rounded-lg flex items-center justify-center shadow-lg">
              <span className="text-sidebar-primary-foreground font-bold text-lg">PC</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-sidebar-primary to-sidebar-primary/80 rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-sidebar-primary-foreground font-bold text-lg">PC</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-sidebar-foreground">Prime Camp</h1>
                <p className="text-xs text-sidebar-foreground/60">Sistema de Gestão</p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Groups */}
        <div className="flex-1 overflow-y-auto">
          {menuGroups.map((group) => (
            <SidebarGroup key={group.id} className="px-3 py-2">
              {!collapsed && (
                <Collapsible
                  open={expandedGroups[group.id]}
                  onOpenChange={() => toggleGroup(group.id)}
                >
                  <CollapsibleTrigger asChild>
                    <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:bg-sidebar-accent/30 rounded-md p-2 -mx-2 transition-colors">
                      <div className="flex items-center gap-2">
                        <group.icon className="h-4 w-4" />
                        <span className="font-medium">{group.label}</span>
                      </div>
                      {expandedGroups[group.id] ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </SidebarGroupLabel>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {group.items.map((item) => {
                          if (item.adminOnly && !isAdmin) return null;
                          
                          return (
                            <SidebarMenuItem key={item.title}>
                              {item.subItems ? (
                                <Collapsible>
                                  <CollapsibleTrigger asChild>
                                    <SidebarMenuButton className="w-full justify-between">
                                      <div className="flex items-center gap-3">
                                        <item.icon className="h-4 w-4 text-sidebar-foreground/70" />
                                        <span>{item.title}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        {item.badge && (
                                          <Badge variant="secondary" className="h-5 text-xs px-1.5">
                                            {item.badge}
                                          </Badge>
                                        )}
                                        <ChevronRight className="h-3 w-3" />
                                      </div>
                                    </SidebarMenuButton>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <div className="ml-6 mt-1 space-y-1">
                                      {item.subItems.map((subItem) => (
                                        <SidebarMenuButton key={subItem.title} asChild>
                                          <NavLink 
                                            to={subItem.url} 
                                            className={cn(
                                              "flex items-center justify-between gap-2 p-2 rounded-md text-sm transition-colors",
                                              getNavClasses(subItem.url)
                                            )}
                                          >
                                            <div className="flex items-center gap-2">
                                              <subItem.icon className="h-3 w-3 text-sidebar-foreground/60" />
                                              <span className="text-sidebar-foreground/80">{subItem.title}</span>
                                            </div>
                                            {subItem.badge && (
                                              <Badge variant="outline" className="h-4 text-xs px-1">
                                                {subItem.badge}
                                              </Badge>
                                            )}
                                          </NavLink>
                                        </SidebarMenuButton>
                                      ))}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              ) : (
                                <SidebarMenuButton asChild>
                                  <NavLink 
                                    to={item.url} 
                                    className={cn(
                                      "flex items-center justify-between gap-3 p-3 rounded-md transition-colors",
                                      getNavClasses(item.url)
                                    )}
                                  >
                                    <div className="flex items-center gap-3">
                                      <item.icon className="h-4 w-4 text-sidebar-foreground/70" />
                                      <span className="font-medium">{item.title}</span>
                                    </div>
                                    {item.badge && (
                                      <Badge variant="secondary" className="h-5 text-xs px-1.5">
                                        {item.badge}
                                      </Badge>
                                    )}
                                  </NavLink>
                                </SidebarMenuButton>
                              )}
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {collapsed && (
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.slice(0, 1).map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <NavLink 
                            to={item.url} 
                            className={cn(
                              "flex items-center justify-center p-3 rounded-md transition-colors",
                              getNavClasses(item.url)
                            )}
                          >
                            <item.icon className="h-5 w-5" />
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          ))}

        </div>

        {/* Collapsed state trigger */}
        {collapsed && (
          <div className="p-2 border-t border-sidebar-border">
            <SidebarTrigger className="w-full h-10 rounded-md" />
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
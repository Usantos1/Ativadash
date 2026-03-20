import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar, SidebarTrigger } from "@/components/layout/Sidebar";
import { useUIStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);

  return (
    <div className="min-h-screen bg-[#f1f3f6]">
      <Sidebar
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />
      <main
        className={cn(
          "min-h-screen transition-[margin] duration-200",
          "md:ml-[220px]",
          sidebarCollapsed && "md:ml-14"
        )}
      >
        <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-border/50 bg-white/95 px-4 shadow-sm backdrop-blur-sm">
          <SidebarTrigger onOpen={() => setSidebarOpen(true)} />
          <div className="flex-1" />
          {/* Espaço para breadcrumb ou ações do topo */}
        </header>
        <div className="p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

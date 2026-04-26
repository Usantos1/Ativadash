import { ModernLayout } from "@/components/ModernLayout";
import { UserManagementNew } from "@/components/UserManagementNew";
import { RolesManager } from "@/components/RolesManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Shield } from "lucide-react";

export default function AdminUsers() {
  return (
    <ModernLayout
      title="Gestão de Usuários e Funções"
      subtitle="Gerencie usuários, funções e permissões do sistema"
    >
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Funções
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <UserManagementNew />
        </TabsContent>

        <TabsContent value="roles" className="mt-6">
          <RolesManager />
        </TabsContent>
      </Tabs>
    </ModernLayout>
  );
}
import { useState } from "react";
import { ModernLayout } from "@/components/ModernLayout";
import { AdminInterviewsManager } from "@/pages/AdminInterviews";
import { AdminJobSurveysManager } from "@/components/AdminJobSurveysManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Video } from "lucide-react";

export default function RecruitmentManager() {
  const [activeTab, setActiveTab] = useState<string>("surveys");

  return (
    <ModernLayout
      title="Recrutamento e Seleção"
      subtitle="Gerencie formulários de vagas e entrevistas"
    >
      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="surveys" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Formulários de Vaga
            </TabsTrigger>
            <TabsTrigger value="interviews" className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              Entrevistas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="surveys" className="mt-4">
            <AdminJobSurveysManager />
          </TabsContent>

          <TabsContent value="interviews" className="mt-4">
            <AdminInterviewsManager />
          </TabsContent>
        </Tabs>
      </div>
    </ModernLayout>
  );
}

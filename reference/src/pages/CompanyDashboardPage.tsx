import { ModernLayout } from '@/components/ModernLayout';
import { CompanyDashboard } from '@/components/dashboard/CompanyDashboard';

export default function CompanyDashboardPage() {
  return (
    <ModernLayout>
      <div className="p-6">
        <CompanyDashboard />
      </div>
    </ModernLayout>
  );
}


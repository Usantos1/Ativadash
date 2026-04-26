import React from 'react';
import { ModernLayout } from '@/components/ModernLayout';
import { Dashboard } from '@/components/Dashboard';

const DashboardGestao = () => {
  return (
    <ModernLayout title="Dashboard de Gestão" subtitle="Visão geral">
      <div className="space-y-6">
        <Dashboard />
      </div>
    </ModernLayout>
  );
};

export default DashboardGestao;

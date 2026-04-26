import { Routes, Route, Navigate } from 'react-router-dom';
import { FinanceiroLayout } from './financeiro/FinanceiroLayout';
import { FinanceiroDashboard } from './financeiro/FinanceiroDashboard';
import { FinanceiroCaixa } from './financeiro/FinanceiroCaixa';
import { FinanceiroContas } from './financeiro/FinanceiroContas';
import { FinanceiroTransacoes } from './financeiro/FinanceiroTransacoes';
import { FinanceiroRelatorios } from './financeiro/FinanceiroRelatorios';

export default function AdminFinanceiro() {
  return (
    <Routes>
      <Route path="/" element={<FinanceiroLayout />}>
        <Route index element={<FinanceiroDashboard />} />
        <Route path="caixa" element={<FinanceiroCaixa />} />
        <Route path="contas" element={<FinanceiroContas />} />
        <Route path="transacoes" element={<FinanceiroTransacoes />} />
        <Route path="relatorios" element={<FinanceiroRelatorios />} />
        <Route path="*" element={<Navigate to="/admin/financeiro" replace />} />
      </Route>
    </Routes>
  );
}








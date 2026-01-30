import { useState } from 'react';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProfiles } from '@/contexts/ProfileContext';
import { KPICard } from '@/components/dashboard/KPICard';
import { FinancialChart } from '@/components/dashboard/FinancialChart';
import { MonthYearPicker } from '@/components/dashboard/MonthYearPicker';
import { MainLayout } from '@/components/layout/MainLayout';

const months = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

export default function Dashboard() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const { selectedProfile } = useProfiles();

  // Fetch transactions for KPIs
  const { data: kpiData } = useQuery({
    queryKey: ['kpi', selectedProfile?.id, selectedMonth, selectedYear],
    queryFn: async () => {
      if (!selectedProfile) return { income: 0, expense: 0 };

      const startDate = new Date(selectedYear, selectedMonth, 1);
      const endDate = new Date(selectedYear, selectedMonth + 1, 0);

      const { data, error } = await supabase
        .from('transactions')
        .select('type, amount')
        .eq('profile_id', selectedProfile.id)
        .gte('transaction_date', startDate.toISOString().split('T')[0])
        .lte('transaction_date', endDate.toISOString().split('T')[0]);

      if (error) throw error;

      const income = data
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount), 0);
      
      const expense = data
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      return { income, expense };
    },
    enabled: !!selectedProfile,
  });

  // Fetch annual data for chart
  const { data: chartData = [] } = useQuery({
    queryKey: ['chart', selectedProfile?.id, selectedYear],
    queryFn: async () => {
      if (!selectedProfile) return [];

      const startDate = new Date(selectedYear, 0, 1);
      const endDate = new Date(selectedYear, 11, 31);

      const { data, error } = await supabase
        .from('transactions')
        .select('type, amount, transaction_date')
        .eq('profile_id', selectedProfile.id)
        .gte('transaction_date', startDate.toISOString().split('T')[0])
        .lte('transaction_date', endDate.toISOString().split('T')[0]);

      if (error) throw error;

      // Group by month
      const monthlyData = months.map((month, index) => {
        const monthTransactions = data.filter(t => {
          const date = new Date(t.transaction_date);
          return date.getMonth() === index;
        });

        const receitas = monthTransactions
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + Number(t.amount), 0);

        const despesas = monthTransactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + Number(t.amount), 0);

        return { month, receitas, despesas };
      });

      return monthlyData;
    },
    enabled: !!selectedProfile,
  });

  const income = kpiData?.income || 0;
  const expense = kpiData?.expense || 0;
  const balance = income - expense;

  if (!selectedProfile) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
          <Wallet className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-display font-bold text-foreground mb-2">
          Nenhum perfil selecionado
        </h2>
        <p className="text-muted-foreground max-w-md">
          Crie um perfil financeiro em Configurações para começar a gerenciar suas finanças.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Visão geral das finanças de {selectedProfile.name}
          </p>
        </div>
        <MonthYearPicker
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onMonthChange={setSelectedMonth}
          onYearChange={setSelectedYear}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        <KPICard
          title="Total Receitas"
          value={income}
          icon={<TrendingUp className="h-6 w-6" />}
          type="income"
        />
        <KPICard
          title="Total Despesas"
          value={expense}
          icon={<TrendingDown className="h-6 w-6" />}
          type="expense"
        />
        <KPICard
          title="Balanço Líquido"
          value={balance}
          icon={<Wallet className="h-6 w-6" />}
          type="balance"
        />
      </div>

      {/* Chart */}
      <FinancialChart data={chartData} />
    </div>
  );
}

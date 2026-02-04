import { useState } from 'react';
import { Plus, TrendingUp, TrendingDown } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useProfiles } from '@/contexts/ProfileContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TransactionsTable } from '@/components/transactions/TransactionsTable';
import { TransactionDialog } from '@/components/transactions/TransactionDialog';
import { MonthYearPicker } from '@/components/dashboard/MonthYearPicker';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  payment_source: string | null;
  payment_method: 'pix' | 'boleto' | 'credito' | 'debito' | 'dinheiro' | 'transferencia';
  transaction_date: string;
  notes: string | null;
  type: 'income' | 'expense';
}

export default function Transactions() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  
  const { selectedProfile } = useProfiles();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', selectedProfile?.id, selectedMonth, selectedYear, activeTab],
    queryFn: async () => {
      if (!selectedProfile) return [];

      const startDate = new Date(selectedYear, selectedMonth, 1);
      const endDate = new Date(selectedYear, selectedMonth + 1, 0);

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('profile_id', selectedProfile.id)
        .eq('type', activeTab)
        .gte('transaction_date', startDate.toISOString().split('T')[0])
        .lte('transaction_date', endDate.toISOString().split('T')[0])
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!selectedProfile,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!selectedProfile || !user) throw new Error('Perfil ou usuário não encontrado');

      const { error } = await supabase
        .from('transactions')
        .insert({
          profile_id: selectedProfile.id,
          user_id: user.id,
          type: activeTab,
          description: data.description,
          amount: parseFloat(data.amount.replace(',', '.')),
          payment_source: data.payment_source || null,
          payment_method: data.payment_method,
          transaction_date: data.transaction_date.toISOString().split('T')[0],
          notes: data.notes || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['kpi'] });
      queryClient.invalidateQueries({ queryKey: ['chart'] });
      toast.success('Transação criada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao criar transação: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from('transactions')
        .update({
          description: data.description,
          amount: parseFloat(data.amount.replace(',', '.')),
          payment_source: data.payment_source || null,
          payment_method: data.payment_method,
          transaction_date: data.transaction_date.toISOString().split('T')[0],
          notes: data.notes || null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['kpi'] });
      queryClient.invalidateQueries({ queryKey: ['chart'] });
      toast.success('Transação atualizada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar transação: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['kpi'] });
      queryClient.invalidateQueries({ queryKey: ['chart'] });
      toast.success('Transação excluída com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir transação: ' + error.message);
    },
  });

  const handleSubmit = async (data: any) => {
    if (editingTransaction) {
      await updateMutation.mutateAsync({ id: editingTransaction.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setDialogOpen(true);
  };

  const handleOpenNew = () => {
    setEditingTransaction(null);
    setDialogOpen(true);
  };

  if (!selectedProfile) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center animate-fade-in">
        <h2 className="text-2xl font-display font-bold text-foreground mb-2">
          Nenhum perfil selecionado
        </h2>
        <p className="text-muted-foreground">
          Selecione um perfil no menu lateral para ver os lançamentos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground tracking-tight">
            Lançamentos
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie receitas e despesas de {selectedProfile.name}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <MonthYearPicker
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onMonthChange={setSelectedMonth}
            onYearChange={setSelectedYear}
          />
          <Button onClick={handleOpenNew} className="gap-2 press-effect">
            <Plus className="h-4 w-4" />
            Nova Transação
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="animate-slide-up" style={{ animationDelay: '100ms' }}>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'income' | 'expense')}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="expense" className="gap-2 transition-all duration-200">
              <TrendingDown className="h-4 w-4" />
              Despesas
            </TabsTrigger>
            <TabsTrigger value="income" className="gap-2 transition-all duration-200">
              <TrendingUp className="h-4 w-4" />
              Receitas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="expense" className="mt-6 animate-fade-in">
            <TransactionsTable
              transactions={transactions}
              isLoading={isLoading}
              onEdit={handleEdit}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          </TabsContent>

          <TabsContent value="income" className="mt-6 animate-fade-in">
            <TransactionsTable
              transactions={transactions}
              isLoading={isLoading}
              onEdit={handleEdit}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog */}
      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        type={activeTab}
        transaction={editingTransaction}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

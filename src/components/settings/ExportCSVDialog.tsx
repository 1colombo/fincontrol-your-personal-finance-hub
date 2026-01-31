import { useState } from 'react';
import { Download, Loader2, Calendar, FileSpreadsheet } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useProfiles, Profile } from '@/contexts/ProfileContext';
import { transactionsToCSV, downloadCSV, TransactionData } from '@/lib/csv';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

interface ExportCSVDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function ExportCSVDialog({ open, onOpenChange }: ExportCSVDialogProps) {
  const now = new Date();
  const [selectedProfileId, setSelectedProfileId] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>(now.getFullYear().toString());
  const [includeIncome, setIncludeIncome] = useState(true);
  const [includeExpense, setIncludeExpense] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const { profiles, selectedProfile } = useProfiles();

  // Set default profile when dialog opens
  useState(() => {
    if (selectedProfile) {
      setSelectedProfileId(selectedProfile.id);
    }
  });

  const currentYear = now.getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const handleExport = async () => {
    if (!includeIncome && !includeExpense) {
      toast.error('Selecione pelo menos um tipo de transação');
      return;
    }

    setIsExporting(true);

    try {
      let query = supabase
        .from('transactions')
        .select('*')
        .order('transaction_date', { ascending: false });

      // Filter by profile
      if (selectedProfileId !== 'all') {
        query = query.eq('profile_id', selectedProfileId);
      }

      // Filter by date range
      if (selectedMonth !== 'all') {
        const month = parseInt(selectedMonth);
        const year = parseInt(selectedYear);
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0);
        
        query = query
          .gte('transaction_date', startDate.toISOString().split('T')[0])
          .lte('transaction_date', endDate.toISOString().split('T')[0]);
      } else {
        // Filter by year only
        const year = parseInt(selectedYear);
        query = query
          .gte('transaction_date', `${year}-01-01`)
          .lte('transaction_date', `${year}-12-31`);
      }

      // Filter by type
      const types: string[] = [];
      if (includeIncome) types.push('income');
      if (includeExpense) types.push('expense');
      
      if (types.length === 1) {
        query = query.eq('type', types[0] as 'income' | 'expense');
      }

      const { data, error } = await query;

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error('Nenhuma transação encontrada com os filtros selecionados');
        setIsExporting(false);
        return;
      }

      const transactions: TransactionData[] = data.map(t => ({
        id: t.id,
        description: t.description,
        amount: Number(t.amount),
        type: t.type as 'income' | 'expense',
        payment_method: t.payment_method as TransactionData['payment_method'],
        payment_source: t.payment_source,
        transaction_date: t.transaction_date,
        notes: t.notes,
      }));

      const csvContent = transactionsToCSV(transactions);

      // Generate filename
      const profileName = selectedProfileId === 'all' 
        ? 'todos-perfis' 
        : profiles.find(p => p.id === selectedProfileId)?.name.toLowerCase().replace(/\s+/g, '-') || 'perfil';
      
      const dateRange = selectedMonth === 'all' 
        ? selectedYear 
        : `${MONTHS[parseInt(selectedMonth)].toLowerCase()}-${selectedYear}`;
      
      const filename = `fincontrol-${profileName}-${dateRange}.csv`;

      downloadCSV(csvContent, filename);
      toast.success(`${transactions.length} transações exportadas com sucesso!`);
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao exportar transações: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Exportar CSV
          </DialogTitle>
          <DialogDescription>
            Exporte suas transações para um arquivo CSV
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Profile filter */}
          <div className="space-y-2">
            <Label>Perfil</Label>
            <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o perfil" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os perfis</SelectItem>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date filter */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Mês</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {MONTHS.map((month, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Ano</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Transaction type filter */}
          <div className="space-y-3">
            <Label>Tipos de transação</Label>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="income" 
                  checked={includeIncome} 
                  onCheckedChange={(checked) => setIncludeIncome(checked === true)}
                />
                <label htmlFor="income" className="text-sm cursor-pointer">
                  Receitas
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="expense" 
                  checked={includeExpense} 
                  onCheckedChange={(checked) => setIncludeExpense(checked === true)}
                />
                <label htmlFor="expense" className="text-sm cursor-pointer">
                  Despesas
                </label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={isExporting} className="gap-2">
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Exportar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

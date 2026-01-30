import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Edit2, 
  Trash2, 
  CreditCard, 
  Smartphone, 
  FileText, 
  Banknote,
  ArrowRightLeft,
  QrCode
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

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

interface TransactionsTableProps {
  transactions: Transaction[];
  isLoading: boolean;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
}

const paymentMethodIcons = {
  pix: QrCode,
  boleto: FileText,
  credito: CreditCard,
  debito: CreditCard,
  dinheiro: Banknote,
  transferencia: ArrowRightLeft,
};

const paymentMethodLabels = {
  pix: 'Pix',
  boleto: 'Boleto',
  credito: 'Crédito',
  debito: 'Débito',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
};

const sourceColors: Record<string, string> = {
  'Nubank': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'Itaú': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'Bradesco': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'Santander': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'Banco do Brasil': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  'Caixa': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Inter': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'C6 Bank': 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  'PicPay': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'Mercado Pago': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Dinheiro': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

export function TransactionsTable({ 
  transactions, 
  isLoading, 
  onEdit, 
  onDelete 
}: TransactionsTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleConfirmDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-lg font-medium text-foreground">Nenhum lançamento encontrado</p>
        <p className="text-sm text-muted-foreground">Clique em "Nova Transação" para adicionar</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Descrição</TableHead>
              <TableHead className="font-semibold">Valor</TableHead>
              <TableHead className="font-semibold">Pagador/Cartão</TableHead>
              <TableHead className="font-semibold">Forma</TableHead>
              <TableHead className="font-semibold">Data</TableHead>
              <TableHead className="font-semibold">Observação</TableHead>
              <TableHead className="font-semibold w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction) => {
              const MethodIcon = paymentMethodIcons[transaction.payment_method];
              return (
                <TableRow key={transaction.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">{transaction.description}</TableCell>
                  <TableCell>
                    <span className={cn(
                      'font-semibold',
                      transaction.type === 'income' ? 'text-income' : 'text-expense'
                    )}>
                      {transaction.type === 'income' ? '+' : '-'} {formatCurrency(transaction.amount)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {transaction.payment_source && (
                      <Badge 
                        variant="secondary" 
                        className={cn(
                          'font-medium',
                          sourceColors[transaction.payment_source] || 'bg-secondary text-secondary-foreground'
                        )}
                      >
                        {transaction.payment_source}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <MethodIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{paymentMethodLabels[transaction.payment_method]}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(new Date(transaction.transaction_date), 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    {transaction.notes ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help text-muted-foreground truncate max-w-[150px] block">
                            {transaction.notes.slice(0, 30)}{transaction.notes.length > 30 ? '...' : ''}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[300px]">
                          <p>{transaction.notes}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onEdit(transaction)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(transaction.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}

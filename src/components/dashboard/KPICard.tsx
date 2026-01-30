import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: number;
  icon: ReactNode;
  type: 'income' | 'expense' | 'balance';
  trend?: number;
}

export function KPICard({ title, value, icon, type, trend }: KPICardProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const isPositive = value >= 0;
  const trendIcon = trend && trend > 0 
    ? <TrendingUp className="h-4 w-4" />
    : trend && trend < 0 
      ? <TrendingDown className="h-4 w-4" />
      : <Minus className="h-4 w-4" />;

  return (
    <div className="kpi-card animate-fade-in">
      <div className="flex items-start justify-between mb-4">
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center',
          type === 'income' && 'bg-income-muted text-income',
          type === 'expense' && 'bg-expense-muted text-expense',
          type === 'balance' && (isPositive ? 'bg-income-muted text-income' : 'bg-expense-muted text-expense')
        )}>
          {icon}
        </div>
        {trend !== undefined && (
          <div className={cn(
            'flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-full',
            trend > 0 ? 'bg-income-muted text-income' : trend < 0 ? 'bg-expense-muted text-expense' : 'bg-muted text-muted-foreground'
          )}>
            {trendIcon}
            <span>{Math.abs(trend).toFixed(1)}%</span>
          </div>
        )}
      </div>
      
      <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
      <p className={cn(
        'text-2xl lg:text-3xl font-display font-bold tracking-tight',
        type === 'income' && 'text-income',
        type === 'expense' && 'text-expense',
        type === 'balance' && (isPositive ? 'text-income' : 'text-expense')
      )}>
        {formatCurrency(value)}
      </p>
    </div>
  );
}

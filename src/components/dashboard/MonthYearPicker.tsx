import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface MonthYearPickerProps {
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
}

const months = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril',
  'Maio', 'Junho', 'Julho', 'Agosto',
  'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function MonthYearPicker({ 
  selectedMonth, 
  selectedYear, 
  onMonthChange, 
  onYearChange 
}: MonthYearPickerProps) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      onMonthChange(11);
      onYearChange(selectedYear - 1);
    } else {
      onMonthChange(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      onMonthChange(0);
      onYearChange(selectedYear + 1);
    } else {
      onMonthChange(selectedMonth + 1);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={handlePrevMonth}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="min-w-[200px] justify-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="font-medium">
              {months[selectedMonth]} {selectedYear}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4" align="center">
          <div className="space-y-4">
            {/* Year Selector */}
            <div className="flex items-center justify-between gap-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => onYearChange(selectedYear - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-display font-semibold text-lg">{selectedYear}</span>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => onYearChange(selectedYear + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Month Grid */}
            <div className="grid grid-cols-3 gap-2">
              {months.map((month, index) => (
                <Button
                  key={month}
                  variant={selectedMonth === index ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onMonthChange(index)}
                  className={cn(
                    'h-9',
                    selectedMonth === index && 'bg-primary text-primary-foreground'
                  )}
                >
                  {month.slice(0, 3)}
                </Button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      
      <Button variant="outline" size="icon" onClick={handleNextMonth}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

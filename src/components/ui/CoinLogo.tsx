import { cn } from '@/lib/utils';

interface CoinLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20',
};

const innerSizeClasses = {
  sm: 'w-5 h-5',
  md: 'w-6 h-6',
  lg: 'w-9 h-9',
  xl: 'w-14 h-14',
};

const textSizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-xl',
  xl: 'text-3xl',
};

export function CoinLogo({ size = 'md', className }: CoinLogoProps) {
  return (
    <div 
      className={cn(
        'logo-coin',
        sizeClasses[size],
        className
      )}
    >
      <div className={cn(
        'relative flex items-center justify-center rounded-full bg-white/15 backdrop-blur-sm',
        innerSizeClasses[size]
      )}>
        <span className={cn(
          'logo-coin-inner',
          textSizeClasses[size]
        )}>
          $
        </span>
      </div>
    </div>
  );
}

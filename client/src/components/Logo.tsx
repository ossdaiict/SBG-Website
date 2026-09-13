import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { box: 'h-8 w-8 rounded-xl', icon: 18, text: 'text-lg', gap: 'gap-2' },
  md: { box: 'h-9 w-9 rounded-xl', icon: 22, text: 'text-xl', gap: 'gap-2.5' },
  lg: { box: 'h-11 w-11 rounded-2xl', icon: 28, text: 'text-2xl', gap: 'gap-3' },
  xl: { box: 'h-14 w-14 rounded-2xl', icon: 36, text: 'text-4xl', gap: 'gap-3.5' },
};

const pixelMap = {
  sm: 32,
  md: 36,
  lg: 44,
  xl: 56,
};

export function Logo({ size = 'md', showText = true, className }: LogoProps) {
  const { box, text, gap } = sizeMap[size];
  const px = pixelMap[size];

  return (
    <div className={cn('flex items-center', gap, className)}>
      <img
        src="/sbg_logo.webp"
        alt="SBG logo"
        width={px}
        height={px}
        fetchPriority="high"
        decoding="sync"
        className={cn('shrink-0 object-contain rounded-full aspect-square', box)}
      />
      {showText && (
        <span
          className={cn(
            text,
            'font-extrabold tracking-tight select-none text-gradient-logo'
          )}
        >
          SBG
        </span>
      )}
    </div>
  );
}

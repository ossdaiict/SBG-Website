import { cn } from '@/lib/utils';

interface GdgFooterCreditProps {
  className?: string;
  /** Tighter sizing for app shell footer */
  compact?: boolean;
}

/**
 * Footer credit with GDG on Campus logo (`/gdg-logo.png` in `public/`).
 */
export function GdgFooterCredit({ className, compact }: GdgFooterCreditProps) {
  return (
    <p
      className={cn(
        'mx-auto flex max-w-md flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-center font-medium text-textMuted',
        compact ? 'text-[11px] leading-snug' : 'text-xs',
        className
      )}
    >
      <span>
        Made with{' '}
        <span className="text-rose-500 dark:text-rose-400" aria-hidden>
          ♥
        </span>{' '}
        by
      </span>
      <span className="inline-flex items-center gap-2">
        <img
          src="/gdg-logo.webp"
          alt="GDG On Campus DAU Logo"
          width="120"
          height="24"
          aria-hidden="true"
          className={cn(
            'shrink-0 object-contain object-center aspect-[5/1]',
            compact ? 'h-4 w-auto sm:h-5' : 'h-5 w-auto sm:h-6'
          )}
          loading="lazy"
          decoding="async"
        />
        <span className="whitespace-nowrap font-semibold text-textSecondary">
          GDG On Campus DAU
        </span>
      </span>
    </p>
  );
}

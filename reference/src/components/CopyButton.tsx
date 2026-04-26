import { Button, ButtonProps } from '@/components/ui/button';
import { Check, Copy } from 'lucide-react';
import { useClipboard } from '@/hooks/useClipboard';
import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface CopyButtonProps extends Omit<ButtonProps, 'onClick'> {
  text: string;
  label?: string;
  showLabel?: boolean;
  successLabel?: string;
  onCopy?: () => void;
}

export const CopyButton = forwardRef<HTMLButtonElement, CopyButtonProps>(
  (
    {
      text,
      label = 'Copiar',
      showLabel = false,
      successLabel = 'Copiado!',
      onCopy,
      className,
      size = 'icon',
      variant = 'ghost',
      ...props
    },
    ref
  ) => {
    const { copy, copied } = useClipboard();

    const handleCopy = async () => {
      const success = await copy(text);
      if (success) {
        onCopy?.();
      }
    };

    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        className={cn(
          'transition-all',
          copied && 'text-success',
          className
        )}
        onClick={handleCopy}
        aria-label={copied ? successLabel : label}
        {...props}
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" />
            {showLabel && <span className="ml-2">{successLabel}</span>}
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            {showLabel && <span className="ml-2">{label}</span>}
          </>
        )}
      </Button>
    );
  }
);

CopyButton.displayName = 'CopyButton';

/**
 * Componente de texto com botão de copiar
 */
interface CopyTextProps {
  text: string;
  displayText?: string;
  className?: string;
  truncate?: boolean;
  maxLength?: number;
}

export function CopyText({
  text,
  displayText,
  className,
  truncate = false,
  maxLength = 50,
}: CopyTextProps) {
  const display = displayText || text;
  const shouldTruncate = truncate && display.length > maxLength;
  const truncatedText = shouldTruncate
    ? `${display.slice(0, maxLength)}...`
    : display;

  return (
    <div className={cn('flex items-center gap-2 group', className)}>
      <span
        className={cn('font-mono text-sm', truncate && 'truncate')}
        title={shouldTruncate ? display : undefined}
      >
        {truncatedText}
      </span>
      <CopyButton
        text={text}
        size="icon"
        variant="ghost"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </div>
  );
}


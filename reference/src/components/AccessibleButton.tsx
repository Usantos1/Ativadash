import { Button, ButtonProps } from '@/components/ui/button';
import { forwardRef } from 'react';

interface AccessibleButtonProps extends ButtonProps {
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-expanded'?: boolean;
  'aria-controls'?: string;
}

/**
 * Botão com melhorias de acessibilidade
 */
export const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  ({ children, 'aria-label': ariaLabel, ...props }, ref) => {
    // Se não houver aria-label e o children for apenas texto, usar como aria-label
    const finalAriaLabel = ariaLabel || (typeof children === 'string' ? children : undefined);

    return (
      <Button
        ref={ref}
        aria-label={finalAriaLabel}
        {...props}
      >
        {children}
      </Button>
    );
  }
);

AccessibleButton.displayName = 'AccessibleButton';










import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number;
  onChange: (value: number) => void;
  showCurrency?: boolean;
  className?: string;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, showCurrency = false, className, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState<string>('');
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Função para formatar número com separadores de milhar
    const formatCurrency = (num: number): string => {
      if (num === 0 || isNaN(num)) return '0,00';
      
      const parts = num.toFixed(2).split('.');
      const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return `${integerPart},${parts[1]}`;
    };

    // Função para parsear string formatada para número
    const parseCurrency = (str: string): number => {
      // Remover tudo exceto números e vírgula
      let cleaned = str.replace(/[^\d,]/g, '');
      
      // Garantir apenas uma vírgula
      const parts = cleaned.split(',');
      if (parts.length > 2) {
        cleaned = parts[0] + ',' + parts.slice(1).join('');
      }
      
      // Limitar a 2 casas decimais
      if (parts.length === 2 && parts[1].length > 2) {
        cleaned = parts[0] + ',' + parts[1].substring(0, 2);
      }
      
      // Remover pontos (separadores de milhar) e substituir vírgula por ponto
      const numericStr = cleaned.replace(/\./g, '').replace(',', '.');
      return parseFloat(numericStr) || 0;
    };

    React.useEffect(() => {
      // Formatar valor inicial
      if (value !== undefined && value !== null && !isNaN(value)) {
        const formatted = formatCurrency(value);
        setDisplayValue(formatted);
      } else {
        setDisplayValue('');
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let inputValue = e.target.value;
      
      // Se estiver vazio, permitir vazio temporariamente
      if (inputValue === '') {
        setDisplayValue('');
        onChange(0);
        return;
      }
      
      // Remover tudo exceto números (não permitir vírgula durante digitação)
      const numbersOnly = inputValue.replace(/[^\d]/g, '');
      
      if (numbersOnly === '') {
        setDisplayValue('');
        onChange(0);
        return;
      }
      
      // Converter para número (dividir por 100 para ter centavos)
      const numericValue = parseFloat(numbersOnly) / 100;
      
      // Formatar com separadores de milhar durante a digitação
      const formatted = formatCurrency(numericValue);
      setDisplayValue(formatted);
      
      onChange(numericValue);
    };

    const handleBlur = () => {
      // Reformatar ao perder foco com separadores de milhar
      if (value !== undefined && value !== null && !isNaN(value)) {
        const formatted = formatCurrency(value);
        setDisplayValue(formatted);
      } else {
        setDisplayValue('');
      }
    };

    return (
      <div className={cn("relative", className)}>
        {showCurrency && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
            R$
          </span>
        )}
        <Input
          ref={(node) => {
            if (ref) {
              if (typeof ref === 'function') {
                ref(node);
              } else {
                ref.current = node;
              }
            }
            inputRef.current = node;
          }}
          type="text"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="0,00"
          className={cn(showCurrency && "pl-8", className)}
          {...props}
        />
      </div>
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";

import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  variant?: 'button' | 'dropdown';
  size?: 'sm' | 'default' | 'lg';
  showLabel?: boolean;
}

export const ThemeToggle = ({ 
  variant = 'button', 
  size = 'sm',
  showLabel = false 
}: ThemeToggleProps) => {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const getThemeLabel = () => {
    switch (theme) {
      case 'light': return 'Claro';
      case 'dark': return 'Escuro';
      case 'system': return 'Sistema';
      default: return 'Tema';
    }
  };

  if (variant === 'dropdown') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size={size} className="gap-2">
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            {showLabel && <span className="text-sm">{getThemeLabel()}</span>}
            <span className="sr-only">Alternar tema</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem 
            onClick={() => setTheme("light")}
            className={cn(theme === 'light' && 'bg-accent')}
          >
            <Sun className="mr-2 h-4 w-4" />
            <span>Claro</span>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setTheme("dark")}
            className={cn(theme === 'dark' && 'bg-accent')}
          >
            <Moon className="mr-2 h-4 w-4" />
            <span>Escuro</span>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setTheme("system")}
            className={cn(theme === 'system' && 'bg-accent')}
          >
            <Monitor className="mr-2 h-4 w-4" />
            <span>Sistema</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Modo botão simples com ciclo: light -> dark -> system -> light
  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={cycleTheme}
      className="relative"
      aria-label={`Tema atual: ${getThemeLabel()}. Clique para alternar.`}
    >
      <Sun className={cn(
        "h-4 w-4 transition-all",
        resolvedTheme === 'dark' ? "rotate-90 scale-0" : "rotate-0 scale-100"
      )} />
      <Moon className={cn(
        "absolute h-4 w-4 transition-all",
        resolvedTheme === 'dark' ? "rotate-0 scale-100" : "-rotate-90 scale-0"
      )} />
      {showLabel && <span className="ml-2 text-sm">{getThemeLabel()}</span>}
      <span className="sr-only">Alternar tema</span>
    </Button>
  );
};
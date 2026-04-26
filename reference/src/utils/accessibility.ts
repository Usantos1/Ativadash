/**
 * Utilitários de acessibilidade
 */

/**
 * Gera ID único para elementos
 */
let idCounter = 0;
export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${++idCounter}-${Date.now()}`;
}

/**
 * Verifica se o usuário prefere movimento reduzido
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Foca em elemento de forma acessível
 */
export function focusElement(element: HTMLElement | null, options?: FocusOptions) {
  if (!element) return;
  
  // Verificar se o elemento pode receber foco
  if (element.tabIndex === -1 && !element.hasAttribute('tabindex')) {
    element.setAttribute('tabindex', '-1');
  }
  
  element.focus(options);
  
  // Scroll suave apenas se o usuário não preferir movimento reduzido
  if (!prefersReducedMotion()) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/**
 * Anuncia mudanças para leitores de tela
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  // Remover após um tempo
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Verifica se está navegando por teclado
 */
let isKeyboardNavigation = false;

document.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    isKeyboardNavigation = true;
  }
});

document.addEventListener('mousedown', () => {
  isKeyboardNavigation = false;
});

export function isUsingKeyboard(): boolean {
  return isKeyboardNavigation;
}

/**
 * Trap de foco para modais
 */
export function createFocusTrap(container: HTMLElement): () => void {
  const focusableElements = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  const handleTab = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    
    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  };
  
  container.addEventListener('keydown', handleTab);
  firstElement?.focus();
  
  return () => {
    container.removeEventListener('keydown', handleTab);
  };
}










// ============================================
// UTILITÁRIOS DE IMPRESSÃO
// ============================================

import { from } from '@/integrations/db/client';

/**
 * Atualiza campos de impressão no banco de dados após impressão.
 * Usa apenas print_status e printed_at para funcionar mesmo sem a coluna print_attempts
 * (opcional; rode ADD_SALES_PRINT_FIELDS_MIGRATION.sql e ADD_OS_PRINT_FIELDS_MIGRATION.sql para ter print_attempts).
 */
export async function updatePrintStatus(
  table: 'sales' | 'ordens_servico',
  recordId: string,
  success: boolean
): Promise<void> {
  try {
    const printStatus = success ? 'SUCCESS' : 'ERROR';
    const now = new Date().toISOString();
    const payload: Record<string, unknown> = {
      print_status: printStatus,
      ...(success ? { printed_at: now } : {}),
    };

    if (table === 'sales') {
      await from('sales')
        .update(payload)
        .eq('id', recordId);
    } else if (table === 'ordens_servico') {
      await from('ordens_servico')
        .update(payload)
        .eq('id', recordId);
    }
  } catch (error) {
    console.warn(`Status de impressão não atualizado (tabela pode não ter print_status/printed_at):`, error);
    // Não falhar o fluxo de impressão se a atualização falhar
  }
}

/**
 * Imprime HTML usando iframe (sem abrir nova janela)
 */
export function printViaIframe(html: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      document.body.appendChild(printFrame);

      const printDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
      if (!printDoc) {
        reject(new Error('Não foi possível acessar o documento do iframe'));
        return;
      }

      printDoc.open();
      printDoc.write(html);
      printDoc.close();

      // Aguardar carregamento e imprimir
      setTimeout(() => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
          console.log('[IMPRESSÃO] Comando de impressão enviado via iframe');

          // Remover iframe após impressão
          setTimeout(() => {
            try {
              if (printFrame.parentNode) {
                document.body.removeChild(printFrame);
              }
            } catch (e) {
              console.error('Erro ao remover iframe:', e);
            }
            resolve();
          }, 2000);
        } catch (e) {
          console.error('Erro ao imprimir:', e);
          // Remover iframe mesmo em caso de erro
          try {
            if (printFrame.parentNode) {
              document.body.removeChild(printFrame);
            }
          } catch (removeError) {
            console.error('Erro ao remover iframe após erro:', removeError);
          }
          reject(e);
        }
      }, 1000); // Delay para garantir que HTML está totalmente carregado
    } catch (error) {
      reject(error);
    }
  });
}

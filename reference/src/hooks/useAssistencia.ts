import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  OrdemServico, Cliente, Produto, Marca, Modelo, ItemOS, PagamentoOS,
  ConfiguracaoStatus, StatusOS, AcaoStatusOS, STATUS_OS_PADRAO, STATUS_OS_LABELS
} from '@/types/assistencia';
import { from } from '@/integrations/db/client';
import { useAuth } from '@/contexts/AuthContext';
import { authAPI } from '@/integrations/auth/api-client';

// ==================== STORAGE KEYS ====================
const STORAGE_KEYS = {
  ORDENS: 'assistencia_ordens',
  CLIENTES: 'assistencia_clientes',
  PRODUTOS: 'assistencia_produtos',
  MARCAS: 'assistencia_marcas',
  MODELOS: 'assistencia_modelos',
  ITENS_OS: 'assistencia_itens_os',
  PAGAMENTOS: 'assistencia_pagamentos',
  CONFIG_STATUS: 'assistencia_config_status',
  CONTADOR_OS: 'assistencia_contador_os',
};

// ==================== MARCAS E MODELOS PADRÃO ====================
export const MARCAS_MODELOS_PADRAO = [
  {
    marca: 'Apple',
    modelos: [
      // iPhone 15
      'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15 Plus', 'iPhone 15',
      // iPhone 14
      'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14 Plus', 'iPhone 14',
      // iPhone 13
      'iPhone 13 Pro Max', 'iPhone 13 Pro', 'iPhone 13', 'iPhone 13 Mini',
      // iPhone 12
      'iPhone 12 Pro Max', 'iPhone 12 Pro', 'iPhone 12', 'iPhone 12 Mini',
      // iPhone 11
      'iPhone 11 Pro Max', 'iPhone 11 Pro', 'iPhone 11',
      // iPhone X
      'iPhone XS Max', 'iPhone XS', 'iPhone XR', 'iPhone X',
      // iPhone 8
      'iPhone 8 Plus', 'iPhone 8',
      // iPhone 7
      'iPhone 7 Plus', 'iPhone 7',
      // iPhone 6
      'iPhone 6s Plus', 'iPhone 6s', 'iPhone 6 Plus', 'iPhone 6',
      // iPhone SE
      'iPhone SE 3ª Geração', 'iPhone SE 2ª Geração', 'iPhone SE',
      // iPhone 5
      'iPhone 5s', 'iPhone 5c', 'iPhone 5',
    ],
  },
  {
    marca: 'Samsung',
    modelos: [
      // Galaxy S - Série Flagship
      'Galaxy S24 Ultra', 'Galaxy S24+', 'Galaxy S24', 'Galaxy S24 FE',
      'Galaxy S23 Ultra', 'Galaxy S23+', 'Galaxy S23', 'Galaxy S23 FE',
      'Galaxy S22 Ultra', 'Galaxy S22+', 'Galaxy S22', 'Galaxy S22 FE',
      'Galaxy S21 Ultra', 'Galaxy S21+', 'Galaxy S21', 'Galaxy S21 FE',
      'Galaxy S20 Ultra', 'Galaxy S20+', 'Galaxy S20', 'Galaxy S20 FE',
      'Galaxy S10+', 'Galaxy S10', 'Galaxy S10e', 'Galaxy S10 Lite',
      'Galaxy S9+', 'Galaxy S9', 'Galaxy S8+', 'Galaxy S8',
      'Galaxy S7 Edge', 'Galaxy S7', 'Galaxy S6 Edge+', 'Galaxy S6 Edge', 'Galaxy S6',
      // Galaxy Note
      'Galaxy Note 20 Ultra', 'Galaxy Note 20', 'Galaxy Note 10+', 'Galaxy Note 10',
      'Galaxy Note 9', 'Galaxy Note 8', 'Galaxy Note 7', 'Galaxy Note 5',
      // Galaxy Z - Dobráveis
      'Galaxy Z Fold 5', 'Galaxy Z Fold 4', 'Galaxy Z Fold 3', 'Galaxy Z Fold 2',
      'Galaxy Z Flip 5', 'Galaxy Z Flip 4', 'Galaxy Z Flip 3', 'Galaxy Z Flip',
      // Galaxy A - Série Intermediária
      'Galaxy A54', 'Galaxy A53', 'Galaxy A52', 'Galaxy A51',
      'Galaxy A34', 'Galaxy A33', 'Galaxy A32', 'Galaxy A31',
      'Galaxy A24', 'Galaxy A23', 'Galaxy A22', 'Galaxy A21',
      'Galaxy A14', 'Galaxy A13', 'Galaxy A12', 'Galaxy A11',
      'Galaxy A04', 'Galaxy A03', 'Galaxy A02', 'Galaxy A01',
      // Galaxy M
      'Galaxy M54', 'Galaxy M53', 'Galaxy M52', 'Galaxy M51',
      'Galaxy M34', 'Galaxy M33', 'Galaxy M32', 'Galaxy M31',
      'Galaxy M23', 'Galaxy M22', 'Galaxy M21', 'Galaxy M12',
      // Galaxy J (antiga linha)
      'Galaxy J7', 'Galaxy J6', 'Galaxy J5', 'Galaxy J4', 'Galaxy J3', 'Galaxy J2',
      'Galaxy J7 Prime', 'Galaxy J6 Prime', 'Galaxy J5 Prime',
    ],
  },
  {
    marca: 'Motorola',
    modelos: [
      // Edge
      'Edge 40 Pro', 'Edge 40', 'Edge 30 Ultra', 'Edge 30 Pro', 'Edge 30', 'Edge 20',
      // Moto G - Série Popular
      'Moto G84', 'Moto G73', 'Moto G72', 'Moto G71', 'Moto G70',
      'Moto G64', 'Moto G63', 'Moto G62', 'Moto G61', 'Moto G60',
      'Moto G54', 'Moto G53', 'Moto G52', 'Moto G51', 'Moto G50',
      'Moto G44', 'Moto G43', 'Moto G42', 'Moto G41', 'Moto G40',
      'Moto G34', 'Moto G33', 'Moto G32', 'Moto G31', 'Moto G30',
      'Moto G24', 'Moto G23', 'Moto G22', 'Moto G21', 'Moto G20',
      'Moto G14', 'Moto G13', 'Moto G12', 'Moto G11', 'Moto G10',
      'Moto G9 Plus', 'Moto G9', 'Moto G8 Plus', 'Moto G8', 'Moto G7 Plus', 'Moto G7',
      'Moto G6 Plus', 'Moto G6', 'Moto G5 Plus', 'Moto G5', 'Moto G4 Plus', 'Moto G4',
      // Moto E
      'Moto E40', 'Moto E32', 'Moto E31', 'Moto E30', 'Moto E22', 'Moto E20',
      'Moto E7 Plus', 'Moto E7', 'Moto E6 Plus', 'Moto E6', 'Moto E5 Plus', 'Moto E5',
      // Razr
      'Razr 40 Ultra', 'Razr 40', 'Razr 5G', 'Razr 2019',
      // Moto X
      'Moto X4', 'Moto X3', 'Moto X2', 'Moto X',
      // Moto Z
      'Moto Z4', 'Moto Z3', 'Moto Z2', 'Moto Z',
    ],
  },
  {
    marca: 'Xiaomi',
    modelos: [
      // Mi Series
      'Xiaomi 14 Ultra', 'Xiaomi 14 Pro', 'Xiaomi 14',
      'Xiaomi 13 Ultra', 'Xiaomi 13 Pro', 'Xiaomi 13', 'Xiaomi 13 Lite',
      'Xiaomi 12 Pro', 'Xiaomi 12', 'Xiaomi 12 Lite', 'Xiaomi 12T',
      'Xiaomi 11 Pro', 'Xiaomi 11', 'Xiaomi 11 Lite',
      'Xiaomi Mi 10 Pro', 'Xiaomi Mi 10', 'Xiaomi Mi 10 Lite',
      'Xiaomi Mi 9 Pro', 'Xiaomi Mi 9', 'Xiaomi Mi 9 Lite',
      // Redmi Note
      'Redmi Note 13 Pro+', 'Redmi Note 13 Pro', 'Redmi Note 13', 'Redmi Note 13 5G',
      'Redmi Note 12 Pro+', 'Redmi Note 12 Pro', 'Redmi Note 12', 'Redmi Note 12 5G',
      'Redmi Note 11 Pro+', 'Redmi Note 11 Pro', 'Redmi Note 11', 'Redmi Note 11S',
      'Redmi Note 10 Pro', 'Redmi Note 10', 'Redmi Note 10S', 'Redmi Note 10 5G',
      'Redmi Note 9 Pro', 'Redmi Note 9', 'Redmi Note 9S',
      'Redmi Note 8 Pro', 'Redmi Note 8', 'Redmi Note 8T',
      'Redmi Note 7', 'Redmi Note 6 Pro', 'Redmi Note 5',
      // Redmi
      'Redmi 13C', 'Redmi 12C', 'Redmi 11', 'Redmi 10', 'Redmi 9',
      'Redmi 8', 'Redmi 7', 'Redmi 6', 'Redmi 5', 'Redmi 4',
      // POCO
      'POCO X6 Pro', 'POCO X6', 'POCO X5 Pro', 'POCO X5', 'POCO X4 Pro', 'POCO X4',
      'POCO X3 Pro', 'POCO X3', 'POCO X2', 'POCO X',
      'POCO F5 Pro', 'POCO F5', 'POCO F4', 'POCO F3', 'POCO F2 Pro', 'POCO F1',
      'POCO M5', 'POCO M4', 'POCO M3', 'POCO M2', 'POCO M',
      'POCO C55', 'POCO C51', 'POCO C50', 'POCO C40',
    ],
  },
  {
    marca: 'LG',
    modelos: [
      'LG G8', 'LG G7', 'LG G6', 'LG G5', 'LG G4', 'LG G3', 'LG G2',
      'LG V60', 'LG V50', 'LG V40', 'LG V30', 'LG V20', 'LG V10',
      'LG K62', 'LG K52', 'LG K42', 'LG K32', 'LG K22',
      'LG Q92', 'LG Q70', 'LG Q60', 'LG Q7', 'LG Q6',
      'LG Stylo 6', 'LG Stylo 5', 'LG Stylo 4', 'LG Stylo 3',
      'LG Velvet', 'LG Wing', 'LG W10', 'LG W30',
    ],
  },
  {
    marca: 'Realme',
    modelos: [
      'Realme 11 Pro+', 'Realme 11 Pro', 'Realme 11', 'Realme 11 5G',
      'Realme 10 Pro+', 'Realme 10 Pro', 'Realme 10', 'Realme 10 5G',
      'Realme 9 Pro+', 'Realme 9 Pro', 'Realme 9', 'Realme 9 5G',
      'Realme 8 Pro', 'Realme 8', 'Realme 8 5G',
      'Realme 7 Pro', 'Realme 7', 'Realme 7 5G',
      'Realme C55', 'Realme C53', 'Realme C51', 'Realme C35', 'Realme C33',
      'Realme GT 5 Pro', 'Realme GT 5', 'Realme GT 3', 'Realme GT 2',
      'Realme Narzo 70 Pro', 'Realme Narzo 60 Pro', 'Realme Narzo 50',
    ],
  },
  {
    marca: 'OnePlus',
    modelos: [
      'OnePlus 12', 'OnePlus 11', 'OnePlus 11R', 'OnePlus 10 Pro', 'OnePlus 10T',
      'OnePlus 9 Pro', 'OnePlus 9', 'OnePlus 9RT', 'OnePlus 9R',
      'OnePlus 8 Pro', 'OnePlus 8', 'OnePlus 8T',
      'OnePlus 7 Pro', 'OnePlus 7', 'OnePlus 7T Pro', 'OnePlus 7T',
      'OnePlus 6T', 'OnePlus 6', 'OnePlus 5T', 'OnePlus 5',
      'OnePlus Nord 3', 'OnePlus Nord 2', 'OnePlus Nord', 'OnePlus Nord CE',
    ],
  },
  {
    marca: 'Asus',
    modelos: [
      'Zenfone 10', 'Zenfone 9', 'Zenfone 8', 'Zenfone 7 Pro', 'Zenfone 7',
      'Zenfone 6', 'Zenfone 5Z', 'Zenfone 5', 'Zenfone 4', 'Zenfone 3',
      'ROG Phone 7', 'ROG Phone 6', 'ROG Phone 5', 'ROG Phone 3',
    ],
  },
  {
    marca: 'Nokia',
    modelos: [
      'Nokia G60', 'Nokia G50', 'Nokia G42', 'Nokia G21', 'Nokia G11',
      'Nokia X30', 'Nokia X20', 'Nokia X10', 'Nokia XR20',
      'Nokia 8.3', 'Nokia 7.2', 'Nokia 6.2', 'Nokia 5.3', 'Nokia 4.2',
      'Nokia 3.4', 'Nokia 2.4', 'Nokia 1.4',
    ],
  },
  {
    marca: 'TCL',
    modelos: [
      'TCL 40 XE', 'TCL 40 SE', 'TCL 30 SE', 'TCL 30 XE', 'TCL 30 5G',
      'TCL 20 Pro', 'TCL 20 SE', 'TCL 20L', 'TCL 20 5G',
      'TCL 10 Pro', 'TCL 10L', 'TCL 10 SE',
    ],
  },
  {
    marca: 'Alcatel',
    modelos: [
      'Alcatel 3X', 'Alcatel 3L', 'Alcatel 3', 'Alcatel 1X', 'Alcatel 1S',
      'Alcatel 5V', 'Alcatel 5', 'Alcatel 3V', 'Alcatel 3C',
      'Alcatel Pixi 4', 'Alcatel Pixi 3', 'Alcatel One Touch',
    ],
  },
  {
    marca: 'Positivo',
    modelos: [
      'Positivo Twist 4', 'Positivo Twist 3', 'Positivo Twist 2',
      'Positivo BGH', 'Positivo S380', 'Positivo S350',
      'Positivo S240', 'Positivo S200', 'Positivo S180',
    ],
  },
  {
    marca: 'Multilaser',
    modelos: [
      'Multilaser M7', 'Multilaser M6', 'Multilaser M5', 'Multilaser M4',
      'Multilaser M3', 'Multilaser M2', 'Multilaser M1',
      'Multilaser E Pro', 'Multilaser E', 'Multilaser F',
    ],
  },
  {
    marca: 'Oppo',
    modelos: [
      'Oppo Find X6 Pro', 'Oppo Find X5 Pro', 'Oppo Find X3 Pro', 'Oppo Find X2',
      'Oppo Reno 11 Pro', 'Oppo Reno 10 Pro', 'Oppo Reno 9 Pro', 'Oppo Reno 8 Pro',
      'Oppo A98', 'Oppo A78', 'Oppo A58', 'Oppo A38', 'Oppo A18',
      'Oppo A17', 'Oppo A16', 'Oppo A15', 'Oppo A12', 'Oppo A11',
    ],
  },
  {
    marca: 'Vivo',
    modelos: [
      'Vivo X100 Pro', 'Vivo X90 Pro', 'Vivo X80 Pro', 'Vivo X70 Pro',
      'Vivo V30 Pro', 'Vivo V29', 'Vivo V27', 'Vivo V25', 'Vivo V23',
      'Vivo Y100', 'Vivo Y78', 'Vivo Y56', 'Vivo Y35', 'Vivo Y22',
      'Vivo Y17', 'Vivo Y15', 'Vivo Y12', 'Vivo Y11', 'Vivo Y10',
    ],
  },
  {
    marca: 'Honor',
    modelos: [
      'Honor Magic 6 Pro', 'Honor Magic 5 Pro', 'Honor Magic 4 Pro',
      'Honor 90 Pro', 'Honor 80 Pro', 'Honor 70 Pro',
      'Honor X50', 'Honor X40', 'Honor X30', 'Honor X20',
      'Honor 50', 'Honor 40', 'Honor 30', 'Honor 20',
    ],
  },
];

// ==================== HELPERS ====================
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Log para debug de produtos
      if (key === STORAGE_KEYS.PRODUTOS) {
        console.log(`[PRODUTOS] Carregados ${Array.isArray(parsed) ? parsed.length : 0} produtos do localStorage`);
      }
      return parsed;
    }
    // Log quando não há dados salvos
    if (key === STORAGE_KEYS.PRODUTOS) {
      console.warn(`[PRODUTOS] Nenhum produto encontrado no localStorage, usando valor padrão`);
    }
    return defaultValue;
  } catch (error) {
    console.error(`[STORAGE] Erro ao carregar ${key}:`, error);
    // Log específico para produtos
    if (key === STORAGE_KEYS.PRODUTOS) {
      console.error(`[PRODUTOS] Erro ao parsear produtos do localStorage, usando valor padrão`);
    }
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, data: T): void {
  try {
    // Proteção especial para produtos - fazer backup antes de salvar
    if (key === STORAGE_KEYS.PRODUTOS && Array.isArray(data)) {
      const current = localStorage.getItem(key);
      
      // PROTEÇÃO CRÍTICA: Não permitir salvar array vazio se já existir dados
      if ((data as any[]).length === 0 && current) {
        try {
          const currentData = JSON.parse(current);
          if (Array.isArray(currentData) && currentData.length > 0) {
            console.error(`[PRODUTOS] 🚨 BLOQUEADO: Tentativa de salvar array vazio quando existem ${currentData.length} produtos salvos!`);
            // Criar backup de emergência
            const emergencyBackup = `${key}_emergency_${Date.now()}`;
            localStorage.setItem(emergencyBackup, current);
            console.error(`[PRODUTOS] Backup de emergência criado: ${emergencyBackup}`);
            // NÃO SALVAR - retornar sem fazer nada
            return;
          }
        } catch (e) {
          console.error('[PRODUTOS] Erro ao verificar dados atuais:', e);
        }
      }
      
      if (current) {
        try {
          const currentData = JSON.parse(current);
          // Sempre fazer backup antes de salvar (não só quando reduz)
          if (Array.isArray(currentData) && currentData.length > 0) {
            const backupKey = `${key}_backup_${Date.now()}`;
            localStorage.setItem(backupKey, current);
            console.log(`[PRODUTOS] Backup automático criado: ${backupKey} (${currentData.length} produtos)`);
            // Manter apenas os últimos 10 backups (aumentado de 5 para 10)
            const backupKeys = Object.keys(localStorage)
              .filter(k => k.startsWith(`${key}_backup_`))
              .sort()
              .reverse()
              .slice(10);
            backupKeys.forEach(k => localStorage.removeItem(k));
          }
        } catch (e) {
          console.error('[PRODUTOS] Erro ao criar backup:', e);
        }
      }
      console.log(`[PRODUTOS] ✅ Salvando ${(data as any[]).length} produtos no localStorage`);
    }
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`[STORAGE] Erro ao salvar ${key}:`, error);
    // Se for erro de quota, tentar limpar backups antigos
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('[STORAGE] Quota excedida, limpando backups antigos...');
      const backupKeys = Object.keys(localStorage)
        .filter(k => k.includes('_backup_'))
        .sort()
        .slice(0, -3); // Manter apenas os 3 mais recentes
      backupKeys.forEach(k => localStorage.removeItem(k));
      // Tentar salvar novamente
      try {
        localStorage.setItem(key, JSON.stringify(data));
        console.log(`[STORAGE] Salvamento bem-sucedido após limpeza de backups`);
      } catch (retryError) {
        console.error(`[STORAGE] Erro ao salvar após limpeza:`, retryError);
      }
    }
  }
}

// ==================== BUSCAR CEP ====================
export async function buscarCEP(cep: string): Promise<{
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
} | null> {
  try {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return null;
    
    const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    const data = await response.json();
    
    if (data.erro) return null;
    
    return {
      logradouro: data.logradouro || '',
      bairro: data.bairro || '',
      cidade: data.localidade || '',
      uf: data.uf || '',
    };
  } catch {
    return null;
  }
}

// ==================== HOOK: ORDENS DE SERVIÇO ====================
export function useOrdensServico() {
  const [ordens, setOrdens] = useState<OrdemServico[]>(() => 
    loadFromStorage(STORAGE_KEYS.ORDENS, [])
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.ORDENS, ordens);
  }, [ordens]);

  const getNextNumero = useCallback((): number => {
    const contador = loadFromStorage(STORAGE_KEYS.CONTADOR_OS, 0) + 1;
    saveToStorage(STORAGE_KEYS.CONTADOR_OS, contador);
    return contador;
  }, []);

  const createOS = useCallback((data: Partial<OrdemServico>): OrdemServico => {
    const now = new Date();
    const novaOS: OrdemServico = {
      id: generateId(),
      numero: getNextNumero(),
      situacao: 'aberta',
      status: 'aberta',
      data_entrada: now.toISOString().split('T')[0],
      hora_entrada: now.toTimeString().slice(0, 5),
      cliente_id: data.cliente_id || '',
      cliente_nome: data.cliente_nome,
      cliente_empresa: data.cliente_empresa,
      telefone_contato: data.telefone_contato || '',
      tipo_aparelho: data.tipo_aparelho || 'Celular',
      marca_id: data.marca_id,
      marca_nome: data.marca_nome,
      modelo_id: data.modelo_id,
      modelo_nome: data.modelo_nome,
      imei: data.imei,
      numero_serie: data.numero_serie,
      cor: data.cor,
      senha_aparelho: data.senha_aparelho,
      senha_numerica: data.senha_numerica,
      padrao_desbloqueio: data.padrao_desbloqueio,
      possui_senha: data.possui_senha || false,
      deixou_aparelho: data.deixou_aparelho ?? true,
      apenas_agendamento: data.apenas_agendamento || false,
      descricao_problema: data.descricao_problema || '',
      problema_constatado: data.problema_constatado,
      descricao_servico: data.descricao_servico,
      checklist_entrada: data.checklist_entrada || [],
      checklist_saida: [],
      areas_defeito: data.areas_defeito || [],
      observacoes_checklist: data.observacoes_checklist,
      condicoes_equipamento: data.condicoes_equipamento,
      observacoes: data.observacoes,
      observacoes_internas: data.observacoes_internas,
      previsao_entrega: data.previsao_entrega,
      hora_previsao: data.hora_previsao,
      orcamento_parcelado: data.orcamento_parcelado,
      orcamento_desconto: data.orcamento_desconto,
      orcamento_autorizado: data.orcamento_autorizado || false,
      tecnico_id: data.tecnico_id,
      tecnico_nome: data.tecnico_nome,
      servico_executado: data.servico_executado,
      subtotal: 0,
      desconto: 0,
      valor_total: 0,
      created_at: now.toISOString(),
    };
    
    setOrdens(prev => [novaOS, ...prev]);
    return novaOS;
  }, [getNextNumero]);

  const updateOS = useCallback((id: string, data: Partial<OrdemServico>) => {
    setOrdens(prev => prev.map(os => 
      os.id === id ? { ...os, ...data, updated_at: new Date().toISOString() } : os
    ));
  }, []);

  const deleteOS = useCallback((id: string) => {
    setOrdens(prev => prev.filter(os => os.id !== id));
  }, []);

  const getOSById = useCallback((id: string): OrdemServico | undefined => {
    return ordens.find(os => os.id === id);
  }, [ordens]);

  const updateStatus = useCallback(async (id: string, status: StatusOS | string, notificar?: boolean) => {
    const updates: Partial<OrdemServico> = { status: status as StatusOS };

    try {
      const { data: configRows } = await from('os_config_status').select('acao').eq('status', status).limit(1).execute();
      const config = configRows?.[0];
      if (config?.acao === 'fechar_os') {
        updates.situacao = 'fechada';
        updates.data_entrega = new Date().toISOString();
      } else if (config?.acao === 'cancelar_os') {
        updates.situacao = 'cancelada';
      }
    } catch (_) { /* ignora */ }

    if (!updates.situacao && ['entregue', 'entregue_faturada', 'entregue_sem_reparo'].includes(status as string)) {
      updates.situacao = 'fechada';
      updates.data_entrega = new Date().toISOString();
    }
    if (!updates.situacao && status === 'cancelada') {
      updates.situacao = 'cancelada';
    }
    if (status === 'finalizada') {
      updates.data_conclusao = new Date().toISOString();
    }

    updateOS(id, updates);
    
    if (notificar) {
      const statusLabel = status in STATUS_OS_LABELS 
        ? STATUS_OS_LABELS[status as StatusOS] 
        : status;
      console.log(`Notificando cliente sobre status: ${statusLabel}`);
    }
  }, [updateOS]);

  const getEstatisticas = useCallback(() => {
    const hoje = new Date().toISOString().split('T')[0];
    
    // Status que são considerados "aguardando"
    const aguardandoStatuses = [
      'aguardando_orcamento',
      'aguardando_peca',
      'aguardando_aprovacao',
      'aguardando_cliente'
    ];
    
    return {
      total: ordens.length,
      abertas: ordens.filter(o => o.status === 'aberta').length,
      emAndamento: ordens.filter(o => ['em_andamento', 'aprovado'].includes(o.status)).length,
      aguardando: ordens.filter(o => aguardandoStatuses.includes(o.status)).length,
      aguardandoPeca: ordens.filter(o => o.status === 'aguardando_peca').length,
      finalizadas: ordens.filter(o => o.status === 'finalizada').length,
      aguardandoRetirada: ordens.filter(o => o.status === 'aguardando_retirada').length,
      entregues: ordens.filter(o => o.status === 'entregue').length,
      canceladas: ordens.filter(o => o.status === 'cancelada').length,
      hoje: ordens.filter(o => o.data_entrada === hoje).length,
      prazoHoje: ordens.filter(o => o.previsao_entrega === hoje && !['entregue', 'cancelada'].includes(o.status)).length,
      emAtraso: ordens.filter(o => 
        o.previsao_entrega && 
        o.previsao_entrega < hoje && 
        !['entregue', 'cancelada'].includes(o.status)
      ).length,
    };
  }, [ordens]);

  return {
    ordens,
    isLoading,
    createOS,
    updateOS,
    deleteOS,
    getOSById,
    updateStatus,
    getEstatisticas,
  };
}

// ==================== HOOK: CLIENTES ====================
export function useClientes() {
  const [clientes, setClientes] = useState<Cliente[]>(() => 
    loadFromStorage(STORAGE_KEYS.CLIENTES, [])
  );

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.CLIENTES, clientes);
  }, [clientes]);

  const createCliente = useCallback((data: Partial<Cliente>): Cliente => {
    const novoCliente: Cliente = {
      id: generateId(),
      tipo_pessoa: data.tipo_pessoa || 'fisica',
      situacao: 'ativo',
      nome: data.nome || '',
      nome_fantasia: data.nome_fantasia,
      cpf_cnpj: data.cpf_cnpj,
      rg: data.rg,
      sexo: data.sexo,
      data_nascimento: data.data_nascimento,
      cep: data.cep,
      logradouro: data.logradouro,
      numero: data.numero,
      complemento: data.complemento,
      bairro: data.bairro,
      cidade: data.cidade,
      estado: data.estado,
      telefone: data.telefone,
      telefone2: data.telefone2,
      email: data.email,
      whatsapp: data.whatsapp,
      created_at: new Date().toISOString(),
    };
    
    setClientes(prev => [novoCliente, ...prev]);
    return novoCliente;
  }, []);

  const updateCliente = useCallback((id: string, data: Partial<Cliente>) => {
    setClientes(prev => prev.map(c => 
      c.id === id ? { ...c, ...data, updated_at: new Date().toISOString() } : c
    ));
  }, []);

  const deleteCliente = useCallback((id: string) => {
    setClientes(prev => prev.filter(c => c.id !== id));
  }, []);

  const getClienteById = useCallback((id: string): Cliente | undefined => {
    return clientes.find(c => c.id === id);
  }, [clientes]);

  const searchClientes = useCallback((query: string): Cliente[] => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    return clientes.filter(c => 
      c.nome.toLowerCase().includes(q) ||
      c.cpf_cnpj?.includes(query) ||
      c.telefone?.includes(query) ||
      c.whatsapp?.includes(query)
    );
  }, [clientes]);

  return {
    clientes,
    createCliente,
    updateCliente,
    deleteCliente,
    getClienteById,
    searchClientes,
  };
}

// ==================== HOOK: MARCAS E MODELOS ====================
export function useMarcasModelos() {
  // Inicializar marcas e modelos juntos para garantir sincronização
  const [marcas, setMarcas] = useState<Marca[]>(() => {
    const stored = loadFromStorage<Marca[]>(STORAGE_KEYS.MARCAS, []);
    if (stored.length === 0) {
      const marcasPadrao = MARCAS_MODELOS_PADRAO.map(m => ({
        id: generateId(),
        nome: m.marca,
        situacao: 'ativo' as const,
        created_at: new Date().toISOString(),
      }));
      saveToStorage(STORAGE_KEYS.MARCAS, marcasPadrao);
      
      // Inicializar modelos imediatamente após criar marcas
      const modelosPadrao: Modelo[] = [];
      MARCAS_MODELOS_PADRAO.forEach((mp, index) => {
        const marca = marcasPadrao[index];
        if (marca) {
          mp.modelos.forEach(nomeModelo => {
            modelosPadrao.push({
              id: generateId(),
              marca_id: marca.id,
              nome: nomeModelo,
              situacao: 'ativo',
              created_at: new Date().toISOString(),
            });
          });
        }
      });
      saveToStorage(STORAGE_KEYS.MODELOS, modelosPadrao);
      
      return marcasPadrao;
    }
    return stored;
  });

  const [modelos, setModelos] = useState<Modelo[]>(() => {
    const stored = loadFromStorage<Modelo[]>(STORAGE_KEYS.MODELOS, []);
    if (stored.length === 0) {
      // Se não há modelos mas há marcas, criar modelos baseado nas marcas existentes
      const marcasStored = loadFromStorage<Marca[]>(STORAGE_KEYS.MARCAS, []);
      const modelosPadrao: Modelo[] = [];
      
      MARCAS_MODELOS_PADRAO.forEach(mp => {
        const marca = marcasStored.find(m => m.nome === mp.marca);
        if (marca) {
          mp.modelos.forEach(nomeModelo => {
            modelosPadrao.push({
              id: generateId(),
              marca_id: marca.id,
              nome: nomeModelo,
              situacao: 'ativo',
              created_at: new Date().toISOString(),
            });
          });
        }
      });
      
      if (modelosPadrao.length > 0) {
        saveToStorage(STORAGE_KEYS.MODELOS, modelosPadrao);
      }
      return modelosPadrao;
    }
    return stored;
  });

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.MARCAS, marcas);
  }, [marcas]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.MODELOS, modelos);
  }, [modelos]);

  const getModelosByMarca = useCallback((marcaId: string): Modelo[] => {
    return modelos.filter(m => m.marca_id === marcaId && m.situacao === 'ativo');
  }, [modelos]);

  const getMarcaById = useCallback((id: string): Marca | undefined => {
    return marcas.find(m => m.id === id);
  }, [marcas]);

  const getModeloById = useCallback((id: string): Modelo | undefined => {
    return modelos.find(m => m.id === id);
  }, [modelos]);

  return {
    marcas: marcas.filter(m => m.situacao === 'ativo'),
    modelos: modelos.filter(m => m.situacao === 'ativo'),
    getModelosByMarca,
    getMarcaById,
    getModeloById,
  };
}

// ==================== HOOK: MARCAS (separado) ====================
export function useMarcas() {
  const [marcas, setMarcas] = useState<Marca[]>(() => {
    const stored = loadFromStorage<Marca[]>(STORAGE_KEYS.MARCAS, []);
    if (stored.length === 0) {
      const marcasPadrao = MARCAS_MODELOS_PADRAO.map(m => ({
        id: generateId(),
        nome: m.marca,
        situacao: 'ativo' as const,
        created_at: new Date().toISOString(),
      }));
      saveToStorage(STORAGE_KEYS.MARCAS, marcasPadrao);
      return marcasPadrao;
    }
    return stored;
  });

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.MARCAS, marcas);
  }, [marcas]);

  const getMarcaById = useCallback((id: string): Marca | undefined => {
    return marcas.find(m => m.id === id);
  }, [marcas]);

  const createMarca = useCallback((data: Partial<Marca>): Marca => {
    const novaMarca: Marca = {
      id: generateId(),
      nome: data.nome || '',
      situacao: 'ativo',
      created_at: new Date().toISOString(),
    };
    
    setMarcas(prev => [novaMarca, ...prev]);
    return novaMarca;
  }, []);

  const updateMarca = useCallback((id: string, data: Partial<Marca>): Marca | null => {
    setMarcas(prev => {
      const index = prev.findIndex(m => m.id === id);
      if (index === -1) return prev;
      
      const updated = [...prev];
      updated[index] = { ...updated[index], ...data };
      return updated;
    });
    
    const updated = marcas.find(m => m.id === id);
    return updated ? { ...updated, ...data } : null;
  }, [marcas]);

  const deleteMarca = useCallback((id: string): boolean => {
    setMarcas(prev => prev.map(m => 
      m.id === id ? { ...m, situacao: 'inativo' as const } : m
    ));
    return true;
  }, []);

  return {
    marcas: marcas.filter(m => m.situacao === 'ativo'),
    createMarca,
    updateMarca,
    deleteMarca,
    getMarcaById,
  };
}

// ==================== HOOK: MODELOS (separado) ====================
export function useModelos() {
  const [modelos, setModelos] = useState<Modelo[]>(() => {
    const stored = loadFromStorage<Modelo[]>(STORAGE_KEYS.MODELOS, []);
    if (stored.length === 0) {
      const marcasStored = loadFromStorage<Marca[]>(STORAGE_KEYS.MARCAS, []);
      const modelosPadrao: Modelo[] = [];
      
      MARCAS_MODELOS_PADRAO.forEach(mp => {
        const marca = marcasStored.find(m => m.nome === mp.marca);
        if (marca) {
          mp.modelos.forEach(nomeModelo => {
            modelosPadrao.push({
              id: generateId(),
              marca_id: marca.id,
              nome: nomeModelo,
              situacao: 'ativo',
              created_at: new Date().toISOString(),
            });
          });
        }
      });
      
      if (modelosPadrao.length > 0) {
        saveToStorage(STORAGE_KEYS.MODELOS, modelosPadrao);
      }
      return modelosPadrao;
    }
    return stored;
  });

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.MODELOS, modelos);
  }, [modelos]);

  const getModeloById = useCallback((id: string): Modelo | undefined => {
    return modelos.find(m => m.id === id);
  }, [modelos]);

  const createModelo = useCallback((data: Partial<Modelo>): Modelo => {
    const novoModelo: Modelo = {
      id: generateId(),
      marca_id: data.marca_id || '',
      nome: data.nome || '',
      situacao: 'ativo',
      created_at: new Date().toISOString(),
    };
    
    setModelos(prev => [novoModelo, ...prev]);
    return novoModelo;
  }, []);

  const updateModelo = useCallback((id: string, data: Partial<Modelo>): Modelo | null => {
    setModelos(prev => {
      const index = prev.findIndex(m => m.id === id);
      if (index === -1) return prev;
      
      const updated = [...prev];
      updated[index] = { ...updated[index], ...data };
      return updated;
    });
    
    const updated = modelos.find(m => m.id === id);
    return updated ? { ...updated, ...data } : null;
  }, [modelos]);

  const deleteModelo = useCallback((id: string): boolean => {
    setModelos(prev => prev.map(m => 
      m.id === id ? { ...m, situacao: 'inativo' as const } : m
    ));
    return true;
  }, []);

  return {
    modelos: modelos.filter(m => m.situacao === 'ativo'),
    createModelo,
    updateModelo,
    deleteModelo,
    getModeloById,
  };
}

// ==================== GRUPOS DE PRODUTO ====================
interface GrupoProduto {
  id: string;
  nome: string;
  situacao: 'ativo' | 'inativo';
}

const GRUPOS_PADRAO: GrupoProduto[] = [
  { id: '1', nome: 'Telas', situacao: 'ativo' },
  { id: '2', nome: 'Baterias', situacao: 'ativo' },
  { id: '3', nome: 'Conectores', situacao: 'ativo' },
  { id: '4', nome: 'Flex', situacao: 'ativo' },
  { id: '5', nome: 'Capas', situacao: 'ativo' },
  { id: '6', nome: 'Películas', situacao: 'ativo' },
  { id: '7', nome: 'Carregadores', situacao: 'ativo' },
  { id: '8', nome: 'Cabos', situacao: 'ativo' },
  { id: '9', nome: 'Serviços', situacao: 'ativo' },
];

// ==================== HOOK: PRODUTOS ====================
export function useProdutos() {
  const [produtos, setProdutos] = useState<Produto[]>(() => {
    const loaded = loadFromStorage(STORAGE_KEYS.PRODUTOS, []);
    console.log(`[PRODUTOS] Estado inicial: ${Array.isArray(loaded) ? loaded.length : 0} produtos`);
    return loaded;
  });
  const [grupos] = useState<GrupoProduto[]>(() => 
    loadFromStorage('assistencia_grupos', GRUPOS_PADRAO)
  );
  const [isLoading] = useState(false);

  // PROTEÇÃO CRÍTICA: Verificar e restaurar produtos se sumirem
  useEffect(() => {
    const checkAndRestore = () => {
      const stored = localStorage.getItem(STORAGE_KEYS.PRODUTOS);
      if (stored) {
        try {
          const storedData = JSON.parse(stored);
          if (Array.isArray(storedData) && storedData.length > 0) {
            // Se temos dados salvos mas o estado está vazio, restaurar IMEDIATAMENTE
            if (produtos.length === 0 && storedData.length > 0) {
              console.error(`[PRODUTOS] 🚨 PRODUTOS SUMIRAM! Restaurando ${storedData.length} produtos do localStorage.`);
              setProdutos(storedData);
              return;
            }
            // Se temos menos produtos no estado do que salvos, restaurar
            if (produtos.length > 0 && produtos.length < storedData.length) {
              console.warn(`[PRODUTOS] ⚠️ Produtos perdidos detectados! Estado: ${produtos.length}, localStorage: ${storedData.length}. Restaurando...`);
              setProdutos(storedData);
              return;
            }
          }
        } catch (e) {
          console.error('[PRODUTOS] Erro ao verificar dados salvos:', e);
        }
      }
    };
    
    // Verificar imediatamente
    checkAndRestore();
    
    // Verificar periodicamente (a cada 3 segundos)
    const interval = setInterval(checkAndRestore, 3000);
    
    return () => clearInterval(interval);
  }, [produtos.length]);

  // Sincronizar com localStorage e detectar mudanças externas
  useEffect(() => {
    // Verificar se há mudanças no localStorage (outras abas, etc)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.PRODUTOS && e.newValue) {
        try {
          const newData = JSON.parse(e.newValue);
          if (Array.isArray(newData)) {
            console.log(`[PRODUTOS] Mudança detectada no localStorage: ${newData.length} produtos`);
            // PROTEÇÃO: Só atualizar se os novos dados não forem vazios OU se os atuais também forem vazios
            if (newData.length > 0 || produtos.length === 0) {
              setProdutos(newData);
            } else {
              console.warn(`[PRODUTOS] 🛡️ Ignorando atualização vazia. Mantendo ${produtos.length} produtos atuais.`);
            }
          }
        } catch (error) {
          console.error('[PRODUTOS] Erro ao processar mudança do localStorage:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // PROTEÇÃO CRÍTICA: Não salvar array vazio se já existir dados no localStorage
    const currentStored = localStorage.getItem(STORAGE_KEYS.PRODUTOS);
    if (produtos.length === 0 && currentStored) {
      try {
        const storedData = JSON.parse(currentStored);
        if (Array.isArray(storedData) && storedData.length > 0) {
          console.error(`[PRODUTOS] 🚨 BLOQUEADO: Tentativa de salvar array vazio! Restaurando ${storedData.length} produtos.`);
          setProdutos(storedData);
          return () => {
            window.removeEventListener('storage', handleStorageChange);
          };
        }
      } catch (e) {
        console.error('[PRODUTOS] Erro ao verificar dados salvos:', e);
      }
    }
    
    // Salvar produtos no localStorage APENAS se houver produtos
    if (produtos.length > 0) {
      saveToStorage(STORAGE_KEYS.PRODUTOS, produtos);
    } else {
      // Se produtos está vazio, NUNCA salvar se houver dados no localStorage
      if (!currentStored) {
        // Só salvar array vazio se realmente não houver nada salvo
        saveToStorage(STORAGE_KEYS.PRODUTOS, produtos);
      } else {
        // PROTEÇÃO: Não salvar array vazio quando há dados salvos
        console.warn(`[PRODUTOS] 🛡️ Proteção: não salvando array vazio quando há dados no localStorage`);
      }
    }

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [produtos]);

  const createProduto = useCallback((data: Partial<Produto>): Produto => {
    const novoProduto: Produto = {
      id: generateId(),
      situacao: 'ativo',
      tipo: data.tipo || 'peca',
      descricao: data.descricao || '',
      descricao_abreviada: data.descricao_abreviada,
      codigo_barras: data.codigo_barras,
      referencia: data.referencia,
      grupo_id: data.grupo_id,
      marca_id: data.marca_id,
      modelo_id: data.modelo_id,
      preco_custo: data.preco_custo || 0,
      preco_venda: data.preco_venda || 0,
      margem_lucro: data.margem_lucro,
      estoque_atual: data.estoque_atual || 0,
      estoque_minimo: data.estoque_minimo,
      localizacao: data.localizacao,
      created_at: new Date().toISOString(),
    };
    
    setProdutos(prev => [novoProduto, ...prev]);
    return novoProduto;
  }, []);

  const updateProduto = useCallback((id: string, data: Partial<Produto>) => {
    setProdutos(prev => prev.map(p => 
      p.id === id ? { ...p, ...data, updated_at: new Date().toISOString() } : p
    ));
  }, []);

  const deleteProduto = useCallback((id: string) => {
    setProdutos(prev => prev.map(p => 
      p.id === id ? { ...p, situacao: 'inativo' } : p
    ));
  }, []);

  const getProdutoById = useCallback((id: string): Produto | undefined => {
    return produtos.find(p => p.id === id);
  }, [produtos]);

  const searchProdutos = useCallback((query: string): Produto[] => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    return produtos.filter(p => 
      p.situacao === 'ativo' && (
        p.descricao.toLowerCase().includes(q) ||
        p.codigo_barras?.includes(query) ||
        p.referencia?.toLowerCase().includes(q)
      )
    );
  }, [produtos]);

  return {
    produtos: produtos.filter(p => p.situacao === 'ativo'),
    grupos: grupos.filter(g => g.situacao === 'ativo'),
    isLoading,
    createProduto,
    updateProduto,
    deleteProduto,
    getProdutoById,
    searchProdutos,
  };
}

// ==================== HOOK: ITENS DA OS ====================
export function useItensOS(osId: string) {
  const [allItens, setAllItens] = useState<ItemOS[]>(() => 
    loadFromStorage(STORAGE_KEYS.ITENS_OS, [])
  );

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.ITENS_OS, allItens);
  }, [allItens]);

  const itens = useMemo(() => 
    allItens.filter(i => i.ordem_servico_id === osId),
    [allItens, osId]
  );

  const total = useMemo(() => 
    itens.reduce((acc, i) => acc + i.valor_total, 0),
    [itens]
  );

  const addItem = useCallback((data: Omit<ItemOS, 'id' | 'ordem_servico_id' | 'created_at'>) => {
    const novoItem: ItemOS = {
      ...data,
      id: generateId(),
      ordem_servico_id: osId,
      created_at: new Date().toISOString(),
    };
    setAllItens(prev => [...prev, novoItem]);
    return novoItem;
  }, [osId]);

  const updateItem = useCallback((id: string, data: Partial<ItemOS>) => {
    setAllItens(prev => prev.map(i => i.id === id ? { ...i, ...data } : i));
  }, []);

  const removeItem = useCallback((id: string) => {
    setAllItens(prev => prev.filter(i => i.id !== id));
  }, []);

  return { itens, total, addItem, updateItem, removeItem };
}

// ==================== HOOK: PAGAMENTOS ====================
export function usePagamentos(osId: string) {
  const [allPagamentos, setAllPagamentos] = useState<PagamentoOS[]>(() => 
    loadFromStorage(STORAGE_KEYS.PAGAMENTOS, [])
  );

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.PAGAMENTOS, allPagamentos);
  }, [allPagamentos]);

  const pagamentos = useMemo(() => 
    allPagamentos.filter(p => p.ordem_servico_id === osId),
    [allPagamentos, osId]
  );

  const totalPago = useMemo(() => 
    pagamentos.reduce((acc, p) => acc + p.valor, 0),
    [pagamentos]
  );

  const addPagamento = useCallback((data: Omit<PagamentoOS, 'id' | 'ordem_servico_id' | 'created_at'>) => {
    const novoPagamento: PagamentoOS = {
      ...data,
      id: generateId(),
      ordem_servico_id: osId,
      created_at: new Date().toISOString(),
    };
    setAllPagamentos(prev => [...prev, novoPagamento]);
    return novoPagamento;
  }, [osId]);

  return { pagamentos, totalPago, addPagamento };
}

// Tipo do registro de pagamento OS na API (rastreável, vinculado à venda)
export interface PagamentoOSAPI {
  id: string;
  ordem_servico_id: string;
  sale_id: string;
  valor: number;
  forma_pagamento: string;
  tipo: string;
  observacao?: string | null;
  created_at: string;
  created_by?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  company_id?: string | null;
  // Enriquecido com dados da venda (preenchido pelo hook)
  sale_numero?: number;
  sale_created_at?: string;
  vendedor_nome?: string | null;
}

/** Carrega pagamentos da OS a partir da API (documentos rastreáveis vinculados a vendas) */
export function usePagamentosOSAPI(osId: string) {
  const [list, setList] = useState<PagamentoOSAPI[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!osId) {
      setList([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const { data: rows, error } = await from('os_pagamentos')
        .select('*')
        .eq('ordem_servico_id', osId)
        .order('created_at', { ascending: false })
        .execute();

      if (error) {
        console.warn('[usePagamentosOSAPI]', error);
        setList([]);
        return;
      }

      const ativos = (rows || []).filter((r: any) => !r.cancelled_at);
      if (ativos.length === 0) {
        setList(ativos);
        setIsLoading(false);
        return;
      }

      const saleIds = [...new Set(ativos.map((r: any) => r.sale_id).filter(Boolean))];
      const { data: salesData } = await from('sales')
        .select('id, numero, created_at, vendedor_nome')
        .in('id', saleIds)
        .execute();

      const salesMap = new Map((salesData || []).map((s: any) => [s.id, s]));
      const enriquecidos: PagamentoOSAPI[] = ativos.map((r: any) => ({
        ...r,
        sale_numero: salesMap.get(r.sale_id)?.numero,
        sale_created_at: salesMap.get(r.sale_id)?.created_at,
        vendedor_nome: salesMap.get(r.sale_id)?.vendedor_nome ?? null,
      }));
      setList(enriquecidos);
    } catch (e) {
      console.warn('[usePagamentosOSAPI]', e);
      setList([]);
    } finally {
      setIsLoading(false);
    }
  }, [osId]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPago = useMemo(() => list.reduce((acc, p) => acc + p.valor, 0), [list]);

  return { pagamentos: list, totalPago, isLoading, refetch: load };
}

// ==================== HOOK: CONFIGURAÇÃO DE STATUS (global por empresa, API) ====================
// Configuração única por empresa; não usa mais localStorage (evita cache por usuário/dispositivo).
function rowToConfig(row: any): ConfiguracaoStatus {
  return {
    id: String(row.id),
    status: row.status,
    label: row.label,
    cor: row.cor || 'bg-blue-500',
    notificar_whatsapp: Boolean(row.notificar_whatsapp),
    mensagem_whatsapp: row.mensagem_whatsapp ?? undefined,
    ordem: Number(row.ordem) || 0,
    ativo: row.ativo !== false,
    acao: (row.acao as AcaoStatusOS) || 'nenhuma',
  };
}

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
const isValidCompanyId = (id: string | null | undefined) =>
  id && id !== ZERO_UUID && String(id).toLowerCase() !== ZERO_UUID;

export function useConfiguracaoStatus() {
  const { user } = useAuth();
  const [configuracoes, setConfiguracoes] = useState<ConfiguracaoStatus[]>([]);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  const loadConfiguracoes = useCallback(async () => {
    try {
      // Limpar cache antigo do localStorage (uma vez por dispositivo)
      if (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEYS.CONFIG_STATUS)) {
        localStorage.removeItem(STORAGE_KEYS.CONFIG_STATUS);
      }
      const { data: rows, error } = await from('os_config_status')
        .select('*')
        .order('ordem', { ascending: true })
        .execute();
      if (error) throw error;
      const list = (rows || []).map(rowToConfig);
      if (list.length === 0) {
        // Seed padrão por empresa (uma única vez). Enviar company_id no body para evitar 500 se a API não preencher.
        let companyId = isValidCompanyId(user?.company_id) ? user!.company_id : undefined;
        if (!companyId) {
          const me = await authAPI.getCurrentUser();
          companyId = isValidCompanyId(me?.data?.user?.company_id) ? me!.data!.user!.company_id : undefined;
        }
        if (!companyId) {
          throw new Error('Seu usuário não está vinculado a uma empresa. Em Configurações, vincule seu usuário a uma empresa e recarregue a página.');
        }
        const toInsert = STATUS_OS_PADRAO.map(({ id: _id, ...r }) => ({
          status: r.status,
          label: r.label,
          cor: r.cor,
          notificar_whatsapp: r.notificar_whatsapp,
          mensagem_whatsapp: r.mensagem_whatsapp ?? null,
          ordem: r.ordem,
          ativo: r.ativo,
          acao: r.acao ?? 'nenhuma',
          company_id: companyId,
        }));
        const { error: insertErr } = await from('os_config_status').insert(toInsert);
        if (insertErr) throw insertErr;
        const { data: newRows } = await from('os_config_status')
          .select('*')
          .order('ordem', { ascending: true })
          .execute();
        setConfiguracoes((newRows || []).map(rowToConfig));
      } else {
        setConfiguracoes(list);
      }
    } catch (e) {
      console.error('[useConfiguracaoStatus] Erro ao carregar:', e);
      setConfiguracoes(STATUS_OS_PADRAO);
    } finally {
      setIsLoadingConfig(false);
    }
  }, []);

  useEffect(() => {
    loadConfiguracoes();
  }, [loadConfiguracoes]);

  const getConfigByStatus = useCallback((status: StatusOS | string): ConfiguracaoStatus | undefined => {
    return configuracoes.find(c => c.status === status);
  }, [configuracoes]);

  const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

  const updateConfig = useCallback(async (id: string, data: Partial<ConfiguracaoStatus>) => {
    if (!isUuid(id)) {
      throw new Error('Não foi possível salvar: os dados estão em modo offline (lista padrão). Faça login com um usuário vinculado a uma empresa e recarregue a página.');
    }
    const payload: any = {};
    if (data.label !== undefined) payload.label = data.label;
    if (data.cor !== undefined) payload.cor = data.cor;
    if (data.notificar_whatsapp !== undefined) payload.notificar_whatsapp = data.notificar_whatsapp;
    // Incluir mensagem mesmo quando null para limpar no banco (remover mensagem)
    if (data.mensagem_whatsapp !== undefined) payload.mensagem_whatsapp = data.mensagem_whatsapp ?? null;
    if (data.ordem !== undefined) payload.ordem = data.ordem;
    if (data.ativo !== undefined) payload.ativo = data.ativo;
    if (data.acao !== undefined) payload.acao = data.acao;
    if (Object.keys(payload).length === 0) {
      setConfiguracoes(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
      return;
    }
    const { error } = await from('os_config_status').eq('id', id).update(payload);
    if (error) {
      const msg = (error as any)?.error ?? (error as any)?.message ?? (typeof error === 'string' ? error : 'Erro ao atualizar');
      throw new Error(msg);
    }
    setConfiguracoes(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  }, []);

  const createConfig = useCallback(async (data: Omit<ConfiguracaoStatus, 'id'>) => {
    const maxOrdem = configuracoes.length > 0 ? Math.max(...configuracoes.map(c => c.ordem)) : 0;
    let companyId = isValidCompanyId(user?.company_id) ? user!.company_id : undefined;
    if (!companyId) {
      const me = await authAPI.getCurrentUser();
      companyId = isValidCompanyId(me?.data?.user?.company_id) ? me!.data!.user!.company_id : undefined;
    }
    if (!companyId) {
      throw new Error('Seu usuário não está vinculado a uma empresa. Vincule em Configurações e tente novamente.');
    }
    const payload = {
      status: data.status,
      label: data.label,
      cor: data.cor,
      notificar_whatsapp: data.notificar_whatsapp,
      mensagem_whatsapp: data.mensagem_whatsapp ?? null,
      ordem: data.ordem ?? maxOrdem + 1,
      ativo: data.ativo !== false,
      acao: data.acao ?? 'nenhuma',
      company_id: companyId,
    };
    const { data: inserted, error } = await from('os_config_status').insert(payload);
    if (error) {
      const msg = (error as any)?.error ?? (error as any)?.message ?? 'Erro ao criar';
      throw new Error(msg);
    }
    const raw = inserted?.data ?? inserted;
    const row = Array.isArray(raw) ? raw[0] : raw;
    const newConfig = row ? rowToConfig(row) : { ...data, id: String(Date.now()), ordem: payload.ordem };
    setConfiguracoes(prev => [...prev, newConfig]);
    return newConfig;
  }, [configuracoes, user]);

  const deleteConfig = useCallback(async (id: string) => {
    if (!isUuid(id)) {
      throw new Error('Não é possível remover: os dados estão em modo offline (lista padrão). Recarregue a página após conectar à API.');
    }
    const { error } = await from('os_config_status').eq('id', id).delete();
    if (error) {
      const msg = (error as any)?.error ?? (error as any)?.message ?? 'Erro ao remover';
      throw new Error(msg);
    }
    setConfiguracoes(prev => prev.filter(c => c.id !== id));
  }, []);

  return { configuracoes, isLoadingConfig, loadConfiguracoes, getConfigByStatus, updateConfig, createConfig, deleteConfig };
}

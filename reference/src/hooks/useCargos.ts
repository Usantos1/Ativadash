import { useState, useEffect, useCallback } from 'react';
import { from } from '@/integrations/db/client';
import { authAPI } from '@/integrations/auth/api-client';
import { Cargo, CARGOS_LABELS } from '@/types/assistencia';
import { useAuth } from '@/contexts/AuthContext';

interface Colaborador {
  id: string;
  nome: string;
  cargo: Cargo;
  ativo: boolean;
  email?: string;
  telefone?: string;
  created_at: string;
}

const STORAGE_KEY = 'assistencia_colaboradores';

// Vamos exibir somente usuários reais. Nenhum fallback fictício.
const COLABORADORES_PADRAO: Colaborador[] = [];

export function useCargos() {
  const { user } = useAuth();
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Obter company_id do usuário logado
  const currentCompanyId = user?.company_id;

  // Carregar colaboradores
  useEffect(() => {
    const load = async () => {
      if (!currentCompanyId) {
        console.log('[useCargos] ⚠️ Sem company_id, aguardando...');
        setColaboradores([]);
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      console.log('[useCargos] 🔄 Iniciando carregamento de colaboradores da empresa:', currentCompanyId);
      
      try {
        // 1) Primeiro buscar user_ids da tabela users que pertencem à mesma empresa
        console.log('[useCargos] 📡 Buscando usuários da empresa...');
        
        const { data: usersData, error: usersError } = await from('users')
          .select('id')
          .eq('company_id', currentCompanyId)
          .execute();
        
        if (usersError || !usersData || usersData.length === 0) {
          console.warn('[useCargos] ⚠️ Nenhum usuário encontrado na empresa');
          setColaboradores([]);
          setIsLoading(false);
          return;
        }
        
        const companyUserIds = usersData.map((u: any) => u.id).filter(Boolean);
        console.log('[useCargos] ✅ Usuários da empresa:', companyUserIds.length);
        
        // 2) Buscar perfis apenas dos usuários da mesma empresa
        console.log('[useCargos] 📡 Buscando profiles via PostgreSQL API...');
        
        const { data: profilesData, error: profilesError } = await from('profiles')
          .select('*')
          .in('user_id', companyUserIds)
          .order('display_name', { ascending: true })
          .execute();
        
        if (profilesError) {
          console.error('[useCargos] ❌ ERRO ao carregar profiles:', profilesError);
          
          // Tentar query simplificada ainda com filtro de empresa
          console.warn('[useCargos] ⚠️ Tentando query simplificada...');
          const { data: profilesData2, error: profilesError2 } = await from('profiles')
            .select('*')
            .in('user_id', companyUserIds)
            .limit(100)
            .execute();
          
          if (!profilesError2 && profilesData2 && profilesData2.length > 0) {
            console.log('[useCargos] ✅ Profiles carregados com query simplificada:', profilesData2.length);
            const todosColaboradores = profilesData2.map((profile: any) => ({
              id: profile.user_id || profile.id || profile.email || '',
              nome: profile.display_name || profile.email || 'Usuário',
              cargo: 'tecnico' as Cargo,
              ativo: true,
              email: profile.email || undefined,
              created_at: profile.created_at || new Date().toISOString(),
            })) as Colaborador[];
            
            console.log('[useCargos] ✅ Colaboradores criados:', todosColaboradores.length);
            setColaboradores(todosColaboradores);
            setIsLoading(false);
            return;
          }
          
          setColaboradores([]);
          setIsLoading(false);
          return;
        }

        console.log('[useCargos] ✅ Profiles carregados:', profilesData?.length || 0);

        if (!profilesData || profilesData.length === 0) {
          console.warn('[useCargos] ⚠️ Nenhum perfil encontrado');
          setColaboradores([]);
          setIsLoading(false);
          return;
        }

        // 2) Buscar posições dos usuários
        let positionsData: any[] = [];
        try {
          const { data: posData, error: positionsError } = await from('user_position_departments')
            .select('*')
            .execute();

          if (positionsError) {
            console.warn('[useCargos] Erro ao carregar posições:', positionsError);
          } else {
            positionsData = posData || [];
          }
        } catch (e) {
          console.warn('[useCargos] Tabela user_position_departments pode não existir:', e);
        }

        // 3) Montar lista de colaboradores
        const todosColaboradores: Colaborador[] = profilesData.map((profile: any) => {
          const userPositions = positionsData.filter(
            (up: any) => up.user_id === profile.user_id
          );

          // Determinar cargo
          let cargo: Cargo = 'tecnico'; // Padrão: todos como técnico
          
          if (profile.role === 'admin') {
            cargo = 'vendedor';
          } else if (profile.department && profile.department.toLowerCase().includes('venda')) {
            cargo = 'vendedor';
          }

          const colaboradorId = profile.user_id || profile.id || profile.email || '';
          
          return {
            id: colaboradorId,
            nome: profile.display_name || profile.email || 'Usuário',
            cargo: cargo,
            ativo: true,
            email: profile.email || undefined,
            created_at: profile.created_at || new Date().toISOString(),
          } as Colaborador;
        });

        console.log(`[useCargos] ✅ Total de profiles: ${profilesData.length}`);
        console.log(`[useCargos] ✅ Total de colaboradores criados: ${todosColaboradores.length}`);

        setColaboradores(todosColaboradores);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(todosColaboradores));
        
        console.log('[useCargos] ✅ Estado atualizado e salvo no localStorage');
      } catch (error) {
        console.error('[useCargos] Erro ao carregar colaboradores:', error);
        // Tentar usar localStorage como fallback
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          try {
            const storedData = JSON.parse(stored);
            if (Array.isArray(storedData) && storedData.length > 0) {
              console.log('[useCargos] ⚠️ Usando dados do localStorage devido a erro:', storedData.length);
              setColaboradores(storedData);
              setIsLoading(false);
              return;
            }
          } catch (e) {
            console.warn('[useCargos] Erro ao ler localStorage:', e);
          }
        }
        setColaboradores([]);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [currentCompanyId]);

  // Salvar colaboradores
  const saveColaboradores = useCallback((newColaboradores: Colaborador[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newColaboradores));
      setColaboradores(newColaboradores);
    } catch (error) {
      console.error('Erro ao salvar colaboradores:', error);
    }
  }, []);

  // Criar colaborador
  const createColaborador = useCallback((data: Omit<Colaborador, 'id' | 'created_at'>) => {
    const newColaborador: Colaborador = {
      ...data,
      id: Date.now().toString(),
      created_at: new Date().toISOString(),
    };
    const updated = [...colaboradores, newColaborador];
    saveColaboradores(updated);
    return newColaborador;
  }, [colaboradores, saveColaboradores]);

  // Atualizar colaborador
  const updateColaborador = useCallback((id: string, data: Partial<Colaborador>) => {
    const updated = colaboradores.map(c => 
      c.id === id ? { ...c, ...data } : c
    );
    saveColaboradores(updated);
  }, [colaboradores, saveColaboradores]);

  // Deletar colaborador
  const deleteColaborador = useCallback((id: string) => {
    const updated = colaboradores.filter(c => c.id !== id);
    saveColaboradores(updated);
  }, [colaboradores, saveColaboradores]);

  // Obter colaboradores por cargo
  const getColaboradoresByCargo = useCallback((cargo: Cargo) => {
    return colaboradores.filter(c => c.cargo === cargo && c.ativo);
  }, [colaboradores]);

  // Obter colaborador por ID
  const getColaboradorById = useCallback((id: string) => {
    return colaboradores.find(c => c.id === id);
  }, [colaboradores]);

  // Obter técnicos
  // Retornar TODOS os colaboradores ativos como técnicos (para que todos possam ser selecionados)
  const tecnicos = colaboradores.filter(c => c.ativo);
  
  // Obter vendedores
  const vendedores = colaboradores.filter(c => c.cargo === 'vendedor' && c.ativo);
  
  // Obter atendentes
  const atendentes = colaboradores.filter(c => c.cargo === 'atendente' && c.ativo);

  return {
    colaboradores,
    tecnicos,
    vendedores,
    atendentes,
    isLoading,
    createColaborador,
    updateColaborador,
    deleteColaborador,
    getColaboradoresByCargo,
    getColaboradorById,
  };
}

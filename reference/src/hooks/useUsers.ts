import { useState, useEffect } from 'react';
import { from } from '@/integrations/db/client';
import { useAuth } from '@/contexts/AuthContext';

export interface User {
  id: string;
  user_id: string;
  display_name: string;
  department?: string;
  role: string;
  approved: boolean;
  phone?: string;
  avatar_url?: string;
}

export const useUsers = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Obter company_id do usuário logado
  const currentCompanyId = user?.company_id;

  const fetchUsers = async () => {
    if (!currentCompanyId) {
      console.log('[useUsers] ⚠️ Sem company_id, aguardando...');
      setUsers([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      // 1) Primeiro buscar user_ids da tabela users que pertencem à mesma empresa
      console.log('[useUsers] 📡 Buscando usuários da empresa:', currentCompanyId);
      
      const { data: usersData, error: usersError } = await from('users')
        .select('id')
        .eq('company_id', currentCompanyId)
        .execute();
      
      if (usersError || !usersData || usersData.length === 0) {
        console.warn('[useUsers] ⚠️ Nenhum usuário encontrado na empresa');
        setUsers([]);
        setLoading(false);
        return;
      }
      
      const companyUserIds = usersData.map((u: any) => u.id).filter(Boolean);
      console.log('[useUsers] ✅ Usuários da empresa:', companyUserIds.length);
      
      // 2) Buscar perfis apenas dos usuários da mesma empresa
      const { data, error } = await from('profiles')
        .select(`
          id, 
          user_id, 
          display_name, 
          department, 
          role, 
          approved, 
          phone, 
          avatar_url
        `)
        .in('user_id', companyUserIds)
        .order('display_name')
        .execute();

      if (error) {
        console.error('Error fetching users:', error);
        return;
      }

      const formattedUsers: User[] = (data || []).map(profile => ({
        id: profile.user_id,
        user_id: profile.user_id,
        display_name: profile.display_name || 'Usuário sem nome',
        department: profile.department,
        role: profile.role,
        approved: profile.approved,
        phone: profile.phone,
        avatar_url: profile.avatar_url
      }));

      console.log('[useUsers] ✅ Usuários carregados:', formattedUsers.length);
      setUsers(formattedUsers);
    } catch (error) {
      console.error('Error in fetchUsers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentCompanyId]);

  return {
    users,
    loading,
    refetch: fetchUsers
  };
};

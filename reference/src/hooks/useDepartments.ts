import { useState, useEffect } from 'react';
import { from } from '@/integrations/db/client';

export interface Department {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  created_by: string;
}

export const useDepartments = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const { data, error } = await from('departments')
        .select('*')
        .order('name', { ascending: true })
        .execute();

      if (error) {
        console.error('Error fetching departments:', error);
        return;
      }

      setDepartments(data || []);
    } catch (error) {
      console.error('Error in fetchDepartments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  return {
    departments,
    loading,
    refetch: fetchDepartments
  };
};
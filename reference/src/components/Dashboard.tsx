import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { from } from '@/integrations/db/client';
import { Users } from 'lucide-react';

export function Dashboard() {
  const { user, profile } = useAuth();
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      (async () => {
        setLoading(true);
        try {
          const { data: profiles } = await from('profiles').select('id').execute();
          setTotalUsers(profiles?.length ?? 0);
        } catch (e) {
          console.error('Error fetching dashboard data:', e);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-32 bg-muted/20" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
              Usuários cadastrados
            </CardTitle>
            <Users className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {totalUsers}
            </div>
            <p className="text-xs text-orange-600 dark:text-orange-400">
              {profile?.display_name ? `Olá, ${profile.display_name.split(' ')[0]}` : 'Dashboard'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { from } from '@/integrations/db/client';
import { apiClient } from '@/integrations/api/client';
import { useToast } from '@/hooks/use-toast';
import { useDepartments } from '@/hooks/useDepartments';
import { useUserLogs } from '@/hooks/useUserLogs';
import { User, Lock, Building2, Shield } from 'lucide-react';

interface UserProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  role: 'admin' | 'member';
  department: string | null;
  approved: boolean;
  phone?: string | null;
  email?: string;
}

interface UserEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onSuccess: () => void;
}

export const UserEditModal: React.FC<UserEditModalProps> = ({
  isOpen,
  onClose,
  user,
  onSuccess
}) => {
  const { toast } = useToast();
  const { departments } = useDepartments();
  const { logActivity } = useUserLogs();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    display_name: '',
    email: '',
    phone: '',
    department: '',
    role: 'member' as 'admin' | 'member',
    approved: false,
    password: ''
  });

  useEffect(() => {
    if (user && isOpen) {
      // Buscar email do usuário via edge function
      const fetchUserEmail = async () => {
        try {
          console.log('Fetching user email for user_id:', user.user_id);
          
          const { data, error } = await apiClient.invokeFunction('admin-get-user', {
            userId: user.user_id
          });

          if (error) {
            console.error('Error fetching user email:', error);
            // Fallback - carregar sem email
            setFormData({
              display_name: user.display_name || '',
              email: '',
              phone: user.phone || '',
              department: user.department || '',
              role: user.role,
              approved: user.approved,
              password: ''
            });
          } else {
            console.log('User email fetched successfully:', data);
            setFormData({
              display_name: user.display_name || '',
              email: (data as any)?.data?.user?.email || '',
              phone: user.phone || '',
              department: user.department || '',
              role: user.role,
              approved: user.approved,
              password: ''
            });
          }
        } catch (error) {
          console.error('Exception fetching user email:', error);
          // Fallback - carregar sem email
          setFormData({
            display_name: user.display_name || '',
            email: '',
            phone: user.phone || '',
            department: user.department || '',
            role: user.role,
            approved: user.approved,
            password: ''
          });
        }
      };

      fetchUserEmail();
    }
  }, [user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.user_id) {
      toast({
        title: "Erro",
        description: "Dados do usuário inválidos",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Update profile data
      const { error: profileError } = await from('profiles')
        .eq('user_id', user.user_id)
        .update({
          display_name: formData.display_name,
          phone: formData.phone,
          department: formData.department,
          role: formData.role,
          approved: formData.approved
        });

      if (profileError) {
        console.error('Profile update error:', profileError);
        toast({
          title: "Erro",
          description: `Erro ao atualizar perfil: ${profileError.message}`,
          variant: "destructive"
        });
        return;
      }

      // For admin users, try to update auth data using edge function
      const currentEmail = user.email || '';
      if (formData.email.trim() !== currentEmail || formData.password.trim()) {
        try {
          console.log('Calling admin-update-user with:', {
            userId: user.user_id,
            email: formData.email.trim() !== currentEmail ? formData.email.trim() : undefined,
            password: formData.password.trim() || undefined
          });

          const { data: authData, error: authError } = await apiClient.invokeFunction('admin-update-user', {
            userId: user.user_id,
            email: formData.email.trim() !== currentEmail ? formData.email.trim() : undefined,
            password: formData.password.trim() || undefined
          });

          if (authError) {
            console.error('Auth update via edge function failed:', authError);
            toast({
              title: "Erro",
              description: `Erro ao atualizar credenciais: ${authError.message}`,
              variant: "destructive"
            });
            return;
          } else {
            console.log('Auth update successful:', authData);
            toast({
              title: "Sucesso",
              description: "Email/senha atualizados com sucesso",
            });
          }
        } catch (authError: any) {
          console.error('Auth update failed:', authError);
          toast({
            title: "Erro", 
            description: `Erro ao atualizar credenciais: ${authError.message}`,
            variant: "destructive"
          });
          return;
        }
      }

      // Log da atualização do usuário
      await logActivity(
        'update_user',
        `Usuário atualizado: ${formData.display_name || user.display_name}`,
        'user',
        user.user_id,
        {
          userName: formData.display_name || user.display_name,
          department: formData.department,
          role: formData.role,
          approved: formData.approved,
          updatedBy: 'admin'
        }
      );

      toast({
        title: "Sucesso",
        description: "Usuário atualizado com sucesso"
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro inesperado ao atualizar usuário",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Editar Usuário
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="display_name">Nome Completo</Label>
            <Input
              id="display_name"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              placeholder="Nome do usuário"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@empresa.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone/WhatsApp</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="(19) 99999-9999"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Nova Senha (deixe vazio para manter)
            </Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Nova senha"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="department" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Departamento
            </Label>
            <Select 
              value={formData.department} 
              onValueChange={(value) => setFormData({ ...formData, department: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o departamento" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.name}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Cargo/Função
            </Label>
            <Select 
              value={formData.role} 
              onValueChange={(value: 'admin' | 'member') => setFormData({ ...formData, role: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Membro</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="approved">Usuário Aprovado</Label>
            <Switch
              id="approved"
              checked={formData.approved}
              onCheckedChange={(checked) => setFormData({ ...formData, approved: checked })}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
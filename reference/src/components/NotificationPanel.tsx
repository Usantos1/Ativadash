import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, X, AlertTriangle, CheckCircle, Info, Clock, LayoutDashboard, FileBarChart, Wrench, ShoppingCart } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Notification {
  id: string;
  type: 'task_overdue' | 'task_assigned' | 'process_updated' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onNotificationChange?: (count: number) => void;
}

const DISMISSED_KEY = 'primecamp_notifications_dismissed';
const NOTIFICATIONS_KEY = 'notifications';

function getDismissedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function setDismissedId(id: string, add: boolean) {
  const set = getDismissedIds();
  if (add) set.add(id);
  else set.delete(id);
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
  } catch {}
}

const QUICK_LINKS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/relatorios', label: 'Relatórios', icon: FileBarChart },
  { to: '/os', label: 'Ordens de Serviço', icon: Wrench },
  { to: '/pdv', label: 'PDV / Vendas', icon: ShoppingCart },
] as const;

export function NotificationPanel({ isOpen, onClose, onNotificationChange }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const savedNotifications = localStorage.getItem(NOTIFICATIONS_KEY);
    let allNotifications: Notification[] = [];

    if (savedNotifications) {
      try {
        allNotifications = JSON.parse(savedNotifications);
      } catch (error) {
        console.error('Error parsing saved notifications:', error);
      }
    }

    const dismissed = getDismissedIds();

    // Dicas úteis do sistema – só entram se o usuário nunca dispensou
    const tipAlertas: Notification = {
      id: 'tip-alertas',
      type: 'info',
      title: 'Painel de Alertas',
      message: 'Receba avisos por WhatsApp: nova OS, caixa fechado, resumo de vendas. Configure em Relatórios > Painel de Alertas.',
      timestamp: new Date(),
      read: false
    };
    const tipRelatorios: Notification = {
      id: 'tip-relatorios',
      type: 'info',
      title: 'Relatórios',
      message: 'Tendência de vendas (PDV vs OS), resumo geral e filtros por data em Relatórios.',
      timestamp: new Date(Date.now() - 3600000),
      read: false
    };

    const others = allNotifications.filter(
      (n) => !dismissed.has(n.id) && n.id !== 'tip-alertas' && n.id !== 'tip-relatorios'
    );

    const finalNotifications = [
      ...(!dismissed.has('tip-alertas') ? [tipAlertas] : []),
      ...(!dismissed.has('tip-relatorios') ? [tipRelatorios] : []),
      ...others
    ];
    setNotifications(finalNotifications);
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(finalNotifications));
  }, []);

  // Update notification count when it changes
  useEffect(() => {
    const unreadCount = notifications.filter(n => !n.read).length;
    onNotificationChange?.(unreadCount);
  }, [notifications, onNotificationChange]);

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'task_overdue':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'task_assigned':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'process_updated':
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <Bell className="h-4 w-4 text-blue-500" />;
    }
  };

  const getNotificationBadge = (type: Notification['type']) => {
    switch (type) {
      case 'task_overdue':
        return <Badge className="bg-red-500 text-white">Urgente</Badge>;
      case 'task_assigned':
        return <Badge className="bg-green-500 text-white">Nova</Badge>;
      case 'process_updated':
        return <Badge className="bg-blue-500 text-white">Atualização</Badge>;
      default:
        return <Badge variant="secondary">Info</Badge>;
    }
  };

  const markAsRead = (notificationId: string) => {
    const updatedNotifications = notifications.map(notification => 
      notification.id === notificationId 
        ? { ...notification, read: true }
        : notification
    );
    setNotifications(updatedNotifications);
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updatedNotifications));
  };

  const deleteNotification = (notificationId: string) => {
    if (notificationId === 'tip-alertas' || notificationId === 'tip-relatorios') {
      setDismissedId(notificationId, true);
    }
    const updatedNotifications = notifications.filter(n => n.id !== notificationId);
    setNotifications(updatedNotifications);
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updatedNotifications));
  };

  const clearAll = () => {
    const updatedNotifications = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updatedNotifications);
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updatedNotifications));
  };

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const notificationPanel = target.closest('.notification-panel');
      const notificationButton = target.closest('[data-notification-trigger]');
      
      if (!notificationPanel && !notificationButton && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end items-stretch">
      <div className="w-full max-w-md h-full max-h-[calc(100dvh-2rem)] bg-background border-l shadow-lg overflow-hidden flex flex-col notification-panel">
        <Card className="flex flex-col min-h-0 flex-1 rounded-none border-0">
          <CardHeader className="flex-shrink-0 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notificações
                {notifications.filter(n => !n.read).length > 0 && (
                  <Badge className="bg-red-500 text-white">
                    {notifications.filter(n => !n.read).length}
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearAll}>
                    Limpar tudo
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
              {notifications.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  <div className="text-center">
                    <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma notificação</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {notifications.map(notification => (
                    <div
                      key={notification.id}
                      className={`p-4 border-b cursor-pointer transition-colors ${
                        notification.read 
                          ? 'bg-background opacity-60' 
                          : 'bg-muted/30 hover:bg-muted/50'
                      }`}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <div className="flex items-start gap-3">
                        {getNotificationIcon(notification.type)}
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium">{notification.title}</h4>
                            <div className="flex items-center gap-1">
                              {getNotificationBadge(notification.type)}
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 w-6 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNotification(notification.id);
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {format(notification.timestamp, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-shrink-0 border-t p-3 bg-muted/20">
              <p className="text-xs font-medium text-muted-foreground mb-2">Recursos úteis</p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_LINKS.map(({ to, label, icon: Icon }) => (
                  <Button
                    key={to}
                    variant="outline"
                    size="sm"
                    className="justify-start h-8 text-xs"
                    onClick={() => { navigate(to); onClose(); }}
                  >
                    <Icon className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
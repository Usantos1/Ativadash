import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Download, FileSpreadsheet, FileText, Database } from 'lucide-react';
import { from } from '@/integrations/db/client';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

interface ExportOptions {
  format: 'excel' | 'csv' | 'json';
  dataType: 'tasks' | 'processes' | 'users' | 'events' | 'time_clock' | 'all';
  dateRange: '7d' | '30d' | '90d' | 'all';
}

export function ReportExporter() {
  const [options, setOptions] = useState<ExportOptions>({
    format: 'excel',
    dataType: 'all',
    dateRange: '30d'
  });
  const [isExporting, setIsExporting] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const getDateFilter = () => {
    if (options.dateRange === 'all') return null;
    
    const days = parseInt(options.dateRange);
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
  };

  const fetchData = async () => {
    const dateFilter = getDateFilter();
    const data: any = {};

    try {
      if (options.dataType === 'tasks' || options.dataType === 'all') {
        let query = from('tasks').select(`
          *,
          profiles:responsible_user_id(display_name).execute(),
          categories(name),
          processes(name)
        `);
        
        if (dateFilter) {
          query = query.gte('created_at', dateFilter);
        }
        
        const { data: tasks } = await query;
        data.tasks = tasks;
      }

      if (options.dataType === 'processes' || options.dataType === 'all') {
        let query = from('processes').select(`
          *,
          categories(name)
        .execute()`);
        
        if (dateFilter) {
          query = query.gte('created_at', dateFilter);
        }
        
        const { data: processes } = await query;
        data.processes = processes;
      }

      if (options.dataType === 'users' || options.dataType === 'all') {
        let query = from('profiles').select('*').execute();
        
        if (dateFilter) {
          query = query.gte('created_at', dateFilter);
        }
        
        const { data: users } = await query;
        data.users = users;
      }

      if (options.dataType === 'events' || options.dataType === 'all') {
        let query = from('calendar_events').select('*').execute();
        
        if (dateFilter) {
          query = query.gte('created_at', dateFilter);
        }
        
        const { data: events } = await query;
        data.events = events;
      }

      if (options.dataType === 'time_clock' || options.dataType === 'all') {
        let query = from('time_clock').select(`
          *,
          profiles(display_name)
        .execute()`);
        
        if (dateFilter) {
          query = query.gte('created_at', dateFilter);
        }
        
        const { data: timeClock } = await query;
        data.time_clock = timeClock;
      }

      return data;
    } catch (error) {
      console.error('Error fetching data:', error);
      throw error;
    }
  };

  const exportToExcel = (data: any) => {
    const workbook = XLSX.utils.book_new();

    Object.keys(data).forEach(sheetName => {
      if (data[sheetName] && data[sheetName].length > 0) {
        const worksheet = XLSX.utils.json_to_sheet(data[sheetName]);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      }
    });

    const fileName = `relatorio_${options.dataType}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const exportToCSV = (data: any) => {
    Object.keys(data).forEach(dataType => {
      if (data[dataType] && data[dataType].length > 0) {
        const worksheet = XLSX.utils.json_to_sheet(data[dataType]);
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${dataType}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    });
  };

  const exportToJSON = (data: any) => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_${options.dataType}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      const data = await fetchData();
      
      switch (options.format) {
        case 'excel':
          exportToExcel(data);
          break;
        case 'csv':
          exportToCSV(data);
          break;
        case 'json':
          exportToJSON(data);
          break;
      }

      toast({
        title: "Exportação concluída",
        description: `Dados exportados em formato ${options.format.toUpperCase()}`,
      });
      
      setOpen(false);
    } catch (error) {
      toast({
        title: "Erro na exportação",
        description: "Não foi possível exportar os dados",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Exportar Dados
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar Relatórios</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label>Formato de Exportação</Label>
                <Select
                  value={options.format}
                  onValueChange={(value: 'excel' | 'csv' | 'json') =>
                    setOptions(prev => ({ ...prev, format: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excel">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        Excel (.xlsx)
                      </div>
                    </SelectItem>
                    <SelectItem value="csv">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        CSV (.csv)
                      </div>
                    </SelectItem>
                    <SelectItem value="json">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        JSON (.json)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Dados</Label>
                <Select
                  value={options.dataType}
                  onValueChange={(value: any) =>
                    setOptions(prev => ({ ...prev, dataType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os dados</SelectItem>
                    <SelectItem value="tasks">Tarefas</SelectItem>
                    <SelectItem value="processes">Processos</SelectItem>
                    <SelectItem value="users">Usuários</SelectItem>
                    <SelectItem value="events">Eventos</SelectItem>
                    <SelectItem value="time_clock">Ponto Eletrônico</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Período</Label>
                <Select
                  value={options.dateRange}
                  onValueChange={(value: '7d' | '30d' | '90d' | 'all') =>
                    setOptions(prev => ({ ...prev, dateRange: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Últimos 7 dias</SelectItem>
                    <SelectItem value="30d">Últimos 30 dias</SelectItem>
                    <SelectItem value="90d">Últimos 90 dias</SelectItem>
                    <SelectItem value="all">Todos os dados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1"
            >
              {isExporting ? 'Exportando...' : 'Exportar'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
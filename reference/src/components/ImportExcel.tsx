import React, { useState, useCallback } from 'react';
import { Upload, Download, AlertCircle, CheckCircle, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useBulkUpsertProducts } from '@/hooks/useProducts';
import { brlToNumber } from '@/utils/currency';
import * as XLSX from 'xlsx';

type ImportExcelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type PreviewData = {
  nome: string;
  marca: string;
  modelo: string;
  qualidade: string;
  valor_dinheiro_pix: string;
  valor_parcelado_6x: string;
  errors: string[];
  isValid: boolean;
};

const requiredHeaders = ['nome', 'marca', 'modelo', 'qualidade', 'valor_dinheiro_pix', 'valor_parcelado_6x'];

export function ImportExcel({ open, onOpenChange }: ImportExcelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  
  const bulkUpsertMutation = useBulkUpsertProducts();

  const validateRow = useCallback((row: any, index: number): PreviewData => {
    const errors: string[] = [];
    const nome = row.nome?.toString().trim() || '';
    const marca = row.marca?.toString().trim() || '';
    const modelo = row.modelo?.toString().trim() || '';
    const qualidade = row.qualidade?.toString().trim() || '';
    const valor_dinheiro_pix = row.valor_dinheiro_pix?.toString().trim() || '';
    const valor_parcelado_6x = row.valor_parcelado_6x?.toString().trim() || '';

    // Validate required fields
    if (!nome) errors.push('Nome é obrigatório');
    if (!marca) errors.push('Marca é obrigatória');
    if (!modelo) errors.push('Modelo é obrigatório');
    if (!qualidade) errors.push('Qualidade é obrigatória');
    if (!valor_dinheiro_pix) errors.push('Valor dinheiro/Pix é obrigatório');
    if (!valor_parcelado_6x) errors.push('Valor parcelado 6x é obrigatório');

    // Validate monetary values
    try {
      const dinheiroValue = brlToNumber(valor_dinheiro_pix);
      if (dinheiroValue <= 0) errors.push('Valor dinheiro/Pix deve ser maior que zero');
    } catch {
      errors.push('Valor dinheiro/Pix inválido');
    }

    try {
      const parceladoValue = brlToNumber(valor_parcelado_6x);
      if (parceladoValue <= 0) errors.push('Valor parcelado 6x deve ser maior que zero');
    } catch {
      errors.push('Valor parcelado 6x inválido');
    }

    return {
      nome,
      marca,
      modelo,
      qualidade,
      valor_dinheiro_pix,
      valor_parcelado_6x,
      errors,
      isValid: errors.length === 0,
    };
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Check file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    
    if (!validTypes.includes(selectedFile.type)) {
      alert('Por favor, selecione um arquivo Excel (.xlsx, .xls) ou CSV');
      return;
    }

    setFile(selectedFile);
    setPreviewData([]);
    setShowPreview(false);
  }, []);

  const processFile = useCallback(async () => {
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (!jsonData.length) {
          alert('Arquivo vazio ou sem dados válidos');
          return;
        }

        // Check headers
        const firstRow = jsonData[0] as any;
        const headers = Object.keys(firstRow).map(h => h.toLowerCase());
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        
        if (missingHeaders.length > 0) {
          alert(`Cabeçalhos obrigatórios ausentes: ${missingHeaders.join(', ')}`);
          return;
        }

        // Process and validate first 10 rows for preview
        const previewRows = jsonData.slice(0, 10).map((row, index) => 
          validateRow(row, index)
        );

        setPreviewData(previewRows);
        setShowPreview(true);
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      alert('Erro ao processar arquivo. Verifique o formato e tente novamente.');
    }
  }, [file, validateRow]);

  const handleImport = useCallback(async () => {
    if (!file) return;

    setImporting(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // Process all rows
        const validProducts = jsonData
          .map((row, index) => validateRow(row, index))
          .filter(row => row.isValid)
          .map(row => ({
            nome: row.nome,
            marca: row.marca,
            modelo: row.modelo,
            qualidade: row.qualidade,
            valor_dinheiro_pix: brlToNumber(row.valor_dinheiro_pix),
            valor_parcelado_6x: brlToNumber(row.valor_parcelado_6x),
          }));

        if (validProducts.length === 0) {
          alert('Nenhum produto válido encontrado para importar');
          setImporting(false);
          return;
        }

        await bulkUpsertMutation.mutateAsync(validProducts);
        
        onOpenChange(false);
        setFile(null);
        setPreviewData([]);
        setShowPreview(false);
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Erro na importação:', error);
    } finally {
      setImporting(false);
    }
  }, [file, validateRow, bulkUpsertMutation, onOpenChange]);

  const downloadTemplate = () => {
    const template = `nome,marca,modelo,qualidade,valor_dinheiro_pix,valor_parcelado_6x
Tela iPhone 11 Preta,Apple,iPhone 11,Original,349.00,399.00
Troca Conector iPhone 12,Apple,iPhone 12,Premium,199.90,229.90`;

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'modelo_produtos.csv';
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Produtos via Excel/CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Template Download */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">1. Baixar Modelo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Baixe o arquivo modelo com o formato correto para importação.
              </p>
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Baixar Modelo CSV
              </Button>
            </CardContent>
          </Card>

          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">2. Selecionar Arquivo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="file">Arquivo Excel ou CSV</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                />
              </div>
              {file && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{file.name}</Badge>
                  <Button size="sm" onClick={processFile}>
                    Visualizar Prévia
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview */}
          {showPreview && previewData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">3. Prévia dos Dados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Mostrando primeiras 10 linhas. Verifique os dados antes de importar.
                    </AlertDescription>
                  </Alert>

                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Marca</TableHead>
                          <TableHead>Modelo</TableHead>
                          <TableHead>Qualidade</TableHead>
                          <TableHead>Dinheiro/Pix</TableHead>
                          <TableHead>Parcelado 6x</TableHead>
                          <TableHead>Erros</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.map((row, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              {row.isValid ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <X className="h-4 w-4 text-red-500" />
                              )}
                            </TableCell>
                            <TableCell>{row.nome}</TableCell>
                            <TableCell>{row.marca}</TableCell>
                            <TableCell>{row.modelo}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{row.qualidade}</Badge>
                            </TableCell>
                            <TableCell>{row.valor_dinheiro_pix}</TableCell>
                            <TableCell>{row.valor_parcelado_6x}</TableCell>
                            <TableCell>
                              {row.errors.length > 0 && (
                                <div className="text-xs text-red-500">
                                  {row.errors.join(', ')}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">
                      Válidos: {previewData.filter(r => r.isValid).length} | 
                      Inválidos: {previewData.filter(r => !r.isValid).length}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                      </Button>
                      <Button 
                        onClick={handleImport}
                        disabled={importing || previewData.filter(r => r.isValid).length === 0}
                      >
                        {importing ? (
                          <>
                            <Upload className="h-4 w-4 mr-2 animate-spin" />
                            Importando...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Importar Dados
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
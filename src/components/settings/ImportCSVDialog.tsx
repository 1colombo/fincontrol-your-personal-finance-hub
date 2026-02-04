import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, AlertCircle, Check, Loader2, AlertTriangle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useProfiles } from '@/contexts/ProfileContext';
import { useAuth } from '@/contexts/AuthContext';
import { parseCSV, validateTransactions, TransactionCSV, ValidationError, MAX_IMPORT_BATCH_SIZE } from '@/lib/csv';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';

interface ImportCSVDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'complete';

export function ImportCSVDialog({ open, onOpenChange }: ImportCSVDialogProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [parsedData, setParsedData] = useState<TransactionCSV[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [progress, setProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { selectedProfile, profiles } = useProfiles();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const resetState = () => {
    setStep('upload');
    setParsedData([]);
    setValidationErrors([]);
    setProgress(0);
    setImportedCount(0);
    setError(null);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setError(null);
    setValidationErrors([]);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = parseCSV(content);
        
        if (parsed.length === 0) {
          setError('Nenhum dado válido encontrado no arquivo CSV');
          return;
        }

        // Check batch size limit
        if (parsed.length > MAX_IMPORT_BATCH_SIZE) {
          setError(`O arquivo contém ${parsed.length} linhas. O máximo permitido é ${MAX_IMPORT_BATCH_SIZE} transações por importação.`);
          return;
        }
        
        // Validate and sanitize data
        const validationResult = validateTransactions(parsed);
        setValidationErrors(validationResult.errors);
        
        setParsedData(parsed);
        setStep('preview');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao processar o arquivo CSV');
      }
    };
    reader.onerror = () => {
      setError('Erro ao ler o arquivo');
    };
    reader.readAsText(file, 'UTF-8');
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
    },
    maxFiles: 1,
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProfile || !user) {
        throw new Error('Selecione um perfil antes de importar');
      }

      // Use validated transactions instead of raw parsed data
      const validationResult = validateTransactions(parsedData);
      
      if (!validationResult.valid) {
        throw new Error(`Existem ${validationResult.errors.length} erro(s) de validação. Corrija-os antes de importar.`);
      }
      
      const transactions = validationResult.validTransactions;
      
      if (transactions.length === 0) {
        throw new Error('Nenhuma transação válida para importar');
      }

      setStep('importing');
      let imported = 0;

      // Import in batches of 50
      const batchSize = 50;
      for (let i = 0; i < transactions.length; i += batchSize) {
        const batch = transactions.slice(i, i + batchSize).map(t => ({
          ...t,
          profile_id: selectedProfile.id,
          user_id: user.id,
        }));

        const { error } = await supabase.from('transactions').insert(batch);
        
        if (error) throw new Error('Erro ao salvar transações. Tente novamente.');

        imported += batch.length;
        setImportedCount(imported);
        setProgress(Math.round((imported / transactions.length) * 100));
      }

      return imported;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['kpi'] });
      queryClient.invalidateQueries({ queryKey: ['chart'] });
      setStep('complete');
      toast.success(`${count} transações importadas com sucesso!`);
    },
    onError: (error) => {
      setError(error instanceof Error ? error.message : 'Erro ao importar transações');
      setStep('preview');
    },
  });

  const handleImport = () => {
    importMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar CSV
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Faça upload de um arquivo CSV com suas transações'}
            {step === 'preview' && `${parsedData.length} transações encontradas. Revise e confirme a importação.`}
            {step === 'importing' && 'Importando transações...'}
            {step === 'complete' && 'Importação concluída com sucesso!'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                  transition-colors duration-200
                  ${isDragActive 
                    ? 'border-primary bg-primary/5' 
                    : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
                  }
                `}
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-foreground font-medium mb-1">
                  {isDragActive ? 'Solte o arquivo aqui' : 'Arraste um arquivo CSV ou clique para selecionar'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Formatos suportados: .csv
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Formato esperado do CSV:</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  O arquivo deve conter cabeçalhos com os nomes das colunas. Colunas aceitas:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li><strong>Descrição</strong> (obrigatório): Nome da transação</li>
                  <li><strong>Valor</strong> (obrigatório): Valor em R$ (ex: 1.234,56)</li>
                  <li><strong>Tipo</strong>: "Receita" ou "Despesa"</li>
                  <li><strong>Forma de Pagamento</strong>: PIX, Boleto, Crédito, Débito, Dinheiro, Transferência</li>
                  <li><strong>Fonte/Cartão</strong>: Nome do banco ou cartão</li>
                  <li><strong>Data</strong>: Formato DD/MM/AAAA</li>
                  <li><strong>Observação</strong>: Notas adicionais</li>
                </ul>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {validationErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Erros de validação encontrados</AlertTitle>
                  <AlertDescription>
                    <ScrollArea className="h-[100px] mt-2">
                      <ul className="text-sm space-y-1">
                        {validationErrors.slice(0, 10).map((err, idx) => (
                          <li key={idx}>
                            Linha {err.row}: {err.message} ({err.field})
                          </li>
                        ))}
                        {validationErrors.length > 10 && (
                          <li className="text-muted-foreground">
                            ... e mais {validationErrors.length - 10} erros
                          </li>
                        )}
                      </ul>
                    </ScrollArea>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Importando para:</span>
                <Badge variant="secondary">{selectedProfile?.name || 'Nenhum perfil'}</Badge>
              </div>

              <ScrollArea className="h-[300px] rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Descrição</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Fonte</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.slice(0, 100).map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium truncate max-w-[200px]">
                          {row.descricao || '-'}
                        </TableCell>
                        <TableCell className="text-right">{row.valor}</TableCell>
                        <TableCell>
                          <Badge variant={row.tipo.toLowerCase().includes('receita') ? 'default' : 'secondary'}>
                            {row.tipo || 'Despesa'}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.forma_pagamento || 'PIX'}</TableCell>
                        <TableCell className="truncate max-w-[100px]">{row.fonte_pagamento || '-'}</TableCell>
                        <TableCell>{row.data || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              
              {parsedData.length > 100 && (
                <p className="text-sm text-muted-foreground text-center">
                  Mostrando 100 de {parsedData.length} transações
                </p>
              )}
            </div>
          )}

          {step === 'importing' && (
            <div className="space-y-6 py-8">
              <div className="flex justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-center text-sm text-muted-foreground">
                  {importedCount} de {parsedData.length} transações importadas ({progress}%)
                </p>
              </div>
            </div>
          )}

          {step === 'complete' && (
            <div className="space-y-4 py-8 text-center">
              <div className="flex justify-center">
                <div className="rounded-full bg-primary/10 p-4">
                  <Check className="h-12 w-12 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-display font-semibold text-foreground">
                  Importação Concluída!
                </h3>
                <p className="text-muted-foreground mt-1">
                  {importedCount} transações foram importadas com sucesso para o perfil {selectedProfile?.name}.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
          )}
          
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => { setStep('upload'); setValidationErrors([]); }}>
                Voltar
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={!selectedProfile || parsedData.length === 0 || validationErrors.length > 0}
              >
                Importar {parsedData.length} transações
              </Button>
            </>
          )}
          
          {step === 'complete' && (
            <Button onClick={handleClose}>
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

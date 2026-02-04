import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { FileDropzone, UploadedFile } from '@/components/upload/FileDropzone';
import { useProfiles } from '@/contexts/ProfileContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Sparkles, AlertCircle, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

export default function Import() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [originalFiles, setOriginalFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { selectedProfile } = useProfiles();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const handleFilesUploaded = useCallback((files: File[]) => {
    const newFiles: UploadedFile[] = files.map(file => ({
      id: uuidv4(),
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'pending',
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);
    setOriginalFiles(prev => [...prev, ...files]);
    toast.success(`${files.length} arquivo(s) adicionado(s)`);
  }, []);

  const handleRemoveFile = useCallback((id: string) => {
    const fileToRemove = uploadedFiles.find(f => f.id === id);
    if (fileToRemove) {
      setOriginalFiles(prev => prev.filter(f => f.name !== fileToRemove.name));
    }
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  }, [uploadedFiles]);

  const updateFileStatus = useCallback((id: string, updates: Partial<UploadedFile>) => {
    setUploadedFiles(prev => 
      prev.map(f => f.id === id ? { ...f, ...updates } : f)
    );
  }, []);

  const uploadFileToStorage = async (file: File, localId: string): Promise<string | null> => {
    if (!selectedProfile || !user) return null;
    
    updateFileStatus(localId, { status: 'uploading' });

    const fileExt = file.name.split('.').pop();
    const storagePath = `${user.id}/${selectedProfile.id}/${uuidv4()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(storagePath, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      updateFileStatus(localId, { 
        status: 'failed', 
        errorMessage: 'Erro ao fazer upload do arquivo' 
      });
      return null;
    }

    // Create database record for the file
    const { data: fileRecord, error: dbError } = await supabase
      .from('uploaded_files')
      .insert({
        user_id: user.id,
        profile_id: selectedProfile.id,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: storagePath,
        status: 'pending',
      })
      .select()
      .single();

    if (dbError || !fileRecord) {
      console.error('Database error:', dbError);
      updateFileStatus(localId, { 
        status: 'failed', 
        errorMessage: 'Erro ao registrar arquivo' 
      });
      return null;
    }

    return fileRecord.id;
  };

  const processFileWithAI = async (dbFileId: string, localId: string): Promise<boolean> => {
    if (!selectedProfile || !user) return false;
    
    updateFileStatus(localId, { status: 'processing' });

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-bank-statement`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            fileId: dbFileId,
            profileId: selectedProfile.id,
            userId: user.id,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        
        if (response.status === 429) {
          updateFileStatus(localId, { 
            status: 'failed', 
            errorMessage: 'Limite de requisições excedido. Tente novamente mais tarde.' 
          });
          toast.error('Limite de requisições IA excedido');
          return false;
        }
        
        if (response.status === 402) {
          updateFileStatus(localId, { 
            status: 'failed', 
            errorMessage: 'Créditos de IA insuficientes.' 
          });
          toast.error('Créditos de IA insuficientes');
          return false;
        }

        throw new Error(errorData.error || 'Failed to process file');
      }

      const result = await response.json();
      
      updateFileStatus(localId, { 
        status: 'completed',
        processedCount: result.transactionsCount 
      });
      
      return true;
    } catch (error) {
      console.error('Processing error:', error);
      updateFileStatus(localId, { 
        status: 'failed', 
        errorMessage: error instanceof Error ? error.message : 'Erro ao processar arquivo' 
      });
      return false;
    }
  };

  const handleProcessWithAI = useCallback(async (files: File[]) => {
    if (!selectedProfile || !user) {
      toast.error('Selecione um perfil antes de processar');
      return;
    }

    setIsProcessing(true);
    
    const pendingFileRecords = uploadedFiles.filter(f => f.status === 'pending');
    let successCount = 0;
    let failCount = 0;

    // Process files sequentially to avoid rate limits
    for (const fileRecord of pendingFileRecords) {
      const originalFile = files.find(f => f.name === fileRecord.name);
      
      if (!originalFile) {
        updateFileStatus(fileRecord.id, { 
          status: 'failed', 
          errorMessage: 'Arquivo não encontrado' 
        });
        failCount++;
        continue;
      }

      // Upload to storage
      const dbFileId = await uploadFileToStorage(originalFile, fileRecord.id);
      if (!dbFileId) {
        failCount++;
        continue;
      }

      // Process with AI
      const success = await processFileWithAI(dbFileId, fileRecord.id);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    setIsProcessing(false);

    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: ['kpi'] });
    queryClient.invalidateQueries({ queryKey: ['chart'] });

    if (successCount > 0) {
      toast.success(`${successCount} arquivo(s) processado(s) com sucesso!`);
    }
    if (failCount > 0 && successCount === 0) {
      toast.error(`${failCount} arquivo(s) falharam no processamento`);
    }
  }, [uploadedFiles, selectedProfile, user, queryClient, updateFileStatus]);

  const completedCount = uploadedFiles.filter(f => f.status === 'completed').length;
  const totalTransactions = uploadedFiles.reduce((sum, f) => sum + (f.processedCount || 0), 0);

  if (!selectedProfile) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center animate-fade-in">
        <h2 className="text-2xl font-display font-bold text-foreground mb-2">
          Nenhum perfil selecionado
        </h2>
        <p className="text-muted-foreground">
          Selecione um perfil no menu lateral para importar arquivos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground tracking-tight">
          Importação Inteligente
        </h1>
        <p className="text-muted-foreground mt-1">
          Faça upload de extratos e recibos para processamento automático com IA
        </p>
      </div>

      {/* Success Stats */}
      {completedCount > 0 && (
        <Alert className="border-income/30 bg-income/5 animate-slide-up">
          <CheckCircle className="h-4 w-4 text-income" />
          <AlertDescription className="text-income">
            {completedCount} arquivo(s) processado(s) com sucesso! 
            {totalTransactions > 0 && ` ${totalTransactions} transações extraídas e adicionadas.`}
          </AlertDescription>
        </Alert>
      )}

      {/* Info Alert */}
      <Alert className="animate-slide-up" style={{ animationDelay: '50ms' }}>
        <Sparkles className="h-4 w-4" />
        <AlertDescription>
          Nossa IA analisa extratos bancários em PDF e fotos de recibos, 
          extraindo automaticamente as transações para criar lançamentos no sistema.
        </AlertDescription>
      </Alert>

      {/* Upload Card */}
      <Card className="card-finance animate-slide-up" style={{ animationDelay: '100ms' }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            <FileText className="h-5 w-5" />
            Arquivos e Extratos
          </CardTitle>
          <CardDescription>
            Arraste arquivos PDF ou imagens para processar com IA
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileDropzone
            onFilesUploaded={handleFilesUploaded}
            uploadedFiles={uploadedFiles}
            onRemoveFile={handleRemoveFile}
            onProcessWithAI={handleProcessWithAI}
            isProcessing={isProcessing}
            originalFiles={originalFiles}
          />
        </CardContent>
      </Card>

      {/* Processing Info */}
      <Card className="card-finance border-dashed animate-slide-up" style={{ animationDelay: '150ms' }}>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Como funciona?</h3>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>• Faça upload de extratos bancários em PDF</li>
                <li>• Ou envie fotos de recibos e notas fiscais</li>
                <li>• Clique em "Processar com IA" para extrair os dados</li>
                <li>• A IA identifica e categoriza cada transação automaticamente</li>
                <li>• Os lançamentos são criados diretamente no perfil selecionado</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

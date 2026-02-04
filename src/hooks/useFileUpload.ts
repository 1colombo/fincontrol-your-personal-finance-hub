import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';
  progress?: number;
  dbId?: string;
  processedCount?: number;
  errorMessage?: string;
}

interface UseFileUploadProps {
  profileId: string;
  userId: string;
}

export function useFileUpload({ profileId, userId }: UseFileUploadProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();

  const updateFileStatus = useCallback((id: string, updates: Partial<UploadedFile>) => {
    setUploadedFiles(prev => 
      prev.map(f => f.id === id ? { ...f, ...updates } : f)
    );
  }, []);

  const handleFilesUploaded = useCallback((files: File[]) => {
    const newFiles: UploadedFile[] = files.map(file => ({
      id: uuidv4(),
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'pending',
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);
    toast.success(`${files.length} arquivo(s) adicionado(s)`);
    
    return newFiles;
  }, []);

  const handleRemoveFile = useCallback((id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const uploadFileToStorage = async (file: File, localId: string): Promise<string | null> => {
    updateFileStatus(localId, { status: 'uploading' });

    const fileExt = file.name.split('.').pop();
    const storagePath = `${userId}/${profileId}/${uuidv4()}.${fileExt}`;

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
        user_id: userId,
        profile_id: profileId,
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

    updateFileStatus(localId, { dbId: fileRecord.id });
    return fileRecord.id;
  };

  const processFileWithAI = async (dbFileId: string, localId: string): Promise<boolean> => {
    updateFileStatus(localId, { status: 'processing' });

    try {
      // Get the current session token for authenticated request
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-bank-statement`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            fileId: dbFileId,
            profileId,
            // userId is now derived from the JWT token server-side
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
    if (!profileId || !userId) {
      toast.error('Selecione um perfil antes de processar');
      return;
    }

    setIsProcessing(true);
    
    const pendingFiles = uploadedFiles.filter(f => f.status === 'pending');
    let successCount = 0;
    let failCount = 0;

    // Process files sequentially to avoid rate limits
    for (let i = 0; i < pendingFiles.length; i++) {
      const file = pendingFiles[i];
      const originalFile = files.find(f => f.name === file.name);
      
      if (!originalFile) {
        updateFileStatus(file.id, { 
          status: 'failed', 
          errorMessage: 'Arquivo não encontrado' 
        });
        failCount++;
        continue;
      }

      // Upload to storage
      const dbFileId = await uploadFileToStorage(originalFile, file.id);
      if (!dbFileId) {
        failCount++;
        continue;
      }

      // Process with AI
      const success = await processFileWithAI(dbFileId, file.id);
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
    if (failCount > 0) {
      toast.error(`${failCount} arquivo(s) falharam no processamento`);
    }
  }, [uploadedFiles, profileId, userId, queryClient, updateFileStatus]);

  return {
    uploadedFiles,
    isProcessing,
    handleFilesUploaded,
    handleRemoveFile,
    handleProcessWithAI,
    setUploadedFiles,
  };
}

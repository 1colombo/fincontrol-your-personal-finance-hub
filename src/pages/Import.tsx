import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { FileDropzone } from '@/components/upload/FileDropzone';
import { useProfiles } from '@/contexts/ProfileContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Sparkles, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
}

export default function Import() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { selectedProfile } = useProfiles();

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
  }, []);

  const handleRemoveFile = useCallback((id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const handleProcessWithAI = useCallback(async () => {
    setIsProcessing(true);
    
    // Simulate AI processing
    const pendingFiles = uploadedFiles.filter(f => f.status === 'pending');
    
    for (const file of pendingFiles) {
      setUploadedFiles(prev => 
        prev.map(f => f.id === file.id ? { ...f, status: 'processing' as const } : f)
      );
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Random success/failure for demo
      const success = Math.random() > 0.2;
      
      setUploadedFiles(prev => 
        prev.map(f => f.id === file.id 
          ? { ...f, status: success ? 'completed' as const : 'failed' as const } 
          : f
        )
      );
    }
    
    setIsProcessing(false);
    toast.success('Processamento concluído!');
  }, [uploadedFiles]);

  if (!selectedProfile) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
          Importação Inteligente
        </h1>
        <p className="text-muted-foreground mt-1">
          Faça upload de extratos e recibos para processamento automático
        </p>
      </div>

      {/* Info Alert */}
      <Alert>
        <Sparkles className="h-4 w-4" />
        <AlertDescription>
          Nossa IA pode processar extratos bancários em PDF e fotos de recibos, 
          extraindo automaticamente as informações para criar lançamentos.
        </AlertDescription>
      </Alert>

      {/* Upload Card */}
      <Card className="card-finance">
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
          />
        </CardContent>
      </Card>

      {/* Processing Info */}
      <Card className="card-finance border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Como funciona?</h3>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>• Faça upload de extratos bancários em PDF</li>
                <li>• Ou envie fotos de recibos e notas fiscais</li>
                <li>• Clique em "Processar com IA" para extrair os dados</li>
                <li>• Os lançamentos serão criados automaticamente</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Image, X, Loader2, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';
  progress?: number;
  processedCount?: number;
  errorMessage?: string;
}

interface FileDropzoneProps {
  onFilesUploaded: (files: File[]) => void;
  uploadedFiles: UploadedFile[];
  onRemoveFile: (id: string) => void;
  onProcessWithAI: (files: File[]) => void;
  isProcessing: boolean;
  originalFiles: File[];
}

export function FileDropzone({
  onFilesUploaded,
  uploadedFiles,
  onRemoveFile,
  onProcessWithAI,
  isProcessing,
  originalFiles,
}: FileDropzoneProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    onFilesUploaded(acceptedFiles);
  }, [onFilesUploaded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getStatusColor = (status: UploadedFile['status']) => {
    switch (status) {
      case 'pending':
        return 'text-muted-foreground';
      case 'uploading':
        return 'text-warning';
      case 'processing':
        return 'text-warning';
      case 'completed':
        return 'text-income';
      case 'failed':
        return 'text-expense';
    }
  };

  const getStatusLabel = (file: UploadedFile) => {
    switch (file.status) {
      case 'pending':
        return 'Aguardando';
      case 'uploading':
        return 'Enviando...';
      case 'processing':
        return 'Processando IA...';
      case 'completed':
        return `Concluído (${file.processedCount || 0} transações)`;
      case 'failed':
        return 'Falhou';
    }
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'pending':
        return null;
      case 'uploading':
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const hasPendingFiles = uploadedFiles.some(f => f.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-xl p-8 lg:p-12 text-center cursor-pointer transition-all duration-200',
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/50'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-4">
          <div className={cn(
            'w-16 h-16 rounded-full flex items-center justify-center transition-colors',
            isDragActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          )}>
            <Upload className="h-8 w-8" />
          </div>
          <div>
            <p className="text-lg font-medium text-foreground">
              {isDragActive ? 'Solte os arquivos aqui' : 'Arraste e solte arquivos aqui'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              ou clique para selecionar arquivos
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              PDF
            </span>
            <span className="flex items-center gap-1">
              <Image className="h-4 w-4" />
              Imagens
            </span>
            <span>Máx. 10MB</span>
          </div>
        </div>
      </div>

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Arquivos Enviados</h3>
            <Button
              onClick={() => onProcessWithAI(originalFiles)}
              disabled={isProcessing || !hasPendingFiles}
              className="gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Processar com IA
                </>
              )}
            </Button>
          </div>

          <div className="space-y-2">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg border bg-card transition-colors",
                  file.status === 'failed' && "border-expense/30 bg-expense/5",
                  file.status === 'completed' && "border-income/30 bg-income/5"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    {file.type.includes('pdf') ? (
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Image className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge 
                          variant={file.status === 'completed' ? 'default' : 'secondary'}
                          className={cn('gap-1', getStatusColor(file.status))}
                        >
                          {getStatusIcon(file.status)}
                          {getStatusLabel(file)}
                        </Badge>
                      </TooltipTrigger>
                      {file.errorMessage && (
                        <TooltipContent>
                          <p>{file.errorMessage}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onRemoveFile(file.id)}
                    disabled={file.status === 'uploading' || file.status === 'processing'}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Image, X, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
}

interface FileDropzoneProps {
  onFilesUploaded: (files: File[]) => void;
  uploadedFiles: UploadedFile[];
  onRemoveFile: (id: string) => void;
  onProcessWithAI: () => void;
  isProcessing: boolean;
}

export function FileDropzone({
  onFilesUploaded,
  uploadedFiles,
  onRemoveFile,
  onProcessWithAI,
  isProcessing,
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
      case 'processing':
        return 'text-warning';
      case 'completed':
        return 'text-income';
      case 'failed':
        return 'text-expense';
    }
  };

  const getStatusLabel = (status: UploadedFile['status']) => {
    switch (status) {
      case 'pending':
        return 'Aguardando';
      case 'processing':
        return 'Processando...';
      case 'completed':
        return 'Concluído';
      case 'failed':
        return 'Falhou';
    }
  };

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
              onClick={onProcessWithAI}
              disabled={isProcessing || uploadedFiles.every(f => f.status !== 'pending')}
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
                className="flex items-center justify-between p-4 rounded-lg border bg-card"
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
                  <span className={cn('text-sm font-medium', getStatusColor(file.status))}>
                    {file.status === 'processing' && (
                      <Loader2 className="h-4 w-4 animate-spin inline mr-1" />
                    )}
                    {getStatusLabel(file.status)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onRemoveFile(file.id)}
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

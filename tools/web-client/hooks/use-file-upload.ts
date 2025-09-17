import { useState, useCallback, useRef } from 'react';

export interface FileUploadItem {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  preview?: any;
  error?: string;
  uploadedAt?: Date;
}

export interface FileValidation {
  valid: boolean;
  error?: string;
}

export interface UseFileUploadOptions {
  maxFileSize?: number;
  maxFiles?: number;
  acceptedTypes?: Record<string, string[]>;
  onUploadComplete?: (file: FileUploadItem) => void;
  onUploadError?: (file: FileUploadItem, error: string) => void;
}

const DEFAULT_OPTIONS: UseFileUploadOptions = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 10,
  acceptedTypes: {
    'application/json': ['.json'],
    'text/csv': ['.csv'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
  }
};

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const [uploads, setUploads] = useState<FileUploadItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): FileValidation => {
    // Check file type
    const isValidType = Object.keys(opts.acceptedTypes!).some(type => 
      file.type === type || opts.acceptedTypes![type].some(ext => 
        file.name.toLowerCase().endsWith(ext)
      )
    );
    
    if (!isValidType) {
      const validExtensions = Object.values(opts.acceptedTypes!).flat().join(', ');
      return { 
        valid: false, 
        error: `Invalid file type. Accepted formats: ${validExtensions}` 
      };
    }

    // Check file size
    if (file.size > opts.maxFileSize!) {
      return { 
        valid: false, 
        error: `File size exceeds ${opts.maxFileSize! / 1024 / 1024}MB limit.` 
      };
    }

    return { valid: true };
  }, [opts.acceptedTypes, opts.maxFileSize]);

  const generatePreview = useCallback(async (file: File): Promise<any> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        try {
          if (file.type === 'application/json' || file.name.endsWith('.json')) {
            const jsonData = JSON.parse(content);
            const keys = Array.isArray(jsonData) 
              ? ['Array items'] 
              : Object.keys(jsonData);
            
            resolve({
              type: 'json',
              keys: keys.slice(0, 10),
              size: Array.isArray(jsonData) ? jsonData.length : Object.keys(jsonData).length,
              sample: JSON.stringify(jsonData, null, 2).slice(0, 500) + (JSON.stringify(jsonData, null, 2).length > 500 ? '...' : '')
            });
          } else if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
            const lines = content.split('\n').filter(line => line.trim());
            const headers = lines[0]?.split(',').map(h => h.trim()) || [];
            
            resolve({
              type: 'csv',
              headers: headers.slice(0, 10),
              rows: Math.max(0, lines.length - 1),
              sample: lines.slice(0, 6).join('\n')
            });
          } else {
            resolve({
              type: 'unknown',
              size: file.size,
              sample: 'Preview not available for this file type'
            });
          }
        } catch (_error) {
          resolve({ 
            type: 'error', 
            error: 'Could not parse file content',
            sample: content.slice(0, 500) + '...'
          });
        }
      };
      reader.onerror = () => {
        resolve({ type: 'error', error: 'Could not read file' });
      };
      reader.readAsText(file.slice(0, 2048)); // Read first 2KB for preview
    });
  }, []);

  const simulateUpload = useCallback((uploadId: string) => {
    setUploads(prev => prev.map(upload => 
      upload.id === uploadId 
        ? { ...upload, status: 'uploading' as const }
        : upload
    ));

    // Simulate upload progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      
      setUploads(prev => prev.map(upload => {
        if (upload.id === uploadId && upload.status === 'uploading') {
          const newProgress = Math.min(progress, 100);
          
          if (newProgress >= 100) {
            clearInterval(interval);
            
            // Simulate processing phase
            setTimeout(() => {
              setUploads(prevUploads => {
                const updatedUploads = prevUploads.map(u => 
                  u.id === uploadId 
                    ? { ...u, status: 'processing' as const }
                    : u
                );
                return updatedUploads;
              });
              
              // Complete processing after delay
              setTimeout(() => {
                setUploads(prevUploads => {
                  const completedUpload = prevUploads.find(u => u.id === uploadId);
                  const updatedUploads = prevUploads.map(u => 
                    u.id === uploadId 
                      ? { ...u, status: 'completed' as const, uploadedAt: new Date() }
                      : u
                  );
                  
                  // Call completion callback
                  if (completedUpload && opts.onUploadComplete) {
                    opts.onUploadComplete({
                      ...completedUpload,
                      status: 'completed',
                      uploadedAt: new Date()
                    });
                  }
                  
                  return updatedUploads;
                });
              }, 1500 + Math.random() * 1000); // 1.5-2.5s processing time
            }, 500);
            
            return { ...upload, progress: 100 };
          }
          
          return { ...upload, progress: newProgress };
        }
        return upload;
      }));
    }, 150 + Math.random() * 100); // Variable update speed
  }, [opts.onUploadComplete]);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.isArray(files) ? files : Array.from(files);
    
    // Check total files limit
    if (uploads.length + fileArray.length > opts.maxFiles!) {
      throw new Error(`Maximum ${opts.maxFiles} files allowed. Current: ${uploads.length}`);
    }

    const newUploads: FileUploadItem[] = [];

    for (const file of fileArray) {
      const validation = validateFile(file);
      
      const upload: FileUploadItem = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        status: validation.valid ? 'pending' : 'error',
        progress: 0,
        error: validation.error
      };

      if (validation.valid) {
        try {
          upload.preview = await generatePreview(file);
        } catch (_error) {
          upload.preview = { type: 'error', error: 'Preview generation failed' };
        }
      }

      newUploads.push(upload);
    }

    setUploads(prev => [...prev, ...newUploads]);

    // Start uploading valid files
    newUploads
      .filter(upload => upload.status === 'pending')
      .forEach(upload => {
        setTimeout(() => simulateUpload(upload.id), Math.random() * 500);
      });

    return newUploads;
  }, [uploads.length, opts.maxFiles, validateFile, generatePreview, simulateUpload]);

  const removeUpload = useCallback((uploadId: string) => {
    setUploads(prev => prev.filter(upload => upload.id !== uploadId));
  }, []);

  const clearUploads = useCallback(() => {
    setUploads([]);
  }, []);

  const retryUpload = useCallback((uploadId: string) => {
    setUploads(prev => prev.map(upload => 
      upload.id === uploadId && upload.status === 'error'
        ? { ...upload, status: 'pending', progress: 0, error: undefined }
        : upload
    ));
    
    // Start upload after a brief delay
    setTimeout(() => simulateUpload(uploadId), 100);
  }, [simulateUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    try {
      await processFiles(e.dataTransfer.files);
    } catch (_error) {
      if (opts.onUploadError) {
        opts.onUploadError({} as FileUploadItem, _error instanceof Error ? _error.message : 'Unknown error');
      }
    }
  }, [processFiles, opts.onUploadError]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      try {
        await processFiles(e.target.files);
      } catch (_error) {
        if (opts.onUploadError) {
          opts.onUploadError({} as FileUploadItem, _error instanceof Error ? _error.message : 'Unknown error');
        }
      }
      // Reset input
      e.target.value = '';
    }
  }, [processFiles, opts.onUploadError]);

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    uploads,
    isDragOver,
    fileInputRef,
    processFiles,
    removeUpload,
    clearUploads,
    retryUpload,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileSelect,
    openFileDialog,
    validateFile,
    stats: {
      total: uploads.length,
      pending: uploads.filter(u => u.status === 'pending').length,
      uploading: uploads.filter(u => u.status === 'uploading').length,
      processing: uploads.filter(u => u.status === 'processing').length,
      completed: uploads.filter(u => u.status === 'completed').length,
      error: uploads.filter(u => u.status === 'error').length,
    }
  };
}
'use client';

import {
  X,
  Download,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  FileIcon,
  FileText,
  Music,
  Video,
  Archive,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * File data for the preview modal
 */
export interface PreviewFile {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
  thumbnailUrl?: string | null;
  uploadedBy?: {
    name: string | null;
    displayName?: string | null;
  };
  createdAt?: string;
}

/**
 * Props for the FilePreviewModal component
 */
interface FilePreviewModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when the modal should close */
  onOpenChange: (open: boolean) => void;
  /** The file to preview */
  file: PreviewFile | null;
  /** Optional list of files for navigation */
  files?: PreviewFile[];
  /** Callback when navigating to a different file */
  onFileChange?: (file: PreviewFile) => void;
}

/**
 * Get file type category from MIME type
 */
function getFileCategory(
  mimeType: string
):
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'document'
  | 'code'
  | 'archive'
  | 'other' {
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  if (mimeType.startsWith('video/')) {
    return 'video';
  }
  if (mimeType.startsWith('audio/')) {
    return 'audio';
  }
  if (mimeType === 'application/pdf') {
    return 'pdf';
  }
  if (
    mimeType.includes('document') ||
    mimeType.includes('word') ||
    mimeType.includes('excel') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('powerpoint') ||
    mimeType.includes('presentation')
  ) {
    return 'document';
  }
  if (
    mimeType.startsWith('text/') ||
    mimeType.includes('json') ||
    mimeType.includes('xml') ||
    mimeType.includes('javascript') ||
    mimeType.includes('typescript')
  ) {
    return 'code';
  }
  if (
    mimeType.includes('zip') ||
    mimeType.includes('tar') ||
    mimeType.includes('rar') ||
    mimeType.includes('7z') ||
    mimeType.includes('gzip')
  ) {
    return 'archive';
  }
  return 'other';
}

/**
 * Get file type icon based on category
 */
function getFileIcon(category: string) {
  switch (category) {
    case 'image':
      return ImageIcon;
    case 'video':
      return Video;
    case 'audio':
      return Music;
    case 'pdf':
      return FileText;
    case 'document':
      return FileText;
    case 'code':
      return FileText;
    case 'archive':
      return Archive;
    default:
      return FileIcon;
  }
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Image Viewer Component
 */
function ImageViewer({ file }: { file: PreviewFile }) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.25));
  const handleRotate = () => setRotation(r => (r + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  return (
    <div className='flex flex-col h-full'>
      {/* Controls */}
      <div className='flex items-center justify-center gap-2 p-2 bg-black/50 backdrop-blur-sm'>
        <Button
          variant='ghost'
          size='icon'
          className='h-8 w-8 text-white hover:bg-white/20'
          onClick={handleZoomOut}
        >
          <ZoomOut className='h-4 w-4' />
        </Button>
        <span className='text-sm text-white min-w-[60px] text-center'>
          {Math.round(zoom * 100)}%
        </span>
        <Button
          variant='ghost'
          size='icon'
          className='h-8 w-8 text-white hover:bg-white/20'
          onClick={handleZoomIn}
        >
          <ZoomIn className='h-4 w-4' />
        </Button>
        <div className='w-px h-4 bg-white/30 mx-2' />
        <Button
          variant='ghost'
          size='icon'
          className='h-8 w-8 text-white hover:bg-white/20'
          onClick={handleRotate}
        >
          <RotateCw className='h-4 w-4' />
        </Button>
        <Button
          variant='ghost'
          size='sm'
          className='h-8 text-white hover:bg-white/20'
          onClick={handleReset}
        >
          Reset
        </Button>
      </div>

      {/* Image */}
      <div className='flex-1 flex items-center justify-center overflow-auto p-4'>
        {isLoading && (
          <div className='absolute inset-0 flex items-center justify-center'>
            <Loader2 className='h-8 w-8 animate-spin text-white' />
          </div>
        )}
        {error ? (
          <div className='text-center text-white'>
            <ImageIcon className='h-16 w-16 mx-auto mb-4 opacity-50' />
            <p>Failed to load image</p>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.url}
            alt={file.originalName}
            className={cn(
              'max-w-full max-h-full object-contain transition-transform duration-200',
              isLoading && 'opacity-0'
            )}
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
            }}
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setError(true);
            }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Video Viewer Component
 */
function VideoViewer({ file }: { file: PreviewFile }) {
  const [error, setError] = useState(false);

  return (
    <div className='flex-1 flex items-center justify-center p-4'>
      {error ? (
        <div className='text-center text-white'>
          <Video className='h-16 w-16 mx-auto mb-4 opacity-50' />
          <p>Failed to load video</p>
          <a
            href={file.url}
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary hover:underline mt-2 inline-block'
          >
            Open in new tab
          </a>
        </div>
      ) : (
        <video
          src={file.url}
          controls
          className='max-w-full max-h-full'
          onError={() => setError(true)}
        >
          Your browser does not support video playback.
        </video>
      )}
    </div>
  );
}

/**
 * Audio Viewer Component
 */
function AudioViewer({ file }: { file: PreviewFile }) {
  const [error, setError] = useState(false);

  return (
    <div className='flex-1 flex flex-col items-center justify-center p-8'>
      <div className='w-32 h-32 rounded-full bg-primary/20 flex items-center justify-center mb-8'>
        <Music className='h-16 w-16 text-primary' />
      </div>
      <p className='text-white text-lg mb-4 text-center'>{file.originalName}</p>
      {error ? (
        <div className='text-center text-white'>
          <p className='text-muted-foreground'>Failed to load audio</p>
          <a
            href={file.url}
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary hover:underline mt-2 inline-block'
          >
            Download file
          </a>
        </div>
      ) : (
        <audio
          src={file.url}
          controls
          className='w-full max-w-md'
          onError={() => setError(true)}
        >
          Your browser does not support audio playback.
        </audio>
      )}
    </div>
  );
}

/**
 * PDF Viewer Component
 */
function PDFViewer({ file }: { file: PreviewFile }) {
  const [error, setError] = useState(false);

  return (
    <div className='flex-1 flex flex-col'>
      {error ? (
        <div className='flex-1 flex flex-col items-center justify-center text-white'>
          <FileText className='h-16 w-16 mx-auto mb-4 opacity-50' />
          <p>Unable to preview PDF</p>
          <a
            href={file.url}
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary hover:underline mt-2'
          >
            Open in new tab
          </a>
        </div>
      ) : (
        <iframe
          src={`${file.url}#view=FitH`}
          className='flex-1 w-full bg-white'
          title={file.originalName}
          onError={() => setError(true)}
        />
      )}
    </div>
  );
}

/**
 * Generic File Viewer (for unsupported types)
 */
function GenericViewer({ file }: { file: PreviewFile }) {
  const category = getFileCategory(file.mimeType);
  const Icon = getFileIcon(category);

  return (
    <div className='flex-1 flex flex-col items-center justify-center p-8 text-white'>
      <div className='w-24 h-24 rounded-2xl bg-muted/20 flex items-center justify-center mb-6'>
        <Icon className='h-12 w-12 text-muted-foreground' />
      </div>
      <h3 className='text-xl font-medium mb-2 text-center'>
        {file.originalName}
      </h3>
      <p className='text-muted-foreground mb-1'>{file.mimeType}</p>
      <p className='text-muted-foreground mb-6'>{formatFileSize(file.size)}</p>
      <div className='flex gap-3'>
        <Button asChild>
          <a href={file.url} download={file.originalName}>
            <Download className='h-4 w-4 mr-2' />
            Download
          </a>
        </Button>
        <Button variant='outline' asChild>
          <a href={file.url} target='_blank' rel='noopener noreferrer'>
            <ExternalLink className='h-4 w-4 mr-2' />
            Open in new tab
          </a>
        </Button>
      </div>
    </div>
  );
}

/**
 * FilePreviewModal Component
 *
 * A full-screen modal for previewing files with support for:
 * - Images (with zoom, rotate controls)
 * - Videos (with native controls)
 * - Audio (with native controls)
 * - PDFs (embedded viewer)
 * - Other files (download/open options)
 */
export function FilePreviewModal({
  open,
  onOpenChange,
  file,
  files = [],
  onFileChange,
}: FilePreviewModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onOpenChange(false);
        }
      }

      // Arrow key navigation when there are multiple files
      if (files.length > 1 && file && onFileChange) {
        const currentIndex = files.findIndex(f => f.id === file.id);
        if (e.key === 'ArrowLeft' && currentIndex > 0) {
          onFileChange(files[currentIndex - 1]);
        }
        if (e.key === 'ArrowRight' && currentIndex < files.length - 1) {
          onFileChange(files[currentIndex + 1]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, file, files, onFileChange, onOpenChange, isFullscreen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open || !file) {
    return null;
  }

  const category = getFileCategory(file.mimeType);
  const currentIndex = files.findIndex(f => f.id === file.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < files.length - 1;

  const handlePrev = () => {
    if (hasPrev && onFileChange) {
      onFileChange(files[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext && onFileChange) {
      onFileChange(files[currentIndex + 1]);
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className='fixed inset-0 z-50 bg-black/95 flex flex-col'>
      {/* Header */}
      <div className='flex items-center justify-between p-4 bg-black/50 backdrop-blur-sm'>
        <div className='flex items-center gap-4 min-w-0'>
          <Button
            variant='ghost'
            size='icon'
            className='h-10 w-10 text-white hover:bg-white/20 shrink-0'
            onClick={() => onOpenChange(false)}
          >
            <X className='h-5 w-5' />
          </Button>
          <div className='min-w-0'>
            <h2 className='text-white font-medium truncate'>
              {file.originalName}
            </h2>
            <p className='text-sm text-muted-foreground'>
              {formatFileSize(file.size)}
              {file.uploadedBy &&
                ` • Uploaded by ${file.uploadedBy.displayName || file.uploadedBy.name}`}
            </p>
          </div>
        </div>

        <div className='flex items-center gap-2'>
          {files.length > 1 && (
            <span className='text-sm text-muted-foreground mr-2'>
              {currentIndex + 1} of {files.length}
            </span>
          )}
          <Button
            variant='ghost'
            size='icon'
            className='h-10 w-10 text-white hover:bg-white/20'
            onClick={handleDownload}
            title='Download'
          >
            <Download className='h-5 w-5' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            className='h-10 w-10 text-white hover:bg-white/20'
            onClick={() => window.open(file.url, '_blank')}
            title='Open in new tab'
          >
            <ExternalLink className='h-5 w-5' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            className='h-10 w-10 text-white hover:bg-white/20 hidden md:flex'
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className='h-5 w-5' />
            ) : (
              <Maximize2 className='h-5 w-5' />
            )}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className='flex-1 flex relative overflow-hidden'>
        {/* Previous button */}
        {files.length > 1 && hasPrev && (
          <Button
            variant='ghost'
            size='icon'
            className='absolute left-4 top-1/2 -translate-y-1/2 z-10 h-12 w-12 text-white hover:bg-white/20'
            onClick={handlePrev}
          >
            <ChevronLeft className='h-8 w-8' />
          </Button>
        )}

        {/* File viewer */}
        <div className='flex-1 flex flex-col'>
          {category === 'image' && <ImageViewer file={file} />}
          {category === 'video' && <VideoViewer file={file} />}
          {category === 'audio' && <AudioViewer file={file} />}
          {category === 'pdf' && <PDFViewer file={file} />}
          {!['image', 'video', 'audio', 'pdf'].includes(category) && (
            <GenericViewer file={file} />
          )}
        </div>

        {/* Next button */}
        {files.length > 1 && hasNext && (
          <Button
            variant='ghost'
            size='icon'
            className='absolute right-4 top-1/2 -translate-y-1/2 z-10 h-12 w-12 text-white hover:bg-white/20'
            onClick={handleNext}
          >
            <ChevronRight className='h-8 w-8' />
          </Button>
        )}
      </div>
    </div>
  );
}

export default FilePreviewModal;

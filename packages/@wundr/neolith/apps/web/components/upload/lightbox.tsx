'use client';

import { useCallback, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';
import { formatFileSize } from '@/types/upload';

import type { FileRecord } from '@/types/upload';

/**
 * Props for the Lightbox component
 */
interface LightboxProps {
  /** Array of images to display in the lightbox */
  images: FileRecord[];
  /** Index of the currently displayed image */
  currentIndex: number;
  /** Whether the lightbox is open */
  isOpen: boolean;
  /** Callback to close the lightbox */
  onClose: () => void;
  /** Callback to navigate to a specific image index */
  onNavigate: (index: number) => void;
  /** Callback when download is requested */
  onDownload?: (image: FileRecord) => void;
  /** Callback when share is requested */
  onShare?: (image: FileRecord) => void;
  /** Whether to show the image info panel toggle */
  showInfo?: boolean;
}

export function Lightbox({
  images,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
  onDownload,
  onShare,
  showInfo = true,
}: LightboxProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [scale, setScale] = useState(1);

  const currentImage = images[currentIndex];
  const hasMultiple = images.length > 1;
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  // Reset state when image changes
  useEffect(() => {
    setIsLoading(true);
    setScale(1);
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (hasPrevious) {
            onNavigate(currentIndex - 1);
          }
          break;
        case 'ArrowRight':
          if (hasNext) {
            onNavigate(currentIndex + 1);
          }
          break;
        case 'i':
          setShowInfoPanel(prev => !prev);
          break;
        case '+':
        case '=':
          setScale(prev => Math.min(prev + 0.25, 3));
          break;
        case '-':
          setScale(prev => Math.max(prev - 0.25, 0.5));
          break;
        case '0':
          setScale(1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, hasPrevious, hasNext, onClose, onNavigate]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  }, []);

  const handleResetZoom = useCallback(() => {
    setScale(1);
  }, []);

  if (!isOpen || !currentImage) {
    return null;
  }

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/90'
      onClick={handleBackdropClick}
      role='dialog'
      aria-modal='true'
      aria-label='Image lightbox'
    >
      {/* Header */}
      <div className='absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-4 py-3'>
        <div className='flex items-center gap-2 text-white/80'>
          {hasMultiple && (
            <span className='text-sm'>
              {currentIndex + 1} / {images.length}
            </span>
          )}
        </div>

        <div className='flex items-center gap-1'>
          {/* Zoom Controls */}
          <button
            type='button'
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            className={cn(
              'rounded-full p-2 text-white/80',
              'hover:bg-white/10 hover:text-white',
              'transition-colors duration-200',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'focus:outline-none focus:ring-2 focus:ring-white/50',
            )}
            aria-label='Zoom out'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
              className='h-5 w-5'
            >
              <circle cx='11' cy='11' r='8' />
              <path d='m21 21-4.3-4.3' />
              <path d='M8 11h6' />
            </svg>
          </button>

          <button
            type='button'
            onClick={handleResetZoom}
            className={cn(
              'min-w-[3rem] rounded-md px-2 py-1 text-sm text-white/80',
              'hover:bg-white/10 hover:text-white',
              'transition-colors duration-200',
              'focus:outline-none focus:ring-2 focus:ring-white/50',
            )}
            aria-label='Reset zoom'
          >
            {Math.round(scale * 100)}%
          </button>

          <button
            type='button'
            onClick={handleZoomIn}
            disabled={scale >= 3}
            className={cn(
              'rounded-full p-2 text-white/80',
              'hover:bg-white/10 hover:text-white',
              'transition-colors duration-200',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'focus:outline-none focus:ring-2 focus:ring-white/50',
            )}
            aria-label='Zoom in'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
              className='h-5 w-5'
            >
              <circle cx='11' cy='11' r='8' />
              <path d='m21 21-4.3-4.3' />
              <path d='M11 8v6' />
              <path d='M8 11h6' />
            </svg>
          </button>

          <div className='mx-2 h-6 w-px bg-white/20' />

          {/* Download Button */}
          {onDownload && (
            <button
              type='button'
              onClick={() => onDownload(currentImage)}
              className={cn(
                'rounded-full p-2 text-white/80',
                'hover:bg-white/10 hover:text-white',
                'transition-colors duration-200',
                'focus:outline-none focus:ring-2 focus:ring-white/50',
              )}
              aria-label='Download image'
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
                className='h-5 w-5'
              >
                <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
                <polyline points='7 10 12 15 17 10' />
                <line x1='12' x2='12' y1='15' y2='3' />
              </svg>
            </button>
          )}

          {/* Share Button */}
          {onShare && (
            <button
              type='button'
              onClick={() => onShare(currentImage)}
              className={cn(
                'rounded-full p-2 text-white/80',
                'hover:bg-white/10 hover:text-white',
                'transition-colors duration-200',
                'focus:outline-none focus:ring-2 focus:ring-white/50',
              )}
              aria-label='Share image'
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
                className='h-5 w-5'
              >
                <circle cx='18' cy='5' r='3' />
                <circle cx='6' cy='12' r='3' />
                <circle cx='18' cy='19' r='3' />
                <line x1='8.59' x2='15.42' y1='13.51' y2='17.49' />
                <line x1='15.41' x2='8.59' y1='6.51' y2='10.49' />
              </svg>
            </button>
          )}

          {/* Info Button */}
          {showInfo && (
            <button
              type='button'
              onClick={() => setShowInfoPanel(prev => !prev)}
              className={cn(
                'rounded-full p-2 text-white/80',
                'hover:bg-white/10 hover:text-white',
                'transition-colors duration-200',
                'focus:outline-none focus:ring-2 focus:ring-white/50',
                showInfoPanel && 'bg-white/10 text-white',
              )}
              aria-label='Toggle image info'
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
                className='h-5 w-5'
              >
                <circle cx='12' cy='12' r='10' />
                <path d='M12 16v-4' />
                <path d='M12 8h.01' />
              </svg>
            </button>
          )}

          <div className='mx-2 h-6 w-px bg-white/20' />

          {/* Close Button */}
          <button
            type='button'
            onClick={onClose}
            className={cn(
              'rounded-full p-2 text-white/80',
              'hover:bg-white/10 hover:text-white',
              'transition-colors duration-200',
              'focus:outline-none focus:ring-2 focus:ring-white/50',
            )}
            aria-label='Close lightbox'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
              className='h-5 w-5'
            >
              <line x1='18' x2='6' y1='6' y2='18' />
              <line x1='6' x2='18' y1='6' y2='18' />
            </svg>
          </button>
        </div>
      </div>

      {/* Navigation - Previous */}
      {hasMultiple && hasPrevious && (
        <button
          type='button'
          onClick={() => onNavigate(currentIndex - 1)}
          className={cn(
            'absolute left-4 z-10 rounded-full p-3',
            'bg-black/50 text-white/80',
            'hover:bg-black/70 hover:text-white',
            'transition-colors duration-200',
            'focus:outline-none focus:ring-2 focus:ring-white/50',
          )}
          aria-label='Previous image'
        >
          <svg
            xmlns='http://www.w3.org/2000/svg'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            className='h-6 w-6'
          >
            <path d='m15 18-6-6 6-6' />
          </svg>
        </button>
      )}

      {/* Navigation - Next */}
      {hasMultiple && hasNext && (
        <button
          type='button'
          onClick={() => onNavigate(currentIndex + 1)}
          className={cn(
            'absolute right-4 z-10 rounded-full p-3',
            'bg-black/50 text-white/80',
            'hover:bg-black/70 hover:text-white',
            'transition-colors duration-200',
            'focus:outline-none focus:ring-2 focus:ring-white/50',
          )}
          aria-label='Next image'
        >
          <svg
            xmlns='http://www.w3.org/2000/svg'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            className='h-6 w-6'
          >
            <path d='m9 18 6-6-6-6' />
          </svg>
        </button>
      )}

      {/* Image */}
      <div className='flex h-full w-full items-center justify-center overflow-hidden p-16'>
        {isLoading && (
          <div className='absolute'>
            <div className='h-10 w-10 animate-spin rounded-full border-2 border-white border-t-transparent' />
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentImage.url}
          alt={currentImage.name}
          onLoad={() => setIsLoading(false)}
          className={cn(
            'max-h-full max-w-full object-contain',
            'transition-all duration-200',
            isLoading && 'opacity-0',
          )}
          style={{
            transform: `scale(${scale})`,
          }}
          draggable={false}
        />
      </div>

      {/* Info Panel */}
      {showInfo && showInfoPanel && (
        <div
          className={cn(
            'absolute bottom-0 right-0 top-14 w-80 bg-black/80 p-4',
            'overflow-y-auto backdrop-blur-sm',
          )}
        >
          <h3 className='mb-4 text-lg font-semibold text-white'>Image Info</h3>
          <dl className='space-y-3 text-sm'>
            <div>
              <dt className='text-white/60'>Filename</dt>
              <dd className='mt-0.5 break-all text-white'>
                {currentImage.name}
              </dd>
            </div>
            <div>
              <dt className='text-white/60'>Size</dt>
              <dd className='mt-0.5 text-white'>
                {formatFileSize(currentImage.size)}
              </dd>
            </div>
            <div>
              <dt className='text-white/60'>Type</dt>
              <dd className='mt-0.5 text-white'>{currentImage.mimeType}</dd>
            </div>
            <div>
              <dt className='text-white/60'>Uploaded by</dt>
              <dd className='mt-0.5 text-white'>{currentImage.uploaderName}</dd>
            </div>
            <div>
              <dt className='text-white/60'>Uploaded on</dt>
              <dd className='mt-0.5 text-white'>
                {new Date(currentImage.createdAt).toLocaleDateString(
                  undefined,
                  {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  },
                )}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {/* Thumbnail Strip (for multiple images) */}
      {hasMultiple && (
        <div className='absolute bottom-4 left-1/2 z-10 -translate-x-1/2'>
          <div className='flex gap-2 rounded-lg bg-black/50 p-2 backdrop-blur-sm'>
            {images.map((image, index) => (
              <button
                key={image.id}
                type='button'
                onClick={() => onNavigate(index)}
                className={cn(
                  'h-12 w-12 overflow-hidden rounded-md',
                  'transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-white/50',
                  index === currentIndex
                    ? 'ring-2 ring-white'
                    : 'opacity-60 hover:opacity-100',
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.thumbnailUrl || image.url}
                  alt={`Thumbnail ${index + 1}`}
                  className='h-full w-full object-cover'
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useCallback, useState } from 'react';

import { cn } from '@/lib/utils';
import type { FileRecord } from '@/types/upload';

import { Lightbox } from './lightbox';

interface ImageGalleryProps {
  images: FileRecord[];
  columns?: 2 | 3 | 4 | 5;
  gap?: 'sm' | 'md' | 'lg';
  aspectRatio?: 'square' | 'video' | 'auto';
  onImageDownload?: (image: FileRecord) => void;
  className?: string;
}

export function ImageGallery({
  images,
  columns = 3,
  gap = 'md',
  aspectRatio = 'square',
  onImageDownload,
  className,
}: ImageGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleImageClick = useCallback((index: number) => {
    setCurrentIndex(index);
    setLightboxOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  const handleNavigate = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
  };

  const gapSize = {
    sm: 'gap-1',
    md: 'gap-2',
    lg: 'gap-4',
  };

  const aspect = {
    square: 'aspect-square',
    video: 'aspect-video',
    auto: '',
  };

  if (images.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mx-auto mb-2 h-12 w-12 opacity-50"
        >
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
        <p>No images to display</p>
      </div>
    );
  }

  return (
    <>
      <div className={cn('grid', gridCols[columns], gapSize[gap], className)}>
        {images.map((image, index) => (
          <button
            key={image.id}
            type="button"
            onClick={() => handleImageClick(index)}
            className={cn(
              'group relative overflow-hidden rounded-lg',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              'transition-all duration-200',
              aspect[aspectRatio]
            )}
          >
            <img
              src={image.thumbnailUrl || image.url}
              alt={image.name}
              className={cn(
                'h-full w-full object-cover',
                'transition-transform duration-300 group-hover:scale-105'
              )}
              loading="lazy"
            />

            {/* Hover Overlay */}
            <div
              className={cn(
                'absolute inset-0 flex items-center justify-center',
                'bg-black/40 opacity-0 transition-opacity duration-200',
                'group-hover:opacity-100'
              )}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-8 w-8"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
                <path d="M11 8v6" />
                <path d="M8 11h6" />
              </svg>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox */}
      <Lightbox
        images={images}
        currentIndex={currentIndex}
        isOpen={lightboxOpen}
        onClose={handleClose}
        onNavigate={handleNavigate}
        onDownload={onImageDownload}
      />
    </>
  );
}

interface ImageGalleryPreviewProps {
  images: FileRecord[];
  maxVisible?: number;
  onViewAll?: () => void;
  className?: string;
}

export function ImageGalleryPreview({
  images,
  maxVisible = 4,
  onViewAll,
  className,
}: ImageGalleryPreviewProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const visibleImages = images.slice(0, maxVisible);
  const remainingCount = images.length - maxVisible;

  const handleImageClick = useCallback((index: number) => {
    setCurrentIndex(index);
    setLightboxOpen(true);
  }, []);

  if (images.length === 0) {
    return null;
  }

  // Special layout for 1-4 images
  const getLayoutClass = () => {
    switch (visibleImages.length) {
      case 1:
        return 'grid-cols-1';
      case 2:
        return 'grid-cols-2';
      case 3:
        return 'grid-cols-2';
      default:
        return 'grid-cols-2';
    }
  };

  return (
    <>
      <div className={cn('grid gap-1 overflow-hidden rounded-lg', getLayoutClass(), className)}>
        {visibleImages.map((image, index) => (
          <button
            key={image.id}
            type="button"
            onClick={() => handleImageClick(index)}
            className={cn(
              'group relative overflow-hidden',
              'focus:outline-none focus:ring-2 focus:ring-primary',
              {
                'row-span-2': visibleImages.length === 3 && index === 0,
                'aspect-square': visibleImages.length > 1,
                'aspect-video': visibleImages.length === 1,
              }
            )}
          >
            <img
              src={image.thumbnailUrl || image.url}
              alt={image.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />

            {/* Show remaining count on last visible image */}
            {index === maxVisible - 1 && remainingCount > 0 && (
              <div
                className={cn(
                  'absolute inset-0 flex items-center justify-center',
                  'bg-black/60 text-white'
                )}
              >
                <span className="text-2xl font-bold">+{remainingCount}</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* View All Button */}
      {remainingCount > 0 && onViewAll && (
        <button
          type="button"
          onClick={onViewAll}
          className={cn(
            'mt-2 text-sm text-primary hover:underline',
            'focus:outline-none focus:underline'
          )}
        >
          View all {images.length} images
        </button>
      )}

      {/* Lightbox */}
      <Lightbox
        images={images}
        currentIndex={currentIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={setCurrentIndex}
      />
    </>
  );
}

'use client';

import { Crop, Loader2, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useState, useRef } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';

interface ImageCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  onCropComplete: (croppedImageBlob: Blob) => void;
  aspectRatio?: number;
}

export function ImageCropDialog({
  open,
  onOpenChange,
  imageUrl,
  onCropComplete,
  aspectRatio = 1,
}: ImageCropDialogProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !dragStartRef.current) {
        return;
      }

      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;

      setPosition(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));

      dragStartRef.current = { x: e.clientX, y: e.clientY };
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  const getCroppedImage = useCallback(async (): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    const image = imageRef.current;

    if (!canvas || !image) {
      return null;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }

    const outputSize = 512;
    canvas.width = outputSize;
    canvas.height = outputSize;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outputSize, outputSize);

    ctx.save();
    ctx.translate(outputSize / 2, outputSize / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);
    ctx.translate(-outputSize / 2, -outputSize / 2);

    const imageAspect = image.naturalWidth / image.naturalHeight;
    let drawWidth = outputSize;
    let drawHeight = outputSize;

    if (imageAspect > 1) {
      drawHeight = outputSize / imageAspect;
    } else {
      drawWidth = outputSize * imageAspect;
    }

    const offsetX = (outputSize - drawWidth) / 2 + position.x;
    const offsetY = (outputSize - drawHeight) / 2 + position.y;

    ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
    ctx.restore();

    return new Promise(resolve => {
      canvas.toBlob(
        blob => {
          resolve(blob);
        },
        'image/jpeg',
        0.95
      );
    });
  }, [zoom, rotation, position]);

  const handleCrop = useCallback(async () => {
    setIsProcessing(true);
    try {
      const blob = await getCroppedImage();
      if (blob) {
        onCropComplete(blob);
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error cropping image:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [getCroppedImage, onCropComplete, onOpenChange]);

  const handleRotate = useCallback(() => {
    setRotation(prev => (prev + 90) % 360);
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle>Crop Profile Picture</DialogTitle>
          <DialogDescription>
            Adjust your image by dragging, zooming, and rotating. Click crop
            when ready.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          {/* Image preview area */}
          <div
            ref={containerRef}
            className='relative mx-auto aspect-square w-full max-w-md cursor-move overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted'
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div
              className='absolute inset-0 flex items-center justify-center'
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              }}
            >
              <img
                ref={imageRef}
                src={imageUrl}
                alt='Crop preview'
                className='max-h-full max-w-full object-contain'
                draggable={false}
              />
            </div>
            {/* Crop overlay */}
            <div className='pointer-events-none absolute inset-0 border-4 border-primary/50 rounded-full' />
          </div>

          {/* Controls */}
          <div className='space-y-4'>
            {/* Zoom control */}
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <label className='flex items-center gap-2 text-sm font-medium'>
                  <ZoomIn className='h-4 w-4' />
                  Zoom
                </label>
                <span className='text-sm text-muted-foreground'>
                  {Math.round(zoom * 100)}%
                </span>
              </div>
              <Slider
                value={[zoom]}
                onValueChange={([value]) => setZoom(value)}
                min={0.5}
                max={3}
                step={0.1}
                className='w-full'
              />
            </div>

            {/* Action buttons */}
            <div className='flex items-center justify-between'>
              <div className='flex gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={handleRotate}
                  disabled={isProcessing}
                >
                  <RotateCw className='h-4 w-4 mr-2' />
                  Rotate
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={handleReset}
                  disabled={isProcessing}
                >
                  Reset
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button onClick={handleCrop} disabled={isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Processing...
              </>
            ) : (
              <>
                <Crop className='mr-2 h-4 w-4' />
                Crop & Save
              </>
            )}
          </Button>
        </DialogFooter>

        {/* Hidden canvas for image processing */}
        <canvas ref={canvasRef} className='hidden' />
      </DialogContent>
    </Dialog>
  );
}

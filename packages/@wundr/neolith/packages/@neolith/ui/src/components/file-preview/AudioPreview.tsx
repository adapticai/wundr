import * as React from 'react';
import { DownloadIcon, MusicIcon } from 'lucide-react';

import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

import { formatFileSize, truncateFilename } from './utils';

export interface AudioPreviewProps {
  filename: string;
  fileUrl: string;
  fileSize?: number;
  onDownload?: () => void;
  className?: string;
}

/**
 * Audio preview component with inline player
 * Displays audio player with file information
 */
export const AudioPreview = React.forwardRef<HTMLDivElement, AudioPreviewProps>(
  ({ filename, fileUrl, fileSize, onDownload, className }, ref) => {
    const [hasError, setHasError] = React.useState(false);
    const audioRef = React.useRef<HTMLAudioElement>(null);

    const handleDownload = () => {
      if (onDownload) {
        onDownload();
      } else {
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    };

    const handleAudioError = () => {
      setHasError(true);
    };

    return (
      <Card ref={ref} className={cn('overflow-hidden', className)}>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            {/* Audio icon */}
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
              <MusicIcon className="h-8 w-8 text-white" />
            </div>

            {/* File info and player */}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground" title={filename}>
                {truncateFilename(filename)}
              </p>
              {fileSize !== undefined && (
                <p className="text-sm text-muted-foreground">{formatFileSize(fileSize)}</p>
              )}

              {/* Audio player */}
              {!hasError ? (
                <audio
                  ref={audioRef}
                  src={fileUrl}
                  controls
                  className="mt-3 w-full"
                  onError={handleAudioError}
                  preload="metadata"
                >
                  Your browser does not support the audio element.
                </audio>
              ) : (
                <p className="mt-2 text-sm text-destructive">Unable to load audio file</p>
              )}
            </div>

            {/* Download button */}
            <div className="flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownload}
                title="Download audio"
                aria-label={`Download ${filename}`}
              >
                <DownloadIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  },
);

AudioPreview.displayName = 'AudioPreview';

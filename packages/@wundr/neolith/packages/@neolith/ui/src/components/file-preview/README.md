# File Preview Components

Beautiful file preview components for the Neolith UI library, similar to Slack's file previews.

## Components

### FilePreview (Main Component)

The main component that automatically selects the appropriate preview type based on file type.

```tsx
import { FilePreview } from '@neolith/ui';

// Image preview
<FilePreview
  filename="photo.jpg"
  fileUrl="/uploads/photo.jpg"
  fileSize={1024000}
  mimeType="image/jpeg"
/>

// With upload progress
<FilePreview
  filename="document.pdf"
  fileUrl="/uploads/document.pdf"
  isUploading={true}
  uploadProgress={45}
/>

// With error state
<FilePreview
  filename="file.txt"
  fileUrl="/uploads/file.txt"
  error="Upload failed. Please try again."
/>
```

### ImagePreview

Preview component for images with thumbnail and lightbox functionality.

**Features:**
- Thumbnail preview with configurable max height
- Click to open full-size image in modal
- Download button
- Loading and error states
- Hover overlay with "View full size" button

```tsx
import { ImagePreview } from '@neolith/ui';

<ImagePreview
  filename="sunset.jpg"
  fileUrl="/uploads/sunset.jpg"
  fileSize={2048000}
  alt="Beautiful sunset"
  maxThumbnailHeight={300}
/>
```

### VideoPreview

Video player preview with thumbnail and play button.

**Features:**
- Optional thumbnail image
- Play button overlay
- Native HTML5 video controls
- Download button
- Error handling

```tsx
import { VideoPreview } from '@neolith/ui';

<VideoPreview
  filename="demo.mp4"
  fileUrl="/uploads/demo.mp4"
  fileSize={10485760}
  thumbnailUrl="/uploads/demo-thumb.jpg"
  maxHeight={400}
/>
```

### AudioPreview

Audio player with waveform-style display.

**Features:**
- Music icon with gradient background
- Native HTML5 audio controls
- Download button
- File size display

```tsx
import { AudioPreview } from '@neolith/ui';

<AudioPreview
  filename="song.mp3"
  fileUrl="/uploads/song.mp3"
  fileSize={3145728}
/>
```

### DocumentPreview

Preview for PDFs and other document types.

**Features:**
- Color-coded icons by document type
- Optional PDF embedding
- Open in new tab button (for PDFs)
- Download button
- Extension badge

```tsx
import { DocumentPreview } from '@neolith/ui';

// PDF with preview
<DocumentPreview
  filename="report.pdf"
  fileUrl="/uploads/report.pdf"
  fileSize={512000}
  mimeType="application/pdf"
  showPreview={true}
/>

// Word document
<DocumentPreview
  filename="document.docx"
  fileUrl="/uploads/document.docx"
  fileSize={256000}
/>
```

### GenericFilePreview

Fallback component for files that don't have specialized previews.

**Features:**
- File type icon (document, code, archive, generic)
- Extension badge
- File size display
- Download button

```tsx
import { GenericFilePreview } from '@neolith/ui';

<GenericFilePreview
  filename="archive.zip"
  fileUrl="/uploads/archive.zip"
  fileSize={5242880}
  mimeType="application/zip"
/>
```

## Utility Functions

### formatFileSize

Format bytes to human-readable file size.

```tsx
import { formatFileSize } from '@neolith/ui';

formatFileSize(1024); // "1 KB"
formatFileSize(1048576); // "1 MB"
formatFileSize(0); // "0 Bytes"
```

### detectFileType

Detect file type from filename or MIME type.

```tsx
import { detectFileType } from '@neolith/ui';

detectFileType('photo.jpg'); // "image"
detectFileType('video.mp4'); // "video"
detectFileType('document.pdf'); // "document"
detectFileType('script.js'); // "code"
detectFileType('archive.zip'); // "archive"
detectFileType('unknown.xyz'); // "generic"
```

### getFileExtension

Extract file extension from filename.

```tsx
import { getFileExtension } from '@neolith/ui';

getFileExtension('document.pdf'); // "pdf"
getFileExtension('photo.JPG'); // "jpg"
getFileExtension('noextension'); // ""
```

### isPreviewableImage / isPreviewableVideo

Check if a file can be previewed as image/video.

```tsx
import { isPreviewableImage, isPreviewableVideo } from '@neolith/ui';

isPreviewableImage('photo.jpg'); // true
isPreviewableImage('document.pdf'); // false

isPreviewableVideo('movie.mp4'); // true
isPreviewableVideo('audio.mp3'); // false
```

### truncateFilename

Truncate long filenames while preserving extension.

```tsx
import { truncateFilename } from '@neolith/ui';

truncateFilename('very-long-filename-that-needs-truncation.pdf', 30);
// "very-long-filename-th...pdf"
```

## File Type Detection

The components automatically detect file types based on:

1. **MIME type** (if provided) - takes precedence
2. **File extension** - fallback detection

### Supported Types

- **Images**: jpg, jpeg, png, gif, webp, svg, bmp, ico
- **Videos**: mp4, webm, ogg, mov, avi, mkv, flv, wmv
- **Audio**: mp3, wav, ogg, flac, aac, m4a, wma
- **Documents**: pdf, doc, docx, xls, xlsx, ppt, pptx, txt, rtf, odt
- **Code**: js, jsx, ts, tsx, py, java, c, cpp, h, cs, php, rb, go, rs, swift, kt, scala, html, css, scss, json, xml, yml, yaml, md, sql
- **Archives**: zip, rar, 7z, tar, gz, bz2, xz

## Common Props

All preview components share these common props:

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `filename` | string | Yes | Name of the file |
| `fileUrl` | string | Yes | URL to the file |
| `fileSize` | number | No | File size in bytes |
| `mimeType` | string | No | MIME type of the file |
| `onDownload` | () => void | No | Custom download handler |
| `className` | string | No | Additional CSS classes |

## Upload States

The `FilePreview` component supports upload states:

```tsx
// Uploading state
<FilePreview
  filename="uploading.pdf"
  fileUrl="/uploads/uploading.pdf"
  isUploading={true}
  uploadProgress={65}
/>

// Error state
<FilePreview
  filename="failed.pdf"
  fileUrl="/uploads/failed.pdf"
  error="Network error occurred"
/>
```

## Styling

All components use Tailwind CSS and follow the design system from `@neolith/ui`. They support:

- Light and dark mode
- Responsive design
- Custom className prop for additional styling
- Consistent spacing and typography

## Accessibility

The components are built with accessibility in mind:

- Proper ARIA labels
- Keyboard navigation support
- Screen reader friendly
- Semantic HTML
- Focus states
- Alt text support for images

## Examples

### Message Attachment List

```tsx
function MessageAttachments({ attachments }: { attachments: Attachment[] }) {
  return (
    <div className="space-y-2">
      {attachments.map((attachment) => (
        <FilePreview
          key={attachment.id}
          filename={attachment.filename}
          fileUrl={attachment.url}
          fileSize={attachment.size}
          mimeType={attachment.mimeType}
          onDownload={() => downloadAttachment(attachment.id)}
        />
      ))}
    </div>
  );
}
```

### File Upload with Progress

```tsx
function FileUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    setFile(file);
    try {
      await uploadFile(file, (progress) => setProgress(progress));
    } catch (err) {
      setError('Upload failed');
    }
  };

  return (
    <div>
      <input type="file" onChange={(e) => handleUpload(e.target.files?.[0])} />
      {file && (
        <FilePreview
          filename={file.name}
          fileUrl={URL.createObjectURL(file)}
          fileSize={file.size}
          mimeType={file.type}
          isUploading={progress < 100}
          uploadProgress={progress}
          error={error}
        />
      )}
    </div>
  );
}
```

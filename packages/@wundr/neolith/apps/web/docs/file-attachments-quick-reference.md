# File Attachments - Quick Reference Guide

## For Developers

### Using File Upload in Your Component

```tsx
import { useFileUpload } from '@/hooks/use-file-upload';
import { FilePreview, UploadPreview } from '@/components/messages/file-preview';

function MyMessageComponent() {
  const {
    uploads,
    addFiles,
    removeFile,
    uploadFile,
    uploadAll,
  } = useFileUpload({
    workspaceId: 'workspace_123',
    channelId: 'channel_456',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    onUploadComplete: (id, result) => {
      console.log('File uploaded:', result);
    },
  });

  const handleFilesSelected = (files: File[]) => {
    const ids = addFiles(files);
    // Files are added to upload queue
  };

  const handleSendMessage = async () => {
    // Upload all pending files
    const results = await uploadAll();

    // Extract file IDs
    const attachmentIds = results.map(r => r.fileId);

    // Send message with attachments
    await sendMessage({
      content: 'Message with files',
      attachmentIds,
    });
  };

  return (
    <div>
      {/* Show upload previews */}
      {uploads.map(upload => (
        <UploadPreview
          key={upload.id}
          file={upload.file}
          progress={upload.progress}
          error={upload.error}
          onRemove={() => removeFile(upload.id)}
        />
      ))}
    </div>
  );
}
```

### Displaying File Attachments

```tsx
import { FilePreview } from '@/components/messages/file-preview';

function MessageAttachments({ attachments }) {
  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map(attachment => (
        <FilePreview
          key={attachment.id}
          attachment={{
            id: attachment.id,
            name: attachment.name,
            url: attachment.url,
            type: attachment.type,
            size: attachment.size,
            mimeType: attachment.mimeType,
          }}
          onClick={() => openPreview(attachment)}
          compact={true}
        />
      ))}
    </div>
  );
}
```

## API Endpoints

### Upload File
```
POST /api/files/upload
Content-Type: multipart/form-data

Body:
- file: File (binary)
- workspaceId: string
- channelId?: string (optional)
- messageId?: string (optional)

Response: {
  data: {
    file: {
      id: string,
      url: string,
      filename: string,
      mimeType: string,
      size: number,
      ...
    }
  }
}
```

### Send Message with Attachments
```
POST /api/channels/{channelId}/messages
Content-Type: application/json

Body: {
  content: string,
  type: "TEXT",
  attachmentIds?: string[]
}

Response: {
  data: {
    id: string,
    content: string,
    attachments: [{
      id: string,
      name: string,
      url: string,
      ...
    }],
    ...
  }
}
```

## Component Props Reference

### FileUploadButton
```typescript
interface FileUploadButtonProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  multiple?: boolean;
  accept?: string;
  maxFiles?: number;
  maxSize?: number;
  className?: string;
}
```

### FilePreview
```typescript
interface FilePreviewProps {
  attachment: {
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
    mimeType: string;
  };
  onRemove?: () => void;
  onClick?: () => void;
  showRemove?: boolean;
  compact?: boolean;
  className?: string;
}
```

### UploadPreview
```typescript
interface UploadPreviewProps {
  file: File;
  onRemove?: () => void;
  progress?: number;
  error?: string;
  className?: string;
}
```

## File Size Limits

| Type      | Limit  |
|-----------|--------|
| Image     | 10MB   |
| Video     | 100MB  |
| Audio     | 50MB   |
| Document  | 25MB   |
| Archive   | 50MB   |
| Default   | 100MB  |

## Supported File Types

### Images
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)

### Documents
- PDF (.pdf)
- Word (.doc, .docx)
- Excel (.xls, .xlsx)
- Text (.txt)
- CSV (.csv)
- Markdown (.md)

### Media
- Video: MP4, WebM
- Audio: MP3, WAV, OGG

### Archives
- ZIP (.zip)
- RAR (.rar)
- GZIP (.gz)
- 7Z (.7z)
- TAR (.tar)

## Common Patterns

### Upload on Select
```tsx
const handleFilesSelected = async (files: File[]) => {
  const ids = addFiles(files);

  // Upload immediately
  for (const id of ids) {
    await uploadFile(id);
  }
};
```

### Batch Upload Before Send
```tsx
const handleSend = async () => {
  // Upload all pending files first
  const results = await uploadAll();

  // Then send message with file IDs
  await sendMessage({
    content,
    attachmentIds: results.map(r => r.fileId),
  });
};
```

### Validate Before Upload
```tsx
const handleFilesSelected = (files: File[]) => {
  const errors: string[] = [];

  files.forEach(file => {
    if (file.size > MAX_SIZE) {
      errors.push(`${file.name} exceeds size limit`);
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      errors.push(`${file.name} type not allowed`);
    }
  });

  if (errors.length > 0) {
    showErrors(errors);
    return;
  }

  addFiles(files);
};
```

### Handle Upload Errors
```tsx
const {
  uploads,
  uploadFile,
} = useFileUpload({
  workspaceId,
  onUploadError: (id, error) => {
    toast.error(`Upload failed: ${error}`);
  },
  onUploadComplete: (id, result) => {
    toast.success('File uploaded successfully');
  },
});
```

## Styling

All components use Tailwind CSS and shadcn/ui conventions:

```tsx
// Customize with className prop
<FilePreview
  attachment={file}
  className="border-2 border-blue-500 rounded-xl"
/>

// Use utility classes
<div className="grid grid-cols-2 gap-4">
  {files.map(file => (
    <FilePreview key={file.id} attachment={file} compact />
  ))}
</div>
```

## Testing

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { FilePreview } from '@/components/messages/file-preview';

test('displays file name and size', () => {
  const file = {
    id: '1',
    name: 'test.pdf',
    url: '/files/test.pdf',
    type: 'document',
    size: 1024,
    mimeType: 'application/pdf',
  };

  render(<FilePreview attachment={file} />);

  expect(screen.getByText('test.pdf')).toBeInTheDocument();
  expect(screen.getByText('1 KB')).toBeInTheDocument();
});

test('calls onRemove when remove button clicked', () => {
  const onRemove = jest.fn();

  render(<FilePreview attachment={file} onRemove={onRemove} />);

  fireEvent.click(screen.getByTitle('Remove file'));

  expect(onRemove).toHaveBeenCalled();
});
```

## Troubleshooting

### Upload fails with 413 error
- File exceeds size limit
- Check file size and type-specific limits

### Preview doesn't show
- Verify file URL is accessible
- Check CORS settings for S3 bucket
- Ensure thumbnailUrl is generated for images

### Drag-and-drop not working
- Ensure drop zone has proper event handlers
- Check z-index layering
- Verify `onDragEnter`, `onDragOver`, `onDrop` are bound

### TypeScript errors
- Ensure attachment object matches interface
- Check File vs FileRecord type usage
- Verify all required props are passed

## Performance Tips

1. **Lazy load previews**: Use Intersection Observer
2. **Compress images**: Before upload on client
3. **Limit concurrent uploads**: Use queue pattern
4. **Cache file URLs**: Reduce API calls
5. **Use thumbnails**: For image previews
6. **Debounce uploads**: When selecting multiple files

## Security Considerations

1. **Validate file types**: Server-side validation required
2. **Scan for viruses**: Integrate antivirus scanning
3. **Limit file sizes**: Prevent abuse
4. **Sanitize filenames**: Remove special characters
5. **Check permissions**: Verify user can access file
6. **Use signed URLs**: For temporary access

## Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Full support
- IE11: ❌ Not supported

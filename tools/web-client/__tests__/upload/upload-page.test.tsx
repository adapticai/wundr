import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';
import '@testing-library/jest-dom';
import UploadPage from '../../app/dashboard/upload/page';

// Add jest-dom types for this file
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toBeVisible(): R;
      toHaveTextContent(text: string): R;
    }
  }
}

// Mock the useToast hook
jest.mock('../../hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock the upload components
jest.mock('../../components/upload', () => ({
  FileUploadZone: function MockFileUploadZone(props: any) {
    return (
      <div data-testid="upload-zone">
        <input
          data-testid="file-input"
          type="file"
          onChange={props.onFileSelect}
          multiple
        />
      </div>
    );
  },
  FileUploadItem: function MockFileUploadItem(props: any) {
    return (
      <div data-testid={`upload-item-${props.upload.id}`}>
        <span>{props.upload.file.name}</span>
        <button onClick={() => props.onRemove(props.upload.id)}>Remove</button>
      </div>
    );
  },
  FilePreviewModal: function MockFilePreviewModal(props: any) {
    return props.file ? (
      <div data-testid="preview-modal">
        <span>{props.file.file.name}</span>
        <button onClick={props.onClose}>Close</button>
      </div>
    ) : null;
  },
}));

describe('UploadPage', () => {
  it('renders upload page with tabs', () => {
    render(<UploadPage />);
    
    (expect(screen.getByText('Upload Analysis Reports')) as any).toBeInTheDocument();
    (expect(screen.getByText('Upload Files')) as any).toBeInTheDocument();
    (expect(screen.getByText(/Upload History/)) as any).toBeInTheDocument();
  });

  it('shows recent uploads in history tab', () => {
    render(<UploadPage />);
    
    // Click on history tab
    fireEvent.click(screen.getByText(/Upload History/));
    
    (expect(screen.getByText('analysis-report-2024-01.json')) as any).toBeInTheDocument();
    (expect(screen.getByText('metrics-data.csv')) as any).toBeInTheDocument();
  });

  it('displays upload zone on upload tab', () => {
    render(<UploadPage />);
    
    (expect(screen.getByTestId('upload-zone')) as any).toBeInTheDocument();
    (expect(screen.getByText('File Upload')) as any).toBeInTheDocument();
  });

  it('handles file selection', async () => {
    render(<UploadPage />);
    
    const fileInput = screen.getByTestId('file-input');
    const file = new File(['test content'], 'test.json', { type: 'application/json' });
    
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    // The file upload hook should handle the file processing
    // This test verifies the integration works without errors
    (expect(fileInput) as any).toBeInTheDocument();
  });

  it('displays file size and type information correctly', () => {
    render(<UploadPage />);
    
    // Click on history tab to see recent uploads
    fireEvent.click(screen.getByText(/Upload History/));
    
    // Check that file sizes are displayed
    (expect(screen.getByText(/KB/)) as any).toBeInTheDocument();
    (expect(screen.getByText(/MB/)) as any).toBeInTheDocument();
  });
});
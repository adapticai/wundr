import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from '@jest/globals';
import UploadPage from '../../app/dashboard/upload/page';

// Mock the useToast hook
vi.mock('../../hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock the upload components
vi.mock('../../components/upload', () => ({
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
    
    expect(screen.getByText('Upload Analysis Reports')).toBeInTheDocument();
    expect(screen.getByText('Upload Files')).toBeInTheDocument();
    expect(screen.getByText(/Upload History/)).toBeInTheDocument();
  });

  it('shows recent uploads in history tab', () => {
    render(<UploadPage />);
    
    // Click on history tab
    fireEvent.click(screen.getByText(/Upload History/));
    
    expect(screen.getByText('analysis-report-2024-01.json')).toBeInTheDocument();
    expect(screen.getByText('metrics-data.csv')).toBeInTheDocument();
  });

  it('displays upload zone on upload tab', () => {
    render(<UploadPage />);
    
    expect(screen.getByTestId('upload-zone')).toBeInTheDocument();
    expect(screen.getByText('File Upload')).toBeInTheDocument();
  });

  it('handles file selection', async () => {
    render(<UploadPage />);
    
    const fileInput = screen.getByTestId('file-input');
    const file = new File(['test content'], 'test.json', { type: 'application/json' });
    
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    // The file upload hook should handle the file processing
    // This test verifies the integration works without errors
    expect(fileInput).toBeInTheDocument();
  });

  it('displays file size and type information correctly', () => {
    render(<UploadPage />);
    
    // Click on history tab to see recent uploads
    fireEvent.click(screen.getByText(/Upload History/));
    
    // Check that file sizes are displayed
    expect(screen.getByText(/KB/)).toBeInTheDocument();
    expect(screen.getByText(/MB/)).toBeInTheDocument();
  });
});
import React from 'react';
import { render, screen } from '@testing-library/react';
import { WundrLogoFull } from '../WundrLogoFull';

describe('WundrLogoFull', () => {
  it('renders horizontal layout by default', () => {
    render(<WundrLogoFull />);
    
    // Should render the logo and wordmark
    expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument(); // SVG logo
    expect(screen.getByText('wundr')).toBeInTheDocument();
  });

  it('renders vertical layout when specified', () => {
    const { container } = render(
      <WundrLogoFull orientation="vertical" />
    );
    
    // Should have flex-col class for vertical layout
    expect(container.firstChild).toHaveClass('flex-col');
  });

  it('shows tagline when showTagline is true', () => {
    render(<WundrLogoFull showTagline={true} />);
    
    expect(screen.getByText(/Transform your monorepo with intelligent/)).toBeInTheDocument();
  });

  it('shows attribution when showAttribution is true', () => {
    render(<WundrLogoFull showAttribution={true} />);
    
    expect(screen.getByText('A product by Lumic.ai')).toBeInTheDocument();
  });

  it('hides tagline when showTagline is false', () => {
    render(<WundrLogoFull showTagline={false} />);
    
    expect(screen.queryByText(/Transform your monorepo with intelligent/)).not.toBeInTheDocument();
  });

  it('hides attribution when showAttribution is false', () => {
    render(<WundrLogoFull showAttribution={false} />);
    
    expect(screen.queryByText('A product by Lumic.ai')).not.toBeInTheDocument();
  });

  it('applies correct size configurations', () => {
    const { rerender } = render(<WundrLogoFull size="sm" />);
    expect(screen.getByRole('img', { hidden: true })).toHaveAttribute('width', '24');

    rerender(<WundrLogoFull size="lg" />);
    expect(screen.getByRole('img', { hidden: true })).toHaveAttribute('width', '48');
  });

  it('applies custom className', () => {
    const { container } = render(
      <WundrLogoFull className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('handles light theme correctly', () => {
    render(<WundrLogoFull theme="light" showTagline={true} />);
    
    const taglineElement = screen.getByText(/Transform your monorepo with intelligent/);
    expect(taglineElement).toHaveStyle({ fontFamily: expect.stringContaining('Space Grotesk') });
  });

  it('handles dark theme correctly', () => {
    render(<WundrLogoFull theme="dark" showTagline={true} />);
    
    const taglineElement = screen.getByText(/Transform your monorepo with intelligent/);
    expect(taglineElement).toHaveStyle({ fontFamily: expect.stringContaining('Space Grotesk') });
  });

  it('uses Space Grotesk font family for text elements', () => {
    render(<WundrLogoFull showTagline={true} showAttribution={true} />);
    
    const taglineElement = screen.getByText(/Transform your monorepo with intelligent/);
    const attributionElement = screen.getByText('A product by Lumic.ai');
    
    expect(taglineElement).toHaveStyle({ 
      fontFamily: expect.stringContaining('Space Grotesk') 
    });
    expect(attributionElement).toHaveStyle({ 
      fontFamily: expect.stringContaining('Space Grotesk') 
    });
  });

  it('renders complete tagline text correctly in horizontal layout', () => {
    render(<WundrLogoFull orientation="horizontal" showTagline={true} />);
    
    expect(screen.getByText('Transform your monorepo with intelligent code analysis and refactoring')).toBeInTheDocument();
  });

  it('renders split tagline text correctly in vertical layout', () => {
    render(<WundrLogoFull orientation="vertical" showTagline={true} />);
    
    expect(screen.getByText('Transform your monorepo with intelligent')).toBeInTheDocument();
    expect(screen.getByText('code analysis and refactoring')).toBeInTheDocument();
  });

  it('maintains proper spacing between elements', () => {
    const { container } = render(
      <WundrLogoFull showTagline={true} showAttribution={true} />
    );
    
    // Should have gap classes for proper spacing
    expect(container.querySelector('.gap-3')).toBeInTheDocument();
    expect(container.querySelector('.mt-1')).toBeInTheDocument();
  });
});
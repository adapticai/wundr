import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { {{className}} } from './{{fileName}}';

describe('{{className}}', () => {
  it('renders without crashing', () => {
    render(<{{className}} />);
  });

  it('displays the component name', () => {
    render(<{{className}} />);
    expect(screen.getByText('{{className}}')).toBeInTheDocument();
  });

  // Add more tests here
});
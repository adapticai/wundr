/**
 * @fileoverview Shared component types
 */

import { ReactNode } from 'react';

export interface ComponentBaseProps {
  className?: string;
  children?: ReactNode;
  id?: string;
  'data-testid'?: string;
}

export type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type Variant = 'default' | 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link';
// Core types and interfaces
export interface WundrConfig {
  name: string;
  version: string;
  description?: string;
}

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}
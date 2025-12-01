/**
 * AFTER: Consolidated Types with Shared Package
 *
 * This demonstrates the solution: creating shared type packages and extending
 * base types for service-specific needs while maintaining consistency.
 */

// Package: @company/shared-types
export namespace SharedTypes {
  // Base user type - single source of truth
  export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    role: UserRole;
  }

  // Standardized enums
  export enum UserRole {
    ADMIN = 'admin',
    USER = 'user',
    MODERATOR = 'moderator',
  }

  // Base address type - consistent across all services
  export interface Address {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  }

  // Common status types
  export enum OrderStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    SHIPPED = 'shipped',
    DELIVERED = 'delivered',
    CANCELLED = 'cancelled',
  }

  export enum PaymentStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
    REFUNDED = 'refunded',
  }

  export enum NotificationStatus {
    PENDING = 'pending',
    SENT = 'sent',
    FAILED = 'failed',
    DELIVERED = 'delivered',
  }

  // Common utility types
  export interface AuditableEntity {
    createdAt: Date;
    updatedAt: Date;
  }

  export interface Identifiable {
    id: string;
  }

  // Base pagination and filtering
  export interface PaginationRequest {
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }

  export interface PaginationResponse<T> {
    data: T[];
    pagination: {
      page: number;
      limit: number;
      totalItems: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  }
}

// Package: @company/user-service
import { SharedTypes } from '@company/shared-types';

export namespace UserService {
  // Use base User type directly
  export type User = SharedTypes.User;

  // Use base Address type directly
  export type Address = SharedTypes.Address;

  // Extend base types for service-specific needs
  export interface CreateUserRequest {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    role?: SharedTypes.UserRole;
  }

  export interface UpdateUserRequest {
    firstName?: string;
    lastName?: string;
    isActive?: boolean;
    role?: SharedTypes.UserRole;
  }

  // Service-specific extensions when needed
  export interface UserWithPreferences extends SharedTypes.User {
    preferences: {
      theme: 'light' | 'dark';
      language: string;
      timezone: string;
    };
  }

  export interface UserProfile extends SharedTypes.User {
    address?: SharedTypes.Address;
    phoneNumber?: string;
    bio?: string;
    profilePictureUrl?: string;
  }
}

// Package: @company/order-service
import { SharedTypes } from '@company/shared-types';

export namespace OrderService {
  // Use shared types consistently
  export type User = SharedTypes.User;
  export type Address = SharedTypes.Address;
  export type OrderStatus = SharedTypes.OrderStatus;

  export interface Order
    extends SharedTypes.AuditableEntity, SharedTypes.Identifiable {
    userId: string;
    user: User; // Consistent with shared User type
    shippingAddress: Address; // Consistent Address type
    billingAddress?: Address;
    items: OrderItem[];
    subtotal: number;
    tax: number;
    shipping: number;
    total: number;
    status: OrderStatus;
  }

  export interface OrderItem {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }

  // Service-specific types can still extend shared ones
  export interface OrderWithUser extends Order {
    user: UserService.UserProfile; // Use extended user type when needed
  }
}

// Package: @company/auth-service
import { SharedTypes } from '@company/shared-types';

export namespace AuthService {
  // Extend base User for auth-specific fields
  export interface AuthUser extends SharedTypes.User {
    hashedPassword: string;
    isEmailVerified: boolean;
    lastLoginAt?: Date;
    failedLoginAttempts: number;
    lockedUntil?: Date;
  }

  export interface LoginRequest {
    email: string;
    password: string;
  }

  export interface RegisterRequest {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    role?: SharedTypes.UserRole;
  }

  export interface AuthToken {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: 'Bearer';
    user: Pick<SharedTypes.User, 'id' | 'email' | 'role'>; // Subset of shared User
  }

  // Transform functions to convert between types
  export function toSharedUser(authUser: AuthUser): SharedTypes.User {
    const {
      hashedPassword,
      isEmailVerified,
      lastLoginAt,
      failedLoginAttempts,
      lockedUntil,
      ...user
    } = authUser;
    return user;
  }
}

// Package: @company/notification-service
import { SharedTypes } from '@company/shared-types';

export namespace NotificationService {
  // Extend User for notification-specific needs
  export interface NotificationUser extends Pick<
    SharedTypes.User,
    'id' | 'email' | 'firstName' | 'lastName'
  > {
    preferredLanguage: string;
    timezone: string;
    notificationPreferences: {
      email: boolean;
      sms: boolean;
      push: boolean;
    };
  }

  // Use shared Address type
  export type ContactAddress = SharedTypes.Address;

  export interface NotificationTemplate
    extends SharedTypes.AuditableEntity, SharedTypes.Identifiable {
    name: string;
    subject: string;
    body: string;
    type: 'email' | 'sms' | 'push';
    variables: string[];
  }

  export interface Notification
    extends SharedTypes.AuditableEntity, SharedTypes.Identifiable {
    userId: string;
    templateId: string;
    recipient: string;
    subject: string;
    content: string;
    status: SharedTypes.NotificationStatus;
    sentAt?: Date;
    deliveredAt?: Date;
  }

  // Helper to create NotificationUser from base User
  export function createNotificationUser(
    user: SharedTypes.User,
    preferences: NotificationUser['notificationPreferences'],
    language: string = 'en',
    timezone: string = 'UTC'
  ): NotificationUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      preferredLanguage: language,
      timezone,
      notificationPreferences: preferences,
    };
  }
}

// Package: @company/payment-service
import { SharedTypes } from '@company/shared-types';

export namespace PaymentService {
  // Create payment-specific user type
  export interface PaymentUser extends Pick<SharedTypes.User, 'id' | 'email'> {
    displayName: string; // Computed from firstName + lastName
    billingAddress: SharedTypes.Address;
    paymentMethods: PaymentMethod[];
  }

  export interface PaymentMethod
    extends SharedTypes.AuditableEntity, SharedTypes.Identifiable {
    userId: string;
    type: 'credit_card' | 'debit_card' | 'bank_account' | 'paypal';
    last4?: string;
    expiryMonth?: number;
    expiryYear?: number;
    brand?: string;
    isDefault: boolean;
  }

  export interface Payment
    extends SharedTypes.AuditableEntity, SharedTypes.Identifiable {
    orderId: string;
    userId: string;
    amount: number;
    currency: string;
    status: SharedTypes.PaymentStatus;
    paymentMethodId: string;
    transactionId?: string;
    processedAt?: Date;
    refundedAt?: Date;
    refundAmount?: number;
  }

  // Helper to create PaymentUser from base User
  export function createPaymentUser(
    user: SharedTypes.User,
    billingAddress: SharedTypes.Address,
    paymentMethods: PaymentMethod[] = []
  ): PaymentUser {
    return {
      id: user.id,
      email: user.email,
      displayName: `${user.firstName} ${user.lastName}`,
      billingAddress,
      paymentMethods,
    };
  }
}

// Package: @company/analytics-service
import { SharedTypes } from '@company/shared-types';

export namespace AnalyticsService {
  // Analytics-specific user type with privacy considerations
  export interface AnalyticsUser extends Pick<
    SharedTypes.User,
    'id' | 'createdAt'
  > {
    emailHash?: string; // Hashed email for privacy
    segment: string;
    lastActiveDate: Date;
    metrics: UserMetrics;
  }

  export interface UserMetrics {
    totalOrders: number;
    totalSpent: number;
    averageOrderValue: number;
    lifetimeValue: number;
    orderFrequency: number;
    lastOrderDate?: Date;
  }

  export interface UserEvent
    extends SharedTypes.AuditableEntity, SharedTypes.Identifiable {
    userId: string;
    eventType: string;
    eventData: Record<string, any>;
    sessionId?: string;
    source: string;
    timestamp: Date;
  }

  export interface UserSegment
    extends SharedTypes.AuditableEntity, SharedTypes.Identifiable {
    name: string;
    description: string;
    criteria: Record<string, any>;
    userCount: number;
    isActive: boolean;
  }

  // Helper to create analytics user from base user (with privacy)
  export function createAnalyticsUser(
    user: SharedTypes.User,
    metrics: UserMetrics,
    segment: string,
    includeEmailHash: boolean = false
  ): AnalyticsUser {
    return {
      id: user.id,
      createdAt: user.createdAt,
      emailHash: includeEmailHash ? hashEmail(user.email) : undefined,
      segment,
      lastActiveDate: new Date(),
      metrics,
    };
  }

  function hashEmail(email: string): string {
    // Simple hash function for demo - use proper crypto in real implementation
    return btoa(email).slice(0, 8);
  }
}

// Package: @company/api-types (for API contracts)
import { SharedTypes } from '@company/shared-types';

export namespace ApiTypes {
  // Standardized API response formats
  export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
      code: string;
      message: string;
      details?: Record<string, any>;
    };
    timestamp: Date;
  }

  // Standardized pagination for APIs
  export type PaginatedResponse<T> = ApiResponse<
    SharedTypes.PaginationResponse<T>
  >;

  // Common API user representation
  export interface ApiUser extends SharedTypes.User {
    // Add any API-specific fields that should always be included
    fullName: string; // Computed field
    roleName: string; // Human-readable role
  }

  // Helper to convert internal User to API representation
  export function toApiUser(user: SharedTypes.User): ApiUser {
    return {
      ...user,
      fullName: `${user.firstName} ${user.lastName}`,
      roleName: formatRole(user.role),
    };
  }

  function formatRole(role: SharedTypes.UserRole): string {
    const roleMap = {
      [SharedTypes.UserRole.ADMIN]: 'Administrator',
      [SharedTypes.UserRole.USER]: 'User',
      [SharedTypes.UserRole.MODERATOR]: 'Moderator',
    };
    return roleMap[role] || 'Unknown';
  }
}

/**
 * Benefits of this AFTER structure:
 *
 * 1. SINGLE SOURCE OF TRUTH:
 *    - Base types defined once in shared package
 *    - Consistent field names and types across all services
 *    - Centralized enum definitions
 *
 * 2. EXTENSIBILITY:
 *    - Services can extend base types for specific needs
 *    - Helper functions to transform between related types
 *    - Service-specific fields don't pollute base types
 *
 * 3. MAINTAINABILITY:
 *    - Changes to base types propagate automatically
 *    - Type safety across package boundaries
 *    - Clear relationships between types
 *
 * 4. DEVELOPER EXPERIENCE:
 *    - IntelliSense works across packages
 *    - Fewer bugs due to type mismatches
 *    - Easier refactoring with type safety
 *
 * 5. API CONSISTENCY:
 *    - Standardized response formats
 *    - Consistent field naming across all APIs
 *    - Predictable data structures for frontend teams
 */

/**
 * Implementation strategy:
 *
 * 1. Create @company/shared-types package first
 * 2. Migrate one service at a time to use shared types
 * 3. Add transformation helpers for complex migrations
 * 4. Update APIs to use consistent types
 * 5. Remove duplicate type definitions gradually
 * 6. Add linting rules to prevent future duplication
 */

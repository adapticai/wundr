/**
 * BEFORE: Duplicate Types Across Packages
 *
 * This demonstrates a common monorepo problem where similar types are duplicated
 * across different packages, leading to maintenance issues and inconsistencies.
 */

// Package: @company/user-service
export namespace UserService {
  // Duplicated user type definition
  export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    role: 'admin' | 'user' | 'moderator';
  }

  // Duplicated address type
  export interface Address {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  }

  // Service-specific but similar types
  export interface CreateUserRequest {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    role?: 'admin' | 'user' | 'moderator';
  }

  export interface UpdateUserRequest {
    firstName?: string;
    lastName?: string;
    isActive?: boolean;
    role?: 'admin' | 'user' | 'moderator';
  }
}

// Package: @company/order-service
export namespace OrderService {
  // Nearly identical user type with slight differences
  export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    createdAt: string; // Different type: string vs Date
    isActive: boolean;
    role: string; // Less specific than user-service
    // Missing updatedAt field
  }

  // Duplicate address type with different field names
  export interface ShippingAddress {
    streetAddress: string; // Different field name
    city: string;
    state: string;
    postalCode: string; // Different field name
    country: string;
  }

  export interface Order {
    id: string;
    userId: string;
    user: User; // Using local User type
    shippingAddress: ShippingAddress;
    items: OrderItem[];
    total: number;
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
    createdAt: Date;
    updatedAt: Date;
  }

  export interface OrderItem {
    productId: string;
    quantity: number;
    price: number;
    name: string;
  }
}

// Package: @company/auth-service
export namespace AuthService {
  // Another duplicate user type with different structure
  export interface AuthUser {
    userId: string; // Different field name
    email: string;
    firstName: string;
    lastName: string;
    hashedPassword: string; // Auth-specific field
    role: 'ADMIN' | 'USER' | 'MODERATOR'; // Different casing
    isEmailVerified: boolean; // Auth-specific field
    lastLoginAt?: Date;
    createdAt: Date;
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
  }

  export interface AuthToken {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: 'Bearer';
  }
}

// Package: @company/notification-service
export namespace NotificationService {
  // Yet another user type variation
  export interface NotificationUser {
    id: string;
    email: string;
    fullName: string; // Combined firstName + lastName
    preferredLanguage: string;
    timezone: string;
    notificationPreferences: {
      email: boolean;
      sms: boolean;
      push: boolean;
    };
  }

  // Duplicate address for notification preferences
  export interface ContactAddress {
    line1: string; // Different structure
    line2?: string;
    city: string;
    region: string; // Different from state
    postal: string; // Different from zipCode
    countryCode: string; // Different from country
  }

  export interface NotificationTemplate {
    id: string;
    name: string;
    subject: string;
    body: string;
    type: 'email' | 'sms' | 'push';
    variables: string[];
  }

  export interface Notification {
    id: string;
    userId: string;
    user: NotificationUser;
    templateId: string;
    recipient: string;
    subject: string;
    content: string;
    status: 'pending' | 'sent' | 'failed' | 'delivered';
    sentAt?: Date;
    createdAt: Date;
  }
}

// Package: @company/payment-service
export namespace PaymentService {
  // Another user variant for payment processing
  export interface PaymentUser {
    customerId: string; // Different naming convention
    email: string;
    name: string; // Single name field
    billingAddress: BillingAddress;
    paymentMethods: PaymentMethod[];
  }

  // Yet another address variation
  export interface BillingAddress {
    addressLine1: string;
    addressLine2?: string;
    locality: string; // Different from city
    administrativeArea: string; // Different from state
    postalCode: string;
    countryCode: string;
  }

  export interface PaymentMethod {
    id: string;
    type: 'credit_card' | 'debit_card' | 'bank_account' | 'paypal';
    last4?: string;
    expiryMonth?: number;
    expiryYear?: number;
    isDefault: boolean;
  }

  export interface Payment {
    id: string;
    orderId: string;
    userId: string;
    amount: number;
    currency: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
    paymentMethodId: string;
    createdAt: Date;
    processedAt?: Date;
  }
}

// Package: @company/analytics-service
export namespace AnalyticsService {
  // Simplified user type for analytics
  export interface AnalyticsUser {
    id: string;
    email?: string; // Optional for privacy
    segment: string;
    registrationDate: Date;
    lastActiveDate: Date;
    totalOrders: number;
    totalSpent: number;
    averageOrderValue: number;
  }

  export interface UserEvent {
    userId: string;
    eventType: string;
    eventData: Record<string, any>;
    timestamp: Date;
    sessionId?: string;
    source: string;
  }

  export interface UserSegment {
    id: string;
    name: string;
    criteria: Record<string, any>;
    userCount: number;
    createdAt: Date;
    updatedAt: Date;
  }
}

/**
 * Problems with this BEFORE structure:
 *
 * 1. TYPE INCONSISTENCY:
 *    - Same concepts (User, Address) have different field names and types
 *    - createdAt is Date in some places, string in others
 *    - role field has different enum values and casing
 *
 * 2. MAINTENANCE BURDEN:
 *    - Changes to user structure require updates in 6+ places
 *    - No single source of truth for common types
 *    - Risk of forgetting to update all instances
 *
 * 3. INTEGRATION ISSUES:
 *    - Services can't easily share data due to type mismatches
 *    - Type conversions needed everywhere
 *    - API contracts become inconsistent
 *
 * 4. DEVELOPMENT FRICTION:
 *    - Developers must remember subtle differences between types
 *    - Copy-paste programming leads to more duplicates
 *    - Refactoring becomes error-prone
 *
 * 5. TESTING COMPLEXITY:
 *    - Mock data must account for all type variations
 *    - Integration tests need type adapters
 *    - Type safety is reduced across package boundaries
 */

/**
 * Symptoms in the codebase:
 *
 * - Lots of type assertion and conversion functions
 * - Mapping/adapter layers between services
 * - Inconsistent API responses
 * - Bugs related to field name mismatches
 * - Difficulty adding new fields to shared concepts
 * - Code duplication in type definitions
 */

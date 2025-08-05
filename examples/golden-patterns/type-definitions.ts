/**
 * GOLDEN PATTERN: Type Definitions and TypeScript Best Practices
 * 
 * This file demonstrates best practices for defining types in monorepo environments,
 * including proper type organization, utility types, and advanced TypeScript patterns.
 */

// Base utility types for common patterns
export type ID = string;
export type Timestamp = Date;
export type Email = string;
export type URL = string;

// Branded types for better type safety
export type UserId = ID & { readonly __brand: 'UserId' };
export type OrderId = ID & { readonly __brand: 'OrderId' };
export type ProductId = ID & { readonly __brand: 'ProductId' };

// Type constructors for branded types
export const UserId = (id: string): UserId => id as UserId;
export const OrderId = (id: string): OrderId => id as OrderId;
export const ProductId = (id: string): ProductId => id as ProductId;

// Common audit fields that can be composed into entities
export interface AuditableEntity {
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly createdBy?: UserId;
  readonly updatedBy?: UserId;
}

export interface SoftDeletableEntity {
  readonly deletedAt?: Timestamp;
  readonly deletedBy?: UserId;
  readonly isDeleted: boolean;
}

export interface VersionedEntity {
  readonly version: number;
}

// Comprehensive entity base that can be extended
export interface BaseEntity extends AuditableEntity {
  readonly id: ID;
}

// Domain-specific enums with clear naming
export enum UserRole {
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  USER = 'user',
  GUEST = 'guest'
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification'
}

export enum OrderStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

export enum PaymentStatus {
  PENDING = 'pending',
  AUTHORIZED = 'authorized',
  CAPTURED = 'captured',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

// Well-structured domain entities
export interface User extends BaseEntity, SoftDeletableEntity {
  readonly id: UserId;
  readonly email: Email;
  readonly firstName: string;
  readonly lastName: string;
  readonly role: UserRole;
  readonly status: UserStatus;
  readonly emailVerified: boolean;
  readonly lastLoginAt?: Timestamp;
  readonly profile?: UserProfile;
}

export interface UserProfile extends BaseEntity {
  readonly userId: UserId;
  readonly avatar?: URL;
  readonly bio?: string;
  readonly dateOfBirth?: Date;
  readonly phoneNumber?: string;
  readonly address?: Address;
  readonly preferences: UserPreferences;
}

export interface UserPreferences {
  readonly theme: 'light' | 'dark' | 'auto';
  readonly language: string;
  readonly timezone: string;
  readonly notifications: NotificationPreferences;
  readonly privacy: PrivacyPreferences;
}

export interface NotificationPreferences {
  readonly email: boolean;
  readonly sms: boolean;
  readonly push: boolean;
  readonly marketing: boolean;
}

export interface PrivacyPreferences {
  readonly profileVisibility: 'public' | 'private' | 'friends';
  readonly showEmail: boolean;
  readonly showPhone: boolean;
  readonly allowDataCollection: boolean;
}

export interface Address {
  readonly street: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly country: string;
  readonly coordinates?: {
    readonly latitude: number;
    readonly longitude: number;
  };
}

// Product domain types
export interface Product extends BaseEntity, SoftDeletableEntity, VersionedEntity {
  readonly id: ProductId;
  readonly sku: string;
  readonly name: string;
  readonly description: string;
  readonly price: Money;
  readonly category: ProductCategory;
  readonly tags: readonly string[];
  readonly images: readonly ProductImage[];
  readonly inventory: ProductInventory;
  readonly attributes: ProductAttributes;
}

export interface ProductCategory extends BaseEntity {
  readonly name: string;
  readonly slug: string;
  readonly parentId?: ProductId;
  readonly description?: string;
  readonly imageUrl?: URL;
}

export interface ProductImage {
  readonly url: URL;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly isPrimary: boolean;
}

export interface ProductInventory {
  readonly quantity: number;
  readonly reserved: number;
  readonly available: number;
  readonly lowStockThreshold: number;
  readonly isInStock: boolean;
}

export interface ProductAttributes {
  readonly weight?: number;
  readonly dimensions?: {
    readonly length: number;
    readonly width: number;
    readonly height: number;
  };
  readonly color?: string;
  readonly size?: string;
  readonly material?: string;
  readonly [key: string]: any; // Allow for dynamic attributes
}

// Money type for proper currency handling
export interface Money {
  readonly amount: number;
  readonly currency: CurrencyCode;
}

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CAD' | 'AUD';

// Order domain types
export interface Order extends BaseEntity, VersionedEntity {
  readonly id: OrderId;
  readonly userId: UserId;
  readonly status: OrderStatus;
  readonly items: readonly OrderItem[];
  readonly shipping: ShippingInfo;
  readonly billing: BillingInfo;
  readonly payment: PaymentInfo;
  readonly totals: OrderTotals;
  readonly notes?: string;
}

export interface OrderItem {
  readonly productId: ProductId;
  readonly quantity: number;
  readonly unitPrice: Money;
  readonly totalPrice: Money;
  readonly productSnapshot: ProductSnapshot; // Capture product state at time of order
}

export interface ProductSnapshot {
  readonly name: string;
  readonly description: string;
  readonly sku: string;
  readonly attributes: ProductAttributes;
}

export interface ShippingInfo {
  readonly address: Address;
  readonly method: ShippingMethod;
  readonly cost: Money;
  readonly estimatedDelivery?: Date;
  readonly trackingNumber?: string;
}

export interface ShippingMethod {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly estimatedDays: number;
}

export interface BillingInfo {
  readonly address: Address;
  readonly sameAsShipping: boolean;
}

export interface PaymentInfo {
  readonly method: PaymentMethod;
  readonly status: PaymentStatus;
  readonly transactionId?: string;
  readonly processedAt?: Timestamp;
}

export interface PaymentMethod {
  readonly type: 'credit_card' | 'debit_card' | 'paypal' | 'stripe' | 'bank_transfer';
  readonly last4?: string;
  readonly brand?: string;
  readonly expiryMonth?: number;
  readonly expiryYear?: number;
}

export interface OrderTotals {
  readonly subtotal: Money;
  readonly tax: Money;
  readonly shipping: Money;
  readonly discount: Money;
  readonly total: Money;
}

// Request/Response types for APIs
export interface CreateUserRequest {
  readonly email: Email;
  readonly firstName: string;
  readonly lastName: string;
  readonly password: string;
  readonly role?: UserRole;
}

export interface UpdateUserRequest {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly status?: UserStatus;
  readonly profile?: Partial<UserProfile>;
}

export interface CreateProductRequest {
  readonly sku: string;
  readonly name: string;
  readonly description: string;
  readonly price: Money;
  readonly categoryId: ProductId;
  readonly tags?: readonly string[];
  readonly inventory: Pick<ProductInventory, 'quantity' | 'lowStockThreshold'>;
  readonly attributes?: ProductAttributes;
}

export interface UpdateProductRequest {
  readonly name?: string;
  readonly description?: string;
  readonly price?: Money;
  readonly categoryId?: ProductId;
  readonly tags?: readonly string[];
  readonly inventory?: Partial<ProductInventory>;
  readonly attributes?: Partial<ProductAttributes>;
}

export interface CreateOrderRequest {
  readonly userId: UserId;
  readonly items: readonly {
    readonly productId: ProductId;
    readonly quantity: number;
  }[];
  readonly shipping: {
    readonly address: Address;
    readonly methodId: string;
  };
  readonly billing: {
    readonly address: Address;
    readonly sameAsShipping?: boolean;
  };
  readonly paymentMethod: PaymentMethod;
  readonly notes?: string;
}

// Query and pagination types
export interface PaginationRequest {
  readonly page: number;
  readonly limit: number;
  readonly sortBy?: string;
  readonly sortOrder?: 'asc' | 'desc';
}

export interface PaginationResponse<T> {
  readonly data: readonly T[];
  readonly pagination: {
    readonly page: number;
    readonly limit: number;
    readonly totalItems: number;
    readonly totalPages: number;
    readonly hasNext: boolean;
    readonly hasPrevious: boolean;
  };
}

export interface SearchRequest extends PaginationRequest {
  readonly query?: string;
  readonly filters?: Record<string, any>;
}

export interface UserSearchFilters {
  readonly role?: UserRole;
  readonly status?: UserStatus;
  readonly emailVerified?: boolean;
  readonly createdAfter?: Date;
  readonly createdBefore?: Date;
}

export interface ProductSearchFilters {
  readonly categoryId?: ProductId;
  readonly priceMin?: number;
  readonly priceMax?: number;
  readonly inStock?: boolean;
  readonly tags?: readonly string[];
}

export interface OrderSearchFilters {
  readonly userId?: UserId;
  readonly status?: OrderStatus;
  readonly createdAfter?: Date;
  readonly createdBefore?: Date;
  readonly minTotal?: number;
  readonly maxTotal?: number;
}

// API Response types
export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: ApiError;
  readonly timestamp: Timestamp;
  readonly requestId?: string;
}

export interface ApiError {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, any>;
  readonly field?: string;
}

export interface ValidationError extends ApiError {
  readonly field: string;
  readonly value?: any;
  readonly constraint: string;
}

// Event types for domain events
export interface DomainEvent<T = any> {
  readonly id: string;
  readonly type: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly payload: T;
  readonly timestamp: Timestamp;
  readonly version: number;
}

export interface UserCreatedEvent extends DomainEvent<{
  readonly userId: UserId;
  readonly email: Email;
  readonly role: UserRole;
}> {
  readonly type: 'user.created';
  readonly aggregateType: 'User';
}

export interface UserUpdatedEvent extends DomainEvent<{
  readonly userId: UserId;
  readonly changes: Partial<User>;
  readonly previousData: Partial<User>;
}> {
  readonly type: 'user.updated';
  readonly aggregateType: 'User';
}

export interface OrderCreatedEvent extends DomainEvent<{
  readonly orderId: OrderId;
  readonly userId: UserId;
  readonly total: Money;
  readonly itemCount: number;
}> {
  readonly type: 'order.created';
  readonly aggregateType: 'Order';
}

export interface PaymentProcessedEvent extends DomainEvent<{
  readonly orderId: OrderId;
  readonly paymentId: string;
  readonly amount: Money;
  readonly status: PaymentStatus;
}> {
  readonly type: 'payment.processed';
  readonly aggregateType: 'Payment';
}

// Advanced utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type Required<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Type-safe object operations
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

export type PickByType<T, U> = Pick<T, KeysOfType<T, U>>;
export type OmitByType<T, U> = Omit<T, KeysOfType<T, U>>;

// Database-related types
export interface DatabaseEntity extends BaseEntity {
  readonly id: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type EntityCreationAttributes<T extends DatabaseEntity> = Omit<
  T,
  'id' | 'createdAt' | 'updatedAt'
>;

export type EntityUpdateAttributes<T extends DatabaseEntity> = Partial<
  Omit<T, 'id' | 'createdAt' | 'updatedAt'>
>;

// Repository pattern types
export interface Repository<T extends DatabaseEntity, ID = string> {
  findById(id: ID): Promise<T | null>;
  findMany(options?: QueryOptions): Promise<T[]>;
  create(data: EntityCreationAttributes<T>): Promise<T>;
  update(id: ID, data: EntityUpdateAttributes<T>): Promise<T>;
  delete(id: ID): Promise<void>;
  count(filters?: Record<string, any>): Promise<number>;
}

export interface QueryOptions {
  readonly where?: Record<string, any>;
  readonly orderBy?: Record<string, 'asc' | 'desc'>;
  readonly skip?: number;
  readonly take?: number;
  readonly include?: Record<string, boolean | QueryOptions>;
}

// Service layer types
export interface DomainService<TEntity, TCreateRequest, TUpdateRequest, TId = string> {
  create(data: TCreateRequest): Promise<TEntity>;
  findById(id: TId): Promise<TEntity | null>;
  update(id: TId, data: TUpdateRequest): Promise<TEntity>;
  delete(id: TId): Promise<void>;
  findMany(options?: ServiceQueryOptions): Promise<TEntity[]>;
}

export interface ServiceQueryOptions extends QueryOptions {
  readonly pagination?: PaginationRequest;
  readonly search?: string;
}

// Configuration types
export interface DatabaseConfig {
  readonly url: string;
  readonly maxConnections: number;
  readonly ssl: boolean;
  readonly timeout: number;
  readonly logging: boolean;
}

export interface RedisConfig {
  readonly url: string;
  readonly keyPrefix: string;
  readonly defaultTTL: number;
  readonly maxRetries: number;
}

export interface EmailConfig {
  readonly provider: 'sendgrid' | 'mailgun' | 'ses';
  readonly apiKey: string;
  readonly fromAddress: string;
  readonly replyToAddress?: string;
  readonly templates: Record<string, string>;
}

export interface AuthConfig {
  readonly jwtSecret: string;
  readonly jwtExpiresIn: string;
  readonly refreshTokenExpiresIn: string;
  readonly bcryptRounds: number;
  readonly sessionTimeout: number;
}

export interface AppConfig {
  readonly environment: 'development' | 'staging' | 'production';
  readonly port: number;
  readonly host: string;
  readonly corsOrigins: readonly string[];
  readonly database: DatabaseConfig;
  readonly redis: RedisConfig;
  readonly email: EmailConfig;
  readonly auth: AuthConfig;
  readonly logging: {
    readonly level: 'debug' | 'info' | 'warn' | 'error';
    readonly format: 'json' | 'text';
  };
}

// Type guards for runtime type checking
export const isUser = (value: any): value is User => {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.id === 'string' &&
    typeof value.email === 'string' &&
    typeof value.firstName === 'string' &&
    typeof value.lastName === 'string' &&
    Object.values(UserRole).includes(value.role) &&
    Object.values(UserStatus).includes(value.status)
  );
};

export const isProduct = (value: any): value is Product => {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.id === 'string' &&
    typeof value.sku === 'string' &&
    typeof value.name === 'string' &&
    typeof value.price === 'object' &&
    typeof value.price.amount === 'number' &&
    typeof value.price.currency === 'string'
  );
};

export const isOrder = (value: any): value is Order => {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.id === 'string' &&
    typeof value.userId === 'string' &&
    Object.values(OrderStatus).includes(value.status) &&
    Array.isArray(value.items)
  );
};

// Type assertion helpers
export const assertIsUser = (value: any): asserts value is User => {
  if (!isUser(value)) {
    throw new Error('Value is not a valid User');
  }
};

export const assertIsProduct = (value: any): asserts value is Product => {
  if (!isProduct(value)) {
    throw new Error('Value is not a valid Product');
  }
};

export const assertIsOrder = (value: any): asserts value is Order => {
  if (!isOrder(value)) {
    throw new Error('Value is not a valid Order');
  }
};

// Conditional types for advanced patterns
export type NonNullable<T> = T extends null | undefined ? never : T;

export type Flatten<T> = T extends readonly (infer U)[] ? U : T;

export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

export type IsUnion<T> = [T] extends [UnionToIntersection<T>] ? false : true;

// Template literal types for type-safe string patterns
export type EmailPattern = `${string}@${string}.${string}`;
export type URLPattern = `http${'s' | ''}://${string}`;
export type UUIDPattern = `${string}-${string}-${string}-${string}-${string}`;

// Mapped types for transformations
export type Nullable<T> = {
  [P in keyof T]: T[P] | null;
};

export type Timestamps<T> = T & {
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type WithId<T> = T & {
  readonly id: string;
};

export type ApiResponseType<T> = T extends (...args: any[]) => Promise<infer R>
  ? R extends ApiResponse<infer D>
    ? D
    : never
  : never;

/**
 * Benefits of these type definition patterns:
 * 
 * 1. TYPE SAFETY:
 *    - Branded types prevent ID confusion
 *    - Comprehensive domain modeling
 *    - Runtime type checking with guards
 * 
 * 2. MAINTAINABILITY:
 *    - Single source of truth for types
 *    - Composable type building blocks
 *    - Clear separation of concerns
 * 
 * 3. DEVELOPER EXPERIENCE:
 *    - Excellent IntelliSense support
 *    - Compile-time error detection
 *    - Self-documenting interfaces
 * 
 * 4. REUSABILITY:
 *    - Utility types for common patterns
 *    - Generic interfaces for repositories
 *    - Configurable service patterns
 * 
 * 5. SCALABILITY:
 *    - Easy to extend without breaking changes
 *    - Proper versioning support
 *    - Clean API contracts
 * 
 * 6. INTEROPERABILITY:
 *    - Consistent types across packages
 *    - Proper serialization support
 *    - Database mapping compatibility
 */

// Export collections for easier imports
export type {
  // Core entities
  User,
  Product,
  Order,
  
  // Request/Response types
  CreateUserRequest,
  UpdateUserRequest,
  CreateProductRequest,
  UpdateProductRequest,
  CreateOrderRequest,
  
  // API types
  ApiResponse,
  PaginationRequest,
  PaginationResponse,
  
  // Configuration
  AppConfig,
  DatabaseConfig,
  
  // Events
  DomainEvent,
  UserCreatedEvent,
  OrderCreatedEvent,
  
  // Utilities
  Optional,
  DeepReadonly,
  Repository
};

export {
  // Enums
  UserRole,
  UserStatus,
  OrderStatus,
  PaymentStatus,
  
  // Type guards
  isUser,
  isProduct,
  isOrder,
  
  // Assertions
  assertIsUser,
  assertIsProduct,
  assertIsOrder,
  
  // Constructors
  UserId,
  OrderId,
  ProductId
};
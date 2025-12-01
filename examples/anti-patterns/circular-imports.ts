/**
 * ANTI-PATTERN: Circular Imports
 *
 * This file demonstrates common circular import anti-patterns that should be avoided
 * in monorepo environments. Circular imports can cause build failures, runtime errors,
 * and make code difficult to understand and maintain.
 */

// L BAD: Direct circular imports between modules
// File: user-service.ts
export class UserService {
  constructor(private orderService: OrderService) {}

  async getUserOrders(userId: string) {
    // This creates a circular dependency: UserService -> OrderService -> UserService
    return this.orderService.getOrdersByUser(userId);
  }

  async createUser(userData: any) {
    // Business logic here...
    return { id: '123', ...userData };
  }
}

// File: order-service.ts
export class OrderService {
  constructor(private userService: UserService) {}

  async getOrdersByUser(userId: string) {
    // Circular dependency: OrderService -> UserService -> OrderService
    const user = await this.userService.createUser({ id: userId });
    return [{ orderId: '456', userId: user.id }];
  }
}

// L BAD: Indirect circular imports through multiple files
// File: auth/auth.service.ts
import { UserProfileService } from '../profile/profile.service';

export class AuthService {
  constructor(private profileService: UserProfileService) {}

  async authenticate(token: string) {
    const profile = await this.profileService.getProfile(token);
    return { authenticated: true, profile };
  }
}

// File: profile/profile.service.ts
import { PermissionService } from '../permissions/permission.service';

export class UserProfileService {
  constructor(private permissionService: PermissionService) {}

  async getProfile(userId: string) {
    const permissions = await this.permissionService.getUserPermissions(userId);
    return { userId, permissions };
  }
}

// File: permissions/permission.service.ts
import { AuthService } from '../auth/auth.service';

export class PermissionService {
  constructor(private authService: AuthService) {}

  async getUserPermissions(userId: string) {
    // This creates a circular chain: Auth -> Profile -> Permission -> Auth
    const authResult = await this.authService.authenticate(userId);
    return authResult.profile.permissions || [];
  }
}

// L BAD: Circular imports in type definitions
// File: types/user.types.ts
import { Order } from './order.types';

export interface User {
  id: string;
  name: string;
  orders: Order[]; // Importing Order type
}

// File: types/order.types.ts
import { User } from './user.types';

export interface Order {
  id: string;
  user: User; // Importing User type - creates circular dependency
  total: number;
}

// L BAD: Barrel exports creating circular dependencies
// File: index.ts (barrel export)
export * from './user.service';
export * from './order.service';
export * from './payment.service';

// File: user.service.ts
import { OrderService, PaymentService } from './index'; // Circular through barrel

export class UserServiceBad {
  constructor(
    private orderService: OrderService,
    private paymentService: PaymentService
  ) {}
}

// File: order.service.ts
import { UserService, PaymentService } from './index'; // Circular through barrel

export class OrderServiceBad {
  constructor(
    private userService: UserService,
    private paymentService: PaymentService
  ) {}
}

/**
 * Common symptoms of circular imports:
 *
 * 1. Build errors: "Cannot resolve circular dependency"
 * 2. Runtime errors: "Cannot access before initialization"
 * 3. Undefined imports at runtime
 * 4. TypeScript compilation failures
 * 5. Webpack/bundler warnings about circular dependencies
 * 6. Jest test failures with module resolution issues
 *
 * Impact on monorepos:
 * - Breaks tree-shaking and dead code elimination
 * - Causes build cache invalidation cascades
 * - Makes dependency analysis tools fail
 * - Prevents proper package boundaries
 * - Complicates automated refactoring
 */

/**
 * Detection strategies:
 *
 * 1. Use tools like madge, dependency-cruiser, or circular-dependency-plugin
 * 2. Enable TypeScript strict mode and circular dependency checks
 * 3. Use ESLint rules like import/no-cycle
 * 4. Implement CI checks for circular dependencies
 * 5. Use architectural decision records (ADRs) to define import boundaries
 */

// Example detection command for madge:
// npx madge --circular --extensions ts,tsx src/

/**
 * Solutions (see golden-patterns for proper implementations):
 *
 * 1. Dependency Injection with interfaces
 * 2. Event-driven architecture
 * 3. Shared abstractions in common packages
 * 4. Repository pattern
 * 5. Service locator pattern
 * 6. Proper layered architecture
 */

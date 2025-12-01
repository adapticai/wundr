/**
 * ANTI-PATTERN: String Throws and Poor Error Handling
 *
 * This file demonstrates error handling anti-patterns that make debugging difficult,
 * reduce code maintainability, and prevent proper error recovery in monorepo environments.
 */

// L BAD: Throwing raw strings instead of Error objects
export class UserServiceBad {
  async createUser(userData: any) {
    if (!userData.email) {
      // Anti-pattern: Raw string throw - loses stack trace and context
      throw 'Email is required';
    }

    if (!userData.password) {
      // Anti-pattern: No error context or type information
      throw 'Password missing';
    }

    try {
      return await this.saveUser(userData);
    } catch (error) {
      // Anti-pattern: Re-throwing with string loses original error
      throw 'Failed to create user';
    }
  }

  private async saveUser(userData: any) {
    // Simulated database error
    throw new Error('Database connection failed');
  }
}

// L BAD: Mixing error types and inconsistent handling
export class OrderServiceBad {
  async processOrder(orderId: string) {
    try {
      const order = await this.getOrder(orderId);

      if (!order) {
        // Anti-pattern: Throwing different types of errors
        throw null; // This will break error handling
      }

      if (order.status === 'cancelled') {
        // Anti-pattern: Throwing primitive values
        throw 404;
      }

      if (order.total <= 0) {
        // Anti-pattern: Throwing objects without proper structure
        throw { message: 'Invalid total', code: 'INVALID_AMOUNT' };
      }

      return await this.chargePayment(order);
    } catch (error) {
      // Anti-pattern: Catching all errors and throwing generic message
      throw 'Order processing failed';
    }
  }

  private async getOrder(orderId: string) {
    if (orderId === 'invalid') {
      throw 'Order not found'; // String throw
    }
    return { id: orderId, status: 'pending', total: 100 };
  }

  private async chargePayment(order: any) {
    if (order.total > 1000) {
      throw new Error('Amount too high'); // Proper Error object
    }
    return { success: true };
  }
}

// L BAD: Silent failures and poor error propagation
export class PaymentServiceBad {
  async processPayment(amount: number, cardToken: string) {
    try {
      if (amount <= 0) {
        // Anti-pattern: Returning false instead of throwing
        return false;
      }

      const result = await this.chargeCard(cardToken, amount);

      if (!result.success) {
        // Anti-pattern: Silent failure - no indication of what failed
        console.log('Payment failed'); // Only logging, not throwing
        return null;
      }

      return result;
    } catch (error) {
      // Anti-pattern: Swallowing errors completely
      console.error('Error occurred:', error);
      return undefined; // Caller has no idea what happened
    }
  }

  private async chargeCard(token: string, amount: number) {
    if (!token) {
      throw 'No token provided'; // String throw
    }

    if (token === 'expired') {
      throw { error: 'Token expired', code: 401 }; // Object throw
    }

    return { success: true, transactionId: '123' };
  }
}

// L BAD: Error handling that makes debugging impossible
export class AuthServiceBad {
  async login(username: string, password: string) {
    try {
      if (!username || !password) {
        // Anti-pattern: Vague error messages
        throw 'Invalid input';
      }

      const user = await this.findUser(username);
      const isValid = await this.validatePassword(user, password);

      if (!isValid) {
        // Anti-pattern: Security through obscurity with poor error handling
        throw 'Login failed';
      }

      return this.generateToken(user);
    } catch (error) {
      // Anti-pattern: Logging error but throwing different message
      console.error('Authentication error:', error);
      throw 'System error occurred';
    }
  }

  private async findUser(username: string): Promise<any> {
    if (username === 'notfound') {
      throw 'User does not exist'; // String throw
    }
    return { id: '1', username, passwordHash: 'hash123' };
  }

  private async validatePassword(
    user: any,
    password: string
  ): Promise<boolean> {
    if (password === 'wrong') {
      throw false; // Anti-pattern: Throwing boolean
    }
    return true;
  }

  private generateToken(user: any): string {
    if (!user.id) {
      throw new Date(); // Anti-pattern: Throwing irrelevant object
    }
    return 'token123';
  }
}

// L BAD: Async/await error handling anti-patterns
export class DataServiceBad {
  async fetchUserData(userId: string) {
    // Anti-pattern: Not handling promise rejections
    const userData = this.getUserFromDB(userId);
    const userPrefs = this.getPreferencesFromAPI(userId);
    const userStats = this.getStatsFromCache(userId);

    // This will cause unhandled promise rejections if any fail
    return {
      user: await userData,
      preferences: await userPrefs,
      stats: await userStats,
    };
  }

  private async getUserFromDB(userId: string) {
    if (userId === 'error') {
      throw 'Database error'; // String throw
    }
    return { id: userId, name: 'John' };
  }

  private async getPreferencesFromAPI(userId: string) {
    if (userId === 'timeout') {
      throw 408; // Number throw
    }
    return { theme: 'dark' };
  }

  private async getStatsFromCache(userId: string) {
    if (userId === 'cache-miss') {
      throw { type: 'CacheError', missing: true }; // Object throw
    }
    return { visits: 42 };
  }
}

/**
 * Problems with these anti-patterns:
 *
 * 1. Loss of stack traces when throwing strings/primitives
 * 2. Inconsistent error types make centralized handling impossible
 * 3. Vague error messages make debugging difficult
 * 4. Silent failures hide important issues
 * 5. Swallowing errors prevents proper error recovery
 * 6. No error context or categorization
 * 7. Breaks error monitoring and alerting systems
 * 8. Makes unit testing error scenarios difficult
 * 9. Prevents proper error boundaries in applications
 * 10. Complicates error logging and aggregation
 */

/**
 * Impact on monorepos:
 *
 * - Makes cross-package error handling inconsistent
 * - Breaks error propagation between services
 * - Complicates centralized error monitoring
 * - Makes it hard to establish error handling standards
 * - Prevents proper error categorization for different packages
 * - Breaks automated error recovery mechanisms
 */

/**
 * Common symptoms:
 *
 * 1. "Cannot read property of undefined" errors in error handlers
 * 2. Missing stack traces in production logs
 * 3. Difficulty reproducing bugs
 * 4. Inconsistent error responses across APIs
 * 5. Unhandled promise rejections
 * 6. Silent failures leading to corrupt data
 * 7. Poor user experience with generic error messages
 */

/**
 * Detection strategies:
 *
 * 1. Use ESLint rules: no-throw-literal, prefer-promise-reject-errors
 * 2. TypeScript strict mode catches some patterns
 * 3. Error monitoring tools (Sentry, Bugsnag) can detect patterns
 * 4. Code reviews focusing on error handling paths
 * 5. Unit tests for error scenarios
 * 6. Static analysis tools for error handling patterns
 */

// Example ESLint configuration:
/*
{
  "rules": {
    "no-throw-literal": "error",
    "prefer-promise-reject-errors": "error"
  }
}
*/

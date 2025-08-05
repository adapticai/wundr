/**
 * User repository interface following repository pattern
 */
import { User, UserProps } from '../models/User';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: User): Promise<User>;
  update(user: User): Promise<User>;
  delete(id: string): Promise<void>;
  findAll(limit?: number, offset?: number): Promise<User[]>;
}

/**
 * In-memory implementation for demo purposes
 */
export class InMemoryUserRepository implements UserRepository {
  private users: Map<string, UserProps> = new Map();

  async findById(id: string): Promise<User | null> {
    const userData = this.users.get(id);
    return userData ? User.fromPersistence(userData) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const userData of this.users.values()) {
      if (userData.email === email) {
        return User.fromPersistence(userData);
      }
    }
    return null;
  }

  async create(user: User): Promise<User> {
    const userData = user.toJSON();
    this.users.set(userData.id, userData);
    return user;
  }

  async update(user: User): Promise<User> {
    const userData = user.toJSON();
    this.users.set(userData.id, userData);
    return user;
  }

  async delete(id: string): Promise<void> {
    this.users.delete(id);
  }

  async findAll(limit: number = 100, offset: number = 0): Promise<User[]> {
    const allUsers = Array.from(this.users.values());
    return allUsers
      .slice(offset, offset + limit)
      .map(userData => User.fromPersistence(userData));
  }
}
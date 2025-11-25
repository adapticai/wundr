/**
 * Database Seed Script
 *
 * Creates initial development data for the Genesis App.
 * Run with: npm run db:seed or npx prisma db seed
 */

import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed data configuration
 */
const SEED_DATA = {
  // Test organization
  organization: {
    name: 'Acme Corp',
    slug: 'acme-corp',
    description: 'A test organization for development and testing purposes',
  },

  // Test users
  users: [
    {
      email: 'admin@acme-corp.test',
      name: 'Admin User',
      role: UserRole.ADMIN,
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
    },
    {
      email: 'member@acme-corp.test',
      name: 'Regular Member',
      role: UserRole.MEMBER,
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=member',
    },
    {
      email: 'viewer@acme-corp.test',
      name: 'Viewer User',
      role: UserRole.VIEWER,
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=viewer',
    },
  ],

  // Workspace with channels (for future use when models are uncommented)
  workspace: {
    name: 'Development Workspace',
    description: 'Main workspace for the Acme Corp team',
    channels: [
      { name: 'general', description: 'General discussion' },
      { name: 'engineering', description: 'Engineering team discussions' },
      { name: 'product', description: 'Product updates and feedback' },
      { name: 'random', description: 'Off-topic conversations' },
    ],
  },

  // Disciplines (for future use)
  disciplines: [
    {
      name: 'Engineering',
      description: 'Software development and technical operations',
    },
    {
      name: 'Product',
      description: 'Product management and strategy',
    },
    {
      name: 'Design',
      description: 'User experience and visual design',
    },
    {
      name: 'Operations',
      description: 'Business operations and support',
    },
  ],
};

/**
 * Main seed function
 */
async function main(): Promise<void> {
  console.log('Starting database seed...\n');

  // Seed users
  console.log('Creating test users...');
  const users = await Promise.all(
    SEED_DATA.users.map(async (userData) => {
      const user = await prisma.user.upsert({
        where: { email: userData.email },
        update: {
          name: userData.name,
          role: userData.role,
          avatarUrl: userData.avatarUrl,
        },
        create: userData,
      });
      console.log(`  - Created user: ${user.email} (${user.role})`);
      return user;
    })
  );

  console.log(`\nCreated ${users.length} users.`);

  // Log organization info (for when Organisation model is enabled)
  console.log('\nOrganization configuration (ready for Phase 1):');
  console.log(`  - Name: ${SEED_DATA.organization.name}`);
  console.log(`  - Slug: ${SEED_DATA.organization.slug}`);

  // Log workspace info (for when Workspace model is enabled)
  console.log('\nWorkspace configuration (ready for Phase 1):');
  console.log(`  - Name: ${SEED_DATA.workspace.name}`);
  console.log(`  - Channels: ${SEED_DATA.workspace.channels.map((c) => c.name).join(', ')}`);

  // Log disciplines info (for when Discipline model is enabled)
  console.log('\nDiscipline configuration (ready for Phase 1):');
  SEED_DATA.disciplines.forEach((d) => {
    console.log(`  - ${d.name}: ${d.description}`);
  });

  console.log('\nDatabase seed completed successfully!');
}

/**
 * Cleanup function to remove all seeded data
 * Useful for testing or resetting to a clean state
 */
export async function cleanup(): Promise<void> {
  console.log('Cleaning up seeded data...\n');

  // Delete in reverse order of dependencies
  // When more models are added, delete them here in the correct order

  // Delete users
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      email: {
        in: SEED_DATA.users.map((u) => u.email),
      },
    },
  });
  console.log(`  - Deleted ${deletedUsers.count} users`);

  console.log('\nCleanup completed.');
}

/**
 * Get seed data for programmatic access
 */
export function getSeedData() {
  return SEED_DATA;
}

// Execute main function
main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Seed failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });

/**
 * Seed file for default channel templates
 *
 * This file contains system templates that are created for channels
 * Run with: npm run seed:templates
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Default system templates
 * These can be added to any channel by admins
 */
const DEFAULT_TEMPLATES = [
  {
    name: 'Daily Standup',
    description: 'Standard daily standup format with yesterday, today, and blockers',
    content: `**Daily Standup - {date}**

**Yesterday:**
-

**Today:**
-

**Blockers:**
- None`,
    icon: '📋',
    isSystem: true,
  },
  {
    name: 'Announcement',
    description: 'Team-wide announcement format',
    content: `**📢 Announcement**

**Subject:**

**Details:**


**Action Required:**
-

**Questions?** Feel free to ask below 👇`,
    icon: '📢',
    isSystem: true,
  },
  {
    name: 'Meeting Notes',
    description: 'Standard meeting notes template with agenda and action items',
    content: `**Meeting Notes - {date} at {time}**

**Attendees:**
-

**Agenda:**
1.

**Discussion Points:**
-

**Decisions Made:**
-

**Action Items:**
- [ ]

**Next Meeting:**
- Date:
- Time: `,
    icon: '📝',
    isSystem: true,
  },
  {
    name: 'Decision Log',
    description: 'Document important team decisions',
    content: `**✅ Decision - {date}**

**Context:**


**Options Considered:**
1.
2.

**Decision:**


**Rationale:**


**Next Steps:**
-

**Decision Makers:**
- `,
    icon: '✅',
    isSystem: true,
  },
  {
    name: 'Bug Report',
    description: 'Standard bug report format',
    content: `**🐛 Bug Report**

**Summary:**


**Steps to Reproduce:**
1.
2.
3.

**Expected Behavior:**


**Actual Behavior:**


**Environment:**
- Browser:
- OS:
- Version:

**Screenshots:**


**Priority:** [ ] Low [ ] Medium [ ] High [ ] Critical`,
    icon: '🐛',
    isSystem: true,
  },
  {
    name: 'Feature Request',
    description: 'Propose new features or enhancements',
    content: `**💡 Feature Request**

**Feature Name:**


**Problem Statement:**


**Proposed Solution:**


**User Stories:**
- As a [user type], I want to [action] so that [benefit]

**Acceptance Criteria:**
- [ ]

**Additional Context:**


**Priority:** [ ] Low [ ] Medium [ ] High`,
    icon: '💡',
    isSystem: true,
  },
  {
    name: 'Retrospective',
    description: 'Sprint or project retrospective template',
    content: `**🔄 Retrospective - {date}**

**What Went Well:**
-

**What Could Be Improved:**
-

**Action Items:**
- [ ]

**Kudos:**
-

**Next Steps:**
- `,
    icon: '🔄',
    isSystem: true,
  },
  {
    name: 'Weekly Update',
    description: 'Weekly team or project status update',
    content: `**📊 Weekly Update - Week of {date}**

**Highlights:**
-

**Key Metrics:**
-

**Completed This Week:**
- [ ]

**In Progress:**
- [ ]

**Blocked/At Risk:**
-

**Next Week's Goals:**
- [ ]

**Notes:**
`,
    icon: '📊',
    isSystem: true,
  },
];

/**
 * Seed templates for a specific channel
 */
async function seedChannelTemplates(channelId: string, createdById: string) {
  console.log(`Seeding templates for channel ${channelId}...`);

  for (const template of DEFAULT_TEMPLATES) {
    try {
      await prisma.channelTemplate.upsert({
        where: {
          channelId_name: {
            channelId,
            name: template.name,
          },
        },
        update: {
          description: template.description,
          content: template.content,
          icon: template.icon,
          isSystem: template.isSystem,
        },
        create: {
          ...template,
          channelId,
          createdById,
        },
      });
      console.log(`  ✓ Created/updated template: ${template.name}`);
    } catch (error) {
      console.error(`  ✗ Failed to create template ${template.name}:`, error);
    }
  }
}

/**
 * Main seed function
 * Seeds templates for all channels (or specific channels)
 */
async function main() {
  console.log('Starting channel templates seed...\n');

  // Get all channels
  const channels = await prisma.channel.findMany({
    select: {
      id: true,
      name: true,
      createdById: true,
    },
  });

  console.log(`Found ${channels.length} channels\n`);

  // Seed templates for each channel
  for (const channel of channels) {
    if (channel.createdById) {
      await seedChannelTemplates(channel.id, channel.createdById);
      console.log(`Completed seeding for channel: ${channel.name}\n`);
    } else {
      console.log(`Skipping channel ${channel.name} (no creator)\n`);
    }
  }

  console.log('✓ Channel templates seed completed!');
}

// Run the seed
main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

export { DEFAULT_TEMPLATES, seedChannelTemplates };

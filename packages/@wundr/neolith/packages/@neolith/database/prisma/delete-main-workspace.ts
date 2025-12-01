/**
 * Script to delete the "Main Workspace" from the database
 *
 * Run with: npx tsx prisma/delete-main-workspace.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🗑️ Deleting "Main Workspace"...\n');

  // Find the workspace
  const workspace = await prisma.workspace.findFirst({
    where: { slug: 'main-workspace' },
  });

  if (!workspace) {
    console.log('✅ No "Main Workspace" found. Nothing to delete.');
    return;
  }

  console.log(`Found workspace: ${workspace.name} (${workspace.slug})`);
  console.log('');

  // Delete in order due to foreign key constraints
  console.log('Deleting associated data...');

  // Delete webhooks
  const deletedWebhooks = await prisma.webhook.deleteMany({
    where: { workspaceId: workspace.id },
  });
  console.log(`  ✅ Deleted ${deletedWebhooks.count} webhooks`);

  // Delete workflows
  const deletedWorkflows = await prisma.workflow.deleteMany({
    where: { workspaceId: workspace.id },
  });
  console.log(`  ✅ Deleted ${deletedWorkflows.count} workflows`);

  // Delete agents
  const deletedAgents = await prisma.agent.deleteMany({
    where: { workspaceId: workspace.id },
  });
  console.log(`  ✅ Deleted ${deletedAgents.count} agents`);

  // Delete deployment logs first, then deployments
  const deployments = await prisma.deployment.findMany({
    where: { workspaceId: workspace.id },
    select: { id: true },
  });
  const deploymentIds = deployments.map(d => d.id);

  const deletedLogs = await prisma.deploymentLog.deleteMany({
    where: { deploymentId: { in: deploymentIds } },
  });
  console.log(`  ✅ Deleted ${deletedLogs.count} deployment logs`);

  const deletedDeployments = await prisma.deployment.deleteMany({
    where: { workspaceId: workspace.id },
  });
  console.log(`  ✅ Deleted ${deletedDeployments.count} deployments`);

  // Delete integrations
  const deletedIntegrations = await prisma.integration.deleteMany({
    where: { workspaceId: workspace.id },
  });
  console.log(`  ✅ Deleted ${deletedIntegrations.count} integrations`);

  // Delete tasks
  const deletedTasks = await prisma.task.deleteMany({
    where: { workspaceId: workspace.id },
  });
  console.log(`  ✅ Deleted ${deletedTasks.count} tasks`);

  // Delete orchestrators
  const deletedOrchestrators = await prisma.orchestrator.deleteMany({
    where: { workspaceId: workspace.id },
  });
  console.log(`  ✅ Deleted ${deletedOrchestrators.count} orchestrators`);

  // Delete channel members first, then messages, then channels
  const channels = await prisma.channel.findMany({
    where: { workspaceId: workspace.id },
    select: { id: true },
  });
  const channelIds = channels.map(c => c.id);

  const deletedChannelMembers = await prisma.channelMember.deleteMany({
    where: { channelId: { in: channelIds } },
  });
  console.log(`  ✅ Deleted ${deletedChannelMembers.count} channel members`);

  const deletedMessages = await prisma.message.deleteMany({
    where: { channelId: { in: channelIds } },
  });
  console.log(`  ✅ Deleted ${deletedMessages.count} messages`);

  const deletedChannels = await prisma.channel.deleteMany({
    where: { workspaceId: workspace.id },
  });
  console.log(`  ✅ Deleted ${deletedChannels.count} channels`);

  // Delete workspace members
  const deletedMembers = await prisma.workspaceMember.deleteMany({
    where: { workspaceId: workspace.id },
  });
  console.log(`  ✅ Deleted ${deletedMembers.count} workspace members`);

  // Finally, delete the workspace
  await prisma.workspace.delete({
    where: { id: workspace.id },
  });
  console.log(`  ✅ Deleted workspace: ${workspace.name}`);

  console.log(
    '\n✅ "Main Workspace" and all associated data deleted successfully!'
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async error => {
    console.error('❌ Deletion failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });

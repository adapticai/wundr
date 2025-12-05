# Scheduled Reports Schema Extension

This document describes the recommended Prisma schema extension for scheduled reports. The current implementation uses the `exportJob` table as a workaround, but a dedicated schema should be added for production use.

## Recommended Schema Addition

```prisma
/// ScheduledReport status enumeration
enum ScheduledReportStatus {
  ACTIVE
  PAUSED
  DISABLED
  ERROR
}

/// ScheduledReport - Automated report generation and delivery
model ScheduledReport {
  id          String                 @id @default(cuid())
  name        String
  description String?
  reportType  String                 // workspace-activity, channel-analytics, etc.

  // Scheduling
  cronExpression String               @map("cron_expression")
  timezone       String               @default("UTC")
  isActive       Boolean              @default(true) @map("is_active")
  status         ScheduledReportStatus @default(ACTIVE)

  // Configuration
  exportFormats  String[]             @map("export_formats") // pdf, csv, json, excel, html
  parameters     Json                 @default("{}")
  tags           String[]             @default([])

  // Email delivery
  emailEnabled           Boolean  @default(false) @map("email_enabled")
  emailRecipients        String[] @map("email_recipients")
  emailCcRecipients      String[] @default([]) @map("email_cc_recipients")
  emailBccRecipients     String[] @default([]) @map("email_bcc_recipients")
  emailSubject           String?  @map("email_subject")
  emailIncludeAttachment Boolean  @default(true) @map("email_include_attachment")
  emailIncludePreview    Boolean  @default(false) @map("email_include_preview")
  emailSendOnlyIfData    Boolean  @default(false) @map("email_send_only_if_data")

  // Execution tracking
  lastRun        DateTime?  @map("last_run")
  lastRunStatus  String?    @map("last_run_status") // success, failed
  nextRun        DateTime?  @map("next_run")
  runCount       Int        @default(0) @map("run_count")
  successCount   Int        @default(0) @map("success_count")
  failureCount   Int        @default(0) @map("failure_count")
  lastError      String?    @map("last_error")

  // Relations
  workspaceId String       @map("workspace_id")
  workspace   workspace    @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  createdById String       @map("created_by_id")
  createdBy   user         @relation(fields: [createdById], references: [id])

  // Executions
  executions ReportExecution[]

  // Timestamps
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([workspaceId])
  @@index([status])
  @@index([isActive])
  @@index([nextRun])
  @@index([reportType])
  @@index([createdById])
  @@map("scheduled_reports")
}

/// ReportExecution - Individual execution instance of a scheduled report
model ReportExecution {
  id                 String        @id @default(cuid())
  scheduledReportId  String        @map("scheduled_report_id")
  scheduledReport    ScheduledReport @relation(fields: [scheduledReportId], references: [id], onDelete: Cascade)

  // Execution details
  status             ExportStatus  @default(PENDING)
  triggeredBy        String        @map("triggered_by") // user ID or 'system'
  triggeredManually  Boolean       @default(false) @map("triggered_manually")

  // Output
  fileUrl            String?       @map("file_url")
  fileSize           BigInt?       @map("file_size")
  recordCount        Int?          @map("record_count")
  format             ExportFormat

  // Timing
  scheduledFor       DateTime      @map("scheduled_for")
  startedAt          DateTime?     @map("started_at")
  completedAt        DateTime?     @map("completed_at")
  duration           Int?          // milliseconds

  // Error handling
  error              String?       @db.Text
  retryCount         Int           @default(0) @map("retry_count")

  // Email delivery
  emailSent          Boolean       @default(false) @map("email_sent")
  emailSentAt        DateTime?     @map("email_sent_at")
  emailError         String?       @map("email_error")

  // Progress
  progress           Int           @default(0)

  // Timestamps
  createdAt          DateTime      @default(now()) @map("created_at")

  @@index([scheduledReportId])
  @@index([status])
  @@index([scheduledFor])
  @@index([createdAt])
  @@map("report_executions")
}
```

## Migration Steps

1. **Add the models to your Prisma schema:**
   ```bash
   # Add the above models to packages/@wundr/neolith/packages/@neolith/database/prisma/schema.prisma
   ```

2. **Create and run migration:**
   ```bash
   cd packages/@wundr/neolith/packages/@neolith/database
   npx prisma migrate dev --name add_scheduled_reports
   ```

3. **Update the API routes:**
   - Replace `exportJob` references with `scheduledReport` and `reportExecution`
   - Remove metadata workarounds
   - Use proper relational queries

4. **Add background job processor:**
   - Set up Bull Queue, AWS SQS, or similar
   - Create cron job scheduler (e.g., node-cron, AWS EventBridge)
   - Implement report generation workers

## Current Workaround

The current implementation uses the `exportJob` table with metadata JSON field to store schedule configuration. This works but has limitations:

- No type safety for schedule configuration
- No relational queries on schedule fields
- Metadata field becomes complex
- No dedicated execution history

## Benefits of Dedicated Schema

1. **Type Safety:** All schedule fields are strongly typed
2. **Better Queries:** Can efficiently query by next run time, status, etc.
3. **Execution History:** Dedicated table for tracking all executions
4. **Email Tracking:** Track email delivery separately
5. **Retry Logic:** Built-in retry count and error tracking
6. **Performance:** Proper indexes on commonly queried fields

## Example Queries with New Schema

```typescript
// Get all reports due for execution
const dueReports = await prisma.scheduledReport.findMany({
  where: {
    isActive: true,
    status: 'ACTIVE',
    nextRun: {
      lte: new Date(),
    },
  },
  include: {
    workspace: true,
    createdBy: true,
  },
});

// Create execution record
const execution = await prisma.reportExecution.create({
  data: {
    scheduledReportId: report.id,
    status: 'PROCESSING',
    triggeredBy: 'system',
    scheduledFor: new Date(),
    format: report.exportFormats[0],
  },
});

// Get execution history with statistics
const history = await prisma.reportExecution.findMany({
  where: {
    scheduledReportId: reportId,
  },
  orderBy: {
    createdAt: 'desc',
  },
  take: 10,
});

const stats = await prisma.reportExecution.aggregate({
  where: {
    scheduledReportId: reportId,
  },
  _count: true,
  _avg: {
    duration: true,
  },
  _max: {
    fileSize: true,
  },
});
```

## Email Service Integration

For email delivery, integrate with:

1. **AWS SES** - Cost-effective for high volume
2. **SendGrid** - Easy integration with good deliverability
3. **Mailgun** - Good for transactional emails
4. **Resend** - Modern API, great DX

Example email service configuration:

```typescript
// lib/email/report-delivery.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendReportEmail(config: {
  recipients: string[];
  subject: string;
  attachmentUrl: string;
  reportName: string;
}) {
  await resend.emails.send({
    from: 'reports@yourdomain.com',
    to: config.recipients,
    subject: config.subject,
    html: `
      <h2>${config.reportName} is ready</h2>
      <p>Your scheduled report has been generated.</p>
      <a href="${config.attachmentUrl}">Download Report</a>
    `,
  });
}
```

## Cron Job Scheduler

Example background scheduler implementation:

```typescript
// workers/report-scheduler.ts
import cron from 'node-cron';
import { prisma } from '@neolith/database';
import { getNextExecution } from '@/lib/cron-validation';

// Run every minute to check for due reports
cron.schedule('* * * * *', async () => {
  const now = new Date();

  const dueReports = await prisma.scheduledReport.findMany({
    where: {
      isActive: true,
      status: 'ACTIVE',
      nextRun: {
        lte: now,
      },
    },
  });

  for (const report of dueReports) {
    // Queue report generation
    await reportQueue.add('generate-report', {
      reportId: report.id,
    });

    // Update next run time
    const nextRun = getNextExecution(report.cronExpression, now);
    await prisma.scheduledReport.update({
      where: { id: report.id },
      data: { nextRun },
    });
  }
});
```

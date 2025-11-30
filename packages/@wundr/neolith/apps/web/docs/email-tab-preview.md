# Enhanced Email Tab Preview

## Structure Overview

The Email tab in Notifications settings now has the following structure:

```
Notifications Settings Page
├─ Global Controls (Card)
├─ Notification Channels (Card with Tabs)
│  ├─ In-App (Tab)
│  ├─ Email (Tab) ← ENHANCED
│  │  ├─ Email notifications toggle (at top)
│  │  ├─ Marketing Communications
│  │  │  └─ Product updates and tips toggle
│  │  ├─ Activity Notifications  
│  │  │  └─ Mentions and messages toggle
│  │  ├─ Email Frequency
│  │  │  ├─ Activity digest dropdown (None/Daily/Weekly)
│  │  │  └─ Notification emails dropdown (Instant/Hourly/Daily/Weekly/Never)
│  │  ├─ Security & Transactional Emails
│  │  │  ├─ Security alerts toggle (disabled, always on)
│  │  │  └─ Info box explaining why it's required
│  │  └─ Save Email Preferences button
│  └─ Push/Mobile (Tab)
├─ Notification Types (Card with Table)
├─ Quiet Hours (Card)
├─ Muted Channels (Card, conditional)
└─ Test Notification (Card)
```

## UI Layout

### Email Tab Content

```
┌─────────────────────────────────────────────────────────┐
│ Email notifications                              [ON/OFF]│
│ Receive notifications via email                         │
└─────────────────────────────────────────────────────────┘

📧 Marketing Communications
   
   Product updates and tips                       [ON/OFF]
   Stay informed about new features, improvements, 
   and helpful tips

📧 Activity Notifications

   Mentions and messages                          [ON/OFF]
   Get notified via email when someone mentions you 
   or sends you a message

📧 Email Frequency

   Activity digest              [Dropdown ▼]
   Never / Daily summary / Weekly summary
   How often to receive activity summaries in 
   your workspaces

   Notification emails          [Dropdown ▼]
   Instant / Hourly / Daily / Weekly / Never
   Send notification emails instantly or batched

🛡️ Security & Transactional Emails

   Security alerts                           [ON (locked)]
   Password changes, new logins, and other 
   security-related notifications

   ┌───────────────────────────────────────────────┐
   │ Security emails are always enabled to protect │
   │ your account. This includes password resets,  │
   │ account changes, and security alerts.         │
   └───────────────────────────────────────────────┘

                            [Save Email Preferences]
```

## Key Features

### 1. Clear Section Headers
Each section has an icon and clear heading:
- 📧 Marketing Communications
- 📧 Activity Notifications  
- 📧 Email Frequency
- 🛡️ Security & Transactional Emails

### 2. Hierarchical Organization
Settings are logically grouped and indented for visual hierarchy

### 3. Disabled State Handling
Security emails toggle is visually disabled with explanation

### 4. Loading States
Shows spinner while fetching email preferences

### 5. Independent Save
Email preferences have their own save button, separate from other notification settings

### 6. Responsive Design
All controls use Tailwind spacing and responsive utilities

## Differences from Old Email Settings Page

### Old (Standalone Page)
- Separate route: `/settings/email`
- 4 separate cards for each preference type
- Less organization
- Not integrated with notification settings
- Hidden from navigation menu

### New (Integrated Tab)
- Integrated into: `/settings/notifications` → Email tab
- Organized sections within one cohesive tab
- Better visual hierarchy
- Unified with other notification preferences
- Discoverable through navigation

## State Management

The Email tab manages its own state for email-specific preferences:

```typescript
const [emailPreferences, setEmailPreferences] = useState({
  marketingEmails: boolean,
  notificationEmails: boolean,
  digestEmails: 'none' | 'daily' | 'weekly',
  securityEmails: boolean, // always true
});
```

This state is:
- Loaded independently via `/api/users/me/email-preferences`
- Saved independently with dedicated save button
- Validated on the client and server
- Merged with other notification settings on the backend

## Accessibility

- All toggles have proper labels
- Disabled states clearly indicated
- Help text for each option
- Keyboard navigable
- Screen reader friendly

## Error Handling

- Toast notifications for save success/failure
- Loading states during async operations
- Validation prevents disabling security emails
- Clear error messages


# Wundr/Neolith Settings UX Design Document

**Version**: 1.0.0
**Last Updated**: 2025-11-30
**Designer**: Product Design Team
**Status**: Design Specification

---

## Table of Contents

1. [Overview](#overview)
2. [Design Principles](#design-principles)
3. [Navigation Structure](#navigation-structure)
4. [Personal User Settings](#personal-user-settings)
5. [Workspace Admin Settings](#workspace-admin-settings)
6. [Interaction Patterns](#interaction-patterns)
7. [Accessibility Considerations](#accessibility-considerations)

---

## Overview

This document defines the UX design for Wundr/Neolith's settings interface, divided into two primary contexts:

1. **Personal User Settings**: Individual user preferences accessible to all users
2. **Workspace Admin Settings**: Administrative controls accessible only to workspace admins

The design follows established patterns from Slack and modern workspace collaboration tools, emphasizing clarity, discoverability, and progressive disclosure.

---

## Design Principles

### 1. Clear Separation of Concerns
- Personal settings never mixed with admin settings
- Visual indicators for admin-only sections
- Context-appropriate language (e.g., "My notifications" vs "Workspace notifications")

### 2. Progressive Disclosure
- Show most common settings first
- Use collapsible sections for advanced options
- Inline help text for complex settings

### 3. Immediate Feedback
- Auto-save for most settings with visual confirmation
- Clear error states with actionable messages
- Success confirmations for critical actions

### 4. Consistent Patterns
- Similar settings use similar controls
- Predictable layout across all pages
- Unified visual language

---

## Navigation Structure

### Settings Modal/Page Layout

```
┌─────────────────────────────────────────────────────────┐
│  Settings                                          [×]   │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│  PERSONAL    │                                          │
│  Account     │                                          │
│  Notifications│         CONTENT AREA                    │
│  Appearance  │                                          │
│  Accessibility│                                         │
│  Language    │                                          │
│  Privacy     │                                          │
│              │                                          │
│  WORKSPACE   │                                          │
│  [Admin Icon]│                                          │
│  General     │                                          │
│  Members     │                                          │
│  Channels    │                                          │
│  Apps        │                                          │
│  Security    │                                          │
│  Billing     │                                          │
│              │                                          │
└──────────────┴──────────────────────────────────────────┘
```

### Access Patterns

- **Personal Settings**: Click profile icon → "Preferences" or keyboard shortcut (Cmd/Ctrl + ,)
- **Admin Settings**: Click workspace name → "Workspace Settings" (admin only)
- **Search**: Global search bar at top of settings modal for quick access

---

## Personal User Settings

### 1. Account

**Page Title**: Account
**Description**: Manage your personal profile and account security

#### Settings Groups

##### Profile Information
- **Full Name**
  - Control: Text input
  - Validation: 1-100 characters, required
  - Save: Auto-save on blur (500ms debounce)

- **Display Name**
  - Control: Text input
  - Help text: "This is how your name appears to others"
  - Validation: 1-50 characters, optional
  - Save: Auto-save on blur

- **Title/Role**
  - Control: Text input
  - Placeholder: "e.g., Product Designer"
  - Validation: 0-100 characters
  - Save: Auto-save on blur

- **Profile Photo**
  - Control: Image upload with preview
  - Specs: Max 5MB, JPG/PNG, min 256x256px
  - Actions: Upload, Remove, Crop
  - Save: Immediate on upload/remove

- **Phone Number**
  - Control: Text input with country code selector
  - Validation: Valid phone format
  - Save: Auto-save on blur

##### Email & Authentication
- **Primary Email**
  - Control: Text input with verification badge
  - Actions: "Change email" (opens modal with verification flow)
  - Save: Manual (requires email verification)

- **Secondary Emails**
  - Control: List of emails with "Add" button
  - Each item: Email + verification status + remove icon
  - Save: Immediate on add/remove

- **Password**
  - Control: Masked field showing "••••••••"
  - Action: "Change password" button (opens modal)
  - Modal fields: Current password, new password, confirm password
  - Validation: Min 8 characters, 1 uppercase, 1 number
  - Save: Manual with confirmation

- **Two-Factor Authentication**
  - Control: Toggle switch
  - Conditional section: When enabled, shows:
    - QR code for authenticator apps
    - Backup codes (download/regenerate)
    - SMS backup option
  - Save: Manual with verification step

##### Connected Accounts
- **Google Account**
  - Control: Connect/Disconnect button
  - Status: Shows connected email or "Not connected"

- **Microsoft Account**
  - Control: Connect/Disconnect button
  - Status: Shows connected email or "Not connected"

- **Apple ID**
  - Control: Connect/Disconnect button
  - Status: Shows connected email or "Not connected"

##### Account Management
- **Download Your Data**
  - Control: Button "Request export"
  - Help text: "We'll email you a link to download your messages, files, and profile data"

- **Deactivate Account**
  - Control: Text link (red, subtle)
  - Action: Opens modal with warning and confirmation
  - Requires: Password re-entry

---

### 2. Notifications

**Page Title**: Notifications
**Description**: Choose when and how you want to be notified

#### Settings Groups

##### Notification Schedule
- **Notification Hours**
  - Control: Toggle "Use notification schedule"
  - Conditional section: When enabled:
    - Time range selector: "Send notifications from [9:00 AM] to [6:00 PM]"
    - Days selector: Checkboxes for each day of week
  - Save: Auto-save

- **Do Not Disturb**
  - Control: Toggle "Enable Do Not Disturb"
  - Conditional: Duration selector (30 min, 1 hour, 2 hours, 4 hours, custom, until tomorrow)
  - Override: Checkbox "Allow notifications from admins during DND"
  - Save: Immediate

##### Desktop Notifications
- **Show desktop notifications for**
  - Control: Radio group
    - All new messages
    - Direct messages, mentions & keywords only
    - Nothing
  - Save: Auto-save

- **Notification sound**
  - Control: Dropdown with sound preview buttons
  - Options: Default, Ding, Pop, Chirp, None
  - Save: Auto-save

- **Badge app icon**
  - Control: Toggle
  - Help text: "Show unread count on app icon"
  - Save: Auto-save

##### Mobile Push Notifications
- **Send me mobile push notifications for**
  - Control: Radio group
    - All new messages
    - Direct messages, mentions & keywords only
    - Nothing
    - Same as desktop
  - Save: Auto-save

- **Include message preview**
  - Control: Toggle
  - Help text: "Show message content in push notifications"
  - Save: Auto-save

##### Email Notifications
- **Send me email notifications for**
  - Control: Checkbox group (multiple selection)
    - Direct messages
    - Mentions
    - Keywords
    - Replies to threads I'm following
    - Files shared with me
    - Workspace announcements
  - Save: Auto-save

- **Email frequency**
  - Control: Radio group
    - Instantly
    - Every 15 minutes
    - Hourly
    - Daily digest
  - Save: Auto-save

##### Channel-Specific Overrides
- **Customize per channel**
  - Control: Expandable section
  - List: Each channel with dropdown
    - Options: All messages, Mentions only, Nothing, Use default
  - Search: Filter channels by name
  - Save: Auto-save on change

##### Keywords & Highlights
- **Keyword notifications**
  - Control: Tag input (add/remove keywords)
  - Help text: "Get notified when these words are mentioned"
  - Validation: Max 50 keywords, 30 characters each
  - Save: Auto-save (500ms debounce)

##### In-App Notifications
- **Play sound for incoming messages**
  - Control: Toggle
  - Save: Auto-save

- **Show message previews in banner**
  - Control: Toggle
  - Save: Auto-save

---

### 3. Appearance

**Page Title**: Appearance
**Description**: Customize how Wundr looks and feels

#### Settings Groups

##### Theme
- **Theme Mode**
  - Control: Segmented control (3 options with icons)
    - Light
    - Dark
    - Auto (follows system)
  - Preview: Live preview of theme change
  - Save: Immediate

- **Color Scheme**
  - Control: Color palette selector
  - Options: Default, Ocean, Forest, Sunset, Lavender, Custom
  - Custom: Opens color picker for accent colors
  - Save: Immediate with preview

##### Sidebar
- **Sidebar theme**
  - Control: Radio group with previews
    - Light sidebar
    - Dark sidebar
    - Match theme
  - Preview: Shows small sidebar preview
  - Save: Immediate

- **Sidebar density**
  - Control: Radio group
    - Comfortable (default spacing)
    - Compact (reduced spacing)
  - Save: Immediate

- **Show/hide sections**
  - Control: Checkbox group
    - Starred items
    - Direct messages
    - Channels
    - Apps
  - Save: Auto-save

##### Messages
- **Message display**
  - Control: Radio group with previews
    - Comfortable (with avatars and spacing)
    - Compact (reduced avatars and spacing)
  - Save: Immediate

- **Names display**
  - Control: Radio group
    - Display names
    - Full names
    - Both
  - Save: Auto-save

- **Emoji style**
  - Control: Radio group with previews
    - Native (system emojis)
    - Wundr style
  - Save: Immediate

##### Advanced
- **Enable animations**
  - Control: Toggle
  - Help text: "Smooth transitions and effects"
  - Save: Immediate

- **Show link previews**
  - Control: Toggle
  - Help text: "Unfurl previews for shared links"
  - Save: Auto-save

---

### 4. Accessibility

**Page Title**: Accessibility
**Description**: Settings to improve your experience

#### Settings Groups

##### Screen Reader
- **Enable screen reader support**
  - Control: Toggle
  - Help text: "Optimized announcements for screen readers"
  - Save: Immediate

- **Announce new messages**
  - Control: Toggle
  - Conditional: Only when screen reader enabled
  - Save: Auto-save

##### Keyboard Navigation
- **Enhanced keyboard navigation**
  - Control: Toggle
  - Help text: "Additional keyboard shortcuts and focus indicators"
  - Save: Immediate

- **Show keyboard shortcuts overlay**
  - Control: Toggle
  - Action: "View all shortcuts" link
  - Save: Auto-save

##### Visual
- **Reduce motion**
  - Control: Toggle
  - Help text: "Minimize animations and transitions"
  - Save: Immediate

- **Increase contrast**
  - Control: Toggle
  - Help text: "Higher contrast colors for better readability"
  - Save: Immediate

- **Text size**
  - Control: Slider (Small, Default, Large, Extra Large)
  - Preview: Shows sample text at selected size
  - Save: Immediate

##### Focus & Attention
- **Auto-scroll to new messages**
  - Control: Toggle
  - Save: Auto-save

- **Flash window on new message**
  - Control: Toggle
  - Help text: "Flash taskbar/dock icon for new messages"
  - Save: Auto-save

---

### 5. Language & Region

**Page Title**: Language & Region
**Description**: Set your language, timezone, and regional formats

#### Settings Groups

##### Language
- **Language**
  - Control: Searchable dropdown
  - Options: All supported languages (English, Spanish, French, German, etc.)
  - Help text: "Restart required for full effect"
  - Save: Manual with confirmation

- **Spell check language**
  - Control: Multi-select dropdown
  - Help text: "Choose languages for spell checking"
  - Save: Auto-save

##### Timezone & Time Format
- **Timezone**
  - Control: Searchable dropdown grouped by region
  - Auto-detect: "Use device timezone" checkbox
  - Preview: "Current time: 3:45 PM"
  - Save: Auto-save

- **Time format**
  - Control: Radio group
    - 12-hour (3:45 PM)
    - 24-hour (15:45)
  - Save: Auto-save

##### Date Format
- **Date format**
  - Control: Radio group
    - MM/DD/YYYY (US)
    - DD/MM/YYYY (UK/EU)
    - YYYY-MM-DD (ISO)
  - Preview: Shows current date in selected format
  - Save: Auto-save

- **First day of week**
  - Control: Radio group
    - Sunday
    - Monday
    - Saturday
  - Save: Auto-save

---

### 6. Privacy

**Page Title**: Privacy
**Description**: Control your visibility and data sharing

#### Settings Groups

##### Status & Presence
- **Show when I'm active**
  - Control: Radio group
    - Show as active
    - Don't show activity
    - Only show to admins
  - Save: Auto-save

- **Status expiration**
  - Control: Dropdown
    - Don't clear (manual only)
    - Clear after 30 minutes
    - Clear after 1 hour
    - Clear after 4 hours
    - Clear today
  - Save: Auto-save

##### Read Receipts
- **Send read receipts**
  - Control: Radio group
    - Always send
    - Only in direct messages
    - Never send
  - Help text: "Let others know when you've read their messages"
  - Save: Auto-save

##### Typing Indicators
- **Show when I'm typing**
  - Control: Toggle
  - Help text: "Others will see '... is typing' when you're composing"
  - Save: Auto-save

##### Profile Visibility
- **Who can see my profile**
  - Control: Radio group
    - Everyone in workspace
    - Only workspace members
    - Only people I've messaged
  - Save: Auto-save

- **Who can see my email**
  - Control: Radio group
    - Everyone in workspace
    - Only admins
    - No one
  - Save: Auto-save

##### Data & Analytics
- **Help improve Wundr**
  - Control: Toggle
  - Help text: "Share anonymous usage data to help us improve"
  - Save: Auto-save

- **Personalized experience**
  - Control: Toggle
  - Help text: "Use my activity to suggest channels and content"
  - Save: Auto-save

---

## Workspace Admin Settings

**Access Control**: Only visible to users with admin or owner role
**Visual Indicator**: Admin sections marked with distinctive icon and "Admin only" badge

---

### 1. General

**Page Title**: Workspace Settings
**Description**: Manage basic workspace information and defaults

#### Settings Groups

##### Workspace Identity
- **Workspace Name**
  - Control: Text input
  - Validation: 1-100 characters, required
  - Preview: Shows name in sidebar
  - Save: Manual with "Save Changes" button

- **Workspace Icon**
  - Control: Image upload with preview
  - Specs: Max 2MB, JPG/PNG/GIF, min 128x128px
  - Actions: Upload, Remove, Edit
  - Preview: Shows icon in various sizes
  - Save: Immediate on upload/remove

- **Workspace URL**
  - Control: Text input with prefix
  - Format: `wundr.app/workspace/{slug}`
  - Validation: Lowercase, alphanumeric, hyphens only
  - Warning: "Changing this will break existing links"
  - Save: Manual with confirmation modal

- **Workspace Description**
  - Control: Textarea
  - Character count: 0/500
  - Help text: "Appears in workspace directory and invitations"
  - Save: Manual with "Save Changes" button

##### Default Settings
- **Default Channel**
  - Control: Searchable dropdown (channels)
  - Help text: "New members are automatically added here"
  - Save: Manual

- **Default Workspace Language**
  - Control: Dropdown
  - Options: All supported languages
  - Help text: "New members start with this language"
  - Save: Manual

##### Workspace Features
- **Enable threads**
  - Control: Toggle
  - Help text: "Allow threaded conversations"
  - Warning: "Disabling will hide existing threads"
  - Save: Manual with confirmation

- **Enable file sharing**
  - Control: Toggle
  - Conditional: File size limit slider (1-100 MB)
  - Save: Manual

- **Enable voice/video calls**
  - Control: Toggle
  - Save: Manual

##### Danger Zone
- **Archive Workspace**
  - Control: Button (outlined, warning color)
  - Action: Opens modal with confirmation
  - Requires: Workspace name re-entry

- **Delete Workspace**
  - Control: Button (solid, danger color)
  - Action: Opens modal with serious warning
  - Requires: Workspace name re-entry + password

---

### 2. Members & Permissions

**Page Title**: Members & Permissions
**Description**: Manage workspace members, roles, and access controls

#### Settings Groups

##### Member Management
- **Members List**
  - Control: Searchable table with columns:
    - Avatar + Name
    - Email
    - Role (dropdown: Owner, Admin, Member, Guest)
    - Status (Active, Invited, Deactivated)
    - Actions (Edit, Remove)
  - Search: Real-time filter by name/email
  - Filters: Role, Status, Join date
  - Pagination: 25, 50, 100 per page
  - Bulk actions: Select multiple → Change role, Remove
  - Save: Auto-save on role change

- **Invite Members**
  - Control: Button "Invite People"
  - Modal:
    - Email input (comma-separated or line-break)
    - Role selector (default: Member)
    - Channel selector (auto-add to channels)
    - Message textarea (optional welcome message)
  - Save: Sends invitations immediately

##### Invitation Settings
- **Who can invite**
  - Control: Checkbox group
    - Workspace owners
    - Workspace admins
    - All members
    - No one (admins only)
  - Save: Auto-save

- **Require admin approval for invites**
  - Control: Toggle
  - Conditional: Only when "All members" can invite
  - Save: Auto-save

- **Invitation expiration**
  - Control: Radio group
    - Never expire
    - 7 days
    - 14 days
    - 30 days
  - Save: Auto-save

##### Guest Access
- **Allow guest accounts**
  - Control: Toggle
  - Help text: "Guests have limited access to specific channels"
  - Save: Manual with confirmation

- **Guest permissions**
  - Control: Checkbox group (when guests allowed)
    - Can upload files
    - Can create channels
    - Can invite other guests
    - Can see member list
  - Save: Auto-save

##### Role Permissions
- **Customize role permissions**
  - Control: Expandable accordion per role (Member, Admin, Owner)
  - Each role: Checkbox grid of permissions
    - Channel management (create, archive, rename)
    - Member management (invite, remove, change roles)
    - App management (install, configure)
    - Message management (delete any, pin)
    - Workspace settings
  - Save: Manual with "Save Permissions" button

##### Member Defaults
- **Default channels for new members**
  - Control: Multi-select dropdown
  - Help text: "Auto-add new members to these channels"
  - Save: Auto-save

---

### 3. Channels

**Page Title**: Channel Management
**Description**: Configure channel policies and defaults

#### Settings Groups

##### Channel Creation
- **Who can create channels**
  - Control: Checkbox group
    - Workspace owners
    - Workspace admins
    - All members
  - Save: Auto-save

- **Require admin approval for new channels**
  - Control: Toggle
  - Conditional: Only when members can create
  - Save: Auto-save

- **Default channel visibility**
  - Control: Radio group
    - Public (anyone can join)
    - Private (invite only)
    - Let creator choose
  - Save: Auto-save

##### Channel Policies
- **Channel naming conventions**
  - Control: Text input with variables
  - Example: `{team}-{topic}` or `proj-{name}`
  - Help text: "Enforce naming patterns for new channels"
  - Validation: Pattern preview
  - Save: Manual

- **Channel description requirement**
  - Control: Toggle "Require description for new channels"
  - Save: Auto-save

- **Channel archiving**
  - Control: Radio group
    - Anyone can archive channels they created
    - Only admins can archive
    - No one can archive (prevent data loss)
  - Save: Auto-save

##### Private Channels
- **Allow private channels**
  - Control: Toggle
  - Warning: "Disabling will make all private channels public"
  - Save: Manual with confirmation

- **Who can create private channels**
  - Control: Checkbox group (when allowed)
    - Workspace owners
    - Workspace admins
    - All members
  - Save: Auto-save

##### Default Channels
- **Default channels**
  - Control: Sortable list with "Add" button
  - Each item: Channel name + Make default toggle + Remove
  - Help text: "All new members are added to these channels"
  - Minimum: 1 channel required
  - Save: Auto-save

##### Channel Management
- **All Channels**
  - Control: Searchable table
    - Columns: Name, Type (Public/Private), Members count, Created date, Actions
    - Actions: Edit, Archive, Make default
  - Filters: Public/Private, Active/Archived
  - Bulk actions: Archive, Make public/private
  - Save: Auto-save on actions

---

### 4. Apps & Integrations

**Page Title**: Apps & Integrations
**Description**: Manage installed apps, webhooks, and API access

#### Settings Groups

##### Installed Apps
- **App Directory**
  - Control: Card grid showing installed apps
  - Each card:
    - App icon + name
    - Status: Active/Inactive toggle
    - "Configure" button
    - "Remove" link
  - Actions: Install new apps (opens app directory)
  - Save: Immediate on toggle/remove

##### App Permissions
- **Who can install apps**
  - Control: Checkbox group
    - Workspace owners
    - Workspace admins
    - All members
  - Save: Auto-save

- **Require admin approval for apps**
  - Control: Toggle
  - Conditional: Only when members can install
  - Save: Auto-save

- **App permission levels**
  - Control: Table per installed app
    - Columns: Permission, Granted, Required
    - Examples: Read messages, Send messages, Access files, User data
  - Action: Revoke permissions per app
  - Save: Manual with "Update Permissions"

##### Webhooks
- **Incoming Webhooks**
  - Control: List of webhooks
  - Each item:
    - Webhook name
    - Target channel
    - URL (with copy button)
    - Created date
    - Remove icon
  - Action: "Add Webhook" button
  - Save: Immediate on add/remove

- **Outgoing Webhooks**
  - Control: List of webhooks
  - Each item:
    - Event type (message posted, file shared, etc.)
    - Endpoint URL
    - Secret token (masked, with regenerate)
    - Remove icon
  - Action: "Add Webhook" button
  - Save: Immediate on add/remove

##### API Access
- **API Tokens**
  - Control: List of tokens
  - Each item:
    - Token name
    - Scope (read/write permissions)
    - Last used date
    - Masked token (with reveal/copy)
    - Revoke button
  - Action: "Generate Token" button
  - Save: Immediate on generate/revoke

- **OAuth Applications**
  - Control: List of OAuth apps
  - Each item:
    - App name
    - Client ID
    - Redirect URIs
    - Scopes
    - Edit/Delete actions
  - Action: "Create OAuth App"
  - Save: Manual per app

##### Bot Users
- **Workspace Bots**
  - Control: List of bot users
  - Each item:
    - Bot name + icon
    - Status: Active/Inactive
    - Token (masked)
    - Channels with access
    - Configure/Remove actions
  - Action: "Add Bot User"
  - Save: Immediate on status toggle/remove

---

### 5. Security & Compliance

**Page Title**: Security & Compliance
**Description**: Manage workspace security policies and compliance

#### Settings Groups

##### Authentication
- **Require two-factor authentication**
  - Control: Toggle
  - Help text: "All members must enable 2FA"
  - Grace period: Dropdown (Immediately, 7 days, 14 days, 30 days)
  - Save: Manual with confirmation

- **Allowed authentication methods**
  - Control: Checkbox group
    - Email/password
    - Google OAuth
    - Microsoft OAuth
    - Apple ID
    - SAML SSO (Enterprise)
  - Save: Auto-save

- **Password requirements**
  - Control: Checkbox group
    - Minimum 8 characters
    - Require uppercase letter
    - Require number
    - Require special character
    - Block common passwords
  - Save: Auto-save

##### Session Management
- **Session timeout**
  - Control: Dropdown
    - Never (stay logged in)
    - 1 day
    - 7 days
    - 30 days
    - 90 days
  - Save: Auto-save

- **Require re-authentication for sensitive actions**
  - Control: Toggle
  - Help text: "Ask for password when changing security settings"
  - Save: Auto-save

##### Access Control
- **IP allowlist**
  - Control: Toggle "Restrict access by IP"
  - Conditional: IP address list (add/remove)
  - Format: Individual IPs or CIDR ranges
  - Warning: "Test carefully to avoid lockout"
  - Save: Manual with confirmation

- **Allowed email domains**
  - Control: Toggle "Restrict to specific domains"
  - Conditional: Domain list (add/remove)
  - Example: `@company.com`, `@partner.org`
  - Save: Manual

##### Data Retention
- **Message retention policy**
  - Control: Radio group
    - Keep all messages forever
    - Keep messages for [X] days (input field)
    - Custom policy per channel type
  - Warning: "Deleted messages cannot be recovered"
  - Save: Manual with confirmation

- **File retention policy**
  - Control: Radio group
    - Keep all files forever
    - Keep files for [X] days (input field)
    - Custom policy per channel type
  - Save: Manual with confirmation

##### Compliance & Export
- **Data export**
  - Control: Button "Export Workspace Data"
  - Options modal:
    - Date range selector
    - Include: Messages, Files, User data
    - Format: JSON, CSV
  - Action: Sends download link via email
  - Save: Manual action

- **Audit logs**
  - Control: Button "View Audit Logs"
  - Opens: Searchable table of security events
    - Columns: Timestamp, User, Action, IP, Details
    - Filters: Event type, User, Date range
  - Export: "Download Logs" button

- **Compliance mode**
  - Control: Toggle
  - Help text: "Enable additional logging and retention for compliance"
  - Features: Extra audit logging, message edits tracked, deletion logging
  - Save: Manual with confirmation

##### External Sharing
- **Allow file sharing with external domains**
  - Control: Toggle
  - Save: Auto-save

- **Link sharing expiration**
  - Control: Radio group
    - Links never expire
    - Links expire after [X] days (input)
    - Require password for external links
  - Save: Auto-save

---

### 6. Billing & Plans

**Page Title**: Billing & Plans
**Description**: Manage subscription, usage, and payment methods

#### Settings Groups

##### Current Plan
- **Plan Details**
  - Display: Card showing
    - Plan name (Free, Pro, Enterprise)
    - Price per user/month
    - Billing cycle (Monthly/Annual)
    - Renewal date
    - Active users count
  - Action: "Change Plan" button

- **Plan Features**
  - Display: Feature comparison table
    - Columns: Feature, Current Plan, Other Plans
    - Examples: Message history, File storage, Apps, Video calls
  - Action: "Upgrade" or "Downgrade" buttons

##### Usage & Limits
- **Current Usage**
  - Display: Progress bars showing
    - Active members: [X] / [Limit]
    - Message history: [X days] / [Limit]
    - File storage: [X GB] / [Y GB]
    - Video call minutes: [X] / [Limit]
  - Warning: "Approaching limit" alerts
  - Action: "Upgrade for more" link

##### Payment Methods
- **Payment Method**
  - Display: Card showing
    - Card brand + last 4 digits
    - Expiration date
    - Billing address
  - Actions: "Update" or "Remove"
  - Action: "Add Payment Method" button

- **Billing Address**
  - Control: Address form
    - Company name
    - Street address
    - City, State, ZIP
    - Country
    - Tax ID (optional)
  - Save: Manual with "Update Address"

##### Billing History
- **Invoices**
  - Control: Table of past invoices
    - Columns: Invoice number, Date, Amount, Status, Download
    - Filters: Date range, Status (Paid, Pending, Failed)
  - Action: "Download" PDF per invoice
  - Export: "Download All" button

##### Subscription Management
- **Auto-renewal**
  - Control: Toggle
  - Help text: "Automatically renew subscription"
  - Save: Auto-save

- **Billing contacts**
  - Control: List of email addresses
  - Help text: "Receive billing notifications"
  - Actions: Add/Remove emails
  - Save: Auto-save

##### Cancellation
- **Cancel Subscription**
  - Control: Text link (subtle, at bottom)
  - Action: Opens modal with
    - Reason selector
    - Feedback textarea
    - Confirmation checkbox
    - "Cancel Subscription" button (danger)
  - Effect: Workspace remains active until end of billing period

---

## Interaction Patterns

### Save Behaviors

#### Auto-Save (Most Settings)
- **Trigger**: On change, after 500ms debounce
- **Indicator**:
  - Spinner icon next to control while saving
  - Checkmark icon on success (fades after 2s)
- **Error**: Error message appears below control, save retries
- **UX**: No manual save button needed

#### Manual Save (Critical/Bulk Changes)
- **Trigger**: Explicit "Save Changes" button
- **Indicator**:
  - Button shows "Saving..." with spinner
  - Success message appears at top of section
- **Error**: Error message at top with retry button
- **UX**: Button disabled until changes made

#### Immediate Save (Upload/Delete Actions)
- **Trigger**: Immediately on action
- **Indicator**:
  - Loading state on control
  - Success/error toast notification
- **Error**: Toast with retry action
- **UX**: Optimistic UI with rollback on failure

### Confirmation Modals

Used for destructive or irreversible actions:

```
┌─────────────────────────────────────────┐
│  ⚠️  Confirm Action                      │
├─────────────────────────────────────────┤
│                                         │
│  [Warning message explaining impact]   │
│                                         │
│  Type "WORKSPACE-NAME" to confirm:      │
│  [________________]                     │
│                                         │
│  [ ] I understand this is irreversible  │
│                                         │
├─────────────────────────────────────────┤
│              [Cancel] [Confirm Action]  │
└─────────────────────────────────────────┘
```

### Search & Filter Patterns

- **Instant search**: Filter results as you type (no search button)
- **Clear filters**: "Clear all" link when filters active
- **Active filters**: Pill-style tags showing active filters
- **No results**: Helpful message with action (e.g., "Create channel")

### Progressive Disclosure

- **Advanced settings**: Collapsed by default with "Show advanced" toggle
- **Conditional sections**: Appear/disappear based on parent toggle
- **Inline help**: "Learn more" links expand help text in place

---

## Accessibility Considerations

### Keyboard Navigation
- All controls accessible via Tab/Shift+Tab
- Focus indicators clearly visible (3px outline)
- Escape key closes modals/dropdowns
- Enter/Space activates buttons/toggles
- Arrow keys navigate radio groups/lists

### Screen Reader Support
- Proper ARIA labels for all controls
- Live regions announce save status
- Error messages associated with controls
- Descriptive link text (no "click here")
- Heading hierarchy for navigation

### Visual Design
- Minimum 4.5:1 contrast ratio for text
- Color never sole indicator (use icons/text)
- Focus indicators visible in all themes
- Clickable areas minimum 44x44px
- Clear visual hierarchy

### Error States
- Clear error messages in plain language
- Specific guidance on how to fix
- Error icon + red outline on invalid fields
- Error summary at top for forms with multiple errors

---

## Responsive Behavior

### Mobile (<768px)
- Sidebar becomes full-screen overlay
- Settings stack vertically
- Tables become stacked cards
- Sticky "Save" button at bottom
- Collapsible sections auto-collapsed

### Tablet (768px-1024px)
- Sidebar remains visible, narrower
- Two-column layouts for some sections
- Full table views maintained

### Desktop (>1024px)
- Sidebar + content side-by-side
- Multi-column layouts for comparisons
- Hover states for additional info

---

## Implementation Notes

### State Management
- Personal settings sync across devices in real-time
- Admin settings require permission check before render
- Optimistic UI updates with rollback on failure
- Local draft state for manual save sections

### Performance
- Lazy load setting sections (code split per page)
- Debounce auto-save inputs (500ms)
- Virtual scrolling for large lists (members, channels)
- Image uploads compressed client-side before upload

### Localization
- All text externalized for translation
- Date/time formats respect user locale
- RTL support for right-to-left languages
- Number formats localized (1,000 vs 1.000)

---

**End of Design Specification**
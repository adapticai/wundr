

# **Architectural Blueprint and Implementation Backlog for Enterprise Communication Platform**

## **1\. Executive Summary**

This document serves as the definitive architectural specification and implementation backlog for a high-fidelity enterprise communication platform designed to replicate and extend the core functionalities of industry leaders such as Slack. The objective is to engineer a unified, cross-platform application that functions seamlessly as a Progressive Web Application (PWA), a native mobile application (iOS/Android), and a desktop application (macOS/Windows). The architectural philosophy prioritizes type safety, real-time performance, and code reusability across platforms through a monorepo structure utilizing Next.js, Capacitor, and Electron.

The backend infrastructure is architected around a GraphQL API powered by Apollo Server and Prisma ORM, utilizing WebSockets for real-time bidirectional communication and Redis for scalable event distribution and presence management. Video and audio conferencing capabilities—referred to as "Huddles"—are integrated via the LiveKit WebRTC infrastructure. Authentication is handled through a hybrid implementation of Auth.js (NextAuth) v5, adapted to bridge the gap between web-based OIDC flows and native mobile application lifecycles.

This report is structured to provide a granular, phase-by-phase implementation guide. It moves from foundational infrastructure setup (Phase 0\) to complex feature modules, detailing user stories, engineering specifications, database schemata, and acceptance criteria for every functional unit. The analysis incorporates insights from comparable platforms like Rocket.Chat and Mattermost to ensure feature parity with enterprise-grade expectations regarding security, granularity, and user experience.1

---

## **2\. System Architecture and Technology Strategy**

### **2.1 Monorepo Architecture: Turborepo**

To maximize developer velocity and code consistency across the web, mobile, and desktop targets, the project employs a monorepo structure managed by Turborepo. This approach allows for the centralization of configuration (ESLint, TypeScript, Tailwind) and the sharing of core libraries (UI components, database clients, API types) without duplication.3

The repository structure is designed to isolate concerns while facilitating shared dependencies:

* **/apps/web**: The primary Next.js 14+ (App Router) application. It serves as the PWA, the render target for the Electron wrapper, and the source for the Capacitor mobile build.5  
* **/apps/desktop**: Contains the Electron main process logic. It is responsible for creating the browser window, handling inter-process communication (IPC) for native desktop features (e.g., screen recording permissions, tray icons), and bundling the Next.js application for offline distribution.7  
* **/packages/ui**: A shared design system library. It exports atomic components built with Shadcn/ui and Radix Primitives, ensuring that buttons, modals, and inputs behave identically across all platforms.8  
* **/packages/database**: Houses the Prisma schema and the generated Prisma Client. This package exports a singleton instance of the database client to prevent connection pool exhaustion in serverless development environments.10  
* **/packages/api-types**: Contains TypeScript definitions generated from the GraphQL schema. This ensures end-to-end type safety, allowing the frontend to validate queries against the backend schema at build time.

### **2.2 The Real-Time Engine: Apollo, GraphQL, and Redis**

Unlike traditional REST architectures, a chat application requires a persistent, event-driven connection to deliver messages instantly. The architecture utilizes Apollo Server 4 to manage GraphQL operations.

**Transport Layer Strategy:**

* **Queries & Mutations:** Standard HTTP POST requests are used for fetching history and performing actions (sending messages, creating channels). This leverages standard caching and load balancing infrastructure.  
* **Subscriptions:** WebSocket connections (via graphql-ws) are established for receiving real-time events. This separation ensures that the stateful WebSocket layer is decoupled from the stateless HTTP layer, facilitating easier scaling.11

Scalability via Redis:  
To support horizontal scaling where multiple server instances might be running, an in-memory PubSub system is insufficient. A message published to Server A would not reach a user connected to Server B. Therefore, Redis PubSub is implemented as the message bus. All mutations that alter state publish events to Redis topics (e.g., CHANNEL\_MESSAGES\_${ID}), which are then broadcast to all subscribed GraphQL WebSocket servers.13

### **2.3 Native Mobile and Desktop Strategy**

The strategy avoids maintaining three separate codebases (Swift, Kotlin, React) in favor of a "Write Once, Run Everywhere" approach, but with platform-specific enhancements.

* **Capacitor (Mobile):** Capacitor acts as a bridge, loading the Next.js web application within a native WebView. Critical native features such as Push Notifications (APNs/FCM) and Deep Linking are handled via Capacitor plugins, which expose native APIs to the JavaScript runtime.5  
* **Electron (Desktop):** Electron wraps the web application in a Chromium/Node.js container. This enables access to desktop-specific APIs, such as global keyboard shortcuts and more robust screen-sharing capabilities required for Huddles.6

---

## **3\. Phase 0: Infrastructure, DevOps, and Initialization**

Before feature development begins, the foundational infrastructure must be established to support the complex build requirements of a multi-target monorepo.

### **3.1 Task 0.1: Monorepo Initialization and Tooling**

**Objective:** Establish the Turborepo workspace, configure the package manager, and set up shared configurations.

**Engineering Specifications:**

1. **Workspace Setup:**  
   * Initialize root with pnpm (Performant NPM) to handle workspace symlinking efficienty.  
   * Configure turbo.json to define the dependency graph. Tasks like build, lint, and test must be configured to cache artifacts. For example, the build task for apps/web depends on the build task of packages/ui.4  
2. **Shared Configuration:**  
   * Create @repo/typescript-config: A base tsconfig.json enforcing strict mode, consistent path aliases (e.g., @/components), and exclusion of build artifacts.  
   * Create @repo/eslint-config: A shared ESLint configuration including next/core-web-vitals and prettier plugins to enforce code style across the monolith.  
   * Create @repo/tailwind-config: A shared Tailwind configuration file defining the color palette, typography tokens, and breakpoint logic. This ensures that if the "Primary Brand Color" changes, it updates across the web app and the shared UI package simultaneously.8

**Acceptance Criteria:**

* Running pnpm install at the root installs dependencies for all apps and packages.  
* Running pnpm build triggers a cached build of the UI library followed by the Web app.  
* VS Code recognizes types imported from @repo/ui within the Next.js application.

### **3.2 Task 0.2: Database and ORM Layer**

**Objective:** initialize the PostgreSQL database and Prisma ORM to support the initial data models.

**Engineering Specifications:**

1. **Docker Containerization:**  
   * Create a docker-compose.yml file in the root to spin up a PostgreSQL 15 instance and a Redis 7 instance.  
   * Configure persistent volumes for local development data retention.  
2. **Prisma Setup (packages/database):**  
   * Initialize Prisma with npx prisma init.  
   * Define the initial schema in schema.prisma. This includes the core User, Account (for Auth.js), Session, VerificationToken, Workspace, and WorkspaceMember models.  
   * Implement the Prisma Client singleton pattern. In Next.js development (with Hot Module Replacement), multiple Prisma Client instances can be instantiated, exhausting the database connection limit. The singleton pattern ensures only one instance exists.10

**Acceptance Criteria:**

* docker-compose up \-d successfully starts Postgres and Redis.  
* pnpm db:push applies the schema to the local database.  
* The package.json in packages/database exports the Prisma Client correctly.

### **3.3 Task 0.3: GraphQL Server and WebSocket Gateway**

**Objective:** Configure Apollo Server 4 with graphql-ws support.

**Engineering Specifications:**

1. **HTTP/WebSocket Separation:**  
   * Next.js API routes (pages/api/graphql.ts or app/api/graphql/route.ts) are ideal for the stateless Query/Mutation traffic handled by Apollo Server.  
   * However, WebSockets require a long-running process. We will implement a custom server entry point (e.g., server.ts using http and express or fastify) that handles the WebSocket upgrade request separately from the Next.js render cycle, or deploy a separate microservice for subscriptions if deploying to a serverless environment like Vercel is strictly required. For this specification, we assume a custom server or a separate Node.js container for the Subscription service to ensure reliability.11  
2. **Redis PubSub Integration:**  
   * Instantiate RedisPubSub from graphql-redis-subscriptions in the server setup.  
   * Configure connection retry strategies to handle Redis downtime gracefully.13

**Acceptance Criteria:**

* Apollo Sandbox connects to http://localhost:3000/api/graphql.  
* A test subscription timeUpdated emits a timestamp every second to a connected client.

### **3.4 Task 0.4: Native Wrapper Configuration**

**Objective:** Initialize Capacitor and Electron projects.

**Engineering Specifications:**

1. **Electron:**  
   * Create the main process entry point (apps/desktop/electron/main.ts).  
   * Configure electron-builder.yml to define appId (e.g., com.enterprise.chat), output directories, and platform-specific targets (DMG, NSIS).15  
   * Implement a preload script to expose safe IPC channels (context isolation enabled).  
2. **Capacitor:**  
   * Run npx cap init inside apps/web.  
   * Configure capacitor.config.ts to set the webDir to out (for static exports) or point the server.url to the local network IP for live reload during development.5

**Acceptance Criteria:**

* pnpm electron:dev launches a desktop window displaying the Next.js app.  
* pnpm cap open ios opens Xcode with the properly configured project.

---

## **4\. Module 1: Authentication and Identity Management**

Authentication in a multi-platform environment presents unique challenges, particularly regarding the handling of secure cookies in native webviews versus system browsers.

### **Feature 1.1: Unified Sign-On (SSO) and Multi-Tenancy**

**User Story:** As a user, I want to sign in once using my corporate credentials (Google/GitHub/Email) and access all my workspaces.

Research Context:  
Auth.js v5 serves as the backbone. The system must handle OIDC flows where the Identity Provider (IdP) requires a browser redirect. On native mobile apps, this redirect opens the system browser (Safari/Chrome), breaking the session context when returning to the app.16  
**Engineering Specifications:**

* **Database Schema:**  
  * User: Represents the human entity.  
  * Account: Links the User to OAuth providers (Google sub, GitHub id).  
  * Workspace: The tenant root.  
  * WorkspaceMember: Many-to-many relationship defining the User's role (OWNER, ADMIN, MEMBER, GUEST) within a specific Workspace.1  
* **Auth Configuration:**  
  * Configure NextAuth with GoogleProvider and EmailProvider (Magic Links).  
  * Implement callbacks.session to inject the userId into the session object.  
  * **Multi-tenancy:** The session token validates the user's identity globally, but accessing a specific workspace requires a secondary check against the WorkspaceMember table during API calls.

**Acceptance Criteria:**

* User can authenticate via Google.  
* If the email does not exist, a new User record is created.  
* The session persists across browser reloads.

### **Feature 1.2: Native Mobile Authentication Strategy (Deep Linking)**

**User Story:** As a mobile user, I need to log in via the system browser and be securely redirected back to the app without losing my session.

Research Insight:  
Capacitor WebViews do not share cookie storage with the mobile OS browser. Therefore, a standard NextAuth redirect sets a cookie in Safari that the Capacitor app cannot read. The solution involves a "Manual Token Exchange" pattern.17  
**Engineering Specifications:**

1. **Deep Link Registration:**  
   * Register a custom URL scheme (e.g., slackclone://) in Info.plist (iOS) and AndroidManifest.xml.  
2. **The Handshake Flow:**  
   * **Step 1:** App initiates login by opening the system browser to /api/auth/signin/google.  
   * **Step 2:** NextAuth callback is configured to redirect to a special intermediate page: /auth/mobile-callback?token={short\_lived\_code}.  
   * **Step 3:** This intermediate page detects it is not in the app and redirects to slackclone://auth-success?code={short\_lived\_code}.  
   * **Step 4:** The Capacitor app listens for the appUrlOpen event, extracts the code.  
   * **Step 5:** The app makes a fetch request to /api/auth/mobile-exchange with the code.  
   * **Step 6:** The server validates the code and responds with the long-lived Session JWT.  
   * **Step 7:** The app stores this JWT in Capacitor Secure Storage and injects it into the Authorization header of the GraphQL client.19

**Acceptance Criteria:**

* Clicking login on mobile opens Safari.  
* After authentication, Safari closes automatically.  
* The app resumes and transitions to the logged-in state.  
* The authentication token is stored securely and survives app restart.

---

## **5\. Module 2: The Messaging Engine**

The core value proposition of the platform is its granular, reliable, and real-time messaging capability. This module covers the lifecycle of a message from composition to delivery.

### **Feature 2.1: Granular Message Composition**

**User Story:** As a user, I want a rich text editor that supports markdown, code blocks, and mentions, with the ability to edit or delete messages after sending.

**Engineering Specifications:**

* **Schema (Message):**  
  * id: CUID.  
  * content: String (Markdown or JSON for rich text).  
  * type: Enum (TEXT, SYSTEM, FILE).  
  * isEdited: Boolean.  
  * deletedAt: DateTime (Soft delete to maintain thread integrity).20  
* **Frontend Components:**  
  * Implement a rich text editor (e.g., Tiptap or Slate) wrapped in a Shadcn Component.  
  * Support @ triggers to open a user search popover.  
* **Mutations:**  
  * updateMessage(id, content): Verifies authorId matches currentUser. Updates content and sets isEdited \= true. Publishes MESSAGE\_UPDATED event.  
  * deleteMessage(id): Sets deletedAt to now. Publishes MESSAGE\_DELETED event. The UI renders this as "This message was deleted."

**Acceptance Criteria:**

* User can bold text using Markdown syntax (\*\*text\*\*).  
* Edited messages show an "(edited)" suffix.  
* Deleted messages are removed from the view but retained in the DB for audit purposes if required by enterprise settings.

### **Feature 2.2: Threaded Conversations**

**User Story:** As a user, I want to reply to a specific message to start a side-thread, keeping the main channel clutter-free.

Research Insight:  
Threaded models reduce cognitive load. Slack's implementation treats threads as separate timelines anchored to a parent message.20  
**Engineering Specifications:**

* **Schema Extensions:**  
  * Message model adds parentId (Self-relation to Message).  
  * Message model adds replyCount (Integer) and latestReplyAt (DateTime) to optimize list rendering without expensive aggregation queries.  
* **UI Architecture:**  
  * Thread View is a secondary router outlet or a collapsible sidebar panel.  
  * Clicking "Reply" on a message sets the activeThreadId state.  
* **Subscription Logic:**  
  * **Main Channel Subscription:** Listens for messages where channelId \== X AND parentId is NULL.  
  * **Thread Subscription:** Listens for messages where parentId \== Y.  
  * *Optimization:* The Main Channel Subscription also listens for THREAD\_UPDATED events to update the "3 replies" indicator on the parent message without fetching the actual reply content.21

**Acceptance Criteria:**

* Replies in a thread do not appear in the main channel stream.  
* The parent message updates its reply count in real-time.  
* Users can navigate back to the main channel from the thread view.

### **Feature 2.3: Optimistic UI and Offline Mutation Queue**

**User Story:** As a mobile user with unstable connectivity, I want to send messages that queue up and automatically send when I regain a connection.

Research Insight:  
Mobile users frequently experience dropouts. An "Optimistic UI" assumes success and renders the message immediately. If the network fails, the system must retry.22  
**Engineering Specifications:**

1. **Apollo Cache Optimism:**  
   * On sendMessage mutation, provide an optimisticResponse with a temporary ID.  
   * Apollo Client updates the UI immediately.  
2. **Offline Queue:**  
   * Use apollo-link-queue to intercept requests when navigator.onLine is false.  
   * Persist this queue to localforage (IndexedDB) so it survives an app refresh.  
   * When the online event fires, the queue flushes.  
3. **Error Handling:**  
   * If a message fails permanently (e.g., server validation error), update the UI to show a "Retry" button and a red error state.

**Acceptance Criteria:**

* Sending a message while in "Airplane Mode" shows the message in the UI with a grey opacity.  
* Disabling "Airplane Mode" automatically triggers the send and updates the message status to "Sent".

---

## **6\. Module 3: Channel and Workspace Management**

This module replicates the organizational structure of Slack, including the nuances of public versus private visibility and user roles.

### **Feature 3.1: Granular Role-Based Access Control (RBAC)**

**User Story:** As a Workspace Owner, I want to assign "Admin" roles to users so they can manage channels, while restricting "Guests" to specific channels only.

Research Insight:  
Rocket.Chat and Mattermost highlight the importance of granular permissions (e.g., create-c, delete-c, view-history) rather than simple boolean flags.1  
**Engineering Specifications:**

* **Schema:**  
  * Role Enum: OWNER, ADMIN, MEMBER, MULTI\_CHANNEL\_GUEST, SINGLE\_CHANNEL\_GUEST.  
  * ChannelMember model includes role specific to that channel (e.g., a user might be a Moderator in one channel but a Member in another).  
* **Authorization Middleware (GraphQL Shield):**  
  * Define rule isChannelAdmin: Checks if ctx.user.id exists in ChannelMember with role ADMIN or OWNER.  
  * Apply rule to mutations like archiveChannel, renameChannel.  
* **Multi-Channel Guest:**  
  * This user type is restricted from browsing public channels. They can only see channels they are explicitly invited to.

**Acceptance Criteria:**

* An "Admin" can rename any channel in the workspace.  
* A "Member" can only rename channels they created (if policy allows).  
* A "Guest" cannot search for users outside their assigned channels.

### **Feature 3.2: Channel Discovery and Archiving**

**User Story:** As a user, I want to browse all public channels to find relevant discussions, and archive channels that are no longer active.

**Engineering Specifications:**

* **Browsing:**  
  * Query publicChannels returns all channels where isPrivate is false.  
  * Pagination is essential; use cursor-based pagination to handle thousands of channels.  
* **Archiving:**  
  * Mutation archiveChannel(id) sets isArchived \= true.  
  * Archived channels become read-only. The input box is disabled in the UI.  
  * Archived channels are excluded from default search results but can be toggled on.  
* **Private Channel Security:**  
  * The backend resolver for channel(id) must strictly validate: if (channel.isPrivate &&\!isMember) throw ForbiddenError. Secure by default.

**Acceptance Criteria:**

* Archived channels show a distinct "Archived" banner.  
* No new messages can be posted to archived channels.  
* Private channels do not appear in the public directory.

---

## **7\. Module 4: Real-Time Presence and Status**

Presence (Online/Away/Offline) provides critical context for communication. Due to the stateless nature of HTTP and the connection-oriented nature of WebSockets, managing presence requires a dedicated strategy.

### **Feature 4.1: Heartbeat-Based Presence System**

**User Story:** As a user, I want to see a green dot next to colleagues who are currently active and a grey dot for those who are offline.

Research Insight:  
Relying solely on WebSocket disconnect events is unreliable (e.g., mobile OS kills the app in the background without sending a TCP FIN packet). A "Heartbeat" pattern with Redis keys is the robust solution.25  
**Engineering Specifications:**

* **Architecture Table:**

| Component | Responsibility | Mechanism |
| :---- | :---- | :---- |
| **Client** | Report liveness | Sends heartbeat mutation every 30s. |
| **Redis** | Store state | SET user:presence:{id} "online" EX 45\. Key expires in 45s. |
| **Worker** | Detect offline | Redis Keyspace Notifications (Ex event) trigger when a key expires. |
| **PubSub** | Broadcast | Worker publishes USER\_STATUS\_CHANGE { userId, status: 'OFFLINE' }. |

* **Implementation Logic:**  
  * **On App Focus:** Client sends heartbeat.  
  * **On App Blur:** Client sends away status (optional).  
  * **GraphQL Subscription:** userStatusChanged listens to the global presence topic.  
  * **Batching:** To avoid flooding the client with thousands of status updates, the server can batch presence updates and emit them every 1-2 seconds (throttling).

**Acceptance Criteria:**

* User A goes offline (disconnects internet).  
* User B sees User A's status turn to "Offline" within \~45-60 seconds.  
* User A opens the app; status turns "Online" immediately.

### **Feature 4.2: Custom Status and Expiry**

**User Story:** As a user, I want to set a custom status (e.g., "In a meeting \- until 2 PM") that clears automatically.

**Engineering Specifications:**

* **Schema:** User model adds statusText, statusEmoji, statusExpiresAt.  
* **Logic:**  
  * Mutation setUserStatus takes text, emoji, and an optional duration.  
  * Server calculates absolute statusExpiresAt.  
  * Background Job (Cron or Redis Scheduler) clears statuses where statusExpiresAt \< NOW.

**Acceptance Criteria:**

* Status appears in the user profile and message tooltips.  
* Status disappears automatically after the specified duration.

---

## **8\. Module 5: File Management and Media**

Handling file uploads in a chat application requires bypassing the application server for data transfer to ensure scalability and performance.27

### **Feature 5.1: Direct-to-S3 Uploads**

**User Story:** As a user, I want to drag and drop images, PDFs, and videos into the chat, seeing a preview immediately.

**Engineering Specifications:**

1. **The Signed URL Pattern:**  
   * **Step 1:** Client selects file. Request uploadUrl mutation from GraphQL API with filename and contentType.  
   * **Step 2:** Server authenticates user and generates a Pre-Signed PUT URL from AWS S3 (or MinIO for self-hosted).  
   * **Step 3:** Server returns URL and a generated fileKey.  
   * **Step 4:** Client uploads binary data directly to S3 using fetch or XMLHttpRequest (for progress tracking).  
   * **Step 5:** Upon 200 OK from S3, Client sends sendMessage mutation containing the fileKey.  
2. **Image Optimization:**  
   * Use an AWS Lambda trigger on S3 upload to generate thumbnails (blurhash) and optimize images (WebP).  
   * Update the File record in the database with the thumbnail URL.

**Acceptance Criteria:**

* Upload progress bar accurately reflects transfer status.  
* Large files (e.g., 50MB video) do not block the main application thread or crash the GraphQL server.  
* Images render with a blur-up effect while loading.

### **Feature 5.2: File Retention and Governance**

**User Story:** As an enterprise admin, I want to set a policy that files are automatically deleted after 90 days to save storage costs.

**Engineering Specifications:**

* **Schema:** WorkspaceSettings model adds fileRetentionDays (Int).  
* **Implementation:**  
  * Scheduled cron job runs daily.  
  * Query: Files where createdAt \< (NOW \- retentionDays).  
  * Action: Delete object from S3, then delete record from Postgres.  
  * Audit: Log the deletion in AuditLog.

**Acceptance Criteria:**

* Files older than the policy limit are removed.  
* Users trying to access a deleted file link see a specialized "File expired" error message.

---

## **9\. Module 6: Voice and Video (Huddles)**

Replicating "Huddles" requires WebRTC. LiveKit is chosen for its scalability and ease of integration compared to raw WebRTC.29

### **Feature 6.1: One-Click Huddles**

**User Story:** As a user, I want to toggle a switch to hop into a voice channel instantly, without ringing other users.

**Engineering Specifications:**

* **Token Generation Service:**  
  * Endpoint: /api/livekit/token.  
  * Logic: Validate session. Generate JWT with videoGrant { room: channelId, roomJoin: true }.  
* **Frontend Integration:**  
  * Component: \<HuddleRoom /\> using @livekit/components-react.  
  * State: isHuddleOpen (Global State/Context).  
  * UI: When a huddle is active in a channel, a "Huddle Bar" appears at the bottom of the sidebar or top of the channel view, showing avatars of participants.  
* **Permissions:**  
  * Only channel members can request a token for that specific channel room.

**Acceptance Criteria:**

* User clicks headphone icon; connects to audio within 2 seconds.  
* Talking triggers a green ring animation around the user's avatar (Voice Activity Detection).  
* Switching channels keeps the audio connection alive (Picture-in-Picture mode logic).

### **Feature 6.2: Desktop Screen Sharing**

**User Story:** As a desktop user, I want to share a specific window or my entire screen during a huddle.

Research Insight:  
Electron apps require specific handling for screen capture sources. Standard browser APIs often fail to list all windows due to OS permissions.6  
**Engineering Specifications:**

* **Electron Main Process:**  
  * Handle desktopCapturer.getSources() request from renderer.  
  * Display a native picker dialog (or custom React modal using the sources list).  
* **Renderer Process:**  
  * Receive the sourceId.  
  * Call navigator.mediaDevices.getUserMedia with { video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId } } }.  
  * Publish the track to LiveKit.

**Acceptance Criteria:**

* User can select between "Entire Screen" and specific application windows.  
* Remote users see the screen share in high resolution (adaptive bitrate handles bandwidth drops).

---

## **10\. Module 7: Search and Discovery**

### **Feature 7.1: Full-Text Search with Modifiers**

**User Story:** As a user, I want to search for "budget from:alice in:general" to find specific historical context.

**Engineering Specifications:**

* **Search Engine Strategy:**  
  * **PostgreSQL FTS:** For MVP and smaller workspaces, use Postgres tsvector and tsquery.  
  * **Elasticsearch/Opensearch:** For Enterprise scale, sync Message table to an Elasticsearch cluster using monstache or a Prisma middleware hook.  
* **Query Parsing:**  
  * Parse the search string:  
    * from:alice \-\> Resolve Alice's UserID \-\> where authorId \= X.  
    * in:general \-\> Resolve ChannelID \-\> where channelId \= Y.  
    * budget \-\> Full text match against content.  
* **Highlighting:**  
  * The search response should include fragments with the matching terms wrapped in \<em\> tags.

**Acceptance Criteria:**

* Search results load in a dedicated panel.  
* Results clearly highlight the matching keywords.  
* Clicking a result jumps the main chat view to that message's position in the timeline (requires bidirectional scroll pagination).

---

## **11\. Module 8: Native Integrations and Notifications**

### **Feature 8.1: Push Notifications (FCM & APNs)**

**User Story:** As a user, I want to be notified on my phone when I am mentioned, but not for every single message in a busy channel.

**Engineering Specifications:**

* **Notification Preferences Schema:**  
  * NotificationSetting model: userId, channelId, level (ALL, MENTIONS, NONE).  
* **Trigger Logic:**  
  * When sendMessage occurs:  
    1. Identify mentioned users (regex parsing of content).  
    2. Identify all channel members.  
    3. Filter list based on NotificationSetting.  
    4. Send payload to FCM (Firebase Cloud Messaging) for each target user.  
* **Capacitor Implementation:**  
  * Register listeners for pushNotificationReceived (foreground) and pushNotificationActionPerformed (background tap).  
  * On tap, navigate deep link to the specific channel/message.

**Acceptance Criteria:**

* User receives notification "Alice mentioned you in \#general".  
* Tapping notification opens the app directly to the message.

### **Feature 8.2: Electron Tray and System Integration**

**User Story:** As a desktop user, I want the app to minimize to the system tray and show a red badge on the dock icon when I have unread messages.

**Engineering Specifications:**

* **Electron API:**  
  * app.dock.setBadge('•') (macOS).  
  * Tray API for Windows system tray.  
* **Unread Counter Logic:**  
  * Frontend calculates totalUnreadMentions.  
  * Sends IPC message update-badge to Main process.  
  * Main process updates the OS badge.

**Acceptance Criteria:**

* Closing the window on Windows minimizes to Tray instead of quitting (standard chat app behavior).  
* Dock icon updates in real-time as messages arrive.

---

## **12\. Implementation Roadmap**

| Phase | Milestone | Deliverables | Est. Complexity |
| :---- | :---- | :---- | :---- |
| **0** | **Foundation** | Monorepo, DB Setup, Apollo Server, CI/CD Pipeline. | High |
| **1** | **Identity** | Auth.js, Deep Linking, Workspace Creation, RBAC Base. | High |
| **2** | **Messaging Core** | Real-time Chat, Threads, Emoji, Optimistic UI. | Very High |
| **3** | **Organization** | Channels (Public/Private), DMs, User Presence. | Medium |
| **4** | **Rich Media** | File Uploads, S3 Integration, Image Previews. | Medium |
| **5** | **Voice/Video** | LiveKit Huddles, Screen Sharing (Electron). | High |
| **6** | **Native Polish** | Push Notifications, Deep Links, Offline Queue. | High |
| **7** | **Enterprise** | Search, Audit Logs, Retention Policies. | Medium |

## **13\. Conclusion**

This specification provides a rigorous path to building a competitive enterprise communication platform. The choice of **Next.js, Capacitor, and Electron** allows for maximum code reuse, while **Apollo and Redis** provide the necessary backbone for high-concurrency real-time features.

Key risks identified include the complexity of **native mobile authentication** and the **synchronization of presence state** across distributed systems. The strategies outlined—specifically the manual token exchange for auth and the Redis heartbeat for presence—mitigate these risks by employing proven, scalable patterns. By adhering to the granular acceptance criteria defined herein, the engineering team can ensure a high-quality, robust product release.

#### **Works cited**

1. Secure, Scalable, and Customizable for Mission-Critical Operations \- Rocket.Chat, accessed November 24, 2025, [https://www.rocket.chat/platform-overview](https://www.rocket.chat/platform-overview)  
2. Mattermost documentation, accessed November 24, 2025, [https://docs.mattermost.com/](https://docs.mattermost.com/)  
3. How to Build a Monorepo with Next.js \- DEV Community, accessed November 24, 2025, [https://dev.to/rajeshnatarajan/how-to-build-a-monorepo-with-nextjs-3ljg](https://dev.to/rajeshnatarajan/how-to-build-a-monorepo-with-nextjs-3ljg)  
4. Next.js \- Turborepo, accessed November 24, 2025, [https://turborepo.com/docs/guides/frameworks/nextjs](https://turborepo.com/docs/guides/frameworks/nextjs)  
5. Integrating Capacitor with Next.js: A Step-by-Step Guide | by Hamza Ali \- Medium, accessed November 24, 2025, [https://hamzaaliuddin.medium.com/integrating-capacitor-with-next-js-a-step-by-step-guide-685c5030710c](https://hamzaaliuddin.medium.com/integrating-capacitor-with-next-js-a-step-by-step-guide-685c5030710c)  
6. Building Desktop Apps Reinvented: A Next.js & Electron Monorepo Template, accessed November 24, 2025, [https://tharushkaheshan.medium.com/building-desktop-apps-reinvented-a-next-js-electron-monorepo-template-a825d163258a](https://tharushkaheshan.medium.com/building-desktop-apps-reinvented-a-next-js-electron-monorepo-template-a825d163258a)  
7. The ultimate Electron app with Next.js and React Server Components | by Kirill Konshin, accessed November 24, 2025, [https://medium.com/@kirill.konshin/the-ultimate-electron-app-with-next-js-and-react-server-components-a5c0cabda72b](https://medium.com/@kirill.konshin/the-ultimate-electron-app-with-next-js-and-react-server-components-a5c0cabda72b)  
8. From Monolith to Monorepo: Building Faster with Turborepo, pnpm and Capacitor \- DEV Community, accessed November 24, 2025, [https://dev.to/saltorgil/from-monolith-to-monorepo-building-faster-with-turborepo-pnpm-and-capacitor-41ng](https://dev.to/saltorgil/from-monolith-to-monorepo-building-faster-with-turborepo-pnpm-and-capacitor-41ng)  
9. How do I create a component in "packages/ui" that uses "next" package? · vercel turborepo · Discussion \#5866 \- GitHub, accessed November 24, 2025, [https://github.com/vercel/turborepo/discussions/5866](https://github.com/vercel/turborepo/discussions/5866)  
10. Subscriptions/real-time API support · Issue \#298 · prisma/prisma \- GitHub, accessed November 24, 2025, [https://github.com/prisma/prisma/issues/298](https://github.com/prisma/prisma/issues/298)  
11. Subscriptions \- Apollo GraphQL Docs, accessed November 24, 2025, [https://www.apollographql.com/docs/react/data/subscriptions](https://www.apollographql.com/docs/react/data/subscriptions)  
12. Setting Up Subscriptions for Real-Time Data with Apollo Server 4 | CodeSignal Learn, accessed November 24, 2025, [https://codesignal.com/learn/courses/graphql-mutations-and-advanced-apollo-server-1/lessons/setting-up-subscriptions-for-real-time-data-with-apollo-server-4](https://codesignal.com/learn/courses/graphql-mutations-and-advanced-apollo-server-1/lessons/setting-up-subscriptions-for-real-time-data-with-apollo-server-4)  
13. GraphQL subscriptions with Redis Pub Sub, accessed November 24, 2025, [https://www.apollographql.com/blog/graphql-subscriptions-with-redis-pub-sub](https://www.apollographql.com/blog/graphql-subscriptions-with-redis-pub-sub)  
14. Deep Links | Capacitor Documentation, accessed November 24, 2025, [https://capacitorjs.com/docs/guides/deep-links](https://capacitorjs.com/docs/guides/deep-links)  
15. electron-builder, accessed November 24, 2025, [https://www.electron.build/](https://www.electron.build/)  
16. Usage with Ionic Capacitor · nextauthjs next-auth · Discussion \#4446 \- GitHub, accessed November 24, 2025, [https://github.com/nextauthjs/next-auth/discussions/4446](https://github.com/nextauthjs/next-auth/discussions/4446)  
17. NextAuth and Capacitor \- Session Token Cookie · nextauthjs next-auth · Discussion \#9199, accessed November 24, 2025, [https://github.com/nextauthjs/next-auth/discussions/9199](https://github.com/nextauthjs/next-auth/discussions/9199)  
18. Refresh Token Rotation \- NextAuth.js, accessed November 24, 2025, [https://next-auth.js.org/v3/tutorials/refresh-token-rotation](https://next-auth.js.org/v3/tutorials/refresh-token-rotation)  
19. NextAuth Authentication in Electron App : r/nextjs \- Reddit, accessed November 24, 2025, [https://www.reddit.com/r/nextjs/comments/11jc01t/nextauth\_authentication\_in\_electron\_app/](https://www.reddit.com/r/nextjs/comments/11jc01t/nextauth_authentication_in_electron_app/)  
20. Use lists in Slack, accessed November 24, 2025, [https://slack.com/help/articles/27452748828179-Use-lists-in-Slack](https://slack.com/help/articles/27452748828179-Use-lists-in-Slack)  
21. Subscriptions and Live Queries \- Real Time with GraphQL | Hive, accessed November 24, 2025, [https://the-guild.dev/graphql/hive/blog/subscriptions-and-live-queries-real-time-with-graphql](https://the-guild.dev/graphql/hive/blog/subscriptions-and-live-queries-real-time-with-graphql)  
22. Mutations in Apollo Client \- Apollo GraphQL Docs, accessed November 24, 2025, [https://www.apollographql.com/docs/react/data/mutations](https://www.apollographql.com/docs/react/data/mutations)  
23. How to achieve offline support? · Issue \#424 · apollographql/apollo-client \- GitHub, accessed November 24, 2025, [https://github.com/apollographql/apollo-client/issues/424](https://github.com/apollographql/apollo-client/issues/424)  
24. Delegated granular administration \- Mattermost documentation, accessed November 24, 2025, [https://docs.mattermost.com/administration-guide/onboard/delegated-granular-administration.html](https://docs.mattermost.com/administration-guide/onboard/delegated-granular-administration.html)  
25. Real Time Presence Platform System Design, accessed November 24, 2025, [https://systemdesign.one/real-time-presence-platform-system-design/](https://systemdesign.one/real-time-presence-platform-system-design/)  
26. Beyond the Ping: Architecting a Robust User Presence System with Go and Redis \- Medium, accessed November 24, 2025, [https://medium.com/@yuseferi/beyond-the-ping-architecting-a-robust-user-presence-system-with-go-and-redis-463ca4738335](https://medium.com/@yuseferi/beyond-the-ping-architecting-a-robust-user-presence-system-with-go-and-redis-463ca4738335)  
27. File uploads \- Apollo GraphQL Docs, accessed November 24, 2025, [https://www.apollographql.com/docs/apollo-server/v3/data/file-uploads](https://www.apollographql.com/docs/apollo-server/v3/data/file-uploads)  
28. Building GraphQL API for Effortless File Uploads to AWS S3 | by Ahamed Safnaj, accessed November 24, 2025, [https://aws.plainenglish.io/building-graphql-api-for-effortless-file-uploads-to-aws-s3-cf9ba8b5bd12](https://aws.plainenglish.io/building-graphql-api-for-effortless-file-uploads-to-aws-s3-cf9ba8b5bd12)  
29. Next.js quickstart \- LiveKit docs, accessed November 24, 2025, [https://docs.livekit.io/home/quickstarts/nextjs/](https://docs.livekit.io/home/quickstarts/nextjs/)  
30. Generating tokens \- LiveKit docs, accessed November 24, 2025, [https://docs.livekit.io/home/server/generating-tokens/](https://docs.livekit.io/home/server/generating-tokens/)
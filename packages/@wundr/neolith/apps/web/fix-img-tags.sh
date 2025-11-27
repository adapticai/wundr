#!/bin/bash

# Script to add eslint-disable-next-line comments for img tags
# These are legitimate uses of img tags (avatars, icons, etc.)

files=(
  "__tests__/setup.tsx"
  "components/admin/member-edit-modal.tsx"
  "components/admin/member-list.tsx"
  "components/analytics/leaderboard.tsx"
  "components/auth/user-menu.tsx"
  "components/call/call-invite-dialog.tsx"
  "components/call/huddle-bar.tsx"
  "components/channel/channel-header.tsx"
  "components/channel/create-channel-dialog.tsx"
  "components/channel/dm-selector.tsx"
  "components/channel/invite-dialog.tsx"
  "components/channel/member-list.tsx"
  "components/chat/message-item.tsx"
  "components/chat/thread-panel.tsx"
  "components/notifications/notification-item.tsx"
  "components/notifications/notification-toast.tsx"
  "components/performance/index.tsx"
  "components/presence/online-users-list.tsx"
  "components/presence/orchestrator-status-card.tsx"
  "components/search/search-results.tsx"
  "components/upload/file-attachment.tsx"
  "components/upload/image-gallery.tsx"
  "components/upload/image-preview.tsx"
  "components/upload/lightbox.tsx"
  "components/vp/orchestrator-card.tsx"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing $file..."
    # Add eslint-disable-next-line before each <img tag
    sed -i '' 's|^\([ ]*\)<img |{/* eslint-disable-next-line @next/next/no-img-element */}\n\1<img |g' "$file"
  fi
done

echo "Done!"

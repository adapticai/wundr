# User Profile Settings - Quick Reference Guide

## Overview
Enhanced user profile settings page with comprehensive features for managing user identity, professional information, social links, and privacy settings.

## Features Implemented

### 1. Profile Picture Management
- **Upload Methods:**
  - Click to browse files
  - Drag and drop images
- **Image Editing:**
  - Drag to reposition
  - Zoom slider (0.5x - 3x)
  - 90-degree rotation
  - Circular crop preview
- **Specifications:**
  - Formats: JPEG, PNG, WebP, GIF
  - Max size: 10MB
  - Output: 512x512px JPEG at 95% quality
- **Validation:**
  - File type checking
  - File size limits
  - Real-time preview

### 2. Basic Information
#### Display Name
- Length: 1-50 characters
- Character counter shown
- Required field
- Visible across all workspaces

#### Username/Handle
- Length: 3-30 characters
- Format: Lowercase letters, numbers, hyphens, underscores
- Real-time availability checking (500ms debounce)
- Visual indicators: ✓ (available) / ✗ (taken)
- Automatically converted to lowercase

#### Bio/Description
- Length: Max 500 characters
- Multi-line textarea
- Character counter
- Optional field

### 3. Professional Information
#### Title/Role
- Length: Max 100 characters
- Example: "Senior Designer", "Product Manager"
- Optional field

#### Location
- Length: Max 100 characters
- Format: Free text (city, region, or "remote")
- Optional field

#### Timezone
- Dropdown with IANA timezones
- Auto-detected from browser
- Used for scheduling and collaboration

#### Pronouns
- Predefined options:
  - he/him
  - she/her
  - they/them
  - Custom (with text input)
  - Prefer not to say
- Optional field

#### Status Message
- Length: Max 100 characters
- Examples: "On vacation", "In meetings", "Available"
- Character counter
- Optional field

### 4. Social Links
All links are optional and must be valid URLs:

- **LinkedIn:** `https://linkedin.com/in/username`
- **GitHub:** `https://github.com/username`
- **Twitter/X:** `https://twitter.com/username`
- **Website:** `https://yourwebsite.com`
- **Portfolio:** `https://portfolio.com`

**Validation:**
- Must be valid URLs (http:// or https://)
- Max 200 characters per link
- Empty fields allowed

### 5. Privacy & Visibility

#### Profile Visibility (Radio Buttons)
1. **Public**
   - Anyone can see your profile
   - Visible to all users

2. **Workspace Members Only**
   - Only members of your workspaces
   - Restricted to authenticated users

3. **Private**
   - Only you can see your full profile
   - Minimal public information

#### Individual Privacy Toggles (Switches)
- **Show Email:** Display email on profile
- **Show Location:** Display location on profile
- **Show Bio:** Display bio on profile
- **Show Social Links:** Display social links on profile

## User Interface

### Layout
```
┌─────────────────────────────────────────┐
│ Profile Picture                         │
│ ┌─────────┐                             │
│ │  Avatar │  Upload Photo / Drop here   │
│ └─────────┘                             │
├─────────────────────────────────────────┤
│ Basic Information                       │
│ • Display Name (with counter)           │
│ • Username (with availability check)    │
│ • Bio (textarea with counter)           │
├─────────────────────────────────────────┤
│ Professional Information                │
│ • Title/Role                            │
│ • Location                              │
│ • Timezone (dropdown)                   │
│ • Pronouns (dropdown)                   │
│ • Status Message (with counter)         │
├─────────────────────────────────────────┤
│ Social Links                            │
│ • LinkedIn                              │
│ • GitHub                                │
│ • Twitter/X                             │
│ • Website                               │
│ • Portfolio                             │
├─────────────────────────────────────────┤
│ Privacy & Visibility                    │
│ • Profile Visibility (radio)            │
│ • Individual Toggles (switches)         │
├─────────────────────────────────────────┤
│ [Cancel] [Save Changes]                 │
└─────────────────────────────────────────┘
```

### Visual Feedback
- **Loading states:** Spinner animations during upload/save
- **Success:** Green toast notification
- **Error:** Red toast notification with details
- **Validation:** Inline error messages below fields
- **Character counters:** Show current/max for text fields
- **Username availability:** Icon indicators (✓/✗/⏳)

## API Integration

### Endpoints Used

#### GET /api/users/me
- Fetch current user profile
- Includes all profile fields and preferences
- Used on page load

#### PATCH /api/users/me
- Update user profile
- Validates all fields server-side
- Returns updated profile

#### POST /api/users/[id]/avatar
- Upload profile picture
- Accepts multipart/form-data
- Returns avatar URLs

#### POST /api/users/username/check (NEW)
- Check username availability
- Debounced client-side
- Returns availability status

### Data Structure

```typescript
// Request payload for profile update
{
  name: string,
  displayName: string, // username
  bio: string,
  preferences: {
    location: string,
    timezone: string,
    title: string,
    pronouns: string,
    customPronouns: string,
    statusMessage: string,
    socialLinks: {
      linkedin: string,
      github: string,
      twitter: string,
      website: string,
      portfolio: string
    },
    visibility: {
      profileVisibility: 'public' | 'workspace' | 'private',
      showEmail: boolean,
      showLocation: boolean,
      showBio: boolean,
      showSocialLinks: boolean
    }
  }
}
```

## Validation Rules

### Client-side (Zod Schema)
- All fields validated in real-time
- Character limits enforced
- URL format validation
- Required fields checked
- Custom error messages

### Server-side
- Same Zod schema validation
- Database uniqueness checks
- Authentication verification
- File type/size validation
- XSS prevention

## Error Handling

### Common Errors
1. **"Username is already taken"**
   - Choose a different username
   - Username must be unique across platform

2. **"Image must be less than 10MB"**
   - Compress image before upload
   - Use image optimization tools

3. **"Invalid URL format"**
   - Ensure URLs start with http:// or https://
   - Check for typos

4. **"Username must be 3-30 characters"**
   - Adjust username length
   - Follow character requirements

5. **"Failed to upload avatar"**
   - Check internet connection
   - Verify file type (JPEG, PNG, WebP, GIF)
   - Try again

## Accessibility

### Keyboard Navigation
- Tab through all form fields
- Enter to submit form
- Escape to close dialogs
- Arrow keys in dropdowns

### Screen Readers
- Proper ARIA labels on all fields
- Error announcements
- Loading state announcements
- Form validation feedback

### Visual
- High contrast text
- Clear error messages
- Loading indicators
- Focus indicators

## Performance

### Optimizations
- Debounced username checking (500ms)
- Client-side image processing
- Optimistic UI updates
- Lazy loading of timezones
- Memoized callbacks
- Efficient re-renders

### Loading Times
- Initial load: <500ms
- Username check: <200ms
- Image upload: 1-3s (depends on size)
- Profile save: <500ms

## Browser Support

### Minimum Requirements
- Modern browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- JavaScript enabled
- Canvas API support
- File API support
- Drag and Drop API support

### Mobile Support
- Responsive design
- Touch-friendly controls
- Mobile file picker
- Optimized for small screens

## Code Examples

### Accessing Profile in Components
```typescript
import { useSession } from 'next-auth/react';

function MyComponent() {
  const { data: session } = useSession();

  const userProfile = {
    name: session?.user?.name,
    avatar: session?.user?.image,
    email: session?.user?.email
  };

  return <div>Welcome, {userProfile.name}!</div>;
}
```

### Updating Profile Programmatically
```typescript
const updateProfile = async (data) => {
  const response = await fetch('/api/users/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error('Failed to update profile');
  }

  return response.json();
};
```

### Checking Username Availability
```typescript
const checkUsername = async (username) => {
  const response = await fetch('/api/users/username/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  });

  const data = await response.json();
  return data.available;
};
```

## Troubleshooting

### Profile Not Saving
1. Check browser console for errors
2. Verify authentication (logged in)
3. Check network tab for failed requests
4. Ensure all required fields are filled
5. Check field validation errors

### Avatar Not Uploading
1. Verify file size (<10MB)
2. Check file type (JPEG, PNG, WebP, GIF)
3. Clear browser cache
4. Try different image
5. Check internet connection

### Username Availability Not Checking
1. Wait for debounce (500ms)
2. Check minimum length (3 chars)
3. Verify authentication
4. Check browser console for errors
5. Refresh page and try again

## Support

For issues or questions:
1. Check this documentation
2. Review implementation summary
3. Check browser console for errors
4. Contact development team

## Related Files

### Components
- `/components/profile/image-crop-dialog.tsx` - Image cropping
- `/components/ui/form.tsx` - Form components
- `/components/ui/input.tsx` - Input component
- `/components/ui/textarea.tsx` - Textarea component

### Pages
- `/app/(workspace)/[workspaceSlug]/settings/profile/page.tsx` - Main entry
- `/app/(workspace)/[workspaceSlug]/settings/profile/enhanced-profile-page.tsx` - Implementation

### API
- `/app/api/users/me/route.ts` - User profile CRUD
- `/app/api/users/[id]/avatar/route.ts` - Avatar upload
- `/app/api/users/username/check/route.ts` - Username availability

### Validation
- `/lib/validations/profile.ts` - Profile schemas
- `/lib/validations/user.ts` - User schemas

---

**Last Updated:** December 5, 2024
**Version:** 1.0.0
**Status:** Production Ready

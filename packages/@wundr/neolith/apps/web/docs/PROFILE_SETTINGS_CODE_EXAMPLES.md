# Profile Settings - Code Examples

## Using the Image Crop Dialog

### Basic Usage

```tsx
import { ImageCropDialog } from '@/components/profile/image-crop-dialog';
import { useState } from 'react';

function MyComponent() {
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const handleFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageUrl(reader.result as string);
      setShowCropDialog(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (blob: Blob) => {
    // Upload the cropped image
    const formData = new FormData();
    formData.append('file', blob, 'avatar.jpg');

    const response = await fetch('/api/users/me/avatar', {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      console.log('Avatar uploaded successfully!');
    }
  };

  return (
    <>
      <input
        type='file'
        accept='image/*'
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
        }}
      />

      {imageUrl && (
        <ImageCropDialog
          open={showCropDialog}
          onOpenChange={setShowCropDialog}
          imageUrl={imageUrl}
          onCropComplete={handleCropComplete}
          aspectRatio={1} // Circular crop
        />
      )}
    </>
  );
}
```

### Custom Aspect Ratio

```tsx
// For rectangular crops (e.g., banner images)
<ImageCropDialog
  open={showCropDialog}
  onOpenChange={setShowCropDialog}
  imageUrl={imageUrl}
  onCropComplete={handleCropComplete}
  aspectRatio={16 / 9} // Widescreen banner
/>
```

## Using Profile Validation Schemas

### Validate Profile Data

```tsx
import { enhancedProfileSchema } from '@/lib/validations/profile';

const profileData = {
  name: 'John Doe',
  username: 'johndoe',
  bio: 'Software engineer and designer',
  location: 'San Francisco, CA',
  timezone: 'America/Los_Angeles',
  title: 'Senior Engineer',
  pronouns: 'he/him',
  socialLinks: {
    github: 'https://github.com/johndoe',
    linkedin: 'https://linkedin.com/in/johndoe',
  },
  visibility: {
    profileVisibility: 'public',
    showEmail: false,
    showLocation: true,
    showBio: true,
    showSocialLinks: true,
  },
};

// Validate
const result = enhancedProfileSchema.safeParse(profileData);

if (result.success) {
  console.log('Valid profile data:', result.data);
} else {
  console.log('Validation errors:', result.error.flatten());
}
```

### Validate Username Only

```tsx
import { usernameSchema } from '@/lib/validations/profile';

const username = 'john-doe_123';

try {
  const validUsername = usernameSchema.parse(username);
  console.log('Valid username:', validUsername); // "john-doe_123"
} catch (error) {
  console.log('Invalid username:', error);
}
```

## Using React Hook Form with Profile Schema

### Complete Form Example

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { enhancedProfileSchema } from '@/lib/validations/profile';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

function ProfileForm() {
  const form = useForm({
    resolver: zodResolver(enhancedProfileSchema),
    defaultValues: {
      name: '',
      username: '',
      bio: '',
      location: '',
      timezone: 'America/New_York',
    },
  });

  const onSubmit = async data => {
    console.log('Form data:', data);
    // Submit to API
    const response = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      console.log('Profile updated!');
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
        <FormField
          control={form.control}
          name='name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display Name</FormLabel>
              <FormControl>
                <Input placeholder='John Doe' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='username'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder='johndoe' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type='submit'>Save Changes</Button>
      </form>
    </Form>
  );
}
```

## Username Availability Checking

### Debounced Username Check

```tsx
import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

function UsernameInput() {
  const [username, setUsername] = useState('');
  const [availability, setAvailability] = useState({
    checking: false,
    available: null as boolean | null,
    message: '',
  });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const checkAvailability = async (value: string) => {
    if (value.length < 3) {
      setAvailability({ checking: false, available: null, message: '' });
      return;
    }

    setAvailability({ checking: true, available: null, message: '' });

    try {
      const response = await fetch('/api/users/username/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: value }),
      });

      const data = await response.json();
      setAvailability({
        checking: false,
        available: data.available,
        message: data.message,
      });
    } catch (error) {
      setAvailability({
        checking: false,
        available: null,
        message: 'Failed to check availability',
      });
    }
  };

  const handleChange = (value: string) => {
    setUsername(value);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      checkAvailability(value);
    }, 500); // 500ms debounce
  };

  return (
    <div className='relative'>
      <input
        type='text'
        value={username}
        onChange={e => handleChange(e.target.value)}
        placeholder='username'
        className='w-full px-4 py-2 border rounded-md'
      />

      <div className='absolute right-3 top-2.5 flex items-center gap-2'>
        {availability.checking && (
          <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
        )}
        {!availability.checking && availability.available === true && (
          <CheckCircle2 className='h-4 w-4 text-green-500' />
        )}
        {!availability.checking && availability.available === false && (
          <XCircle className='h-4 w-4 text-red-500' />
        )}
      </div>

      {availability.message && (
        <p className='mt-1 text-sm text-muted-foreground'>{availability.message}</p>
      )}
    </div>
  );
}
```

## Profile Data Fetching

### Fetch and Display Profile

```tsx
import { useEffect, useState } from 'react';

interface UserProfile {
  name: string;
  email: string;
  bio: string;
  avatarUrl: string;
  preferences: {
    location?: string;
    timezone?: string;
    title?: string;
    socialLinks?: {
      github?: string;
      linkedin?: string;
    };
  };
}

function UserProfileDisplay() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/users/me');
        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }

        const { data } = await response.json();
        setProfile(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!profile) return <div>No profile found</div>;

  return (
    <div className='space-y-4'>
      <img src={profile.avatarUrl} alt={profile.name} className='w-24 h-24 rounded-full' />
      <h1 className='text-2xl font-bold'>{profile.name}</h1>
      <p className='text-muted-foreground'>{profile.bio}</p>

      {profile.preferences.title && <p className='font-medium'>{profile.preferences.title}</p>}

      {profile.preferences.location && <p className='text-sm'>📍 {profile.preferences.location}</p>}

      {profile.preferences.socialLinks?.github && (
        <a
          href={profile.preferences.socialLinks.github}
          target='_blank'
          rel='noopener noreferrer'
          className='text-blue-500 hover:underline'
        >
          GitHub Profile
        </a>
      )}
    </div>
  );
}
```

## Updating Profile with Optimistic UI

```tsx
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';

function OptimisticProfileUpdate() {
  const { data: session, update: updateSession } = useSession();
  const { toast } = useToast();
  const [name, setName] = useState(session?.user?.name || '');
  const [isSaving, setIsSaving] = useState(false);

  const updateProfile = async () => {
    // Optimistic update
    const previousName = session?.user?.name;
    setName(name);

    setIsSaving(true);

    try {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      await updateSession(); // Refresh session

      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });
    } catch (error) {
      // Rollback on error
      setName(previousName || '');

      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <input type='text' value={name} onChange={e => setName(e.target.value)} disabled={isSaving} />
      <button onClick={updateProfile} disabled={isSaving}>
        {isSaving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
}
```

## Drag and Drop Avatar Upload

```tsx
import { useState, useRef, useCallback } from 'react';
import { Upload } from 'lucide-react';

function DragDropAvatarUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-8 transition-colors ${
        isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
      }`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {preview ? (
        <img src={preview} alt='Preview' className='w-32 h-32 rounded-full mx-auto' />
      ) : (
        <div className='text-center'>
          <Upload className='w-12 h-12 mx-auto text-gray-400' />
          <p className='mt-2 text-sm text-gray-600'>Drag and drop an image, or click to browse</p>
        </div>
      )}
    </div>
  );
}
```

## Social Links Management

```tsx
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const socialLinksSchema = z.object({
  links: z.array(
    z.object({
      platform: z.string(),
      url: z.string().url().or(z.literal('')),
    })
  ),
});

function SocialLinksManager() {
  const form = useForm({
    resolver: zodResolver(socialLinksSchema),
    defaultValues: {
      links: [
        { platform: 'LinkedIn', url: '' },
        { platform: 'GitHub', url: '' },
        { platform: 'Twitter', url: '' },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'links',
  });

  const onSubmit = data => {
    console.log('Social links:', data);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
      {fields.map((field, index) => (
        <div key={field.id} className='flex gap-2'>
          <Input
            {...form.register(`links.${index}.platform`)}
            placeholder='Platform'
            className='w-1/3'
          />
          <Input
            {...form.register(`links.${index}.url`)}
            placeholder='https://...'
            className='flex-1'
          />
          <Button type='button' variant='destructive' onClick={() => remove(index)}>
            Remove
          </Button>
        </div>
      ))}

      <Button type='button' variant='outline' onClick={() => append({ platform: '', url: '' })}>
        Add Link
      </Button>

      <Button type='submit'>Save Links</Button>
    </form>
  );
}
```

## Privacy Settings Toggle

```tsx
import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

function PrivacySettings() {
  const [visibility, setVisibility] = useState<'public' | 'workspace' | 'private'>('public');
  const [showEmail, setShowEmail] = useState(false);
  const [showLocation, setShowLocation] = useState(true);
  const [showBio, setShowBio] = useState(true);
  const [showSocialLinks, setShowSocialLinks] = useState(true);

  const saveSettings = async () => {
    const settings = {
      visibility: {
        profileVisibility: visibility,
        showEmail,
        showLocation,
        showBio,
        showSocialLinks,
      },
    };

    const response = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferences: settings }),
    });

    if (response.ok) {
      console.log('Privacy settings saved!');
    }
  };

  return (
    <div className='space-y-6'>
      {/* Profile Visibility */}
      <div>
        <h3 className='text-lg font-medium mb-3'>Profile Visibility</h3>
        <RadioGroup value={visibility} onValueChange={v => setVisibility(v as any)}>
          <div className='flex items-center space-x-2'>
            <RadioGroupItem value='public' id='public' />
            <Label htmlFor='public'>Public - Anyone can see</Label>
          </div>
          <div className='flex items-center space-x-2'>
            <RadioGroupItem value='workspace' id='workspace' />
            <Label htmlFor='workspace'>Workspace Members Only</Label>
          </div>
          <div className='flex items-center space-x-2'>
            <RadioGroupItem value='private' id='private' />
            <Label htmlFor='private'>Private - Only you</Label>
          </div>
        </RadioGroup>
      </div>

      {/* Individual Toggles */}
      <div>
        <h3 className='text-lg font-medium mb-3'>Visible Information</h3>
        <div className='space-y-3'>
          <div className='flex items-center justify-between'>
            <Label htmlFor='show-email'>Show Email</Label>
            <Switch id='show-email' checked={showEmail} onCheckedChange={setShowEmail} />
          </div>

          <div className='flex items-center justify-between'>
            <Label htmlFor='show-location'>Show Location</Label>
            <Switch id='show-location' checked={showLocation} onCheckedChange={setShowLocation} />
          </div>

          <div className='flex items-center justify-between'>
            <Label htmlFor='show-bio'>Show Bio</Label>
            <Switch id='show-bio' checked={showBio} onCheckedChange={setShowBio} />
          </div>

          <div className='flex items-center justify-between'>
            <Label htmlFor='show-social'>Show Social Links</Label>
            <Switch
              id='show-social'
              checked={showSocialLinks}
              onCheckedChange={setShowSocialLinks}
            />
          </div>
        </div>
      </div>

      <button
        onClick={saveSettings}
        className='px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600'
      >
        Save Privacy Settings
      </button>
    </div>
  );
}
```

## Testing Examples

### Unit Test for Username Validation

```tsx
import { describe, it, expect } from 'vitest';
import { usernameSchema } from '@/lib/validations/profile';

describe('Username Validation', () => {
  it('should accept valid usernames', () => {
    expect(usernameSchema.parse('john')).toBe('john');
    expect(usernameSchema.parse('john-doe')).toBe('john-doe');
    expect(usernameSchema.parse('john_doe_123')).toBe('john_doe_123');
  });

  it('should convert to lowercase', () => {
    expect(usernameSchema.parse('JohnDoe')).toBe('johndoe');
  });

  it('should reject invalid usernames', () => {
    expect(() => usernameSchema.parse('ab')).toThrow(); // Too short
    expect(() => usernameSchema.parse('a'.repeat(31))).toThrow(); // Too long
    expect(() => usernameSchema.parse('john@doe')).toThrow(); // Invalid char
    expect(() => usernameSchema.parse('john doe')).toThrow(); // Space
  });
});
```

### Integration Test for Profile Update

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import EnhancedProfilePage from './enhanced-profile-page';

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: '123', name: 'John Doe', email: 'john@example.com' } },
    update: vi.fn(),
  }),
}));

describe('Enhanced Profile Page', () => {
  it('should update profile successfully', async () => {
    // Mock fetch
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      })
    ) as any;

    render(<EnhancedProfilePage />);

    // Fill in form
    const nameInput = screen.getByLabelText(/display name/i);
    fireEvent.change(nameInput, { target: { value: 'Jane Doe' } });

    // Submit form
    const submitButton = screen.getByText(/save changes/i);
    fireEvent.click(submitButton);

    // Wait for success
    await waitFor(() => {
      expect(screen.getByText(/profile updated successfully/i)).toBeInTheDocument();
    });
  });
});
```

---

These examples cover the most common use cases for the profile settings features. For more advanced
scenarios, refer to the implementation files directly.

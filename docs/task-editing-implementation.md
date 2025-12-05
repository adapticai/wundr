# Task Editing Functionality Implementation

This document outlines the changes needed to add task editing and deletion functionality to the
tasks page.

## File: `/packages/@wundr/neolith/apps/web/app/(workspace)/[workspaceSlug]/tasks/page.tsx`

### 1. Add Required Imports

Add these imports to the existing import section:

```typescript
import { Edit2, Trash2 } from 'lucide-react';
import { useEffect } from 'react'; // Add useEffect to existing react imports

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
```

### 2. Add Edit Task Schema

After the `createTaskFormSchema`, add:

```typescript
const editTaskFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title is too long'),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED']),
  dueDate: z.string().optional(),
  tags: z.string().optional(), // Comma-separated tags
  assignedToId: z.string().optional(),
});

type EditTaskFormValues = z.infer<typeof editTaskFormSchema>;
```

### 3. Add WorkspaceMember Interface

After the `Task` interface, add:

```typescript
interface WorkspaceMember {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    displayName: string | null;
  };
}
```

### 4. Add State Variables in TasksPage Component

In the `TasksPage` component, after the existing `useState` declarations, add:

```typescript
const [selectedTask, setSelectedTask] = useState<Task | null>(null);
const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
```

### 5. Add Handler Functions

After the existing handlers (`handleSearchChange`, `handleClearFilters`), add:

```typescript
const handleTaskClick = useCallback((task: Task) => {
  setSelectedTask(task);
  setIsEditDialogOpen(true);
}, []);

const handleDeleteClick = useCallback((task: Task) => {
  setSelectedTask(task);
  setIsDeleteDialogOpen(true);
}, []);

const handleCloseEditDialog = useCallback(() => {
  setIsEditDialogOpen(false);
  setTimeout(() => setSelectedTask(null), 200);
}, []);

const handleCloseDeleteDialog = useCallback(() => {
  setIsDeleteDialogOpen(false);
  setTimeout(() => setSelectedTask(null), 200);
}, []);
```

### 6. Update TaskCard Component

Replace the existing `TaskCard` component with:

```typescript
interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

function TaskCard({ task, onEdit, onDelete }: TaskCardProps) {
  const statusConfig = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG];
  const priorityConfig =
    PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG];

  return (
    <div className='group rounded-lg border bg-card p-4 transition-all hover:shadow-md'>
      <div className='flex items-start justify-between'>
        <div
          className='flex-1 cursor-pointer'
          onClick={() => onEdit(task)}
          role='button'
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              onEdit(task);
            }
          }}
        >
          <div className='flex items-start gap-2'>
            <span
              className='text-lg'
              title={`Priority: ${priorityConfig.label}`}
            >
              {priorityConfig.icon}
            </span>
            <div className='flex-1'>
              <h3 className='font-semibold text-foreground'>{task.title}</h3>
              {task.description && (
                <p className='mt-1 text-sm text-muted-foreground line-clamp-2'>
                  {task.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className='flex gap-1 opacity-0 transition-opacity group-hover:opacity-100'>
          <button
            type='button'
            onClick={e => {
              e.stopPropagation();
              onEdit(task);
            }}
            className='rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
            title='Edit task'
          >
            <Edit2 className='h-4 w-4' />
          </button>
          <button
            type='button'
            onClick={e => {
              e.stopPropagation();
              onDelete(task);
            }}
            className='rounded p-1 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20'
            title='Delete task'
          >
            <Trash2 className='h-4 w-4' />
          </button>
        </div>
      </div>

      {/* Rest of the TaskCard component stays the same */}
      {/* ... status badge, details, tags ... */}
    </div>
  );
}
```

### 7. Update TaskCard Usage

In the JSX where TaskCard is used, update it to:

```typescript
{tasks.map(task => (
  <TaskCard
    key={task.id}
    task={task}
    onEdit={handleTaskClick}
    onDelete={handleDeleteClick}
  />
))}
```

### 8. Add Edit Task Dialog Component

Add this component after the `CreateTaskDialog` component:

```typescript
// =============================================================================
// Edit Task Dialog Component
// =============================================================================

interface EditTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
  workspaceSlug: string;
  onSuccess: () => void;
}

function EditTaskDialog({
  open,
  onOpenChange,
  task,
  workspaceSlug,
  onSuccess,
}: EditTaskDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const form = useForm<EditTaskFormValues>({
    resolver: zodResolver(editTaskFormSchema),
    defaultValues: {
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate
        ? new Date(task.dueDate).toISOString().split('T')[0]
        : '',
      tags: task.tags.join(', '),
      assignedToId: task.assignedToId || '',
    },
  });

  // Fetch workspace members when dialog opens
  useEffect(() => {
    if (open && !members.length) {
      setMembersLoading(true);
      fetch(`/api/workspaces/${workspaceSlug}/members`)
        .then(res => res.json())
        .then(data => {
          if (data.data) {
            setMembers(data.data);
          }
        })
        .catch(err => console.error('Failed to fetch members:', err))
        .finally(() => setMembersLoading(false));
    }
  }, [open, members.length, workspaceSlug]);

  const onSubmit = async (values: EditTaskFormValues) => {
    setIsSubmitting(true);

    try {
      // Parse tags from comma-separated string
      const tagsArray = values.tags
        ? values.tags
            .split(',')
            .map(t => t.trim())
            .filter(Boolean)
        : [];

      // Prepare payload
      const payload = {
        title: values.title,
        description: values.description || null,
        priority: values.priority,
        status: values.status,
        dueDate: values.dueDate || null,
        tags: tagsArray,
        assignedToId: values.assignedToId || null,
      };

      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update task');
      }

      // Success - close dialog and refresh tasks
      onSuccess();
    } catch (error) {
      console.error('Failed to update task:', error);
      alert(
        error instanceof Error ? error.message : 'Failed to update task',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Update the task details below.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            {/* Title */}
            <FormField
              control={form.control}
              name='title'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='Enter task title...'
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name='description'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Enter task description...'
                      className='min-h-[100px]'
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='grid grid-cols-2 gap-4'>
              {/* Priority */}
              <FormField
                control={form.control}
                name='priority'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select priority' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(PRIORITY_CONFIG).map(
                          ([value, config]) => (
                            <SelectItem key={value} value={value}>
                              {config.label}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Status */}
              <FormField
                control={form.control}
                name='status'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select status' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(STATUS_CONFIG).map(
                          ([value, config]) => (
                            <SelectItem key={value} value={value}>
                              {config.label}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Assignee */}
            <FormField
              control={form.control}
              name='assignedToId'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assignee</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isSubmitting || membersLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            membersLoading
                              ? 'Loading members...'
                              : 'Select assignee'
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value=''>Unassigned</SelectItem>
                      {members.map(member => (
                        <SelectItem key={member.userId} value={member.userId}>
                          {member.user.displayName ||
                            member.user.name ||
                            member.user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Assign this task to a workspace member
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Due Date */}
            <FormField
              control={form.control}
              name='dueDate'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date</FormLabel>
                  <FormControl>
                    <Input type='date' {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tags */}
            <FormField
              control={form.control}
              name='tags'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='feature, backend, urgent (comma-separated)'
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    Enter tags separated by commas
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

### 9. Add Delete Task Dialog Component

Add this component after the `EditTaskDialog` component:

```typescript
// =============================================================================
// Delete Task Dialog Component
// =============================================================================

interface DeleteTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
  onSuccess: () => void;
}

function DeleteTaskDialog({
  open,
  onOpenChange,
  task,
  onSuccess,
}: DeleteTaskDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete task');
      }

      // Success
      onSuccess();
    } catch (error) {
      console.error('Failed to delete task:', error);
      alert(
        error instanceof Error ? error.message : 'Failed to delete task',
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Task</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{task.title}"? This action cannot
            be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className='bg-red-600 hover:bg-red-700'
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

### 10. Add Dialog Components to JSX

In the `return` statement of `TasksPage`, after the `CreateTaskDialog`, add:

```typescript
{/* Edit Task Dialog */}
{selectedTask && (
  <EditTaskDialog
    open={isEditDialogOpen}
    onOpenChange={handleCloseEditDialog}
    task={selectedTask}
    workspaceSlug={workspaceSlug}
    onSuccess={() => {
      refetch();
      handleCloseEditDialog();
    }}
  />
)}

{/* Delete Confirmation Dialog */}
{selectedTask && (
  <DeleteTaskDialog
    open={isDeleteDialogOpen}
    onOpenChange={handleCloseDeleteDialog}
    task={selectedTask}
    onSuccess={() => {
      refetch();
      handleCloseDeleteDialog();
    }}
  />
)}
```

## Summary

These changes will add:

1. **Click-to-edit functionality**: Clicking anywhere on a task card opens the edit dialog
2. **Edit button**: Hover over a task to see edit and delete icons
3. **Delete confirmation**: Safe deletion with a confirmation dialog
4. **Full edit capabilities**:
   - Title
   - Description
   - Status (TODO, IN_PROGRESS, BLOCKED, DONE, CANCELLED)
   - Priority (LOW, MEDIUM, HIGH, CRITICAL)
   - Due date
   - Assignee (workspace members dropdown)
   - Tags (comma-separated)

## API Endpoints Used

- `PATCH /api/tasks/[taskId]` - Update task
- `DELETE /api/tasks/[taskId]` - Delete task
- `GET /api/workspaces/[workspaceSlug]/members` - Fetch workspace members for assignee dropdown

All endpoints already exist and are fully functional.

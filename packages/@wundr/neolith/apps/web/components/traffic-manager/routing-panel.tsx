'use client';

import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

const PRIORITY_LEVELS = [
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT',
  'CRITICAL',
] as const;
type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

const routingRuleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  priority: z.coerce.number().min(1).max(100),
  enabled: z.boolean(),
  channelPattern: z.string().optional(),
  senderPattern: z.string().optional(),
  contentKeywords: z.string().optional(),
  minPriority: z.enum(PRIORITY_LEVELS),
  targetAgent: z.string().min(1, 'Target agent is required'),
  fallbackAgent: z.string().optional(),
});

type RoutingRuleFormValues = z.infer<typeof routingRuleSchema>;

interface RoutingRule extends RoutingRuleFormValues {
  id: string;
}

interface Agent {
  id: string;
  name: string;
  discipline: string;
}

interface RoutingPanelProps {
  workspaceId: string;
  agents: Agent[];
}

const defaultFormValues: RoutingRuleFormValues = {
  name: '',
  priority: 50,
  enabled: true,
  channelPattern: '',
  senderPattern: '',
  contentKeywords: '',
  minPriority: 'NORMAL',
  targetAgent: '',
  fallbackAgent: '',
};

function RoutingRuleForm({
  agents,
  initialValues,
  onSave,
  onCancel,
}: {
  agents: Agent[];
  initialValues?: RoutingRule;
  onSave: (values: RoutingRuleFormValues) => void;
  onCancel: () => void;
}) {
  const form = useForm<RoutingRuleFormValues>({
    resolver: zodResolver(routingRuleSchema),
    defaultValues: initialValues ?? defaultFormValues,
  });

  const [keywordInput, setKeywordInput] = useState('');
  const keywords = (form.watch('contentKeywords') ?? '')
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);

  const addKeyword = useCallback(() => {
    const trimmed = keywordInput.trim();
    if (!trimmed || keywords.includes(trimmed)) return;
    form.setValue('contentKeywords', [...keywords, trimmed].join(', '));
    setKeywordInput('');
  }, [keywordInput, keywords, form]);

  const removeKeyword = useCallback(
    (kw: string) => {
      form.setValue(
        'contentKeywords',
        keywords.filter(k => k !== kw).join(', ')
      );
    },
    [keywords, form]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {initialValues ? 'Edit Rule' : 'New Routing Rule'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className='space-y-5'>
            <div className='grid grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rule Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='e.g., Urgent to Lead Agent'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='priority'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority (1–100)</FormLabel>
                    <FormControl>
                      <Input type='number' min={1} max={100} {...field} />
                    </FormControl>
                    <FormDescription>Lower numbers run first.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name='enabled'
              render={({ field }) => (
                <FormItem className='flex items-center gap-3'>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className='!mt-0'>Enabled</FormLabel>
                </FormItem>
              )}
            />

            <div className='grid grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='channelPattern'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Channel Pattern</FormLabel>
                    <FormControl>
                      <Input placeholder='e.g., #alerts-*' {...field} />
                    </FormControl>
                    <FormDescription>Glob pattern, optional.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='senderPattern'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sender Pattern</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='e.g., bot-* or user@example.com'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Glob pattern, optional.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name='contentKeywords'
              render={() => (
                <FormItem>
                  <FormLabel>Content Keywords</FormLabel>
                  <div className='space-y-2'>
                    <div className='flex gap-2'>
                      <Input
                        placeholder='Add keyword and press Enter'
                        value={keywordInput}
                        onChange={e => setKeywordInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addKeyword();
                          }
                        }}
                      />
                      <Button
                        type='button'
                        variant='outline'
                        onClick={addKeyword}
                      >
                        Add
                      </Button>
                    </div>
                    {keywords.length > 0 && (
                      <div className='flex flex-wrap gap-2'>
                        {keywords.map(kw => (
                          <Badge key={kw} variant='secondary' className='gap-1'>
                            {kw}
                            <button
                              type='button'
                              onClick={() => removeKeyword(kw)}
                              className='ml-1 rounded-full hover:bg-muted-foreground/20'
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <FormDescription>
                    Message must contain at least one keyword to match.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='grid grid-cols-3 gap-4'>
              <FormField
                control={form.control}
                name='minPriority'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min Priority</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select priority' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRIORITY_LEVELS.map(level => (
                          <SelectItem key={level} value={level}>
                            {level}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='targetAgent'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Agent</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select agent' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {agents.map(agent => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.name}
                            <span className='ml-1 text-xs text-muted-foreground'>
                              ({agent.discipline})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='fallbackAgent'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fallback Agent</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value ?? ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='None' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value=''>None</SelectItem>
                        {agents.map(agent => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Optional.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className='flex justify-end gap-2 pt-2'>
              <Button type='button' variant='outline' onClick={onCancel}>
                Cancel
              </Button>
              <Button type='submit'>Save Rule</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function RoutingRuleList({
  rules,
  agents,
  onEdit,
  onDelete,
}: {
  rules: RoutingRule[];
  agents: Agent[];
  onEdit: (rule: RoutingRule) => void;
  onDelete: (id: string) => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const agentName = (id: string) => agents.find(a => a.id === id)?.name ?? id;

  const sorted = [...rules].sort((a, b) => a.priority - b.priority);

  if (sorted.length === 0) {
    return (
      <p className='py-8 text-center text-sm text-muted-foreground'>
        No routing rules yet. Add one to get started.
      </p>
    );
  }

  return (
    <div className='space-y-3'>
      {sorted.map(rule => (
        <Card key={rule.id}>
          <CardContent className='flex items-center justify-between py-4'>
            <div className='flex items-center gap-3'>
              <Badge variant='outline' className='tabular-nums'>
                #{rule.priority}
              </Badge>
              <div>
                <p className='font-medium'>{rule.name}</p>
                <p className='text-xs text-muted-foreground'>
                  Target: {agentName(rule.targetAgent)}
                  {rule.fallbackAgent &&
                    ` · Fallback: ${agentName(rule.fallbackAgent)}`}
                </p>
              </div>
            </div>
            <div className='flex items-center gap-2'>
              <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                {rule.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
              <Button size='sm' variant='outline' onClick={() => onEdit(rule)}>
                Edit
              </Button>
              {pendingDelete === rule.id ? (
                <>
                  <Button
                    size='sm'
                    variant='destructive'
                    onClick={() => {
                      onDelete(rule.id);
                      setPendingDelete(null);
                    }}
                  >
                    Confirm
                  </Button>
                  <Button
                    size='sm'
                    variant='ghost'
                    onClick={() => setPendingDelete(null)}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  size='sm'
                  variant='ghost'
                  onClick={() => setPendingDelete(rule.id)}
                >
                  Delete
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function RoutingPanel({
  workspaceId: _workspaceId,
  agents,
}: RoutingPanelProps) {
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [editingRule, setEditingRule] = useState<RoutingRule | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleSave = useCallback(
    (values: RoutingRuleFormValues) => {
      if (editingRule) {
        setRules(prev =>
          prev.map(r =>
            r.id === editingRule.id ? { ...values, id: editingRule.id } : r
          )
        );
        setEditingRule(null);
      } else {
        setRules(prev => [...prev, { ...values, id: crypto.randomUUID() }]);
        setIsAdding(false);
      }
    },
    [editingRule]
  );

  const handleDelete = useCallback((id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
  }, []);

  const handleTest = useCallback(() => {
    if (!testMessage.trim()) {
      setTestResult('Enter a sample message to test.');
      return;
    }
    const lower = testMessage.toLowerCase();
    const sorted = [...rules]
      .filter(r => r.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of sorted) {
      const keywords = (rule.contentKeywords ?? '')
        .split(',')
        .map(k => k.trim())
        .filter(Boolean);
      const matches =
        keywords.length === 0 ||
        keywords.some(kw => lower.includes(kw.toLowerCase()));
      if (matches) {
        const agent = agents.find(a => a.id === rule.targetAgent);
        setTestResult(
          `Matched rule "${rule.name}" — routed to: ${agent?.name ?? rule.targetAgent}`
        );
        return;
      }
    }
    setTestResult('No rule matched. Message would use default routing.');
  }, [testMessage, rules, agents]);

  const showForm = isAdding || editingRule !== null;

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h2 className='text-xl font-semibold'>Routing Rules</h2>
        {!showForm && (
          <Button onClick={() => setIsAdding(true)}>Add Rule</Button>
        )}
      </div>

      {showForm ? (
        <RoutingRuleForm
          agents={agents}
          initialValues={editingRule ?? undefined}
          onSave={handleSave}
          onCancel={() => {
            setIsAdding(false);
            setEditingRule(null);
          }}
        />
      ) : (
        <RoutingRuleList
          rules={rules}
          agents={agents}
          onEdit={rule => setEditingRule(rule)}
          onDelete={handleDelete}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Test Routing</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <Textarea
            placeholder='Enter a sample message to see which agent would be selected...'
            rows={3}
            value={testMessage}
            onChange={e => {
              setTestMessage(e.target.value);
              setTestResult(null);
            }}
          />
          <div className='flex items-center gap-3'>
            <Button variant='outline' onClick={handleTest}>
              Test Route
            </Button>
            {testResult && (
              <p className='text-sm text-muted-foreground'>{testResult}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

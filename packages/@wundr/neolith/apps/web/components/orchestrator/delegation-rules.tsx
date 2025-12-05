/**
 * Delegation Rules Component
 *
 * Allows configuration of automated delegation rules based on
 * conditions like task priority, type, or workload.
 *
 * @module components/orchestrator/delegation-rules
 */
'use client';

import { Plus, Trash2, Save, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

interface DelegationRule {
  id: string;
  name: string;
  enabled: boolean;
  condition: {
    type: 'priority' | 'taskType' | 'workload' | 'time';
    operator: 'equals' | 'greaterThan' | 'lessThan';
    value: string;
  };
  action: {
    delegateTo: string;
    autoApprove: boolean;
  };
}

interface DelegationRulesProps {
  orchestratorId: string;
}

export function DelegationRules({ orchestratorId }: DelegationRulesProps) {
  const { toast } = useToast();
  const [rules, setRules] = useState<DelegationRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadRules();
  }, [orchestratorId]);

  const loadRules = async () => {
    setIsLoading(true);
    try {
      // In a real implementation, this would fetch from an API
      // For now, we'll use localStorage as a mock
      const savedRules = localStorage.getItem(
        `delegation_rules_${orchestratorId}`,
      );
      if (savedRules) {
        setRules(JSON.parse(savedRules));
      }
    } catch (error) {
      console.error('Failed to load delegation rules:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveRules = async () => {
    setIsSaving(true);
    try {
      // In a real implementation, this would save to an API
      // For now, we'll use localStorage as a mock
      localStorage.setItem(
        `delegation_rules_${orchestratorId}`,
        JSON.stringify(rules),
      );

      toast({
        title: 'Rules Saved',
        description: 'Delegation rules have been updated successfully',
      });
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save delegation rules:', error);
      toast({
        title: 'Save Failed',
        description: 'Failed to save delegation rules',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const addRule = () => {
    const newRule: DelegationRule = {
      id: `rule_${Date.now()}`,
      name: `Rule ${rules.length + 1}`,
      enabled: true,
      condition: {
        type: 'priority',
        operator: 'equals',
        value: 'HIGH',
      },
      action: {
        delegateTo: '',
        autoApprove: false,
      },
    };
    setRules([...rules, newRule]);
    setHasChanges(true);
  };

  const updateRule = (id: string, updates: Partial<DelegationRule>) => {
    setRules(
      rules.map(rule => (rule.id === id ? { ...rule, ...updates } : rule)),
    );
    setHasChanges(true);
  };

  const deleteRule = (id: string) => {
    setRules(rules.filter(rule => rule.id !== id));
    setHasChanges(true);
  };

  const toggleRule = (id: string) => {
    setRules(
      rules.map(rule =>
        rule.id === id ? { ...rule, enabled: !rule.enabled } : rule,
      ),
    );
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Delegation Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground'>Loading rules...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle>Delegation Rules</CardTitle>
            <p className='text-sm text-muted-foreground mt-1'>
              Configure automated delegation based on task conditions
            </p>
          </div>
          <div className='flex gap-2'>
            <Button variant='outline' size='sm' onClick={addRule}>
              <Plus className='h-4 w-4 mr-2' />
              Add Rule
            </Button>
            {hasChanges && (
              <Button size='sm' onClick={saveRules} disabled={isSaving}>
                <Save className='h-4 w-4 mr-2' />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {rules.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-12 text-center'>
            <AlertCircle className='h-12 w-12 text-muted-foreground/50 mb-4' />
            <p className='text-sm font-medium text-muted-foreground'>
              No delegation rules configured
            </p>
            <p className='text-xs text-muted-foreground mt-1'>
              Add rules to automate task delegation
            </p>
            <Button variant='outline' size='sm' onClick={addRule} className='mt-4'>
              <Plus className='h-4 w-4 mr-2' />
              Create First Rule
            </Button>
          </div>
        ) : (
          <div className='space-y-4'>
            {rules.map((rule, index) => (
              <div key={rule.id}>
                <div className='p-4 rounded-lg border bg-card space-y-4'>
                  {/* Rule Header */}
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-3'>
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={() => toggleRule(rule.id)}
                      />
                      <Input
                        value={rule.name}
                        onChange={e =>
                          updateRule(rule.id, { name: e.target.value })
                        }
                        className='max-w-[200px]'
                      />
                      {rule.enabled ? (
                        <Badge variant='default'>Active</Badge>
                      ) : (
                        <Badge variant='outline'>Disabled</Badge>
                      )}
                    </div>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => deleteRule(rule.id)}
                    >
                      <Trash2 className='h-4 w-4 text-destructive' />
                    </Button>
                  </div>

                  {/* Rule Configuration */}
                  <div className='grid grid-cols-2 gap-4'>
                    {/* Condition */}
                    <div className='space-y-3'>
                      <Label className='text-xs font-semibold'>
                        WHEN (Condition)
                      </Label>
                      <div className='space-y-2'>
                        <Select
                          value={rule.condition.type}
                          onValueChange={value =>
                            updateRule(rule.id, {
                              condition: { ...rule.condition, type: value as any },
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='priority'>Priority</SelectItem>
                            <SelectItem value='taskType'>Task Type</SelectItem>
                            <SelectItem value='workload'>Workload</SelectItem>
                            <SelectItem value='time'>Time of Day</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select
                          value={rule.condition.operator}
                          onValueChange={value =>
                            updateRule(rule.id, {
                              condition: {
                                ...rule.condition,
                                operator: value as any,
                              },
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='equals'>Equals</SelectItem>
                            <SelectItem value='greaterThan'>
                              Greater Than
                            </SelectItem>
                            <SelectItem value='lessThan'>Less Than</SelectItem>
                          </SelectContent>
                        </Select>

                        {rule.condition.type === 'priority' ? (
                          <Select
                            value={rule.condition.value}
                            onValueChange={value =>
                              updateRule(rule.id, {
                                condition: { ...rule.condition, value },
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value='LOW'>Low</SelectItem>
                              <SelectItem value='MEDIUM'>Medium</SelectItem>
                              <SelectItem value='HIGH'>High</SelectItem>
                              <SelectItem value='CRITICAL'>Critical</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={rule.condition.value}
                            onChange={e =>
                              updateRule(rule.id, {
                                condition: {
                                  ...rule.condition,
                                  value: e.target.value,
                                },
                              })
                            }
                            placeholder='Value...'
                          />
                        )}
                      </div>
                    </div>

                    {/* Action */}
                    <div className='space-y-3'>
                      <Label className='text-xs font-semibold'>
                        THEN (Action)
                      </Label>
                      <div className='space-y-2'>
                        <Input
                          value={rule.action.delegateTo}
                          onChange={e =>
                            updateRule(rule.id, {
                              action: {
                                ...rule.action,
                                delegateTo: e.target.value,
                              },
                            })
                          }
                          placeholder='Orchestrator ID...'
                        />
                        <div className='flex items-center gap-2'>
                          <Switch
                            checked={rule.action.autoApprove}
                            onCheckedChange={checked =>
                              updateRule(rule.id, {
                                action: { ...rule.action, autoApprove: checked },
                              })
                            }
                          />
                          <Label className='text-sm'>Auto-approve delegation</Label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {index < rules.length - 1 && <Separator className='my-4' />}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

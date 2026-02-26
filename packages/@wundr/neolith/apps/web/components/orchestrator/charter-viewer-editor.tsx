'use client';

import { useState, useEffect, type KeyboardEvent } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CharterData {
  identity: { name: string; role: string; discipline: string; mission: string };
  capabilities: { capabilities: string[]; skills: string[]; tools: string[] };
  guidelines: { communicationStyle: string; decisionMakingApproach: string; collaborationPreferences: string };
  boundaries: {
    budgetLimits: { daily: number; monthly: number; perTask: number };
    allowedActions: string[];
    escalationTriggers: string[];
    restrictedOperations: string[];
  };
}

interface CharterVersion {
  id: string;
  version: number;
  changeLog: string;
  createdAt: string;
  creator?: { name?: string | null; displayName?: string | null };
}

export interface CharterViewerEditorProps {
  orchestratorId: string;
  readOnly?: boolean;
  className?: string;
  onSaved?: () => void;
}

const DEFAULT_CHARTER: CharterData = {
  identity: { name: '', role: '', discipline: '', mission: '' },
  capabilities: { capabilities: [], skills: [], tools: [] },
  guidelines: { communicationStyle: 'balanced', decisionMakingApproach: '', collaborationPreferences: '' },
  boundaries: {
    budgetLimits: { daily: 0, monthly: 0, perTask: 0 },
    allowedActions: [],
    escalationTriggers: [],
    restrictedOperations: [],
  },
};

const ALLOWED_ACTIONS = ['read_data', 'write_data', 'send_messages', 'create_tasks', 'manage_members'];

// ─── Tag Input ────────────────────────────────────────────────────────────────

function TagInput({ tags, onChange, placeholder, readOnly }: {
  tags: string[]; onChange: (t: string[]) => void; placeholder?: string; readOnly?: boolean;
}) {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (!v || tags.includes(v)) { setInput(''); return; }
    onChange([...tags, v]); setInput('');
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); add(); } };
  return (
    <div className="space-y-2">
      {!readOnly && (
        <div className="flex gap-2">
          <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown} placeholder={placeholder} />
          <Button type="button" variant="outline" size="sm" onClick={add}>Add</Button>
        </div>
      )}
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tags.map(t => (
            <Badge key={t} variant="secondary" className="gap-1">
              {t}
              {!readOnly && (
                <button type="button" onClick={() => onChange(tags.filter(x => x !== t))}
                  className="ml-1 rounded-full hover:bg-muted-foreground/20" aria-label={`Remove ${t}`}>&times;</button>
              )}
            </Badge>
          ))}
        </div>
      ) : readOnly && <p className="text-sm text-muted-foreground">None specified</p>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CharterViewerEditor({ orchestratorId, readOnly = false, className, onSaved }: CharterViewerEditorProps) {
  const { toast } = useToast();
  const [charter, setCharter] = useState<CharterData>(DEFAULT_CHARTER);
  const [charterId, setCharterId] = useState('');
  const [versions, setVersions] = useState<CharterVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changeLog, setChangeLog] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/orchestrators/${orchestratorId}/charter`);
        if (res.ok) {
          const { data } = await res.json();
          setCharterId(data.charterId ?? '');
          const p = typeof data.charterData === 'string' ? JSON.parse(data.charterData) : data.charterData;
          setCharter({
            identity: { ...DEFAULT_CHARTER.identity, ...p?.identity },
            capabilities: { ...DEFAULT_CHARTER.capabilities, ...p?.capabilities },
            guidelines: { ...DEFAULT_CHARTER.guidelines, ...p?.guidelines },
            boundaries: {
              ...DEFAULT_CHARTER.boundaries, ...p?.boundaries,
              budgetLimits: { ...DEFAULT_CHARTER.boundaries.budgetLimits, ...p?.boundaries?.budgetLimits },
            },
          });
        }
      } catch { toast({ title: 'Failed to load charter', variant: 'destructive' }); }
      finally { setLoading(false); }
    }
    void load();
  }, [orchestratorId, toast]);

  useEffect(() => {
    fetch(`/api/orchestrators/${orchestratorId}/charter/versions`)
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.data) setVersions(j.data); })
      .catch(() => undefined);
  }, [orchestratorId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/orchestrators/${orchestratorId}/charter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          charterId: charterId || `${orchestratorId}-charter`,
          charterData: charter,
          changeLog: changeLog.trim() || 'Charter updated',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? 'Save failed');
      }
      toast({ title: 'Charter saved successfully' });
      setChangeLog('');
      onSaved?.();
    } catch (err) {
      toast({ title: 'Failed to save charter', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const patch = <K extends keyof CharterData>(section: K, update: Partial<CharterData[K]>) =>
    setCharter(c => ({ ...c, [section]: { ...c[section], ...update } }));

  const patchBudget = (update: Partial<CharterData['boundaries']['budgetLimits']>) =>
    setCharter(c => ({ ...c, boundaries: { ...c.boundaries, budgetLimits: { ...c.boundaries.budgetLimits, ...update } } }));

  const toggleAction = (action: string) => {
    const cur = charter.boundaries.allowedActions;
    patch('boundaries', { allowedActions: cur.includes(action) ? cur.filter(a => a !== action) : [...cur, action] });
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">Loading charter...</CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader><CardTitle>Charter</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="identity">
          <TabsList className="flex-wrap">
            {['identity', 'capabilities', 'guidelines', 'boundaries', 'history'].map(t => (
              <TabsTrigger key={t} value={t} className="capitalize">{t}</TabsTrigger>
            ))}
          </TabsList>

          {/* Identity */}
          <TabsContent value="identity" className="space-y-4 pt-4">
            {(['name', 'role', 'discipline'] as const).map(f => (
              <div key={f} className="space-y-1">
                <Label htmlFor={`id-${f}`} className="capitalize">{f}</Label>
                <Input id={`id-${f}`} value={charter.identity[f]} readOnly={readOnly}
                  onChange={e => patch('identity', { [f]: e.target.value })} />
              </div>
            ))}
            <div className="space-y-1">
              <Label htmlFor="id-mission">Mission</Label>
              <Textarea id="id-mission" rows={4} value={charter.identity.mission} readOnly={readOnly}
                onChange={e => patch('identity', { mission: e.target.value })} />
            </div>
          </TabsContent>

          {/* Capabilities */}
          <TabsContent value="capabilities" className="space-y-4 pt-4">
            {([
              ['capabilities', 'e.g., API Design, System Architecture'],
              ['skills', 'e.g., Node.js, PostgreSQL'],
              ['tools', 'e.g., Docker, Kubernetes'],
            ] as const).map(([field, ph]) => (
              <div key={field} className="space-y-1">
                <Label className="capitalize">{field}</Label>
                <TagInput tags={charter.capabilities[field]} readOnly={readOnly} placeholder={ph}
                  onChange={tags => patch('capabilities', { [field]: tags })} />
              </div>
            ))}
          </TabsContent>

          {/* Guidelines */}
          <TabsContent value="guidelines" className="space-y-4 pt-4">
            <div className="space-y-1">
              <Label htmlFor="comm-style">Communication Style</Label>
              {readOnly
                ? <p className="text-sm capitalize">{charter.guidelines.communicationStyle || '—'}</p>
                : (
                  <Select value={charter.guidelines.communicationStyle} onValueChange={v => patch('guidelines', { communicationStyle: v })}>
                    <SelectTrigger id="comm-style"><SelectValue placeholder="Select style" /></SelectTrigger>
                    <SelectContent>
                      {['formal', 'balanced', 'casual'].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="decision">Decision-Making Approach</Label>
              <Textarea id="decision" rows={3} value={charter.guidelines.decisionMakingApproach} readOnly={readOnly}
                placeholder={readOnly ? undefined : 'Describe how decisions are made...'}
                onChange={e => patch('guidelines', { decisionMakingApproach: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="collab">Collaboration Preferences</Label>
              <Textarea id="collab" rows={3} value={charter.guidelines.collaborationPreferences} readOnly={readOnly}
                placeholder={readOnly ? undefined : 'Describe collaboration approach...'}
                onChange={e => patch('guidelines', { collaborationPreferences: e.target.value })} />
            </div>
          </TabsContent>

          {/* Boundaries */}
          <TabsContent value="boundaries" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Budget Limits</Label>
              <div className="grid grid-cols-3 gap-3">
                {([['daily', 'Daily ($)'], ['monthly', 'Monthly ($)'], ['perTask', 'Per Task ($)']] as const).map(([k, label]) => (
                  <div key={k} className="space-y-1">
                    <Label htmlFor={`budget-${k}`} className="text-xs text-muted-foreground">{label}</Label>
                    <Input id={`budget-${k}`} type="number" min={0} value={charter.boundaries.budgetLimits[k]} readOnly={readOnly}
                      onChange={e => patchBudget({ [k]: parseFloat(e.target.value) || 0 })} />
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Allowed Actions</Label>
              <div className="space-y-2">
                {ALLOWED_ACTIONS.map(action => (
                  <div key={action} className="flex items-center gap-2">
                    <Checkbox id={`act-${action}`} checked={charter.boundaries.allowedActions.includes(action)}
                      disabled={readOnly} onCheckedChange={() => toggleAction(action)} />
                    <Label htmlFor={`act-${action}`} className="text-sm font-normal">{action.replace(/_/g, ' ')}</Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Escalation Triggers</Label>
              <TagInput tags={charter.boundaries.escalationTriggers} readOnly={readOnly}
                placeholder="e.g., budget exceeded, critical error"
                onChange={tags => patch('boundaries', { escalationTriggers: tags })} />
            </div>
            <div className="space-y-1">
              <Label>Restricted Operations</Label>
              <TagInput tags={charter.boundaries.restrictedOperations} readOnly={readOnly}
                placeholder="e.g., delete_production, external_access"
                onChange={tags => patch('boundaries', { restrictedOperations: tags })} />
            </div>
          </TabsContent>

          {/* History */}
          <TabsContent value="history" className="pt-4">
            {versions.length === 0
              ? <p className="text-sm text-muted-foreground">No version history available.</p>
              : (
                <ul className="space-y-3">
                  {versions.map(v => (
                    <li key={v.id} className="rounded-md border p-3 text-sm space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Version {v.version}</span>
                        <span className="text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleDateString()}</span>
                      </div>
                      {v.changeLog && <p className="text-muted-foreground">{v.changeLog}</p>}
                      {v.creator && <p className="text-xs text-muted-foreground">by {v.creator.displayName ?? v.creator.name ?? 'Unknown'}</p>}
                    </li>
                  ))}
                </ul>
              )}
          </TabsContent>
        </Tabs>

        {!readOnly && (
          <div className="flex items-center gap-3 border-t pt-4">
            <Input placeholder="Change log message (optional)" value={changeLog} onChange={e => setChangeLog(e.target.value)} className="flex-1" />
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CharterViewerEditor;

'use client';

import { Brain, GitBranch, Shield, Target, User, Zap } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

export interface RoutingDecisionData {
  id: string;
  agentId: string;
  agentName: string | null;
  confidence: number;
  reasoning: string;
  matchedBy: string;
  fallbackUsed: boolean;
  escalated: boolean;
  routingLatencyMs: number;
  orchestratorName?: string;
  sessionManagerName?: string;
  createdAt: string;
}

interface RoutingDecisionCardProps {
  decision: RoutingDecisionData;
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const MATCHED_BY_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  direct_mention: {
    label: 'Direct Mention',
    icon: User,
    color: 'text-blue-600',
  },
  thread_continuity: {
    label: 'Thread Continuity',
    icon: GitBranch,
    color: 'text-purple-600',
  },
  binding_rule: {
    label: 'Binding Rule',
    icon: Shield,
    color: 'text-red-600',
  },
  discipline_match: {
    label: 'Discipline Match',
    icon: Target,
    color: 'text-green-600',
  },
  seniority_escalation: {
    label: 'Seniority Escalation',
    icon: Zap,
    color: 'text-orange-600',
  },
  load_balance: {
    label: 'Load Balance',
    icon: Brain,
    color: 'text-cyan-600',
  },
  fallback: {
    label: 'Fallback',
    icon: GitBranch,
    color: 'text-gray-600',
  },
};

function getConfidenceVariant(
  confidence: number
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (confidence >= 0.8) return 'default';
  if (confidence >= 0.5) return 'secondary';
  return 'destructive';
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.5) return 'Medium';
  return 'Low';
}

// =============================================================================
// Component
// =============================================================================

export function RoutingDecisionCard({
  decision,
  className,
}: RoutingDecisionCardProps) {
  const matchedByConfig =
    MATCHED_BY_CONFIG[decision.matchedBy] || MATCHED_BY_CONFIG.fallback;
  const MatchedByIcon = matchedByConfig.icon;
  const confidencePct = Math.round(decision.confidence * 100);

  return (
    <Card className={cn('', className)}>
      <CardHeader className='pb-3'>
        <div className='flex items-center justify-between'>
          <CardTitle className='text-base'>Routing Decision</CardTitle>
          <div className='flex items-center gap-2'>
            {decision.escalated && (
              <Badge variant='destructive' className='text-xs'>
                Escalated
              </Badge>
            )}
            {decision.fallbackUsed && (
              <Badge variant='outline' className='text-xs'>
                Fallback
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className='space-y-4'>
        {/* Match Method */}
        <div className='flex items-center gap-2'>
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full bg-muted',
              matchedByConfig.color
            )}
          >
            <MatchedByIcon className='h-4 w-4' />
          </div>
          <div>
            <p className='text-xs text-muted-foreground'>Matched by</p>
            <p className='text-sm font-medium'>{matchedByConfig.label}</p>
          </div>
        </div>

        {/* Targets */}
        <div className='grid grid-cols-1 gap-3 rounded-lg bg-muted/50 p-3 sm:grid-cols-3'>
          {decision.orchestratorName && (
            <div>
              <p className='text-xs text-muted-foreground'>Orchestrator</p>
              <p className='text-sm font-medium truncate'>
                {decision.orchestratorName}
              </p>
            </div>
          )}
          {decision.sessionManagerName && (
            <div>
              <p className='text-xs text-muted-foreground'>Session Manager</p>
              <p className='text-sm font-medium truncate'>
                {decision.sessionManagerName}
              </p>
            </div>
          )}
          <div>
            <p className='text-xs text-muted-foreground'>Agent</p>
            <p className='text-sm font-medium truncate'>
              {decision.agentName || decision.agentId}
            </p>
          </div>
        </div>

        {/* Confidence Score */}
        <div className='space-y-1.5'>
          <div className='flex items-center justify-between'>
            <p className='text-xs text-muted-foreground'>Confidence</p>
            <div className='flex items-center gap-1.5'>
              <Badge
                variant={getConfidenceVariant(decision.confidence)}
                className='text-xs'
              >
                {getConfidenceLabel(decision.confidence)}
              </Badge>
              <span className='text-xs font-medium text-foreground'>
                {confidencePct}%
              </span>
            </div>
          </div>
          <Progress value={confidencePct} className='h-1.5' />
        </div>

        {/* Reasoning */}
        <div className='space-y-1'>
          <p className='text-xs font-medium text-muted-foreground'>Reasoning</p>
          <p className='text-sm text-foreground leading-relaxed'>
            {decision.reasoning}
          </p>
        </div>

        {/* Latency */}
        <div className='flex items-center justify-between text-xs text-muted-foreground'>
          <span>Routing latency</span>
          <span className='font-mono'>{decision.routingLatencyMs}ms</span>
        </div>
      </CardContent>
    </Card>
  );
}

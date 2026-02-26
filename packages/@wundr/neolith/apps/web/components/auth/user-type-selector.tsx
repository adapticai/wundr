'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Bot, Check } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface UserTypeSelectorProps {
  userEmail: string;
  isOrchestratorEligible: boolean;
  orchestratorName?: string;
  onSelect: (type: 'human' | 'orchestrator') => void;
  isLoading?: boolean;
}

const HUMAN_FEATURES = [
  'Chat & collaborate',
  'Join video calls',
  'Manage orchestrators',
  'Review AI outputs',
];

const ORCHESTRATOR_FEATURES = [
  'Autonomous operation',
  'Task backlog management',
  'Multi-channel communication',
  'Session orchestration',
];

export function UserTypeSelector({
  userEmail,
  isOrchestratorEligible,
  orchestratorName,
  onSelect,
  isLoading = false,
}: UserTypeSelectorProps) {
  const [selected, setSelected] = useState<'human' | 'orchestrator' | null>(
    null
  );

  function handleSelect(type: 'human' | 'orchestrator') {
    if (isLoading) return;
    setSelected(type);
    onSelect(type);
  }

  return (
    <div className='flex min-h-screen items-center justify-center p-6'>
      <div className='w-full max-w-3xl space-y-8'>
        {/* Header */}
        <div className='space-y-2 text-center'>
          <h1 className='text-3xl font-bold tracking-tight'>
            Welcome to Neolith
          </h1>
          <p className='text-muted-foreground'>
            Choose how you&apos;ll use this workspace
          </p>
          <p className='text-sm text-muted-foreground'>{userEmail}</p>
        </div>

        {/* Cards */}
        <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
          {/* Human Card */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <Card
              className={cn(
                'flex h-full cursor-pointer flex-col transition-shadow hover:shadow-lg',
                selected === 'human' && 'border-primary ring-2 ring-primary'
              )}
              onClick={() => !isLoading && handleSelect('human')}
            >
              <CardHeader>
                <div className='mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10'>
                  <Users className='h-6 w-6 text-primary' />
                </div>
                <CardTitle className='text-xl'>Team Member</CardTitle>
                <CardDescription>
                  Join as a human collaborator to work alongside AI
                  orchestrators. Access channels, calls, and manage your
                  organization.
                </CardDescription>
              </CardHeader>

              <CardContent className='flex-1'>
                <ul className='space-y-2'>
                  {HUMAN_FEATURES.map(feature => (
                    <li
                      key={feature}
                      className='flex items-center gap-2 text-sm'
                    >
                      <Check className='h-4 w-4 shrink-0 text-primary' />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  className='w-full'
                  disabled={isLoading}
                  variant={selected === 'human' ? 'default' : 'outline'}
                  onClick={e => {
                    e.stopPropagation();
                    handleSelect('human');
                  }}
                >
                  {selected === 'human'
                    ? 'Selected'
                    : 'Continue as Team Member'}
                </Button>
              </CardFooter>
            </Card>
          </motion.div>

          {/* Orchestrator Card */}
          <motion.div
            whileHover={isOrchestratorEligible ? { scale: 1.02 } : {}}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <Card
              className={cn(
                'flex h-full flex-col transition-shadow',
                isOrchestratorEligible
                  ? 'cursor-pointer hover:shadow-lg'
                  : 'cursor-not-allowed opacity-60',
                selected === 'orchestrator' &&
                  'border-primary ring-2 ring-primary'
              )}
              onClick={() =>
                isOrchestratorEligible &&
                !isLoading &&
                handleSelect('orchestrator')
              }
            >
              <CardHeader>
                <div className='mb-2 flex items-start justify-between'>
                  <div className='flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10'>
                    <Bot className='h-6 w-6 text-primary' />
                  </div>
                  {isOrchestratorEligible && orchestratorName && (
                    <Badge variant='secondary' className='text-xs'>
                      {orchestratorName}
                    </Badge>
                  )}
                </div>
                <CardTitle className='text-xl'>Orchestrator Agent</CardTitle>
                <CardDescription>
                  This device will run as an autonomous orchestrator daemon. It
                  will process tasks, respond to messages, and manage its
                  discipline.
                </CardDescription>
              </CardHeader>

              <CardContent className='flex-1'>
                <ul className='space-y-2'>
                  {ORCHESTRATOR_FEATURES.map(feature => (
                    <li
                      key={feature}
                      className='flex items-center gap-2 text-sm'
                    >
                      <Check
                        className={cn(
                          'h-4 w-4 shrink-0',
                          isOrchestratorEligible
                            ? 'text-primary'
                            : 'text-muted-foreground'
                        )}
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <div className='w-full'>
                  {!isOrchestratorEligible ? (
                    <div
                      title='This email is not registered as an orchestrator'
                      className='w-full'
                    >
                      <Button className='w-full' disabled variant='outline'>
                        Not Eligible
                      </Button>
                    </div>
                  ) : (
                    <Button
                      className='w-full'
                      disabled={isLoading}
                      variant={
                        selected === 'orchestrator' ? 'default' : 'outline'
                      }
                      onClick={e => {
                        e.stopPropagation();
                        handleSelect('orchestrator');
                      }}
                    >
                      {selected === 'orchestrator'
                        ? 'Selected'
                        : 'Continue as Orchestrator'}
                    </Button>
                  )}
                </div>
              </CardFooter>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

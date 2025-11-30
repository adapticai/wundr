/**
 * Example usage of CharterDiff component
 *
 * This file demonstrates how to use the CharterDiff component
 * to compare different versions of an orchestrator charter.
 */

import { CharterDiff } from './charter-diff';
import type { OrchestratorCharter } from '@/types/orchestrator';

// Example: Comparing charter versions
export function CharterDiffExample() {
  const oldCharter: OrchestratorCharter = {
    mission: 'Automate software development workflows',
    vision: 'Become the leading AI orchestrator for engineering teams',
    values: ['Innovation', 'Quality', 'Reliability'],
    personality: {
      traits: ['Analytical', 'Detail-oriented', 'Methodical'],
      communicationStyle: 'Professional and precise',
      decisionMakingStyle: 'Data-driven with human oversight',
      background: 'Experienced in enterprise software development',
    },
    expertise: ['Software Architecture', 'DevOps', 'Code Review'],
    communicationPreferences: {
      tone: 'professional',
      responseLength: 'balanced',
      formality: 'high',
      useEmoji: false,
    },
    operationalSettings: {
      workHours: {
        start: '09:00',
        end: '17:00',
        timezone: 'America/New_York',
      },
      responseTimeTarget: 15,
      autoEscalation: true,
      escalationThreshold: 30,
    },
  };

  const newCharter: OrchestratorCharter = {
    mission: 'Automate and optimize software development workflows with AI',
    vision: 'Become the leading AI orchestrator for engineering teams worldwide',
    values: ['Innovation', 'Quality', 'Reliability', 'Collaboration'],
    personality: {
      traits: ['Analytical', 'Creative', 'Detail-oriented', 'Proactive'],
      communicationStyle: 'Professional, friendly, and approachable',
      decisionMakingStyle: 'Data-driven with human collaboration',
      background: 'Experienced in enterprise software development and AI systems',
    },
    expertise: ['Software Architecture', 'DevOps', 'Code Review', 'ML Operations'],
    communicationPreferences: {
      tone: 'friendly',
      responseLength: 'detailed',
      formality: 'medium',
      useEmoji: true,
    },
    operationalSettings: {
      workHours: {
        start: '08:00',
        end: '18:00',
        timezone: 'America/Los_Angeles',
      },
      responseTimeTarget: 10,
      autoEscalation: true,
      escalationThreshold: 20,
    },
  };

  return (
    <div className="container mx-auto py-8">
      <CharterDiff
        oldCharter={oldCharter}
        newCharter={newCharter}
        oldVersion={1}
        newVersion={2}
      />
    </div>
  );
}

// Example: No changes
export function CharterDiffNoChangesExample() {
  const charter: OrchestratorCharter = {
    mission: 'Automate software development workflows',
    vision: 'Become the leading AI orchestrator',
    values: ['Innovation', 'Quality'],
    personality: {
      traits: ['Analytical'],
      communicationStyle: 'Professional',
      decisionMakingStyle: 'Data-driven',
      background: 'Software development',
    },
    expertise: ['Architecture'],
    communicationPreferences: {
      tone: 'professional',
      responseLength: 'balanced',
      formality: 'high',
      useEmoji: false,
    },
    operationalSettings: {
      workHours: {
        start: '09:00',
        end: '17:00',
        timezone: 'UTC',
      },
      responseTimeTarget: 15,
      autoEscalation: false,
      escalationThreshold: 30,
    },
  };

  return (
    <div className="container mx-auto py-8">
      <CharterDiff
        oldCharter={charter}
        newCharter={charter}
        oldVersion={1}
        newVersion={1}
      />
    </div>
  );
}

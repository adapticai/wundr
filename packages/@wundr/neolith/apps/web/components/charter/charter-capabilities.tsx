'use client';

/**
 * Charter Capabilities Component
 *
 * Manages orchestrator capabilities including:
 * - Display available capabilities grouped by category
 * - Toggle enable/disable for each capability
 * - Configure capability-specific parameters
 * - Search/filter capabilities
 *
 * Phase 3.1.2 of the Institutional-Grade-Integrated-System-Roadmap
 */

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Settings2 } from 'lucide-react';

import type {
  OrchestratorCapability,
  CapabilityCategory,
  PermissionLevel,
} from '@/types/charter-capabilities';
import {
  CAPABILITY_DEFINITIONS,
  CATEGORY_CONFIG,
  createDefaultCapability,
} from '@/types/charter-capabilities';

interface CharterCapabilitiesProps {
  value: OrchestratorCapability[];
  onChange: (capabilities: OrchestratorCapability[]) => void;
  availableCapabilities: OrchestratorCapability[];
  disabled?: boolean;
  isAdmin?: boolean;
}

export function CharterCapabilities({
  value = [],
  onChange,
  availableCapabilities = [],
  disabled = false,
  isAdmin = false,
}: CharterCapabilitiesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<
    CapabilityCategory | 'all'
  >('all');

  // Create a map of current capabilities for quick lookup
  const capabilityMap = useMemo(() => {
    const map = new Map<string, OrchestratorCapability>();
    value.forEach(cap => map.set(cap.id, cap));
    return map;
  }, [value]);

  // Filter capabilities based on search and category
  const filteredCategories = useMemo(() => {
    const categories =
      selectedCategory === 'all'
        ? (Object.keys(CAPABILITY_DEFINITIONS) as CapabilityCategory[])
        : [selectedCategory];

    if (!searchQuery) {
      return categories;
    }

    return categories.filter(category => {
      const capabilities = CAPABILITY_DEFINITIONS[category];
      return capabilities.some(
        cap =>
          cap.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cap.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [searchQuery, selectedCategory]);

  // Filter capabilities within a category
  const getFilteredCapabilities = (category: CapabilityCategory) => {
    const capabilities = CAPABILITY_DEFINITIONS[category];

    if (!searchQuery) {
      return capabilities;
    }

    return capabilities.filter(
      cap =>
        cap.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cap.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  // Toggle capability enabled state
  const handleToggleCapability = (capabilityId: string, enabled: boolean) => {
    const existing = capabilityMap.get(capabilityId);

    if (enabled) {
      if (existing) {
        // Update existing capability
        onChange(
          value.map(cap =>
            cap.id === capabilityId ? { ...cap, enabled: true } : cap
          )
        );
      } else {
        // Create new capability from definition
        const definition = Object.values(CAPABILITY_DEFINITIONS)
          .flat()
          .find(def => def.id === capabilityId);

        if (definition) {
          const newCapability = createDefaultCapability(definition);
          newCapability.enabled = true;
          onChange([...value, newCapability]);
        }
      }
    } else {
      // Disable capability
      onChange(
        value.map(cap =>
          cap.id === capabilityId ? { ...cap, enabled: false } : cap
        )
      );
    }
  };

  // Update permission level
  const handlePermissionChange = (
    capabilityId: string,
    permissionLevel: PermissionLevel
  ) => {
    onChange(
      value.map(cap =>
        cap.id === capabilityId ? { ...cap, permissionLevel } : cap
      )
    );
  };

  // Update rate limit
  const handleRateLimitChange = (
    capabilityId: string,
    field: 'maxPerHour' | 'maxPerDay' | 'maxPerMinute',
    valueStr: string
  ) => {
    const numValue = valueStr ? Number(valueStr) : undefined;

    onChange(
      value.map(cap => {
        if (cap.id === capabilityId) {
          return {
            ...cap,
            rateLimit: {
              ...cap.rateLimit,
              [field]: numValue,
            },
          };
        }
        return cap;
      })
    );
  };

  // Count enabled capabilities
  const enabledCount = useMemo(() => {
    return value.filter(cap => cap.enabled).length;
  }, [value]);

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <div className='flex items-start justify-between'>
            <div>
              <CardTitle>Orchestrator Capabilities</CardTitle>
              <CardDescription>
                Configure what actions your orchestrator can perform
              </CardDescription>
            </div>
            <Badge variant='secondary' className='text-sm'>
              {enabledCount} enabled
            </Badge>
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          {/* Search and Filter Controls */}
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                type='search'
                placeholder='Search capabilities...'
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className='pl-9'
                disabled={disabled}
              />
            </div>
            <Select
              value={selectedCategory}
              onValueChange={value =>
                setSelectedCategory(value as CapabilityCategory | 'all')
              }
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder='All categories' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Categories</SelectItem>
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Capabilities Accordion */}
          <Accordion type='multiple' className='w-full'>
            {filteredCategories.map(category => {
              const categoryConfig = CATEGORY_CONFIG[category];
              const capabilities = getFilteredCapabilities(category);
              const enabledInCategory = capabilities.filter(
                cap => capabilityMap.get(cap.id)?.enabled
              ).length;

              return (
                <AccordionItem key={category} value={category}>
                  <AccordionTrigger>
                    <div className='flex items-center gap-3 flex-1'>
                      <Badge className={categoryConfig.color} variant='outline'>
                        {categoryConfig.label}
                      </Badge>
                      <span className='text-sm text-muted-foreground'>
                        {categoryConfig.description}
                      </span>
                      {enabledInCategory > 0 && (
                        <Badge variant='secondary' className='ml-auto mr-2'>
                          {enabledInCategory} / {capabilities.length}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className='space-y-3 pt-2'>
                      {capabilities.map(capDef => {
                        const capability = capabilityMap.get(capDef.id);
                        const isEnabled = capability?.enabled ?? false;

                        return (
                          <Card key={capDef.id} className='border-muted'>
                            <CardContent className='p-4'>
                              <div className='space-y-4'>
                                {/* Capability Header */}
                                <div className='flex items-start justify-between gap-4'>
                                  <div className='flex items-start gap-3 flex-1'>
                                    {capDef.icon && (
                                      <div className='text-xl mt-0.5'>
                                        {capDef.icon}
                                      </div>
                                    )}
                                    <div className='flex-1 space-y-1'>
                                      <div className='flex items-center gap-2'>
                                        <Label
                                          htmlFor={`capability-${capDef.id}`}
                                          className='text-sm font-medium cursor-pointer'
                                        >
                                          {capDef.name}
                                        </Label>
                                      </div>
                                      <p className='text-xs text-muted-foreground'>
                                        {capDef.description}
                                      </p>
                                    </div>
                                  </div>
                                  <Switch
                                    id={`capability-${capDef.id}`}
                                    checked={isEnabled}
                                    onCheckedChange={checked =>
                                      handleToggleCapability(capDef.id, checked)
                                    }
                                    disabled={disabled}
                                  />
                                </div>

                                {/* Configuration Panel (shown when enabled) */}
                                {isEnabled && capability && (
                                  <div className='border-t pt-4 space-y-4'>
                                    <div className='flex items-center gap-2 text-sm font-medium text-muted-foreground'>
                                      <Settings2 className='h-4 w-4' />
                                      Configuration
                                    </div>

                                    {/* Permission Level */}
                                    <div className='grid gap-4 md:grid-cols-2'>
                                      <div className='space-y-2'>
                                        <Label
                                          htmlFor={`permission-${capDef.id}`}
                                          className='text-xs'
                                        >
                                          Permission Level
                                        </Label>
                                        <Select
                                          value={capability.permissionLevel}
                                          onValueChange={level =>
                                            handlePermissionChange(
                                              capDef.id,
                                              level as PermissionLevel
                                            )
                                          }
                                          disabled={disabled}
                                        >
                                          <SelectTrigger
                                            id={`permission-${capDef.id}`}
                                            className='h-9'
                                          >
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value='none'>
                                              None
                                            </SelectItem>
                                            <SelectItem value='read'>
                                              Read
                                            </SelectItem>
                                            <SelectItem value='write'>
                                              Write
                                            </SelectItem>
                                            {isAdmin && (
                                              <SelectItem value='admin'>
                                                Admin
                                              </SelectItem>
                                            )}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>

                                    {/* Rate Limiting */}
                                    <div className='space-y-2'>
                                      <Label className='text-xs'>
                                        Rate Limiting (optional)
                                      </Label>
                                      <div className='grid gap-3 md:grid-cols-3'>
                                        <div className='space-y-1.5'>
                                          <Label
                                            htmlFor={`rate-minute-${capDef.id}`}
                                            className='text-xs text-muted-foreground'
                                          >
                                            Per Minute
                                          </Label>
                                          <Input
                                            id={`rate-minute-${capDef.id}`}
                                            type='number'
                                            min='1'
                                            value={
                                              capability.rateLimit
                                                ?.maxPerMinute ?? ''
                                            }
                                            onChange={e =>
                                              handleRateLimitChange(
                                                capDef.id,
                                                'maxPerMinute',
                                                e.target.value
                                              )
                                            }
                                            placeholder='No limit'
                                            className='h-9'
                                            disabled={disabled}
                                          />
                                        </div>
                                        <div className='space-y-1.5'>
                                          <Label
                                            htmlFor={`rate-hour-${capDef.id}`}
                                            className='text-xs text-muted-foreground'
                                          >
                                            Per Hour
                                          </Label>
                                          <Input
                                            id={`rate-hour-${capDef.id}`}
                                            type='number'
                                            min='1'
                                            value={
                                              capability.rateLimit
                                                ?.maxPerHour ?? ''
                                            }
                                            onChange={e =>
                                              handleRateLimitChange(
                                                capDef.id,
                                                'maxPerHour',
                                                e.target.value
                                              )
                                            }
                                            placeholder='No limit'
                                            className='h-9'
                                            disabled={disabled}
                                          />
                                        </div>
                                        <div className='space-y-1.5'>
                                          <Label
                                            htmlFor={`rate-day-${capDef.id}`}
                                            className='text-xs text-muted-foreground'
                                          >
                                            Per Day
                                          </Label>
                                          <Input
                                            id={`rate-day-${capDef.id}`}
                                            type='number'
                                            min='1'
                                            value={
                                              capability.rateLimit?.maxPerDay ??
                                              ''
                                            }
                                            onChange={e =>
                                              handleRateLimitChange(
                                                capDef.id,
                                                'maxPerDay',
                                                e.target.value
                                              )
                                            }
                                            placeholder='No limit'
                                            className='h-9'
                                            disabled={disabled}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          {/* No Results Message */}
          {filteredCategories.length === 0 && (
            <div className='py-12 text-center'>
              <p className='text-sm text-muted-foreground'>
                No capabilities found matching your search.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

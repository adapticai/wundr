'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseUnsavedChangesOptions {
  enabled?: boolean;
  onSave?: () => Promise<void> | void;
  onDiscard?: () => void;
}

export function useUnsavedChanges(options: UseUnsavedChangesOptions = {}) {
  const { enabled = true, onSave, onDiscard } = options;
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null
  );
  const router = useRouter();
  const isNavigatingRef = useRef(false);

  // Mark form as dirty
  const markAsDirty = useCallback(() => {
    if (enabled) {
      setHasUnsavedChanges(true);
    }
  }, [enabled]);

  // Mark form as clean
  const markAsClean = useCallback(() => {
    setHasUnsavedChanges(false);
  }, []);

  // Handle browser navigation
  useEffect(() => {
    if (!enabled || !hasUnsavedChanges) {
      return;
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [enabled, hasUnsavedChanges]);

  // Handle save action
  const handleSave = useCallback(async () => {
    if (onSave) {
      await onSave();
    }
    markAsClean();
    setShowDialog(false);
    if (pendingNavigation) {
      isNavigatingRef.current = true;
      router.push(pendingNavigation);
      setPendingNavigation(null);
    }
  }, [onSave, markAsClean, pendingNavigation, router]);

  // Handle discard action
  const handleDiscard = useCallback(() => {
    if (onDiscard) {
      onDiscard();
    }
    markAsClean();
    setShowDialog(false);
    if (pendingNavigation) {
      isNavigatingRef.current = true;
      router.push(pendingNavigation);
      setPendingNavigation(null);
    }
  }, [onDiscard, markAsClean, pendingNavigation, router]);

  // Navigate with confirmation if needed
  const navigateWithConfirmation = useCallback(
    (href: string) => {
      if (!enabled || !hasUnsavedChanges) {
        router.push(href);
        return;
      }

      setPendingNavigation(href);
      setShowDialog(true);
    },
    [enabled, hasUnsavedChanges, router]
  );

  return {
    hasUnsavedChanges,
    markAsDirty,
    markAsClean,
    showDialog,
    setShowDialog,
    handleSave,
    handleDiscard,
    navigateWithConfirmation,
  };
}

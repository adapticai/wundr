# Performance Dashboard Page Fix

## Issue

The performance dashboard page was contributing to the infinite loop errors due to passing inline
callback functions to hooks.

## Root Cause

When passing callbacks like `onError: (error) => { ... }` directly to hooks, React creates a new
function on every render. This causes the hook's internal useCallback or useMemo to recreate, which
triggers useEffect dependencies to change, creating infinite loops.

## Fix Applied

### Before:

```typescript
usePerformanceData({
  timeRange,
  realtime,
  refreshInterval: 30000,
  onError: error => {
    // ❌ New function every render
    toast({
      title: 'Performance Data Error',
      description: error.message,
      variant: 'destructive',
    });
  },
});
```

### After:

```typescript
// Memoize the error handler to prevent infinite loops
const handleError = useCallback(
  (error: any) => {
    toast({
      title: 'Performance Data Error',
      description: error.message,
      variant: 'destructive',
    });
  },
  [toast]
);

usePerformanceData({
  timeRange,
  realtime,
  refreshInterval: 30000,
  onError: handleError, // ✅ Stable reference
});
```

## Why This Works

- `useCallback` memoizes the function
- The function only recreates if `toast` changes (which is stable from the hook)
- This prevents the cascade of recreations that cause infinite loops

## Other Potential Issues in Performance Page

1. **Chart.js Registration** - Called on every render, but should be fine as it's idempotent
2. **Large useMemo calculations** - Could cause performance issues with large datasets
3. **Multiple chart data preparations** - Consider consolidating

## Recommendations

1. Apply similar fixes to all dashboard pages using hooks with callbacks
2. Add ESLint rule to catch inline function props
3. Consider extracting chart options to constants outside component
4. Monitor performance with React DevTools Profiler

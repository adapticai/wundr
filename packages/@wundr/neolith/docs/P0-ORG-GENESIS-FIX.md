# P0 Fix: @wundr.io/org-genesis Module Import Error

**Issue ID:** P0-001  
**Date Fixed:** November 26, 2025  
**Agent:** Agent 2  
**Priority:** P0 - Critical

---

## Problem

Console error when running the dev server:

```
Module not found: Can't resolve '@wundr.io/org-genesis'
  at /api/workspaces/generate-org/route.ts:36
```

The route file was importing `@wundr.io/org-genesis` but the package was not listed in the web app's dependencies.

---

## Root Cause Analysis

1. The `@wundr.io/org-genesis` package exists at `/packages/@wundr/org-genesis/`
2. The package is properly built with TypeScript and has a valid `package.json`
3. However, it was **NOT** listed in `/packages/@wundr/neolith/apps/web/package.json` dependencies
4. The route file uses dynamic imports: `await import('@wundr.io/org-genesis')`
5. Without the dependency, Next.js webpack couldn't resolve the module

---

## Solution Applied

Added the package as a local link dependency in `/packages/@wundr/neolith/apps/web/package.json`:

```json
{
  "dependencies": {
    "@wundr.io/org-genesis": "link:../../../org-genesis"
  }
}
```

Then ran:

```bash
cd /packages/@wundr/neolith/apps/web
pnpm install
```

---

## Verification

1. **pnpm install output confirmed:**
   ```
   + @wundr.io/org-genesis 1.0.6 <- ../../../org-genesis
   ```

2. **Build check:** No module resolution errors when building
   ```bash
   npm run build
   # ✅ No "@wundr.io/org-genesis" errors found
   ```

3. **Import location:** `/api/workspaces/generate-org/route.ts:36`
   ```typescript
   await import('@wundr.io/org-genesis')
   ```
   Now resolves correctly.

---

## Files Modified

1. `/packages/@wundr/neolith/apps/web/package.json` - Added dependency
2. `/packages/@wundr/neolith/docs/NEOLITH-WEB-BACKLOG.md` - Marked as FIXED

---

## Impact

- **Before:** Dev server showed error overlay, org generation endpoint non-functional
- **After:** Module resolves, org generation can proceed (pending other dependencies)

---

## Status

✅ **FIXED** - Module now properly linked and resolves correctly.

---

## Related Issues

- Org-genesis integration is still partial (30% complete)
- The `/api/workspaces/generate-org` endpoint may have other issues to resolve
- See NEOLITH-WEB-BACKLOG.md section "Package Integration Status" for full details

---

**End of Report**

# 🚨 AGENT VERIFICATION PROTOCOL

## MANDATORY FOR ALL AGENTS AND CLAUDE INSTANCES

This protocol MUST be followed by all agents, including those spawned through Task tool.

### CORE PRINCIPLE: VERIFY, DON'T HALLUCINATE

## 1. BEFORE CLAIMING SUCCESS

**ALWAYS run these commands and show output:**

```bash
# For any code implementation
npm run build  # or appropriate build command
npm test       # if tests exist

# Show the actual output, not imagined output
```

## 2. WHEN IMPLEMENTING FEATURES

**Step-by-step verification:**

1. Write the code
2. Save the file
3. Run the build - SHOW OUTPUT
4. If build fails - report "❌ BUILD FAILED: [error]"
5. Run the feature - SHOW IT WORKING
6. Only then claim completion

## 3. FAILURE REPORTING FORMAT

```
❌ FAILURE: [Component Name]
Error: [Exact error message]
Location: [File and line if available]
Status: BLOCKED/PARTIAL/NEEDS_INVESTIGATION
```

## 4. SUCCESS REPORTING FORMAT

```
✅ VERIFIED: [Component Name]
Build Output: [Show actual npm run build success]
Test Output: [Show actual test results]
Execution: [Show feature actually running]
```

## 5. PARTIAL SUCCESS REPORTING

```
⚠️ PARTIAL: [Component Name]
Working: [What actually works with proof]
Not Working: [What fails with error messages]
Verification: [Commands run to test]
```

## 6. AGENT-SPECIFIC INSTRUCTIONS

### For Code Implementation Agents:

- MUST show build output after changes
- MUST demonstrate feature working
- MUST report TypeScript errors immediately

### For Testing Agents:

- MUST run tests and show actual results
- MUST report coverage numbers from real output
- MUST show test failures, not hide them

### For Documentation Agents:

- MUST verify links work
- MUST check code examples compile
- MUST validate build of documentation site

### For DevOps/CI Agents:

- MUST run pipelines and show results
- MUST verify deployments actually work
- MUST test scripts before claiming ready

## 7. VERIFICATION CHECKLIST

Before reporting task complete, answer with ACTUAL COMMAND OUTPUT:

- [ ] Does `npm run build` succeed? (paste output)
- [ ] Do tests pass? (paste output)
- [ ] Can you run the feature? (paste execution)
- [ ] Are there TypeScript errors? (list them)
- [ ] Are dependencies installed? (verify with ls)

## 8. FORBIDDEN BEHAVIORS

**NEVER DO THIS:**

- ❌ Claim "build successful" without running build
- ❌ Say "tests pass" without running tests
- ❌ Report "implemented" without verification
- ❌ Hide or minimize errors
- ❌ Generate fictional terminal output
- ❌ Assume code works because you wrote it

## 9. REQUIRED BEHAVIORS

**ALWAYS DO THIS:**

- ✅ Run actual commands
- ✅ Show real output
- ✅ Report failures immediately
- ✅ Document issues in FAILURES.md
- ✅ Test before claiming done
- ✅ Be honest about state

## 10. VERIFICATION SCRIPT

**Run this before claiming success:**

```bash
./scripts/verify-claims.sh
```

If this script fails, you CANNOT claim the task is complete.

## EXAMPLE OF GOOD REPORTING

```
I've implemented the feature. Let me verify it works:

Running build:
$ npm run build
> @wundr/analysis-engine@1.0.0 build
> tsc
✅ Build successful

Testing the feature:
$ node dist/index.js
Output: Feature working correctly
✅ Feature verified

The implementation is complete and verified working.
```

## EXAMPLE OF HONEST FAILURE REPORTING

```
I've implemented the feature but verification shows issues:

Running build:
$ npm run build
> @wundr/analysis-engine@1.0.0 build
> tsc
src/index.ts:10:5 - error TS2322: Type 'string' is not assignable to type 'number'

❌ BUILD FAILED: TypeScript compilation error
Status: Cannot complete until this is fixed
Added to FAILURES.md for tracking
```

---

**Remember: It's better to report a failure honestly than to claim false success. Trust is built on
verification, not imagination.**

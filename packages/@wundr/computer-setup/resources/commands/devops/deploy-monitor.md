Monitor deployment to Railway/Netlify after pushing to main/master.

## Workflow

1. **Detect Platform**: Check for railway.json or netlify.toml
2. **Monitor Status**: Poll deployment API until complete
3. **Analyze Logs**: Check for errors and warnings
4. **Auto-Fix**: Attempt to fix common issues
5. **Re-deploy**: Push fixes and verify resolution
6. **Report**: Provide comprehensive status report

## MCP Tools Used

### Railway
- `mcp__railway__deploy_status`
- `mcp__railway__get_logs`
- `mcp__railway__get_deployments`

### Netlify
- `mcp__netlify__deploy_status`
- `mcp__netlify__get_build_logs`
- `mcp__netlify__get_deploys`

## Options

- `--platform <railway|netlify>`: Force specific platform
- `--timeout <seconds>`: Set monitoring timeout (default: 300)
- `--no-auto-fix`: Disable automatic fix attempts
- `--max-cycles <n>`: Maximum fix cycles (default: 5)

## Examples

```bash
/deploy-monitor
/deploy-monitor --platform railway
/deploy-monitor --timeout 600 --max-cycles 3
```

## Platform Detection

The command automatically detects the deployment platform:
1. Checks for `railway.json` → Railway
2. Checks for `netlify.toml` → Netlify
3. Checks `$RAILWAY_PROJECT_ID` env var → Railway
4. Checks `$NETLIFY_SITE_ID` env var → Netlify

## Agent Coordination

This command coordinates the following agents:
- **deployment-monitor**: Real-time status tracking
- **log-analyzer**: Error detection and classification
- **debug-refactor**: Automatic issue resolution

## Output

The command provides:
- Real-time deployment progress
- Build/deploy logs streaming
- Error detection and analysis
- Fix suggestions (or automatic fixes)
- Final status report

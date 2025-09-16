# Troubleshooting FAQ

Quick answers to common troubleshooting questions for Wundr guides.

## Installation Issues

### Q: The installation video shows different steps than what I see

**A**: Installation steps may vary by platform. Key points:
- Ensure you have Node.js 16+ installed
- Use the appropriate package manager (npm/pnpm/yarn)
- Check for any error messages during installation

### Q: Global installation isn't working

**A**: Try these solutions:
1. Use `sudo` on Unix systems (if needed)
2. Configure npm prefix: `npm config set prefix ~/.npm-global`
3. Use local installation: `npm install @wundr/cli`

## Configuration Problems

### Q: My configuration file isn't being recognized

**A**: Common causes:
- File not in project root directory
- Incorrect file naming (should be `wundr.config.json`)
- Invalid JSON syntax
- File permissions issues

### Q: Custom patterns aren't working as shown in the video

**A**: Verify:
- Pattern syntax is correct
- Pattern files are in the right location
- Configuration references the correct pattern paths

## Dashboard Issues

### Q: Dashboard won't start like in the tutorial

**A**: Check these items:
- Port 3000 might be in use - try `--port=3001`
- Clear browser cache and cookies
- Ensure firewall isn't blocking the connection

### Q: Dashboard features don't match the video

**A**: This could be due to:
- Different Wundr version
- Browser compatibility issues
- Configuration differences

## Analysis Problems

### Q: Analysis is much slower than shown in videos

**A**: Performance factors:
- Project size (larger projects take longer)
- Available system memory
- Disk I/O performance
- Configuration settings

Optimization tips:
```bash
# Use incremental analysis
wundr analyze --incremental

# Exclude unnecessary directories
# Add to wundr.config.json:
{
  "analysis": {
    "exclude": ["node_modules/**", "build/**"]
  }
}
```

### Q: Getting different results than the tutorial

**A**: Possible reasons:
- Different project structure
- Different code patterns
- Configuration variations
- Wundr version differences

## Team Setup

### Q: Team features aren't working as demonstrated

**A**: Common issues:
- Network connectivity problems
- Configuration sync issues
- Permission problems
- Version mismatches between team members

## General Troubleshooting

### Q: Video shows features I don't have

**A**: Ensure you're using:
- The correct Wundr version shown in the video
- All required dependencies installed
- Proper configuration setup

### Q: Commands from videos don't work

**A**: Verify:
- Command syntax (check for typos)
- Current working directory
- Required permissions
- Wundr is properly installed and in PATH

## Getting Additional Help

If these solutions don't resolve your issues:

1. Check the main [Troubleshooting Guide](/troubleshooting/common-issues)
2. Review the [FAQ](/faq)
3. Visit our [GitHub Discussions](https://github.com/adapticai/wundr/discussions)
4. Join the [Discord Community](https://discord.gg/wundr)

## Feedback

Help us improve our tutorials:
- Report inaccuracies in videos
- Suggest additional troubleshooting topics
- Share your solutions with the community
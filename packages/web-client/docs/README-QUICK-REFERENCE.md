# README Quick Reference Guide

A condensed guide for creating high-quality npm package READMEs based on industry best practices.

## Standard Structure (In Order)

1. **Title + Badges** (3-7 badges max: npm version, license, build, downloads)
2. **One-line description** (value proposition)
3. **Brief overview** (2-3 sentences)
4. **Table of Contents** (if >300 lines)
5. **Installation** (npm, yarn, pnpm)
6. **Quick Start** (simplest runnable example)
7. **Features** (3-5 bullet points)
8. **Documentation** (link to external docs)
9. **API Reference** (high-level, link to full docs)
10. **Examples** (basic + advanced)
11. **Contributing** (link to CONTRIBUTING.md)
12. **Community** (Discord, Discussions, etc.)
13. **License** (MIT, Apache, etc.)

## Essential Badges

```markdown
[![npm version](https://img.shields.io/npm/v/@wundr/package-name.svg?style=flat)](https://www.npmjs.com/package/@wundr/package-name)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/wundr/repo/workflows/CI/badge.svg)](https://github.com/wundr/repo/actions)
[![npm downloads](https://img.shields.io/npm/dm/@wundr/package-name.svg)](https://www.npmjs.com/package/@wundr/package-name)
```

## Code Block Best Practices

**Always specify language:**

````markdown
```javascript
const example = 'code';
```
````

**Common language identifiers:**

- JavaScript: `javascript` or `js`
- TypeScript: `typescript` or `ts`
- Bash: `bash` or `sh`
- JSON: `json`
- Markdown: `markdown` or `md`

**Formatting rules:**

- Blank line before code block
- Blank line after code block
- Complete, runnable examples
- Include imports/setup

## Accessibility Checklist

- [ ] Images have descriptive alt text
- [ ] Links have meaningful text (not "click here")
- [ ] Lists use proper markdown (`-` or `1.`)
- [ ] Heading hierarchy is logical (H1 → H2 → H3)
- [ ] Badges have sufficient color contrast

## SEO Optimization

**Critical elements:**

1. **Repository name** - Include keywords
2. **Description** - 50-80 characters with keywords
3. **Topics/Tags** - 5-10 relevant tags
4. **First paragraph** - Keyword-rich explanation
5. **Headers** - Use descriptive, keyword-focused headings

**package.json optimization:**

```json
{
  "name": "@wundr/package-name",
  "description": "Keyword-rich description (shows in npm search)",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "homepage": "https://github.com/wundr/package-name#readme"
}
```

## Common Mistakes to Avoid

❌ **Don't:**

- Include >7 badges (overwhelming)
- Write incomplete code examples
- Skip language identifier in code blocks
- Use ambiguous link text ("here", "this")
- Try to document everything in README
- Forget to update README with version changes
- Use emoji as list bullets (breaks screen readers)
- Skip heading levels (H1 → H4)

✅ **Do:**

- Keep README <500 lines (link to external docs)
- Test all code examples
- Use proper markdown syntax
- Provide clear next steps
- Update regularly
- Use hub-and-spoke model (README → detailed docs)

## Quick Reference: README Sections

### Installation

```bash
# npm
npm install @wundr/package-name

# yarn
yarn add @wundr/package-name

# pnpm
pnpm add @wundr/package-name
```

### Quick Start Template

````markdown
## Quick Start

```javascript
import { feature } from '@wundr/package-name';

const result = feature('example');
console.log(result); // Output: [expected output]
```
````

````

### Features Template
```markdown
## Features

- **Benefit-focused name** - Brief explanation
- **Benefit-focused name** - Brief explanation
- **Benefit-focused name** - Brief explanation
````

### Documentation Links Template

```markdown
## Documentation

Visit [docs.wundr.io/package](https://docs.wundr.io/package) for complete documentation.

### Key Resources

- [Getting Started](link)
- [API Reference](link)
- [Examples](link)
- [Migration Guide](link)
```

### Contributing Template

```markdown
## Contributing

1. **Report Bugs:** [Open an issue](link)
2. **Suggest Features:** [Feature request](link)
3. **Submit PRs:** Read our [Contributing Guide](CONTRIBUTING.md)
4. **First Time?** Check out [Good First Issues](link)

Please read our [Code of Conduct](CODE_OF_CONDUCT.md).
```

### License Template

```markdown
## License

MIT © [Wundr.io](https://wundr.io)

See [LICENSE](LICENSE) file for details.
```

## Length Guidelines

| Section                    | Recommended Length   |
| -------------------------- | -------------------- |
| Hero (title + description) | 3-5 lines            |
| Installation               | 5-10 lines           |
| Quick Start                | 10-20 lines          |
| Features                   | 3-5 bullet points    |
| Documentation links        | 3-7 links            |
| API Reference              | 5-10 lines + link    |
| Examples                   | 2-3 examples         |
| Contributing               | 5-10 lines           |
| **Total README**           | **<500 lines ideal** |

## Link Patterns

**Internal (same repo):**

```markdown
[CONTRIBUTING.md](CONTRIBUTING.md) [examples folder](./examples)
[Installation section](#installation)
```

**External:**

```markdown
[Documentation](https://docs.wundr.io)
[npm package](https://www.npmjs.com/package/@wundr/package-name)
```

## Badge Priority Order

1. npm version (most important)
2. License
3. Build/CI status
4. Downloads
5. Coverage
6. PRs Welcome
7. Community metrics (Discord, etc.)

## Table of Contents

**Include when:**

- README >300 lines
- 5+ major sections
- Complex structure

**Auto-generate with:**

```bash
# markdown-toc
npm install -g markdown-toc
markdown-toc -i README.md

# DocToc
npm install -g doctoc
doctoc README.md
```

## Image Guidelines

**Alt text patterns:**

```markdown
![Descriptive alt text](image.png) ![Screenshot of dashboard showing metrics](screenshot.png)
!["" for decorative images](decorative.png)
```

**Best practices:**

- SVG for logos (scales well)
- GIF <3MB for demos
- Optimize images for web
- Include meaningful alt text

## API Documentation Levels

**In README:**

- Top 3-5 most common methods
- Simple examples only
- Link to full API docs

**In External Docs:**

- Complete API reference
- All methods, properties, types
- Advanced usage
- Edge cases

## Final Checklist

Before publishing README:

- [ ] All links work (no 404s)
- [ ] Code examples are runnable
- [ ] Language specified for all code blocks
- [ ] Images have alt text
- [ ] Badges <7 total
- [ ] Heading hierarchy is correct
- [ ] README <500 lines
- [ ] package.json metadata matches
- [ ] Topics/tags configured on GitHub
- [ ] License file exists and is referenced

---

**See Also:**

- [Complete Best Practices Guide](./README-BEST-PRACTICES.md)
- [README Template](./README-TEMPLATE.md)

**Last Updated:** 2025-01-21

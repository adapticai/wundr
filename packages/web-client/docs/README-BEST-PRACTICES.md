# npm Package README Best Practices Guide

## Executive Summary

This comprehensive guide synthesizes research from top-tier npm packages (React, TypeScript, ESLint,
Jest, Prettier, Next.js) and industry best practices to establish standards for @wundr.io README
documentation.

**Research Findings:**

- Analyzed 6 major npm packages with millions of downloads
- Identified common patterns across successful open-source projects
- Documented accessibility, SEO, and user experience best practices
- Established section ordering and content guidelines

---

## Table of Contents

1. [Recommended README Structure](#recommended-readme-structure)
2. [Section-by-Section Guidelines](#section-by-section-guidelines)
3. [Badges and Visual Elements](#badges-and-visual-elements)
4. [Installation Instructions](#installation-instructions)
5. [Quick Start Examples](#quick-start-examples)
6. [API Documentation](#api-documentation)
7. [Code Example Formatting](#code-example-formatting)
8. [Table of Contents Navigation](#table-of-contents-navigation)
9. [Contributing Guidelines](#contributing-guidelines)
10. [License Information](#license-information)
11. [Accessibility Best Practices](#accessibility-best-practices)
12. [SEO Optimization](#seo-optimization)
13. [Links and Cross-References](#links-and-cross-references)
14. [Common Pitfalls to Avoid](#common-pitfalls-to-avoid)

---

## Recommended README Structure

Based on analysis of top npm packages, the optimal README structure follows this hierarchy:

### 1. **Hero Section** (Above the fold)

```markdown
# Package Name

[Badges Row]

> Concise one-line description (value proposition)

Brief 2-3 sentence overview explaining what the package does and why it exists.
```

### 2. **Visual Identity** (Optional but recommended)

- Logo or branded image
- Screenshot or demo GIF
- Architecture diagram

### 3. **Quick Navigation**

- Table of Contents (for READMEs >300 lines)
- Key documentation links

### 4. **Installation**

```bash
npm install package-name
# or
yarn add package-name
# or
pnpm add package-name
```

### 5. **Quick Start / Getting Started**

- Simplest possible example
- Immediately demonstrates value
- Runnable code snippet

### 6. **Features / Highlights**

- 3-5 key capabilities
- Bullet point format
- Problem → Solution framing

### 7. **Documentation**

- Link to comprehensive docs
- API reference
- Guides and tutorials
- Examples section

### 8. **Contributing**

- Link to CONTRIBUTING.md
- Code of Conduct
- Good First Issues label
- Development setup

### 9. **Community & Support**

- GitHub Discussions
- Discord/Slack
- Stack Overflow tag
- Twitter/social links

### 10. **Sponsors / Funding** (Optional)

- Open Collective
- GitHub Sponsors
- Corporate sponsors by tier

### 11. **License**

- License type
- Link to LICENSE file
- Copyright year and holder

### 12. **Footer**

- Additional badges
- Related projects
- Acknowledgments

---

## Section-by-Section Guidelines

### Hero Section

**Purpose:** Immediately communicate what the package is and why someone should care.

**Best Practices:**

- Keep title concise (package name only)
- One-line tagline focusing on value, not implementation
- 2-3 sentence overview maximum
- Front-load the most important information

**Examples from Top Packages:**

**React:**

```markdown
# React

The library for web and native user interfaces
```

**TypeScript:**

```markdown
# TypeScript

TypeScript is a language for application-scale JavaScript. TypeScript adds optional types to
JavaScript that support tools for large-scale JavaScript applications for any browser, for any host,
on any OS.
```

**Jest:**

```markdown
# 🃏 Delightful JavaScript Testing

[Branded visual]

• Developer Ready: Complete and ready to set-up JavaScript testing solution • Instant Feedback:
Fast, interactive watch mode • Snapshot Testing: Capture snapshots of large objects
```

**Key Insight:** Jest uses emoji and visual branding; React is minimalist; TypeScript focuses on
technical positioning. Choose style based on target audience.

---

### Installation Section

**Purpose:** Remove friction for first-time users to install the package.

**Best Practices:**

1. **Support Multiple Package Managers**

```bash
# npm
npm install package-name

# yarn
yarn add package-name

# pnpm
pnpm add package-name

# bun
bun add package-name
```

2. **Specify Development vs Production**

```bash
# Install as dev dependency
npm install -D package-name

# Install globally
npm install -g package-name
```

3. **Handle Special Cases**

- Peer dependencies
- Platform-specific installation
- Optional features requiring additional packages

**ESLint Example (Special Configuration):**

```bash
# For pnpm users
# Add to .npmrc:
auto-install-peers=true
node-linker=hoisted
```

4. **Installation Variants**

```bash
# Stable release
npm install package-name

# Beta/next version
npm install package-name@next

# Specific version
npm install package-name@1.2.3
```

**Common Pattern:** Most packages prioritize npm, then yarn, then pnpm. Consider your audience's
preferences.

---

### Quick Start Examples

**Purpose:** Get users to "hello world" in under 60 seconds.

**Best Practices:**

1. **Minimal Code Required**
   - Show simplest possible usage
   - No advanced features
   - Copy-paste ready

2. **Complete, Runnable Examples**
   - Include all imports
   - Show actual output
   - Avoid "..." ellipses unless necessary

3. **Progressive Disclosure**
   - Start simple
   - Link to advanced examples
   - Don't overwhelm with options

**React Example:**

```jsx
import { createRoot } from 'react-dom/client';

function App() {
  return <h1>Hello, world!</h1>;
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
```

**Jest Example:**

```javascript
function sum(a, b) {
  return a + b;
}

// sum.test.js
test('adds 1 + 2 to equal 3', () => {
  expect(sum(1, 2)).toBe(3);
});
```

**Key Pattern:** Show the complete file, not fragments. Users should be able to copy-paste and run.

---

### Features / Highlights Section

**Purpose:** Communicate key capabilities and differentiators.

**Best Practices:**

1. **3-5 Core Features Maximum**
   - More dilutes impact
   - Focus on unique value props

2. **Benefits-Focused Language**
   - "Fast and reliable" over "Uses caching algorithm"
   - "Works everywhere" over "Platform-agnostic implementation"

3. **Visual Hierarchy**

```markdown
### ⚡ Fast

Built with performance in mind from day one.

### 🔧 Flexible

Configure everything or use sensible defaults.

### 📦 Zero Dependencies

No bloat, just what you need.
```

4. **Proof Points**
   - Benchmarks
   - Testimonials
   - Adoption metrics

**ESLint Example:**

```markdown
ESLint is a tool for identifying and reporting on patterns found in ECMAScript/JavaScript code.

Key features: • Uses Espree for JavaScript parsing • Fully pluggable: every single rule is a plugin
• Completely configurable
```

---

### Documentation Organization

**Philosophy:** README should be a **hub**, not the **destination**.

**Pattern from Top Packages:**

1. **Hub-and-Spoke Model**

```markdown
## Documentation

Visit [https://package.dev](https://package.dev) for complete documentation.

### Key Resources

- [Getting Started](https://package.dev/docs/getting-started)
- [API Reference](https://package.dev/api)
- [Migration Guide](https://package.dev/docs/migration)
- [Examples](https://package.dev/examples)
```

2. **README vs External Docs**

| README Should Include   | Move to External Docs   |
| ----------------------- | ----------------------- |
| Installation            | Detailed configuration  |
| Quick start (1 example) | Advanced examples       |
| Key features            | Full API reference      |
| Links to docs           | Tutorial series         |
| Basic configuration     | Architecture deep-dives |

3. **Common External Doc Patterns**
   - **TypeScript:** Links to handbook and 5-minute intro
   - **Next.js:** Single link to comprehensive docs site
   - **React:** Modular approach with 11 specific doc links
   - **Prettier:** Separate pages for install, options, CLI, API

**Best Practice:** Don't duplicate. README points to authoritative source.

---

## Badges and Visual Elements

### Badge Strategy

**Research Findings:**

- **2025 Trend:** Some projects (npm CLI) removed badges citing redundancy
- **Best Practice:** 3-7 badges maximum to avoid overwhelming users
- **Placement:** Immediately after title, single row

### Essential Badges (Priority Order)

1. **npm Version**

```markdown
[![npm version](https://img.shields.io/npm/v/package-name.svg?style=flat)](https://www.npmjs.com/package/package-name)
```

2. **License**

```markdown
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
```

3. **Build/CI Status**

```markdown
[![CI](https://github.com/user/repo/workflows/CI/badge.svg)](https://github.com/user/repo/actions)
```

4. **Downloads**

```markdown
[![npm downloads](https://img.shields.io/npm/dm/package-name.svg)](https://www.npmjs.com/package/package-name)
```

5. **Coverage** (For quality-focused projects)

```markdown
[![Coverage Status](https://coveralls.io/repos/github/user/repo/badge.svg?branch=main)](https://coveralls.io/github/user/repo?branch=main)
```

### Badge Best Practices

**DO:**

- Use dynamic badges that auto-update
- Ensure sufficient color contrast (accessibility)
- Link badges to relevant pages (npm page, license file, build status)
- Use consistent style (`?style=flat` recommended)
- Group related badges together

**DON'T:**

- Create static badges with hardcoded values
- Use more than 7-8 badges
- Mix different badge styles
- Use badges that duplicate information already visible

### Badge Categories by Package Type

**Library/Framework:**

- npm version
- Build status
- License
- Downloads
- Coverage

**CLI Tool:**

- npm version
- Build status
- License
- Platform compatibility

**Development Tool:**

- npm version
- Build status
- License
- PRs Welcome
- Community metrics

### Visual Elements Beyond Badges

1. **Logo/Branding**
   - SVG preferred (scales well)
   - Reasonable file size (<50KB)
   - Accessible alt text

2. **Screenshots/Demos**
   - GIF for interactive demos (<3MB)
   - Static images for UI showcases
   - Optimize for loading speed

3. **Architecture Diagrams**
   - Mermaid diagrams (GitHub renders natively)
   - SVG exports from design tools
   - Keep high-level in README

**Jest Example:**

```markdown
# 🃏 Delightful JavaScript Testing

[Branded hero image]

[![npm version](https://badge.fury.io/js/jest.svg)]
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)]
[![CI](https://github.com/jestjs/jest/workflows/Node.js%20CI/badge.svg)]
```

---

## Code Example Formatting

### Syntax Highlighting

**Best Practice:** Always specify language identifier for fenced code blocks.

**Basic Syntax:**

````markdown
```javascript
const greeting = 'Hello, world!';
console.log(greeting);
```
````

### Supported Languages

**GitHub uses Linguist** for syntax highlighting, supporting 500+ languages.

**Common Language Identifiers:**

| Language   | Identifier(s)         |
| ---------- | --------------------- |
| JavaScript | `javascript`, `js`    |
| TypeScript | `typescript`, `ts`    |
| Python     | `python`, `py`        |
| Bash/Shell | `bash`, `sh`, `shell` |
| JSON       | `json`                |
| YAML       | `yaml`, `yml`         |
| Markdown   | `markdown`, `md`      |
| HTML       | `html`                |
| CSS        | `css`                 |
| JSX        | `jsx`                 |
| TSX        | `tsx`                 |
| Go         | `go`                  |
| Rust       | `rust`                |
| Java       | `java`                |
| C#         | `csharp`, `cs`        |
| PHP        | `php`                 |
| Ruby       | `ruby`, `rb`          |
| SQL        | `sql`                 |

### Code Block Best Practices

1. **Blank Lines**

````markdown
Some text before code.

```javascript
const code = 'here';
```
````

More text after code.

````

2. **Comment Context**
```javascript
// ❌ Bad: Generic comments
function doStuff() {
  // do the thing
  return true;
}

// ✅ Good: Explanatory comments
function validateUser(user) {
  // Check if user has required permissions for admin panel
  return user.roles.includes('admin');
}
````

3. **Highlight Important Lines** (GitHub supports this)

````markdown
```javascript {3-5}
function example() {
  const a = 1;
  // These lines will be highlighted
  const b = 2;
  const c = 3;
  return a + b + c;
}
```
````

### Before/After Examples

**Prettier Pattern:**

````markdown
**Input:**

```javascript
function f() {
  return 'long line that should wrap'.repeat(10);
}
```
````

**Output:**

```javascript
function f() {
  return 'long line that should wrap'.repeat(10);
}
```

`````

### Multi-File Examples

**Pattern for Complex Scenarios:**

````markdown
```javascript
// src/index.js
export { createServer } from './server.js';
`````

```javascript
// src/server.js
export function createServer(options) {
  // implementation
}
```

````

### Inline Code

**When to Use Backticks:**
- Function names: `createServer()`
- Variable names: `options.port`
- File paths: `package.json`
- Short commands: `npm install`
- API endpoints: `/api/users`

**Avoid:**
- Inline syntax highlighting (not supported in GitHub markdown)
- Backticks for emphasis (use **bold** or *italic*)

### Code Block Accessibility

1. **Provide Context**
```markdown
Here's how to initialize the client:

```javascript
const client = new Client({ apiKey: 'your-key' });
```
```

2. **Describe Complex Code**
```markdown
The following example demonstrates error handling with retry logic:

```javascript
// [code here]
```
```

---

## Table of Contents Navigation

### When to Include TOC

**Include TOC if:**
- README >300 lines
- 5+ major sections
- Complex documentation structure
- Multiple audience types (users vs contributors)

**Skip TOC if:**
- README <200 lines
- Simple, linear structure
- Quick start only

### TOC Patterns from Top Packages

**React:** No TOC (README delegates to external docs)
**TypeScript:** No TOC (minimal README)
**Next.js:** Simple anchor links to 5 sections
**ESLint:** No TOC (moderate length)

**Pattern:** Large projects with comprehensive READMEs use TOC; projects with minimal READMEs skip it.

### Manual vs Automated TOC

**Manual TOC:**
```markdown
## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [API](#api)
- [Contributing](#contributing)
```

**Automated Tools:**

1. **markdown-toc** (Most popular)
```bash
npm install -g markdown-toc
markdown-toc -i README.md
```

2. **DocToc** (Git-aware)
```bash
npm install -g doctoc
doctoc README.md
```

3. **GitHub Actions** (CI/CD integration)
```yaml
- uses: technote-space/toc-generator@v4
```

### GitHub Native TOC

**GitHub automatically generates sidebar TOC:**
- Appears on desktop view (right side)
- Based on heading structure
- No manual setup required
- Does not appear in raw markdown

**Best Practice:** GitHub's sidebar TOC may be sufficient for many projects. Use embedded TOC for:
- Mobile users
- Documentation exports
- NPM package page

### TOC Best Practices

1. **Flat Structure Preferred**
```markdown
## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Contributing](#contributing)

❌ Avoid deep nesting:
- Section 1
  - Subsection 1.1
    - Subsubsection 1.1.1
```

2. **Anchor Link Format**
   - Lowercase
   - Hyphens for spaces
   - Remove special characters
   - Example: `## API Reference` → `#api-reference`

3. **Position**
   - After hero section and badges
   - Before installation
   - Can include "Back to top" links in long documents

---

## API Documentation

### README vs Dedicated API Docs

**In README:**
- High-level API overview
- Most common methods (top 3-5)
- Simple examples
- Link to full API reference

**In External Docs:**
- Complete API reference
- All methods, properties, types
- Advanced usage patterns
- Edge cases

### API Documentation Patterns

**1. Inline Examples (Small APIs)**

```markdown
### API

#### `createClient(options)`

Creates a new client instance.

**Parameters:**
- `options.apiKey` (string, required): Your API key
- `options.baseURL` (string, optional): API base URL

**Returns:** `Client` instance

**Example:**
```javascript
const client = createClient({
  apiKey: 'your-key',
  baseURL: 'https://api.example.com'
});
```
```

**2. Table Format (Multiple Methods)**

```markdown
| Method | Description | Example |
|--------|-------------|---------|
| `init(config)` | Initialize the library | `lib.init({ key: 'value' })` |
| `get(id)` | Fetch item by ID | `await lib.get('123')` |
| `create(data)` | Create new item | `await lib.create({ name: 'test' })` |
```

**3. Hub Model (Large APIs)**

```markdown
## API Reference

For complete API documentation, visit [docs.package.com/api](https://docs.package.com/api).

### Quick Reference

- [Client Methods](https://docs.package.com/api/client)
- [Configuration Options](https://docs.package.com/api/config)
- [Event Handlers](https://docs.package.com/api/events)
- [TypeScript Types](https://docs.package.com/api/types)
```

### TypeScript-Specific Considerations

**Include Type Signatures:**
```typescript
function createServer(options: ServerOptions): Server;

interface ServerOptions {
  port?: number;
  host?: string;
  middleware?: Middleware[];
}
```

**Link to Type Definitions:**
```markdown
Full TypeScript definitions are available in the
[type declarations](./dist/index.d.ts).
```

### Auto-Generated API Docs

**Tools:**

1. **TypeDoc** (TypeScript)
```bash
npm install -g typedoc
typedoc --out docs src/index.ts
```

2. **JSDoc** (JavaScript)
```bash
npm install -g jsdoc
jsdoc src -r -d docs
```

3. **documentation.js**
```bash
npm install -g documentation
documentation build src/** -f html -o docs
```

**Best Practice:** Auto-generate comprehensive docs, link from README.

---

## Contributing Guidelines

### README vs CONTRIBUTING.md

**In README:**
- Short paragraph inviting contributions
- Link to CONTRIBUTING.md
- Link to Code of Conduct
- Link to "Good First Issues"

**In CONTRIBUTING.md:**
- Development setup
- Code style guide
- Testing requirements
- PR process
- Commit message format
- Architecture decisions

### Contributing Section Template

```markdown
## Contributing

We welcome contributions! Here's how to get started:

1. **Report Bugs:** [Open an issue](https://github.com/user/repo/issues/new?template=bug_report.md)
2. **Suggest Features:** [Feature request](https://github.com/user/repo/issues/new?template=feature_request.md)
3. **Submit PRs:** Read our [Contributing Guide](CONTRIBUTING.md)
4. **First Time?** Check out [Good First Issues](https://github.com/user/repo/labels/good%20first%20issue)

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.
```

### Best Practices from Top Packages

**React:**
```markdown
### Contributing

The main purpose of this repository is to continue evolving React core.
We want to make contributing to this project as easy and transparent as
possible, and we are grateful to the community for contributing bug fixes
and improvements. Read our [Contributing Guide](CONTRIBUTING.md) to learn
about our development process.

**Good First Issues** – great for new contributors.
```

**ESLint:**
- Separate sections for different contribution types
- Bug reports
- New rule proposals
- Rule changes
- New feature requests
- Each links to specific issue templates

**Key Pattern:** Make contributing actionable with clear next steps and links.

---

## License Information

### License Section Best Practices

**Minimal Approach:**
```markdown
## License

MIT © [Your Name or Organization]
```

**Standard Approach:**
```markdown
## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
```

**Detailed Approach:**
```markdown
## License

Copyright (c) 2025 Your Organization

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...

[Full license text or link to LICENSE file]
```

### Common Open Source Licenses

| License | Use Case | Badge |
|---------|----------|-------|
| MIT | Permissive, commercial-friendly | `[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)]` |
| Apache 2.0 | Permissive with patent grant | `[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)]` |
| GPL 3.0 | Copyleft, derivative works must be GPL | `[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)]` |
| BSD 3-Clause | Permissive, simple | `[![License](https://img.shields.io/badge/License-BSD_3--Clause-blue.svg)]` |
| ISC | Very permissive, simple | `[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)]` |

### License Position

**Pattern from Top Packages:**
- Always near the end of README
- After Contributing section
- Before or after Sponsors/Acknowledgments
- Can be combined with copyright notice

**package.json License Field:**
```json
{
  "license": "MIT"
}
```

---

## Accessibility Best Practices

### Image Alt Text

**Best Practices:**

1. **Descriptive Alt Text**
```markdown
❌ Bad:
![logo](logo.png)

✅ Good:
![Wundr.io logo - stylized W with gradient](logo.png)
```

2. **Screenshot Alt Text**
```markdown
✅ Include "screenshot of":
![Screenshot of the dashboard showing three metrics cards](dashboard.png)
```

3. **Decorative Images**
```markdown
✅ Empty alt for decorative images:
![](decorative-separator.png)
```

4. **Alt Text Guidelines:**
   - Be succinct (think tweet-length)
   - Include any image text
   - Don't say "image of" or "photo of" (screen readers announce this)
   - DO say "screenshot of" when applicable

### Link Text

**Avoid Ambiguous Links:**

```markdown
❌ Bad:
For more information, click [here](https://docs.example.com).

✅ Good:
Read the [complete API documentation](https://docs.example.com).
```

**Context for Links:**
```markdown
❌ Bad:
[Read more](link1) [Read more](link2) [Read more](link3)

✅ Good:
[Read the installation guide](link1)
[Read the API reference](link2)
[Read the migration guide](link3)
```

### List Formatting

**Use Proper Markdown Lists:**

```markdown
❌ Bad (not recognized by screen readers):
🔹 Feature one
🔹 Feature two
🔹 Feature three

✅ Good:
- Feature one
- Feature two
- Feature three
```

**Ordered Lists:**
```markdown
1. First step
2. Second step
3. Third step
```

### Heading Hierarchy

**Proper Heading Structure:**

```markdown
✅ Good:
# Main Title (H1)
## Section (H2)
### Subsection (H3)
#### Detail (H4)

❌ Bad:
# Main Title
#### Subsection (skips H2, H3)
```

**Best Practices:**
- Only one H1 (package name)
- Don't skip heading levels
- Use headings for structure, not styling
- Screen readers navigate by headings

### Color Contrast

**Badge Accessibility:**
- Ensure sufficient contrast (WCAG AA: 4.5:1 for normal text)
- Test badge colors with contrast checker
- Avoid color as only means of conveying information

### Tables

**Accessible Table Structure:**

```markdown
| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
```

**Best Practices:**
- Always include header row
- Keep tables simple
- Use tables for tabular data only (not layout)
- Consider alternative formats for complex data

---

## SEO Optimization

### GitHub Search Ranking Factors

**Primary Factors:**

1. **Repository Name**
   - Include core keywords
   - Example: `react-hooks-form` vs `rhf`

2. **Description**
   - Appears in search results
   - 50-80 characters optimal
   - Include primary keywords

3. **README Content**
   - Headers with keywords
   - First paragraph is crucial
   - Natural keyword usage

4. **Topics/Tags**
   - Add 5-10 relevant topics
   - Use standard topic names
   - Examples: `javascript`, `typescript`, `react`, `cli`

### README SEO Best Practices

**1. Keyword Placement**

```markdown
# package-name

> Primary keyword-rich description

## What is package-name?

package-name is a [primary keyword] library that helps developers
[main use case with keywords].

### Key Features
- [Feature with keyword]
- [Feature with keyword]
```

**2. Header Optimization**

```markdown
✅ Good:
## Installation
## Getting Started with package-name
## API Reference

❌ Bad:
## Install It
## Let's Go!
## The Goods
```

**3. First Paragraph**

```markdown
✅ Good (keyword-rich, clear purpose):
React Hook Form is a performant, flexible form library for React
applications. It minimizes re-renders and provides simple validation
with React Hooks.

❌ Bad (vague, no keywords):
This is a cool library that makes things easier. You should try it!
```

### External Discoverability

**npm Package Page:**
- `package.json` description field
- Keywords array
- Homepage URL

```json
{
  "name": "@wundr/package-name",
  "description": "Keyword-rich description for npm search",
  "keywords": [
    "react",
    "hooks",
    "forms",
    "validation"
  ],
  "homepage": "https://github.com/wundr/package-name#readme"
}
```

**GitHub About Section:**
- Set description (shown in search)
- Add topics/tags
- Set website URL

### Structured Data

**GitHub automatically extracts:**
- Package name
- Description
- Language
- Stars/forks
- Topics

**Optimize by:**
- Clear package.json metadata
- Comprehensive README
- Appropriate topics
- Active maintenance

### Content Quality Signals

**Factors that improve ranking:**
- Regular updates
- Stars and forks
- Active issues/PRs
- Documentation completeness
- Code quality
- Tests and CI

---

## Links and Cross-References

### Internal Links (Within Repository)

**File Links:**
```markdown
See [Contributing Guidelines](CONTRIBUTING.md) for details.
See [License](LICENSE) for terms.
```

**Anchor Links:**
```markdown
Jump to [Installation](#installation) section.
```

**Directory Links:**
```markdown
Check out [examples](./examples) folder.
```

### External Links

**Documentation:**
```markdown
Visit the [official documentation](https://docs.package.com) for complete guides.
```

**Best Practices:**
- Use HTTPS URLs
- Link to stable documentation versions
- Avoid broken links (check periodically)
- Use descriptive link text

### Link Formatting Patterns

**1. Inline Links**
```markdown
Read the [API documentation](https://api.docs.com) for details.
```

**2. Reference Links**
```markdown
Read the [API documentation][api-docs] for details.

[api-docs]: https://api.docs.com
```

**3. Auto-Links**
```markdown
https://github.com/user/repo (GitHub auto-links)
user/repo#123 (issue reference)
@username (user mention)
```

### Link Organization

**Hub Pattern:**
```markdown
## Resources

### Documentation
- [Getting Started](https://docs.package.com/start)
- [API Reference](https://docs.package.com/api)
- [Examples](https://docs.package.com/examples)

### Community
- [GitHub Discussions](https://github.com/user/repo/discussions)
- [Discord Server](https://discord.gg/invite)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/package-name)

### Related Projects
- [package-extension](https://github.com/user/extension)
- [package-cli](https://github.com/user/cli)
```

---

## Common Pitfalls to Avoid

### 1. Information Overload

**Problem:** Trying to document everything in README

❌ **Bad:**
- 1000+ line README
- Complete API reference inline
- Every edge case documented

✅ **Good:**
- Concise README (<500 lines ideal)
- Link to comprehensive external docs
- Focus on getting started

### 2. Outdated Information

**Problem:** README doesn't match current version

**Prevention:**
- Update README with every major change
- Include version number in examples if syntax changed
- Use automated tools to test code examples
- CI checks for broken links

### 3. Missing Quick Start

**Problem:** Jumping straight to complex examples

❌ **Bad:**
```markdown
## Usage

Here's a complete enterprise configuration with advanced features...
[100 lines of complex code]
```

✅ **Good:**
```markdown
## Quick Start

```javascript
import lib from 'lib';
lib.doThing(); // That's it!
```

For advanced usage, see [documentation](link).
```

### 4. Poor Code Examples

**Common Issues:**
- Incomplete code (missing imports)
- Doesn't actually run
- Too complex for example
- No explanation of what it does

✅ **Good Example Pattern:**
```markdown
Install the package:
```bash
npm install package-name
```

Create a simple example:
```javascript
// example.js
const Package = require('package-name');

const instance = new Package();
console.log(instance.greet('World')); // Output: Hello, World!
```

Run it:
```bash
node example.js
```
```

### 5. Badge Overload

❌ **Bad:** 15+ badges cluttering the top

✅ **Good:** 3-7 essential badges (version, license, build, downloads)

### 6. No Visual Hierarchy

**Problem:** Wall of text

✅ **Solution:**
- Use headings appropriately
- Break up long paragraphs
- Use lists for scannable content
- Add code examples
- Consider images/diagrams for complex concepts

### 7. Unclear License

**Problem:** No license or unclear terms

✅ **Solution:**
- Always include LICENSE file
- Reference license in README
- Include license badge
- Match package.json license field

### 8. Ignoring Mobile Users

**Problem:** Assumes desktop viewing

**Considerations:**
- Long lines in code blocks
- Large images
- Horizontal scrolling tables
- Complex navigation

✅ **Solution:**
- Keep code lines <80 characters when possible
- Optimize images
- Use responsive tables or alternative formats
- Simple navigation structure

### 9. Broken Links

**Problem:** Links to moved/deleted pages

**Prevention:**
- Periodic link checks (manual or automated)
- Link to stable documentation URLs
- Use relative links for internal files
- CI link checker

**Tools:**
```bash
# Check for broken links
npx markdown-link-check README.md
```

### 10. No Call-to-Action

**Problem:** Users read README but don't know next step

✅ **Good:**
```markdown
## Get Started

1. [Install the package](#installation)
2. [Follow the Quick Start guide](#quick-start)
3. [Join our Discord](link) for help
4. [Star this repo](link) if you find it useful!
```

---

## README Template

Below is a complete template incorporating all best practices:

```markdown
# Package Name

[![npm version](https://img.shields.io/npm/v/@wundr/package-name.svg?style=flat)](https://www.npmjs.com/package/@wundr/package-name)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/wundr/package-name/workflows/CI/badge.svg)](https://github.com/wundr/package-name/actions)
[![npm downloads](https://img.shields.io/npm/dm/@wundr/package-name.svg)](https://www.npmjs.com/package/@wundr/package-name)

> Concise one-line description focusing on value proposition

Brief 2-3 sentence overview explaining what the package does, why it exists, and what problems it solves.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Features](#features)
- [Documentation](#documentation)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Contributing](#contributing)
- [Community](#community)
- [License](#license)

## Installation

```bash
# npm
npm install @wundr/package-name

# yarn
yarn add @wundr/package-name

# pnpm
pnpm add @wundr/package-name
```

## Quick Start

```javascript
import { feature } from '@wundr/package-name';

// Simplest possible example
const result = feature('hello');
console.log(result); // Output: Hello, World!
```

## Features

- **Fast** - Built for performance with zero dependencies
- **Type-Safe** - Written in TypeScript with complete type definitions
- **Flexible** - Works with any framework or vanilla JavaScript
- **Well-Tested** - 100% test coverage with comprehensive test suite

## Documentation

Visit [docs.wundr.io/package-name](https://docs.wundr.io/package-name) for complete documentation.

### Key Resources

- [Getting Started Guide](https://docs.wundr.io/package-name/getting-started)
- [API Reference](https://docs.wundr.io/package-name/api)
- [Migration Guide](https://docs.wundr.io/package-name/migration)
- [Examples](https://docs.wundr.io/package-name/examples)

## API Reference

### `function(param)`

Brief description of what this function does.

**Parameters:**
- `param` (string, required): Description of parameter

**Returns:** `ReturnType` - Description of return value

**Example:**
```javascript
const result = function('value');
```

For complete API documentation, visit [API Reference](https://docs.wundr.io/package-name/api).

## Examples

### Basic Usage

```javascript
// Example demonstrating common use case
```

### Advanced Usage

```javascript
// Example demonstrating advanced feature
```

More examples in the [examples directory](./examples).

## Contributing

We welcome contributions! Here's how to get started:

1. **Report Bugs:** [Open an issue](https://github.com/wundr/package-name/issues/new?template=bug_report.md)
2. **Suggest Features:** [Feature request](https://github.com/wundr/package-name/issues/new?template=feature_request.md)
3. **Submit PRs:** Read our [Contributing Guide](CONTRIBUTING.md)
4. **First Time?** Check out [Good First Issues](https://github.com/wundr/package-name/labels/good%20first%20issue)

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## Community

- [GitHub Discussions](https://github.com/wundr/package-name/discussions) - Ask questions and discuss features
- [Discord](https://discord.gg/wundr) - Real-time chat with the community
- [Twitter](https://twitter.com/wundr) - Follow for updates

## License

MIT © [Wundr.io](https://wundr.io)

See [LICENSE](LICENSE) file for details.

---

Made with ❤️ by the [Wundr.io](https://wundr.io) team
```

---

## Quick Reference Checklist

Use this checklist when creating or reviewing READMEs:

### Essential Elements
- [ ] Clear package name and description
- [ ] 3-7 relevant badges
- [ ] Installation instructions (multiple package managers)
- [ ] Quick start example (runnable code)
- [ ] Key features (3-5 bullet points)
- [ ] Link to comprehensive documentation
- [ ] Contributing guidelines
- [ ] License information

### Quality Checks
- [ ] All links work
- [ ] Code examples are complete and runnable
- [ ] Syntax highlighting specified for code blocks
- [ ] Images have descriptive alt text
- [ ] Proper heading hierarchy (H1 → H2 → H3)
- [ ] No ambiguous link text ("click here")
- [ ] Lists use proper markdown syntax
- [ ] package.json metadata matches README

### SEO Optimization
- [ ] Keywords in title and description
- [ ] Meaningful headers (H2, H3)
- [ ] Topics/tags configured on GitHub
- [ ] package.json keywords array populated
- [ ] First paragraph includes primary keywords

### Accessibility
- [ ] Alt text for all images
- [ ] Descriptive link text
- [ ] Proper list formatting
- [ ] Logical heading structure
- [ ] Sufficient color contrast in badges

### Content Strategy
- [ ] README acts as hub (not encyclopedia)
- [ ] Links to external docs for details
- [ ] Progressive disclosure (simple → complex)
- [ ] Mobile-friendly (no excessive horizontal scroll)
- [ ] Call-to-action clear (what to do next)

---

## Conclusion

**Key Takeaways:**

1. **Keep it concise** - README is a hub, not comprehensive docs
2. **User-first approach** - Get users to "hello world" fast
3. **Visual hierarchy** - Use headings, lists, and code blocks effectively
4. **Accessibility matters** - Alt text, link text, proper structure
5. **Maintain quality** - Update regularly, check links, test examples
6. **Hub-and-spoke** - Link to comprehensive external documentation
7. **3-7 badges maximum** - Avoid badge overload
8. **SEO optimization** - Keywords in headers, description, first paragraph
9. **Progressive disclosure** - Simple examples first, link to advanced

**Final Recommendation:**

Start with the template provided, customize based on package type, and iterate based on user feedback. The best READMEs balance comprehensiveness with brevity, serving as effective onboarding tools while directing users to deeper resources.

---

**Research Sources:**
- React: https://github.com/facebook/react
- TypeScript: https://github.com/microsoft/TypeScript
- ESLint: https://github.com/eslint/eslint
- Jest: https://github.com/jestjs/jest
- Prettier: https://github.com/prettier/prettier
- Next.js: https://github.com/vercel/next.js

**Last Updated:** 2025-01-21
**Maintained by:** Wundr.io Team
````

import type * as Preset from '@docusaurus/preset-classic';
import type { Config } from '@docusaurus/types';
import { themes as prismThemes } from 'prism-react-renderer';

const config: Config = {
  title: 'Wundr Documentation',
  tagline: 'The Intelligent CLI-Based Coding Agents Orchestrator',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://docs.wundr.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  organizationName: 'adapticai',
  projectName: 'wundr',

  onBrokenLinks: 'ignore',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
    localeConfigs: {
      en: {
        htmlLang: 'en-US',
      },
    },
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
          editUrl:
            'https://github.com/adapticai/wundr/tree/main/packages/@wundr/docs/',
          showLastUpdateAuthor: false,
          showLastUpdateTime: false,
          includeCurrentVersion: true,
          versions: {
            current: {
              label: 'v2.0.0',
              path: '/',
            },
          },
        },
        blog: {
          showReadingTime: true,
          editUrl:
            'https://github.com/adapticai/wundr/tree/main/packages/@wundr/docs/',
          blogSidebarTitle: 'All posts',
          blogSidebarCount: 'ALL',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'api',
        path: 'api',
        routeBasePath: 'api',
        sidebarPath: './sidebars-api.ts',
        editUrl:
          'https://github.com/adapticai/wundr/tree/main/packages/@wundr/docs/',
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'guides',
        path: 'guides',
        routeBasePath: 'guides',
        sidebarPath: './sidebars-guides.ts',
        editUrl:
          'https://github.com/adapticai/wundr/tree/main/packages/@wundr/docs/',
      },
    ],
    '@docusaurus/plugin-ideal-image',
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        language: ['en', 'es', 'fr', 'de'],
        indexDocs: true,
        indexBlog: true,
        indexPages: true,
        docsRouteBasePath: '/',
        docsDir: 'docs',
        blogRouteBasePath: '/blog',
        blogDir: 'blog',
        highlightSearchTermsOnTargetPage: true,
        searchResultLimits: 8,
        searchResultContextMaxLength: 50,
      },
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/wundr-social-card.jpg',
    navbar: {
      title: 'Wundr',
      logo: {
        alt: 'Wundr Logo',
        src: 'img/wundr-logo-light.svg',
        srcDark: 'img/wundr-logo-dark.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          to: '/api',
          label: 'API Reference',
          position: 'left',
        },
        {
          to: '/guides',
          label: 'Guides',
          position: 'left',
        },
        {
          to: '/playground',
          label: 'Playground',
          position: 'left',
        },
        {
          to: '/blog',
          label: 'Blog',
          position: 'left',
        },
        {
          type: 'localeDropdown',
          position: 'right',
        },
        {
          href: 'https://github.com/adapticai/wundr',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Introduction',
              to: '/intro',
            },
            {
              label: 'Getting Started',
              to: '/getting-started/installation',
            },
            {
              label: 'User Guides',
              to: '/guides',
            },
            {
              label: 'API Reference',
              to: '/api',
            },
            {
              label: 'Features',
              to: '/features/overview',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub Discussions',
              href: 'https://github.com/adapticai/wundr/discussions',
            },
            {
              label: 'Discord',
              href: 'https://discord.gg/wundr',
            },
            {
              label: 'Twitter',
              href: 'https://twitter.com/wundr_io',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Blog',
              to: '/blog',
            },
            {
              label: 'FAQ',
              to: '/faq',
            },
            {
              label: 'Troubleshooting',
              to: '/troubleshooting/common-issues',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/adapticai/wundr',
            },
            {
              label: 'License',
              href: 'https://github.com/adapticai/wundr/blob/main/LICENSE',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Wundr, by Adaptic.ai. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['typescript', 'bash', 'yaml', 'json'],
    },
    // Algolia configuration (disabled in favor of local search)
    // algolia: {
    //   appId: 'YOUR_APP_ID',
    //   apiKey: 'YOUR_SEARCH_API_KEY',
    //   indexName: 'wundr',
    //   contextualSearch: true,
    //   searchParameters: {},
    //   searchPagePath: 'search',
    // },
    announcementBar: {
      id: 'wundr-v2',
      content:
        '⭐️ If you like Wundr, give it a star on <a target="_blank" rel="noopener noreferrer" href="https://github.com/adapticai/wundr">GitHub</a> ⭐️',
      backgroundColor: '#fafbfc',
      textColor: '#091E42',
      isCloseable: false,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;

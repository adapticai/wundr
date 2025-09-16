import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebarApi: SidebarsConfig = {
  apiSidebar: [
    'overview',
    {
      type: 'category',
      label: 'Core APIs',
      items: [
        'analysis',
        'batches',
        'config',
        'files',
        'reports',
      ],
    },
    {
      type: 'category',
      label: 'Resources',
      items: [
        {
          type: 'link',
          label: 'OpenAPI Specification',
          href: '/api/openapi.json',
        },
        {
          type: 'link',
          label: 'Postman Collection',
          href: 'https://documenter.getpostman.com/view/wundr-api',
        },
        {
          type: 'link',
          label: 'API Status',
          href: 'https://status.wundr.io',
        },
      ],
    },
  ],
};

export default sidebarApi;
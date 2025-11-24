import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Workspace',
  description: 'Manage your Genesis organization',
};

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className='flex min-h-screen'>
      {/* Sidebar */}
      <aside className='fixed inset-y-0 left-0 z-50 hidden w-64 border-r bg-card lg:block'>
        <div className='flex h-full flex-col'>
          {/* Logo */}
          <div className='flex h-16 items-center gap-2 border-b px-6'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground'>
              G
            </div>
            <span className='font-semibold'>Genesis</span>
          </div>

          {/* Navigation */}
          <nav className='flex-1 space-y-1 p-4'>
            <NavItem href='/dashboard' icon='D' label='Dashboard' />
            <NavItem href='/organizations' icon='O' label='Organizations' />
            <NavItem href='/agents' icon='A' label='Agents' />
            <NavItem href='/workflows' icon='W' label='Workflows' />
            <NavItem href='/deployments' icon='P' label='Deployments' />
            <NavItem href='/settings' icon='S' label='Settings' />
          </nav>

          {/* User Section */}
          <div className='border-t p-4'>
            <div className='flex items-center gap-3 rounded-lg p-2 hover:bg-accent'>
              <div className='flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium'>
                U
              </div>
              <div className='flex-1 truncate'>
                <p className='text-sm font-medium'>User Name</p>
                <p className='truncate text-xs text-muted-foreground'>
                  user@example.com
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className='fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-4 lg:hidden'>
        <div className='flex items-center gap-2'>
          <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground'>
            G
          </div>
          <span className='font-semibold'>Genesis</span>
        </div>
        <button
          type='button'
          className='rounded-lg p-2 hover:bg-accent'
          aria-label='Open menu'
        >
          <MenuIcon />
        </button>
      </header>

      {/* Main Content */}
      <main className='flex-1 lg:pl-64'>
        <div className='min-h-screen pt-16 lg:pt-0'>
          <div className='container mx-auto p-6'>{children}</div>
        </div>
      </main>
    </div>
  );
}

function NavItem({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <a
      href={href}
      className='flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
    >
      <span className='flex h-6 w-6 items-center justify-center rounded bg-muted text-xs'>
        {icon}
      </span>
      {label}
    </a>
  );
}

function MenuIcon() {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width='24'
      height='24'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <line x1='4' x2='20' y1='12' y2='12' />
      <line x1='4' x2='20' y1='6' y2='6' />
      <line x1='4' x2='20' y1='18' y2='18' />
    </svg>
  );
}

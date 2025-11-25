import { Logo } from '@/components/ui/Logo';

export default function HomePage() {
  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-muted'>
      <div className='container flex flex-col items-center justify-center gap-12 px-4 py-16'>
        {/* Hero Section */}
        <header className='flex flex-col items-center gap-4 text-center'>
          <div className='flex items-center gap-3'>
            <Logo />
            <h1 className='text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl'>
              Neolith
            </h1>
          </div>
          <p className='max-w-2xl text-lg text-muted-foreground sm:text-xl'>
            Build and manage AI-powered organizations. Create custom agent
            hierarchies, workflows, and governance structures with ease.
          </p>
        </header>

        {/* CTA Buttons */}
        <div className='flex flex-col gap-4 sm:flex-row'>
          <a
            href='/auth/signin'
            className='inline-flex items-center justify-center rounded-lg bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          >
            Get Started
          </a>
          <a
            href='/docs'
            className='inline-flex items-center justify-center rounded-lg border border-input bg-background px-8 py-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          >
            Documentation
          </a>
        </div>

        {/* Features Grid */}
        <section className='grid w-full max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3'>
          <FeatureCard
            title='Agent Hierarchies'
            description='Design complex organizational structures with VPs, disciplines, and specialized agents.'
            icon='hierarchy'
          />
          <FeatureCard
            title='Workflow Automation'
            description='Create automated workflows that orchestrate agent collaboration and task execution.'
            icon='workflow'
          />
          <FeatureCard
            title='Governance'
            description='Implement robust governance policies and approval workflows for your AI organization.'
            icon='governance'
          />
          <FeatureCard
            title='Real-time Monitoring'
            description='Monitor agent performance, task progress, and system health in real-time.'
            icon='monitoring'
          />
          <FeatureCard
            title='Version Control'
            description='Track changes to your organization structure with full version history and rollback.'
            icon='version'
          />
          <FeatureCard
            title='Integrations'
            description='Connect with Slack, GitHub, and other tools your team already uses.'
            icon='integrations'
          />
        </section>

        {/* Footer */}
        <footer className='mt-8 text-center text-sm text-muted-foreground'>
          <p>Built by Wundr. Powered by AI.</p>
        </footer>
      </div>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  const icons: Record<string, string> = {
    hierarchy: 'H',
    workflow: 'W',
    governance: 'G',
    monitoring: 'M',
    version: 'V',
    integrations: 'I',
  };

  return (
    <div className='group rounded-xl border bg-card p-6 shadow-sm transition-all hover:shadow-md'>
      <div className='mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-lg font-semibold text-primary'>
        {icons[icon] || '?'}
      </div>
      <h3 className='mb-2 text-lg font-semibold'>{title}</h3>
      <p className='text-sm text-muted-foreground'>{description}</p>
    </div>
  );
}

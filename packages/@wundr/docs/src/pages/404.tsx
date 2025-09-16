import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';

export default function NotFound(): React.JSX.Element {
  return (
    <Layout title="Page Not Found">
      <main className="container margin-vert--xl">
        <div className="row">
          <div className="col col--6 col--offset-3">
            <div className="text--center">
              <h1 className="hero__title">404 - Page Not Found</h1>
              <p className="hero__subtitle">
                The page you are looking for doesn't exist.
              </p>

              <div className="margin-vert--lg">
                <h2>Popular Pages</h2>
                <ul className="text--left">
                  <li><Link to="/intro">Introduction to Wundr</Link></li>
                  <li><Link to="/getting-started/installation">Installation Guide</Link></li>
                  <li><Link to="/getting-started/quick-start">Quick Start</Link></li>
                  <li><Link to="/api">API Reference</Link></li>
                  <li><Link to="/guides">User Guides</Link></li>
                  <li><Link to="/faq">Frequently Asked Questions</Link></li>
                </ul>
              </div>

              <div className="margin-vert--lg">
                <Link
                  className="button button--primary button--lg"
                  to="/">
                  Take me home
                </Link>
              </div>

              <div className="margin-vert--lg">
                <p>
                  Can't find what you're looking for? Try searching or{' '}
                  <a href="https://github.com/adapticai/wundr/issues/new">
                    report an issue
                  </a>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
}
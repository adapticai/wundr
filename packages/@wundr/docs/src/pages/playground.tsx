import React from 'react';
import Layout from '@theme/Layout';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Playground from '../components/Playground';

export default function PlaygroundPage(): JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  
  return (
    <Layout
      title="Interactive Playground"
      description="Try Wundr's analysis capabilities with your own code or explore our examples"
    >
      <div className="container margin-vert--lg">
        <Playground />
      </div>
    </Layout>
  );
}
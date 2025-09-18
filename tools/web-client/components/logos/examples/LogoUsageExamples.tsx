import React from 'react';
import { WundrLogoFull } from '../WundrLogoFull';

/**
 * Practical usage examples of the Wundr logo lockup system
 * These examples demonstrate real-world implementation patterns
 */

// Header/Navigation Example
export const HeaderExample: React.FC = () => (
  <header className='bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700'>
    <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
      <div className='flex justify-between items-center h-16'>
        <WundrLogoFull
          orientation='horizontal'
          size='sm'
          showTagline={false}
          showAttribution={false}
        />
        <nav className='flex items-center space-x-4'>
          <a
            href='/docs'
            className='text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white text-sm'
          >
            Documentation
          </a>
          <a
            href='/github'
            className='text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white text-sm'
          >
            GitHub
          </a>
        </nav>
      </div>
    </div>
  </header>
);

// Hero Section Example
export const HeroExample: React.FC = () => (
  <section className='bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-24'>
    <div className='max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8'>
      <WundrLogoFull
        orientation='vertical'
        size='xl'
        showTagline={true}
        showAttribution={true}
        className='mb-8'
      />
      <div className='mt-8 max-w-2xl mx-auto'>
        <p className='text-xl text-gray-600 dark:text-gray-400 leading-relaxed'>
          Start analyzing and refactoring your monorepo today with intelligent
          tooling designed for modern development teams.
        </p>
        <div className='mt-8 flex justify-center'>
          <button className='bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium'>
            Get Started
          </button>
        </div>
      </div>
    </div>
  </section>
);

// Footer Example
export const FooterExample: React.FC = () => (
  <footer className='bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700'>
    <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12'>
      <div className='text-center'>
        <WundrLogoFull
          orientation='vertical'
          size='md'
          showTagline={true}
          showAttribution={true}
          className='mb-8'
        />
        <div className='grid grid-cols-1 md:grid-cols-3 gap-8 mt-8'>
          <div>
            <h3 className='text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider'>
              Product
            </h3>
            <ul className='mt-4 space-y-2'>
              <li>
                <button
                  type='button'
                  className='text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm text-left'
                >
                  Features
                </button>
              </li>
              <li>
                <button
                  type='button'
                  className='text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm text-left'
                >
                  Pricing
                </button>
              </li>
              <li>
                <button
                  type='button'
                  className='text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm text-left'
                >
                  Changelog
                </button>
              </li>
            </ul>
          </div>
          <div>
            <h3 className='text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider'>
              Resources
            </h3>
            <ul className='mt-4 space-y-2'>
              <li>
                <button
                  type='button'
                  className='text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm text-left'
                >
                  Documentation
                </button>
              </li>
              <li>
                <button
                  type='button'
                  className='text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm text-left'
                >
                  API Reference
                </button>
              </li>
              <li>
                <button
                  type='button'
                  className='text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm text-left'
                >
                  Examples
                </button>
              </li>
            </ul>
          </div>
          <div>
            <h3 className='text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider'>
              Support
            </h3>
            <ul className='mt-4 space-y-2'>
              <li>
                <button
                  type='button'
                  className='text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm text-left'
                >
                  Help Center
                </button>
              </li>
              <li>
                <button
                  type='button'
                  className='text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm text-left'
                >
                  Community
                </button>
              </li>
              <li>
                <button
                  type='button'
                  className='text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm text-left'
                >
                  Contact
                </button>
              </li>
            </ul>
          </div>
        </div>
        <div className='mt-8 pt-8 border-t border-gray-200 dark:border-gray-700'>
          <p className='text-gray-500 dark:text-gray-400 text-sm'>
            © 2024 Wundr, by Adaptic.ai. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  </footer>
);

// Card/Panel Example
export const CardExample: React.FC = () => (
  <div className='bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6 max-w-md'>
    <WundrLogoFull
      orientation='horizontal'
      size='md'
      showTagline={true}
      showAttribution={false}
      className='mb-4'
    />
    <div className='space-y-3'>
      <p className='text-gray-600 dark:text-gray-400 text-sm'>
        Advanced monorepo tooling with intelligent code analysis, automated
        refactoring, and comprehensive project insights.
      </p>
      <div className='flex items-center justify-between'>
        <span className='text-2xl font-bold text-gray-900 dark:text-white'>
          Free
        </span>
        <button className='bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium'>
          Try Now
        </button>
      </div>
    </div>
  </div>
);

// Sidebar Example
export const SidebarExample: React.FC = () => (
  <aside className='bg-white dark:bg-gray-800 w-64 h-screen border-r border-gray-200 dark:border-gray-700 p-4'>
    <div className='mb-8'>
      <WundrLogoFull
        orientation='horizontal'
        size='sm'
        showTagline={false}
        showAttribution={false}
      />
    </div>
    <nav className='space-y-2'>
      <button
        type='button'
        className='flex items-center px-2 py-2 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left'
      >
        Dashboard
      </button>
      <button
        type='button'
        className='flex items-center px-2 py-2 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left'
      >
        Analysis
      </button>
      <button
        type='button'
        className='flex items-center px-2 py-2 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left'
      >
        Refactoring
      </button>
      <button
        type='button'
        className='flex items-center px-2 py-2 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left'
      >
        Settings
      </button>
    </nav>
  </aside>
);

// Modal/Dialog Example
export const ModalExample: React.FC = () => (
  <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4'>
    <div className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6'>
      <div className='text-center mb-6'>
        <WundrLogoFull
          orientation='vertical'
          size='lg'
          showTagline={false}
          showAttribution={true}
          className='mb-4'
        />
        <h2 className='text-xl font-semibold text-gray-900 dark:text-white'>
          Welcome to Wundr
        </h2>
        <p className='text-gray-600 dark:text-gray-400 mt-2'>
          Transform your development workflow with intelligent monorepo tooling.
        </p>
      </div>
      <div className='flex space-x-3'>
        <button className='flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded font-medium'>
          Get Started
        </button>
        <button className='flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-2 px-4 rounded font-medium hover:bg-gray-50 dark:hover:bg-gray-700'>
          Learn More
        </button>
      </div>
    </div>
  </div>
);

// Loading/Splash Example
export const SplashExample: React.FC = () => (
  <div className='fixed inset-0 bg-white dark:bg-gray-900 flex items-center justify-center'>
    <div className='text-center'>
      <WundrLogoFull
        orientation='vertical'
        size='xl'
        showTagline={true}
        showAttribution={true}
        className='animate-pulse'
      />
      <div className='mt-8'>
        <div className='w-32 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto overflow-hidden'>
          <div className='w-full h-full bg-blue-600 rounded-full animate-pulse'></div>
        </div>
        <p className='text-gray-600 dark:text-gray-400 text-sm mt-2'>
          Loading your workspace...
        </p>
      </div>
    </div>
  </div>
);

// All examples wrapped in a showcase component
export const AllExamples: React.FC = () => (
  <div className='space-y-16 p-8'>
    <section>
      <h2 className='text-2xl font-bold mb-6'>Header Navigation</h2>
      <HeaderExample />
    </section>

    <section>
      <h2 className='text-2xl font-bold mb-6'>Hero Section</h2>
      <HeroExample />
    </section>

    <section>
      <h2 className='text-2xl font-bold mb-6'>Product Card</h2>
      <div className='flex justify-center'>
        <CardExample />
      </div>
    </section>

    <section>
      <h2 className='text-2xl font-bold mb-6'>Sidebar Navigation</h2>
      <div className='h-64 overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg'>
        <SidebarExample />
      </div>
    </section>

    <section>
      <h2 className='text-2xl font-bold mb-6'>Footer</h2>
      <FooterExample />
    </section>
  </div>
);

export default AllExamples;

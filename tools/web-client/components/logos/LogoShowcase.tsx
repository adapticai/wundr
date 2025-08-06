import React from 'react';
import { WundrLogoFull } from './WundrLogoFull';

interface LogoShowcaseProps {
  className?: string;
}

export const LogoShowcase: React.FC<LogoShowcaseProps> = ({ className = '' }) => {
  return (
    <div className={`space-y-12 p-8 ${className}`}>
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Wundr Logo Lockup Variations</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Complete logo lockup system with tagline and attribution
        </p>
      </div>

      {/* Horizontal Layouts */}
      <section className="space-y-8">
        <h2 className="text-2xl font-semibold border-b pb-2">Horizontal Layouts</h2>
        
        {/* Size Variations */}
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Small (sm)</h3>
            <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg">
              <WundrLogoFull 
                orientation="horizontal" 
                size="sm" 
                showTagline={true} 
                showAttribution={true}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Medium (md) - Default</h3>
            <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg">
              <WundrLogoFull 
                orientation="horizontal" 
                size="md" 
                showTagline={true} 
                showAttribution={true}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Large (lg)</h3>
            <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg">
              <WundrLogoFull 
                orientation="horizontal" 
                size="lg" 
                showTagline={true} 
                showAttribution={true}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Extra Large (xl)</h3>
            <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg">
              <WundrLogoFull 
                orientation="horizontal" 
                size="xl" 
                showTagline={true} 
                showAttribution={true}
              />
            </div>
          </div>
        </div>

        {/* Content Variations */}
        <div className="space-y-6">
          <h3 className="text-lg font-medium">Content Variations</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">Logo + Wordmark Only</h4>
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <WundrLogoFull 
                  orientation="horizontal" 
                  size="md" 
                  showTagline={false} 
                  showAttribution={false}
                />
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">With Tagline Only</h4>
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <WundrLogoFull 
                  orientation="horizontal" 
                  size="md" 
                  showTagline={true} 
                  showAttribution={false}
                />
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">With Attribution Only</h4>
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <WundrLogoFull 
                  orientation="horizontal" 
                  size="md" 
                  showTagline={false} 
                  showAttribution={true}
                />
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">Complete Lockup</h4>
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <WundrLogoFull 
                  orientation="horizontal" 
                  size="md" 
                  showTagline={true} 
                  showAttribution={true}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Vertical Layouts */}
      <section className="space-y-8">
        <h2 className="text-2xl font-semibold border-b pb-2">Vertical Layouts</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Small (sm)</h3>
            <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg flex justify-center">
              <WundrLogoFull 
                orientation="vertical" 
                size="sm" 
                showTagline={true} 
                showAttribution={true}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Medium (md)</h3>
            <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg flex justify-center">
              <WundrLogoFull 
                orientation="vertical" 
                size="md" 
                showTagline={true} 
                showAttribution={true}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Large (lg)</h3>
            <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg flex justify-center">
              <WundrLogoFull 
                orientation="vertical" 
                size="lg" 
                showTagline={true} 
                showAttribution={true}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Extra Large (xl)</h3>
            <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg flex justify-center">
              <WundrLogoFull 
                orientation="vertical" 
                size="xl" 
                showTagline={true} 
                showAttribution={true}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Theme Variations */}
      <section className="space-y-8">
        <h2 className="text-2xl font-semibold border-b pb-2">Theme Variations</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Light Theme</h3>
            <div className="bg-white border p-6 rounded-lg">
              <WundrLogoFull 
                orientation="horizontal" 
                size="md" 
                theme="light"
                showTagline={true} 
                showAttribution={true}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Dark Theme</h3>
            <div className="bg-gray-900 p-6 rounded-lg">
              <WundrLogoFull 
                orientation="horizontal" 
                size="md" 
                theme="dark"
                showTagline={true} 
                showAttribution={true}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Auto Theme</h3>
            <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg">
              <WundrLogoFull 
                orientation="horizontal" 
                size="md" 
                theme="auto"
                showTagline={true} 
                showAttribution={true}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Usage Examples */}
      <section className="space-y-8">
        <h2 className="text-2xl font-semibold border-b pb-2">Usage Examples</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Header/Navigation</h3>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center justify-between p-4">
                <WundrLogoFull 
                  orientation="horizontal" 
                  size="sm" 
                  showTagline={false} 
                  showAttribution={false}
                />
                <div className="flex items-center space-x-4">
                  <button className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                    Docs
                  </button>
                  <button className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                    GitHub
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Footer</h3>
            <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="p-6 text-center">
                <WundrLogoFull 
                  orientation="vertical" 
                  size="md" 
                  showTagline={true} 
                  showAttribution={true}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Hero Section</h3>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="p-8 text-center">
                <WundrLogoFull 
                  orientation="vertical" 
                  size="xl" 
                  showTagline={true} 
                  showAttribution={true}
                  className="mb-6"
                />
                <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                  Get started with Wundr today and transform your monorepo development experience.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Card/Panel</h3>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
              <div className="p-6">
                <WundrLogoFull 
                  orientation="horizontal" 
                  size="md" 
                  showTagline={true} 
                  showAttribution={false}
                  className="mb-4"
                />
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Advanced code analysis and refactoring tools for modern development teams.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LogoShowcase;
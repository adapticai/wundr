import React from 'react';
import { useLocation, useHistory } from '@docusaurus/router';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { SUPPORTED_LOCALES, getLocaleFromPath, stripLocaleFromPath, getLocalizedPath } from '../utils/i18n';

interface LanguageSwitcherProps {
  className?: string;
  showLabel?: boolean;
}

/**
 * Enhanced Language Switcher Component
 * 
 * Provides language switching functionality with:
 * - Automatic locale detection from URL
 * - Proper URL transformation for each language
 * - Visual indicators for current language
 * - Mobile-responsive design
 */
export default function LanguageSwitcher({ className, showLabel = false }: LanguageSwitcherProps): JSX.Element {
  const location = useLocation();
  const history = useHistory();
  const { i18n } = useDocusaurusContext();
  
  const currentLocale = i18n.currentLocale;
  const currentPath = stripLocaleFromPath(location.pathname);
  
  const handleLanguageChange = (newLocale: string) => {
    if (newLocale === currentLocale) return;
    
    const newPath = getLocalizedPath(currentPath, newLocale);
    history.push(newPath + location.search + location.hash);
  };

  const getLanguageEmoji = (locale: string): string => {
    const emojiMap: Record<string, string> = {
      en: '🇺🇸',
      es: '🇪🇸',
      fr: '🇫🇷',
      de: '🇩🇪',
    };
    return emojiMap[locale] || '🌐';
  };

  return (
    <div className={`language-switcher ${className || ''}`}>
      {showLabel && (
        <span className="language-switcher__label">
          Language:
        </span>
      )}
      
      <div className="language-switcher__dropdown">
        <button
          className="language-switcher__current"
          title={`Current language: ${SUPPORTED_LOCALES[currentLocale as keyof typeof SUPPORTED_LOCALES]}`}
        >
          <span className="language-switcher__emoji">
            {getLanguageEmoji(currentLocale)}
          </span>
          <span className="language-switcher__name">
            {SUPPORTED_LOCALES[currentLocale as keyof typeof SUPPORTED_LOCALES]}
          </span>
          <span className="language-switcher__arrow">▼</span>
        </button>
        
        <div className="language-switcher__menu">
          {Object.entries(SUPPORTED_LOCALES).map(([locale, name]) => (
            <button
              key={locale}
              className={`language-switcher__option ${
                locale === currentLocale ? 'language-switcher__option--current' : ''
              }`}
              onClick={() => handleLanguageChange(locale)}
              title={`Switch to ${name}`}
            >
              <span className="language-switcher__emoji">
                {getLanguageEmoji(locale)}
              </span>
              <span className="language-switcher__name">
                {name}
              </span>
              {locale === currentLocale && (
                <span className="language-switcher__check">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>
      
      <style jsx>{`
        .language-switcher {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .language-switcher__label {
          font-size: 14px;
          color: var(--ifm-color-emphasis-700);
          font-weight: 500;
        }
        
        .language-switcher__dropdown {
          position: relative;
        }
        
        .language-switcher__current {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: var(--ifm-background-color);
          border: 1px solid var(--ifm-color-emphasis-300);
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          color: var(--ifm-font-color-base);
          transition: all 0.2s ease;
          min-width: 120px;
        }
        
        .language-switcher__current:hover {
          border-color: var(--ifm-color-primary);
          background: var(--ifm-color-emphasis-100);
        }
        
        .language-switcher__dropdown:hover .language-switcher__menu {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }
        
        .language-switcher__emoji {
          font-size: 16px;
          line-height: 1;
        }
        
        .language-switcher__name {
          flex: 1;
          text-align: left;
        }
        
        .language-switcher__arrow {
          font-size: 10px;
          transition: transform 0.2s ease;
        }
        
        .language-switcher__dropdown:hover .language-switcher__arrow {
          transform: rotate(180deg);
        }
        
        .language-switcher__menu {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: var(--ifm-background-color);
          border: 1px solid var(--ifm-color-emphasis-300);
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          opacity: 0;
          visibility: hidden;
          transform: translateY(-8px);
          transition: all 0.2s ease;
          z-index: 1000;
          margin-top: 4px;
          overflow: hidden;
        }
        
        .language-switcher__option {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px 12px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 14px;
          color: var(--ifm-font-color-base);
          transition: background-color 0.2s ease;
          text-align: left;
        }
        
        .language-switcher__option:hover {
          background: var(--ifm-color-emphasis-100);
        }
        
        .language-switcher__option--current {
          background: var(--ifm-color-primary-lightest);
          color: var(--ifm-color-primary-darkest);
        }
        
        .language-switcher__option--current:hover {
          background: var(--ifm-color-primary-lighter);
        }
        
        .language-switcher__check {
          margin-left: auto;
          color: var(--ifm-color-primary);
          font-weight: bold;
        }
        
        @media (max-width: 768px) {
          .language-switcher__current {
            min-width: 100px;
            padding: 8px 10px;
          }
          
          .language-switcher__name {
            display: none;
          }
          
          .language-switcher__menu {
            left: auto;
            right: 0;
            min-width: 150px;
          }
        }
        
        /* Dark mode support */
        [data-theme='dark'] .language-switcher__current {
          background: var(--ifm-background-surface-color);
        }
        
        [data-theme='dark'] .language-switcher__menu {
          background: var(--ifm-background-surface-color);
        }
      `}</style>
    </div>
  );
}
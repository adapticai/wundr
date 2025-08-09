import React, { useEffect, useState } from 'react';
import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';

interface SearchMetrics {
  totalSearches: number;
  popularQueries: Array<{ query: string; count: number; results: number }>;
  noResultQueries: Array<{ query: string; count: number }>;
  averageResultsPerQuery: number;
  searchesByLanguage: Record<string, number>;
}

interface SearchAnalyticsProps {
  className?: string;
}

/**
 * Search Analytics Component for Wundr Documentation
 * 
 * Tracks and displays search metrics including:
 * - Popular search queries
 * - Queries with no results
 * - Search volume by language
 * - Average results per query
 */
export default function SearchAnalytics({ className }: SearchAnalyticsProps): JSX.Element | null {
  const [metrics, setMetrics] = useState<SearchMetrics>({
    totalSearches: 0,
    popularQueries: [],
    noResultQueries: [],
    averageResultsPerQuery: 0,
    searchesByLanguage: {},
  });

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!ExecutionEnvironment.canUseDOM) {
      return;
    }

    // Load search metrics from localStorage
    loadSearchMetrics();

    // Listen for search events
    const handleSearchEvent = (event: CustomEvent) => {
      const { query, results, language } = event.detail;
      updateSearchMetrics(query, results, language);
    };

    // Custom event listener for search tracking
    document.addEventListener('wundr-search', handleSearchEvent as EventListener);

    return () => {
      document.removeEventListener('wundr-search', handleSearchEvent as EventListener);
    };
  }, []);

  const loadSearchMetrics = () => {
    try {
      const stored = localStorage.getItem('wundr-search-metrics');
      if (stored) {
        setMetrics(JSON.parse(stored));
      }
    } catch (error) {
      console.warn('Failed to load search metrics:', error);
    }
  };

  const updateSearchMetrics = (query: string, resultCount: number, language: string) => {
    setMetrics(prevMetrics => {
      const newMetrics = { ...prevMetrics };
      
      // Update total searches
      newMetrics.totalSearches += 1;
      
      // Update popular queries
      const existingQuery = newMetrics.popularQueries.find(q => q.query === query);
      if (existingQuery) {
        existingQuery.count += 1;
        existingQuery.results = Math.max(existingQuery.results, resultCount);
      } else {
        newMetrics.popularQueries.push({ query, count: 1, results: resultCount });
      }
      
      // Sort and limit popular queries
      newMetrics.popularQueries.sort((a, b) => b.count - a.count);
      newMetrics.popularQueries = newMetrics.popularQueries.slice(0, 10);
      
      // Track no-result queries
      if (resultCount === 0) {
        const existingNoResult = newMetrics.noResultQueries.find(q => q.query === query);
        if (existingNoResult) {
          existingNoResult.count += 1;
        } else {
          newMetrics.noResultQueries.push({ query, count: 1 });
        }
        newMetrics.noResultQueries.sort((a, b) => b.count - a.count);
        newMetrics.noResultQueries = newMetrics.noResultQueries.slice(0, 5);
      }
      
      // Update language stats
      newMetrics.searchesByLanguage[language] = (newMetrics.searchesByLanguage[language] || 0) + 1;
      
      // Calculate average results
      const totalResults = newMetrics.popularQueries.reduce((sum, q) => sum + (q.results * q.count), 0);
      newMetrics.averageResultsPerQuery = totalResults / newMetrics.totalSearches;
      
      // Save to localStorage
      try {
        localStorage.setItem('wundr-search-metrics', JSON.stringify(newMetrics));
      } catch (error) {
        console.warn('Failed to save search metrics:', error);
      }
      
      return newMetrics;
    });
  };

  const clearMetrics = () => {
    setMetrics({
      totalSearches: 0,
      popularQueries: [],
      noResultQueries: [],
      averageResultsPerQuery: 0,
      searchesByLanguage: {},
    });
    localStorage.removeItem('wundr-search-metrics');
  };

  if (!ExecutionEnvironment.canUseDOM || metrics.totalSearches === 0) {
    return null;
  }

  return (
    <div className={`search-analytics ${className || ''}`}>
      <div className="search-analytics__toggle">
        <button
          onClick={() => setIsVisible(!isVisible)}
          className="search-analytics__toggle-button"
          title="Toggle Search Analytics"
        >
          📊 Search Analytics ({metrics.totalSearches})
        </button>
      </div>
      
      {isVisible && (
        <div className="search-analytics__panel">
          <div className="search-analytics__header">
            <h3>Search Analytics</h3>
            <button onClick={clearMetrics} className="search-analytics__clear-button">
              Clear Data
            </button>
          </div>
          
          <div className="search-analytics__stats">
            <div className="stat">
              <span className="stat__label">Total Searches:</span>
              <span className="stat__value">{metrics.totalSearches}</span>
            </div>
            <div className="stat">
              <span className="stat__label">Average Results:</span>
              <span className="stat__value">{metrics.averageResultsPerQuery.toFixed(1)}</span>
            </div>
          </div>
          
          {metrics.popularQueries.length > 0 && (
            <div className="search-analytics__section">
              <h4>Popular Queries</h4>
              <ul className="search-analytics__list">
                {metrics.popularQueries.map((item, index) => (
                  <li key={index} className="search-analytics__list-item">
                    <span className="query">"{item.query}"</span>
                    <span className="count">×{item.count}</span>
                    <span className="results">({item.results} results)</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {metrics.noResultQueries.length > 0 && (
            <div className="search-analytics__section">
              <h4>Queries with No Results</h4>
              <ul className="search-analytics__list">
                {metrics.noResultQueries.map((item, index) => (
                  <li key={index} className="search-analytics__list-item">
                    <span className="query">"{item.query}"</span>
                    <span className="count">×{item.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {Object.keys(metrics.searchesByLanguage).length > 0 && (
            <div className="search-analytics__section">
              <h4>Searches by Language</h4>
              <ul className="search-analytics__list">
                {Object.entries(metrics.searchesByLanguage)
                  .sort(([,a], [,b]) => b - a)
                  .map(([language, count]) => (
                    <li key={language} className="search-analytics__list-item">
                      <span className="query">{language.toUpperCase()}</span>
                      <span className="count">{count} searches</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}
      
      <style jsx>{`
        .search-analytics {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 1000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .search-analytics__toggle-button {
          background: var(--ifm-color-primary);
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          transition: all 0.2s ease;
        }
        
        .search-analytics__toggle-button:hover {
          background: var(--ifm-color-primary-dark);
          transform: translateY(-1px);
        }
        
        .search-analytics__panel {
          position: absolute;
          bottom: 100%;
          right: 0;
          width: 350px;
          max-height: 400px;
          background: var(--ifm-background-color);
          border: 1px solid var(--ifm-color-emphasis-200);
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          overflow: auto;
          margin-bottom: 8px;
        }
        
        .search-analytics__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid var(--ifm-color-emphasis-200);
        }
        
        .search-analytics__header h3 {
          margin: 0;
          font-size: 18px;
          color: var(--ifm-font-color-base);
        }
        
        .search-analytics__clear-button {
          background: var(--ifm-color-danger);
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }
        
        .search-analytics__stats {
          padding: 16px;
          display: flex;
          gap: 20px;
        }
        
        .stat {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .stat__label {
          font-size: 12px;
          color: var(--ifm-color-emphasis-600);
          text-transform: uppercase;
          font-weight: 600;
        }
        
        .stat__value {
          font-size: 20px;
          font-weight: bold;
          color: var(--ifm-color-primary);
        }
        
        .search-analytics__section {
          padding: 16px;
          border-top: 1px solid var(--ifm-color-emphasis-100);
        }
        
        .search-analytics__section h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
          color: var(--ifm-font-color-base);
          font-weight: 600;
        }
        
        .search-analytics__list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .search-analytics__list-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 0;
          font-size: 13px;
        }
        
        .search-analytics__list-item .query {
          color: var(--ifm-font-color-base);
          font-weight: 500;
          flex: 1;
          margin-right: 8px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .search-analytics__list-item .count {
          color: var(--ifm-color-primary);
          font-weight: 600;
          margin-right: 8px;
        }
        
        .search-analytics__list-item .results {
          color: var(--ifm-color-emphasis-600);
          font-size: 11px;
        }
        
        @media (max-width: 768px) {
          .search-analytics {
            position: relative;
            bottom: auto;
            right: auto;
            margin: 20px;
          }
          
          .search-analytics__panel {
            position: static;
            width: 100%;
            margin-bottom: 0;
          }
        }
      `}</style>
    </div>
  );
}
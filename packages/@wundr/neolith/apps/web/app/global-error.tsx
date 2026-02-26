'use client';

/**
 * Global Error Boundary
 *
 * Minimal error handler for Next.js App Router.
 * Renders outside the normal component tree so must use inline styles only.
 * Uses an anchor tag instead of button+onClick to avoid
 * React hooks during static generation prerendering.
 */

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang='en'>
      <body
        style={{
          backgroundColor: '#1c1917',
          color: '#e7e5e4',
          fontFamily: 'system-ui, sans-serif',
          margin: 0,
          padding: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{ textAlign: 'center', padding: '2rem', maxWidth: '420px' }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239,68,68,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
            }}
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              width='28'
              height='28'
              viewBox='0 0 24 24'
              fill='none'
              stroke='#ef4444'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <circle cx='12' cy='12' r='10' />
              <line x1='12' x2='12' y1='8' y2='12' />
              <line x1='12' x2='12.01' y1='16' y2='16' />
            </svg>
          </div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              marginBottom: '0.75rem',
              color: '#f5f5f4',
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              color: '#a8a29e',
              marginBottom: '2rem',
              lineHeight: '1.6',
            }}
          >
            An unexpected error occurred. You can try again or return to the
            home page.
          </p>
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'center',
            }}
          >
            <button
              type='button'
              onClick={reset}
              style={{
                display: 'inline-block',
                backgroundColor: '#292524',
                color: '#e7e5e4',
                padding: '0.625rem 1.25rem',
                border: '1px solid #44403c',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              Try again
            </button>
            <a
              href='/'
              style={{
                display: 'inline-block',
                backgroundColor: '#e7e5e4',
                color: '#1c1917',
                padding: '0.625rem 1.25rem',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}

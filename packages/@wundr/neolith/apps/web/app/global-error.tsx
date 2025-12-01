'use client';

/**
 * Global Error Boundary
 *
 * Minimal error handler for Next.js App Router.
 * Uses an anchor tag instead of button+onClick to avoid
 * React hooks during static generation prerendering.
 */

export default function GlobalError() {
  return (
    <html lang='en'>
      <body
        style={{
          backgroundColor: '#1c1917',
          color: '#fff',
          fontFamily: 'system-ui, sans-serif',
          margin: 0,
          padding: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#9ca3af', marginBottom: '2rem' }}>
            An unexpected error occurred.
          </p>
          <a
            href='/'
            style={{
              display: 'inline-block',
              backgroundColor: '#f59e0b',
              color: '#000',
              padding: '0.75rem 1.5rem',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Go home
          </a>
        </div>
      </body>
    </html>
  );
}

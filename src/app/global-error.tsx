'use client';

/**
 * The last boundary, for a failure in the root layout itself.
 *
 * It replaces the whole document, so the theme, the fonts and every component
 * are gone by definition — anything imported here could be the thing that
 * broke. Plain elements and inline styles on purpose, and it should never be
 * seen: `error.tsx` catches everything that happens inside a page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '2rem',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          backgroundColor: '#FBF9F6',
          color: '#1F1E1C',
        }}
      >
        <main style={{ maxWidth: 480, textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.25rem', margin: '0 0 0.75rem' }}>
            The console could not start
          </h1>
          <p style={{ margin: '0 0 1.5rem', lineHeight: 1.5, color: '#6B6862' }}>
            Something failed before any of the interface could load. Nothing in the archive has been
            changed. Reloading is usually enough; if it is not, the console will need looking at.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              font: 'inherit',
              padding: '0.5rem 1rem',
              borderRadius: 6,
              border: '1px solid #2F6F63',
              backgroundColor: '#2F6F63',
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            Reload the console
          </button>
          {error.digest === undefined ? null : (
            <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#6B6862' }}>
              Reference {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}

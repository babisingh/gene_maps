'use client';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f0726 0%, #0a1628 100%)',
        color: 'white',
        fontFamily: 'monospace',
        gap: '1rem',
      }}
    >
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#FF8CA8' }}>
        Something went wrong
      </h2>
      <button
        onClick={reset}
        style={{
          padding: '0.5rem 1.25rem',
          background: 'rgba(255,140,168,0.15)',
          border: '1px solid rgba(255,140,168,0.3)',
          borderRadius: '0.5rem',
          color: '#FF8CA8',
          cursor: 'pointer',
          fontSize: '0.875rem',
        }}
      >
        Try again
      </button>
    </div>
  );
}

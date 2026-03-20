export const dynamic = 'force-dynamic';

export default function NotFound() {
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
      <h1 style={{ fontSize: '4rem', fontWeight: 700, margin: 0, color: '#FF8CA8' }}>404</h1>
      <p style={{ color: 'rgba(255,255,255,0.5)', margin: 0 }}>Page not found</p>
      <a
        href="/"
        style={{
          marginTop: '0.5rem',
          color: '#FF8CA8',
          textDecoration: 'none',
          fontSize: '0.875rem',
        }}
      >
        ← Return to Gene-Maps
      </a>
    </div>
  );
}

import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-6xl font-bold gm-text mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-white mb-2">Page Not Found</h2>
      <p className="text-white/50 mb-8 max-w-md">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="px-6 py-3 rounded-xl font-medium text-white transition"
        style={{ background: 'linear-gradient(135deg, #FF8CA8, #a855f7)' }}
      >
        Return Home
      </Link>
    </div>
  );
}

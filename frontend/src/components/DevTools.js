'use client';

import dynamic from 'next/dynamic';

// Only loaded in development — the dynamic import is tree-shaken out of
// production builds so the devDependency is never resolved at build time.
const AgentationOverlay =
  process.env.NODE_ENV === 'development'
    ? dynamic(
        () => import('agentation').then((mod) => ({ default: mod.Agentation })),
        { ssr: false }
      )
    : () => null;

export default function DevTools() {
  return <AgentationOverlay />;
}

'use client';

import dynamic from 'next/dynamic';

// The Agentation feedback overlay is a dev-only tool. It loads in development
// EXCEPT when NEXT_PUBLIC_CLEAN_UI=true (e.g. when sharing a tunnel URL with a
// client). The dynamic import is tree-shaken out of production builds, so the
// devDependency is never resolved at build time.
const showAgentation =
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_CLEAN_UI !== 'true';

const AgentationOverlay = showAgentation
  ? dynamic(
      () => import('agentation').then((mod) => ({ default: mod.Agentation })),
      { ssr: false }
    )
  : () => null;

export default function DevTools() {
  return <AgentationOverlay />;
}

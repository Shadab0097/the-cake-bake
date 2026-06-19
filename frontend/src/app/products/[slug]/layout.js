// Server component layout for /products/[slug].
//
// The product detail page itself is a client component, so it cannot export
// `generateMetadata`. This server layout fills that gap: it fetches the product
// on the server and turns the admin-managed `seo` fields (title, description,
// keywords) — with sensible fallbacks — into real <head> metadata for SEO and
// social sharing. It renders its children unchanged.

const FALLBACK_DESCRIPTION = 'Freshly baked and delivered with love by The Cake Bake.';

// The browser talks to NEXT_PUBLIC_API_URL, which in this project is often a
// RELATIVE path ('/api/v1') that gets proxied to the backend. Server-side fetch
// needs an absolute origin, so resolve one here.
function getServerApiBase() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
  if (/^https?:\/\//i.test(apiUrl)) return apiUrl.replace(/\/+$/, '');
  const origin = (process.env.BACKEND_PROXY_ORIGIN || 'http://localhost:5000').replace(/\/+$/, '');
  const path = apiUrl.startsWith('/') ? apiUrl : `/${apiUrl}`;
  return `${origin}${path}`.replace(/\/+$/, '');
}

async function fetchProduct(slug) {
  try {
    const res = await fetch(`${getServerApiBase()}/products/${encodeURIComponent(slug)}`, {
      // Mirror the backend's own 2-minute cache for the public product endpoint.
      next: { revalidate: 120 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data || null;
  } catch {
    // Network/backend errors must not break rendering — fall back to defaults.
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const product = await fetchProduct(slug);

  if (!product) {
    return {
      title: 'Cakes',
      description: FALLBACK_DESCRIPTION,
    };
  }

  const seo = product.seo || {};
  const name = product.name || 'Cake';
  const description =
    seo.description ||
    product.shortDescription ||
    (product.description ? String(product.description).slice(0, 160) : '') ||
    FALLBACK_DESCRIPTION;

  // If the admin set an explicit SEO title, treat it as authoritative (no site
  // template). Otherwise fall back to the product name + the root title template.
  const title = seo.title ? { absolute: seo.title } : name;
  const ogTitle = seo.title || name;

  const keywords = seo.keywords
    ? seo.keywords.split(',').map((k) => k.trim()).filter(Boolean)
    : undefined;

  const imageUrl = Array.isArray(product.images) && product.images[0]?.url
    ? product.images[0].url
    : undefined;
  const imageAlt = (Array.isArray(product.images) && product.images[0]?.alt) || name;

  const canonical = `/products/${product.slug || slug}`;

  return {
    title,
    description,
    ...(keywords && keywords.length ? { keywords } : {}),
    alternates: { canonical },
    openGraph: {
      title: ogTitle,
      description,
      type: 'website',
      url: canonical,
      siteName: 'The Cake Bake',
      ...(imageUrl ? { images: [{ url: imageUrl, alt: imageAlt }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  };
}

export default function ProductDetailLayout({ children }) {
  return children;
}

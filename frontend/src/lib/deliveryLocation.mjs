// Persists the customer's chosen delivery location in a cookie (not HttpOnly)
// so it survives reloads, is readable on the client, and can be read by the
// server later for SSR personalization. Small payload, SameSite=Lax.

const COOKIE = 'cb_delivery';
const MAX_AGE = 60 * 60 * 24 * 180; // 180 days

export const loadDeliveryLocation = () => {
  if (typeof document === 'undefined') return null;
  try {
    const match = document.cookie
      .split('; ')
      .find((c) => c.startsWith(`${COOKIE}=`));
    if (!match) return null;
    const raw = decodeURIComponent(match.split('=').slice(1).join('='));
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const saveDeliveryLocation = (data) => {
  if (typeof document === 'undefined') return;
  try {
    const value = encodeURIComponent(JSON.stringify(data));
    document.cookie = `${COOKIE}=${value}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
  } catch {
    /* ignore cookie write errors */
  }
};

export const clearDeliveryLocation = () => {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE}=; path=/; max-age=0; SameSite=Lax`;
};

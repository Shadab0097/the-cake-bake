// Tiny sessionStorage "flash" message for the admin area. Lets one page set a
// one-time notification that the NEXT page (after a redirect) displays — used
// so admin login/logout can show a toast even though they navigate immediately.

const ADMIN_FLASH_KEY = 'admin_flash';

export const setAdminFlash = (message, type = 'success') => {
  if (typeof window === 'undefined' || !message) return;
  try {
    window.sessionStorage.setItem(ADMIN_FLASH_KEY, JSON.stringify({ message, type }));
  } catch {
    /* sessionStorage unavailable — non-critical */
  }
};

export const consumeAdminFlash = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(ADMIN_FLASH_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(ADMIN_FLASH_KEY);
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.message) return null;
    return { message: parsed.message, type: parsed.type || 'success' };
  } catch {
    return null;
  }
};

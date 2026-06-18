// In-memory access-token store.
//
// Access tokens live only in module memory — never in localStorage — so an XSS
// payload cannot read a persistent credential out of storage. The long-lived
// refresh token stays in an HttpOnly cookie; access tokens are re-minted from it
// via /auth/refresh (see api.js / adminApiClient.js) on page load and on 401.
//
// Customer and admin tokens are kept separate to mirror their separate refresh
// cookies (tcb_customer_refresh / tcb_admin_refresh).

let customerAccessToken = null;
let adminAccessToken = null;

export const getAccessToken = () => customerAccessToken;
export const setAccessToken = (token) => { customerAccessToken = token || null; };
export const clearAccessToken = () => { customerAccessToken = null; };

export const getAdminAccessToken = () => adminAccessToken;
export const setAdminAccessToken = (token) => { adminAccessToken = token || null; };
export const clearAdminAccessToken = () => { adminAccessToken = null; };

// One-time cleanup of tokens persisted by older builds that stored them in
// localStorage, so a stale credential does not linger after this upgrade.
if (typeof window !== 'undefined') {
  try {
    ['accessToken', 'refreshToken', 'adminAccessToken', 'adminRefreshToken']
      .forEach((key) => window.localStorage.removeItem(key));
  } catch {
    /* localStorage unavailable (private mode) — nothing to clean up */
  }
}

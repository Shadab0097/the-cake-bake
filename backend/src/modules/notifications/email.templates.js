'use strict';

/**
 * The Cake Bake — HTML Email Templates
 *
 * Each template exports:
 *   subject(data) → string
 *   html(data)    → full HTML string (inline CSS, no external dependencies)
 *
 * Prices are passed already formatted (in rupees as a string, e.g. "₹599.00").
 * The baseLayout() helper wraps every template in a consistent branded shell.
 */

// ── Brand tokens (keep in sync with your frontend theme) ─────────────────────
const BRAND = {
  primary: '#c8956c',       // warm caramel
  primaryDark: '#a3714d',
  accent: '#f5ede6',        // soft blush background
  dark: '#2c1a0e',          // deep espresso text
  muted: '#7a6255',         // secondary text
  border: '#e8d5c4',
  white: '#ffffff',
  logoText: 'The Cake Bake',
  siteUrl: process.env.APP_URL || 'http://localhost:3000',
  supportEmail: process.env.SMTP_FROM_EMAIL || 'support@thecakebake.in',
  instagram: 'https://instagram.com/thecakebake',
};

// ── Base layout wrapper ───────────────────────────────────────────────────────
const baseLayout = (title, content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.accent};font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.accent};padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${BRAND.white};border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND.primaryDark} 0%,${BRAND.primary} 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:${BRAND.white};font-size:28px;font-weight:700;letter-spacing:1px;">🎂 ${BRAND.logoText}</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;letter-spacing:2px;text-transform:uppercase;">Premium Cake Delivery</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:${BRAND.accent};padding:24px 40px;text-align:center;border-top:1px solid ${BRAND.border};">
              <p style="margin:0 0 8px;color:${BRAND.muted};font-size:13px;">
                Questions? Reply to this email or write to
                <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.primary};text-decoration:none;">${BRAND.supportEmail}</a>
              </p>
              <p style="margin:0;color:${BRAND.muted};font-size:12px;">
                © ${new Date().getFullYear()} ${BRAND.logoText}. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

// ── Reusable snippet builders ─────────────────────────────────────────────────

/** Big hero heading with optional subtitle */
const hero = (heading, sub = '') => `
  <h2 style="margin:0 0 ${sub ? '8px' : '24px'};color:${BRAND.dark};font-size:22px;font-weight:700;">${heading}</h2>
  ${sub ? `<p style="margin:0 0 24px;color:${BRAND.muted};font-size:15px;">${sub}</p>` : ''}
`;

/** Info row inside a card (label : value) */
const infoRow = (label, value) => `
  <tr>
    <td style="padding:8px 0;color:${BRAND.muted};font-size:14px;width:40%;vertical-align:top;">${label}</td>
    <td style="padding:8px 0;color:${BRAND.dark};font-size:14px;font-weight:600;vertical-align:top;">${value}</td>
  </tr>
`;

/** Styled info card */
const infoCard = (rows) => `
  <table width="100%" cellpadding="0" cellspacing="0"
    style="background:${BRAND.accent};border:1px solid ${BRAND.border};border-radius:10px;padding:16px 20px;margin-bottom:24px;">
    ${rows}
  </table>
`;

/** CTA button */
const ctaButton = (text, url) => `
  <div style="text-align:center;margin:28px 0;">
    <a href="${url}"
      style="display:inline-block;background:${BRAND.primary};color:${BRAND.white};text-decoration:none;
             padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.5px;">
      ${text}
    </a>
  </div>
`;

/** Status badge */
const badge = (text, color = BRAND.primary) => `
  <span style="display:inline-block;background:${color};color:#fff;padding:4px 14px;
               border-radius:20px;font-size:12px;font-weight:600;letter-spacing:0.5px;">
    ${text}
  </span>
`;

/** Divider */
const divider = () => `<hr style="border:none;border-top:1px solid ${BRAND.border};margin:24px 0;" />`;

// ── Format helpers ────────────────────────────────────────────────────────────
const fmt = (paise) => `₹${(Number(paise) / 100).toFixed(2)}`;

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_TEMPLATES = {

  // ── 1. Welcome ─────────────────────────────────────────────────────────────
  welcome: {
    subject: (d) => `Welcome to The Cake Bake, ${d.name}! 🎂`,
    html: (d) => baseLayout('Welcome to The Cake Bake', `
      ${hero(`Hi ${d.name}, welcome aboard! 🎉`, 'We\'re thrilled to have you in The Cake Bake family.')}
      <p style="color:${BRAND.muted};font-size:15px;line-height:1.7;margin:0 0 20px;">
        Explore our freshly baked cakes, custom creations, and exclusive flavours — delivered right to your door.
        Your first order is just a few clicks away.
      </p>
      ${ctaButton('Explore Our Cakes', BRAND.siteUrl)}
      ${divider()}
      <p style="color:${BRAND.muted};font-size:14px;margin:0;">
        As a member, you'll earn <strong style="color:${BRAND.primary};">loyalty points</strong> with every order,
        get exclusive discounts, and be first to know about seasonal specials. 🍰
      </p>
    `),
  },

  // ── 2. Order Confirmed ──────────────────────────────────────────────────────
  order_confirmed: {
    subject: (d) => `Order Confirmed! #${d.orderNumber} — The Cake Bake`,
    html: (d) => baseLayout(`Order #${d.orderNumber} Confirmed`, `
      ${hero(`Your order is confirmed! ${badge('Confirmed', '#2e7d32')}`, '')}
      <p style="color:${BRAND.muted};font-size:15px;margin:0 0 20px;">
        Hi <strong>${d.customerName}</strong>, thank you for your order. We've received it and will
        start preparing your delicious cake soon!
      </p>
      ${infoCard(`
        ${infoRow('Order Number', `#${d.orderNumber}`)}
        ${infoRow('Delivery Date', d.deliveryDate)}
        ${infoRow('Delivery Slot', d.deliverySlot || 'Standard')}
        ${infoRow('Items', `${d.itemCount} item${d.itemCount !== '1' ? 's' : ''}`)}
        ${infoRow('Payment Method', d.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Payment')}
        ${infoRow('Order Total', d.total)}
      `)}
      ${ctaButton('Track Your Order', `${BRAND.siteUrl}/account/orders`)}
      <p style="color:${BRAND.muted};font-size:13px;text-align:center;margin:0;">
        Need to make changes? Contact us as early as possible.
      </p>
    `),
  },

  // ── 3. Order Details (itemised breakdown) ───────────────────────────────────
  order_details: {
    subject: (d) => `Order Details — #${d.orderNumber} | The Cake Bake`,
    html: (d) => baseLayout(`Order Details #${d.orderNumber}`, `
      ${hero(`Order Summary — #${d.orderNumber}`)}
      ${infoCard(`
        ${infoRow('Items', d.items)}
        ${infoRow('Subtotal', d.subtotal)}
        ${infoRow('Delivery Charge', d.deliveryCharge)}
        ${d.discount && d.discount !== '₹0.00' ? infoRow('Discount', `<span style="color:#2e7d32;">-${d.discount}</span>`) : ''}
        ${infoRow('Total', `<strong style="font-size:16px;">${d.total}</strong>`)}
      `)}
      ${divider()}
      ${infoCard(`
        ${infoRow('Delivery Address', d.address)}
        ${infoRow('Delivery Date', d.deliveryDate)}
        ${infoRow('Time Slot', d.deliverySlot || 'Standard')}
      `)}
      ${ctaButton('View Order in App', `${BRAND.siteUrl}/account/orders`)}
    `),
  },

  // ── 4. Payment Success ──────────────────────────────────────────────────────
  payment_success: {
    subject: (d) => `Payment Confirmed — ₹${d.amount} for Order #${d.orderNumber}`,
    html: (d) => baseLayout('Payment Successful', `
      ${hero(`Payment received! ${badge('Paid', '#2e7d32')}`)}
      <p style="color:${BRAND.muted};font-size:15px;margin:0 0 20px;">
        Hi <strong>${d.customerName}</strong>, your payment has been confirmed. Your cake is now in the queue!
      </p>
      ${infoCard(`
        ${infoRow('Order Number', `#${d.orderNumber}`)}
        ${infoRow('Amount Paid', `₹${d.amount}`)}
        ${infoRow('Payment ID', d.paymentId)}
        ${infoRow('Method', d.method)}
      `)}
      ${ctaButton('Track Your Order', `${BRAND.siteUrl}/account/orders`)}
    `),
  },

  // ── 5. Payment Failed ───────────────────────────────────────────────────────
  payment_failed: {
    subject: (d) => `Payment Failed — Order #${d.orderNumber} | Action Required`,
    html: (d) => baseLayout('Payment Failed', `
      ${hero(`Payment unsuccessful ${badge('Failed', '#c62828')}`, 'Don\'t worry — your order is saved.')}
      <p style="color:${BRAND.muted};font-size:15px;margin:0 0 20px;">
        Hi <strong>${d.customerName}</strong>, your payment for order <strong>#${d.orderNumber}</strong>
        (₹${d.amount}) could not be processed. Please retry your payment to confirm your order.
      </p>
      ${ctaButton('Retry Payment', `${BRAND.siteUrl}/account/orders`)}
      <p style="color:${BRAND.muted};font-size:13px;text-align:center;margin:16px 0 0;">
        If you continue facing issues, please contact us at
        <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.primary};">${BRAND.supportEmail}</a>
      </p>
    `),
  },

  // ── 6. Order Preparing ──────────────────────────────────────────────────────
  order_preparing: {
    subject: (d) => `Your Cake is Being Prepared! — Order #${d.orderNumber}`,
    html: (d) => baseLayout('Order Preparing', `
      ${hero(`We're baking your cake! 👨‍🍳 ${badge('Preparing', '#e65100')}`)}
      <p style="color:${BRAND.muted};font-size:15px;margin:0 0 20px;">
        Hi <strong>${d.customerName}</strong>, our bakers have started working on your order <strong>#${d.orderNumber}</strong>.
        We'll keep you updated as it progresses.
      </p>
      ${ctaButton('Track Your Order', `${BRAND.siteUrl}/account/orders`)}
    `),
  },

  // ── 7. Order Packed ────────────────────────────────────────────────────────
  order_packed: {
    subject: (d) => `Order Packed & Ready — #${d.orderNumber} | The Cake Bake`,
    html: (d) => baseLayout('Order Packed', `
      ${hero(`Your order is packed! 📦 ${badge('Packed', '#1565c0')}`)}
      <p style="color:${BRAND.muted};font-size:15px;margin:0 0 20px;">
        Hi <strong>${d.customerName}</strong>, order <strong>#${d.orderNumber}</strong> has been carefully
        packed and will be handed to our delivery partner very soon.
      </p>
      ${ctaButton('Track Your Order', `${BRAND.siteUrl}/account/orders`)}
    `),
  },

  // ── 8. Order Dispatched ────────────────────────────────────────────────────
  order_dispatched: {
    subject: (d) => `Order Dispatched! — #${d.orderNumber} | The Cake Bake`,
    html: (d) => baseLayout('Order Dispatched', `
      ${hero(`Your cake is on its way! 🚗 ${badge('Dispatched', '#6a1b9a')}`)}
      <p style="color:${BRAND.muted};font-size:15px;margin:0 0 20px;">
        Hi <strong>${d.customerName}</strong>, order <strong>#${d.orderNumber}</strong> has been dispatched.
        Expected delivery slot: <strong>${d.deliverySlot || 'Today'}</strong>.
      </p>
      ${ctaButton('Track Your Order', `${BRAND.siteUrl}/account/orders`)}
    `),
  },

  // ── 9. Out for Delivery ────────────────────────────────────────────────────
  out_for_delivery: {
    subject: (d) => `Out for Delivery! — Order #${d.orderNumber}`,
    html: (d) => baseLayout('Out for Delivery', `
      ${hero(`Almost there! 🛵 ${badge('Out for Delivery', '#00838f')}`)}
      <p style="color:${BRAND.muted};font-size:15px;margin:0 0 20px;">
        Hi <strong>${d.customerName}</strong>, your order <strong>#${d.orderNumber}</strong> is out for delivery.
        Please be available at the delivery address. 🎉
      </p>
      ${ctaButton('Track Your Order', `${BRAND.siteUrl}/account/orders`)}
      <p style="color:${BRAND.muted};font-size:13px;text-align:center;margin:16px 0 0;">
        Please keep your phone handy — our delivery partner may call you.
      </p>
    `),
  },

  // ── 10. Order Delivered ────────────────────────────────────────────────────
  order_delivered: {
    subject: (d) => `Delivered! Hope You Love It 🎂 — Order #${d.orderNumber}`,
    html: (d) => baseLayout('Order Delivered', `
      ${hero(`Your cake has been delivered! 🎉 ${badge('Delivered', '#2e7d32')}`)}
      <p style="color:${BRAND.muted};font-size:15px;margin:0 0 20px;">
        Hi <strong>${d.customerName}</strong>, order <strong>#${d.orderNumber}</strong> has been delivered.
        We hope it made your celebration extra special! 💕
      </p>
      ${divider()}
      <p style="color:${BRAND.dark};font-size:15px;font-weight:600;margin:0 0 8px;">Enjoyed your order?</p>
      <p style="color:${BRAND.muted};font-size:14px;margin:0 0 16px;">
        Leave a review and help others discover our cakes. It takes just 30 seconds!
      </p>
      ${ctaButton('Write a Review', `${BRAND.siteUrl}/account/orders`)}
      <p style="color:${BRAND.muted};font-size:13px;text-align:center;margin:16px 0 0;">
        Thank you for choosing The Cake Bake. See you again soon! 🍰
      </p>
    `),
  },

  // ── 11. Order Cancelled ────────────────────────────────────────────────────
  order_cancelled: {
    subject: (d) => `Order Cancelled — #${d.orderNumber} | The Cake Bake`,
    html: (d) => baseLayout('Order Cancelled', `
      ${hero(`Order cancelled ${badge('Cancelled', '#c62828')}`)}
      <p style="color:${BRAND.muted};font-size:15px;margin:0 0 20px;">
        Hi <strong>${d.customerName}</strong>, your order <strong>#${d.orderNumber}</strong> has been cancelled.
        Reason: <em>${d.reason || 'As per request'}</em>.
      </p>
      ${d.refundNote ? `
        <p style="color:${BRAND.muted};font-size:14px;margin:0 0 20px;">
          ${d.refundNote}
        </p>
      ` : ''}
      ${ctaButton('Place a New Order', BRAND.siteUrl)}
      <p style="color:${BRAND.muted};font-size:13px;text-align:center;margin:16px 0 0;">
        If you didn't request this cancellation, please contact us immediately.
      </p>
    `),
  },

  // ── 12. Refund Initiated ───────────────────────────────────────────────────
  refund_initiated: {
    subject: (d) => `Refund Initiated — ₹${d.refundAmount} for Order #${d.orderNumber}`,
    html: (d) => baseLayout('Refund Initiated', `
      ${hero(`Refund initiated ${badge('Refund Initiated', '#1565c0')}`)}
      <p style="color:${BRAND.muted};font-size:15px;margin:0 0 20px;">
        Hi <strong>${d.customerName}</strong>, a refund of
        <strong style="color:${BRAND.primary};">₹${d.refundAmount}</strong>
        has been initiated for order <strong>#${d.orderNumber}</strong>.
      </p>
      ${infoCard(`
        ${infoRow('Refund Amount', `₹${d.refundAmount}`)}
        ${infoRow('Processing Time', '5–7 business days')}
        ${infoRow('Credited To', 'Original payment method')}
      `)}
      <p style="color:${BRAND.muted};font-size:13px;text-align:center;margin:0;">
        Refunds may take 5–7 business days depending on your bank.
      </p>
    `),
  },

  // ── 13. Password Reset ─────────────────────────────────────────────────────
  password_reset: {
    subject: () => `Reset Your Password — The Cake Bake`,
    html: (d) => baseLayout('Password Reset', `
      ${hero('Reset your password 🔐')}
      <p style="color:${BRAND.muted};font-size:15px;margin:0 0 20px;">
        Hi <strong>${d.name || 'there'}</strong>, we received a request to reset the password for your
        The Cake Bake account. Click the button below to create a new password.
      </p>
      ${ctaButton('Reset My Password', d.resetUrl)}
      <p style="color:${BRAND.muted};font-size:14px;margin:0 0 8px;">
        This link will expire in <strong>30 minutes</strong>.
      </p>
      ${divider()}
      <p style="color:${BRAND.muted};font-size:13px;margin:0;">
        If you didn't request a password reset, you can safely ignore this email.
        Your password will remain unchanged.
      </p>
    `),
  },

  // ── 14. Inquiry Received — Admin Alert ────────────────────────────────────
  inquiry_alert: {
    subject: (d) => `New ${d.inquiryType} Inquiry — The Cake Bake Admin`,
    html: (d) => baseLayout('New Inquiry Alert', `
      ${hero(`New ${d.inquiryType} Inquiry Received! ${badge('Admin Alert', '#6a1b9a')}`)}
      <p style="color:${BRAND.muted};font-size:15px;margin:0 0 20px;">
        A new inquiry has been submitted. Please review and respond promptly.
      </p>
      ${infoCard(`
        ${infoRow('Type', d.inquiryType)}
        ${infoRow('Customer Name', d.customerName || 'N/A')}
        ${infoRow('Email', d.customerEmail || 'N/A')}
        ${infoRow('Phone', d.customerPhone || 'N/A')}
        ${d.occasion ? infoRow('Occasion', d.occasion) : ''}
        ${d.budget ? infoRow('Budget', d.budget) : ''}
        ${d.companyName ? infoRow('Company', d.companyName) : ''}
        ${d.quantity ? infoRow('Quantity', d.quantity) : ''}
        ${infoRow('Submitted At', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))}
      `)}
      ${d.message ? `
        <div style="background:${BRAND.accent};border:1px solid ${BRAND.border};border-radius:10px;padding:16px 20px;margin-bottom:24px;">
          <p style="margin:0 0 6px;color:${BRAND.muted};font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Message / Requirements</p>
          <p style="margin:0;color:${BRAND.dark};font-size:14px;line-height:1.6;">${d.message}</p>
        </div>
      ` : ''}
      ${ctaButton('View in Admin Dashboard', `${BRAND.siteUrl}/admin`)}
    `),
  },

};

module.exports = EMAIL_TEMPLATES;

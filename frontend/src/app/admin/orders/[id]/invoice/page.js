'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { HiOutlineArrowLeft, HiOutlinePrinter } from 'react-icons/hi2';
import adminApi, { formatPrice, formatDate } from '@/lib/adminApi';

const PRINT_CSS = `
@media print {
  .admin-sidebar, .admin-topbar, .admin-sidebar-overlay, .no-print { display: none !important; }
  .admin-main-area { margin-left: 0 !important; }
  .admin-content { padding: 0 !important; }
  body { background: #fff !important; }
  .invoice-sheet { box-shadow: none !important; border: none !important; margin: 0 !important; }
}`;

function Row({ label, value, strong }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontWeight: strong ? 800 : 400, fontSize: strong ? '1rem' : '0.9rem' }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export default function InvoicePage({ params }) {
  const { id } = use(params);
  const [order, setOrder] = useState(null);
  const [company, setCompany] = useState({});
  const [zones, setZones] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [orderRes, companyRes, zonesRes, branchesRes] = await Promise.all([
          adminApi.orders.get(id),
          adminApi.settings.company().catch(() => ({ data: { data: {} } })),
          adminApi.delivery.getZones().catch(() => ({ data: { data: [] } })),
          adminApi.delivery.getBranches().catch(() => ({ data: { data: [] } })),
        ]);
        if (!active) return;
        setOrder(orderRes.data.data);
        setCompany(companyRes.data.data || {});
        setZones(zonesRes.data.data || []);
        setBranches(branchesRes.data.data || []);
      } catch (err) {
        if (active) setError(err?.response?.data?.message || 'Failed to load invoice');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id]);

  if (loading) return <div className="admin-loading"><div className="admin-spinner" /></div>;
  if (error || !order) return <div className="admin-empty">{error || 'Order not found'}</div>;

  const addr = order.shippingAddress || {};
  const customer = order.user?.name || order.guestInfo?.name || addr.fullName || 'Customer';
  const phone = order.user?.phone || order.guestInfo?.phone || addr.phone || '';

  // Per-location seller identity: resolve the branch that fulfils this order
  // (delivery city → zone → branch) and let its ship-from address + invoice
  // prefix override the globals. Legal identity (name / GSTIN / etc.) always
  // comes from global company settings.
  // Prefer the branch snapshotted on the order; fall back to resolving by
  // delivery city (for legacy orders placed before branchId existed).
  const orderCity = (order.deliveryCity || addr.city || '').trim().toLowerCase();
  const zone = orderCity ? zones.find((z) => (z.city || '').trim().toLowerCase() === orderCity) : null;
  const resolvedBranchId = order.branchId || zone?.branchId || null;
  const branch = resolvedBranchId ? branches.find((b) => String(b._id) === String(resolvedBranchId)) : null;
  const origin = branch?.origin || {};
  const hasOrigin = !!(origin.addressLine1 || origin.addressLine2 || origin.city);
  const sellerAddr = hasOrigin ? origin : company;
  const invoicePrefix = branch?.invoicePrefix || company.invoicePrefix || 'INV';
  const invoiceNo = `${invoicePrefix}-${order.orderNumber}`;
  const items = order.items || [];

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Link href={`/admin/orders/${id}`} className="admin-btn admin-btn-ghost admin-btn-sm" style={{ textDecoration: 'none' }}>
          <HiOutlineArrowLeft /> Back to order
        </Link>
        <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => window.print()} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <HiOutlinePrinter /> Print / Save PDF
        </button>
      </div>

      <div className="invoice-sheet admin-card" style={{ maxWidth: 800, margin: '0 auto', background: '#fff', color: '#1a1a1a', padding: '2rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', borderBottom: '2px solid #D81B60', paddingBottom: '1rem' }}>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#D81B60' }}>{company.name || 'The Cake Bake'}</div>
            {company.legalName && <div style={{ fontSize: '0.85rem', color: '#555' }}>{company.legalName}</div>}
            <div style={{ fontSize: '0.8rem', color: '#555', marginTop: 4 }}>
              {[sellerAddr.addressLine1, sellerAddr.addressLine2].filter(Boolean).join(', ')}<br />
              {[sellerAddr.city, sellerAddr.state, sellerAddr.pincode].filter(Boolean).join(', ')}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#555', marginTop: 4 }}>
              {company.phone && <>📞 {company.phone} &nbsp;</>}
              {company.email && <>✉ {company.email}</>}
            </div>
            {company.gstin && <div style={{ fontSize: '0.8rem', color: '#555', marginTop: 2 }}>GSTIN: <strong>{company.gstin}</strong></div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '0.05em' }}>TAX INVOICE</div>
            <div style={{ fontSize: '0.85rem', marginTop: 6 }}>Invoice No: <strong>{invoiceNo}</strong></div>
            <div style={{ fontSize: '0.85rem' }}>Date: <strong>{formatDate(order.createdAt)}</strong></div>
            <div style={{ fontSize: '0.85rem' }}>Payment: <strong>{order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online'}</strong></div>
          </div>
        </div>

        {/* Bill to */}
        <div style={{ margin: '1rem 0', fontSize: '0.85rem' }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Bill To</div>
          <div>{customer}</div>
          {phone && <div>{phone}</div>}
          <div style={{ color: '#555' }}>
            {[addr.addressLine1, addr.addressLine2].filter(Boolean).join(', ')}
            {addr.city ? <>, {addr.city}{addr.state ? `, ${addr.state}` : ''} — {addr.pincode}</> : ''}
          </div>
        </div>

        {/* Items */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: '#faf0f4', textAlign: 'left' }}>
              <th style={{ padding: '8px', border: '1px solid #eee' }}>#</th>
              <th style={{ padding: '8px', border: '1px solid #eee' }}>Item</th>
              {company.hsnCode && <th style={{ padding: '8px', border: '1px solid #eee' }}>HSN</th>}
              <th style={{ padding: '8px', border: '1px solid #eee', textAlign: 'center' }}>Qty</th>
              <th style={{ padding: '8px', border: '1px solid #eee', textAlign: 'right' }}>Rate</th>
              <th style={{ padding: '8px', border: '1px solid #eee', textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const addOnTotal = (item.addOns || []).reduce((sum, a) => sum + (a.price || 0), 0);
              const lineRate = (item.price || 0) + addOnTotal;
              return (
                <tr key={item._id || index}>
                  <td style={{ padding: '8px', border: '1px solid #eee' }}>{index + 1}</td>
                  <td style={{ padding: '8px', border: '1px solid #eee' }}>
                    {item.name}{item.weight ? ` (${item.weight})` : ''}{item.isEggless ? ' · Eggless' : ''}
                    {(item.addOns || []).length > 0 && <div style={{ color: '#888', fontSize: '0.75rem' }}>+ {item.addOns.map((a) => a.name).join(', ')}</div>}
                  </td>
                  {company.hsnCode && <td style={{ padding: '8px', border: '1px solid #eee' }}>{company.hsnCode}</td>}
                  <td style={{ padding: '8px', border: '1px solid #eee', textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ padding: '8px', border: '1px solid #eee', textAlign: 'right' }}>{formatPrice(lineRate)}</td>
                  <td style={{ padding: '8px', border: '1px solid #eee', textAlign: 'right' }}>{formatPrice(lineRate * item.quantity)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ marginLeft: 'auto', marginTop: '1rem', maxWidth: 280 }}>
          <Row label="Subtotal" value={formatPrice(order.subtotal || 0)} />
          {order.deliveryCharge > 0 && <Row label="Delivery" value={formatPrice(order.deliveryCharge)} />}
          {order.discount > 0 && <Row label="Discount" value={`− ${formatPrice(order.discount)}`} />}
          {order.pointsDiscount > 0 && <Row label="Points" value={`− ${formatPrice(order.pointsDiscount)}`} />}
          <Row label={`Tax${company.gstRate ? ` (${company.gstRate}%)` : ''}`} value={formatPrice(order.tax || 0)} />
          <div style={{ borderTop: '2px solid #1a1a1a', marginTop: 6, paddingTop: 6 }}>
            <Row label="Grand Total" value={formatPrice(order.total || 0)} strong />
          </div>
        </div>

        <div style={{ marginTop: '2rem', textAlign: 'center', color: '#888', fontSize: '0.8rem' }}>
          Thank you for your order! · This is a computer-generated invoice.
        </div>
      </div>
    </div>
  );
}

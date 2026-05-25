'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineExclamationTriangle,
  HiOutlineReceiptRefund,
} from 'react-icons/hi2';
import adminApi, { formatDateTime, formatPrice } from '@/lib/adminApi';
import {
  AdminModal,
  AdminToast,
  EmptyState,
  LoadingSkeleton,
  Pagination,
  RefreshButton,
  StatusBadge,
  useAdminToast,
} from '@/components/admin/AdminUI';

const STATUS_OPTIONS = [
  { value: '', label: 'All refunds' },
  { value: 'requested', label: 'Requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'processing', label: 'Processing' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'failed', label: 'Failed' },
];

function getErrorMessage(error, fallback = 'Something went wrong') {
  return error?.response?.data?.message || error?.message || fallback;
}

function RefundSummaryCard({ label, value, icon, tone = 'info' }) {
  return (
    <div className="admin-card admin-operation-card">
      <div className={`admin-operation-icon ${tone}`}>{icon}</div>
      <div>
        <div className="admin-operation-label">{label}</div>
        <div className="admin-operation-value">{value}</div>
      </div>
    </div>
  );
}

export default function AdminRefundsPage() {
  const [refunds, setRefunds] = useState([]);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState({});
  const [failTarget, setFailTarget] = useState(null);
  const [failReason, setFailReason] = useState('');
  const { toast, showToast, hideToast } = useAdminToast();

  const fetchRefunds = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 15 };
      if (status) params.status = status;
      const res = await adminApi.refunds.list(params);
      const data = res.data.data;
      setRefunds(data.items || []);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load refunds'));
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    fetchRefunds();
  }, [fetchRefunds]);

  const summary = useMemo(() => {
    const active = refunds.filter((refund) => ['requested', 'approved', 'processing'].includes(refund.status)).length;
    const failed = refunds.filter((refund) => refund.status === 'failed').length;
    const completed = refunds.filter((refund) => refund.status === 'refunded').length;
    const amount = refunds.reduce((sum, refund) => sum + (refund.amount || 0), 0);
    return { active, failed, completed, amount };
  }, [refunds]);

  const runAction = async (refund, action, request) => {
    setActionLoading((prev) => ({ ...prev, [refund._id]: action }));
    try {
      await request();
      showToast(`Refund #${refund.order?.orderNumber || refund._id} ${action}`, 'success');
      await fetchRefunds();
    } catch (err) {
      showToast(getErrorMessage(err, 'Refund action failed'), 'error');
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[refund._id];
        return next;
      });
    }
  };

  const handleApprove = (refund) => runAction(
    refund,
    'approved',
    () => adminApi.refunds.approve(refund._id, 'Approved from admin refund queue')
  );

  const handleProcess = (refund) => runAction(
    refund,
    'processed',
    () => adminApi.refunds.process(refund._id)
  );

  const handleFail = async () => {
    if (!failTarget) return;
    const reason = failReason.trim() || 'Refund marked failed from admin refund queue';
    await runAction(failTarget, 'marked failed', () => adminApi.refunds.fail(failTarget._id, reason));
    setFailTarget(null);
    setFailReason('');
  };

  return (
    <div>
      <AdminToast {...toast} onClose={hideToast} />
      <AdminModal
        open={!!failTarget}
        title="Mark Refund Failed"
        onClose={() => {
          setFailTarget(null);
          setFailReason('');
        }}
        width={480}
      >
        <div className="admin-field">
          <label className="admin-label" htmlFor="refund-failure-reason">Failure reason</label>
          <textarea
            id="refund-failure-reason"
            className="admin-input admin-textarea"
            value={failReason}
            onChange={(event) => setFailReason(event.target.value)}
            placeholder="Add the provider or operational reason for the failure"
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={() => {
              setFailTarget(null);
              setFailReason('');
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-danger"
            disabled={!!actionLoading[failTarget?._id]}
            onClick={handleFail}
          >
            {actionLoading[failTarget?._id] ? 'Saving...' : 'Mark Failed'}
          </button>
        </div>
      </AdminModal>

      <div className="admin-page-header">
        <div>
          <div className="admin-page-kicker">Payments</div>
          <h1 className="admin-page-title">Refund Queue</h1>
          <div className="admin-page-subtitle">
            Approve, process, and audit online payment refunds before customers are affected.
          </div>
        </div>
        <RefreshButton onRefresh={fetchRefunds} />
      </div>

      {error && (
        <div className="admin-error-panel" role="alert">
          <span>{error}</span>
          <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" onClick={fetchRefunds}>
            Retry
          </button>
        </div>
      )}

      <div className="admin-refund-summary">
        <RefundSummaryCard label="Current View" value={total.toLocaleString()} icon={<HiOutlineReceiptRefund />} tone="info" />
        <RefundSummaryCard label="Active Queue" value={summary.active} icon={<HiOutlineClock />} tone={summary.active > 0 ? 'warning' : 'success'} />
        <RefundSummaryCard label="Completed Here" value={summary.completed} icon={<HiOutlineCheckCircle />} tone="success" />
        <RefundSummaryCard label="Failed Here" value={summary.failed} icon={<HiOutlineExclamationTriangle />} tone={summary.failed > 0 ? 'danger' : 'success'} />
      </div>

      <div className="admin-card">
        <div className="admin-refund-toolbar">
          <div>
            <h3 style={{ margin: 0 }}>Refunds</h3>
            <div className="admin-section-subtitle">
              Page total: {formatPrice(summary.amount)}
            </div>
          </div>
          <select
            className="admin-input admin-select"
            style={{ maxWidth: 220 }}
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <LoadingSkeleton rows={8} cols={7} />
        ) : refunds.length > 0 ? (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Refund</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Reason</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {refunds.map((refund) => {
                    const busy = actionLoading[refund._id];
                    const latestEvent = refund.events?.[refund.events.length - 1];
                    return (
                      <tr key={refund._id}>
                        <td>
                          <div className="admin-row-title">
                            {refund.order?._id ? (
                              <Link className="admin-table-action-link" href={`/admin/orders/${refund.order._id}`}>
                                #{refund.order.orderNumber || refund.order._id}
                              </Link>
                            ) : (
                              <span>#{refund._id}</span>
                            )}
                          </div>
                          <div className="admin-row-meta">
                            Requested by {refund.requestedBy || 'system'}
                          </div>
                        </td>
                        <td>
                          <div className="admin-row-title">{refund.user?.name || 'Guest customer'}</div>
                          <div className="admin-row-meta">{refund.user?.email || refund.user?.phone || 'No contact on refund'}</div>
                        </td>
                        <td className="admin-row-value">{formatPrice(refund.amount || 0)}</td>
                        <td><StatusBadge status={refund.status} /></td>
                        <td>
                          <div className="admin-refund-reason">
                            {refund.failureReason || refund.reason || latestEvent?.note || 'No note added'}
                          </div>
                        </td>
                        <td>
                          <div style={{ whiteSpace: 'nowrap' }}>{formatDateTime(refund.updatedAt || refund.createdAt)}</div>
                          {refund.razorpayRefundId && (
                            <div className="admin-row-meta">Razorpay: {refund.razorpayRefundId}</div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {refund.status === 'requested' && (
                              <button
                                type="button"
                                className="admin-btn admin-btn-secondary admin-btn-sm"
                                disabled={!!busy}
                                onClick={() => handleApprove(refund)}
                              >
                                {busy === 'approved' ? 'Approving...' : 'Approve'}
                              </button>
                            )}
                            {refund.status === 'approved' && (
                              <button
                                type="button"
                                className="admin-btn admin-btn-primary admin-btn-sm"
                                disabled={!!busy}
                                onClick={() => handleProcess(refund)}
                              >
                                {busy === 'processed' ? 'Processing...' : 'Process'}
                              </button>
                            )}
                            {refund.status !== 'refunded' && (
                              <button
                                type="button"
                                className="admin-btn admin-btn-danger admin-btn-sm"
                                disabled={!!busy}
                                onClick={() => setFailTarget(refund)}
                              >
                                Fail
                              </button>
                            )}
                            {refund.status === 'refunded' && (
                              <span className="admin-row-meta">Complete</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState
            icon={<HiOutlineReceiptRefund />}
            message={status ? `No ${status} refunds found` : 'No refunds found'}
          />
        )}
      </div>
    </div>
  );
}

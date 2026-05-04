'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import adminApi, { formatPrice } from '@/lib/adminApi';
import { Pagination, LoadingSkeleton, EmptyState, ConfirmDialog, AdminToast, useAdminToast, RefreshButton } from '@/components/admin/AdminUI';
import { resolveImageUrl } from '@/lib/uploadApi';

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const { toast, showToast, hideToast } = useAdminToast();

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (search) params.search = search;
      const res = await adminApi.products.list(params);
      const d = res.data.data;
      setProducts(d.items || []);
      setTotalPages(d.pagination?.totalPages || 1);
      setTotal(d.pagination?.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await adminApi.products.delete(deleteId);
      showToast('Product deactivated');
      setDeleteId(null);
      fetchProducts();
    } catch (err) {
      showToast('Delete failed', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <AdminToast {...toast} onClose={hideToast} />
      <ConfirmDialog open={!!deleteId} title="Delete Product" message="This will deactivate the product. It can be restored later." onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleting} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ margin: 0 }}>Products</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <RefreshButton onRefresh={fetchProducts} />
          <Link href="/admin/products/new" className="admin-btn admin-btn-primary" style={{ textDecoration: 'none' }}>
            + Add Product
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="admin-card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <input className="admin-input" placeholder="Search products..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ maxWidth: 300 }} />
        <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>{total} products</span>
      </div>

      {/* Table */}
      <div className="admin-card" style={{ padding: 0 }}>
        {loading ? <LoadingSkeleton rows={10} cols={6} /> : products.length === 0 ? (
          <EmptyState message="No products found" icon="🎂" />
        ) : (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Product</th><th>Category</th><th>Price</th><th>Featured</th><th>Active</th><th>Orders</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {p.images?.[0]?.url ? (
                            <img src={resolveImageUrl(p.images[0].url)} alt={p.name} style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', background: 'var(--admin-bg)' }} />
                          ) : (
                            <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--admin-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>🎂</div>
                          )}
                          <div>
                            <div style={{ fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>★ {p.averageRating || 0}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: 'var(--admin-text-secondary)' }}>{p.category?.name || '—'}</td>
                      <td style={{ fontWeight: 600 }}>{formatPrice(p.basePrice)}</td>
                      <td>{p.isFeatured ? <span style={{ color: 'var(--admin-success)' }}>✓</span> : <span style={{ color: 'var(--admin-text-muted)' }}>—</span>}</td>
                      <td>{p.isActive !== false ? <span className="admin-badge badge-active">Active</span> : <span className="admin-badge badge-inactive">Inactive</span>}</td>
                      <td style={{ color: 'var(--admin-text-secondary)' }}>{p.totalOrders || 0}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                          <Link href={`/admin/products/${p._id}`} className="admin-btn admin-btn-ghost admin-btn-sm" style={{ textDecoration: 'none' }}>Edit</Link>
                          <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => setDeleteId(p._id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '0 1rem' }}>
              <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

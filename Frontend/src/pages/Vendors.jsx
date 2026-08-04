import React, { useState, useEffect, useCallback } from 'react';
import { Truck, Plus, Pencil, Power, PowerOff, RefreshCcw, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import { Select, SelectItem } from '../components/ui/Select';
import { usePermissionContext } from '../context/PermissionContext';
import { useDepartmentContext } from '../context/DepartmentContext';
import {
  listVendors,
  listSubscriptions,
  getVendorAnalytics,
  createVendor,
  updateVendor,
} from '../services/vendorService';

const BILLING_CYCLES = ['monthly', 'quarterly', 'annual', 'one_time'];

const emptyForm = {
  name: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  taxId: '',
  isSubscription: false,
  billingCycle: '',
  autoRenew: false,
  licenseCount: '',
  licenseUsed: '',
  functionalTag: '',
  ownerDepartmentId: '',
  nextBillingDate: '',
};

const Vendors = () => {
  const { can } = usePermissionContext() || {};
  const canManage = can ? can('vendors.manage') : false;
  const { activeDepartments } = useDepartmentContext() || {};

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSubscriptionsOnly, setShowSubscriptionsOnly] = useState(false);
  const [analytics, setAnalytics] = useState(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);

  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [togglingId, setTogglingId] = useState(null);

  const refreshVendors = useCallback(async () => {
    setLoading(true);
    const res = showSubscriptionsOnly ? await listSubscriptions() : await listVendors();
    if (!res.error) setVendors(res.data || []);
    setLoading(false);
  }, [showSubscriptionsOnly]);

  useEffect(() => {
    refreshVendors();
  }, [refreshVendors]);

  useEffect(() => {
    // Analytics is fetched independently and doesn't block the main
    // list from rendering — a slow/failed analytics call shouldn't hold
    // up the vendor directory itself.
    getVendorAnalytics().then((res) => {
      if (!res.error) setAnalytics(res.data);
    });
  }, []);

  const openAdd = () => {
    setForm(emptyForm);
    setIsAddOpen(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setCreating(true);
    const { error } = await createVendor({
      ...form,
      licenseCount: form.licenseCount === '' ? undefined : Number(form.licenseCount),
      licenseUsed: form.licenseUsed === '' ? undefined : Number(form.licenseUsed),
      ownerDepartmentId: form.ownerDepartmentId || undefined,
      nextBillingDate: form.nextBillingDate || undefined,
      billingCycle: form.billingCycle || undefined,
    });
    setCreating(false);

    if (error) {
      toast.error(error.message || 'Failed to create vendor.');
      return;
    }

    toast.success('Vendor created!');
    setIsAddOpen(false);
    refreshVendors();
  };

  const openEdit = (vendor) => {
    setEditTarget(vendor);
    setEditForm({
      name: vendor.name || '',
      contactName: vendor.contact_name || '',
      contactEmail: vendor.contact_email || '',
      contactPhone: vendor.contact_phone || '',
      taxId: vendor.tax_id || '',
      isSubscription: vendor.is_subscription || false,
      billingCycle: vendor.billing_cycle || '',
      autoRenew: vendor.auto_renew || false,
      licenseCount: vendor.license_count ?? '',
      licenseUsed: vendor.license_used ?? '',
      functionalTag: vendor.functional_tag || '',
      ownerDepartmentId: vendor.owner_department_id || '',
      nextBillingDate: vendor.next_billing_date || '',
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editTarget || !editForm.name.trim()) return;

    setSaving(true);
    const { error } = await updateVendor(editTarget.id, {
      ...editForm,
      licenseCount: editForm.licenseCount === '' ? null : Number(editForm.licenseCount),
      licenseUsed: editForm.licenseUsed === '' ? null : Number(editForm.licenseUsed),
      ownerDepartmentId: editForm.ownerDepartmentId || null,
      nextBillingDate: editForm.nextBillingDate || null,
      billingCycle: editForm.billingCycle || null,
    });
    setSaving(false);

    if (error) {
      toast.error(error.message || 'Failed to update vendor.');
      return;
    }

    toast.success('Vendor updated!');
    setEditTarget(null);
    refreshVendors();
  };

  const handleToggleActive = async (vendor) => {
    const nextActive = !vendor.is_active;
    if (nextActive === false) {
      const confirmed = window.confirm(
        `Deactivate "${vendor.name}"? It will be hidden from new transactions but existing history is preserved.`
      );
      if (!confirmed) return;
    }

    setTogglingId(vendor.id);
    const { error } = await updateVendor(vendor.id, { is_active: nextActive });
    setTogglingId(null);

    if (error) {
      toast.error(error.message || 'Failed to update vendor status.');
      return;
    }

    toast.success(nextActive ? 'Vendor reactivated.' : 'Vendor deactivated.');
    refreshVendors();
  };

  const isRenewalRisk = (vendor) =>
    (analytics?.renewalRisks || []).some((r) => r.id === vendor.id);

  const departmentName = (id) => activeDepartments?.find((d) => d.id === id)?.name || '—';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Vendors</h1>
          <p className="text-sm text-slate-400 mt-1">
            Every vendor has a current owner and a visible renewal date — nothing auto-renews unnoticed.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant={showSubscriptionsOnly ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowSubscriptionsOnly((v) => !v)}
          >
            <RefreshCcw size={14} className="mr-1.5" />
            {showSubscriptionsOnly ? 'Subscriptions only' : 'All vendors'}
          </Button>
          {canManage && (
            <Button variant="primary" size="md" onClick={openAdd}>
              <Plus size={16} className="mr-1.5" />
              Add Vendor
            </Button>
          )}
        </div>
      </div>

      {analytics && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card glass className="p-4">
            <p className="text-xs text-slate-400">Vendor Concentration</p>
            <p className="text-xl font-bold text-white mt-1">{analytics.vendorConcentrationPercent}%</p>
            <p className="text-xs text-slate-500 mt-1">Top 5 vendors' share of total spend</p>
          </Card>
          <Card glass className="p-4">
            <p className="text-xs text-slate-400">Vendors With Owner</p>
            <p className="text-xl font-bold text-white mt-1">
              {analytics.vendorsWithOwner}/{analytics.totalVendors}
            </p>
            <p className="text-xs text-slate-500 mt-1">Ownership survives an employee's exit</p>
          </Card>
          <Card glass className="p-4">
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-amber-400" />
              Renewal Risk (30 days)
            </p>
            <p className="text-xl font-bold text-white mt-1">{analytics.renewalRisks.length}</p>
            <p className="text-xs text-slate-500 mt-1">Not yet reviewed, renewing soon</p>
          </Card>
        </div>
      )}

      <Card glass className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton variant="rect" className="h-14" count={4} />
          </div>
        ) : !vendors || vendors.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Truck}
              title={showSubscriptionsOnly ? 'No subscriptions yet' : 'No vendors yet'}
              description="Track vendor relationships, contracts, and renewal dates so nothing auto-renews unnoticed."
              actionText={canManage ? 'Add Vendor' : undefined}
              onAction={canManage ? openAdd : undefined}
            />
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {vendors.map((vendor) => (
              <div
                key={vendor.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-400 shrink-0">
                    <Truck size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{vendor.name}</p>
                    <p className="text-xs text-slate-500">
                      Owner: {departmentName(vendor.owner_department_id)}
                      {vendor.next_billing_date
                        ? ` · Renews ${new Date(vendor.next_billing_date).toLocaleDateString()}`
                        : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {vendor.is_subscription && <Badge variant="info">Subscription</Badge>}
                  {isRenewalRisk(vendor) && (
                    <Badge variant="warning">
                      <AlertTriangle size={12} className="mr-1" />
                      Renewal Risk
                    </Badge>
                  )}
                  <Badge variant={vendor.is_active ? 'success' : 'default'}>
                    {vendor.is_active ? 'Active' : 'Inactive'}
                  </Badge>

                  {canManage && (
                    <>
                      <button
                        onClick={() => openEdit(vendor)}
                        className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleToggleActive(vendor)}
                        disabled={togglingId === vendor.id}
                        className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                          vendor.is_active
                            ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10'
                            : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                        }`}
                        title={vendor.is_active ? 'Deactivate' : 'Reactivate'}
                      >
                        {vendor.is_active ? <PowerOff size={16} /> : <Power size={16} />}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add Vendor Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Vendor">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Vendor Name"
            placeholder="e.g. AWS, Figma, Deel"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoFocus
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Contact Name"
              value={form.contactName}
              onChange={(e) => setForm({ ...form, contactName: e.target.value })}
            />
            <Input
              label="Contact Email"
              type="email"
              value={form.contactEmail}
              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Owner Department</label>
              <Select
                value={form.ownerDepartmentId}
                onChange={(e) => setForm({ ...form, ownerDepartmentId: e.target.value })}
              >
                <SelectItem value="">— None —</SelectItem>
                {(activeDepartments || []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </Select>
            </div>
            <Input
              label="Next Billing Date"
              type="date"
              value={form.nextBillingDate}
              onChange={(e) => setForm({ ...form, nextBillingDate: e.target.value })}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.isSubscription}
              onChange={(e) => setForm({ ...form, isSubscription: e.target.checked })}
            />
            This is a recurring subscription
          </label>

          {form.isSubscription && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Billing Cycle</label>
                <Select
                  value={form.billingCycle}
                  onChange={(e) => setForm({ ...form, billingCycle: e.target.value })}
                >
                  <SelectItem value="">— Select —</SelectItem>
                  {BILLING_CYCLES.map((c) => (
                    <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>
                  ))}
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300 mt-6">
                <input
                  type="checkbox"
                  checked={form.autoRenew}
                  onChange={(e) => setForm({ ...form, autoRenew: e.target.checked })}
                />
                Auto-renews
              </label>
              <Input
                label="License Count"
                type="number"
                min="0"
                value={form.licenseCount}
                onChange={(e) => setForm({ ...form, licenseCount: e.target.value })}
              />
              <Input
                label="License Used"
                type="number"
                min="0"
                value={form.licenseUsed}
                onChange={(e) => setForm({ ...form, licenseUsed: e.target.value })}
              />
            </div>
          )}

          <Button type="submit" className="w-full justify-center" loading={creating} disabled={creating}>
            Create Vendor
          </Button>
        </form>
      </Modal>

      {/* Edit Vendor Modal */}
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Vendor">
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Vendor Name"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            autoFocus
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Owner Department</label>
              <Select
                value={editForm.ownerDepartmentId}
                onChange={(e) => setEditForm({ ...editForm, ownerDepartmentId: e.target.value })}
              >
                <SelectItem value="">— None —</SelectItem>
                {(activeDepartments || []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </Select>
            </div>
            <Input
              label="Next Billing Date"
              type="date"
              value={editForm.nextBillingDate}
              onChange={(e) => setEditForm({ ...editForm, nextBillingDate: e.target.value })}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={editForm.isSubscription}
              onChange={(e) => setEditForm({ ...editForm, isSubscription: e.target.checked })}
            />
            This is a recurring subscription
          </label>

          {editForm.isSubscription && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Billing Cycle</label>
                <Select
                  value={editForm.billingCycle}
                  onChange={(e) => setEditForm({ ...editForm, billingCycle: e.target.value })}
                >
                  <SelectItem value="">— Select —</SelectItem>
                  {BILLING_CYCLES.map((c) => (
                    <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>
                  ))}
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300 mt-6">
                <input
                  type="checkbox"
                  checked={editForm.autoRenew}
                  onChange={(e) => setEditForm({ ...editForm, autoRenew: e.target.checked })}
                />
                Auto-renews
              </label>
            </div>
          )}

          <Button type="submit" className="w-full justify-center" loading={saving} disabled={saving}>
            Save Changes
          </Button>
        </form>
      </Modal>
    </div>
  );
};

export default Vendors;

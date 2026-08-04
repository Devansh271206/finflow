import React, { useRef, useState } from 'react';
import { UserCircle, Camera, Mail, Phone, MapPin, Heart, Lock } from 'lucide-react';
import Card from '../../../components/ui/Card';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import { updateProfile } from '../../../services/profileService';

/**
 * My Profile tab.
 * ------------------------------------------------------------------
 * Split in two, deliberately:
 *
 *   - EDITABLE (via existing PUT /api/profile / profileService.js):
 *     display name, avatar. This is the `profiles` table, which is
 *     already self-owned by the authenticated user.
 *
 *   - READ-ONLY (sourced from the `employee` prop, i.e. the
 *     `employees` table): email, phone, address, emergency contact.
 *     These are edited via PUT /api/employees/:id, which requires the
 *     EMPLOYEES_MANAGE permission — ordinary employees don't hold it
 *     (see permissionRegistry.js / employeeRoutes.js). Per the Sprint
 *     13 brief ("Reuse existing... RBAC... Employees can ONLY access
 *     their own information") this tab does NOT open a new write path
 *     around that gate. If self-editable contact details are wanted
 *     later, that's a deliberate RBAC change to employeeRoutes.js,
 *     not something to route around here.
 *
 * "Skills" from the PRD spec has no backing field anywhere in the
 * schema (profiles or employees) — omitted rather than inventing
 * client-only state that would silently not persist.
 */
export function MyProfileTab({ employee, onSaved }) {
  const fileInputRef = useRef(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [fullName, setFullName] = useState(employee?.full_name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedMessage, setSavedMessage] = useState(null);

  if (!employee) return null;

  function handleAvatarPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarPreview({ file, url: URL.createObjectURL(file) });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSavedMessage(null);

    const updates = { full_name: fullName };
    if (avatarPreview?.file) updates.avatar = avatarPreview.file;

    const { error: saveError } = await updateProfile(updates);
    setSaving(false);

    if (saveError) {
      setError(typeof saveError === 'string' ? saveError : saveError?.message || 'Failed to save profile');
      return;
    }

    setSavedMessage('Profile updated successfully');
    onSaved?.();
  }

  return (
    <div className="space-y-6">
      {/* Editable: display name + avatar */}
      <Card>
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <UserCircle size={16} className="text-slate-500" />
          Personal Information
        </h3>

        <div className="flex flex-col sm:flex-row gap-6">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center">
                {avatarPreview?.url ? (
                  <img src={avatarPreview.url} alt="Avatar preview" className="w-full h-full object-cover" />
                ) : (
                  <UserCircle size={40} className="text-slate-600" />
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
              >
                <Camera size={12} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarPick}
              />
            </div>
            <p className="text-xs text-slate-500">Profile Picture</p>
          </div>

          <div className="flex-1 space-y-4">
            <Input
              label="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
            />
            <div className="flex items-center gap-3">
              <Button onClick={handleSave} loading={saving} disabled={saving}>
                Save Changes
              </Button>
              {savedMessage && <span className="text-xs text-emerald-400 font-medium">{savedMessage}</span>}
              {error && <span className="text-xs text-rose-400 font-medium">{error}</span>}
            </div>
          </div>
        </div>
      </Card>

      {/* Read-only: contact + emergency contact, sourced from the employee record */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Phone size={16} className="text-slate-500" />
            Contact Details
          </h3>
          <Badge variant="default">
            <Lock size={10} className="mr-1 inline" />
            Managed by HR
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          <ReadOnlyRow icon={Mail} label="Email" value={employee.email} />
          <ReadOnlyRow icon={Phone} label="Phone" value={employee.phone} />
          <ReadOnlyRow icon={MapPin} label="Address" value={employee.address} className="sm:col-span-2" />
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Heart size={16} className="text-slate-500" />
            Emergency Contact
          </h3>
          <Badge variant="default">
            <Lock size={10} className="mr-1 inline" />
            Managed by HR
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          <ReadOnlyRow icon={UserCircle} label="Name" value={employee.emergency_contact_name} />
          <ReadOnlyRow icon={Phone} label="Phone" value={employee.emergency_contact_phone} />
        </div>
        <p className="text-xs text-slate-500 mt-4">
          Need to update your contact details or emergency contact? Reach out to HR/Admin — these fields are
          part of your official employee record.
        </p>
      </Card>
    </div>
  );
}

function ReadOnlyRow({ icon: Icon, label, value, className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="p-2 rounded-lg bg-white/5 text-slate-500">
        <Icon size={14} />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-white">{value || '—'}</p>
      </div>
    </div>
  );
}

export default MyProfileTab;

import React, { useEffect, useState } from 'react';
import { Lock, Palette, Bell, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import Card from '../../../components/ui/Card';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import { Select, SelectItem } from '../../../components/ui/Select';
import { supabase } from '../../../lib/supabase';
import { getSettings, updateSettings } from '../../../services/settingsService';

/**
 * Account Settings tab.
 * ------------------------------------------------------------------
 *  - Password: supabase.auth.updateUser({ password }) directly — same
 *    Supabase client already used by settingsService.js for the other
 *    auth-metadata update. No custom backend endpoint needed/exists
 *    for this; Supabase Auth owns password storage.
 *  - Theme: wired to the existing GET/PUT /api/profile via
 *    settingsService.js (theme is a real, persisted column already
 *    used elsewhere in the app's Settings).
 *  - Profile Picture: intentionally NOT duplicated here — it's the
 *    same underlying field edited in My Profile, so this just links
 *    over there instead of offering a second upload control for the
 *    same data.
 *  - Notification Preferences: the PRD asks for this, but there is no
 *    backing column/table anywhere in the schema (notifications are
 *    all-or-nothing per user, no per-category opt-out). Rather than
 *    building a toggle UI that silently does nothing, this section is
 *    shown as read-only "coming soon" — flagging for a real backend
 *    field in a future sprint instead of faking persistence.
 */
export function AccountSettingsTab({ onNavigateTab }) {
  const [theme, setTheme] = useState('dark');
  const [savingTheme, setSavingTheme] = useState(false);
  const [themeSaved, setThemeSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await getSettings();
      if (active && data?.theme) setTheme(data.theme);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleThemeChange(nextTheme) {
    setTheme(nextTheme);
    setSavingTheme(true);
    setThemeSaved(false);
    const { error } = await updateSettings({ theme: nextTheme });
    setSavingTheme(false);
    if (!error) {
      setThemeSaved(true);
      setTimeout(() => setThemeSaved(false), 2000);
    }
  }

  async function handlePasswordSave() {
    setPasswordError(null);
    setPasswordSaved(false);

    if (!newPassword || newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);

    if (error) {
      setPasswordError(error.message || 'Failed to update password.');
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordSaved(true);
    setTimeout(() => setPasswordSaved(false), 3000);
  }

  return (
    <div className="space-y-6">
      {/* Password */}
      <Card>
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Lock size={16} className="text-slate-500" />
          Password
        </h3>
        <div className="space-y-4 max-w-md">
          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="For your reference only"
          />
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
          />
          {passwordError && <p className="text-xs text-rose-400 font-medium">{passwordError}</p>}
          <div className="flex items-center gap-3">
            <Button onClick={handlePasswordSave} loading={savingPassword} disabled={savingPassword}>
              Update Password
            </Button>
            {passwordSaved && (
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 size={14} />
                Password updated
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Profile Picture — links to My Profile rather than duplicating the control */}
      <Card onClick={() => onNavigateTab?.('profile')} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-white/5 text-slate-400">
            <ImageIcon size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Profile Picture</p>
            <p className="text-xs text-slate-500">Managed from the My Profile tab</p>
          </div>
        </div>
      </Card>

      {/* Theme */}
      <Card>
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Palette size={16} className="text-slate-500" />
          Theme
        </h3>
        <div className="flex items-center gap-3 max-w-xs">
          <Select value={theme} onChange={(e) => handleThemeChange(e.target.value)}>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </Select>
          {savingTheme && <span className="text-xs text-slate-500">Saving…</span>}
          {themeSaved && <span className="text-xs text-emerald-400">Saved</span>}
        </div>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
          <Bell size={16} className="text-slate-500" />
          Notification Preferences
        </h3>
        <p className="text-xs text-slate-500">
          Per-category notification preferences (leave, payroll, expense, announcements) are coming soon.
          For now, all notifications are delivered by default — you can manage read/unread status from the
          Notifications tab.
        </p>
      </Card>
    </div>
  );
}

export default AccountSettingsTab;

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  User,
  Shield,
  Award,
  Upload,
  Mail,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import toast from 'react-hot-toast';
import { getProfile, updateProfile } from '../services/profileService';

const TOAST_STYLE = { background: '#111827', color: '#fff', border: '1px solid rgba(16,185,129,0.2)' };

export const Profile = () => {
  const { user, updateUserProfile } = useApp();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getProfile();
    if (!error && data) {
      setProfile(data);
      setName(data.full_name || user?.name || '');
      setEmail(user?.email || '');
      setAvatarUrl(data.avatar_url || user?.avatar || '');
      setAvatarPreview(data.avatar_url || user?.avatar || '');
    } else {
      // Fallback to auth user data
      setName(user?.name || '');
      setEmail(user?.email || '');
      setAvatarUrl(user?.avatar || '');
      setAvatarPreview(user?.avatar || '');
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result);
      setAvatarUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { data, error } = await updateProfile({
      full_name: name,
      avatar_url: avatarUrl,
    });
    if (!error) {
      updateUserProfile({ name, avatar: avatarUrl });
      toast.success('Profile updated successfully.', { style: TOAST_STYLE });
    } else {
      toast.error('Failed to update profile.');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 size={24} className="animate-spin mr-2" /> Loading profile…
      </div>
    );
  }

  const displayAvatar = avatarPreview || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=10b981&color=fff&size=256`;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">User Profile</h1>
        <p className="text-sm text-slate-400 mt-1">Manage your credentials and account details.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          <Card hover={false}>
            <form onSubmit={handleProfileSave} className="space-y-6">
              {/* Avatar uploader */}
              <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-white/5">
                <div className="relative">
                  <img
                    src={displayAvatar}
                    alt="profile avatar"
                    className="w-24 h-24 rounded-full object-cover border-2 border-emerald-500/50 shadow-lg"
                    onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=10b981&color=fff&size=256`; }}
                  />
                  <label className="absolute bottom-0 right-0 p-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer transition-colors shadow">
                    <Upload size={14} />
                    <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
                  </label>
                </div>
                <div className="text-center sm:text-left space-y-1">
                  <h3 className="text-sm font-bold text-white">Profile Photo</h3>
                  <p className="text-xs text-slate-500">PNG or JPG up to 5MB. Auto-cropped to square ratios.</p>
                </div>
              </div>

              {/* Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Full Name"
                  icon={User}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
                <Input
                  label="Email Address"
                  icon={Mail}
                  type="email"
                  value={email}
                  onChange={() => {}}
                  disabled
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
                  Save Personal Details
                </Button>
              </div>
            </form>
          </Card>

          {/* Account Info */}
          <Card hover={false}>
            <div className="flex items-center gap-2 mb-5">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Account Status</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <Mail size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">{email || 'Not set'}</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">Verified email address</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                  Active
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <Card hover={false}>
            <div className="flex items-center gap-2 mb-5">
              <Award size={18} className="text-purple-400" />
              <h3 className="text-sm font-bold text-white">Account Summary</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.01] border border-white/5">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg shrink-0">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white leading-tight">Authenticated User</h4>
                  <p className="text-[10px] text-slate-400 mt-1">Your session is active and secure.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.01] border border-white/5">
                <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg shrink-0">
                  <Award size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white leading-tight">FinFlow Member</h4>
                  <p className="text-[10px] text-slate-400 mt-1">Full access to all features.</p>
                </div>
              </div>
            </div>
          </Card>

          <Card hover={false} className="border border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={16} className="text-blue-400" />
              <h3 className="text-xs font-bold text-white">Security Standard</h3>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Your account uses Supabase Auth with 256-bit SSL encryption. All financial data is stored securely and accessible only to you.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;

import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Settings as SettingsIcon,
  Bell,
  Globe,
  Database,
  Trash2,
  Lock,
  Download,
  Loader2
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Select, SelectItem } from '../components/ui/Select';
import toast from 'react-hot-toast';
import { getProfileSettings, updateProfileSettings } from '../services/settingsService';
import { getTransactions, deleteTransaction } from '../services/transactionService';
import { getBudgets } from '../services/budgetService';
import { getGoals, deleteGoal } from '../services/goalService';
import { getBills, deleteBill } from '../services/billService';
import { supabase } from '../lib/supabase';

export const Settings = () => {
  const { settings, setSettings } = useApp();
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [exporting, setExporting] = useState(false);
  const [wiping, setWiping] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const { data, error } = await getProfileSettings();
      if (!error && data) {
        setProfileName(data.name || '');
        setProfileEmail(data.email || '');
        setProfileAvatar(data.avatar || '');
      }
    }

    loadProfile();
  }, []);

  const handleCurrencyChange = (e) => {
    setSettings(prev => ({
      ...prev,
      currency: e.target.value
    }));
    toast.success(`Currency switched to ${e.target.value}`);
  };

  const handleLanguageChange = (e) => {
    setSettings(prev => ({
      ...prev,
      language: e.target.value
    }));
    toast.success(`Language set to ${e.target.value}`);
  };

  const handlePrivacyToggle = () => {
    setSettings(prev => {
      const mode = !prev.privacyMode;
      toast.success(mode ? 'Privacy mask enabled' : 'Privacy mask disabled');
      return {
        ...prev,
        privacyMode: mode
      };
    });
  };

  const handleProfileSave = async () => {
    const { error } = await updateProfileSettings({ name: profileName, email: profileEmail, avatar: profileAvatar });
    if (!error) {
      toast.success('Profile updated in Supabase');
    }
  };

  const handleExportData = async () => {
    setExporting(true);
    try {
      const [txRes, budgetsRes, goalsRes, billsRes] = await Promise.all([
        getTransactions(),
        getBudgets(),
        getGoals(),
        getBills(),
      ]);

      const exportPayload = {
        exportedAt: new Date().toISOString(),
        transactions: txRes.data || [],
        budgets: budgetsRes.data || [],
        goals: goalsRes.data || [],
        bills: billsRes.data || [],
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "finflow_ledger_export.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success('Ledger exported successfully!');
    } catch (error) {
      toast.error('Failed to export data.');
    } finally {
      setExporting(false);
    }
  };

  const handleWipeData = async () => {
    const confirmed = window.confirm(
      "Danger: This will permanently delete ALL of your transactions, budgets, goals, and bills from your FinFlow account. This cannot be undone. Continue?"
    );
    if (!confirmed) return;

    setWiping(true);
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw authError || new Error('Not authenticated.');
      }

      const [txRes, goalsRes, billsRes] = await Promise.all([
        getTransactions(),
        getGoals(),
        getBills(),
      ]);

      await Promise.all([
        ...((txRes.data || []).map((tx) => deleteTransaction(tx.id))),
        ...((goalsRes.data || []).map((g) => deleteGoal(g.id))),
        ...((billsRes.data || []).map((b) => deleteBill(b.id))),
      ]);

      // Budgets have no dedicated delete endpoint; remove directly, scoped to this user only
      await supabase.from('budgets').delete().eq('user_id', user.id);

      toast.success('All account data wiped. Reloading…');
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (error) {
      toast.error('Failed to wipe data. Please try again.');
    } finally {
      setWiping(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto text-left">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">System Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Configure workspace defaults, language structures, and backups.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Navigation Sidebar inside settings */}
        <div className="space-y-2">
          <button className="w-full text-left px-4 py-3 rounded-xl text-xs font-bold bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/20 flex items-center gap-3">
            <Globe size={15} /> Localization & Theme
          </button>
          <button className="w-full text-left px-4 py-3 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 flex items-center gap-3 transition-colors">
            <Bell size={15} /> Notifications System
          </button>
          <button className="w-full text-left px-4 py-3 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 flex items-center gap-3 transition-colors">
            <Database size={15} /> Database Controls
          </button>
        </div>

        {/* Content Body */}
        <div className="md:col-span-2 space-y-6">
          {/* Main Setting Cards */}
          <Card hover={false} className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">Profile Sync</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">Keep your profile details in sync with Supabase</p>
              </div>
              <Button variant="secondary" size="sm" onClick={handleProfileSave}>Save Profile</Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input value={profileName} onChange={(e) => setProfileName(e.target.value)} className="rounded-xl bg-white/5 border border-white/10 text-white text-xs py-2 px-3 outline-none" placeholder="Name" />
              <input value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} className="rounded-xl bg-white/5 border border-white/10 text-white text-xs py-2 px-3 outline-none" placeholder="Email" />
            </div>
            <h3 className="text-sm font-bold text-white border-b border-white/5 pb-3">Preference Settings</h3>
            
            {/* Currency */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">Default Currency Symbol</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">Used across transaction cards and totals</p>
              </div>
              <Select
                value={settings.currency}
                onChange={handleCurrencyChange}
              >
                <SelectItem value="₹">₹ (Rupees)</SelectItem>
                <SelectItem value="$">$ (USD)</SelectItem>
                <SelectItem value="€">€ (Euro)</SelectItem>
                <SelectItem value="£">£ (Pound)</SelectItem>
              </Select>
            </div>

            {/* Language */}
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <div>
                <h4 className="text-xs font-bold text-white">System Language</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">Applies locale translations</p>
              </div>
              <Select
                value={settings.language}
                onChange={handleLanguageChange}
              >
                <SelectItem value="English">English</SelectItem>
                <SelectItem value="Hindi">Hindi</SelectItem>
                <SelectItem value="Spanish">Spanish</SelectItem>
                <SelectItem value="French">French</SelectItem>
              </Select>
            </div>

            {/* Locked Dark Theme */}
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <div>
                <h4 className="text-xs font-bold text-white">Display Theme</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">Dark Premium is the default preset</p>
              </div>
              <span className="text-xs font-bold text-[#10b981] bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                Dark Premium
              </span>
            </div>

            {/* Privacy Mode */}
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <div>
                <h4 className="text-xs font-bold text-white">Privacy Mask</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">Hide sensitive balances and amounts on screen</p>
              </div>
              <button
                onClick={handlePrivacyToggle}
                className={`relative w-11 h-6 rounded-full transition-colors ${settings.privacyMode ? 'bg-[#10b981]' : 'bg-white/10'}`}
                title="Toggle privacy mask"
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${settings.privacyMode ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>
          </Card>

          {/* Backup database controls */}
          <Card hover={false} className="space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-white/5 pb-3">Data Portability</h3>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-bold text-white">Export Account Data</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">Downloads all your transactions, budgets, goals, and bills as JSON</p>
              </div>
              <Button variant="secondary" size="sm" onClick={handleExportData} disabled={exporting}>
                {exporting ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Download size={14} className="mr-1.5" />}
                {exporting ? 'Exporting…' : 'Export Data'}
              </Button>
            </div>

            <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-bold text-rose-400">Delete All Account Data</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">Permanently erase all transactions, budgets, goals, and bills from your account</p>
              </div>
              <Button variant="danger" size="sm" onClick={handleWipeData} disabled={wiping}>
                {wiping ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Trash2 size={14} className="mr-1.5" />}
                {wiping ? 'Wiping…' : 'Wipe Account Data'}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;

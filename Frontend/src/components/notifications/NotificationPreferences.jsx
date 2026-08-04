import React, { useEffect, useState } from 'react';
import { BellOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { getNotificationPreferences, updateNotificationPreference } from '../../services/notificationPreferenceService';

const TOAST_STYLE = { background: '#111827', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' };

/**
 * Small inline toggle switch — no existing Toggle/Switch component
 * found anywhere in components/ui/, so one is built here rather than
 * adding a new dependency for a single control. Matches this
 * codebase's existing Tailwind-only styling approach (no headless-ui/
 * radix primitives used elsewhere for simple toggles).
 */
function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-[22px] rounded-full transition-colors shrink-0 ${
        checked ? 'bg-[#10b981]' : 'bg-white/10'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white transition-transform ${
          checked ? 'translate-x-[20px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

/**
 * Notification Preferences
 * ------------------------------------------------------------------
 * Sprint 14. Rendered inside Settings.jsx. Lists all 17 event types
 * (server always returns the full set regardless of whether the user
 * has an override row — see notificationPreferenceController.js) with
 * a mute toggle each. Each toggle updates immediately (optimistic,
 * with rollback on error) rather than requiring a "Save" button — a
 * preferences panel with 17 independent booleans is a natural fit for
 * immediate-apply, same UX class as a settings checklist rather than a
 * form.
 */
export default function NotificationPreferences() {
  const [preferences, setPreferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingEventType, setSavingEventType] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await getNotificationPreferences();
      setLoading(false);
      if (error) {
        toast.error('Unable to load notification preferences.', { style: TOAST_STYLE });
        return;
      }
      setPreferences(data);
    })();
  }, []);

  const handleToggle = async (eventType, nextValue) => {
    const previous = preferences;
    setPreferences((prev) => prev.map((p) => (p.eventType === eventType ? { ...p, isEnabled: nextValue } : p)));
    setSavingEventType(eventType);

    const { error } = await updateNotificationPreference(eventType, nextValue);
    setSavingEventType(null);

    if (error) {
      toast.error('Unable to update preference.', { style: TOAST_STYLE });
      setPreferences(previous);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-11 rounded-xl bg-white/5" />
        ))}
      </div>
    );
  }

  if (preferences.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
        <BellOff size={16} />
        Unable to load notification preferences.
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/5">
      {preferences.map((pref) => (
        <div key={pref.eventType} className="flex items-center justify-between py-3">
          <span className="text-sm text-slate-200">{pref.label}</span>
          <ToggleSwitch
            checked={pref.isEnabled}
            disabled={savingEventType === pref.eventType}
            onChange={(next) => handleToggle(pref.eventType, next)}
          />
        </div>
      ))}
    </div>
  );
}

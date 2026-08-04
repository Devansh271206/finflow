import React from 'react';
import { ShieldCheck, CreditCard, Flag, Activity, Lock } from 'lucide-react';
import Card from '../../components/ui/Card';

const FUTURE_SECTIONS = [
  {
    icon: CreditCard,
    title: 'Billing & Subscription Plans',
    description: 'Manage platform-wide billing and per-organization subscription tiers.',
  },
  {
    icon: Flag,
    title: 'Feature Flags',
    description: 'Roll out features to specific organizations before a general release.',
  },
  {
    icon: Activity,
    title: 'Platform Health Monitoring',
    description: 'Track uptime, error rates, and performance across the platform.',
  },
];

/**
 * Platform Settings
 * ------------------------------------------------------------------
 * Per this sprint's brief ("Keep Platform Administration modular and
 * future-ready for Billing, Subscription Management, Feature Flags and
 * Monitoring" + "Do NOT over-engineer features planned for future
 * releases"), this page does two things and nothing more for v1:
 *
 *   1. States plainly how Platform Admin access is granted today (a
 *      manual DB flag — see migration 016's header comment — there is
 *      no in-app "invite a platform admin" flow yet).
 *   2. Reserves clearly-labeled, visually locked nav space for the
 *      explicitly-named future modules, so this page's existence
 *      itself communicates the roadmap without any of those modules
 *      having real backends built prematurely.
 */
export function PlatformSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Platform Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Platform-wide configuration for this FinFlow instance.</p>
      </div>

      <Card hover={false} className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
          <ShieldCheck size={20} className="text-indigo-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white mb-1">Platform Administrator Access</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Platform Admin is granted by setting <code className="text-indigo-300 bg-white/5 px-1.5 py-0.5 rounded">is_platform_admin = true</code>{' '}
            on a user's profile directly in the database. There is no in-app invitation flow for platform
            administrators in this release — this is an intentional v1 limitation, not an oversight.
          </p>
        </div>
      </Card>

      <div>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Coming Soon</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FUTURE_SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <Card key={section.title} hover={false} className="opacity-60 relative">
                <div className="absolute top-4 right-4">
                  <Lock size={14} className="text-slate-600" />
                </div>
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-3">
                  <Icon size={18} className="text-slate-400" />
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">{section.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{section.description}</p>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default PlatformSettings;

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { TrendingUp, Check, Mail, LogIn } from 'lucide-react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { getInvitation, acceptInvitation } from '../services/invitationService';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const INVITE_STORAGE_KEY = 'finflow_pending_invite';

/**
 * InviteJoin — workspace invitation accept page.
 * ------------------------------------------------------------------
 * Reached via the email link: /invite?token=<secret>&email=<invited email>.
 *
 *  1. Resolves the token (public GET /api/invitations/:token) and shows
 *     which workspace the user was invited to.
 *  2. If the user is already signed in with the invited email, it calls
 *     POST /api/invitations/:token/accept automatically.
 *  3. If not signed in, it stores the pending token and sends them to
 *     login; Login.jsx returns them here after a successful sign-in.
 */
export default function InviteJoin() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const { user, authReady } = useApp();

  const [invite, setInvite] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('loading'); // loading | ready | accepting | done | error
  const [result, setResult] = useState(null);

  // Resolve invitation metadata (public, no auth required).
  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('This invitation link is missing its token. Please use the full link from the email.');
      return;
    }
    let active = true;
    (async () => {
      const { data, error: fetchError } = await getInvitation(token);
      if (!active) return;
      if (fetchError) {
        setStatus('error');
        setError(fetchError.message || 'Unable to load this invitation.');
        return;
      }
      setInvite(data);
      setStatus('ready');
    })();
    return () => { active = false; };
  }, [token]);

  // Auto-accept once signed in with the invited email.
  useEffect(() => {
    if (!authReady || status !== 'ready' || !user || !invite) return;
    if (String(user.email || '').toLowerCase() !== String(invite.email || '').toLowerCase()) return;

    setStatus('accepting');
    (async () => {
      const { data, error: acceptError } = await acceptInvitation(token);
      if (acceptError) {
        setStatus('error');
        setError(acceptError.message || 'Unable to accept this invitation.');
        return;
      }
      setResult(data);
      setStatus('done');
    })();
  }, [authReady, status, user, invite, token]);

  const handleGoLogin = () => {
    try {
      sessionStorage.setItem(INVITE_STORAGE_KEY, JSON.stringify({ token, email: invite?.email || '' }));
    } catch {
      // storage unavailable — the link is still reachable after login
    }
    navigate('/login');
  };

  const emailMatches = user?.email && invite?.email
    ? String(user.email).toLowerCase() === String(invite.email).toLowerCase()
    : false;

  return (
    <div className="min-h-screen bg-[#050816] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-emerald-500/10 blur-[100px]" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-indigo-500/10 blur-[100px]" />

      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-[#10b981]/15 flex items-center justify-center text-[#10b981]">
            <TrendingUp size={18} />
          </div>
          <span className="text-lg font-black text-white tracking-tight">FinFlow</span>
        </div>

        <Card glass className="p-8 text-center space-y-4">
          {status === 'loading' && (
            <div className="py-8">
              <p className="text-sm text-slate-400">Checking your invitation…</p>
            </div>
          )}

          {status === 'error' && (
            <div className="py-6 space-y-3">
              <p className="text-base font-semibold text-white">Invitation unavailable</p>
              <p className="text-sm text-slate-400">{error}</p>
              <Link to="/login" className="inline-block text-sm text-emerald-400 hover:text-emerald-300 font-semibold">
                Go to login
              </Link>
            </div>
          )}

          {status === 'ready' && invite && (
            <div className="py-4 space-y-4">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-[#10b981]/15 flex items-center justify-center text-[#10b981]">
                <Mail size={20} />
              </div>
              <div>
                <p className="text-sm text-slate-400">You've been invited to join</p>
                <p className="text-xl font-black text-white mt-1">
                  {invite.workspace?.name || 'a workspace'}
                </p>
                {invite.workspace?.companyName && (
                  <p className="text-xs text-slate-500 mt-0.5">{invite.workspace.companyName}</p>
                )}
                {invite.role?.name && (
                  <p className="text-xs text-slate-500 mt-2">Invited as {invite.role.name}</p>
                )}
                <p className="text-xs text-slate-600 mt-1">
                  Sent to {invite.email}
                </p>
              </div>

              {user && emailMatches && (
                <p className="text-xs text-emerald-400">Signed in as {user.email} — accepting…</p>
              )}

              {user && !emailMatches && (
                <div className="space-y-3">
                  <p className="text-xs text-amber-300">
                    This invitation was sent to <b>{invite.email}</b>, but you're signed in as{' '}
                    <b>{user.email}</b>. Sign in with the invited account to join.
                  </p>
                  <Button variant="secondary" size="sm" className="w-full justify-center" onClick={handleGoLogin}>
                    <LogIn size={15} className="mr-1" /> Switch account / Sign in
                  </Button>
                </div>
              )}

              {!user && (
                <Button variant="primary" size="sm" className="w-full justify-center" onClick={handleGoLogin}>
                  <LogIn size={15} className="mr-1" /> Sign in to accept
                </Button>
              )}
            </div>
          )}

          {status === 'accepting' && (
            <div className="py-8">
              <p className="text-sm text-slate-400">Joining workspace…</p>
            </div>
          )}

          {status === 'done' && (
            <div className="py-6 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-[#10b981]/15 flex items-center justify-center text-[#10b981]">
                <Check size={20} />
              </div>
              <p className="text-base font-semibold text-white">You're in!</p>
              <p className="text-sm text-slate-400">
                You've joined {result?.workspace?.name || invite?.workspace?.name || 'the workspace'}.
              </p>
              <Button variant="primary" size="sm" className="w-full justify-center" onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </Button>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}

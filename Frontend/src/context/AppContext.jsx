import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { signIn, signOut, signUp, getCurrentUser } from '../services/authService';

const AppContext = createContext();

const TOAST_STYLE = {
  background: '#111827',
  color: '#fff',
  border: '1px solid rgba(16, 185, 129, 0.2)'
};

export const AppProvider = ({ children }) => {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);

  // UI-only settings (persisted locally for fast access, synced to Supabase on change)
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('finflow_settings');
      return saved ? JSON.parse(saved) : {
        theme: 'dark',
        currency: '₹',
        language: 'English',
        privacyMode: false,
      };
    } catch {
      return { theme: 'dark', currency: '₹', language: 'English', privacyMode: false };
    }
  });

  // Persist settings locally whenever they change
  useEffect(() => {
    localStorage.setItem('finflow_settings', JSON.stringify(settings));
  }, [settings]);

  // Initialise auth session
  useEffect(() => {
    const initSession = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          setUser({
            id: currentUser.id,
            name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'User',
            email: currentUser.email,
            avatar: currentUser.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'U')}&background=10b981&color=fff`,
            isAuthenticated: true,
          });
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setAuthReady(true);
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          email: session.user.email,
          avatar: session.user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'U')}&background=10b981&color=fff`,
          isAuthenticated: true,
        });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Auth actions
  const login = useCallback(async (email, password) => {
    const { data, error } = await signIn(email, password);
    if (error) throw new Error(error.message || 'Invalid email or password.');
    const sessionUser = data?.user;
    if (!sessionUser) throw new Error('Unable to sign in.');
    setUser({
      id: sessionUser.id,
      name: sessionUser.user_metadata?.full_name || sessionUser.email?.split('@')[0] || 'User',
      email: sessionUser.email,
      avatar: sessionUser.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(sessionUser.user_metadata?.full_name || sessionUser.email?.split('@')[0] || 'U')}&background=10b981&color=fff`,
      isAuthenticated: true,
    });
    toast.success('Welcome back to FinFlow!', { style: TOAST_STYLE });
    return data;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const { data, error } = await signUp(email, password, name);
    if (error) throw new Error(error.message || 'Unable to create account.');
    if (data?.session) {
      toast.success('Registration successful! Welcome!', { style: TOAST_STYLE });
    } else {
      toast.success('Check your email to confirm your account.', { style: TOAST_STYLE });
    }
    return data;
  }, []);

  const logout = useCallback(async () => {
    const { error } = await signOut();
    if (error) throw new Error(error.message || 'Unable to log out.');
    setUser(null);
    localStorage.removeItem('finflow_settings');
    toast.success('Logged out successfully.');
  }, []);

  const updateUserProfile = useCallback((profileData) => {
    setUser(prev => prev ? { ...prev, ...profileData } : prev);
    toast.success('Profile updated successfully.');
  }, []);

  return (
    <AppContext.Provider value={{
      user,
      authReady,
      settings,
      setSettings,
      login,
      register,
      logout,
      updateUserProfile,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);

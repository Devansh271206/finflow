import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard,
  ArrowLeftRight,
  PieChart,
  BarChart3,
  Target,
  Sparkles,
  MessageSquare,
  FileText,
  Settings as SettingsIcon,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Search,
  Bell,
  Plus,
  TrendingUp,
  Building2,
  Users
} from 'lucide-react';
import { usePermissionContext } from '../context/PermissionContext';
import WorkspaceSwitcher from '../components/WorkspaceSwitcher';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { Select, SelectItem } from '../components/ui/Select';
import toast from 'react-hot-toast';
import { getNotifications, markNotificationAsRead } from '../services/notificationService';
import { addTransaction as addTransactionSvc } from '../services/transactionService';

export const DashboardLayout = ({ children }) => {
  const { user, settings, logout } = useApp();
  const { can } = usePermissionContext() || {};
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Dropdowns and Modals
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);

  // Quick search
  const [searchQuery, setSearchQuery] = useState('');

  // Add Transaction Form Local State
  const [txMerchant, setTxMerchant] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState('Groceries');
  const [txType, setTxType] = useState('expense');
  const [txMethod, setTxMethod] = useState('Credit Card');
  const [txStatus, setTxStatus] = useState('Completed');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);

  const navItems = [
    { name: 'Overview', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Transactions', path: '/transactions', icon: ArrowLeftRight },
    { name: 'Budgets', path: '/budgets', icon: PieChart },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
    { name: 'Goals', path: '/goals', icon: Target },
    ...(can && can('departments.read')
      ? [{ name: 'Departments', path: '/departments', icon: Building2 }]
      : []),
    ...(can && can('team.manage')
      ? [{ name: 'Team', path: '/team', icon: Users }]
      : []),
    { name: 'AI Insights', path: '/insights', icon: Sparkles },
    { name: 'AI Assistant', path: '/assistant', icon: MessageSquare },
    { name: 'Reports', path: '/reports', icon: FileText },
    { name: 'Profile', path: '/profile', icon: User },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  const [notifications, setNotifications] = useState([]);

  const loadNotifications = useCallback(async () => {
    const { data } = await getNotifications();
    setNotifications(data || []);
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAllRead = useCallback(async () => {
    const unread = notifications.filter(n => !n.is_read);
    await Promise.all(unread.map(n => markNotificationAsRead(n.id)));
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }, [notifications]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleQuickAddSubmit = async (e) => {
    e.preventDefault();
    if (!txMerchant || !txAmount) return;

    const { error } = await addTransactionSvc({
      merchant: txMerchant,
      amount: Number(txAmount),
      category: txCategory,
      type: txType,
      paymentMethod: txMethod,
      status: txStatus,
      date: txDate,
    });

    if (error) {
      toast.error('Failed to add transaction.');
      return;
    }

    toast.success('Transaction added!');

    // Reset form
    setTxMerchant('');
    setTxAmount('');
    setTxCategory('Groceries');
    setTxType('expense');
    setTxMethod('Credit Card');
    setTxStatus('Completed');
    setTxDate(new Date().toISOString().split('T')[0]);
    setIsAddTxOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#050816] text-white flex">
      {/* 1. Sidebar - Desktop */}
      <motion.aside
        animate={{ width: isSidebarCollapsed ? 88 : 280 }}
        className={`hidden md:flex flex-col fixed top-0 bottom-0 left-0 z-40 bg-[#111827] border-r border-white/5 transition-all duration-300`}
      >
        {/* Brand Header */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-white/5">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#10b981] to-emerald-400 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              <TrendingUp size={20} className="text-white" />
            </div>
            {!isSidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent"
              >
                FinFlow
              </motion.span>
            )}
          </div>
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5"
          >
            {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `
                  relative flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 group
                  ${isActive 
                    ? 'text-white bg-[#10b981]/10 border border-[#10b981]/20 shadow-[inset_0_0_12px_rgba(16,185,129,0.08)]' 
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
                  }
                `}
              >
                <div className="relative">
                  <Icon size={20} className={isActive ? 'text-[#10b981]' : 'text-slate-400 group-hover:text-white'} />
                  {isActive && (
                    <span className="absolute -left-4 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-[#10b981] rounded-r-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                  )}
                </div>
                {!isSidebarCollapsed && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {item.name}
                  </motion.span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User profile footer */}
        <div className="p-4 border-t border-white/5 bg-black/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <img
                src={user.avatar}
                alt="avatar"
                className="w-10 h-10 rounded-full object-cover border border-white/10"
              />
              {!isSidebarCollapsed && (
                <div className="text-left overflow-hidden max-w-[130px]">
                  <p className="text-sm font-bold text-white truncate">{user.name}</p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>
              )}
            </div>
            {!isSidebarCollapsed && (
              <button
                onClick={handleLogout}
                className="text-slate-400 hover:text-rose-400 p-2 rounded-lg hover:bg-white/5 transition-colors"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        </div>
      </motion.aside>

      {/* 2. Sidebar - Mobile Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute inset-0 bg-[#050816]/80 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="relative w-[280px] bg-[#111827] border-r border-white/5 flex flex-col z-10"
            >
              <div className="h-20 flex items-center justify-between px-6 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#10b981] to-emerald-400 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                    <TrendingUp size={20} className="text-white" />
                  </div>
                  <span className="text-lg font-extrabold tracking-tight">FinFlow</span>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5"
                >
                  <X size={18} />
                </button>
              </div>

              <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={({ isActive }) => `
                        flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200
                        ${isActive 
                          ? 'text-white bg-[#10b981]/10 border border-[#10b981]/20' 
                          : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
                        }
                      `}
                    >
                      <Icon size={20} className={isActive ? 'text-[#10b981]' : 'text-slate-400'} />
                      <span>{item.name}</span>
                    </NavLink>
                  );
                })}
              </nav>

              <div className="p-6 border-t border-white/5 bg-black/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={user.avatar} alt="avatar" className="w-10 h-10 rounded-full object-cover" />
                  <div className="text-left">
                    <p className="text-sm font-bold text-white">{user.name}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>
                </div>
                <button onClick={handleLogout} className="text-slate-400 hover:text-rose-400 p-2 rounded-lg">
                  <LogOut size={18} />
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div
        className="flex-1 flex flex-col transition-all duration-300"
        style={{ paddingLeft: typeof window !== 'undefined' && window.innerWidth >= 768 ? (isSidebarCollapsed ? '88px' : '280px') : '0px' }}
      >
        {/* Sticky Top Navbar */}
        <header className="sticky top-0 z-30 h-20 glass-nav flex items-center justify-between px-6 md:px-8">
          {/* Left: Mobile Menu Toggle / Brand (Mobile) */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/5"
            >
              <Menu size={20} />
            </button>

            {/* Global Search */}
            <div className="hidden sm:flex items-center relative w-64 md:w-80">
              <Search className="absolute left-4 text-slate-500" size={16} />
              <input
                type="text"
                placeholder="Search transactions, budgets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    navigate(`/transactions?search=${searchQuery}`);
                  }
                }}
                className="w-full bg-white/5 border border-white/10 focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/30 rounded-xl py-2 pl-11 pr-4 text-xs text-white placeholder-slate-500 outline-none transition-all duration-200"
              />
            </div>
          </div>

          {/* Right: Quick actions, notifications, profile */}
          <div className="flex items-center gap-3">
            {/* Workspace Switcher */}
            <WorkspaceSwitcher />

            {/* Quick Add Button */}
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddTxOpen(true)}
              className="h-9 px-3 text-xs md:px-4 md:text-sm rounded-lg"
            >
              <Plus size={16} className="mr-1.5" />
              <span className="hidden sm:inline">Transaction</span>
            </Button>

            {/* AI Assistant Quick Link */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/assistant')}
              className="h-9 w-9 p-0 flex items-center justify-center rounded-lg"
              title="AI Assistant"
            >
              <MessageSquare size={16} />
            </Button>

            {/* Notifications Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setIsNotificationOpen(!isNotificationOpen);
                  setIsProfileOpen(false);
                }}
                className={`relative h-9 w-9 rounded-lg flex items-center justify-center border border-white/15 bg-white/5 hover:bg-white/10 transition-colors text-slate-300 hover:text-white ${isNotificationOpen ? 'bg-white/10 border-emerald-500/30 text-white' : ''}`}
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                )}
              </button>

              <AnimatePresence>
                {isNotificationOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-80 rounded-2xl bg-[#111827] border border-white/10 shadow-2xl p-4 z-50 text-left"
                  >
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
                      <span className="text-sm font-bold text-white">Notifications</span>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllRead}
                          className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="space-y-3">
                      {notifications.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-4">No notifications</p>
                      ) : notifications.slice(0, 5).map(n => (
                        <div key={n.id} className={`p-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer ${!n.is_read ? 'bg-white/[0.02]' : ''}`}>
                          <div className="flex items-center justify-between mb-0.5">
                            <h4 className={`text-xs font-semibold ${!n.is_read ? 'text-white' : 'text-slate-300'}`}>
                              {n.title || n.message}
                            </h4>
                            <span className="text-[10px] text-slate-500">
                              {n.created_at ? new Date(n.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : ''}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">{n.description || n.body || n.message}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setIsProfileOpen(!isProfileOpen);
                  setIsNotificationOpen(false);
                }}
                className="flex items-center gap-2 border border-white/10 rounded-full p-1 pl-1 pr-3 hover:bg-white/5 transition-colors"
              >
                <img
                  src={user.avatar}
                  alt="avatar"
                  className="w-7 h-7 rounded-full object-cover"
                />
                <span className="hidden lg:inline text-xs font-semibold text-slate-300 truncate max-w-[80px]">
                  {user.name.split(' ')[0]}
                </span>
              </button>

              <AnimatePresence>
                {isProfileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-56 rounded-2xl bg-[#111827] border border-white/10 shadow-2xl p-2.5 z-50 text-left"
                  >
                    <div className="px-3 py-2 pb-2 border-b border-white/5 mb-1">
                      <p className="text-sm font-bold text-white">{user.name}</p>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        navigate('/profile');
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-2"
                    >
                      <User size={14} /> My Profile
                    </button>
                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        navigate('/settings');
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-2"
                    >
                      <SettingsIcon size={14} /> Account Settings
                    </button>
                    <div className="h-[1px] bg-white/5 my-1" />
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"
                    >
                      <LogOut size={14} /> Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Main Content Body */}
        <main className="flex-1 p-6 md:p-8 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Quick Add Transaction Modal */}
      <Modal isOpen={isAddTxOpen} onClose={() => setIsAddTxOpen(false)} title="Quick Add Transaction">
        <form onSubmit={handleQuickAddSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 p-1 bg-white/5 rounded-xl">
            <button
              type="button"
              onClick={() => setTxType('expense')}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${txType === 'expense' ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30' : 'text-slate-400'}`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setTxType('income')}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${txType === 'income' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400'}`}
            >
              Income
            </button>
          </div>

          <Input
            label="Merchant / Source"
            placeholder="e.g. Stripe, AWS, Starbucks"
            value={txMerchant}
            onChange={(e) => setTxMerchant(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={`Amount (${settings.currency})`}
              type="number"
              step="0.01"
              placeholder="0.00"
              value={txAmount}
              onChange={(e) => setTxAmount(e.target.value)}
              required
            />

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Category</label>
              <Select
                value={txCategory}
                onChange={(e) => setTxCategory(e.target.value)}
              >
                {txType === 'income' ? (
                  <>
                    <SelectItem value="Salary">Salary</SelectItem>
                    <SelectItem value="Investment">Investment</SelectItem>
                    <SelectItem value="Freelance">Freelance</SelectItem>
                    <SelectItem value="Refund">Refund</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="Groceries">Groceries</SelectItem>
                    <SelectItem value="Software">Software</SelectItem>
                    <SelectItem value="Dining Out">Dining Out</SelectItem>
                    <SelectItem value="Shopping">Shopping</SelectItem>
                    <SelectItem value="Transport">Transport</SelectItem>
                    <SelectItem value="Travel">Travel</SelectItem>
                    <SelectItem value="Entertainment">Entertainment</SelectItem>
                  </>
                )}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Payment Method</label>
              <Select
                value={txMethod}
                onChange={(e) => setTxMethod(e.target.value)}
              >
                <SelectItem value="Credit Card">Credit Card</SelectItem>
                <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                <SelectItem value="Apple Pay">Apple Pay</SelectItem>
                <SelectItem value="PayPal">PayPal</SelectItem>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Date</label>
              <input
                type="date"
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 text-white text-sm py-3 px-4 outline-none focus:border-[#10b981]/50 transition-all duration-200"
              />
            </div>
          </div>

          <Button type="submit" className="w-full justify-center">
            Save Transaction
          </Button>
        </form>
      </Modal>
    </div>
  );
};

export default DashboardLayout;
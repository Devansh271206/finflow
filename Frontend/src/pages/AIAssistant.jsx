import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { getTransactions } from '../services/transactionService';
import { getBudgets } from '../services/budgetService';

const CHAT_SUGGESTIONS = [
  'How much did I spend this month?',
  'What is my biggest expense category?',
  'Am I on budget?',
  'How much have I saved?',
  'What are my recent transactions?',
];

export const AIAssistant = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: "Hello! I am your **FinFlow AI Assistant**. I have access to your live transactions and budgets. Ask me anything about your spending, savings, or financial health.",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Load live data for context-aware responses
  useEffect(() => {
    async function loadData() {
      const [txRes, budgetRes] = await Promise.all([getTransactions(), getBudgets()]);
      setTransactions(txRes.data || []);
      setBudgets(budgetRes.data || []);
    }
    loadData();
  }, []);

  const formatTime = () =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Generate context-aware responses from live data
  const generateAIResponse = useCallback((query) => {
    const q = query.toLowerCase();
    const expenses = transactions.filter(t => t.type !== 'income');
    const income = transactions.filter(t => t.type === 'income');
    const totalExpenses = expenses.reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0);
    const totalIncome = income.reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0);
    const netCashflow = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? Math.round((netCashflow / totalIncome) * 100) : 0;

    if (transactions.length === 0) {
      return "I don't see any transactions in your account yet. Start adding transactions to get personalized insights!";
    }

    // Category breakdown
    const catMap = new Map();
    expenses.forEach(t => {
      const cat = t.category || 'Uncategorized';
      catMap.set(cat, (catMap.get(cat) || 0) + Math.abs(Number(t.amount || 0)));
    });
    const sortedCats = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]);
    const topCat = sortedCats[0];

    if (q.includes('spend') || q.includes('spent') || q.includes('expense') || q.includes('outflow')) {
      const catList = sortedCats.slice(0, 3).map(([cat, amt]) => `- **${cat}**: ₹${amt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`).join('\n');
      return `You have spent **₹${totalExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}** in total.\n\nTop spending categories:\n${catList || 'No categories yet.'}`;
    }

    if (q.includes('income') || q.includes('earn') || q.includes('salary') || q.includes('inflow')) {
      return `Your total recorded income is **₹${totalIncome.toLocaleString('en-IN', { maximumFractionDigits: 0 })}** across ${income.length} transaction${income.length !== 1 ? 's' : ''}.`;
    }

    if (q.includes('save') || q.includes('saving') || q.includes('savings')) {
      return `Your net savings (income minus expenses) is **₹${netCashflow.toLocaleString('en-IN', { maximumFractionDigits: 0 })}**, representing a **${savingsRate}%** savings rate.${savingsRate >= 30 ? ' Excellent work!' : savingsRate >= 15 ? ' Good, aim for 30%!' : ' Try to increase your savings rate to 15% or more.'}`;
    }

    if (q.includes('budget') || q.includes('limit') || q.includes('over')) {
      if (budgets.length === 0) {
        return "You haven't set up any budgets yet. Visit the **Budgets** page to configure spending limits for each category.";
      }
      const overBudget = budgets.filter(b => b.spent > b.limit);
      const underBudget = budgets.filter(b => b.spent <= b.limit);
      return `You have **${budgets.length}** active budgets.\n- **${overBudget.length}** over limit: ${overBudget.map(b => b.category).join(', ') || 'None'}\n- **${underBudget.length}** under limit: ${underBudget.map(b => b.category).join(', ') || 'None'}`;
    }

    if (q.includes('biggest') || q.includes('largest') || q.includes('most') || q.includes('category')) {
      if (!topCat) return "No expense data found yet.";
      return `Your biggest expense category is **${topCat[0]}** with ₹${topCat[1].toLocaleString('en-IN', { maximumFractionDigits: 0 })} spent.`;
    }

    if (q.includes('recent') || q.includes('transaction') || q.includes('last')) {
      const recent = [...transactions]
        .sort((a, b) => new Date(b.transaction_date || b.created_at || 0) - new Date(a.transaction_date || a.created_at || 0))
        .slice(0, 3);
      if (recent.length === 0) return "No transactions found.";
      const list = recent.map(t => `- **${t.merchant || t.title}** (${t.category}): ₹${Math.abs(Number(t.amount || 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`).join('\n');
      return `Your 3 most recent transactions:\n${list}`;
    }

    if (q.includes('health') || q.includes('score') || q.includes('how am i')) {
      const score = Math.min(100, Math.max(10, 60 + (savingsRate > 20 ? 15 : 0) + (budgets.length > 0 ? 10 : 0)));
      return `Your financial health score is approximately **${score}/100**.\n- Savings rate: ${savingsRate}%\n- Active budgets: ${budgets.length}\n- Total transactions tracked: ${transactions.length}`;
    }

    return `I can see you asked about **"${query}"**. Based on your data:\n- Total income: ₹${totalIncome.toLocaleString('en-IN', { maximumFractionDigits: 0 })}\n- Total expenses: ₹${totalExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}\n- Net savings: ₹${netCashflow.toLocaleString('en-IN', { maximumFractionDigits: 0 })}\n\nTry asking about "spending by category", "savings rate", or "budget status"!`;
  }, [transactions, budgets]);

  const handleSendMessage = useCallback((textToSend) => {
    if (!textToSend.trim()) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: textToSend,
      time: formatTime(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    setTimeout(() => {
      const aiReply = generateAIResponse(textToSend);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'ai',
        text: aiReply,
        time: formatTime(),
      }]);
      setIsTyping(false);
    }, 1000);
  }, [generateAIResponse]);

  // Render markdown-style bold and bullet lists
  const renderMessageText = (text) => {
    return text.split('\n').map((line, index) => {
      const boldRegex = /\*\*(.*?)\*\*/g;
      const parts = [];
      let lastIndex = 0;
      let match;

      while ((match = boldRegex.exec(line)) !== null) {
        if (match.index > lastIndex) parts.push(line.substring(lastIndex, match.index));
        parts.push(<strong key={match.index} className="text-[#10b981] font-extrabold">{match[1]}</strong>);
        lastIndex = boldRegex.lastIndex;
      }
      if (lastIndex < line.length) parts.push(line.substring(lastIndex));
      const content = parts.length > 0 ? parts : line;

      if (line.startsWith('- ')) {
        return <li key={index} className="list-disc ml-5 mt-1 text-slate-300">{line.substring(2)}</li>;
      }
      return <p key={index} className="min-h-[1.2rem] leading-relaxed mt-1 text-slate-300">{content}</p>;
    });
  };

  return (
    <div className="h-[80vh] flex flex-col justify-between max-w-4xl mx-auto bg-[#111827] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
      {/* Top Banner */}
      <div className="p-4 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#10b981] to-emerald-400 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">AI Financial Assistant</h2>
            <p className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {transactions.length > 0 ? `${transactions.length} transactions analysed` : 'Loading data…'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <AnimatePresence initial={false}>
          {messages.map(m => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className="flex items-start gap-2.5 max-w-[80%]">
                {m.sender === 'ai' && (
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                    <Sparkles size={14} />
                  </div>
                )}
                <div className="space-y-1">
                  <div className={`p-4 rounded-2xl text-xs text-left ${m.sender === 'user' ? 'bg-[#10b981] text-white rounded-tr-none' : 'bg-white/5 border border-white/5 rounded-tl-none'}`}>
                    {m.sender === 'user' ? m.text : renderMessageText(m.text)}
                  </div>
                  <p className={`text-[9px] text-slate-500 ${m.sender === 'user' ? 'text-right' : 'text-left'}`}>{m.time}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <Sparkles size={14} />
              </div>
              <div className="bg-white/5 border border-white/5 p-4 rounded-2xl rounded-tl-none flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Suggested prompts */}
      {messages.length === 1 && (
        <div className="px-6 py-3 border-t border-white/5 bg-black/10 flex flex-wrap gap-2 text-left">
          <p className="text-[10px] font-bold text-slate-500 w-full mb-1 uppercase tracking-wider">Suggested Questions</p>
          {CHAT_SUGGESTIONS.map((s, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(s)}
              className="text-[11px] font-bold text-slate-300 hover:text-white bg-white/5 border border-white/5 hover:border-[#10b981]/30 hover:bg-[#10b981]/5 px-3 py-1.5 rounded-xl transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-white/5 bg-white/[0.01]">
        <form
          onSubmit={e => { e.preventDefault(); handleSendMessage(inputText); }}
          className="flex gap-2"
        >
          <input
            type="text"
            placeholder="Ask about spending, savings, budgets, or transactions…"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/30 rounded-xl py-3 px-4 text-xs text-white placeholder-slate-500 outline-none transition-all duration-200"
          />
          <Button type="submit" className="w-11 h-11 p-0 flex items-center justify-center">
            <Send size={16} />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AIAssistant;

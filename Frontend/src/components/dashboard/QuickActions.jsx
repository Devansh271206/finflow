import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../ui/Card';
import Button from '../ui/Button';

/**
 * Sprint 10 — Role-Based Dashboard System.
 *
 * Shared "Quick Actions" widget. Deliberately static/client-side —
 * these are just navigation shortcuts ("Add Employee", "New Expense",
 * etc.), not data, so there's no reason for roleDashboardService.js
 * (backend) to compute or return them; each dashboard page passes its
 * own role-relevant `actions` array and this component just renders
 * the buttons and wires them to react-router's navigate(), the same
 * way the rest of this codebase already navigates (see
 * EmployeeDetails.jsx / Login.jsx's useNavigate usage).
 *
 * `actions` — array of { label, path, icon (optional lucide-react
 * component), variant (optional Button variant, defaults 'secondary') }.
 */
export default function QuickActions({ actions = [], title = 'Quick Actions' }) {
  const navigate = useNavigate();

  if (!actions.length) return null;

  return (
    <Card>
      <h3 className="text-sm font-semibold text-slate-300 mb-4">{title}</h3>
      <div className="flex flex-wrap gap-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.label}
              variant={action.variant || 'secondary'}
              size="sm"
              onClick={() => navigate(action.path)}
              className="gap-2"
            >
              {Icon && <Icon size={16} />}
              {action.label}
            </Button>
          );
        })}
      </div>
    </Card>
  );
}

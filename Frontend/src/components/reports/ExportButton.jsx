import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';
import Button from '../ui/Button';
import { exportReportCsv } from '../../services/reportService';

/**
 * Export Button
 * ------------------------------------------------------------------
 * Self-contained CSV export trigger — owns its own loading state and
 * success/error toast, so any report page can drop it in without
 * repeating that wiring. Exports whatever `filterParams` the caller is
 * currently viewing (same shape `ReportFilterPanel.jsx`/`ReportViewer.jsx`
 * build for `getReportData`), so the export always matches what's on
 * screen, not just the current page of rows.
 */
export function ExportButton({ reportId, filterParams = {}, disabled = false, label = 'Export CSV' }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    const { error } = await exportReportCsv(reportId, filterParams);
    setExporting(false);

    if (error) {
      toast.error(error.message || 'Failed to export report.');
      return;
    }
    toast.success('Report exported.');
  };

  return (
    <Button variant="secondary" size="sm" onClick={handleExport} loading={exporting} disabled={disabled}>
      <Download size={14} className="mr-1.5" /> {label}
    </Button>
  );
}

export default ExportButton;

import React, { useEffect, useState } from 'react';
import { FileText, Download, FileCheck2 } from 'lucide-react';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import Skeleton from '../../../components/ui/Skeleton';
import EmptyState from '../../../components/ui/EmptyState';
import { listEmployeeDocuments } from '../../../services/employeeDocumentService';

const DOCUMENT_TYPE_LABEL = {
  offer_letter: 'Offer Letter',
  id_proof: 'ID Proof',
  contract: 'Contract',
  certification: 'Certification',
  other: 'Other',
};

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return value;
  }
}

/**
 * My Documents tab — lists the employee's own uploaded documents
 * (offer letter, ID proof, contracts, certifications, other) with
 * download links. Read-only: uploading/deleting stays with HR/Admin
 * via Employee Management, per the PRD ("Download where permitted").
 *
 * Backed by GET /api/employees/:employeeId/documents, which now
 * allows self-access without EMPLOYEES_READ (see
 * employeeDocumentRoutes.js). Each item's `url` is a short-lived
 * signed URL (~5 min per employeeDocumentService.js) generated fresh
 * on every list call — this component re-fetches on mount only, so a
 * download attempted long after the tab loaded should be preceded by
 * a refresh; simplest fix here is just re-fetching before opening.
 */
export function MyDocumentsTab({ employee }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openingId, setOpeningId] = useState(null);

  async function loadDocuments() {
    if (!employee?.id) return;
    setLoading(true);
    const { data, error: fetchError } = await listEmployeeDocuments(employee.id);
    setDocuments(Array.isArray(data) ? data : []);
    setError(fetchError);
    setLoading(false);
  }

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id]);

  // Signed URLs are short-lived — re-fetch the list right before
  // opening to guarantee a fresh link rather than relying on
  // whatever was fetched when the tab first mounted.
  async function handleOpen(doc) {
    setOpeningId(doc.id);
    const { data } = await listEmployeeDocuments(employee.id);
    const fresh = Array.isArray(data) ? data.find((d) => d.id === doc.id) : null;
    setOpeningId(null);
    if (fresh?.url) {
      window.open(fresh.url, '_blank', 'noopener,noreferrer');
    }
  }

  if (loading) {
    return <Skeleton variant="rect" className="h-64" />;
  }

  if (error && documents.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Couldn't load documents"
        description={typeof error === 'string' ? error : error?.message || 'Please try again later.'}
      />
    );
  }

  return (
    <Card>
      <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
        <FileText size={16} className="text-slate-500" />
        My Documents
      </h3>

      {documents.length === 0 ? (
        <EmptyState
          icon={FileCheck2}
          title="No documents yet"
          description="Your offer letter, tax documents, and other files will appear here once HR uploads them."
        />
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <FileText size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {DOCUMENT_TYPE_LABEL[doc.documentType] || doc.documentType}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Added {formatDate(doc.createdAt)}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleOpen(doc)}
                loading={openingId === doc.id}
                disabled={openingId === doc.id}
              >
                <Download size={14} className="mr-1.5" />
                Download
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default MyDocumentsTab;

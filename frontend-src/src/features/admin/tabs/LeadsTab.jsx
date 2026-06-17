// LeadsTab — consumer + B2B lead CRM. Extracted from Admin.jsx (Phase D) and on
// React Query (list + converted-meta + add/edit/delete via cache). Shared lead
// constants, Lbl and exportCSV moved to ../leadConstants.jsx / ../components/Lbl.jsx
// so this file no longer reaches into the monolith.
import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { admin } from '../../../lib/api.js';
import { fmt, daysAgo } from '@bondly/ui/lib/format.js';
import { useAdminLeads } from '../hooks/useAdminQueries.js';
import Lbl from '../components/Lbl.jsx';
import { LEAD_STAGES, B2B_STAGES, SOURCE_LABELS, EMPTY_LEAD, B2B_EMPTY_LEAD, ASSIGNEES, isB2bLead, exportCSV } from '../leadConstants.jsx';

export default function LeadsTab({ showToast, initialSelectedId, onClearJump }) {
  const qc = useQueryClient();
  const [selected, setSelected]   = useState(initialSelectedId || null);
  const [search, setSearch]       = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [addOpen, setAddOpen]     = useState(false);
  const [addForm, setAddForm]     = useState(EMPTY_LEAD);
  const [addLoading, setAddLoading] = useState(false);
  const [viewMode, setViewMode]   = useState('b2c'); // 'b2c' | 'b2b'
  const [showConverted,  setShowConverted]  = useState(false);

  // Leads list + converted-meta now come from React Query. The same endpoint
  // returns { leads, convertedCount, totalAll }; toggling showConverted re-keys
  // the query so the list and the "N converted leads hidden" copy stay in sync.
  const leadsKey = ['admin', 'leads', { includeConverted: showConverted }];
  const { data: leadsData } = useAdminLeads(showConverted);
  const leads = leadsData?.leads || [];
  const convertedMeta = { convertedCount: leadsData?.convertedCount || 0, totalAll: leadsData?.totalAll || 0 };
  function toggleConverted() { setShowConverted(v => !v); }

  const selectedLead = leads.find(l => l.id === selected) || null;

  useEffect(() => {
    if (initialSelectedId) { setSelected(initialSelectedId); onClearJump?.(); }
  }, [initialSelectedId]);

  // Close drawer on Escape key
  useEffect(() => {
    if (!selected) return;
    function onKey(e) { if (e.key === 'Escape') setSelected(null); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const isB2b = viewMode === 'b2b';
  const activeStages = isB2b ? B2B_STAGES : LEAD_STAGES;
  const visibleLeads = leads.filter(l => isB2b ? isB2bLead(l) : !isB2bLead(l));

  const totalCommission    = visibleLeads.filter(l => l.status === 'converted' && l.currentBalance).reduce((s, l) => s + Math.round(l.currentBalance * 0.005), 0);
  const pipelineCommission = visibleLeads.filter(l => ['qualified','sent_to_broker'].includes(l.status) && l.currentBalance).reduce((s, l) => s + Math.round(l.currentBalance * 0.005), 0);
  const newToday = visibleLeads.filter(l => new Date(l.createdAt).toDateString() === new Date().toDateString()).length;
  const repliedCount = visibleLeads.filter(l => l.repliedAt).length;
  const q = search.toLowerCase();
  const matchesSearch = l => !q || [l.name, l.phone, l.email, l.currentBank, l.company].some(v => v?.toLowerCase().includes(q));

  async function updateLead(id, patch) {
    try {
      const updated = await admin.updateLead(id, patch);
      qc.setQueryData(leadsKey, old => old ? { ...old, leads: old.leads.map(l => l.id === id ? updated : l) } : old);
      return updated;
    } catch (err) { showToast(err.message || 'Could not update', 'error'); throw err; }
  }

  async function deleteLead(id) {
    if (!window.confirm('Delete this lead permanently?')) return;
    try {
      await admin.deleteLead(id);
      qc.setQueryData(leadsKey, old => old ? { ...old, leads: old.leads.filter(l => l.id !== id) } : old);
      setSelected(null);
      showToast('Lead deleted', 'info');
    } catch (err) { showToast(err.message || 'Failed to delete', 'error'); }
  }

  async function saveNote() {
    const note = noteInput.trim();
    if (!note || !selectedLead) return;
    const existing = selectedLead.brokerNotes ? selectedLead.brokerNotes + '\n' : '';
    const ts = new Date().toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' });
    await updateLead(selectedLead.id, { brokerNotes: `${existing}[${ts}] ${note}` });
    setNoteInput('');
    showToast('Note saved', 'success');
  }

  async function handleAddLead(e) {
    e.preventDefault();
    if (!addForm.name.trim() || (!addForm.phone.trim() && !addForm.email.trim())) { showToast('Name and phone or email required', 'error'); return; }
    if (addForm.phone.trim() && !/^(\+27|0)[6-8]\d{8}$/.test(addForm.phone.trim().replace(/\s/g, ''))) { showToast('Enter a valid SA mobile number (e.g. 0821234567)', 'error'); return; }
    if (addForm.email.trim() && !addForm.email.includes('@')) { showToast('Enter a valid email address', 'error'); return; }
    setAddLoading(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addForm, currentBalance: parseFloat(addForm.currentBalance) || undefined, currentRate: parseFloat(addForm.currentRate) || undefined, currentTerm: parseInt(addForm.currentTerm) || undefined, monthlyIncome: parseFloat(addForm.monthlyIncome) || undefined }),
      }).then(r => r.json());
      if (!res.success) throw new Error(res.error || 'Failed');
      await qc.invalidateQueries({ queryKey: ['admin', 'leads'] });
      setAddOpen(false);
      setAddForm(EMPTY_LEAD);
      showToast('Lead added', 'success');
    } catch (err) { showToast(err.message || 'Could not add', 'error'); }
    finally { setAddLoading(false); }
  }

  return (
    <div className="fade-in" style={{ position: 'relative' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* View toggle */}
        <div style={{ display: 'flex', borderRadius: 8, border: '1.5px solid var(--border-color)', overflow: 'hidden', flexShrink: 0 }}>
          {[['b2c', '🏠 Homeowners'], ['b2b', '🏢 B2B']].map(([mode, label]) => (
            <button key={mode} onClick={() => { setViewMode(mode); setSelected(null); }}
              style={{ padding: '7px 14px', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 700,
                background: viewMode === mode ? 'var(--forest)' : 'var(--bg-card)',
                color: viewMode === mode ? '#fff' : 'var(--text-secondary)' }}>
              {label}
            </button>
          ))}
        </div>
        <input type="search" placeholder={isB2b ? 'Search company, name, email…' : 'Search name, phone, email, bank…'} value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.875rem', width: 240 }} />
        <button onClick={() => exportCSV(visibleLeads)} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: '0.8125rem', cursor: 'pointer', fontWeight: 600 }}>⬇ CSV</button>
        <button onClick={() => { setAddForm(isB2b ? B2B_EMPTY_LEAD : EMPTY_LEAD); setAddOpen(true); }}
          style={{ padding: '8px 18px', borderRadius: 8, background: 'var(--forest)', color: '#fff', border: 'none', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 700 }}>
          + {isB2b ? 'Add B2B lead' : 'Add lead'}
        </button>
      </div>

      {/* Converted-lead banner — surfaces what was hidden by the dedupe so
          the admin trusts the count instead of suspecting missing records. */}
      {convertedMeta.convertedCount > 0 && (
        <div className="adm-notice">
          <span>
            Hiding <strong>{convertedMeta.convertedCount}</strong> lead{convertedMeta.convertedCount === 1 ? '' : 's'} that already became registered customers
            {!showConverted && convertedMeta.totalAll > 0 && (
              <> &middot; {convertedMeta.totalAll - convertedMeta.convertedCount} unconverted of {convertedMeta.totalAll} total</>
            )}.
          </span>
          <button className="adm-notice__action" onClick={toggleConverted}>
            {showConverted ? 'Hide converted' : 'Show all'} →
          </button>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 24 }}>
        {(isB2b ? [
          { label: 'Total B2B',       value: visibleLeads.length },
          { label: 'New today',       value: newToday },
          { label: 'Replied',         value: repliedCount },
          { label: 'Active pipeline', value: visibleLeads.filter(l => ['contacted','meeting_booked','proposal_sent'].includes(l.status)).length },
          { label: 'Won',             value: visibleLeads.filter(l => l.status === 'won').length },
        ] : [
          { label: 'Total',            value: visibleLeads.length },
          { label: 'New today',        value: newToday },
          { label: 'Active pipeline',  value: visibleLeads.filter(l => ['contacted','qualified','sent_to_broker'].includes(l.status)).length },
          { label: 'Pipeline commission', value: fmt(pipelineCommission) },
          { label: 'Earned commission',   value: fmt(totalCommission) },
        ]).map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: '1.375rem', fontWeight: 800 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Kanban */}
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16, alignItems: 'flex-start' }}>
        {activeStages.map(stage => {
          const col = visibleLeads.filter(l => l.status === stage.value && matchesSearch(l));
          return (
            <div key={stage.value} style={{ minWidth: 240, maxWidth: 260, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '6px 10px', borderRadius: 8, background: `${stage.color}18`, border: `1.5px solid ${stage.color}30` }}>
                <span>{stage.icon}</span>
                <span style={{ fontWeight: 700, fontSize: '0.875rem', color: stage.color }}>{stage.label}</span>
                <span style={{ marginLeft: 'auto', background: stage.color, color: '#fff', borderRadius: 999, padding: '1px 8px', fontSize: '0.75rem', fontWeight: 700 }}>{col.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {col.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px 8px', color: 'var(--text-secondary)', fontSize: '0.8125rem', border: '1.5px dashed var(--border-color)', borderRadius: 8 }}>Empty</div>
                )}
                {col.map(lead => {
                  const commission = lead.currentBalance ? Math.round(lead.currentBalance * 0.005) : null;
                  const isSel = selected === lead.id;
                  return (
                    <div key={lead.id} onClick={() => { setSelected(lead.id); setNoteInput(''); }}
                      style={{ background: 'var(--bg-card)', borderTop: `1.5px solid ${isSel ? stage.color : 'var(--border-color)'}`, borderRight: `1.5px solid ${isSel ? stage.color : 'var(--border-color)'}`, borderBottom: `1.5px solid ${isSel ? stage.color : 'var(--border-color)'}`, borderLeft: `4px solid ${stage.color}`, borderRadius: 8, padding: 12, cursor: 'pointer', boxShadow: isSel ? `0 0 0 2px ${stage.color}40` : 'var(--shadow-sm)', transition: 'all 0.15s' }}>
                      {isB2b ? (
                        <>
                          <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: 2 }}>{lead.company || lead.name || '—'}</div>
                          {lead.company && lead.name && <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 2 }}>👤 {lead.name}</div>}
                          {lead.email && <div style={{ fontSize: '0.8125rem', color: 'var(--mint)', marginBottom: 2 }}>✉ {lead.email}</div>}
                          {lead.repliedAt && (
                            <div style={{ marginTop: 4, padding: '4px 7px', background: '#16a34a10', border: '1px solid #16a34a30', borderRadius: 4 }}>
                              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#16a34a', marginBottom: 1 }}>📬 Replied {daysAgo(lead.repliedAt)}</div>
                              {lead.lastEmailSubject && <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.lastEmailSubject}</div>}
                            </div>
                          )}
                          {lead.dealValue > 0 && <div style={{ marginTop: 4, fontSize: '0.75rem', fontWeight: 700, color: '#16a34a' }}>{fmt(lead.dealValue)}</div>}
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                            {lead.assignedTo && lead.assignedTo !== 'Unassigned' ? <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>👤 {lead.assignedTo}</span> : <span />}
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{daysAgo(lead.createdAt)}</span>
                          </div>
                          {lead.followUpAt && new Date(lead.followUpAt) < new Date() && (
                            <div style={{ marginTop: 3, fontSize: '0.7rem', color: '#ef4444', fontWeight: 700 }}>⚠ Follow-up overdue</div>
                          )}
                        </>
                      ) : (
                        <>
                          <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: 4 }}>{lead.name || '—'}</div>
                          {lead.phone && <div style={{ fontSize: '0.8125rem', color: 'var(--mint)', marginBottom: 2 }}>💬 {lead.phone}</div>}
                          {lead.currentBank && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 2 }}>{lead.currentBank}{lead.currentBalance ? ` · ${fmt(lead.currentBalance)}` : ''}</div>}
                          {lead.monthlyIncome > 0 && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 2 }}>
                              Income: <strong style={{ color: 'var(--text-primary)' }}>{fmt(lead.monthlyIncome)}</strong>
                              {lead.maxBond > 0 && <> · Max bond: <strong style={{ color: 'var(--text-primary)' }}>{fmt(lead.maxBond)}</strong></>}
                              {lead.affordabilityZone?.zone && (() => {
                                const z = lead.affordabilityZone.zone;
                                const zc = z==='green'?'#16a34a':z==='yellow'?'#d97706':'#ef4444';
                                return <span style={{ marginLeft:4, padding:'1px 5px', borderRadius:4, fontSize:'0.7rem', fontWeight:700, background:`${zc}18`, color:zc }}>{lead.affordabilityZone.label}</span>;
                              })()}
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                            {commission ? <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a' }}>~{fmt(commission)}</span> : <span />}
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{daysAgo(lead.createdAt)}</span>
                          </div>
                          {lead.phone && (
                            <a href={`https://wa.me/${lead.phone.replace(/\D/g,'')}?text=Hi+${encodeURIComponent(lead.name?.split(' ')[0]||'')}%2C+this+is+Bondly+following+up+on+your+bond+enquiry.`}
                              target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 4, fontSize: '0.7125rem', color: '#128C7E', textDecoration: 'none', padding: '2px 7px', background: '#25D36618', border: '1px solid #25D36630', borderRadius: 4, fontWeight: 600 }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                              WA
                            </a>
                          )}
                          {lead.followUpAt && new Date(lead.followUpAt) < new Date() && (
                            <div style={{ marginTop: 3, fontSize: '0.7rem', color: '#ef4444', fontWeight: 700 }}>⚠ Follow-up overdue</div>
                          )}
                          {lead.assignedTo && lead.assignedTo !== 'Unassigned' && <div style={{ marginTop: 3, fontSize: '0.7rem', color: 'var(--text-secondary)' }}>👤 {lead.assignedTo}</div>}
                          {lead.referredBy && <div style={{ marginTop: 3, fontSize: '0.7rem', color: 'var(--text-secondary)' }}>🏘 {lead.referredBy}</div>}
                          {lead.brokerNotes && <div style={{ marginTop: 3, fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>📝 {lead.brokerNotes.split('\n').pop()}</div>}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail drawer */}
      {selectedLead && (
        <>
          <div className="lead-drawer-overlay" onClick={() => setSelected(null)} />
          <div className="lead-drawer">
            {/* Sticky header */}
            <div className="lead-drawer__header">
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', margin: 0, lineHeight: 1.2 }}>{selectedLead.name || 'Unknown'}</h3>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                  {SOURCE_LABELS[selectedLead.source] || selectedLead.source} · {daysAgo(selectedLead.createdAt)}
                  {selectedLead.status && (
                    <span style={{ marginLeft: 8, padding: '2px 7px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 700,
                      background: (LEAD_STAGES.find(s => s.value === selectedLead.status)?.color || '#9ca3af') + '20',
                      color: LEAD_STAGES.find(s => s.value === selectedLead.status)?.color || '#9ca3af' }}>
                      {LEAD_STAGES.find(s => s.value === selectedLead.status)?.icon} {LEAD_STAGES.find(s => s.value === selectedLead.status)?.label || selectedLead.status}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, marginLeft: 12 }}>
                <button className="lead-drawer__delete" onClick={() => deleteLead(selectedLead.id)}>Delete</button>
                <button className="lead-drawer__close" onClick={() => setSelected(null)} title="Close (Esc)">×</button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="lead-drawer__body">
              {/* Contact actions */}
              <div style={{ display: 'grid', gap: 8 }}>
                {selectedLead.phone && (
                  <a href={`https://wa.me/${selectedLead.phone.replace(/\D/g,'')}?text=Hi ${encodeURIComponent(selectedLead.name?.split(' ')[0]||'')}%2C+this+is+Bondly+following+up+on+your+bond+switch+enquiry.`}
                    target="_blank" rel="noopener noreferrer"
                    className="lead-contact-btn"
                    style={{ background: '#25D36618', border: '1.5px solid #25D36640', color: '#128C7E' }}>
                    💬 {selectedLead.phone} <span style={{ marginLeft: 'auto', fontSize: '0.75rem', opacity: 0.8 }}>WhatsApp →</span>
                  </a>
                )}
                {selectedLead.email && (
                  <a href={`mailto:${selectedLead.email}`}
                    className="lead-contact-btn"
                    style={{ border: '1.5px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 400 }}>
                    ✉️ {selectedLead.email}
                  </a>
                )}
              </div>

              {/* Bond details */}
              {selectedLead.currentBank && (
                <div style={{ background: 'var(--bg-page)', borderRadius: 8, padding: 16 }}>
                  <Lbl>Bond Details</Lbl>
                  <div className="lead-bond-grid">
                    {[['Bank', selectedLead.currentBank], ['Balance', selectedLead.currentBalance ? fmt(selectedLead.currentBalance) : null], ['Rate', selectedLead.currentRate ? `${selectedLead.currentRate}%` : null], ['Remaining', selectedLead.currentTerm ? `${selectedLead.currentTerm} yrs` : null], ['Income', selectedLead.monthlyIncome ? fmt(selectedLead.monthlyIncome) : null], ['Employment', selectedLead.employment ? selectedLead.employment.replace(/_/g,' ').replace(/\b\w/g,ch=>ch.toUpperCase()) : null]].filter(([,v])=>v).map(([label, value]) => (
                      <div key={label}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontWeight: 600 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  {selectedLead.currentBalance && (
                    <div style={{ marginTop: 12, padding: 10, background: '#f0fdf4', borderRadius: 6, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.8125rem', color: '#15803d' }}>Est. commission</span>
                      <span style={{ fontWeight: 800, color: '#16a34a', fontSize: '1.125rem' }}>~{fmt(Math.round(selectedLead.currentBalance * 0.005))}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Pre-approval financial data */}
              {(selectedLead.maxBond > 0 || selectedLead.affordabilityZone?.zone || selectedLead.statementVerified) && (
                <div style={{ background: 'var(--bg-page)', borderRadius: 8, padding: 16 }}>
                  <Lbl style={{ display:'flex', alignItems:'center', gap:8 }}>
                    Pre-Approval Data
                    {selectedLead.statementVerified && <span style={{ padding:'1px 7px', borderRadius:10, fontSize:'0.7rem', fontWeight:700, background:'#16a34a18', color:'#16a34a' }}>Statement verified</span>}
                    {selectedLead.affordabilityZone?.zone && (() => {
                      const z = selectedLead.affordabilityZone.zone;
                      const zc = z==='green'?'#16a34a':z==='yellow'?'#d97706':'#ef4444';
                      return <span style={{ padding:'1px 7px', borderRadius:10, fontSize:'0.7rem', fontWeight:700, background:`${zc}18`, color:zc }}>{selectedLead.affordabilityZone.label}</span>;
                    })()}
                  </Lbl>
                  <div className="lead-bond-grid">
                    {[
                      ['Monthly Income', selectedLead.monthlyIncome > 0 ? fmt(selectedLead.monthlyIncome) : null],
                      ['Max Bond',       selectedLead.maxBond > 0 ? fmt(selectedLead.maxBond) : null],
                      ['Home Readiness', selectedLead.homeReadinessScore ? `${selectedLead.homeReadinessScore}/100` : null],
                    ].filter(([,v])=>v).map(([label, value]) => (
                      <div key={label}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontWeight: 600 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* B2B-specific: last email reply */}
              {isB2b && selectedLead.repliedAt && (
                <div style={{ background: '#16a34a0d', border: '1px solid #16a34a30', borderRadius: 8, padding: 12 }}>
                  <Lbl>Last email reply</Lbl>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: 4 }}>{selectedLead.lastEmailSubject || '(no subject)'}</div>
                  {selectedLead.lastEmailSnippet && <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{selectedLead.lastEmailSnippet}</div>}
                  <div style={{ marginTop: 6, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Received {new Date(selectedLead.repliedAt).toLocaleString('en-ZA')}</div>
                </div>
              )}

              {/* Stage */}
              <div>
                <Lbl>Stage</Lbl>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {activeStages.map(s => (
                    <button key={s.value} className="lead-stage-btn"
                      onClick={() => updateLead(selectedLead.id, { status: s.value }).catch(()=>{})}
                      style={{ background: selectedLead.status === s.value ? s.color : 'var(--bg-page)', color: selectedLead.status === s.value ? '#fff' : s.color, borderColor: s.color }}>
                      {s.icon} {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assigned to */}
              <div>
                <Lbl>Assigned to</Lbl>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ASSIGNEES.map(a => (
                    <button key={a} className="lead-assign-btn"
                      onClick={() => updateLead(selectedLead.id, { assignedTo: a }).catch(()=>{})}
                      style={{ background: selectedLead.assignedTo === a ? 'var(--forest)' : 'var(--bg-page)', color: selectedLead.assignedTo === a ? '#fff' : 'var(--text-secondary)' }}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              {/* Follow-up date */}
              <div>
                <Lbl>Follow-up date</Lbl>
                <input type="date" value={selectedLead.followUpAt || ''} onChange={e => updateLead(selectedLead.id, { followUpAt: e.target.value }).catch(()=>{})}
                  style={{ padding: '8px 12px', borderRadius: 6, border: `1.5px solid ${selectedLead.followUpAt && new Date(selectedLead.followUpAt) < new Date() ? '#ef4444' : 'var(--border-color)'}`, background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box' }} />
                {selectedLead.followUpAt && new Date(selectedLead.followUpAt) < new Date() && (
                  <div style={{ marginTop: 4, fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>⚠ Overdue — update or clear this date</div>
                )}
              </div>

              {/* Referred by (estate agent / source) */}
              <div>
                <Lbl>Referred by</Lbl>
                <input type="text" value={selectedLead.referredBy || ''} placeholder="e.g. Jane (Pam Golding CT)"
                  onChange={e => updateLead(selectedLead.id, { referredBy: e.target.value }).catch(()=>{})}
                  style={{ padding: '8px 12px', borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box' }} />
              </div>

              {/* Notes */}
              <div>
                <Lbl>Notes</Lbl>
                {selectedLead.brokerNotes && (
                  <div style={{ background: 'var(--bg-page)', borderRadius: 8, padding: '8px 10px', marginBottom: 8, maxHeight: 200, overflowY: 'auto' }}>
                    {selectedLead.brokerNotes.trim().split('\n').filter(Boolean).map((line, i) => {
                      const m = line.match(/^\[([^\]]+)\]\s*(.*)/);
                      return m ? (
                        <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.8125rem' }}>
                          <span style={{ color: 'var(--text-secondary)', flexShrink: 0, fontSize: '0.75rem', marginTop: 1 }}>{m[1]}</span>
                          <span style={{ color: 'var(--text-primary)' }}>{m[2]}</span>
                        </div>
                      ) : (
                        <div key={i} style={{ padding: '5px 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{line}</div>
                      );
                    })}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  <textarea rows={2} value={noteInput} onChange={e => setNoteInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), saveNote())} placeholder="Add a note… (Enter to save)"
                    style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.8125rem', resize: 'none', fontFamily: 'inherit' }} />
                  <button onClick={saveNote} style={{ alignSelf: 'flex-end', padding: '8px 14px', borderRadius: 6, background: 'var(--forest)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.8125rem' }}>Save</button>
                </div>
              </div>

              {selectedLead.contactMethod && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                  Prefers: <strong>{selectedLead.contactMethod}</strong>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Add lead modal */}
      {addOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setAddOpen(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', margin: 0 }}>{isB2b ? 'Add B2B lead' : 'Add lead manually'}</h3>
              <button onClick={() => setAddOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>×</button>
            </div>
            <form onSubmit={handleAddLead} style={{ display: 'grid', gap: 14 }}>
              {(isB2b ? [
                { label: 'Company / Organisation *', key: 'company',    type: 'text',   placeholder: 'Capitec Bank' },
                { label: 'Contact name *',           key: 'name',       type: 'text',   placeholder: 'Jane Smith' },
                { label: 'Email *',                  key: 'email',      type: 'email',  placeholder: 'jane@capitec.co.za' },
                { label: 'Phone',                    key: 'phone',      type: 'tel',    placeholder: '+27 82 123 4567' },
                { label: 'Deal value (R, optional)', key: 'dealValue',  type: 'number', placeholder: '500 000' },
                { label: 'Notes',                    key: 'notes',      type: 'text',   placeholder: 'Intro via LinkedIn, interested in fraud intelligence' },
              ] : [
                { label: 'Full name *',             key: 'name',           type: 'text',   placeholder: 'Jane Smith' },
                { label: 'Phone (WhatsApp) *',      key: 'phone',          type: 'tel',    placeholder: '+27 82 123 4567' },
                { label: 'Email',                   key: 'email',          type: 'email',  placeholder: 'jane@example.com' },
                { label: 'Referred by (estate agent / source)', key: 'referredBy', type: 'text', placeholder: 'Jane Smith — Pam Golding' },
                { label: 'Current bank',            key: 'currentBank',    type: 'text',   placeholder: 'ABSA' },
                { label: 'Outstanding balance (R)', key: 'currentBalance', type: 'number', placeholder: '1 200 000' },
                { label: 'Current rate (%)',        key: 'currentRate',    type: 'number', placeholder: '11.75' },
                { label: 'Monthly income (R)',      key: 'monthlyIncome',  type: 'number', placeholder: '45 000' },
              ]).map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{f.label}</label>
                  <input type={f.type} value={addForm[f.key]} placeholder={f.placeholder} onChange={e => setAddForm(fm => ({ ...fm, [f.key]: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.875rem', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setAddOpen(false)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1.5px solid var(--border-color)', background: 'var(--bg-page)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                <button type="submit" disabled={addLoading} style={{ flex: 2, padding: 10, borderRadius: 8, background: 'var(--forest)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>{addLoading ? 'Adding…' : 'Add lead'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

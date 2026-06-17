// Lead CRM constants — shared by Admin.jsx and the extracted LeadsTab so neither
// has to reach into the other (which would create a circular import).
import { Zap, Phone, CheckCircle, Handshake, DollarSign } from 'lucide-react';

export const LEAD_STAGES = [
  { value: 'new',            label: 'New',           color: '#3b82f6', icon: <Zap size={14}/> },
  { value: 'contacted',      label: 'Contacted',     color: '#8b5cf6', icon: <Phone size={14}/> },
  { value: 'qualified',      label: 'Qualified',     color: '#f59e0b', icon: <CheckCircle size={14}/> },
  { value: 'sent_to_broker', label: 'With Broker',   color: '#6366f1', icon: <Handshake size={14}/> },
  { value: 'converted',      label: 'Converted',     color: '#16a34a', icon: <DollarSign size={14}/> },
  { value: 'not_qualified',  label: 'Not Qualified', color: '#9ca3af', icon: '✕' },
];

export const SOURCE_LABELS = {
  get_a_quote:      'Get a Quote',
  preapproval_form: 'Pre-Approval',
  manual:           'Manual entry',
  website:          'Website',
  email_inbound:    'Email reply',
  b2b_outreach:     'B2B outreach',
  unknown:          'Unknown',
};

export const ASSIGNEES = ["Callum", "Oliver", "Unassigned"];

export const EMPTY_LEAD = { name: '', phone: '', email: '', currentBank: '', currentBalance: '', currentRate: '', currentTerm: '20', monthlyIncome: '', employment: 'Permanent employee', contactMethod: 'Phone call', source: 'manual', referredBy: '' };

export const B2B_STAGES = [
  { value: 'new',            label: 'New',           color: '#3b82f6', icon: <Zap size={14}/> },
  { value: 'contacted',      label: 'Contacted',     color: '#8b5cf6', icon: <Phone size={14}/> },
  { value: 'meeting_booked', label: 'Meeting',       color: '#f59e0b', icon: '📅' },
  { value: 'proposal_sent',  label: 'Proposal',      color: '#6366f1', icon: '📄' },
  { value: 'won',            label: 'Won',           color: '#16a34a', icon: <DollarSign size={14}/> },
  { value: 'lost',           label: 'Lost',          color: '#9ca3af', icon: '✕' },
];

export const B2B_EMPTY_LEAD = { name: '', company: '', email: '', phone: '', dealValue: '', notes: '', source: 'b2b_outreach', leadType: 'b2b' };

export function isB2bLead(l) { return l.leadType === 'b2b' || l.source === 'email_inbound' || l.source === 'b2b_outreach'; }

export function exportCSV(leads) {
  const cols = ['name','phone','email','source','status','currentBank','currentBalance','currentRate','currentTerm','monthlyIncome','employment','contactMethod','assignedTo','brokerNotes','createdAt'];
  const rows = [cols.join(','), ...leads.map(l => cols.map(c => JSON.stringify(l[c] ?? '')).join(','))];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `bondly-leads-${new Date().toISOString().slice(0,10)}.csv`; a.click();
}

"use client";
import { useState, useEffect, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
const MOCK_DEALS = [
  {
    id: "D-1001",
    merchant: { name: "Sunrise Cafe LLC", email: "owner@sunrisecafe.com", phone: "555-201-4321" },
    broker: { name: "Metro Capital Group", email: "deals@metrocap.com" },
    status: "Offer Created",
    created: "2026-04-15",
    offers: [
      { id: "O-1", amount: 50000, payback: 67500, factor: 1.35, term: 8, frequency: "Daily", position: "1st", fee: 1, expiry: "2026-04-25", commissionPct: 10 },
      { id: "O-2", amount: 40000, payback: 52000, factor: 1.30, term: 6, frequency: "Daily", position: "1st", fee: 1, expiry: "2026-04-25", commissionPct: 8 },
    ],
    selectedOffer: null,
    bankStatus: null,
    idvStatus: null,
    agreementSigned: false,
    uwDecision: null,
    fundingCallDone: false,
  },
  {
    id: "D-1002",
    merchant: { name: "TechFix Pro Inc", email: "finance@techfixpro.com", phone: "555-788-9900" },
    broker: { name: "Alliance Funding Partners", email: "rep@alliancefunding.com" },
    status: "Ready for Final UW",
    created: "2026-04-10",
    offers: [
      { id: "O-3", amount: 120000, payback: 168000, factor: 1.40, term: 12, frequency: "Weekly", position: "1st", fee: 1, expiry: "2026-04-30", commissionPct: 12 },
    ],
    selectedOffer: "O-3",
    bankStatus: "connected",
    idvStatus: "pass",
    agreementSigned: true,
    uwDecision: null,
    fundingCallDone: false,
  },
  {
    id: "D-1003",
    merchant: { name: "Harbor Logistics Co", email: "ops@harborlog.com", phone: "555-344-2211" },
    broker: { name: "Coast Bridge Finance", email: "bridge@coastbridge.com" },
    status: "Funded",
    created: "2026-04-01",
    offers: [
      { id: "O-4", amount: 75000, payback: 97500, factor: 1.30, term: 9, frequency: "Daily", position: "2nd", fee: 1, expiry: "2026-04-15", commissionPct: 9 },
    ],
    selectedOffer: "O-4",
    bankStatus: "connected",
    idvStatus: "pass",
    agreementSigned: true,
    uwDecision: "approved",
    fundingCallDone: true,
  },
];

const STATUSES = [
  "Submission Received",
  "Offer Created",
  "Offer Sent to Broker",
  "Offer Selected",
  "Merchant Invited",
  "Bank Connected",
  "Identity Verified",
  "Agreement Signed",
  "Ready for Final UW",
  "UW Approved",
  "Funding Call Completed",
  "Funded",
];

const STATUS_COLORS = {
  "Submission Received": "#0ea5e9",
  "Offer Created": "#64748b",
  "Offer Sent to Broker": "#3b82f6",
  "Offer Selected": "#8b5cf6",
  "Merchant Invited": "#f59e0b",
  "Bank Connected": "#06b6d4",
  "Identity Verified": "#10b981",
  "Agreement Signed": "#6366f1",
  "Ready for Final UW": "#f97316",
  "UW Approved": "#22c55e",
  "UW Declined": "#ef4444",
  "Declined": "#ef4444",
  "Funding Call Completed": "#84cc16",
  "Funded": "#16a34a",
};

const PREV_STATUS = {
  "Declined":                "Submission Received",
  "Offer Created":           "Submission Received",
  "Offer Sent to Broker":    "Offer Created",
  "Offer Selected":          "Offer Sent to Broker",
  "Merchant Invited":        "Offer Selected",
  "Bank Connected":          "Merchant Invited",
  "Identity Verified":       "Bank Connected",
  "Agreement Signed":        "Identity Verified",
  "Ready for Final UW":      "Agreement Signed",
  "UW Approved":             "Ready for Final UW",
  "UW Declined":             "Ready for Final UW",
  "Funding Call Completed":  "UW Approved",
  "Funded":                  "Funding Call Completed",
};

// ─── API HELPERS ──────────────────────────────────────────────────────────────
function mapDeal(d) {
  return {
    id: d.id,
    status: d.status,
    created: d.createdAt ? d.createdAt.split('T')[0] : '',
    merchant: d.merchantContact
      ? {
          name: d.merchantContact.businessName,
          email: d.merchantContact.email,
          phone: d.merchantContact.phone || '',
          ein: d.merchantContact.ein || '',
          ownerDob: d.merchantContact.ownerDob || '',
        }
      : { name: '', email: '', phone: '', ein: '', ownerDob: '' },
    broker: d.brokerContact
      ? { name: d.brokerContact.name, email: d.brokerContact.email, phone: d.brokerContact.phone || '', shopName: d.brokerShop?.name || d.brokerContact.company || '' }
      : { name: '', email: '', phone: '', shopName: '' },
    offers: (d.offers || []).map(o => ({
      id: o.id,
      amount: o.amount,
      payback: Math.round(o.amount * o.factorRate),
      factor: o.factorRate,
      term: o.termDays,
      frequency: o.paymentFrequency,
      position: '1st',
      fee: 1,
      expiry: o.expiresAt ? o.expiresAt.split('T')[0] : '',
      commissionPct: 10,
    })),
    selectedOffer: null,
    bankStatus: null,
    idvStatus: null,
    agreementSigned: false,
    uwDecision: null,
    fundingCallDone: false,
  };
}

function patchDeal(id, data) {
  return fetch(`/api/deals/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch(console.error);
}

// ─── ICONS (inline SVG) ───────────────────────────────────────────────────────
const Icon = ({ name, size = 16, color = "currentColor" }) => {
  const icons = {
    dashboard: <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />,
    deals: <path d="M20 6h-2.18c.07-.44.18-.88.18-1.35C18 2.99 16.55 1.44 14.65 1.44c-1.05 0-1.96.54-2.56 1.36L12 3.45l-.09-.66C11.31 1.98 10.4 1.44 9.35 1.44 7.45 1.44 6 2.99 6 4.65c0 .47.11.91.18 1.35H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" />,
    plus: <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />,
    send: <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />,
    check: <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />,
    clock: <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />,
    bank: <path d="M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zM11.5 1L2 6v2h19V6l-9.5-5z" />,
    id: <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 2.75c1.24 0 2.25 1.01 2.25 2.25S13.24 11.25 12 11.25 9.75 10.24 9.75 9 10.76 6.75 12 6.75zM17 17H7v-1.5c0-1.67 3.33-2.5 5-2.5s5 .83 5 2.5V17z" />,
    sign: <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM9 13v3h6v-3l2.5 2.5L15 18v-3H9v3l-2.5-2.5L9 13z" />,
    alert: <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />,
    filter: <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" />,
    search: <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />,
    eye: <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />,
    funded: <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" />,
    uw: <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z" />,
    x: <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />,
    chevronRight: <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />,
    copy: <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />,
    notifications: <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      {icons[name] || null}
    </svg>
  );
};

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  @keyframes spin { to { transform: rotate(360deg); } }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg: #f4faf6;
    --surface: #ffffff;
    --surface2: #eaf5ee;
    --border: #c6e6d0;
    --border2: #a3d4b4;
    --text: #0e2718;
    --text2: #2d6645;
    --text3: #7aab8a;
    --accent: #16a34a;
    --accent2: #15803d;
    --green: #16a34a;
    --amber: #ca8a04;
    --red: #dc2626;
    --purple: #15803d;
    --cyan: #059669;
    --font: 'Plus Jakarta Sans', sans-serif;
    --mono: 'JetBrains Mono', monospace;
  }

  body { background: var(--bg); color: var(--text); font-family: var(--font); }

  .app { display: flex; height: 100vh; overflow: hidden; }

  /* SIDEBAR */
  .sidebar {
    width: 220px; min-width: 220px; background: var(--surface);
    border-right: 1px solid var(--border);
    display: flex; flex-direction: column; padding: 0;
  }
  .sidebar-logo {
    padding: 20px 20px 16px;
    border-bottom: 1px solid var(--border);
  }
  .sidebar-logo .logo-badge {
    display: inline-flex; align-items: center; gap: 8px;
    background: linear-gradient(135deg, #15803d, #16a34a);
    border-radius: 10px; padding: 8px 12px;
    font-size: 13px; font-weight: 700; letter-spacing: .5px;
    color: #dcfce7;
  }
  .sidebar-logo .logo-sub {
    margin-top: 6px; font-size: 11px; color: var(--text3); font-weight: 500;
  }
  .sidebar-nav { flex: 1; padding: 12px 0; }
  .nav-section { padding: 0 12px 4px; margin-bottom: 2px; }
  .nav-section-label {
    font-size: 11px; font-weight: 600; color: var(--text3); padding: 8px 8px 4px;
  }
  .nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 12px; border-radius: 8px;
    font-size: 13px; font-weight: 500; color: var(--text2);
    cursor: pointer; transition: all .15s; margin-bottom: 2px;
    border: none; background: none; width: 100%; text-align: left;
  }
  .nav-item:hover { background: var(--surface2); color: var(--text); }
  .nav-item.active { background: rgba(59,130,246,.15); color: var(--accent); }
  .nav-item .badge {
    margin-left: auto; background: var(--accent); color: #fff;
    border-radius: 10px; font-size: 10px; padding: 1px 6px;
    font-family: var(--mono);
  }
  .sidebar-footer {
    padding: 12px; border-top: 1px solid var(--border);
    font-size: 11px; color: var(--text3);
  }
  .sidebar-footer .user-row {
    display: flex; align-items: center; gap: 8px;
  }
  .sidebar-footer .avatar {
    width: 28px; height: 28px; border-radius: 50%;
    background: linear-gradient(135deg, var(--accent2), #14532d);
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; color: #fff;
  }

  /* MAIN */
  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .topbar {
    padding: 0 24px; height: 56px; min-height: 56px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 12px;
    background: var(--surface);
  }
  .topbar-title { font-size: 15px; font-weight: 600; flex: 1; }
  .topbar-actions { display: flex; gap: 8px; }

  .content { flex: 1; overflow-y: auto; padding: 24px; }

  /* BUTTONS */
  .btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: 8px; font-size: 13px;
    font-weight: 600; cursor: pointer; border: none; font-family: var(--font);
    transition: all .15s;
  }
  .btn-primary { background: var(--accent); color: #fff; }
  .btn-primary:hover { background: var(--accent2); }
  .btn-secondary {
    background: var(--surface2); color: var(--text2);
    border: 1px solid var(--border);
  }
  .btn-secondary:hover { color: var(--text); border-color: var(--border2); }
  .btn-green { background: var(--green); color: #fff; }
  .btn-green:hover { background: #059669; }
  .btn-red { background: var(--red); color: #fff; }
  .btn-red:hover { background: #dc2626; }
  .btn-amber { background: var(--amber); color: #000; font-weight: 700; }
  .btn-sm { padding: 5px 10px; font-size: 12px; }

  /* CARDS */
  .card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 20px;
  }
  .card-sm { padding: 14px 16px; }

  /* STAT ROW */
  .stat-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 24px; }
  .stat-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 18px;
  }
  .stat-label { font-size: 12px; font-weight: 500; color: var(--text3); }
  .stat-value { font-size: 28px; font-weight: 700; margin-top: 4px; }
  .stat-sub { font-size: 11px; color: var(--text3); margin-top: 2px; }

  /* STATUS PILL */
  .status-pill {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 10px; border-radius: 20px; font-size: 11px;
    font-weight: 600;
    border: 1px solid transparent;
  }
  .status-dot { width: 6px; height: 6px; border-radius: 50%; }

  /* TABLE */
  .table { width: 100%; border-collapse: collapse; }
  .table th {
    text-align: left; padding: 10px 14px;
    font-size: 12px; font-weight: 600; color: var(--text3);
    border-bottom: 1px solid var(--border);
  }
  .table td {
    padding: 13px 14px; font-size: 13px;
    border-bottom: 1px solid var(--border);
    vertical-align: middle;
  }
  .table tr:last-child td { border-bottom: none; }
  .table tr:hover td { background: rgba(255,255,255,.02); }
  .table tr { cursor: pointer; }

  /* FORM */
  .form-group { margin-bottom: 16px; }
  .form-label { font-size: 13px; color: var(--text2); font-weight: 500; margin-bottom: 6px; display: block; }
  .form-input {
    width: 100%; background: var(--bg); border: 1px solid var(--border2);
    border-radius: 8px; padding: 9px 12px; color: var(--text);
    font-size: 13px; font-family: var(--font); outline: none;
    transition: border-color .15s;
  }
  .form-input:focus { border-color: var(--accent); }
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .form-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }

  /* MODAL */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,.7);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000; padding: 24px;
  }
  .modal {
    background: var(--surface); border: 1px solid var(--border2);
    border-radius: 16px; width: 100%; max-width: 640px;
    max-height: 90vh; overflow-y: auto;
    box-shadow: 0 25px 60px rgba(0,0,0,.5);
  }
  .modal-lg { max-width: 800px; }
  .modal-header {
    padding: 20px 24px 0;
    display: flex; align-items: flex-start; justify-content: space-between;
  }
  .modal-title { font-size: 17px; font-weight: 700; }
  .modal-sub { font-size: 12px; color: var(--text2); margin-top: 3px; }
  .modal-body { padding: 20px 24px; }
  .modal-footer {
    padding: 16px 24px 20px;
    display: flex; justify-content: flex-end; gap: 8px;
    border-top: 1px solid var(--border);
  }

  /* STEPPER */
  .stepper { display: flex; gap: 0; margin-bottom: 28px; }
  .step-item {
    flex: 1; display: flex; flex-direction: column; align-items: center; position: relative;
  }
  .step-item:not(:last-child)::after {
    content: ''; position: absolute; top: 14px; left: 50%;
    width: 100%; height: 2px; background: var(--border2);
  }
  .step-item.done:not(:last-child)::after { background: var(--green); }
  .step-item.active:not(:last-child)::after { background: var(--border2); }
  .step-dot {
    width: 28px; height: 28px; border-radius: 50%;
    background: var(--surface2); border: 2px solid var(--border2);
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; z-index: 1; color: var(--text3);
  }
  .step-item.done .step-dot { background: var(--green); border-color: var(--green); color: #fff; }
  .step-item.active .step-dot { background: var(--accent); border-color: var(--accent); color: #fff; }
  .step-label { font-size: 11px; color: var(--text3); margin-top: 5px; text-align: center; max-width: 70px; }
  .step-item.active .step-label { color: var(--accent); }
  .step-item.done .step-label { color: var(--green); }

  /* OFFER CARD */
  .offer-card {
    background: var(--bg); border: 2px solid var(--border);
    border-radius: 12px; padding: 18px; cursor: pointer;
    transition: all .2s; margin-bottom: 12px;
  }
  .offer-card:hover { border-color: var(--border2); }
  .offer-card.selected { border-color: var(--accent); background: rgba(59,130,246,.06); }
  .offer-amount { font-size: 26px; font-weight: 700; color: var(--text); }
  .offer-meta { display: flex; gap: 20px; margin-top: 10px; flex-wrap: wrap; }
  .offer-meta-item { }
  .offer-meta-label { font-size: 12px; font-weight: 500; color: var(--text3); }
  .offer-meta-value { font-size: 13px; font-weight: 600; color: var(--text2); margin-top: 1px; }

  /* TIMELINE */
  .timeline { padding-left: 4px; }
  .timeline-item { display: flex; gap: 14px; padding-bottom: 20px; position: relative; }
  .timeline-item:not(:last-child)::before {
    content: ''; position: absolute; left: 11px; top: 24px;
    width: 2px; height: calc(100% - 10px); background: var(--border);
  }
  .timeline-dot {
    width: 24px; height: 24px; min-width: 24px; border-radius: 50%;
    background: var(--surface2); border: 2px solid var(--border2);
    display: flex; align-items: center; justify-content: center; margin-top: 1px;
  }
  .timeline-dot.done { background: var(--green); border-color: var(--green); }
  .timeline-dot.current { background: var(--accent); border-color: var(--accent); }
  .timeline-content { flex: 1; }
  .timeline-label { font-size: 13px; font-weight: 600; }
  .timeline-time { font-size: 11px; color: var(--text3); font-family: var(--mono); margin-top: 2px; }

  /* ONBOARDING (merchant view) */
  .onboard-wrap {
    min-height: 100vh; background: #f0faf4;
    display: flex; flex-direction: column; align-items: center;
    justify-content: flex-start; padding: 40px 20px;
  }
  .onboard-logo {
    font-size: 13px; font-weight: 700; color: #16a34a;
    letter-spacing: .5px; margin-bottom: 32px;
    display: flex; align-items: center; gap: 8px;
  }
  .onboard-card {
    width: 100%; max-width: 520px;
    background: #ffffff; border: 1px solid #c6e6d0;
    border-radius: 20px; padding: 36px;
  }
  .onboard-step-title { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
  .onboard-step-sub { font-size: 14px; color: var(--text2); margin-bottom: 28px; }
  .onboard-progress { display: flex; gap: 6px; margin-bottom: 32px; }
  .onboard-progress-bar {
    flex: 1; height: 4px; border-radius: 2px; background: var(--border);
    transition: background .3s;
  }
  .onboard-progress-bar.done { background: var(--green); }
  .onboard-progress-bar.active { background: var(--accent); }

  /* BROKER VIEW */
  .broker-wrap {
    min-height: 100vh; background: #f0faf4;
    display: flex; flex-direction: column; align-items: center;
    padding: 40px 20px;
  }
  .broker-card {
    width: 100%; max-width: 600px;
    background: #ffffff; border: 1px solid #c6e6d0;
    border-radius: 20px; padding: 36px;
  }

  /* UW VIEW */
  .uw-artifact {
    background: var(--bg); border: 1px solid var(--border);
    border-radius: 10px; padding: 16px; margin-bottom: 12px;
  }
  .uw-artifact-label {
    font-size: 12px; font-weight: 600; color: var(--text3); margin-bottom: 8px;
  }

  /* MISC */
  .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .section-title { font-size: 14px; font-weight: 700; }
  .divider { height: 1px; background: var(--border); margin: 20px 0; }
  .tag {
    display: inline-block; padding: 2px 8px; border-radius: 5px;
    font-size: 11px; font-weight: 600;
  }
  .mono { font-family: var(--mono); }
  .text-sm { font-size: 12px; }
  .text-xs { font-size: 11px; }
  .text-muted { color: var(--text2); }
  .text-dim { color: var(--text3); }
  .text-green { color: var(--green); }
  .text-red { color: var(--red); }
  .text-amber { color: var(--amber); }
  .text-accent { color: var(--accent); }
  .text-purple { color: var(--purple); }
  .flex { display: flex; }
  .flex-col { display: flex; flex-direction: column; }
  .items-center { align-items: center; }
  .justify-between { justify-content: space-between; }
  .gap-8 { gap: 8px; }
  .gap-12 { gap: 12px; }
  .mb-8 { margin-bottom: 8px; }
  .mb-12 { margin-bottom: 12px; }
  .mb-16 { margin-bottom: 16px; }
  .mb-24 { margin-bottom: 24px; }
  .mt-4 { margin-top: 4px; }
  .mt-8 { margin-top: 8px; }
  .fw-600 { font-weight: 600; }
  .fw-700 { font-weight: 700; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .scrollbar::-webkit-scrollbar { width: 4px; }
  .scrollbar::-webkit-scrollbar-track { background: transparent; }
  .scrollbar::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }

  .notification-toast {
    position: fixed; bottom: 24px; right: 24px; z-index: 9999;
    background: #ffffff; border: 1px solid #c6e6d0;
    border-radius: 12px; padding: 14px 18px;
    display: flex; align-items: center; gap: 10px;
    font-size: 13px; box-shadow: 0 8px 30px rgba(0,0,0,.4);
    animation: slideUp .3s ease;
    max-width: 320px;
  }
  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .fade-in { animation: fadeIn .25s ease; }
`;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const statusColor = (s) => STATUS_COLORS[s] || "#64748b";
const fmt = (n) => `$${Number(n).toLocaleString()}`;

// Formats a raw number string into $1,234,567 display as user types
const fmtDisplay = (raw) => {
  if (!raw && raw !== 0) return "";
  const num = parseFloat(String(raw).replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return "";
  const parts = num.toFixed(0).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return "$" + parts[0];
};

// Strips formatting back to a plain number string for state storage
const stripFmt = (val) => String(val).replace(/[^0-9.]/g, "");

const CurrencyInput = ({ value, onChange, placeholder, style, autoLabel }) => {
  const [focused, setFocused] = useState(false);
  const displayVal = focused ? (value || "") : (value ? fmtDisplay(value) : "");
  return (
    <input
      className="form-input"
      type="text"
      inputMode="numeric"
      value={displayVal}
      placeholder={focused ? placeholder : ("$" + (placeholder || ""))}
      style={{ ...style, fontFamily: "var(--mono)", fontWeight: 600 }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={e => onChange(stripFmt(e.target.value))}
    />
  );
};
const StatusPill = ({ status }) => {
  const c = statusColor(status);
  return (
    <span className="status-pill" style={{ background: c + "18", borderColor: c + "44", color: c }}>
      <span className="status-dot" style={{ background: c }} />
      {status}
    </span>
  );
};

const stepIdx = (s) => STATUSES.indexOf(s);

// ─── TOAST ────────────────────────────────────────────────────────────────────
const Toast = ({ msg, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, []);
  return (
    <div className="notification-toast">
      <span style={{ color: "#10b981" }}><Icon name="check" size={18} /></span>
      <span>{msg}</span>
    </div>
  );
};

// ─── DEAL DETAIL MODAL ───────────────────────────────────────────────────────
const DealDetailModal = ({ deal, onClose, onUpdate, onDelete, onOpenBroker, onOpenMerchant, onOpenUW, onDecline, onCreateOffer, onAssignBroker }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRevert, setConfirmRevert] = useState(false);
  const [fullDeal, setFullDeal] = useState(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const [bankReport, setBankReport] = useState(null);
  const [bankReportLoading, setBankReportLoading] = useState(false);
  const [bankReportOpen, setBankReportOpen] = useState(false);
  const [idvDetail, setIdvDetail] = useState(null);
  const [idvDetailLoading, setIdvDetailLoading] = useState(false);
  const [idvDetailOpen, setIdvDetailOpen] = useState(false);

  const fmtCurrency = (n) => n != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n) : '—';
  const fmtDateShort = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  const handleLoadDocuments = () => {
    setDocsLoading(true);
    fetch(`/api/deals/${deal.id}`)
      .then(r => r.json())
      .then(d => { setFullDeal(d); setDocsLoading(false); })
      .catch(() => setDocsLoading(false));
  };

  const handleViewBankReport = () => {
    if (bankReport) { setBankReportOpen(o => !o); return; }
    setBankReportLoading(true);
    fetch(`/api/plaid/report?dealId=${deal.id}`)
      .then(r => r.json())
      .then(d => { setBankReport(d); setBankReportOpen(true); setBankReportLoading(false); })
      .catch(() => setBankReportLoading(false));
  };

  const handleViewIdCheck = () => {
    if (idvDetail) { setIdvDetailOpen(o => !o); return; }
    setIdvDetailLoading(true);
    fetch(`/api/persona/inquiry?dealId=${deal.id}`)
      .then(r => r.json())
      .then(d => { setIdvDetail(d); setIdvDetailOpen(true); setIdvDetailLoading(false); })
      .catch(() => setIdvDetailLoading(false));
  };

  const isRealDeal = deal.id.startsWith('cm');
  const hasBankConnection = fullDeal?.bankConnections?.length > 0;
  const hasIdvRecord = fullDeal?.identityRecords?.length > 0;
  const hasAgreement = fullDeal?.agreements?.length > 0;
  const si = stepIdx(deal.status);
  const steps = ["Received", "Offer Created", "Sent to Broker", "Offer Selected", "Merchant Invited", "Bank Connected", "ID Verified", "Signed", "Ready UW", "Approved", "Funded"];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="mono text-xs text-dim mb-8" style={{ marginBottom: 4 }}>{deal.id}</div>
            <div className="modal-title">{deal.merchant.name}</div>
            <div className="modal-sub">Broker: {deal.broker.name}</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">
          {/* Progress */}
          <div style={{ overflowX: "auto", paddingBottom: 4 }}>
            <div className="stepper" style={{ minWidth: 600 }}>
              {steps.map((s, i) => (
                <div key={s} className={`step-item ${i < si ? "done" : i === si ? "active" : ""}`}>
                  <div className="step-dot">{i < si ? <Icon name="check" size={12} color="#fff" /> : i + 1}</div>
                  <div className="step-label">{s}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="divider" />

          {/* Contact info */}
          <div className="grid-2" style={{ gap: 10, marginBottom: 16 }}>
            <div className="uw-artifact">
              <div className="uw-artifact-label" style={{ marginBottom: 10 }}>Merchant</div>
              {[
                ["Business", deal.merchant.name],
                ["Email", deal.merchant.email],
                ["Phone", deal.merchant.phone],
                ["EIN", deal.merchant.ein],
                ["DOB", deal.merchant.ownerDob],
              ].map(([label, val]) => val ? (
                <div key={label} className="flex items-center gap-8" style={{ marginBottom: 6 }}>
                  <span className="text-xs text-dim" style={{ width: 48, flexShrink: 0 }}>{label}</span>
                  <span className="text-sm fw-600" style={{ wordBreak: "break-all" }}>{val}</span>
                </div>
              ) : null)}
            </div>
            <div className="uw-artifact">
              <div className="uw-artifact-label" style={{ marginBottom: 10 }}>Broker</div>
              {[
                ["Shop", deal.broker.shopName],
                ["Contact", deal.broker.name],
                ["Email", deal.broker.email],
                ["Phone", deal.broker.phone],
              ].map(([label, val]) => val ? (
                <div key={label} className="flex items-center gap-8" style={{ marginBottom: 6 }}>
                  <span className="text-xs text-dim" style={{ width: 48, flexShrink: 0 }}>{label}</span>
                  <span className="text-sm fw-600" style={{ wordBreak: "break-all" }}>{val}</span>
                </div>
              ) : null)}
            </div>
          </div>

          <div className="divider" />

          {/* Offers */}
          <div className="section-header mb-12">
            <div className="section-title">Offers</div>
            <StatusPill status={deal.status} />
          </div>
          {deal.offers.map(o => (
            <div key={o.id} className="offer-card" style={{ cursor: "default", borderColor: deal.selectedOffer === o.id ? "var(--accent)" : "var(--border)" }}>
              {deal.selectedOffer === o.id && (
                <div className="tag" style={{ background: "rgba(59,130,246,.15)", color: "var(--accent)", marginBottom: 8 }}>✓ Selected Offer</div>
              )}
              <div className="offer-amount">{fmt(o.amount)}</div>
              <div className="offer-meta">
                <div className="offer-meta-item"><div className="offer-meta-label">Payback</div><div className="offer-meta-value">{fmt(o.payback)}</div></div>
                <div className="offer-meta-item"><div className="offer-meta-label">Factor</div><div className="offer-meta-value">{o.factor}x</div></div>
                <div className="offer-meta-item"><div className="offer-meta-label">Term</div><div className="offer-meta-value">{o.term} mo</div></div>
                <div className="offer-meta-item"><div className="offer-meta-label">Frequency</div><div className="offer-meta-value">{o.frequency}</div></div>
                <div className="offer-meta-item"><div className="offer-meta-label">Position</div><div className="offer-meta-value">{o.position}</div></div>
                <div className="offer-meta-item"><div className="offer-meta-label">Orig. Fee</div><div className="offer-meta-value">{o.fee}% {o.amount ? "· " + fmt((+o.amount * +o.fee)/100) : ""}</div></div>
              </div>
            </div>
          ))}

          <div className="divider" />

          {/* Onboarding Status */}
          <div className="section-title mb-12">Onboarding Status</div>
          <div className="grid-2" style={{ gap: 10 }}>
            {[
              { label: "Bank Connection", val: deal.bankStatus, icon: "bank" },
              { label: "Identity Verification", val: deal.idvStatus, icon: "id" },
              { label: "Agreement Signed", val: deal.agreementSigned ? "signed" : null, icon: "sign" },
              { label: "UW Decision", val: deal.uwDecision, icon: "uw" },
            ].map(({ label, val, icon }) => (
              <div key={label} className="uw-artifact">
                <div className="uw-artifact-label">{label}</div>
                <div className="flex items-center gap-8">
                  <Icon name={icon} size={16} color={val ? "var(--green)" : "var(--text3)"} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: val ? "var(--green)" : "var(--text3)" }}>
                    {val ? (typeof val === "boolean" ? "Complete" : val.charAt(0).toUpperCase() + val.slice(1)) : "Pending"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {isRealDeal && (
            <>
              <div className="divider" />
              <div className="section-title mb-12">Documents</div>
              {!fullDeal ? (
                <button className="btn btn-secondary btn-sm" onClick={handleLoadDocuments} disabled={docsLoading}>
                  <Icon name="eye" size={13} /> {docsLoading ? 'Loading…' : 'Load Documents'}
                </button>
              ) : (
                <>
                  <div className="flex" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    {hasBankConnection && (
                      <button className="btn btn-secondary btn-sm" onClick={handleViewBankReport} disabled={bankReportLoading}>
                        <Icon name="bank" size={13} /> {bankReportLoading ? 'Loading…' : bankReportOpen ? 'Hide Bank Report' : 'View Bank Report'}
                      </button>
                    )}
                    {hasIdvRecord && (
                      <button className="btn btn-secondary btn-sm" onClick={handleViewIdCheck} disabled={idvDetailLoading}>
                        <Icon name="id" size={13} /> {idvDetailLoading ? 'Loading…' : idvDetailOpen ? 'Hide ID Check' : 'View ID Check'}
                      </button>
                    )}
                    {hasAgreement && (
                      <button className="btn btn-secondary btn-sm" onClick={() => window.open(`/api/docusign/document?dealId=${deal.id}`, '_blank')}>
                        <Icon name="sign" size={13} /> View Signed Document ↗
                      </button>
                    )}
                    {!hasBankConnection && !hasIdvRecord && !hasAgreement && (
                      <span className="text-sm text-dim">No documents on file.</span>
                    )}
                  </div>
                  {bankReportOpen && bankReport && (
                    <div className="uw-artifact" style={{ marginBottom: 10 }}>
                      <div className="uw-artifact-label">Bank Report — {bankReport.institution}</div>
                      {bankReport.accounts?.map((acct, i) => (
                        <div key={i} style={{ marginBottom: 8, padding: '8px 10px', background: 'var(--bg2)', borderRadius: 6 }}>
                          <div className="fw-600 text-sm">{acct.name} <span className="text-dim">({acct.subtype})</span></div>
                          <div className="text-sm mt-4">Balance: <strong>{fmtCurrency(acct.balances?.current)}</strong> · Available: {fmtCurrency(acct.balances?.available)}</div>
                        </div>
                      ))}
                      {bankReport.transactions?.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div className="text-xs text-dim fw-600" style={{ marginBottom: 6 }}>LAST 90 DAYS ({bankReport.transactions.length} transactions)</div>
                          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                            {bankReport.transactions.slice(0, 50).map((tx, i) => (
                              <div key={i} className="flex items-center" style={{ justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                                <div><span className="text-dim">{tx.date}</span><span style={{ marginLeft: 8 }}>{tx.name}</span></div>
                                <span style={{ color: tx.amount > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>{fmtCurrency(Math.abs(tx.amount))}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {idvDetailOpen && idvDetail && (
                    <div className="uw-artifact" style={{ marginBottom: 10 }}>
                      <div className="uw-artifact-label">Identity Verification</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {[
                          ['Status', idvDetail.status],
                          ['Name', [idvDetail.nameFirst, idvDetail.nameLast].filter(Boolean).join(' ') || '—'],
                          ['Birthdate', idvDetail.birthdate || '—'],
                          ['Document', idvDetail.documentType || '—'],
                          ['Country', idvDetail.country || '—'],
                          ['Completed', fmtDateShort(idvDetail.completedAt)],
                        ].map(([label, val]) => (
                          <div key={label} style={{ padding: '6px 8px', background: 'var(--bg2)', borderRadius: 5 }}>
                            <div className="text-xs text-dim">{label}</div>
                            <div className="text-sm fw-600" style={{ marginTop: 2 }}>{val}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          <div className="divider" />

          {/* Actions */}
          <div className="section-title mb-12">Actions</div>
          <div className="flex" style={{ gap: 8, flexWrap: "wrap" }}>
            {deal.status === "Submission Received" && (
              <>
                <button className="btn btn-green" onClick={() => { onClose(); onCreateOffer && onCreateOffer(deal); }}>
                  <Icon name="plus" size={15} /> Create Offer
                </button>
                <button className="btn btn-red" onClick={() => { onClose(); onDecline && onDecline(deal); }}>
                  <Icon name="x" size={15} /> Decline Deal
                </button>
              </>
            )}
            {deal.status === "Offer Created" && (
              <button className="btn btn-primary" onClick={() => { onUpdate(deal.id, "Offer Sent to Broker"); onClose(); }}>
                <Icon name="send" size={15} /> Send Offer to Broker
              </button>
            )}
            {deal.status === "Offer Sent to Broker" && (
              <button className="btn btn-secondary" onClick={() => onOpenBroker(deal)}>
                <Icon name="eye" size={15} /> Preview Broker Link
              </button>
            )}
            {deal.status === "Offer Sent to Broker" && (
              <button className="btn btn-primary" onClick={() => { onUpdate(deal.id, "Offer Sent to Broker"); onClose(); }}>
                <Icon name="send" size={15} /> Resend Broker Link
              </button>
            )}
            {deal.status === "Offer Selected" && (
              <button className="btn btn-primary" onClick={() => { onUpdate(deal.id, "Merchant Invited"); onClose(); }}>
                <Icon name="send" size={15} /> Send Merchant Onboarding
              </button>
            )}
            {["Merchant Invited", "Bank Connected", "Identity Verified", "Agreement Signed"].includes(deal.status) && (
              <button className="btn btn-secondary" onClick={() => onOpenMerchant(deal)}>
                <Icon name="eye" size={15} /> Preview Merchant Flow
              </button>
            )}
            {deal.status === "Merchant Invited" && (
              <button className="btn btn-primary" onClick={() => { onUpdate(deal.id, "Merchant Invited"); onClose(); }}>
                <Icon name="send" size={15} /> Resend Merchant Link
              </button>
            )}
            {deal.status === "Ready for Final UW" && (
              <button className="btn btn-amber" onClick={() => onOpenUW(deal)}>
                <Icon name="uw" size={15} /> Open UW Review
              </button>
            )}
            {deal.status === "UW Approved" && !deal.fundingCallDone && (
              <button className="btn btn-green" onClick={() => { onUpdate(deal.id, "Funding Call Completed"); onClose(); }}>
                <Icon name="check" size={15} /> Mark Funding Call Done
              </button>
            )}
            {deal.status === "Funding Call Completed" && (
              <button className="btn btn-green" onClick={() => { onUpdate(deal.id, "Funded"); onClose(); }}>
                <Icon name="funded" size={15} /> Mark Funded
              </button>
            )}
          </div>

          {/* Assign broker when none attached */}
          {!deal.broker.email && (
            <>
              <div className="divider" />
              <button className="btn btn-secondary btn-sm" onClick={() => { onClose(); onAssignBroker && onAssignBroker(deal); }}>
                <Icon name="funded" size={14} /> Assign Broker Shop
              </button>
            </>
          )}

          <div className="divider" />

          {/* Revert status */}
          {PREV_STATUS[deal.status] && !confirmRevert && (
            <button className="btn btn-secondary btn-sm" style={{ color: "var(--amber)" }} onClick={() => setConfirmRevert(true)}>
              ↩ Revert to "{PREV_STATUS[deal.status]}"
            </button>
          )}
          {confirmRevert && (
            <div className="flex items-center gap-8" style={{ background: "rgba(202,138,4,.06)", border: "1px solid rgba(202,138,4,.25)", borderRadius: 8, padding: "10px 14px", flexWrap: "wrap" }}>
              <span className="text-sm" style={{ color: "var(--amber)", flex: 1 }}>
                Revert <strong>{deal.id}</strong> to <strong>{PREV_STATUS[deal.status]}</strong>?
              </span>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmRevert(false)}>Cancel</button>
              <button className="btn btn-amber btn-sm" onClick={() => { onUpdate(deal.id, PREV_STATUS[deal.status]); onClose(); }}>
                Confirm Revert
              </button>
            </div>
          )}

          <div className="divider" />
          {!confirmDelete ? (
            <button className="btn btn-red btn-sm" onClick={() => setConfirmDelete(true)}>
              <Icon name="x" size={14} /> Delete Deal
            </button>
          ) : (
            <div className="flex items-center gap-8" style={{ background: "rgba(220,38,38,.06)", border: "1px solid rgba(220,38,38,.25)", borderRadius: 8, padding: "10px 14px" }}>
              <span className="text-sm" style={{ color: "var(--red)", flex: 1 }}>Delete <strong>{deal.id}</strong>? This cannot be undone.</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className="btn btn-red btn-sm" onClick={() => { onDelete(deal.id); onClose(); }}>Confirm Delete</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── NEW DEAL MODAL ───────────────────────────────────────────────────────────
const NewDealModal = ({ onClose, onCreate }) => {
  const [step, setStep] = useState(0);
  const [deal, setDeal] = useState({
    merchant: { name: "", email: "", phone: "" },
    broker: { name: "", email: "", shopId: null },
  });
  const [offers, setOffers] = useState([{ amount: "", payback: "", factor: "", term: "", frequency: "Daily", position: "1st", fee: "", expiry: "", commissionPct: "" }]);
  const [brokerShops, setBrokerShops] = useState([]);
  const [shopSearch, setShopSearch] = useState("");
  const [selectedShop, setSelectedShop] = useState(null);

  useEffect(() => {
    fetch('/api/broker-shops').then(r => r.json()).then(d => setBrokerShops(d.shops ?? [])).catch(() => {});
  }, []);

  const setM = (k, v) => setDeal(d => ({ ...d, merchant: { ...d.merchant, [k]: v } }));
  const setB = (k, v) => setDeal(d => ({ ...d, broker: { ...d.broker, [k]: v } }));
  const setO = (i, k, v) => setOffers(o => o.map((x, j) => j === i ? { ...x, [k]: v } : x));

  const submit = () => {
    const newDeal = {
      id: `D-${1004 + Math.floor(Math.random() * 900)}`,
      merchant: deal.merchant,
      broker: deal.broker,
      brokerShopId: deal.broker.shopId ?? null,
      status: "Offer Created",
      created: new Date().toISOString().split("T")[0],
      offers: offers.map((o, i) => ({ ...o, id: `O-new-${i}`, amount: +o.amount, payback: +o.payback, factor: +o.factor, term: +o.term, fee: +o.fee })),
      selectedOffer: null, bankStatus: null, idvStatus: null,
      agreementSigned: false, uwDecision: null, fundingCallDone: false,
    };
    onCreate(newDeal);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div><div className="modal-title">New Deal</div><div className="modal-sub">Enter deal info and offer terms</div></div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="stepper">
            {["Merchant Info", "Broker Info", "Offer Terms"].map((s, i) => (
              <div key={s} className={`step-item ${i < step ? "done" : i === step ? "active" : ""}`}>
                <div className="step-dot">{i < step ? <Icon name="check" size={12} color="#fff" /> : i + 1}</div>
                <div className="step-label">{s}</div>
              </div>
            ))}
          </div>

          {step === 0 && (
            <div className="fade-in">
              <div className="form-grid">
                <div className="form-group"><label className="form-label">Business Name</label><input className="form-input" value={deal.merchant.name} onChange={e => setM("name", e.target.value)} placeholder="Acme LLC" /></div>
                <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={deal.merchant.email} onChange={e => setM("email", e.target.value)} placeholder="owner@acme.com" /></div>
              </div>
              <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={deal.merchant.phone} onChange={e => setM("phone", e.target.value)} placeholder="555-000-0000" /></div>
            </div>
          )}

          {step === 1 && (
            <div className="fade-in">
              <div className="form-group">
                <label className="form-label">Search Broker Shop</label>
                <input className="form-input" value={shopSearch} onChange={e => { setShopSearch(e.target.value); setSelectedShop(null); setB("shopId", null); setB("name", ""); setB("email", ""); }} placeholder="Type to search shops…" />
              </div>
              {shopSearch.length > 0 && !selectedShop && (() => {
                const filtered = brokerShops.filter(s => s.name.toLowerCase().includes(shopSearch.toLowerCase()));
                return filtered.length > 0 ? (
                  <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
                    {filtered.map(s => (
                      <button key={s.id} className="nav-item" style={{ width: "100%", textAlign: "left", borderRadius: 0, borderBottom: "1px solid var(--border)" }}
                        onClick={() => {
                          setSelectedShop(s);
                          setShopSearch(s.name);
                          setB("shopId", s.id);
                          const primary = s.contacts?.find(c => c.isPrimary) ?? s.contacts?.[0];
                          setB("name", primary?.name ?? s.name);
                          setB("email", primary?.email ?? s.email ?? "");
                        }}>
                        <span className="fw-600">{s.name}</span>
                        {s.email && <span className="text-dim text-xs" style={{ marginLeft: 8 }}>{s.email}</span>}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-dim text-xs" style={{ marginBottom: 12 }}>No shops found — enter contact details manually below.</div>
                );
              })()}
              {selectedShop && selectedShop.contacts?.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Select Contact</label>
                  <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                    {selectedShop.contacts.map(c => (
                      <button key={c.id} className={`nav-item ${deal.broker.email === c.email ? "active" : ""}`} style={{ width: "100%", textAlign: "left", borderRadius: 0, borderBottom: "1px solid var(--border)" }}
                        onClick={() => { setB("name", c.name); setB("email", c.email); }}>
                        <span className="fw-600">{c.name}</span>
                        {c.isPrimary && <span style={{ fontSize: 10, background: "var(--accent)", color: "#fff", borderRadius: 4, padding: "1px 6px", marginLeft: 6 }}>Primary</span>}
                        <span className="text-dim text-xs" style={{ marginLeft: 8 }}>{c.email}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="form-grid">
                <div className="form-group"><label className="form-label">Contact Name</label><input className="form-input" value={deal.broker.name} onChange={e => setB("name", e.target.value)} placeholder="Rep name" /></div>
                <div className="form-group"><label className="form-label">Contact Email</label><input className="form-input" value={deal.broker.email} onChange={e => setB("email", e.target.value)} placeholder="rep@shop.com" /></div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="fade-in">
              {offers.map((o, i) => (
                <div key={i} className="card card-sm mb-12" style={{ background: "var(--bg)" }}>
                  <div className="flex justify-between mb-12">
                    <span className="fw-600 text-sm">Offer {i + 1}</span>
                    {offers.length > 1 && <button className="btn btn-secondary btn-sm" onClick={() => setOffers(os => os.filter((_, j) => j !== i))}>Remove</button>}
                  </div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Advance Amount</label>
                      <CurrencyInput value={o.amount} placeholder="50000"
                        onChange={amt => {
                          const updates = { amount: amt };
                          if (amt && o.factor) updates.payback = (parseFloat(amt) * parseFloat(o.factor)).toFixed(0);
                          else if (amt && o.payback) updates.factor = (parseFloat(o.payback) / parseFloat(amt)).toFixed(4);
                          setOffers(os => os.map((x, j) => j === i ? { ...x, ...updates } : x));
                        }} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Factor Rate</label>
                      <input className="form-input" type="number" step=".01" value={o.factor}
                        onChange={e => {
                          const fac = e.target.value;
                          const updates = { factor: fac };
                          if (fac && o.amount) updates.payback = (parseFloat(o.amount) * parseFloat(fac)).toFixed(2);
                          setOffers(os => os.map((x, j) => j === i ? { ...x, ...updates } : x));
                        }}
                        placeholder="1.35" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">
                        Payback Amount
                        {o.amount && o.factor && <span style={{ color: "var(--green)", fontSize: 10, marginLeft: 6, fontFamily: "var(--mono)" }}>● AUTO</span>}
                      </label>
                      <CurrencyInput value={o.payback} placeholder="auto-calculates"
                        style={{ borderColor: o.amount && o.factor ? "var(--accent)" : undefined }}
                        onChange={pb => {
                          const updates = { payback: pb };
                          if (pb && o.amount) updates.factor = (parseFloat(pb) / parseFloat(o.amount)).toFixed(4);
                          setOffers(os => os.map((x, j) => j === i ? { ...x, ...updates } : x));
                        }} />
                    </div>
                    <div className="form-group"><label className="form-label">Term ({o.frequency === "Daily" ? "business days" : o.frequency === "Weekly" ? "weeks" : "months"})</label><input className="form-input" type="number" value={o.term} onChange={e => setO(i, "term", e.target.value)} placeholder={o.frequency === "Daily" ? "120" : o.frequency === "Weekly" ? "20" : "8"} /></div>
                    <div className="form-group"><label className="form-label">ACH Frequency</label>
                      <select className="form-input" value={o.frequency} onChange={e => setO(i, "frequency", e.target.value)}>
                        <option>Daily</option><option>Weekly</option><option>Monthly</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ gridColumn: "span 2" }}>
                      <label className="form-label">
                        ACH Remittance Amount
                        {o.payback && o.term && <span style={{ color: "var(--green)", fontSize: 11, marginLeft: 8, fontWeight: 600 }}>● Auto-calculated</span>}
                      </label>
                      {(() => {
                        const pb = parseFloat(o.payback);
                        const term = parseFloat(o.term);
                        if (!pb || !term) return (
                          <div className="form-input" style={{ background: "var(--surface2)", color: "var(--text3)" }}>
                            Enter payback amount and term first
                          </div>
                        );
                        const periods = term;
                        const ach = pb / periods;
                        return (
                          <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                            <div className="form-input" style={{ flex: 1, background: "rgba(22,163,74,.06)", border: "1.5px solid rgba(22,163,74,.3)", color: "var(--green)", fontWeight: 700, fontSize: 16, fontFamily: "var(--mono)", display: "flex", alignItems: "center", gap: 8 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--green)"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
                              {fmt(Math.round(ach))}
                              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text2)", marginLeft: 2 }}>per {o.frequency === "Daily" ? "business day" : o.frequency === "Weekly" ? "week" : "month"}</span>
                            </div>
                            <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "var(--text2)", lineHeight: 1.5, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                              <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{Math.round(periods)} payments</div>
                              <div>{o.frequency === "Daily" ? "business days" : o.frequency === "Weekly" ? "weeks" : "months"}</div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="form-group"><label className="form-label">Position</label>
                      <select className="form-input" value={o.position} onChange={e => setO(i, "position", e.target.value)}>
                        <option>1st</option><option>2nd</option><option>3rd</option><option>4th</option><option>5th</option><option>6th</option><option>7th</option><option>8th</option><option>9th</option><option>10th</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Origination Fee %</label>
                      <div style={{ position: "relative" }}>
                        <input className="form-input" type="number" step="0.1" min="0" max="100"
                          value={o.fee} onChange={e => setO(i, "fee", e.target.value)}
                          placeholder="10" style={{ paddingRight: 28 }} />
                        <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text2)", fontSize: 14, fontWeight: 600, pointerEvents: "none" }}>%</span>
                      </div>
                      {o.fee && o.amount && (
                        <div style={{ fontSize: 12, color: "var(--green)", marginTop: 4, fontWeight: 600 }}>
                          = {fmt((+o.amount * +o.fee) / 100)}
                        </div>
                      )}
                    </div>
                    <div className="form-group"><label className="form-label">Offer Expiry</label><input className="form-input" type="date" value={o.expiry} onChange={e => setO(i, "expiry", e.target.value)} /></div>
                  </div>
                  <div className="divider" style={{ margin: "12px 0 8px" }} />
                  <div className="flex items-center gap-8 mb-8">
                    <Icon name="funded" size={14} color="var(--accent)" />
                    <span className="fw-600 text-sm text-accent">Broker Commission</span>
                  </div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Commission %</label>
                      <input className="form-input" type="number" step="0.1" min="0" max="100"
                        value={o.commissionPct || ""} onChange={e => setO(i, "commissionPct", e.target.value)} placeholder="e.g. 10" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Commission $ (auto)</label>
                      <div className="form-input" style={{ background: "var(--surface2)", color: o.commissionPct && o.amount ? "var(--green)" : "var(--text3)", fontWeight: 600, display: "flex", alignItems: "center" }}>
                        {o.commissionPct && o.amount ? fmt((+o.amount * +o.commissionPct) / 100) : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" onClick={() => setOffers(o => [...o, { amount: "", payback: "", factor: "", term: "", frequency: "Daily", position: "1st", fee: "", expiry: "" }])}>
                <Icon name="plus" size={14} /> Add Another Offer
              </button>
            </div>
          )}
        </div>
        <div className="modal-footer">
          {step > 0 && <button className="btn btn-secondary" onClick={() => setStep(s => s - 1)}>Back</button>}
          {step < 2 && <button className="btn btn-primary" onClick={() => setStep(s => s + 1)}>Next <Icon name="chevronRight" size={14} /></button>}
          {step === 2 && <button className="btn btn-green" onClick={submit}><Icon name="check" size={14} /> Create Deal</button>}
        </div>
      </div>
    </div>
  );
};

// ─── BROKER VIEW ──────────────────────────────────────────────────────────────
const BrokerView = ({ deal, onClose, onSelect }) => {
  const [selected, setSelected] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirm = () => {
    if (!selected) return;
    setConfirmed(true);
    onSelect(deal.id, selected);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="mono text-xs text-dim" style={{ marginBottom: 4 }}>SECURE BROKER LINK · {deal.id}</div>
            <div className="modal-title">Select an Offer</div>
            <div className="modal-sub">Review the options below and select one offer for {deal.merchant.name}</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">
          {confirmed ? (
            <div className="fade-in" style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(16,185,129,.15)", border: "2px solid var(--green)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <Icon name="check" size={32} color="var(--green)" />
              </div>
              <div className="fw-700" style={{ fontSize: 18, marginBottom: 8 }}>Offer Selected</div>
              <div className="text-muted text-sm">Your selection has been locked. The merchant will receive their onboarding link shortly.</div>
            </div>
          ) : (
            <>
              <div className="card card-sm mb-16" style={{ background: "rgba(245,158,11,.06)", border: "1px solid rgba(245,158,11,.2)" }}>
                <div className="flex items-center gap-8">
                  <Icon name="alert" size={15} color="var(--amber)" />
                  <span className="text-xs text-amber">This link is unique and secure. Once you select an offer, it cannot be changed without contacting your funder.</span>
                </div>
              </div>
              {deal.offers.map(o => (
                <div key={o.id} className={`offer-card ${selected === o.id ? "selected" : ""}`} onClick={() => setSelected(o.id)}>
                  <div className="flex justify-between items-center mb-8">
                    <div className="offer-amount">{fmt(o.amount)}</div>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${selected === o.id ? "var(--accent)" : "var(--border2)"}`, background: selected === o.id ? "var(--accent)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {selected === o.id && <Icon name="check" size={12} color="#fff" />}
                    </div>
                  </div>
                  <div className="offer-meta">
                    <div className="offer-meta-item"><div className="offer-meta-label">Total Payback</div><div className="offer-meta-value">{fmt(o.payback)}</div></div>
                    <div className="offer-meta-item"><div className="offer-meta-label">Factor Rate</div><div className="offer-meta-value">{o.factor}x</div></div>
                    <div className="offer-meta-item"><div className="offer-meta-label">Term</div><div className="offer-meta-value">{o.term} months</div></div>
                    <div className="offer-meta-item"><div className="offer-meta-label">Payment</div><div className="offer-meta-value">{o.frequency}</div></div>
                    <div className="offer-meta-item"><div className="offer-meta-label">ACH Remittance</div><div className="offer-meta-value" style={{color:"var(--green)",fontWeight:700}}>{o.payback && o.term ? fmt(Math.round(o.payback / (o.frequency==="Daily"?o.term*21.5:o.frequency==="Weekly"?o.term*4.33:o.term))) : "—"}</div></div>
                    <div className="offer-meta-item"><div className="offer-meta-label">Position</div><div className="offer-meta-value">{o.position}</div></div>
                    <div className="offer-meta-item"><div className="offer-meta-label">Orig. Fee</div><div className="offer-meta-value">{o.fee}% · {fmt((+o.amount * +o.fee)/100)}</div></div>
                    <div className="offer-meta-item"><div className="offer-meta-label">Expires</div><div className="offer-meta-value">{o.expiry}</div></div>
                  </div>
                  {o.commissionPct && (
                    <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(22,163,74,.08)", border: "1px solid rgba(22,163,74,.2)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Icon name="funded" size={14} color="var(--green)" />
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--green)" }}>Your Commission</span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: 18, fontWeight: 700, color: "var(--green)", fontFamily: "var(--mono)" }}>{fmt((o.amount * o.commissionPct) / 100)}</span>
                        <span style={{ fontSize: 11, color: "var(--text2)", marginLeft: 6 }}>({o.commissionPct}% of advance)</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
        {!confirmed && (
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleConfirm} disabled={!selected} style={{ opacity: selected ? 1 : 0.4 }}>
              <Icon name="check" size={14} /> Confirm Selection
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── MERCHANT ONBOARDING VIEW ─────────────────────────────────────────────────
const PlaidConnectButton = ({ dealId, onConnected }) => {
  const [linkToken, setLinkToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/plaid/create-link-token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dealId }) })
      .then(r => r.json())
      .then(data => setLinkToken(data.link_token))
      .catch(() => setError("Failed to initialise Plaid. Please try again."));
  }, [dealId]);

  const onSuccess = useCallback(async (public_token, metadata) => {
    setLoading(true);
    try {
      const res = await fetch("/api/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token, dealId, metadata }),
      });
      if (!res.ok) throw new Error("Exchange failed");
      onConnected();
    } catch {
      setError("Bank connection failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [dealId, onConnected]);

  const { open, ready } = usePlaidLink({ token: linkToken ?? "", onSuccess });

  if (error) return <div style={{ color: "var(--red)", fontSize: 13 }}>{error}</div>;

  return (
    <button
      className="btn btn-primary"
      onClick={() => open()}
      disabled={!ready || loading}
    >
      <Icon name="bank" size={14} /> {loading ? "Connecting…" : "Connect via Plaid"}
    </button>
  );
};

const PersonaVerifyButton = ({ dealId, onVerified }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/persona/create-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId }),
      });
      if (!res.ok) throw new Error("Failed to create inquiry");
      const { inquiryId } = await res.json();

      const { Client } = await import("persona");
      const client = new Client({
        inquiryId,
        environment: process.env.NEXT_PUBLIC_PERSONA_ENV ?? "sandbox",
        onReady: () => { client.open(); setLoading(false); },
        onComplete: async ({ inquiryId: completedId, status, fields }) => {
          try {
            await fetch("/api/persona/complete-inquiry", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ dealId, inquiryId: completedId, status, fields }),
            });
            onVerified();
          } catch {
            setError("Failed to save verification result. Please try again.");
          }
        },
        onCancel: () => setLoading(false),
        onError: (err) => {
          console.error(err);
          setError("Verification failed. Please try again.");
          setLoading(false);
        },
      });
    } catch {
      setError("Failed to start identity check. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      {error && <div style={{ color: "var(--red, #ef4444)", fontSize: 13 }}>{error}</div>}
      <button className="btn btn-primary" onClick={handleClick} disabled={loading}>
        <Icon name="id" size={14} /> {loading ? "Loading…" : "Start Identity Check"}
      </button>
    </div>
  );
};

const DocuSignButton = ({ dealId, onSigned }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    let popup = null;

    const onMessage = async (e) => {
      if (e.origin !== window.location.origin) return;
      if (!e.data || e.data.type !== 'docusign') return;
      window.removeEventListener('message', onMessage);
      if (popup && !popup.closed) popup.close();
      if (e.data.event === 'signing_complete') {
        onSigned();
      } else {
        setError('Signing was cancelled or declined. Please try again.');
        setLoading(false);
      }
    };

    try {
      const res = await fetch('/api/docusign/create-envelope', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId }),
      });
      if (!res.ok) throw new Error('Failed to create signing envelope');
      const { signingUrl } = await res.json();

      const w = 900, h = 650;
      const left = Math.max(0, (window.screen.width - w) / 2);
      const top = Math.max(0, (window.screen.height - h) / 2);
      popup = window.open(signingUrl, 'docusign_signing', `width=${w},height=${h},left=${left},top=${top},toolbar=0,menubar=0`);

      if (!popup) {
        setError('Popup blocked. Please allow popups for this site and try again.');
        setLoading(false);
        return;
      }

      window.addEventListener('message', onMessage);

      // Fallback: if popup closes without sending a message, reset loading
      const pollClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollClosed);
          window.removeEventListener('message', onMessage);
          setLoading(false);
        }
      }, 500);
    } catch {
      setError('Failed to start signing. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      {error && <div style={{ color: 'var(--red, #ef4444)', fontSize: 13 }}>{error}</div>}
      <button className="btn btn-primary" onClick={handleClick} disabled={loading}>
        <Icon name="sign" size={14} /> {loading ? 'Opening…' : 'Review & Sign'}
      </button>
    </div>
  );
};

const MerchantView = ({ deal, onClose, onComplete }) => {
  const [mStep, setMStep] = useState(0);
  const steps = ["Bank Connection", "Identity Verification", "Sign Agreement", "Complete"];
  const done = [deal.bankStatus === "connected", deal.idvStatus === "pass", deal.agreementSigned, false];

  const handleAction = () => {
    if (mStep === 2) onComplete(deal.id, "sign");
    if (mStep < 3) setMStep(s => s + 1);
  };

  const handleBankConnected = useCallback(() => {
    onComplete(deal.id, "bank");
    setMStep(1);
  }, [deal.id, onComplete]);

  const handleIdvVerified = useCallback(() => {
    onComplete(deal.id, "idv");
    setMStep(2);
  }, [deal.id, onComplete]);

  const handleAgreementSigned = useCallback(() => {
    onComplete(deal.id, "sign");
    setMStep(3);
  }, [deal.id, onComplete]);

  const stepContent = [
    {
      title: "Connect Your Bank",
      sub: "Securely link your business bank account so we can review recent transactions.",
      action: "Connect via Plaid",
      icon: "bank",
    },
    {
      title: "Verify Your Identity",
      sub: "We need to verify the identity of all owners and guarantors. Have your ID ready.",
      action: "Start Identity Check",
      icon: "id",
    },
    {
      title: "Sign Your Agreement",
      sub: "Review and electronically sign your merchant cash advance agreement.",
      action: "Review & Sign",
      icon: "sign",
    },
    {
      title: "All Done!",
      sub: "Your application is complete and has been sent to our underwriting team for review.",
      action: null,
      icon: "check",
    },
  ];

  const s = stepContent[mStep];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="mono text-xs text-dim" style={{ marginBottom: 4 }}>MERCHANT ONBOARDING · {deal.id}</div>
            <div className="modal-title">{deal.merchant.name}</div>
            <div className="modal-sub">Complete all steps to finalize your advance</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">
          {/* Progress bars */}
          <div className="onboard-progress" style={{ marginBottom: 24 }}>
            {steps.slice(0, 3).map((_, i) => (
              <div key={i} className={`onboard-progress-bar ${i < mStep ? "done" : i === mStep ? "active" : ""}`} />
            ))}
          </div>

          {/* Step cards */}
          <div className="timeline">
            {steps.map((label, i) => (
              <div key={label} className="timeline-item">
                <div className={`timeline-dot ${i < mStep ? "done" : i === mStep ? "current" : ""}`}>
                  {i < mStep ? <Icon name="check" size={11} color="#fff" /> : null}
                </div>
                <div className="timeline-content">
                  <div className="timeline-label" style={{ color: i === mStep ? "var(--text)" : i < mStep ? "var(--green)" : "var(--text3)" }}>{label}</div>
                  {i < mStep && <div className="timeline-time">Completed ✓</div>}
                  {i === mStep && label !== "Complete" && <div className="timeline-time" style={{ color: "var(--accent)" }}>In progress</div>}
                </div>
              </div>
            ))}
          </div>

          <div className="divider" />

          <div className="fade-in" key={mStep} style={{ textAlign: "center", padding: "8px 0 16px" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: mStep === 3 ? "rgba(16,185,129,.12)" : "rgba(59,130,246,.12)", border: `2px solid ${mStep === 3 ? "var(--green)" : "var(--accent)"}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <Icon name={s.icon} size={26} color={mStep === 3 ? "var(--green)" : "var(--accent)"} />
            </div>
            <div className="fw-700" style={{ fontSize: 16, marginBottom: 6 }}>{s.title}</div>
            <div className="text-muted text-sm" style={{ maxWidth: 340, margin: "0 auto" }}>{s.sub}</div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          {mStep === 0 && (
            <PlaidConnectButton dealId={deal.id} onConnected={handleBankConnected} />
          )}
          {mStep === 1 && (
            <PersonaVerifyButton dealId={deal.id} onVerified={handleIdvVerified} />
          )}
          {mStep === 2 && (
            <DocuSignButton dealId={deal.id} onSigned={handleAgreementSigned} />
          )}
        </div>
      </div>
    </div>
  );
};

// ─── UW REVIEW MODAL ──────────────────────────────────────────────────────────
const UWModal = ({ deal, onClose, onDecide }) => {
  const offer = deal.offers.find(o => o.id === deal.selectedOffer) || deal.offers[0];
  const [fullDeal, setFullDeal] = useState(null);
  const [loadingArtifacts, setLoadingArtifacts] = useState(true);
  const [bankReport, setBankReport] = useState(null);
  const [bankReportLoading, setBankReportLoading] = useState(false);
  const [bankReportOpen, setBankReportOpen] = useState(false);
  const [idvDetail, setIdvDetail] = useState(null);
  const [idvDetailLoading, setIdvDetailLoading] = useState(false);
  const [idvDetailOpen, setIdvDetailOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/deals/${deal.id}`)
      .then(r => r.json())
      .then(d => { setFullDeal(d); setLoadingArtifacts(false); })
      .catch(() => setLoadingArtifacts(false));
  }, [deal.id]);

  const bank = fullDeal?.bankConnections?.[0] ?? null;
  const idv = fullDeal?.identityRecords?.[0] ?? null;
  const agreement = fullDeal?.agreements?.[0] ?? null;

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const fmtCurrency = (n) => n != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n) : '—';

  const handleViewBankReport = () => {
    if (bankReport) { setBankReportOpen(o => !o); return; }
    setBankReportLoading(true);
    fetch(`/api/plaid/report?dealId=${deal.id}`)
      .then(r => r.json())
      .then(d => { setBankReport(d); setBankReportOpen(true); setBankReportLoading(false); })
      .catch(() => setBankReportLoading(false));
  };

  const handleViewIdCheck = () => {
    if (idvDetail) { setIdvDetailOpen(o => !o); return; }
    setIdvDetailLoading(true);
    fetch(`/api/persona/inquiry?dealId=${deal.id}`)
      .then(r => r.json())
      .then(d => { setIdvDetail(d); setIdvDetailOpen(true); setIdvDetailLoading(false); })
      .catch(() => setIdvDetailLoading(false));
  };

  const statusColor = (s) => {
    if (!s) return 'var(--text3)';
    const u = s.toUpperCase();
    if (['CONNECTED', 'COMPLETED', 'SIGNED', 'PASSED', 'APPROVED'].includes(u)) return 'var(--green)';
    if (['FAILED', 'DECLINED', 'DECLINED'].includes(u)) return 'var(--red)';
    if (['REVIEW', 'PENDING'].includes(u)) return 'var(--amber, #f59e0b)';
    return 'var(--text2)';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="mono text-xs text-dim" style={{ marginBottom: 4 }}>FINAL UNDERWRITING · {deal.id}</div>
            <div className="modal-title">{deal.merchant.name}</div>
            <div className="modal-sub">Review all artifacts before making a decision</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="grid-2">
            <div>
              <div className="uw-artifact">
                <div className="uw-artifact-label">Selected Offer Snapshot</div>
                <div className="fw-700" style={{ fontSize: 20 }}>{fmt(offer?.amount)}</div>
                <div className="text-sm text-muted mt-4">Payback: {fmt(offer?.payback)} · Factor: {offer?.factor}x</div>
                <div className="text-sm text-muted mt-4">Term: {offer?.term} mo · {offer?.frequency} · {offer?.position} position</div>
                <div className="tag mt-8" style={{ background: "rgba(99,102,241,.15)", color: "var(--purple)" }}>LOCKED SNAPSHOT</div>
              </div>
              <div className="uw-artifact" style={{ marginTop: 10 }}>
                <div className="uw-artifact-label">Broker</div>
                <div className="fw-600 text-sm">{deal.broker.name}</div>
                <div className="text-xs text-dim mt-4">{deal.broker.email}</div>
              </div>
            </div>
            <div>
              {/* Bank Connection */}
              <div className="uw-artifact">
                <div className="uw-artifact-label">Bank Connection</div>
                {loadingArtifacts ? (
                  <div className="text-sm text-muted">Loading…</div>
                ) : bank ? (
                  <>
                    <div className="flex items-center gap-8" style={{ marginBottom: 6 }}>
                      <Icon name="bank" size={15} color={statusColor(bank.status)} />
                      <span className="fw-600 text-sm" style={{ color: statusColor(bank.status) }}>{bank.status}</span>
                    </div>
                    {bank.institutionName && (
                      <div className="text-sm" style={{ marginBottom: 4 }}>Institution: <strong>{bank.institutionName}</strong></div>
                    )}
                    <div className="text-xs text-dim">Connected {fmtDate(bank.createdAt)}</div>
                    {bank.plaidItemId && (
                      <div className="mono text-xs text-dim mt-4" style={{ wordBreak: 'break-all' }}>Item ID: {bank.plaidItemId}</div>
                    )}
                    <button className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={handleViewBankReport} disabled={bankReportLoading}>
                      <Icon name="bank" size={13} /> {bankReportLoading ? 'Loading…' : bankReportOpen ? 'Hide Bank Report' : 'View Bank Report'}
                    </button>
                    {bankReportOpen && bankReport && (
                      <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                        {bankReport.accounts?.map((acct, i) => (
                          <div key={i} style={{ marginBottom: 8, padding: '8px 10px', background: 'var(--bg2)', borderRadius: 6 }}>
                            <div className="fw-600 text-sm">{acct.name} <span className="text-dim">({acct.subtype})</span></div>
                            <div className="text-sm mt-4">Balance: <strong>{fmtCurrency(acct.balances?.current)}</strong> · Available: {fmtCurrency(acct.balances?.available)}</div>
                          </div>
                        ))}
                        {bankReport.transactions?.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <div className="text-xs text-dim fw-600" style={{ marginBottom: 6 }}>LAST 90 DAYS ({bankReport.transactions.length} transactions)</div>
                            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                              {bankReport.transactions.slice(0, 50).map((tx, i) => (
                                <div key={i} className="flex items-center" style={{ justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                                  <div>
                                    <span className="text-dim">{tx.date}</span>
                                    <span style={{ marginLeft: 8 }}>{tx.name}</span>
                                  </div>
                                  <span style={{ color: tx.amount > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>{fmtCurrency(Math.abs(tx.amount))}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-8">
                    <Icon name="bank" size={15} color="var(--text3)" />
                    <span className="text-sm" style={{ color: 'var(--text3)' }}>Not connected</span>
                  </div>
                )}
              </div>

              {/* Identity Verification */}
              <div className="uw-artifact" style={{ marginTop: 10 }}>
                <div className="uw-artifact-label">Identity Verification</div>
                {loadingArtifacts ? (
                  <div className="text-sm text-muted">Loading…</div>
                ) : idv ? (
                  <>
                    <div className="flex items-center gap-8" style={{ marginBottom: 6 }}>
                      <Icon name="id" size={15} color={statusColor(idv.status)} />
                      <span className="fw-600 text-sm" style={{ color: statusColor(idv.status) }}>{idv.status}</span>
                    </div>
                    {idv.inquiryId && (
                      <div className="mono text-xs text-dim mt-4" style={{ wordBreak: 'break-all' }}>Inquiry: {idv.inquiryId}</div>
                    )}
                    <div className="text-xs text-dim mt-4">Completed {fmtDate(idv.completedAt)}</div>
                    <button className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={handleViewIdCheck} disabled={idvDetailLoading}>
                      <Icon name="id" size={13} /> {idvDetailLoading ? 'Loading…' : idvDetailOpen ? 'Hide ID Check' : 'View ID Check'}
                    </button>
                    {idvDetailOpen && idvDetail && (
                      <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {[
                          ['Status', idvDetail.status],
                          ['Name', [idvDetail.nameFirst, idvDetail.nameLast].filter(Boolean).join(' ') || '—'],
                          ['Birthdate', idvDetail.birthdate || '—'],
                          ['Document', idvDetail.documentType || '—'],
                          ['Country', idvDetail.country || '—'],
                          ['Completed', fmtDate(idvDetail.completedAt)],
                        ].map(([label, val]) => (
                          <div key={label} style={{ padding: '6px 8px', background: 'var(--bg2)', borderRadius: 5 }}>
                            <div className="text-xs text-dim">{label}</div>
                            <div className="text-sm fw-600" style={{ marginTop: 2 }}>{val}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-8">
                    <Icon name="id" size={15} color="var(--text3)" />
                    <span className="text-sm" style={{ color: 'var(--text3)' }}>Not verified</span>
                  </div>
                )}
              </div>

              {/* Signed Agreement */}
              <div className="uw-artifact" style={{ marginTop: 10 }}>
                <div className="uw-artifact-label">Signed Agreement</div>
                {loadingArtifacts ? (
                  <div className="text-sm text-muted">Loading…</div>
                ) : agreement ? (
                  <>
                    <div className="flex items-center gap-8" style={{ marginBottom: 6 }}>
                      <Icon name="sign" size={15} color={statusColor(agreement.status)} />
                      <span className="fw-600 text-sm" style={{ color: statusColor(agreement.status) }}>{agreement.status}</span>
                    </div>
                    <div className="text-xs text-dim mt-4">Signed {fmtDate(agreement.signedAt)}</div>
                    {agreement.signatureRequestId && (
                      <div className="mono text-xs text-dim mt-4" style={{ wordBreak: 'break-all' }}>Envelope: {agreement.signatureRequestId}</div>
                    )}
                    <button className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={() => window.open(`/api/docusign/document?dealId=${deal.id}`, '_blank')}>
                      <Icon name="sign" size={13} /> View Signed Document ↗
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-8">
                    <Icon name="sign" size={15} color="var(--text3)" />
                    <span className="text-sm" style={{ color: 'var(--text3)' }}>Not signed</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="divider" />

          <div className="uw-artifact" style={{ background: "rgba(245,158,11,.04)", border: "1px solid rgba(245,158,11,.15)" }}>
            <div className="uw-artifact-label">UW Notes</div>
            <textarea className="form-input" rows={3} placeholder="Add underwriting notes or conditions..." style={{ resize: "vertical" }} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-red" onClick={() => { onDecide(deal.id, "declined"); onClose(); }}>
            <Icon name="x" size={14} /> Decline
          </button>
          <button className="btn btn-green" onClick={() => { onDecide(deal.id, "approved"); onClose(); }}>
            <Icon name="check" size={14} /> Approve
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
const Dashboard = ({ deals, onSelectDeal }) => {
  const total = deals.length;
  const newSubmissions = deals.filter(d => d.status === "Submission Received").length;
  const funded = deals.filter(d => d.status === "Funded").length;
  const uwReady = deals.filter(d => d.status === "Ready for Final UW").length;
  const totalVolume = deals.filter(d => d.selectedOffer).reduce((acc, d) => {
    const o = d.offers.find(o => o.id === d.selectedOffer) || d.offers[0];
    return acc + (o?.amount || 0);
  }, 0);

  const recent = [...deals].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 5);

  return (
    <div className="fade-in">
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        <div className="stat-card">
          <div className="stat-label">Total Deals</div>
          <div className="stat-value">{total}</div>
          <div className="stat-sub">All time</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">New Submissions</div>
          <div className="stat-value" style={{ color: "#0ea5e9" }}>{newSubmissions}</div>
          <div className="stat-sub">Awaiting offer</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">UW Queue</div>
          <div className="stat-value" style={{ color: "var(--amber)" }}>{uwReady}</div>
          <div className="stat-sub">Awaiting review</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Funded</div>
          <div className="stat-value" style={{ color: "var(--green)" }}>{funded}</div>
          <div className="stat-sub">Completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Volume</div>
          <div className="stat-value" style={{ fontSize: 22 }}>{fmt(totalVolume)}</div>
          <div className="stat-sub">Selected offers</div>
        </div>
      </div>

      <div className="card">
        <div className="section-header">
          <div className="section-title">Recent Deals</div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Deal ID</th>
              <th>Merchant</th>
              <th>Broker</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {recent.map(d => {
              const o = d.selectedOffer ? d.offers.find(x => x.id === d.selectedOffer) : d.offers[0];
              return (
                <tr key={d.id} onClick={() => onSelectDeal(d)}>
                  <td><span className="mono text-xs text-accent">{d.id}</span></td>
                  <td><span className="fw-600">{d.merchant.name}</span></td>
                  <td><span className="text-muted">{d.broker.name}</span></td>
                  <td><span className="mono">{fmt(o?.amount)}</span></td>
                  <td><StatusPill status={d.status} /></td>
                  <td><span className="text-dim text-xs mono">{d.created}</span></td>
                  <td onClick={e => e.stopPropagation()}>
                    <button className="btn btn-red btn-sm" onClick={() => onDeleteDeal(d.id)} title="Delete deal">
                      <Icon name="x" size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── DEALS LIST ───────────────────────────────────────────────────────────────
const DealsList = ({ deals, onSelectDeal, onNewDeal, onDeleteDeal }) => {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");

  const filtered = deals.filter(d =>
    (filterStatus === "All" || d.status === filterStatus) &&
    (d.merchant.name.toLowerCase().includes(search.toLowerCase()) ||
      d.broker.name.toLowerCase().includes(search.toLowerCase()) ||
      d.id.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="fade-in">
      <div className="flex justify-between items-center mb-16">
        <div className="flex gap-8 items-center">
          <div style={{ position: "relative" }}>
            <input className="form-input" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search deals…" style={{ paddingLeft: 32, width: 220 }} />
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}>
              <Icon name="search" size={14} color="var(--text3)" />
            </span>
          </div>
          <select className="form-input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 200 }}>
            <option value="All">All Statuses</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={onNewDeal}><Icon name="plus" size={15} /> New Deal</button>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Deal ID</th>
              <th>Merchant</th>
              <th>Broker</th>
              <th>Offers</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => {
              const o = d.selectedOffer ? d.offers.find(x => x.id === d.selectedOffer) : d.offers[0];
              return (
                <tr key={d.id} onClick={() => onSelectDeal(d)}>
                  <td><span className="mono text-xs text-accent">{d.id}</span></td>
                  <td>
                    <div className="fw-600">{d.merchant.name}</div>
                    <div className="text-xs text-dim mono">{d.merchant.email}</div>
                  </td>
                  <td>
                    <div className="text-muted">{d.broker.name}</div>
                    <div className="text-xs text-dim mono">{d.broker.email}</div>
                  </td>
                  <td><span className="mono">{d.offers.length}</span></td>
                  <td><span className="mono fw-600">{fmt(o?.amount)}</span></td>
                  <td><StatusPill status={d.status} /></td>
                  <td><span className="text-dim text-xs mono">{d.created}</span></td>
                  <td onClick={e => e.stopPropagation()}>
                    <button className="btn btn-red btn-sm" onClick={() => onDeleteDeal(d.id)} title="Delete deal">
                      <Icon name="x" size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--text3)" }}>No deals found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── UW QUEUE ─────────────────────────────────────────────────────────────────
const UWQueue = ({ deals, onOpen }) => {
  const queue = deals.filter(d => d.status === "Ready for Final UW");
  return (
    <div className="fade-in">
      <div className="card">
        <div className="section-header mb-16">
          <div className="section-title">Underwriting Queue</div>
          <span className="tag" style={{ background: "rgba(249,115,22,.15)", color: "var(--amber)" }}>{queue.length} pending</span>
        </div>
        {queue.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text3)" }}>
            <Icon name="check" size={32} color="var(--green)" />
            <div style={{ marginTop: 12 }}>No files awaiting review</div>
          </div>
        ) : (
          queue.map(d => {
            const o = d.offers.find(x => x.id === d.selectedOffer) || d.offers[0];
            return (
              <div key={d.id} className="uw-artifact mb-12" style={{ cursor: "pointer" }} onClick={() => onOpen(d)}>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="fw-700">{d.merchant.name}</div>
                    <div className="text-xs text-dim mono mt-4">{d.id} · {d.broker.name}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="fw-600 mono" style={{ fontSize: 16 }}>{fmt(o?.amount)}</div>
                    <div className="text-xs text-dim">{o?.factor}x · {o?.term} mo</div>
                  </div>
                </div>
                <div className="flex gap-8 mt-8">
                  {[
                    { label: "Bank", ok: !!d.bankStatus },
                    { label: "KYC", ok: d.idvStatus === "pass" },
                    { label: "Signed", ok: d.agreementSigned },
                  ].map(({ label, ok }) => (
                    <span key={label} className="tag" style={{ background: ok ? "rgba(16,185,129,.12)" : "rgba(239,68,68,.1)", color: ok ? "var(--green)" : "var(--red)" }}>
                      {ok ? "✓" : "✗"} {label}
                    </span>
                  ))}
                  <button className="btn btn-amber btn-sm" style={{ marginLeft: "auto" }} onClick={e => { e.stopPropagation(); onOpen(d); }}>
                    Review →
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ─── NOTIFICATIONS PANEL ──────────────────────────────────────────────────────
const NotificationsPanel = ({ deals }) => {
  const alerts = [];
  deals.forEach(d => {
    if (d.status === "Ready for Final UW") alerts.push({ type: "uw", msg: `${d.merchant.name} is ready for UW review`, id: d.id, color: "var(--amber)" });
    if (d.status === "Offer Sent to Broker") alerts.push({ type: "waiting", msg: `Waiting on broker selection for ${d.id}`, id: d.id, color: "var(--accent)" });
    if (d.bankStatus === "failed") alerts.push({ type: "error", msg: `Bank connection failed: ${d.merchant.name}`, id: d.id, color: "var(--red)" });
  });

  return (
    <div className="fade-in">
      <div className="card">
        <div className="section-header mb-16">
          <div className="section-title">System Alerts</div>
          <span className="tag" style={{ background: "rgba(99,102,241,.15)", color: "var(--purple)" }}>{alerts.length} active</span>
        </div>
        {alerts.length === 0 ? (
          <div style={{ textAlign: "center", padding: 32, color: "var(--text3)" }}>No active alerts</div>
        ) : (
          alerts.map((a, i) => (
            <div key={i} className="uw-artifact mb-8" style={{ borderColor: a.color + "33" }}>
              <div className="flex items-center gap-8">
                <Icon name="alert" size={14} color={a.color} />
                <span className="text-sm">{a.msg}</span>
                <span className="mono text-xs text-dim" style={{ marginLeft: "auto" }}>{a.id}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ─── DECLINE MODAL ───────────────────────────────────────────────────────────
const DECLINE_REASONS = [
  "Insufficient Revenue",
  "Too Many Positions",
  "Credit Issues",
  "Insufficient Time in Business",
  "Incomplete Application",
  "Other",
];

const DeclineModal = ({ deal, onClose, onConfirm }) => {
  const hasBroker = !!deal.broker.email;
  const [reason, setReason] = useState(DECLINE_REASONS[0]);
  const [notes, setNotes] = useState("");
  const [overrideEmail, setOverrideEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/deals/${deal.id}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          notes: notes.trim() || undefined,
          brokerEmail: !hasBroker && overrideEmail.trim() ? overrideEmail.trim() : undefined,
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed to decline."); setSubmitting(false); return; }
      onConfirm(deal.id);
      onClose();
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title" style={{ color: "var(--red)" }}>Decline Deal</div>
            <div className="modal-sub mono text-xs">{deal.id} · {deal.merchant.name}</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">
          {hasBroker ? (
            <div style={{ background: "rgba(220,38,38,.06)", border: "1px solid rgba(220,38,38,.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "var(--red)" }}>
              This will set the deal to <strong>Declined</strong> and notify <strong>{deal.broker.email}</strong> by email.
            </div>
          ) : (
            <div style={{ background: "rgba(202,138,4,.06)", border: "1px solid rgba(202,138,4,.25)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "var(--amber)" }}>
              <strong>No broker is attached to this deal.</strong> The decline will be recorded but no email will be sent unless you provide a broker email below.
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Decline Reason</label>
            <select className="form-input" value={reason} onChange={e => setReason(e.target.value)}>
              {DECLINE_REASONS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Additional Notes <span className="text-dim">(optional)</span></label>
            <textarea
              className="form-input"
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any additional context for the broker…"
              style={{ resize: "vertical" }}
            />
          </div>
          {!hasBroker && (
            <div className="form-group">
              <label className="form-label">Broker Email to Notify <span className="text-dim">(optional)</span></label>
              <input
                className="form-input"
                type="email"
                value={overrideEmail}
                onChange={e => setOverrideEmail(e.target.value)}
                placeholder="broker@example.com"
              />
            </div>
          )}
          {error && <div style={{ color: "var(--red)", fontSize: 13, marginTop: 8 }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="btn btn-red" onClick={handleConfirm} disabled={submitting}>
            <Icon name="x" size={14} /> {submitting ? "Declining…" : "Confirm Decline"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── ADD OFFERS MODAL ────────────────────────────────────────────────────────
const AddOffersModal = ({ deal, onClose, onOffersAdded }) => {
  const [offers, setOffers] = useState([{
    amount: "", payback: "", factor: "", term: "", frequency: "Daily",
    position: "1st", fee: "", expiry: "", commissionPct: "",
  }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const setO = (i, k, v) => setOffers(o => o.map((x, j) => j === i ? { ...x, [k]: v } : x));

  const handleSubmit = async () => {
    if (!offers[0].amount) { setError("Enter at least one offer amount."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/deals/${deal.id}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offers }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save offers."); setSubmitting(false); return; }
      onOffersAdded(data);
      onClose();
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Create Offer</div>
            <div className="modal-sub">{deal.merchant.name} · {deal.id}</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">
          {offers.map((o, i) => (
            <div key={i} className="card card-sm mb-12" style={{ background: "var(--bg)" }}>
              <div className="flex justify-between mb-12">
                <span className="fw-600 text-sm">Offer {i + 1}</span>
                {offers.length > 1 && <button className="btn btn-secondary btn-sm" onClick={() => setOffers(os => os.filter((_, j) => j !== i))}>Remove</button>}
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Advance Amount</label>
                  <CurrencyInput value={o.amount} placeholder="50000" onChange={amt => {
                    const updates = { amount: amt };
                    if (amt && o.factor) updates.payback = (parseFloat(amt) * parseFloat(o.factor)).toFixed(0);
                    setOffers(os => os.map((x, j) => j === i ? { ...x, ...updates } : x));
                  }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Factor Rate</label>
                  <input className="form-input" type="number" step=".01" value={o.factor} placeholder="1.35"
                    onChange={e => {
                      const fac = e.target.value;
                      const updates = { factor: fac };
                      if (fac && o.amount) updates.payback = (parseFloat(o.amount) * parseFloat(fac)).toFixed(2);
                      setOffers(os => os.map((x, j) => j === i ? { ...x, ...updates } : x));
                    }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Total Payback {o.amount && o.factor && <span style={{ color: "var(--green)", fontSize: 10, marginLeft: 6 }}>● AUTO</span>}</label>
                  <CurrencyInput value={o.payback} placeholder="auto-calculates"
                    style={{ borderColor: o.amount && o.factor ? "var(--accent)" : undefined }}
                    onChange={pb => {
                      const updates = { payback: pb };
                      if (pb && o.amount) updates.factor = (parseFloat(pb) / parseFloat(o.amount)).toFixed(4);
                      setOffers(os => os.map((x, j) => j === i ? { ...x, ...updates } : x));
                    }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Term ({o.frequency === "Daily" ? "business days" : o.frequency === "Weekly" ? "weeks" : "months"})</label>
                  <input className="form-input" type="number" value={o.term} onChange={e => setO(i, "term", e.target.value)} placeholder="120" />
                </div>
                <div className="form-group">
                  <label className="form-label">ACH Frequency</label>
                  <select className="form-input" value={o.frequency} onChange={e => setO(i, "frequency", e.target.value)}>
                    <option>Daily</option><option>Weekly</option><option>Monthly</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Position</label>
                  <select className="form-input" value={o.position} onChange={e => setO(i, "position", e.target.value)}>
                    <option>1st</option><option>2nd</option><option>3rd</option><option>4th</option><option>5th</option><option>6th</option><option>7th</option><option>8th</option><option>9th</option><option>10th</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Origination Fee %</label>
                  <input className="form-input" type="number" step="0.1" value={o.fee} onChange={e => setO(i, "fee", e.target.value)} placeholder="1" />
                </div>
                <div className="form-group">
                  <label className="form-label">Commission %</label>
                  <input className="form-input" type="number" step="0.1" value={o.commissionPct} onChange={e => setO(i, "commissionPct", e.target.value)} placeholder="10" />
                </div>
                <div className="form-group">
                  <label className="form-label">Offer Expiry</label>
                  <input className="form-input" type="date" value={o.expiry} onChange={e => setO(i, "expiry", e.target.value)} />
                </div>
              </div>
            </div>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={() => setOffers(o => [...o, { amount: "", payback: "", factor: "", term: "", frequency: "Daily", position: "1st", fee: "", expiry: "", commissionPct: "" }])}>
            <Icon name="plus" size={14} /> Add Another Offer
          </button>
          {error && <div style={{ color: "var(--red)", fontSize: 13, marginTop: 12 }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="btn btn-green" onClick={handleSubmit} disabled={submitting || !offers[0].amount}>
            <Icon name="check" size={14} /> {submitting ? "Saving…" : "Save Offer & Advance to Offer Created"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── ASSIGN BROKER MODAL ─────────────────────────────────────────────────────
const AssignBrokerModal = ({ deal, onClose, onAssigned }) => {
  const [brokerShops, setBrokerShops] = useState([]);
  const [shopSearch, setShopSearch] = useState("");
  const [selectedShop, setSelectedShop] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/broker-shops').then(r => r.json()).then(d => setBrokerShops(d.shops ?? [])).catch(() => {});
  }, []);

  const filtered = shopSearch.length > 0
    ? brokerShops.filter(s => s.name.toLowerCase().includes(shopSearch.toLowerCase()))
    : [];

  const handleSelectShop = (shop) => {
    setSelectedShop(shop);
    setShopSearch(shop.name);
    const primary = shop.contacts?.find(c => c.isPrimary) ?? shop.contacts?.[0];
    setSelectedContact(primary ?? null);
  };

  const handleConfirm = async () => {
    if (!selectedShop || !selectedContact) { setError("Select a shop and contact."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/deals/${deal.id}/assign-broker`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId: selectedShop.id, contactId: selectedContact.id }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to assign broker."); setSubmitting(false); return; }
      onAssigned(data);
      onClose();
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Assign Broker Shop</div>
            <div className="modal-sub">{deal.merchant.name} · {deal.id}</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Search Broker Shop</label>
            <input
              className="form-input"
              value={shopSearch}
              onChange={e => { setShopSearch(e.target.value); setSelectedShop(null); setSelectedContact(null); }}
              placeholder="Type to search shops…"
            />
          </div>
          {shopSearch.length > 0 && !selectedShop && filtered.length > 0 && (
            <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
              {filtered.map(s => (
                <button key={s.id} className="nav-item" style={{ width: "100%", textAlign: "left", borderRadius: 0, borderBottom: "1px solid var(--border)" }}
                  onClick={() => handleSelectShop(s)}>
                  <span className="fw-600">{s.name}</span>
                  {s.email && <span className="text-dim text-xs" style={{ marginLeft: 8 }}>{s.email}</span>}
                </button>
              ))}
            </div>
          )}
          {shopSearch.length > 0 && !selectedShop && filtered.length === 0 && (
            <div className="text-dim text-xs" style={{ marginBottom: 12 }}>No shops found.</div>
          )}
          {selectedShop && selectedShop.contacts?.length > 0 && (
            <div className="form-group">
              <label className="form-label">Select Contact</label>
              <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                {selectedShop.contacts.map(c => (
                  <button key={c.id} className={`nav-item ${selectedContact?.id === c.id ? "active" : ""}`}
                    style={{ width: "100%", textAlign: "left", borderRadius: 0, borderBottom: "1px solid var(--border)" }}
                    onClick={() => setSelectedContact(c)}>
                    <span className="fw-600">{c.name}</span>
                    {c.isPrimary && <span style={{ fontSize: 10, background: "var(--accent)", color: "#fff", borderRadius: 4, padding: "1px 6px", marginLeft: 6 }}>Primary</span>}
                    <span className="text-dim text-xs" style={{ marginLeft: 8 }}>{c.email}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {error && <div style={{ color: "var(--red)", fontSize: 13, marginTop: 8 }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={submitting || !selectedContact}>
            <Icon name="check" size={14} /> {submitting ? "Assigning…" : "Assign Broker"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── SUBMISSION MODAL ────────────────────────────────────────────────────────
const SubmissionModal = ({ onClose, onCreate }) => {
  const [phase, setPhase] = useState('upload'); // 'upload' | 'processing' | 'review'
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState(null);
  const [extracted, setExtracted] = useState({
    businessName: '', ownerName: '', email: '', phone: '',
    address: '', requestedAmount: '', industry: '', notes: '',
    ein: '', ownerEin: '', ownerDob: '', ownerSsnLast4: '',
  });
  const fileInputRef = { current: null };

  const handleFiles = (incoming) => {
    const pdfs = Array.from(incoming).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
    if (!pdfs.length) { setError('Please upload PDF files only.'); return; }
    setError(null);
    setFiles(pdfs);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleProcess = async () => {
    if (!files.length) { setError('Select at least one PDF.'); return; }
    setPhase('processing');
    setError(null);
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    try {
      const res = await fetch('/api/submissions/process', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Processing failed.'); setPhase('upload'); return; }
      setExtracted({
        businessName: data.extracted.businessName ?? '',
        ownerName: data.extracted.ownerName ?? '',
        email: data.extracted.email ?? '',
        phone: data.extracted.phone ?? '',
        address: data.extracted.address ?? '',
        requestedAmount: data.extracted.requestedAmount ? String(data.extracted.requestedAmount) : '',
        industry: data.extracted.industry ?? '',
        notes: data.extracted.notes ?? '',
        ein: data.extracted.ein ?? '',
        ownerEin: data.extracted.ownerEin ?? '',
        ownerDob: data.extracted.ownerDob ?? '',
        ownerSsnLast4: data.extracted.ownerSsnLast4 ?? '',
      });
      setPhase('review');
    } catch {
      setError('Network error. Please try again.');
      setPhase('upload');
    }
  };

  const handleCreate = () => {
    onCreate({
      merchant: {
        name: extracted.businessName || 'Unknown Business',
        email: extracted.email || `submission-${Date.now()}@placeholder.internal`,
        phone: extracted.phone || '',
        ownerName: extracted.ownerName || '',
        ein: extracted.ein || null,
        ownerEin: extracted.ownerEin || null,
        ownerDob: extracted.ownerDob || null,
        ownerSsnLast4: extracted.ownerSsnLast4 || null,
      },
      broker: { name: '', email: '' },
      requestedAmount: parseFloat(extracted.requestedAmount) || 0,
      notes: [extracted.industry, extracted.address, extracted.notes].filter(Boolean).join(' | '),
      status: 'Submission Received',
      offers: [],
    });
    onClose();
  };

  const set = (k, v) => setExtracted(x => ({ ...x, [k]: v }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">New Submission</div>
            <div className="modal-sub">
              {phase === 'upload' && 'Upload PDF documents to extract merchant info automatically'}
              {phase === 'processing' && 'Analyzing documents with AI…'}
              {phase === 'review' && 'Review and edit extracted information before creating the deal'}
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="stepper">
            {['Upload', 'Process', 'Review'].map((s, i) => {
              const idx = phase === 'upload' ? 0 : phase === 'processing' ? 1 : 2;
              return (
                <div key={s} className={`step-item ${i < idx ? 'done' : i === idx ? 'active' : ''}`}>
                  <div className="step-dot">{i < idx ? <Icon name="check" size={12} color="#fff" /> : i + 1}</div>
                  <div className="step-label">{s}</div>
                </div>
              );
            })}
          </div>

          {phase === 'upload' && (
            <div className="fade-in">
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('sub-file-input').click()}
                style={{
                  border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border2)'}`,
                  borderRadius: 12, padding: '40px 24px', textAlign: 'center',
                  cursor: 'pointer', background: dragging ? 'rgba(22,163,74,.05)' : 'var(--bg)',
                  transition: 'all .15s', marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
                <div className="fw-600" style={{ marginBottom: 4 }}>Drop PDFs here or click to browse</div>
                <div className="text-dim text-sm">Bank statements, applications, tax documents — up to 5 files</div>
                <input
                  id="sub-file-input"
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  style={{ display: 'none' }}
                  onChange={e => handleFiles(e.target.files)}
                />
              </div>
              {files.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-8" style={{ padding: '8px 12px', background: 'var(--surface2)', borderRadius: 8, marginBottom: 6 }}>
                      <Icon name="sign" size={14} color="var(--accent)" />
                      <span className="text-sm fw-600" style={{ flex: 1 }}>{f.name}</span>
                      <span className="text-xs text-dim">{(f.size / 1024).toFixed(0)} KB</span>
                      <button className="btn btn-secondary btn-sm" style={{ padding: '2px 6px' }}
                        onClick={e => { e.stopPropagation(); setFiles(fs => fs.filter((_, j) => j !== i)); }}>
                        <Icon name="x" size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            </div>
          )}

          {phase === 'processing' && (
            <div className="fade-in" style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{ width: 56, height: 56, border: '4px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 20px' }} />
              <div className="fw-600" style={{ fontSize: 16, marginBottom: 6 }}>Analyzing {files.length} document{files.length > 1 ? 's' : ''}…</div>
              <div className="text-dim text-sm">Claude is extracting merchant information</div>
            </div>
          )}

          {phase === 'review' && (
            <div className="fade-in">
              <div style={{ background: 'rgba(22,163,74,.06)', border: '1px solid rgba(22,163,74,.2)', borderRadius: 8, padding: '8px 14px', marginBottom: 16, fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>
                ✓ Extraction complete — review and edit before creating the deal
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Business Name</label>
                  <input className="form-input" value={extracted.businessName} onChange={e => set('businessName', e.target.value)} placeholder="Acme LLC" />
                </div>
                <div className="form-group">
                  <label className="form-label">Owner Name</label>
                  <input className="form-input" value={extracted.ownerName} onChange={e => set('ownerName', e.target.value)} placeholder="John Smith" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" value={extracted.email} onChange={e => set('email', e.target.value)} placeholder="owner@acme.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" value={extracted.phone} onChange={e => set('phone', e.target.value)} placeholder="555-000-0000" />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Address</label>
                  <input className="form-input" value={extracted.address} onChange={e => set('address', e.target.value)} placeholder="123 Main St, City, ST 00000" />
                </div>
                <div className="form-group">
                  <label className="form-label">Requested Amount</label>
                  <CurrencyInput value={extracted.requestedAmount} onChange={v => set('requestedAmount', v)} placeholder="50000" />
                </div>
                <div className="form-group">
                  <label className="form-label">Industry</label>
                  <input className="form-input" value={extracted.industry} onChange={e => set('industry', e.target.value)} placeholder="Restaurant, Retail…" />
                </div>
                <div className="form-group">
                  <label className="form-label">Business EIN</label>
                  <input className="form-input" value={extracted.ein} onChange={e => set('ein', e.target.value)} placeholder="XX-XXXXXXX" />
                </div>
                <div className="form-group">
                  <label className="form-label">Owner EIN <span className="text-dim">(if different)</span></label>
                  <input className="form-input" value={extracted.ownerEin} onChange={e => set('ownerEin', e.target.value)} placeholder="XX-XXXXXXX" />
                </div>
                <div className="form-group">
                  <label className="form-label">Owner Date of Birth</label>
                  <input className="form-input" value={extracted.ownerDob} onChange={e => set('ownerDob', e.target.value)} placeholder="MM/DD/YYYY" />
                </div>
                <div className="form-group">
                  <label className="form-label">Owner SSN <span className="text-dim">(last 4 only)</span></label>
                  <input className="form-input" value={extracted.ownerSsnLast4} onChange={e => set('ownerSsnLast4', e.target.value)} placeholder="XXXX" maxLength={4} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={3} value={extracted.notes} onChange={e => set('notes', e.target.value)} placeholder="Monthly revenue, years in business, MCA history…" style={{ resize: 'vertical' }} />
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          {phase === 'upload' && (
            <button className="btn btn-primary" onClick={handleProcess} disabled={!files.length}>
              <Icon name="send" size={14} /> Process with AI
            </button>
          )}
          {phase === 'review' && (
            <>
              <button className="btn btn-secondary" onClick={() => setPhase('upload')}>← Re-upload</button>
              <button className="btn btn-green" onClick={handleCreate} disabled={!extracted.businessName}>
                <Icon name="check" size={14} /> Create Deal
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("dashboard");
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [showSubmission, setShowSubmission] = useState(false);
  const [declineDeal, setDeclineDeal] = useState(null);
  const [createOfferDeal, setCreateOfferDeal] = useState(null);
  const [assignBrokerDeal, setAssignBrokerDeal] = useState(null);
  const [brokerDeal, setBrokerDeal] = useState(null);
  const [merchantDeal, setMerchantDeal] = useState(null);
  const [uwDeal, setUwDeal] = useState(null);
  const [toast, setToast] = useState(null);

  const notify = (msg) => setToast(msg);

  useEffect(() => {
    fetch('/api/deals')
      .then(r => r.json())
      .then(data => { setDeals(Array.isArray(data) ? data.map(mapDeal) : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const updateDealStatus = (id, status) => {
    setDeals(ds => ds.map(d => d.id === id ? { ...d, status } : d));
    patchDeal(id, { status });
    notify(`Deal ${id} → ${status}`);
  };

  const deleteDeal = (id) => {
    setDeals(ds => ds.filter(d => d.id !== id));
    fetch(`/api/deals/${id}`, { method: 'DELETE' }).catch(console.error);
    notify(`Deal ${id} deleted.`);
  };

  const handleCreate = (dealData) => {
    fetch('/api/deals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dealData) })
      .then(r => r.json())
      .then(saved => { setDeals(ds => [mapDeal(saved), ...ds]); notify(`Deal created!`); })
      .catch(() => notify('Failed to create deal'));
  };

  const handleSubmissionCreate = (dealData) => {
    fetch('/api/deals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dealData) })
      .then(r => r.json())
      .then(saved => { setDeals(ds => [mapDeal(saved), ...ds]); notify(`Submission received — deal created!`); setView('deals'); })
      .catch(() => notify('Failed to create deal from submission'));
  };

  const handleDeclined = (dealId) => {
    setDeals(ds => ds.map(d => d.id === dealId ? { ...d, status: 'Declined' } : d));
    notify(`Deal ${dealId} declined. Broker notified.`);
  };

  const handleOffersAdded = (saved) => {
    setDeals(ds => ds.map(d => d.id === saved.id ? mapDeal(saved) : d));
    notify(`Offer created — deal advanced to Offer Created.`);
  };

  const handleBrokerAssigned = (saved) => {
    setDeals(ds => ds.map(d => d.id === saved.id ? mapDeal(saved) : d));
    notify(`Broker assigned to deal ${saved.id}.`);
  };

  const handleBrokerSelect = (id, offerId) => {
    setDeals(ds => ds.map(d => d.id === id ? { ...d, selectedOffer: offerId, status: "Offer Selected" } : d));
    patchDeal(id, { status: "Offer Selected" });
    notify(`Offer selected for ${id}. Merchant will be notified.`);
  };

  const handleMerchantStep = (id, step) => {
    let update = {};
    if (step === "bank") update = { bankStatus: "connected", status: "Bank Connected" };
    if (step === "idv") update = { idvStatus: "pass", status: "Identity Verified" };
    if (step === "sign") {
      update = { agreementSigned: true, status: "Agreement Signed" };
      setTimeout(() => {
        setDeals(ds2 => ds2.map(d2 => d2.id === id && d2.status === "Agreement Signed" ? { ...d2, status: "Ready for Final UW" } : d2));
        patchDeal(id, { status: "Ready for Final UW" });
        notify(`${id} is now Ready for Final UW!`);
      }, 800);
    }
    setDeals(ds => ds.map(d => d.id === id ? { ...d, ...update } : d));
    if (update.status) patchDeal(id, { status: update.status });
  };

  const handleUWDecide = (id, decision) => {
    const status = decision === "approved" ? "UW Approved" : "UW Declined";
    setDeals(ds => ds.map(d => d.id === id ? { ...d, uwDecision: decision, status } : d));
    patchDeal(id, { status });
    notify(`Deal ${id} ${decision === "approved" ? "APPROVED ✓" : "DECLINED ✗"}`);
  };

  const uwCount = deals.filter(d => d.status === "Ready for Final UW").length;

  const NAV = [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "deals", label: "All Deals", icon: "deals" },
    { id: "uwqueue", label: "UW Queue", icon: "uw", badge: uwCount > 0 ? uwCount : null },
    { id: "alerts", label: "Alerts", icon: "notifications" },
    { id: "brokers", label: "Broker Shops", icon: "funded", href: "/broker-shops" },
  ];

  const pageTitle = { dashboard: "Dashboard", deals: "All Deals", uwqueue: "UW Queue", alerts: "Alerts" };

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-badge">
              <Icon name="funded" size={15} color="#dcfce7" /> CapFlow
            </div>
            <div className="logo-sub">Advance Management</div>
          </div>
          <nav className="sidebar-nav">
            <div className="nav-section">
              <div className="nav-section-label">Workspace</div>
              {NAV.map(n => (
                n.href
                  ? <a key={n.id} href={n.href} className="nav-item" style={{ textDecoration: "none" }}>
                      <Icon name={n.icon} size={16} />
                      {n.label}
                    </a>
                  : <button key={n.id} className={`nav-item ${view === n.id ? "active" : ""}`} onClick={() => setView(n.id)}>
                      <Icon name={n.icon} size={16} />
                      {n.label}
                      {n.badge && <span className="badge">{n.badge}</span>}
                    </button>
              ))}
            </div>
          </nav>
          <div className="sidebar-footer">
            <div className="user-row">
              <div className="avatar">JD</div>
              <div>
                <div style={{ fontWeight: 600, color: "var(--text2)", fontSize: 12 }}>Jane Doe</div>
                <div style={{ fontSize: 10, color: "var(--text3)" }}>Internal Ops</div>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="main">
          <div className="topbar">
            <div className="topbar-title">{pageTitle[view]}</div>
            <div className="topbar-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setShowSubmission(true)}>
                <Icon name="plus" size={14} /> New Submission
              </button>
              {view === "deals" && (
                <button className="btn btn-primary btn-sm" onClick={() => setShowNewDeal(true)}>
                  <Icon name="plus" size={14} /> New Deal
                </button>
              )}
            </div>
          </div>
          <div className="content scrollbar">
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <div style={{ width: 40, height: 40, border: '4px solid #334155', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : (
              <>
                {view === "dashboard" && <Dashboard deals={deals} onSelectDeal={d => { setSelectedDeal(d); }} />}
                {view === "deals" && <DealsList deals={deals} onSelectDeal={d => setSelectedDeal(d)} onNewDeal={() => setShowNewDeal(true)} onDeleteDeal={deleteDeal} />}
                {view === "uwqueue" && <UWQueue deals={deals} onOpen={d => setUwDeal(d)} />}
                {view === "alerts" && <NotificationsPanel deals={deals} />}
              </>
            )}
          </div>
        </main>
      </div>

      {/* MODALS */}
      {selectedDeal && (
        <DealDetailModal
          deal={deals.find(d => d.id === selectedDeal.id) || selectedDeal}
          onClose={() => setSelectedDeal(null)}
          onUpdate={updateDealStatus}
          onDelete={deleteDeal}
          onOpenBroker={d => { setSelectedDeal(null); setBrokerDeal(d); }}
          onOpenMerchant={d => { setSelectedDeal(null); setMerchantDeal(d); }}
          onOpenUW={d => { setSelectedDeal(null); setUwDeal(d); }}
          onDecline={d => { setSelectedDeal(null); setDeclineDeal(d); }}
          onCreateOffer={d => { setSelectedDeal(null); setCreateOfferDeal(d); }}
          onAssignBroker={d => { setSelectedDeal(null); setAssignBrokerDeal(d); }}
        />
      )}
      {showNewDeal && (
        <NewDealModal
          onClose={() => setShowNewDeal(false)}
          onCreate={handleCreate}
        />
      )}
      {showSubmission && (
        <SubmissionModal
          onClose={() => setShowSubmission(false)}
          onCreate={handleSubmissionCreate}
        />
      )}
      {declineDeal && (
        <DeclineModal
          deal={declineDeal}
          onClose={() => setDeclineDeal(null)}
          onConfirm={handleDeclined}
        />
      )}
      {createOfferDeal && (
        <AddOffersModal
          deal={deals.find(d => d.id === createOfferDeal.id) || createOfferDeal}
          onClose={() => setCreateOfferDeal(null)}
          onOffersAdded={handleOffersAdded}
        />
      )}
      {assignBrokerDeal && (
        <AssignBrokerModal
          deal={deals.find(d => d.id === assignBrokerDeal.id) || assignBrokerDeal}
          onClose={() => setAssignBrokerDeal(null)}
          onAssigned={handleBrokerAssigned}
        />
      )}
      {brokerDeal && (
        <BrokerView
          deal={deals.find(d => d.id === brokerDeal.id) || brokerDeal}
          onClose={() => setBrokerDeal(null)}
          onSelect={handleBrokerSelect}
        />
      )}
      {merchantDeal && (
        <MerchantView
          deal={deals.find(d => d.id === merchantDeal.id) || merchantDeal}
          onClose={() => setMerchantDeal(null)}
          onComplete={handleMerchantStep}
        />
      )}
      {uwDeal && (
        <UWModal
          deal={deals.find(d => d.id === uwDeal.id) || uwDeal}
          onClose={() => setUwDeal(null)}
          onDecide={handleUWDecide}
        />
      )}
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
    </>
  );
}

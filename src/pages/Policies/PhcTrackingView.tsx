import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { policiesService } from '../../services';
import {
  Activity, Calendar, CheckCircle2, Clock, Search, Download, FileText,
  ChevronLeft, ChevronRight, Eye, X, User, Shield,
  Heart, TrendingUp, Wallet, BarChart2,
  ChevronDown, Users, Layers, ArrowRight,
  RotateCcw, SlidersHorizontal, History, ChevronUp, Plus, Filter
} from 'lucide-react';
import clsx from 'clsx';
import { sortData } from '../../utils/sortUtils';
import Modal from '@comps/common/Modal';
import { usePolicies } from '../../hooks/usePolicies';
import { parseExtraNotes } from './index';

// ── Types ───────────────────────────────────────────────────────────────────────
type PhcStatus = 'Interested' | 'Partial Utilized' | 'Fully Utilized' | 'Not Interested' | 'Upcoming' | 'Completed' | 'Due This Month' | 'Overdue' | 'Not Applicable Yet';

interface InsuredPerson {
  name: string;
  relationship: string;
  utilizedAmount: number;
  phcCount: number;
}

interface PhcYearRecord {
  yearNo: number;
  label: string;
  isCurrent: boolean;
  startDate: string;
  endDate: string;
  status: PhcStatus;
  eligibleAmount: number;
  utilizedAmount: number;
  balanceAmount: number;
  phcCount: number;
  daysRemaining?: number;
  insuredPersons: InsuredPerson[];
  allCheckups?: any[];
}

interface PhcPolicyRecord {
  id: string;
  policyNo: string;
  customerName: string;
  customerPhone: string;
  planName: string;
  companyInitials: string;
  companyName: string;
  companyType: string;
  companyColor: string;
  policyStartDate: string;
  policyEndDate: string;
  sumInsured: number;
  phcFrequency: string;
  currentPhcYear: string;
  phcYearStartDate: string;
  phcYearEndDate: string;
  phcStatus: PhcStatus;
  phcCount: number;
  eligibleAmount: number;
  utilizedAmount: number;
  balanceAmount: number;
  daysRemaining: number;
  totalYears: number;
  years: PhcYearRecord[];
  allCheckups?: any[];
  insuredPersons?: any[];
}



// ── Helpers ──────────────────────────────────────────────────────────────────────
const fmtCurr = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;

const STATUS_CFG: Record<PhcStatus, { bg: string; text: string; border: string; dot: string }> = {
  'Interested':       { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500' },
  'Partial Utilized': { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-500' },
  'Fully Utilized':   { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  'Not Interested':   { bg: 'bg-slate-100',  text: 'text-slate-600',   border: 'border-slate-200',   dot: 'bg-slate-400' },
  'Upcoming':         { bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200',     dot: 'bg-sky-500' },
  'Completed':        { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200',  dot: 'bg-violet-500' },
  'Due This Month':   { bg: 'bg-orange-50',   text: 'text-orange-700',  border: 'border-orange-200',  dot: 'bg-orange-500' },
  'Overdue':          { bg: 'bg-rose-50',     text: 'text-rose-700',    border: 'border-rose-200',    dot: 'bg-rose-500' },
  'Not Applicable Yet': { bg: 'bg-slate-100', text: 'text-slate-500',   border: 'border-slate-200',   dot: 'bg-slate-400' },
};

function StatusBadge({ status }: { status: PhcStatus }) {
  let normalizedStatus: PhcStatus = status;
  if (normalizedStatus === 'Not Applicable Yet' || (normalizedStatus as any) === 'Not Applicable') {
    normalizedStatus = 'Upcoming';
  }
  const c = STATUS_CFG[normalizedStatus] || STATUS_CFG['Upcoming'];
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide border', c.bg, c.text, c.border)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', c.dot)} />
      {normalizedStatus}
    </span>
  );
}

// ── PHC Year Card ────────────────────────────────────────────────────────────────
type PhcEntryState = { id: number; status: string };

function PhcYearCard({ yr }: { yr: PhcYearRecord }) {
  const [selPerson, setSelPerson] = useState('All Family Members');
  const [entries, setEntries] = useState<PhcEntryState[]>([{ id: Date.now(), status: 'Unutilised' }]);
  const pct = yr.eligibleAmount > 0 ? Math.round((yr.utilizedAmount / yr.eligibleAmount) * 100) : 0;
  const persons = selPerson === 'All Family Members' ? yr.insuredPersons : yr.insuredPersons.filter(p => p.name === selPerson);

  const YEAR_STATUS_COLOR: Record<string, string> = {
    'Completed': 'bg-violet-100 text-violet-700 border-violet-300',
    'Interested': 'bg-amber-100 text-amber-700 border-amber-300',
    'Partial Utilized': 'bg-blue-100 text-blue-700 border-blue-300',
    'Fully Utilized': 'bg-emerald-100 text-emerald-700 border-emerald-300',
    'Not Interested': 'bg-slate-100 text-slate-600 border-slate-300',
    'Upcoming': 'bg-sky-100 text-sky-700 border-sky-300',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden ">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80 border-b border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-extrabold text-sm text-slate-900">{yr.label}</span>
          {yr.isCurrent && <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[9px] font-black rounded-md uppercase tracking-wide">Current</span>}
        </div>
        <span className={clsx('px-2.5 py-0.5 rounded-full text-[10px] font-black border', YEAR_STATUS_COLOR[yr.status] ?? 'bg-slate-100 text-slate-600 border-slate-200')}>
          {yr.status}
        </span>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-[11px] text-slate-500 font-semibold">{yr.startDate} – {yr.endDate}</p>

        {/* Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-bold text-slate-500">
            <span>Utilization</span><span className="text-slate-700">{pct}%</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className={clsx('h-full rounded-full transition-all duration-500', pct >= 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-blue-500' : 'bg-amber-500')} style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
        </div>

        {/* Amounts Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-center">
          <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Eligible</p>
            <p className="text-[11px] font-extrabold text-slate-800 mt-0.5">{fmtCurr(yr.eligibleAmount)}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
            <p className="text-[9px] font-bold text-blue-500 uppercase tracking-wide">Utilized</p>
            <p className="text-[11px] font-extrabold text-blue-800 mt-0.5">{fmtCurr(yr.utilizedAmount)}</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-2 border border-emerald-100">
            <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-wide">Balance</p>
            <p className="text-[11px] font-extrabold text-emerald-800 mt-0.5">{fmtCurr(yr.balanceAmount)}</p>
          </div>
          <div className="bg-violet-50 rounded-lg p-2 border border-violet-100">
            <p className="text-[9px] font-bold text-violet-500 uppercase tracking-wide">Count</p>
            <p className="text-[11px] font-extrabold text-violet-800 mt-0.5">{yr.phcCount}</p>
          </div>
        </div>

        {/* Insured Person Dropdown */}
        {yr.insuredPersons.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Users size={12} className="text-slate-400 shrink-0" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Insured Person</span>
            </div>
            <div className="relative">
              <select value={selPerson} onChange={e => setSelPerson(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer appearance-none pr-8">
                <option value="All Family Members">All Family Members</option>
                {yr.insuredPersons.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Breakdown Table */}
            <div className="border border-slate-100 rounded-lg overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-3 bg-slate-50/80 border-b border-slate-100 px-3 py-1.5 text-[9px] font-extrabold text-slate-500 uppercase tracking-wide">
                <span>Family Member</span><span className="text-center">Utilized</span><span className="text-center">PHC Count</span>
              </div>
              {persons.map(p => (
                <div key={p.name} className="grid grid-cols-1 sm:grid-cols-3 px-3 py-2 text-xs border-b border-slate-50 last:border-0 ">
                  <span className="font-semibold text-slate-700 text-[11px] truncate pr-1">{p.name}</span>
                  <span className="text-center font-bold text-blue-700 text-[11px]">{fmtCurr(p.utilizedAmount)}</span>
                  <span className="text-center font-bold text-violet-700 text-[11px]">{p.phcCount}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transactions Section */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-wide">PHC Transaction History</h4>
          </div>

          {['PENDING', 'BOOKED', 'COMPLETED', 'CANCELLED'].map(groupStatus => {
            const groupEntries = (yr.allCheckups || []).filter((e: any) => {
              const s = String(e.status || '').toUpperCase();
              if (groupStatus === 'BOOKED') return s.includes('BOOK') || s.includes('APPOINTMENT');
              if (groupStatus === 'COMPLETED') return s.includes('COMPLET') || s.includes('SETTLED');
              if (groupStatus === 'CANCELLED') return s.includes('CANCEL') || s.includes('REJECT');
              if (groupStatus === 'PENDING') return s.includes('PEND') || s.includes('SCHEDULE') || s.includes('PROCESS') || (!s.includes('BOOK') && !s.includes('APPOINTMENT') && !s.includes('COMPLET') && !s.includes('SETTLED') && !s.includes('CANCEL') && !s.includes('REJECT'));
              return false;
            });
            if (groupEntries.length === 0) return null;
            return (
              <div key={groupStatus} className="bg-white border border-slate-200/60 rounded-xl p-3 shadow-xs">
                <div className="flex flex-wrap items-center gap-2 mb-3 border-b border-slate-100 pb-2">
                  <span className={clsx('w-2 h-2 rounded-full', 
                    groupStatus === 'COMPLETED' ? 'bg-emerald-500' :
                    groupStatus === 'CANCELLED' ? 'bg-slate-400' :
                    groupStatus === 'PENDING' ? 'bg-amber-500' : 'bg-blue-500'
                  )} />
                  <h5 className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">{groupStatus}</h5>
                  <span className="bg-slate-100 text-slate-500 text-[9px] font-bold px-1.5 py-0.5 rounded-md">{groupEntries.length}</span>
                </div>
                
                <div className="space-y-3">
                  {groupEntries.map((entry: any, index: number) => {
                    const globalIdx = index + 1;
                    return (
                      <div key={entry.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-3 relative group shadow-sm">
                        <div className="flex items-center justify-between mb-1 pr-6">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                              Entry #{globalIdx}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Insured Person</label>
                            <p className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700">
                              {entry.member ? entry.member.name : 'Self'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">PHC Stage</label>
                            <p className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700">
                              {entry.status}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Booking Date</label>
                            <p className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700">
                              {entry.bookingDate ? new Date(entry.bookingDate).toLocaleDateString('en-GB') : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Appointment Date</label>
                            <p className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700">
                              {entry.scheduledAt ? new Date(entry.scheduledAt).toLocaleDateString('en-GB') : 'N/A'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Centre/Lab Name</label>
                            <p className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700">
                              {entry.centreName || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Centre/Lab City</label>
                            <p className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700">
                              {entry.centreCity || 'N/A'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Utilized Amount</label>
                            <p className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700">
                              {entry.utilizedAmount ? ('₹' + entry.utilizedAmount.toLocaleString('en-IN')) : '₹0'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Report Received</label>
                            <p className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700">
                              {entry.completedAt ? new Date(entry.completedAt).toLocaleDateString('en-GB') : 'N/A'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Reimbursement or Cashless</label>
                            <p className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700">
                              {entry.reimbursementType || 'N/A'}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button type="button" className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-[10px] sm:text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg cursor-pointer transition-colors">
            <Eye size={12} /> View Details <ArrowRight size={11} className="ml-auto" />
          </button>
          <button type="button" className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-[10px] sm:text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer transition-colors">
            <History size={12} /> View History
          </button>
        </div>
      </div>
    </div>
  );
}



// ── PHC Record Enrichment Helper ────────────────────────────────────────────────
function enrichPhcRecord(r: PhcPolicyRecord, polNotes?: string): PhcPolicyRecord {
  const notesText = polNotes || (r as any).notes || '';
  const extra = notesText ? parseExtraNotes(notesText) : null;

  // 1. Resolve base eligible amount from notes, plan, or record
  const baseEligible = (extra?.phcAmount && extra.phcAmount > 0 ? extra.phcAmount : null)
    ?? (r.eligibleAmount > 0 ? r.eligibleAmount : null)
    ?? (r.years?.find(y => y.eligibleAmount > 0)?.eligibleAmount)
    ?? (r.utilizedAmount && r.utilizedAmount > 0 ? r.utilizedAmount : 10000);

  const totalYears = Math.max(1, r.totalYears || r.years?.length || 1);

  // Extract utilized from notes balance if not explicitly given
  let notesUtilized = extra?.phcUtilizedAmount || 0;
  if (notesUtilized === 0 && extra?.phcBalanceAmount !== undefined && extra.phcBalanceAmount !== null) {
    if (baseEligible > extra.phcBalanceAmount) {
      notesUtilized = baseEligible - extra.phcBalanceAmount;
    }
  }
  if (notesUtilized === 0 && (extra?.phcClaimSettled || extra?.phcStatus?.toUpperCase().includes('FULL'))) {
    notesUtilized = baseEligible;
  }

  const checkupsUtilized = r.allCheckups?.reduce((s, c) => s + (c.utilizedAmount || 0), 0)
    || r.years?.reduce((s, y) => s + (y.utilizedAmount || 0), 0)
    || 0;

  const utilizedAmount = Math.max(
    r.utilizedAmount || 0,
    notesUtilized,
    checkupsUtilized
  );
  const eligibleAmount = baseEligible;
  const balanceAmount = (extra?.phcBalanceAmount !== undefined && extra.phcBalanceAmount !== null && extra.phcBalanceAmount >= 0)
    ? extra.phcBalanceAmount
    : ((r.balanceAmount !== undefined && r.balanceAmount !== null && r.balanceAmount >= 0)
        ? r.balanceAmount
        : Math.max(0, eligibleAmount - utilizedAmount));

  // Parse explicit PHC status from extra notes or policy notes
  const resolveStatusFromStr = (statusStr?: string | null): PhcStatus | null => {
    if (!statusStr) return null;
    const s = statusStr.trim().toUpperCase();
    if (s === 'INTERESTED' || s === 'HOT' || s === 'VERY_HOT') return 'Interested';
    if (s === 'NOT_INTERESTED' || s === 'NOT INTERESTED' || s === 'LEAD_LOST') return 'Not Interested';
    if (s.includes('PARTIAL')) return 'Partial Utilized';
    if (s.includes('FULL')) return 'Fully Utilized';
    if (s.includes('COMPLET')) return 'Completed';
    if (s === 'REMIND_LATER' || s === 'REMIND LATER' || s === 'PENDING' || s === 'UPCOMING') return 'Upcoming';
    if (s === 'DUE THIS MONTH' || s === 'DUE_THIS_MONTH') return 'Due This Month';
    if (s === 'OVERDUE') return 'Overdue';
    return null;
  };

  const explicitStatus = resolveStatusFromStr(extra?.phcStatus) || (r.phcStatus ? resolveStatusFromStr(r.phcStatus) : null);

  // 2. Status resolution (never leave as "Not Applicable Yet" or "Not Applicable")
  let phcStatus: PhcStatus;
  if (explicitStatus) {
    phcStatus = explicitStatus;
  } else if (r.phcStatus && r.phcStatus !== 'Not Applicable Yet' && (r.phcStatus as any) !== 'Not Applicable') {
    phcStatus = r.phcStatus;
  } else if (utilizedAmount >= eligibleAmount && eligibleAmount > 0) {
    phcStatus = 'Fully Utilized';
  } else if (utilizedAmount > 0) {
    phcStatus = 'Partial Utilized';
  } else {
    phcStatus = 'Upcoming';
  }

  // 3. Insured persons from notes, record, or customer name
  const insuredPersonName = extra?.phcInsuredPerson || extra?.insuredPerson || r.customerName || 'Self';
  const defaultInsuredPersons: InsuredPerson[] = [
    {
      name: insuredPersonName.includes('(') ? insuredPersonName : `${insuredPersonName} (Self)`,
      relationship: 'Self',
      utilizedAmount: utilizedAmount,
      phcCount: r.phcCount || (utilizedAmount > 0 ? 1 : 0),
    }
  ];

  // 4. Enrich each year
  const rawYears = r.years && r.years.length > 0 ? r.years : [
    {
      yearNo: 1,
      label: 'Year 1',
      isCurrent: true,
      startDate: r.phcYearStartDate || r.policyStartDate,
      endDate: r.phcYearEndDate || r.policyEndDate,
      status: phcStatus,
      eligibleAmount,
      utilizedAmount,
      balanceAmount,
      phcCount: r.phcCount || (utilizedAmount > 0 ? 1 : 0),
      insuredPersons: defaultInsuredPersons,
    } as PhcYearRecord
  ];

  const years: PhcYearRecord[] = rawYears.map((yr, idx) => {
    const yrEligible = yr.eligibleAmount > 0 ? yr.eligibleAmount : eligibleAmount;
    const yrUtilized = yr.utilizedAmount !== undefined && yr.utilizedAmount !== null
      ? (yr.utilizedAmount === 0 && (idx === 0 || yr.isCurrent) && utilizedAmount > 0 ? utilizedAmount : yr.utilizedAmount)
      : (idx === 0 || yr.isCurrent ? utilizedAmount : 0);
    const yrBalance = (idx === 0 && balanceAmount !== undefined && balanceAmount >= 0) ? balanceAmount : Math.max(0, yrEligible - yrUtilized);

    let yrStatus = yr.status;
    if (explicitStatus && (idx === 0 || yr.isCurrent)) {
      yrStatus = explicitStatus;
    } else if (!yrStatus || yrStatus === 'Not Applicable Yet' || (yrStatus as any) === 'Not Applicable') {
      if (yrUtilized >= yrEligible && yrEligible > 0) {
        yrStatus = 'Fully Utilized';
      } else if (yrUtilized > 0) {
        yrStatus = 'Partial Utilized';
      } else {
        yrStatus = phcStatus || 'Upcoming';
      }
    }

    const yrPersons = yr.insuredPersons && yr.insuredPersons.length > 0
      ? yr.insuredPersons
      : (idx === 0 || yr.isCurrent ? defaultInsuredPersons : []);

    const yrCheckups = (yr.allCheckups && yr.allCheckups.length > 0)
      ? yr.allCheckups
      : ((idx === 0 || yr.isCurrent) && (yrUtilized > 0 || extra?.phcBookingDate || extra?.phcAppointmentDate || extra?.phcCentreName)
        ? [{
            id: `checkup-${r.id}`,
            status: extra?.phcStatus?.includes('COMPLET') ? 'Test Completed' : (extra?.phcAppointmentDate ? 'Appointment Scheduled' : (extra?.phcBookingDate ? 'Test Booked' : 'Completed')),
            bookingDate: extra?.phcBookingDate || null,
            scheduledAt: extra?.phcAppointmentDate || null,
            completedAt: extra?.phcReportReceivedDate || null,
            centreName: extra?.phcCentreName || 'N/A',
            centreCity: extra?.phcCentreCity || 'N/A',
            utilizedAmount: yrUtilized,
            reimbursementType: extra?.phcReimbursementCashless || 'Cashless',
            member: {
              name: extra?.phcInsuredPerson || r.customerName || 'Self',
              relationship: 'Self'
            }
          }]
        : []);

    return {
      ...yr,
      status: yrStatus,
      eligibleAmount: yrEligible,
      utilizedAmount: yrUtilized,
      balanceAmount: yrBalance,
      phcCount: yr.phcCount || (yrUtilized > 0 ? 1 : 0),
      insuredPersons: yrPersons,
      allCheckups: yrCheckups,
    };
  });

  return {
    ...r,
    eligibleAmount,
    utilizedAmount,
    balanceAmount,
    totalYears,
    phcStatus,
    phcFrequency: extra?.phcFrequency || r.phcFrequency || 'Annual',
    years,
    insuredPersons: years.find(y => y.isCurrent)?.insuredPersons || years[0]?.insuredPersons || defaultInsuredPersons,
    allCheckups: years.flatMap(y => y.allCheckups || []),
  };
}

// ── PHC Details Modal UI (matching Installment Details form UI) ──────────────────
interface PhcModalProps {
  record: PhcPolicyRecord;
  onClose: () => void;
  policyNotesMap?: Map<string, string>;
}

function PhcDrawer({ record: rawRecord, onClose, policyNotesMap }: PhcModalProps) {
  const record = useMemo(() => {
    const polNotes = (rawRecord as any).notes || policyNotesMap?.get(rawRecord.policyNo?.trim()) || policyNotesMap?.get(rawRecord.id) || '';
    return enrichPhcRecord(rawRecord, polNotes);
  }, [rawRecord, policyNotesMap]);

  const currentYr = record.years.find(y => y.isCurrent)?.yearNo ?? (record.years[0]?.yearNo || 1);
  const [selectedYearTab, setSelectedYearTab] = useState<number>(currentYr);

  useEffect(() => {
    if (!record.years.some(y => y.yearNo === selectedYearTab)) {
      setSelectedYearTab(currentYr);
    }
  }, [record, currentYr, selectedYearTab]);

  const totalPhcAmount = useMemo(() => {
    const sumYears = record.years.reduce((s, yr) => s + (yr.eligibleAmount || 0), 0);
    return sumYears > 0 ? sumYears : (record.eligibleAmount * (record.totalYears || 1));
  }, [record]);

  return (
    <Modal
      open={Boolean(record)}
      onClose={onClose}
      title="Policy PHC Details"
      subtitle={`View year-wise preventive health checkups, eligible amounts, and family member breakdown for ${record.customerName}`}
      size="2xl"
      actions={
        <button type="button" onClick={onClose} className="bg-blue-600 text-white px-4 py-1.5 rounded-xl text-[10px] sm:text-xs font-bold shadow-xs hover:bg-blue-700 transition-colors cursor-pointer">
          Save
        </button>
      }
    >
      <div className="space-y-3">
        {/* Policy Summary Banner */}
        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2.5 shadow-2xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className={clsx('w-8 h-8 rounded-lg text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs', record.companyColor)}>
              {record.companyInitials.slice(0, 4)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-xs text-slate-900 truncate">{record.policyNo}</h3>
              </div>
              <p className="text-[11px] font-semibold text-slate-500">{record.planName}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0"><User size={12} /></div>
            <div>
              <p className="text-xs font-bold text-slate-800">{record.customerName}</p>
              <p className="text-[11px] text-slate-400 font-semibold">{record.customerPhone}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-slate-200/60 pt-2.5 text-[11px]">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Policy Start Date</span>
              <span className="font-bold text-slate-800 block mt-0.5">{record.policyStartDate}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">PHC Frequency</span>
              <span className="font-bold text-slate-800 block mt-0.5">{record.phcFrequency}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total PHC Amount</span>
              <span className="font-bold text-emerald-700 block mt-0.5">{fmtCurr(totalPhcAmount)}</span>
            </div>
          </div>
        </div>

        {/* Modal sub-navigation tabs (matching Emi tracking tab sub-navigation design) */}
        <div className="grid grid-flow-col auto-cols-max bg-slate-200/60 p-1.5 rounded-xl gap-2 border border-slate-200/80 shadow-2xs overflow-x-auto">
          {record.years.map(yr => (
            <button
              key={yr.yearNo}
              type="button"
              onClick={() => setSelectedYearTab(yr.yearNo)}
              className={clsx(
                'py-1.5 px-4 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer whitespace-nowrap text-center select-none',
                selectedYearTab === yr.yearNo
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              )}
            >
              {yr.label} {yr.isCurrent && '(Current)'}
            </button>
          ))}
        </div>

        {/* Selected Year Card Scroll Area */}
        <div className="h-[360px] overflow-y-auto pr-1.5 custom-scrollbar">
          {record.years
            .filter(yr => yr.yearNo === selectedYearTab)
            .map(yr => <PhcYearCard key={yr.yearNo} yr={yr} />)}
        </div>
      </div>
    </Modal>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────────
export default function PhcTrackingView() {
  const [activeTab, setActiveTab] = useState<'all' | 'dependencies' | 'due-this-month' | 'upcoming' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [policyTypeFilter, setPolicyTypeFilter] = useState('All');
  const [phcStatusFilter, setPhcStatusFilter] = useState('All');
  const [phcYearFilter, setPhcYearFilter] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [dateFilterType, setDateFilterType] = useState('PHC Year End Date');
  const [companyFilter, setCompanyFilter] = useState('All');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [quickFilter, setQuickFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  const [drawerRecord, setDrawerRecord] = useState<PhcPolicyRecord | null>(null);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-dropdown]')) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const activePhcFilterCount = (policyTypeFilter !== 'All' ? 1 : 0) + (phcStatusFilter !== 'All' ? 1 : 0) + (phcYearFilter !== 'All' ? 1 : 0) + (companyFilter !== 'All' ? 1 : 0) + (fromDate || toDate ? 1 : 0);

  const [sortKey, setSortKey] = useState<string>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const {
    data: phcResponse,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['policies', 'phc-tracking'],
    queryFn: policiesService.getPhcTracking,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const phcData: PhcPolicyRecord[] = phcResponse?.data ?? [];

  useEffect(() => {
    const handleUpdated = () => {
      refetch();
    };
    window.addEventListener('insumitra_phc_updated', handleUpdated);
    return () => window.removeEventListener('insumitra_phc_updated', handleUpdated);
  }, [refetch]);

  const { data: allPoliciesRes } = usePolicies({ limit: 2000 });

  const policyNotesMap = useMemo(() => {
    const map = new Map<string, string>();
    const getArrayData = (obj: any): any[] => {
      if (!obj) return [];
      if (Array.isArray(obj)) return obj;
      if (obj.data && Array.isArray(obj.data)) return obj.data;
      if (obj.items && Array.isArray(obj.items)) return obj.items;
      return [];
    };
    const list = getArrayData(allPoliciesRes);
    list.forEach((p: any) => {
      if (p.policyNumber) map.set(p.policyNumber.trim(), p.notes || '');
      if (p.id) map.set(p.id, p.notes || '');
    });
    return map;
  }, [allPoliciesRes]);

  const policyMetaMap = useMemo(() => {
    const map = new Map<string, { notes?: string; updatedAt?: string; createdAt?: string }>();
    const getArrayData = (obj: any): any[] => {
      if (!obj) return [];
      if (Array.isArray(obj)) return obj;
      if (obj.data && Array.isArray(obj.data)) return obj.data;
      if (obj.items && Array.isArray(obj.items)) return obj.items;
      return [];
    };
    const list = getArrayData(allPoliciesRes);
    list.forEach((p: any) => {
      const meta = { notes: p.notes || '', updatedAt: p.updatedAt, createdAt: p.createdAt };
      if (p.policyNumber) map.set(p.policyNumber.trim(), meta);
      if (p.id) map.set(p.id, meta);
    });
    return map;
  }, [allPoliciesRes]);

  const enrichedPhcData = useMemo(() => {
    return phcData.map(p => {
      const meta = policyMetaMap.get(p.policyNo?.trim()) || policyMetaMap.get(p.id);
      const polNotes = (p as any).notes || meta?.notes || policyNotesMap.get(p.policyNo?.trim()) || policyNotesMap.get(p.id) || '';
      const enriched = enrichPhcRecord(p, polNotes);
      const upA = meta?.updatedAt ? new Date(meta.updatedAt).getTime() : 0;
      const upB = (p as any).updatedAt ? new Date((p as any).updatedAt).getTime() : 0;
      const effectiveUpdatedAt = (upA >= upB && upA > 0) ? meta?.updatedAt : (p as any).updatedAt;

      const crA = meta?.createdAt ? new Date(meta.createdAt).getTime() : 0;
      const crB = (p as any).createdAt ? new Date((p as any).createdAt).getTime() : 0;
      const effectiveCreatedAt = (crA >= crB && crA > 0) ? meta?.createdAt : (p as any).createdAt;

      return {
        ...enriched,
        updatedAt: effectiveUpdatedAt,
        createdAt: effectiveCreatedAt,
      };
    });
  }, [phcData, policyMetaMap, policyNotesMap]);

  const filteredData = useMemo(() => {
    let list = enrichedPhcData.filter(p => {
      const polNotes = (p as any).notes || policyNotesMap.get(p.policyNo?.trim()) || policyNotesMap.get(p.id) || '';
      if (polNotes) {
        const extra = parseExtraNotes(polNotes);
        if (extra.phcRequired === false) return false;
        const phcMatch = polNotes.match(/Preventive Health Checkup:\s*([^\n]+)/i);
        if (phcMatch) {
          const val = phcMatch[1].trim().toLowerCase();
          if (val.startsWith('no') || val.startsWith('false')) return false;
        }
        if (/PHC Required:\s*No/i.test(polNotes)) return false;
      }
      return true;
    });

    const parseDateStr = (d: string) => {
      const m: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
      const parts = d.split(' ');
      if (parts.length === 3) return new Date(parseInt(parts[2]), m[parts[1]], parseInt(parts[0]));
      return new Date(d);
    };

    const parseInputDate = (d: string) => {
      if (!d) return null;
      const p = d.split('/');
      if (p.length === 3) return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
      return null;
    };

    const fDate = parseInputDate(fromDate);
    const tDate = parseInputDate(toDate);

    if (fDate || tDate) {
      list = list.filter(p => {
        let dateStr = p.phcYearEndDate;
        if (dateFilterType === 'PHC Start Date') dateStr = p.phcYearStartDate;
        else if (dateFilterType === 'Policy End Date') dateStr = p.policyEndDate;
        
        const filterDate = parseDateStr(dateStr);
        return (!fDate || filterDate >= fDate) && (!tDate || filterDate <= tDate);
      });
    }

    if (activeTab === 'due-this-month') list = list.filter(p => p.phcStatus === 'Due This Month' || (p.daysRemaining <= 30 && p.daysRemaining > 0));
    else if (activeTab === 'upcoming') list = list.filter(p => p.phcStatus === 'Upcoming' || p.daysRemaining > 30);
    else if (activeTab === 'completed') list = list.filter(p => p.phcStatus === 'Completed' || p.phcStatus === 'Fully Utilized');
    
    if (policyTypeFilter !== 'All') {
      list = list.filter(p => p.companyType.toUpperCase() === policyTypeFilter.toUpperCase());
    }
    if (phcYearFilter !== 'All') {
      list = list.filter(p => p.currentPhcYear.startsWith(phcYearFilter));
    }
    if (phcStatusFilter !== 'All') list = list.filter(p => p.phcStatus === phcStatusFilter);
    if (companyFilter !== 'All') list = list.filter(p => p.companyName === companyFilter || p.companyInitials === companyFilter);
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => p.policyNo.toLowerCase().includes(q) || p.customerName.toLowerCase().includes(q) || p.planName.toLowerCase().includes(q) || p.customerPhone.includes(q));
    }
    return list;
  }, [
    activeTab, companyFilter, dateFilterType, fromDate, enrichedPhcData, phcStatusFilter,
    phcYearFilter, policyTypeFilter, searchQuery, toDate, policyNotesMap,
  ]);

  const sortedFilteredData = useMemo(() => {
    if (!sortKey || sortKey === 'createdAt') {
      return [...filteredData].sort((a: any, b: any) => {
        const latestA = Math.max(
          a.updatedAt ? new Date(a.updatedAt).getTime() : 0,
          a.createdAt ? new Date(a.createdAt).getTime() : 0
        );
        const latestB = Math.max(
          b.updatedAt ? new Date(b.updatedAt).getTime() : 0,
          b.createdAt ? new Date(b.createdAt).getTime() : 0
        );
        if (latestA !== latestB) {
          return sortDir === 'asc' ? latestA - latestB : latestB - latestA;
        }
        return String(b.id || '').localeCompare(String(a.id || ''));
      });
    }
    return sortData(filteredData, sortKey, sortDir, (row: any, key: string) => {
      if (key === 'createdAt') {
        return Math.max(
          row.updatedAt ? new Date(row.updatedAt).getTime() : 0,
          row.createdAt ? new Date(row.createdAt).getTime() : 0
        );
      }
      return row[key];
    });
  }, [filteredData, sortKey, sortDir]);

  const exportPhcToExcel = () => {
    const isDeps = activeTab === 'dependencies';
    let headers: string[];
    let rows: string;
    
    if (isDeps) {
      headers = ['Insured Person', 'Relationship', 'Eligible Amount', 'Utilized Amount', 'Balance Amount', 'Policy Number', 'Insurer', 'Plan Name'];
      rows = dependenciesData.map((d: any) => [
        `"${(d.name || '').replace(/"/g, '""')}"`,
        `"${(d.relationship || '').replace(/"/g, '""')}"`,
        d.eligibleAmount ?? '',
        d.utilizedAmount ?? '',
        d.balanceAmount ?? '',
        `"${(d.policyNo || '').replace(/"/g, '""')}"`,
        `"${(d.insurer || '').replace(/"/g, '""')}"`,
        `"${(d.planName || '').replace(/"/g, '""')}"`
      ].join(',')).join('\n');
    } else {
      headers = ['Customer Name', 'Policy Number', 'Product', 'Insurer', 'PHC Year', 'Status', 'Eligible Amount', 'Utilized Amount', 'Balance Amount', 'Days Remaining'];
      rows = sortedFilteredData.map((p: any) => [
        `"${(p.customerName || '').replace(/"/g, '""')}"`,
        `"${(p.policyNo || '').replace(/"/g, '""')}"`,
        `"${(p.planName || '').replace(/"/g, '""')}"`,
        `"${(p.companyName || '').replace(/"/g, '""')}"`,
        `"${(p.currentPhcYear || '').replace(/"/g, '""')}"`,
        `"${(p.phcStatus || '').replace(/"/g, '""')}"`,
        p.eligibleAmount ?? '',
        p.utilizedAmount ?? '',
        p.balanceAmount ?? '',
        p.daysRemaining ?? ''
      ].join(',')).join('\n');
    }
    
    const content = headers.join(',') + '\n' + rows;
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `phc_tracking_export_&{new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    // Since toast is imported from policies index or globally, let's use global import dynamically
    import('react-hot-toast').then(({ default: toast }) => toast.success('PHC data exported to Excel successfully'));
  };

  const exportPhcToPdf = () => {
    const isDeps = activeTab === 'dependencies';
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      import('react-hot-toast').then(({ default: toast }) => toast.error('Pop-up blocked. Please allow pop-ups to print PDF'));
      return;
    }
    
    let headersHtml = '';
    let rowsHtml = '';
    
    if (isDeps) {
      headersHtml = `
        <tr>
          <th style="width: 20%;">Insured Person</th>
          <th style="width: 15%;">Relationship</th>
          <th style="width: 15%; text-align: right;">Eligible Amount</th>
          <th style="width: 15%; text-align: right;">Utilized Amount</th>
          <th style="width: 15%; text-align: right;">Balance Amount</th>
          <th style="width: 20%;">Policy No</th>
        </tr>
      `;
      rowsHtml = dependenciesData.map((d: any) => `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <td style="padding: 8px;">${d.name || 'N/A'}</td>
          <td style="padding: 8px;">${d.relationship || 'N/A'}</td>
          <td style="padding: 8px; text-align: right;">₹${d.eligibleAmount?.toLocaleString() || 0}</td>
          <td style="padding: 8px; text-align: right;">₹${d.utilizedAmount?.toLocaleString() || 0}</td>
          <td style="padding: 8px; text-align: right;">₹${d.balanceAmount?.toLocaleString() || 0}</td>
          <td style="padding: 8px; font-weight: 600;">${d.policyNo || 'N/A'}</td>
        </tr>
      `).join('');
    } else {
      headersHtml = `
        <tr>
          <th style="width: 20%;">Customer Name</th>
          <th style="width: 15%;">Policy No</th>
          <th style="width: 20%;">Product</th>
          <th style="width: 15%; text-align: center;">PHC Year</th>
          <th style="width: 10%; text-align: right;">Balance</th>
          <th style="width: 10%; text-align: center;">Status</th>
          <th style="width: 10%; text-align: center;">Days Left</th>
        </tr>
      `;
      rowsHtml = sortedFilteredData.map((p: any) => `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <td style="padding: 8px;">${p.customerName || 'N/A'}</td>
          <td style="padding: 8px; font-weight: 600;">${p.policyNo || 'N/A'}</td>
          <td style="padding: 8px;">${p.planName || 'N/A'}</td>
          <td style="padding: 8px; text-align: center;">${p.currentPhcYear || 'N/A'}</td>
          <td style="padding: 8px; text-align: right;">₹${p.balanceAmount?.toLocaleString() || 0}</td>
          <td style="padding: 8px; text-align: center;"><span style="padding: 2px 6px; border-radius: 4px; background: ${p.phcStatus === 'Completed' ? '#def7ec; color: #03543f;' : '#feecdc; color: #b43c08;'} font-size: 10px; font-weight: bold;">${p.phcStatus}</span></td>
          <td style="padding: 8px; text-align: center;">${p.daysRemaining || 'N/A'}</td>
        </tr>
      `).join('');
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>PHC Tracking Report</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; padding: 24px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 10px 8px; text-align: left; font-size: 11px; font-weight: bold; text-transform: uppercase; color: #64748b; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3b82f6; padding-bottom: 12px; }
            .title { font-size: 20px; font-weight: 800; color: #1e3a8a; }
            .meta { font-size: 11px; color: #64748b; text-align: right; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">INSU-MITRA</div>
              <div style="font-size: 12px; color: #475569; font-weight: 600;">PHC Tracking Export Report — ${isDeps ? 'Insured Persons' : 'Policies'}</div>
            </div>
            <div class="meta">
              <div>Date: ${new Date().toLocaleString()}</div>
              <div>Record Count: ${isDeps ? dependenciesData.length : sortedFilteredData.length}</div>
            </div>
          </div>
          <table>
            <thead>
              ${headersHtml}
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedFilteredData.slice(start, start + rowsPerPage);
  }, [sortedFilteredData, currentPage, rowsPerPage]);

  const dependenciesData = useMemo(() => {
    const depsMap = new Map<string, any>();
    
    filteredData.forEach(policy => {
      policy.years.forEach(yr => {
        yr.insuredPersons.forEach(person => {
          if (person.relationship === 'Self') return;
          
          const key = `${policy.id}-${person.name}`;
          if (!depsMap.has(key)) {
            depsMap.set(key, {
              id: key,
              policyRecord: policy,
              name: person.name,
              relationship: person.relationship,
              utilizedAmount: 0,
              phcCount: 0,
            });
          }
          const dep = depsMap.get(key)!;
          dep.utilizedAmount += person.utilizedAmount;
          dep.phcCount += person.phcCount;
        });
      });
    });

    let depsList = Array.from(depsMap.values());
    return sortData(depsList, sortKey, sortDir, (row: any, key: string) => {
      if (key === 'policyNo' || key === 'customerName' || key === 'planName') return row.policyRecord[key];
      return row[key];
    });
  }, [filteredData, sortKey, sortDir]);

  const paginatedDependencies = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return dependenciesData.slice(start, start + rowsPerPage);
  }, [dependenciesData, currentPage, rowsPerPage]);

  const totalRows = activeTab === 'dependencies' ? dependenciesData.length : sortedFilteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, companyFilter, fromDate, phcData, phcStatusFilter, phcYearFilter, policyTypeFilter, searchQuery, toDate]);

  useEffect(() => {
    setCurrentPage(page => Math.min(page, totalPages));
  }, [totalPages]);

  const handleQuickFilter = (key: string) => {
    setQuickFilter(key);
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth(); // 0-indexed

    if (key === 'this-month') {
      const first = new Date(y, m, 1);
      const last = new Date(y, m + 1, 0);
      setFromDate(fmt(first));
      setToDate(fmt(last));
    } else if (key === 'last-month') {
      const first = new Date(y, m - 1, 1);
      const last = new Date(y, m, 0);
      setFromDate(fmt(first));
      setToDate(fmt(last));
    } else if (key === 'this-quarter') {
      const qStart = Math.floor(m / 3) * 3;
      const first = new Date(y, qStart, 1);
      const last = new Date(y, qStart + 3, 0);
      setFromDate(fmt(first));
      setToDate(fmt(last));
    } else if (key === 'this-year') {
      setFromDate(`01/01/${y}`);
      setToDate(`31/12/${y}`);
    }
  };

  const TABS = [
    { key: 'all', label: 'All PHC Policies' },
    { key: 'dependencies', label: 'Dependencies' },
    { key: 'due-this-month', label: 'Due this Month' },
    { key: 'upcoming', label: 'Under Process PHC' },
    { key: 'completed', label: 'Completed PHC' },
  ] as const;

  const SUMMARY_CARDS = [
    { label: 'Total Active Policies with PHC', value: filteredData.length, sub: 'Filtered Policies', icon: Shield, color: 'border-teal-100', iconBg: 'bg-teal-50 text-teal-600 border-teal-100', isAmount: false },
    { label: 'Policies with Full Utilisation', value: filteredData.filter(p => p.phcStatus === 'Fully Utilized' || p.phcStatus === 'Completed').length, sub: 'Filtered Policies', icon: CheckCircle2, color: 'border-emerald-100', iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100', isAmount: false },
    { label: 'Total PHC Amount', value: filteredData.reduce((s, p) => s + p.eligibleAmount, 0), sub: 'Filtered Policies', icon: Wallet, color: 'border-violet-100', iconBg: 'bg-violet-50 text-violet-600 border-violet-100', isAmount: true },
    { label: 'Total Utilised Amount', value: filteredData.reduce((s, p) => s + p.utilizedAmount, 0), sub: 'Filtered Policies', icon: TrendingUp, color: 'border-blue-100', iconBg: 'bg-blue-50 text-blue-600 border-blue-100', isAmount: true },
  ];

  return (
    <div className="space-y-4 pb-10 font-sans">

      {/* ── Summary Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {SUMMARY_CARDS.map(card => (
          <div key={card.label} className={clsx('bg-white rounded-2xl p-3.5 border shadow-xs flex items-center gap-2.5 ', card.color)}>
            <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border', card.iconBg)}>
              <card.icon size={17} />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-tight">{card.label}</p>
              <p className={clsx('font-black text-slate-900 mt-0.5', card.isAmount ? 'text-sm' : 'text-xl')}>
                {card.isAmount ? fmtCurr(card.value as number) : card.value}
              </p>
              <p className="text-[10px] font-bold text-slate-400">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main Table Card ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs">
        {/* Tabs */}
        <div className="flex items-center border-b border-slate-100 px-4 pt-2">
          {TABS.map(tab => (
            <button key={tab.key} type="button" onClick={() => { setActiveTab(tab.key); setCurrentPage(1); }}
              className={clsx('px-5 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap mr-1',
                activeTab === tab.key ? 'border-blue-600 text-blue-600 font-extrabold' : 'border-transparent text-slate-500 hover:text-slate-700')}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter Row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/30">
          <div className="page-search-wrapper">
            <Search className="page-search-icon" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search by policy no., customer, plan name..."
              className="page-search-input"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 flex-wrap">
            {[
              { val: policyTypeFilter, setter: setPolicyTypeFilter, label: 'Policy Type', opts: [['All', 'Policy Type'], ['HEALTH', 'Health'], ['LIFE', 'Life'], ['TERM', 'Term']] },
              { val: phcStatusFilter, setter: setPhcStatusFilter, label: 'PHC Status', opts: [['All', 'PHC Status'], ['Interested', 'Interested'], ['Partial Utilized', 'Partial Utilized'], ['Fully Utilized', 'Fully Utilized'], ['Not Interested', 'Not Interested'], ['Upcoming', 'Upcoming'], ['Due This Month', 'Due This Month'], ['Overdue', 'Overdue'], ['Not Applicable Yet', 'Not Applicable Yet'], ['Completed', 'Completed']] },
              { val: phcYearFilter, setter: setPhcYearFilter, label: 'PHC Year', opts: [['All', 'PHC Year'], ['Year 1', 'Year 1'], ['Year 2', 'Year 2'], ['Year 3', 'Year 3']] },
              { val: companyFilter, setter: setCompanyFilter, label: 'Company', opts: [['All', 'Company'], ...Array.from(new Set(phcData.map((p: any) => p.companyName))).map(c => [c as string, c as string] as [string, string])] },
            ].map(({ val, setter, label, opts }) => {
              const isOpen = openDropdown === label;
              const selectedLabel = opts.find(([v]) => v === val)?.[1] || label;
              return (
                <div
                  key={label}
                  className="relative" data-dropdown="true"
                >
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(prev => prev === label ? null : label)}
                    className={clsx(
                      'bg-white border rounded-xl pl-3 pr-7 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer flex items-center transition-all select-none',
                      val !== 'All'
                        ? 'border-blue-300 bg-blue-50/70 text-blue-700 font-bold'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    )}
                  >
                    <span className="truncate">{selectedLabel}</span>
                    <ChevronDown size={11} className={clsx('absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-transform duration-150', isOpen && 'rotate-180')} />
                  </button>

                  {isOpen && (
                    <div className="absolute left-0 top-full pt-1.5 z-50 min-w-[170px]">
                      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xl p-1.5 max-h-64 overflow-y-auto custom-scrollbar animate-fadeIn space-y-0.5">
                        {opts.map(([v, l]) => {
                          const isSelected = val === v;
                          return (
                            <button
                              key={v}
                              type="button"
                              onClick={() => {
                                setter(v);
                                setCurrentPage(1);
                                setOpenDropdown(null);
                              }}
                              className={clsx(
                                'w-full text-left px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-between gap-2',
                                isSelected
                                  ? 'bg-blue-50 text-blue-700 font-extrabold'
                                  : 'text-slate-700 font-semibold hover:bg-slate-50 hover:text-blue-600'
                              )}
                            >
                              <span className="truncate">{v === 'All' ? `All (${l})` : l}</span>
                              {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <button type="button" onClick={() => { setSearchQuery(''); setPolicyTypeFilter('All'); setPhcStatusFilter('All'); setPhcYearFilter('All'); setCompanyFilter('All'); setFromDate(''); setToDate(''); setActiveTab('all'); setCurrentPage(1); setQuickFilter(null); }}
              className="flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
              <RotateCcw size={12} /> Reset
            </button>
            <button
              type="button"
              onClick={() => setShowDateFilter(prev => !prev)}
              className={clsx(
                "p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 cursor-pointer shadow-2xs transition-all flex items-center gap-1.5 text-xs font-bold bg-white",
                showDateFilter && "bg-blue-50 border-blue-200 text-blue-600"
              )}
              title="Advanced Filters"
            >
              <Filter size={14} className={showDateFilter || activePhcFilterCount > 0 ? "text-blue-600" : "text-slate-500"} />
              <span className="hidden sm:inline">Filters</span>
              {activePhcFilterCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] bg-blue-600 text-white rounded-full font-black leading-none">
                  {activePhcFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Collapsible Date Wise Filter ──────────────────────────────────────── */}
        {showDateFilter && (
          <div className="bg-slate-50/50 border-b border-slate-200/80 p-4 space-y-3 animate-fadeIn">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-extrabold text-blue-700 flex flex-wrap items-center gap-1.5">
                <Calendar size={13} className="text-blue-500" />
                Advanced Filters & Export
              </p>
              {/* Export Buttons inside Filter Form */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Export PHC:</span>
                <button
                  type="button"
                  onClick={exportPhcToExcel}
                  className="px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 cursor-pointer shadow-2xs transition-all flex items-center gap-1.5 text-xs font-bold"
                  title="Export to Excel"
                >
                  <Download size={13} className="text-emerald-600" />
                  <span>Export Excel</span>
                </button>
                <button
                  type="button"
                  onClick={exportPhcToPdf}
                  className="px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 cursor-pointer shadow-2xs transition-all flex items-center gap-1.5 text-xs font-bold"
                  title="Export to PDF"
                >
                  <FileText size={13} className="text-red-500" />
                  <span>Export PDF</span>
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Filter By</label>
                <div
                  className="relative" data-dropdown="true"
                >
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(prev => prev === 'Filter By' ? null : 'Filter By')}
                    className="bg-white border border-slate-200 rounded-xl pl-3 pr-7 py-2 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer flex items-center transition-all select-none hover:border-slate-300"
                  >
                    <span>{dateFilterType}</span>
                    <ChevronDown size={11} className={clsx('absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-transform duration-150', openDropdown === 'Filter By' && 'rotate-180')} />
                  </button>
                  {openDropdown === 'Filter By' && (
                    <div className="absolute left-0 top-full pt-1.5 z-50 min-w-[180px]">
                      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xl p-1.5 animate-fadeIn space-y-0.5">
                        {['PHC Year End Date', 'PHC Start Date', 'Policy End Date'].map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => {
                              setDateFilterType(t);
                              setOpenDropdown(null);
                            }}
                            
                            className={clsx(
                              'w-full text-left px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-between gap-2',
                              dateFilterType === t
                                ? 'bg-blue-50 text-blue-700 font-extrabold'
                                : 'text-slate-700 font-semibold hover:bg-slate-50 hover:text-blue-600'
                            )}
                          >
                            <span>{t}</span>
                            {dateFilterType === t && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">From Date</label>
                <div className="relative">
                  <input type="text" value={fromDate} onChange={e => { setFromDate(e.target.value); setQuickFilter(null); }}
                    className="bg-white border border-slate-200 rounded-xl pl-3 pr-9 py-2 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 w-36" placeholder="DD/MM/YYYY" />
                  <Calendar size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">To Date</label>
                <div className="relative">
                  <input type="text" value={toDate} onChange={e => { setToDate(e.target.value); setQuickFilter(null); }}
                    className="bg-white border border-slate-200 rounded-xl pl-3 pr-9 py-2 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 w-36" placeholder="DD/MM/YYYY" />
                  <Calendar size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 flex-wrap">
                {[{ key: 'this-month', label: 'This Month' }, { key: 'last-month', label: 'Last Month' }, { key: 'this-quarter', label: 'This Quarter' }, { key: 'this-year', label: 'This Year' }].map(qf => (
                  <button key={qf.key} type="button" onClick={() => handleQuickFilter(qf.key)}
                    className={clsx('px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all border', quickFilter === qf.key ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')}>
                    {qf.label}
                  </button>
                ))}
                <button type="button" onClick={() => { setFromDate(''); setToDate(''); setQuickFilter(null); }}
                  className="px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">Clear</button>
              </div>
            </div>
            {fromDate && toDate && (
              <p className="text-[11px] font-medium text-slate-500 italic">
                Showing policies whose {dateFilterType} is between {fromDate} and {toDate}
              </p>
            )}
          </div>
        )}

        {/* Table */}
        <div className="max-h-[420px] overflow-auto custom-scrollbar overscroll-contain">
          {activeTab === 'dependencies' ? (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-20">
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-3 py-3 border border-slate-200 text-center w-10">Sr No.</th>
                  {[
                    { key: 'customerName', label: 'Customer Name' },
                    { key: 'policyNo', label: 'Policy no.' },
                    { key: 'planName', label: 'Product name' },
                    { key: 'name', label: 'Dependent Name' },
                    { key: 'relationship', label: 'Relationship' },
                    { key: 'utilizedAmount', label: 'Total Utilised' },
                    { key: 'phcCount', label: 'Total PHC Count' },
                    { key: 'Actions', label: 'Action', align: 'right' },
                  ].map(h => (
                    <th key={h.key} 
                      className={clsx(`px-3 py-3 border border-slate-200 whitespace-nowrap select-none ${h.align === 'right' ? 'text-right' : ''}`, h.key !== 'Actions' && 'cursor-pointer')}
                      onClick={() => {
                        if (h.key === 'Actions') return;
                        if (sortKey === h.key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                        else { setSortKey(h.key); setSortDir('asc'); }
                      }}
                    >
                      <span className={clsx("inline-flex items-center gap-1", h.align === 'right' && "justify-end w-full")}>
                        {h.label}
                        {h.key !== 'Actions' && (
                          <span className="text-slate-400">
                            {sortKey === h.key
                              ? sortDir === 'asc' ? <ChevronUp size={13} className="text-slate-900 stroke-[3]" /> : <ChevronDown size={13} className="text-slate-900 stroke-[3]" />
                              : <ChevronUp size={13} className="text-slate-500 stroke-[2.5]" />}
                          </span>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80 font-medium">
                {paginatedDependencies.length === 0 ? (
                  <tr><td colSpan={9} className="px-5 py-12 text-center text-slate-400 font-semibold">No dependents match the selected filters.</td></tr>
                ) : paginatedDependencies.map((r, idx) => (
                  <tr key={r.id} onClick={() => setDrawerRecord(r.policyRecord)} className={clsx(idx % 2 === 1 ? 'bg-slate-50/80' : 'bg-white')}>
                    <td className="px-3 py-3 border border-slate-200 text-center font-bold text-slate-500">{(currentPage - 1) * rowsPerPage + idx + 1}</td>
                    <td className="px-3 py-3 border border-slate-200 font-bold text-slate-900 whitespace-nowrap">{r.policyRecord.customerName}</td>
                    <td className="px-3 py-3 border border-slate-200 whitespace-nowrap"><span className="font-bold text-slate-800 text-[11px]">{r.policyRecord.policyNo}</span></td>
                    <td className="px-3 py-3 border border-slate-200"><p className="font-semibold text-slate-700 text-[11px] max-w-[130px] truncate">{r.policyRecord.planName}</p></td>
                    <td className="px-3 py-3 border border-slate-200 font-extrabold text-slate-900 text-xs whitespace-nowrap">
                      <span>{r.name}</span>
                    </td>
                    <td className="px-3 py-3 border border-slate-200 whitespace-nowrap font-bold text-slate-800 text-xs">{r.relationship}</td>
                    <td className="px-3 py-3 border border-slate-200 whitespace-nowrap font-extrabold text-slate-900 text-xs">{fmtCurr(r.utilizedAmount)}</td>
                    <td className="px-3 py-3 border border-slate-200 whitespace-nowrap font-extrabold text-slate-900 text-xs">{r.phcCount}</td>
                    <td className="px-3 py-3 border border-slate-200 whitespace-nowrap text-right" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setDrawerRecord(r.policyRecord)} className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 cursor-pointer transition-colors" title="View Policy Details">
                        <Eye size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-20">
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-3 py-3 border border-slate-200 text-center w-10">
                  <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                    checked={selectedRows.size === paginatedData.length && paginatedData.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedRows(new Set(paginatedData.map(r => r.id)));
                      else setSelectedRows(new Set());
                    }} />
                </th>
                {[
                  { key: 'srNo', label: 'Sr. No.' },
                  { key: 'customerName', label: 'Customer Name' },
                  { key: 'customerPhone', label: 'Customer contact no' },
                  { key: 'companyType', label: 'Insurance company type' },
                  { key: 'companyName', label: 'Insurance company name' },
                  { key: 'planName', label: 'Product name' },
                  { key: 'sumInsured', label: 'Sum Insured' },
                  { key: 'policyNo', label: 'Policy no.' },
                  { key: 'policyEndDate', label: 'Policy End date' },
                  { key: 'currentPhcYear', label: 'Current PHC Year' },
                  { key: 'phcYearStartDate', label: 'PHC Year Start Date' },
                  { key: 'phcYearEndDate', label: 'PHC Year End Date' },
                  { key: 'phcStatus', label: 'PHC Status' },
                  { key: 'eligibleAmount', label: 'PHC Amount' },
                  { key: 'utilizedAmount', label: 'Utilised Amount' },
                  { key: 'balanceAmount', label: 'Balance amount' },
                  { key: 'Actions', label: 'Action', align: 'right' },
                ].map(h => (
                  <th key={h.key} 
                    className={clsx(`px-3 py-3 border border-slate-200 whitespace-nowrap select-none ${h.align === 'right' ? 'text-right' : ''}`, h.key !== 'Actions' && h.key !== 'srNo' && 'cursor-pointer')}
                    onClick={() => {
                      if (h.key === 'Actions' || h.key === 'srNo') return;
                      if (sortKey === h.key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                      else { setSortKey(h.key); setSortDir('asc'); }
                    }}
                  >
                    <span className={clsx("inline-flex items-center gap-1", h.align === 'right' && "justify-end w-full")}>
                      {h.label}
                      {h.key !== 'Actions' && h.key !== 'srNo' && (
                        <span className="text-slate-400">
                          {sortKey === h.key
                            ? sortDir === 'asc' ? <ChevronUp size={13} className="text-slate-900 stroke-[3]" /> : <ChevronDown size={13} className="text-slate-900 stroke-[3]" />
                            : <ChevronUp size={13} className="text-slate-500 stroke-[2.5]" />}
                        </span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80 font-medium">
              {isLoading ? (
                <tr><td colSpan={18} className="px-5 py-12 text-center text-slate-400 font-semibold">Loading PHC records…</td></tr>
              ) : isError ? (
                <tr>
                  <td colSpan={18} className="px-5 py-12 text-center text-rose-600 font-semibold">
                    <span>Unable to load PHC records.</span>
                    <button type="button" onClick={() => refetch()} className="ml-2 text-blue-600 underline">Retry</button>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr><td colSpan={18} className="px-5 py-12 text-center text-slate-400 font-semibold">No PHC policies match the selected filters.</td></tr>
              ) : paginatedData.map((r, idx) => {
                const resolvedCompanyType = (
                  r.companyType ||
                  (r.planName?.toLowerCase().includes('life') || r.planName?.toLowerCase().includes('jeevan') ? 'LIFE' : 'HEALTH')
                ).toUpperCase();
                const effEligible = r.eligibleAmount > 0 ? r.eligibleAmount : (r.years?.[0]?.eligibleAmount || 5000);
                const effUtilized = (r.utilizedAmount !== undefined && r.utilizedAmount !== null && r.utilizedAmount > 0)
                  ? r.utilizedAmount
                  : (r.years?.reduce((s: number, y: any) => s + (y.utilizedAmount || 0), 0) || r.utilizedAmount || 0);
                const effBalance = (r.balanceAmount !== undefined && r.balanceAmount !== null && r.balanceAmount >= 0)
                  ? r.balanceAmount
                  : Math.max(0, effEligible - effUtilized);

                return (
                <tr key={r.id} onClick={() => setDrawerRecord(r)} className={clsx(idx % 2 === 1 ? 'bg-slate-50/80' : 'bg-white', selectedRows.has(r.id) && 'bg-blue-50/50')}>
                  <td className="px-3 py-3 border border-slate-200 text-center" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                      checked={selectedRows.has(r.id)}
                      onChange={(e) => {
                        const newSet = new Set(selectedRows);
                        if (e.target.checked) newSet.add(r.id);
                        else newSet.delete(r.id);
                        setSelectedRows(newSet);
                      }} />
                  </td>
                  <td className="px-3 py-3 border border-slate-200 text-center font-bold text-slate-500">{(currentPage - 1) * rowsPerPage + idx + 1}</td>
                  <td className="px-3 py-3 border border-slate-200">
                    <span className="font-extrabold text-slate-900 text-xs transition-colors whitespace-nowrap">
                      {r.customerName}
                    </span>
                  </td>
                  <td className="px-3 py-3 border border-slate-200 whitespace-nowrap font-bold text-slate-800 text-xs">{r.customerPhone || 'N/A'}</td>
                  <td className="px-3 py-3 border border-slate-200 whitespace-nowrap">
                    <span className={clsx(
                      "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border",
                      resolvedCompanyType === 'HEALTH' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      resolvedCompanyType === 'LIFE' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      resolvedCompanyType === 'MOTOR' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-slate-100 text-slate-800 border-slate-200'
                    )}>
                      {resolvedCompanyType}
                    </span>
                  </td>
                  <td className="px-3 py-3 border border-slate-200 whitespace-nowrap font-extrabold text-slate-900 text-xs">{r.companyName || 'N/A'}</td>
                  <td className="px-3 py-3 border border-slate-200">
                    <p className="font-extrabold text-blue-900 text-xs max-w-[130px] truncate" title={r.planName}>{r.planName || 'N/A'}</p>
                  </td>
                  <td className="px-3 py-3 border border-slate-200 whitespace-nowrap font-extrabold text-slate-900 text-xs">{fmtCurr(r.sumInsured || 0)}</td>
                  <td className="px-3 py-3 border border-slate-200 whitespace-nowrap">
                    <span className="font-black text-slate-900 text-xs tracking-tight bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">{r.policyNo}</span>
                  </td>
                  <td className="px-3 py-3 border border-slate-200 whitespace-nowrap font-bold text-slate-800 text-xs">{r.policyEndDate || 'N/A'}</td>
                  <td className="px-3 py-3 border border-slate-200 whitespace-nowrap">
                    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold border',
                      r.currentPhcYear.includes('1') ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      r.currentPhcYear.includes('2') ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      'bg-violet-50 text-violet-700 border-violet-200')}>
                      {r.currentPhcYear.replace(' (Current)', '')} <span className="ml-1 text-[9px] opacity-70">(Current)</span>
                    </span>
                  </td>
                  <td className="px-3 py-3 border border-slate-200 whitespace-nowrap font-bold text-slate-800 text-xs">{r.phcYearStartDate || 'N/A'}</td>
                  <td className="px-3 py-3 border border-slate-200 whitespace-nowrap">
                    <p className="text-slate-800 font-bold text-xs">{r.phcYearEndDate || 'N/A'}</p>
                    {r.daysRemaining > 0 && <p className={clsx('text-[10px] font-bold', r.daysRemaining <= 30 ? 'text-rose-500' : 'text-slate-400')}>{r.daysRemaining} Days Remaining</p>}
                  </td>
                  <td className="px-3 py-3 border border-slate-200 whitespace-nowrap"><StatusBadge status={r.phcStatus} /></td>
                  <td className="px-3 py-3 border border-slate-200 whitespace-nowrap font-black text-slate-900 text-xs">{fmtCurr(effEligible)}</td>
                  <td className="px-3 py-3 border border-slate-200 whitespace-nowrap font-extrabold text-xs">
                    {effUtilized > 0 ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded font-black bg-amber-50 text-amber-700 border border-amber-200">
                        {fmtCurr(effUtilized)}
                      </span>
                    ) : (
                      <span className="text-slate-500 font-bold">{fmtCurr(0)}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 border border-slate-200 whitespace-nowrap font-black text-emerald-700 text-xs">{fmtCurr(effBalance)}</td>
                  <td className="px-3 py-3 border border-slate-200 whitespace-nowrap text-right" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setDrawerRecord(r)} className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 cursor-pointer transition-colors" title="View PHC Details">
                      <Eye size={13} />
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          )}
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <span className="text-sm text-slate-500 font-medium">
            Showing <strong className="font-extrabold text-slate-800">{totalRows === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1}–{Math.min(currentPage * rowsPerPage, totalRows)}</strong>
            {' '}of <strong className="font-extrabold text-slate-800">{totalRows}</strong> records
          </span>
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"><ChevronLeft size={15} /></button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const firstPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
              const page = firstPage + i;
              return (
                <button key={page} type="button" onClick={() => setCurrentPage(page)}
                  className={clsx(
                    'min-w-[30px] h-7 px-2 rounded-lg text-sm font-extrabold transition-all border',
                    currentPage === page ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
                  )}>{page}</button>
              );
            })}
            <button type="button" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"><ChevronRight size={15} /></button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold">10 rows per page</span>
          </div>
        </div>
      </div>

      {/* Drawer */}
      {drawerRecord && <PhcDrawer record={drawerRecord} onClose={() => setDrawerRecord(null)} policyNotesMap={policyNotesMap} />}
    </div>
  );
}

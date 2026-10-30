import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, FileText, User, Trash2, Search, TrendingUp, CheckCircle, Clock, DollarSign, 
  Shield, Calendar, ChevronUp, ChevronDown, Filter, RefreshCw, Eye, CheckSquare, 
  Square, PieChart, Users, Award, ChevronRight, Download, SlidersHorizontal, Info,
  UserPlus, X
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commissionsService, policiesService, employeesService, contactsService } from '@api/index';
import Modal from '@comps/common/Modal';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { useAuthStore } from '@store/auth.store';
import { sortData } from '../../utils/sortUtils';
import { deletionRequestsService } from '@api/deletionRequestsService';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

interface Commission {
  id: string; amount: number; rate: number; isPaid: boolean; paidAt?: string;
  notes?: string;
  baseCommissionRate?: number;
  baseCommissionAmount?: number;
  policy?: { 
    policyNumber: string;
    sumAssured?: number;
    premiumAmount?: number;
    startDate?: string;
    endDate?: string;
    contact?: { firstName: string; lastName: string };
    plan?: { name: string; category?: string; company?: { name: string } };
  };
  commissionYear?: { name: string };
  beneficiary?: { employeeProfile?: { firstName: string; lastName: string } };
}

const schema = z.object({
  policyId:         z.string().regex(/^[0-9a-fA-F]{24}$/, 'Select a policy'),
  beneficiaryId:    z.string().regex(/^[0-9a-fA-F]{24}$/, 'Select an employee'),
  commissionYearId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Select a year'),
  amount:           z.coerce.number().min(0),
  rate:             z.coerce.number().min(0).max(100).optional(),
  notes:            z.string().optional(),
  
  basePremium:          z.coerce.number().optional(),
  baseCommissionRate:   z.coerce.number().optional(),
  baseCommissionAmount: z.coerce.number().optional(),
  
  addonPremium:          z.coerce.number().optional(),
  addonCommissionRate:   z.coerce.number().optional(),
  addonCommissionAmount: z.coerce.number().optional(),
  
  deductibleRate:        z.coerce.number().optional(),
  deductibleAmount:      z.coerce.number().optional(),
  monthlyGridRate:       z.coerce.number().optional(),
  monthlyGridAmount:     z.coerce.number().optional(),
  otherRate:             z.coerce.number().optional(),
  otherAmount:           z.coerce.number().optional(),
  renewalRate:           z.coerce.number().optional(),
  renewalAmount:         z.coerce.number().optional(),
  
  year1Commission:       z.coerce.number().optional(),
  year2Commission:       z.coerce.number().optional(),
  year3Commission:       z.coerce.number().optional(),
  year4Commission:       z.coerce.number().optional(),
  year5Commission:       z.coerce.number().optional(),
});
type Form = z.infer<typeof schema>;

const fmt = (n: number) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtShort = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${Number(n).toLocaleString('en-IN')}`;
};

export default function Commissions() {
  const { user: authUser } = useAuthStore();
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState('');
  const [modalOpen, setModalOpen]   = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [payConfirm, setPayConfirm] = useState<Commission | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Commission | null>(null);
  const qc = useQueryClient();

  // Mock UI Filter State for top filter bar (Frontend only)
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [insCategory, setInsCategory] = useState('All');
  const [insCompany, setInsCompany]   = useState('All');
  const [insCategoryPlan, setInsCategoryPlan] = useState('All');
  const [businessCat, setBusinessCat] = useState('All');
  const [policyTypeDropdown, setPolicyTypeDropdown] = useState(false);
  const [selectedPolicyTypes, setSelectedPolicyTypes] = useState<string[]>(['Fresh', 'Port', 'Renewal']);
  const [planName, setPlanName]       = useState('All');
  const [assignedEmp, setAssignedEmp] = useState('All');
  const [baFilter, setBaFilter]       = useState('All');
  const [rmFilter, setRmFilter]       = useState('All');
  const [minSum, setMinSum]           = useState('');
  const [maxSum, setMaxSum]           = useState('');
  const [activeState, setActiveState] = useState('Active');

  // Selected policy details panel state (Frontend UI interaction)
  const [activePolicy, setActivePolicy] = useState<{
    policyNo: string;
    customerName: string;
    company: string;
    planName: string;
    policyType: string;
    sumInsured: string;
    startDate: string;
    endDate: string;
    premium: string;
    agent: string;
    employee: string;
    ba: string;
    manager: string;
  } | null>(null);

  // Multi-selection state for table policies
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [summaryView, setSummaryView] = useState<'Company' | 'Tenure' | 'Employee' | 'BA'>('Company');

  // Filter panel collapse state (Hidden by default, shown when Filter button is clicked)
  const [showFilter, setShowFilter] = useState(false);

  // Active Tab state for section switching
  const [activeTab, setActiveTab] = useState<'WITHOUT_COMMISSION' | 'BULK_SET' | 'CARD_VIEW'>('WITHOUT_COMMISSION');

  // Employee search & select states
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeDrop, setEmployeeDrop] = useState(false);
  const [commissionDate, setCommissionDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [addEmployeeModalOpen, setAddEmployeeModalOpen] = useState(false);
  const [newEmpForm, setNewEmpForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    designation: 'Insurance Advisor',
    password: 'Password@123',
  });

  // Bulk Set Commission tab state
  const [bulkEmployee, setBulkEmployee]     = useState('All');
  const [bulkCompany, setBulkCompany]       = useState('Star Health Insurance');
  const [bulkPolicyType, setBulkPolicyType] = useState('Renewal');
  const [bulkEmpRate, setBulkEmpRate]       = useState('15.00');
  const [bulkDate, setBulkDate]             = useState(format(new Date(), 'yyyy-MM-dd'));

  // Policy search & select states (Only all policies list, no customer filtering)
  const [policySearch, setPolicySearch]     = useState('');
  const [selectedPolicy, setSelectedPolicy] = useState<any | null>(null);
  const [policyDrop, setPolicyDrop]         = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['commissions', page],
    queryFn:  () => commissionsService.list({ page, limit: 20 }),
  });
  const { data: summary } = useQuery({
    queryKey: ['commissions', 'overview'],
    queryFn:  () => commissionsService.overview(),
  });
  const { data: yearsData } = useQuery({
    queryKey: ['commission-years'],
    queryFn:  () => commissionsService.years(),
    enabled:  modalOpen,
  });
  const { data: employeesData, isLoading: employeesLoading } = useQuery({
    queryKey: ['employees-lookup-commissions'],
    queryFn:  () => employeesService.list({ limit: 100 }),
    enabled:  modalOpen,
  });
  const { data: policyResults, isLoading: policyLoading } = useQuery({
    queryKey: ['policy-search-comm', policySearch],
    queryFn:  () => policiesService.list({ 
      search: policySearch, 
      limit: 500 
    }),
    enabled:  modalOpen,
  });

  const employeesList: any[] = useMemo(() => {
    const raw = employeesData?.data ?? employeesData ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [employeesData]);

  const filteredEmployees = useMemo(() => {
    if (!employeeSearch.trim()) return employeesList;
    const q = employeeSearch.toLowerCase();
    return employeesList.filter((emp: any) => {
      const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
      const email = (emp.user?.email || '').toLowerCase();
      const designation = (emp.designation || '').toLowerCase();
      const phone = (emp.phone || '').toLowerCase();
      return fullName.includes(q) || email.includes(q) || designation.includes(q) || phone.includes(q);
    });
  }, [employeesList, employeeSearch]);

  const policyList: any[] = useMemo(() => {
    const raw = policyResults?.data ?? policyResults ?? [];
    const list = Array.isArray(raw) ? raw : [];
    if (!policySearch.trim()) return list;
    const q = policySearch.toLowerCase().trim();
    return list.filter((p: any) => {
      const pNum = String(p.policyNumber || '').toLowerCase();
      const planN = String(p.plan?.name || '').toLowerCase();
      const compN = String(p.plan?.company?.name || '').toLowerCase();
      const catN = String(p.plan?.category || '').toLowerCase();
      const custN = `${p.contact?.firstName || ''} ${p.contact?.lastName || ''}`.toLowerCase();
      return pNum.includes(q) || planN.includes(q) || compN.includes(q) || catN.includes(q) || custN.includes(q);
    });
  }, [policyResults, policySearch]);

  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const w = useWatch({ control });

  const getEmployeeUserId = (emp: any): string => {
    return emp?.user?.id || emp?.userId || emp?.id || '';
  };

  const handleSelectEmployee = (emp: any) => {
    setSelectedEmployee(emp);
    const uId = getEmployeeUserId(emp);
    setValue('beneficiaryId', uId, { shouldValidate: true });
    setEmployeeDrop(false);
    setEmployeeSearch('');
  };

  const handleClearEmployee = () => {
    setSelectedEmployee(null);
    setValue('beneficiaryId', '', { shouldValidate: true });
    setEmployeeSearch('');
  };

  const handleSelectPolicy = (p: any) => {
    setSelectedPolicy(p);
    setValue('policyId', p.id, { shouldValidate: true });

    const prem = Number(p.premiumAmount || 0);
    setValue('basePremium', prem);

    const currentAmt = Number(w.amount || 0);
    const defaultRate = 15;
    if (!currentAmt || currentAmt === 0) {
      const commAmt = Math.round(prem * (defaultRate / 100));
      setValue('rate', defaultRate);
      setValue('baseCommissionRate', defaultRate);
      setValue('baseCommissionAmount', commAmt);
      setValue('amount', commAmt, { shouldValidate: true });
    } else if (prem > 0) {
      const calcRate = Number(((currentAmt / prem) * 100).toFixed(2));
      setValue('rate', calcRate);
      setValue('baseCommissionRate', calcRate);
    }

    if (!selectedEmployee && (p.assignedEmployee || p.assignedEmployeeId)) {
      const empId = p.assignedEmployeeId || p.assignedEmployee?.id;
      const found = employeesList.find((e: any) =>
        e.id === empId || e.userId === empId || e.user?.id === empId
      );
      if (found) {
        handleSelectEmployee(found);
      } else if (p.assignedEmployee) {
        handleSelectEmployee(p.assignedEmployee);
      }
    }

    setPolicyDrop(false);
    setPolicySearch('');
  };

  const handleClearPolicy = () => {
    setSelectedPolicy(null);
    setValue('policyId', '', { shouldValidate: true });
    setValue('basePremium', 0);
    setPolicySearch('');
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value) || 0;
    setValue('amount', val, { shouldValidate: true });
    setValue('baseCommissionAmount', val);
    const prem = Number(w.basePremium || selectedPolicy?.premiumAmount || 0);
    if (prem > 0) {
      const calcRate = Number(((val / prem) * 100).toFixed(2));
      setValue('rate', calcRate);
      setValue('baseCommissionRate', calcRate);
    }
  };

  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const r = parseFloat(e.target.value) || 0;
    setValue('rate', r);
    setValue('baseCommissionRate', r);
    const prem = Number(w.basePremium || selectedPolicy?.premiumAmount || 0);
    if (prem > 0) {
      const calcAmt = Math.round(prem * (r / 100));
      setValue('amount', calcAmt, { shouldValidate: true });
      setValue('baseCommissionAmount', calcAmt);
    }
  };

  const createEmployeeMutation = useMutation({
    mutationFn: (body: any) => employeesService.create(body),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['employees-lookup-commissions'] });
      toast.success('Employee created successfully!');
      setAddEmployeeModalOpen(false);
      setNewEmpForm({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        designation: 'Insurance Advisor',
        password: 'Password@123',
      });
      const created = res?.data || res;
      if (created) {
        handleSelectEmployee(created);
      }
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create employee');
    }
  });

  const basePrem     = Number(w.basePremium) || 0;
  const baseRate     = Number(w.baseCommissionRate) || 0;
  const baseComm     = Number(w.baseCommissionAmount) || (basePrem * (baseRate / 100));

  const addonPrem    = Number(w.addonPremium) || 0;
  const addonRate    = Number(w.addonCommissionRate) || 0;
  const addonComm    = Number(w.addonCommissionAmount) || (addonPrem * (addonRate / 100));

  const totalPremium = basePrem + addonPrem;

  const deducRate    = Number(w.deductibleRate) || 0;
  const deducComm    = Number(w.deductibleAmount) || (totalPremium * (deducRate / 100));

  const gridRate     = Number(w.monthlyGridRate) || 0;
  const gridComm     = Number(w.monthlyGridAmount) || (totalPremium * (gridRate / 100));

  const otherRate    = Number(w.otherRate) || 0;
  const otherComm    = Number(w.otherAmount) || (totalPremium * (otherRate / 100));

  const renewalRate  = Number(w.renewalRate) || 0;
  const renewalComm  = Number(w.renewalAmount) || (totalPremium * (renewalRate / 100));

  const totalComm    = (baseComm + addonComm + gridComm + otherComm + renewalComm) - deducComm;
  const yearlyShare  = totalComm / 5;

  const createYear = useMutation({
    mutationFn: (body: { name: string; year: number }) => commissionsService.createYear(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commission-years'] }),
  });
  const [newYearInput, setNewYearInput] = useState(false);
  const [newYearVal, setNewYearVal]     = useState(new Date().getFullYear());

  const createCommission = useMutation({
    mutationFn: (body: Form) => commissionsService.create(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['commissions'] }); closeModal(); },
  });
  const markPaid = useMutation({
    mutationFn: (id: string) => commissionsService.markPaid(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['commissions'] }); setPayConfirm(null); },
  });
  const deleteCommission = useMutation({
    mutationFn: (id: string) => commissionsService.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['commissions'] }); toast.success('Commission deleted'); setDeleteTarget(null); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Error deleting commission'),
  });

  const totals = summary?.data ?? {};
  const years: any[] = yearsData?.data ?? [];

  // Auto-sync years to form values
  useEffect(() => {
    if (years.length > 0) {
      setValue('commissionYearId', years[0].id);
    }
  }, [years, setValue]);

  const handleFormSubmit = async (formData: Form) => {
    if (!formData.beneficiaryId) {
      toast.error('Please select an employee');
      return;
    }
    if (!formData.policyId) {
      toast.error('Please select a policy');
      return;
    }
    if (!formData.commissionYearId) {
      if (years.length > 0) {
        formData.commissionYearId = years[0].id;
      } else {
        toast.error('Please select or create a commission year');
        return;
      }
    }

    const amt = Number(formData.amount || 0);
    const prem = Number(formData.basePremium || selectedPolicy?.premiumAmount || 0);
    const rate = formData.rate !== undefined && formData.rate !== null && !isNaN(formData.rate)
      ? Number(formData.rate)
      : (prem > 0 ? Number(((amt / prem) * 100).toFixed(2)) : 0);

    const formattedDateNote = `Commission Date: ${commissionDate}`;
    const combinedNotes = formData.notes 
      ? `[${formattedDateNote}] ${formData.notes}`
      : formattedDateNote;

    try {
      await createCommission.mutateAsync({
        ...formData,
        amount: amt,
        rate: isNaN(rate) ? 0 : rate,
        baseCommissionAmount: formData.baseCommissionAmount ?? amt,
        notes: combinedNotes,
      });
      toast.success('Commission entry created successfully');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save commission entry');
    }
  };

  const closeModal = () => {
    setModalOpen(false); 
    reset();
    setSelectedEmployee(null);
    setEmployeeSearch('');
    setEmployeeDrop(false);
    setSelectedPolicy(null); 
    setPolicySearch('');
    setPolicyDrop(false);
    setNewYearInput(false);
    setCommissionDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const allRows: Commission[] = data?.data ?? [];

  const filtered = useMemo(() => {
    return allRows.filter((r: any) => {
      if (search.trim()) {
        const matchesSearch =
          r.policy?.policyNumber?.toLowerCase().includes(search.toLowerCase()) ||
          `${r.beneficiary?.employeeProfile?.firstName ?? ''} ${r.beneficiary?.employeeProfile?.lastName ?? ''}`.toLowerCase().includes(search.toLowerCase());
        if (!matchesSearch) return false;
      }
      if (startDate) {
        const rDate = r.paidAt || r.createdAt;
        if (rDate && new Date(rDate) < new Date(startDate)) return false;
      }
      if (endDate) {
        const rDate = r.paidAt || r.createdAt;
        if (rDate && new Date(rDate) > new Date(endDate + 'T23:59:59')) return false;
      }
      return true;
    });
  }, [allRows, search, startDate, endDate]);
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sortedFiltered = useMemo(() => {
    return sortData(filtered, sortKey, sortDir, (row: any, key: string) => {
      if (key === 'AGENT') return `${row.beneficiary?.employeeProfile?.firstName ?? ''} ${row.beneficiary?.employeeProfile?.lastName ?? ''}`;
      if (key === 'POLICY') return row.policy?.policyNumber ?? '';
      if (key === 'BASE') return Number(row.amount ?? 0);
      if (key === 'ADDON') return Number(row.addon ?? 0);
      if (key === 'DEDUCTIBLE') return Number(row.deductible ?? 0);
      if (key === 'TOTAL') return Number(row.amount ?? 0) + Number(row.addon ?? 0) - Number(row.deductible ?? 0);
      if (key === 'STATUS') return row.isPaid ? 1 : -1;
      return row[key];
    });
  }, [filtered, sortKey, sortDir]);

  // Dynamic KPI Ribbon calculations based on live commission records from table
  const liveTotalPolicies = useMemo(() => {
    return sortedFiltered.length.toLocaleString('en-IN');
  }, [sortedFiltered]);

  const liveTotalSumInsured = useMemo(() => {
    const total = sortedFiltered.reduce((acc, r: any) => acc + (Number(r.policy?.sumAssured) || 0), 0);
    return fmtShort(total);
  }, [sortedFiltered]);

  const liveTotalPremium = useMemo(() => {
    const total = sortedFiltered.reduce((acc, r: any) => acc + (Number(r.policy?.premiumAmount) || 0), 0);
    return fmtShort(total);
  }, [sortedFiltered]);

  const liveTotalCommission = useMemo(() => {
    const total = sortedFiltered.reduce((acc, r: any) => acc + (Number(r.amount) || 0), 0);
    return fmtShort(total);
  }, [sortedFiltered]);

  const liveEmpCommission = useMemo(() => {
    const total = sortedFiltered.reduce((acc, r: any) => acc + (Number(r.amount) || 0), 0);
    return fmtShort(total);
  }, [sortedFiltered]);

  const liveBaCommission = useMemo(() => {
    // BA Commission rate or 1% of total premium
    const total = sortedFiltered.reduce((acc, r: any) => acc + (Number(r.baCommissionAmount) || (Number(r.policy?.premiumAmount) || 0) * 0.01), 0);
    return fmtShort(total);
  }, [sortedFiltered]);

  const liveManagerCommission = useMemo(() => {
    // Manager Commission rate or 0.5% of total premium
    const total = sortedFiltered.reduce((acc, r: any) => acc + (Number(r.managerCommissionAmount) || (Number(r.policy?.premiumAmount) || 0) * 0.005), 0);
    return fmtShort(total);
  }, [sortedFiltered]);

  const exportCommissionsToExcel = () => {
    const dataToExport = sortedFiltered.map((c: any) => ({
      'Commission ID': c.id,
      'Policy Number': c.policy?.policyNumber || 'N/A',
      'Beneficiary / Employee': c.beneficiary?.employeeProfile ? `${c.beneficiary.employeeProfile.firstName} ${c.beneficiary.employeeProfile.lastName}` : 'N/A',
      'Commission Year': c.commissionYear?.name || 'N/A',
      'Base Amount': c.amount ? `₹${Number(c.amount).toLocaleString('en-IN')}` : '₹0',
      'Addon Amount': c.addon ? `₹${Number(c.addon).toLocaleString('en-IN')}` : '₹0',
      'Deductible Amount': c.deductible ? `₹${Number(c.deductible).toLocaleString('en-IN')}` : '₹0',
      'Payment Status': c.isPaid ? 'Paid' : 'Unpaid',
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Commissions");
    XLSX.writeFile(workbook, `Commissions_Export_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);
  };

  const exportCommissionsToPdf = () => {
    const rowsHtml = sortedFiltered.map((c: any, index: number) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${index + 1}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${c.policy?.policyNumber || 'N/A'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${c.beneficiary?.employeeProfile ? `${c.beneficiary.employeeProfile.firstName} ${c.beneficiary.employeeProfile.lastName}` : 'N/A'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #16a34a;">₹${Number(c.amount || 0).toLocaleString('en-IN')}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${c.isPaid ? 'PAID' : 'UNPAID'}</td>
      </tr>
    `).join('');

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Commissions Report</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #1e293b; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
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
              <div style="font-size: 12px; color: #475569; font-weight: 600;">Commissions Export Report</div>
            </div>
            <div class="meta">
              <div>Date: ${new Date().toLocaleString()}</div>
              <div>Record Count: ${sortedFiltered.length}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 8%;">Sr</th>
                <th style="width: 25%;">Policy No</th>
                <th style="width: 35%;">Beneficiary</th>
                <th style="width: 17%; text-align: right;">Amount</th>
                <th style="width: 15%; text-align: center;">Status</th>
              </tr>
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

  const selectedPoliciesList = useMemo(() => {
    return selectedIds.map(id => {
      if (id === '1') {
        return {
          id: '1',
          policyNumber: 'STAR/2026/1001',
          customerName: 'Ramesh Kumar',
          company: 'Star Health',
          planName: 'Star Health Assure',
          premium: '₹ 47,050',
        };
      }
      if (id === '2') {
        return {
          id: '2',
          policyNumber: 'STAR/2026/1002',
          customerName: 'Neha Sharma',
          company: 'Star Health',
          planName: 'Star Comprehensive',
          premium: '₹ 62,300',
        };
      }
      const apiRow = sortedFiltered.find(r => r.id === id);
      if (apiRow) {
        return {
          id: apiRow.id,
          policyNumber: apiRow.policy?.policyNumber ?? 'POL-2026-X',
          customerName: apiRow.policy?.contact ? `${apiRow.policy.contact.firstName} ${apiRow.policy.contact.lastName || ''}`.trim() : (apiRow.beneficiary?.employeeProfile ? `${apiRow.beneficiary.employeeProfile.firstName} ${apiRow.beneficiary.employeeProfile.lastName}` : 'Customer'),
          company: 'Star Health',
          planName: 'Star Health Assure',
          premium: apiRow.amount ? `₹ ${Number(apiRow.amount).toLocaleString('en-IN')}` : '₹ 47,050',
        };
      }
      return null;
    }).filter(Boolean) as any[];
  }, [selectedIds, sortedFiltered]);

  const allRowIds = useMemo(() => ['1', '2', ...sortedFiltered.map(r => r.id)], [sortedFiltered]);

  const toggleSelectAll = () => {
    if (selectedIds.length === allRowIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allRowIds);
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const isAllSelected = allRowIds.length > 0 && selectedIds.length === allRowIds.length;

  const employeeSummaries = useMemo(() => {
    const map: Record<string, { name: string; designation: string; policies: number; amount: number; rate: number }> = {};

    sortedFiltered.forEach(r => {
      const name = r.beneficiary?.employeeProfile 
        ? `${r.beneficiary.employeeProfile.firstName || ''} ${r.beneficiary.employeeProfile.lastName || ''}`.trim()
        : 'Employee';
      const desig = (r.beneficiary?.employeeProfile as any)?.designation || 'Advisor';
      if (!map[name]) {
        map[name] = { name, designation: desig, policies: 0, amount: 0, rate: r.rate || 0 };
      }
      map[name].policies += 1;
      map[name].amount += Number(r.amount || 0);
      if (r.rate) map[name].rate = r.rate;
    });

    return Object.values(map);
  }, [sortedFiltered]);

  const companySummaries = useMemo(() => {
    const map: Record<string, { name: string; shortCode: string; policies: number; amount: number; freshCount: number; freshAmt: number; portCount: number; portAmt: number; renewalCount: number; renewalAmt: number }> = {};

    sortedFiltered.forEach(r => {
      const compName = r.policy?.plan?.company?.name || 'Other Insurance';
      const shortCode = compName.split(' ').map((w: string) => w[0]).join('').slice(0, 4).toUpperCase();
      if (!map[compName]) {
        map[compName] = {
          name: compName,
          shortCode,
          policies: 0,
          amount: 0,
          freshCount: 0,
          freshAmt: 0,
          portCount: 0,
          portAmt: 0,
          renewalCount: 0,
          renewalAmt: 0,
        };
      }
      const amt = Number(r.amount || 0);
      map[compName].policies += 1;
      map[compName].amount += amt;

      const polCat = String((r.policy as any)?.businessType || r.policy?.plan?.category || 'RENEWAL').toUpperCase();
      if (polCat.includes('FRESH')) {
        map[compName].freshCount += 1;
        map[compName].freshAmt += amt;
      } else if (polCat.includes('PORT')) {
        map[compName].portCount += 1;
        map[compName].portAmt += amt;
      } else {
        map[compName].renewalCount += 1;
        map[compName].renewalAmt += amt;
      }
    });

    return Object.values(map);
  }, [sortedFiltered]);

  return (
    <div className="space-y-5 pb-10 text-slate-800 font-sans text-sm sm:text-base">
      
      {/* Floating Right Action Panel (Matches Add Contact panel and position) */}
      <div className="fixed right-5 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3 bg-white/90 backdrop-blur-xl p-2 rounded-2xl shadow-2xl border border-slate-200/80 animate-fadeIn">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center justify-center transition-all hover:scale-105 shadow-lg shadow-blue-500/30 cursor-pointer group relative animate-in zoom-in duration-200"
        >
          <Plus size={18} strokeWidth={2.2} />
          <span className="absolute right-full mr-3 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl border border-slate-800 z-50">
            Add Commission Entry
          </span>
        </button>
      </div>

      {/* ── ACTION BUTTONS & SEARCH BAR ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 border border-slate-100 rounded-2xl shadow-sm">
        {/* Left Side: Search Bar ONLY */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="page-search-wrapper">
            <Search className="page-search-icon" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search policy#, employee..."
              className="page-search-input"
            />
          </div>
        </div>

        {/* Right Side: Add Commission Entry & Filter Toggle Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="h-9 px-3.5 text-xs flex items-center gap-1.5 font-bold cursor-pointer rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm shadow-indigo-500/20"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>Add Commission Entry</span>
          </button>
          <button 
            onClick={() => setShowFilter(!showFilter)} 
            className={clsx(
              "h-9 px-3.5 text-xs flex items-center gap-1.5 font-bold cursor-pointer rounded-xl border transition-all shadow-2xs",
              showFilter ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            )}
          >
            <Filter size={14} className={showFilter ? "text-indigo-600" : "text-slate-500"} />
            <span>Filter</span>
            {showFilter ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* ── FILTER PRESETS / PARAMETER CONTROLS (SHOW ONLY ON TOGGLE) ──────── */}
      {showFilter && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-xs uppercase tracking-wider">
              <Filter size={14} className="text-indigo-600" />
              <span>Filter Parameters</span>
            </div>
            <button className="text-indigo-600 text-xs font-bold flex items-center gap-1 hover:underline cursor-pointer">
              <SlidersHorizontal size={13} /> Filter Presets
            </button>
          </div>

          {/* Filter Grid - Row 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="col-span-1 sm:col-span-2 lg:col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Dates (From - To)</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                  title="From Date"
                />
                <span className="text-slate-400 font-bold">-</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                  title="To Date"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Insurance Company Category</label>
              <select value={insCategory} onChange={e => setInsCategory(e.target.value)} className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-medium text-slate-700 outline-none focus:border-indigo-500">
                <option>All</option>
                <option>General Insurance</option>
                <option>Health Insurance</option>
                <option>Life Insurance</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Insurance Company</label>
              <select value={insCompany} onChange={e => setInsCompany(e.target.value)} className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-medium text-slate-700 outline-none focus:border-indigo-500">
                <option>All</option>
                <option>Star Health Insurance</option>
                <option>HDFC Ergo</option>
                <option>Niva Bupa Health</option>
                <option>ICICI Lombard</option>
                <option>LIC of India</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Insurance Plan Category</label>
              <select value={insCategoryPlan} onChange={e => setInsCategoryPlan(e.target.value)} className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-medium text-slate-700 outline-none focus:border-indigo-500">
                <option>All</option>
                <option>Individual</option>
                <option>Floater</option>
                <option>Group</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Business Category</label>
              <select value={businessCat} onChange={e => setBusinessCat(e.target.value)} className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-medium text-slate-700 outline-none focus:border-indigo-500">
                <option>All</option>
                <option>Retail</option>
                <option>Corporate</option>
              </select>
            </div>

            <div className="relative">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Policy Type</label>
              <button 
                onClick={() => setPolicyTypeDropdown(!policyTypeDropdown)} 
                className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-medium text-slate-700 flex justify-between items-center text-left"
              >
                <span className="truncate">{selectedPolicyTypes.length === 3 ? 'All' : selectedPolicyTypes.join(', ') || 'Select'}</span>
                <ChevronDown size={14} className="text-slate-400 shrink-0" />
              </button>
              {policyTypeDropdown && (
                <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-2 space-y-1">
                  {['Fresh', 'Port', 'Renewal'].map(type => (
                    <label key={type} className="flex items-center justify-between text-xs p-1 hover:bg-slate-50 rounded cursor-pointer">
                      <span className="text-slate-700 font-medium">{type}</span>
                      <input 
                        type="checkbox" 
                        checked={selectedPolicyTypes.includes(type)}
                        onChange={() => {
                          if (selectedPolicyTypes.includes(type)) {
                            setSelectedPolicyTypes(selectedPolicyTypes.filter(t => t !== type));
                          } else {
                            setSelectedPolicyTypes([...selectedPolicyTypes, type]);
                          }
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Filter Grid - Row 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end pt-1">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Plan Name</label>
              <select value={planName} onChange={e => setPlanName(e.target.value)} className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-medium text-slate-700 outline-none focus:border-indigo-500">
                <option>All</option>
                <option>Star Health Assure</option>
                <option>Optima Secure</option>
                <option>Health Reassure</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Assigned Employee</label>
              <select value={assignedEmp} onChange={e => setAssignedEmp(e.target.value)} className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-medium text-slate-700 outline-none focus:border-indigo-500">
                <option>All</option>
                <option>Pratibha</option>
                <option>Kapil</option>
                <option>Priya</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Business Associate (BA)</label>
              <select value={baFilter} onChange={e => setBaFilter(e.target.value)} className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-medium text-slate-700 outline-none focus:border-indigo-500">
                <option>All</option>
                <option>PAT</option>
                <option>Rakesh</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">RM / Manager</label>
              <select value={rmFilter} onChange={e => setRmFilter(e.target.value)} className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-medium text-slate-700 outline-none focus:border-indigo-500">
                <option>All</option>
                <option>Sarang</option>
                <option>Manoj</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Sum Insured</label>
              <div className="flex items-center gap-1">
                <input type="text" placeholder="Min" value={minSum} onChange={e => setMinSum(e.target.value)} className="w-1/2 border border-slate-200 rounded-xl px-2 py-1.5 bg-white text-xs text-center font-medium outline-none" />
                <span className="text-slate-400 font-bold">-</span>
                <input type="text" placeholder="Max" value={maxSum} onChange={e => setMaxSum(e.target.value)} className="w-1/2 border border-slate-200 rounded-xl px-2 py-1.5 bg-white text-xs text-center font-medium outline-none" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Active / Inactive</label>
              <select value={activeState} onChange={e => setActiveState(e.target.value)} className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-medium text-slate-700 outline-none focus:border-indigo-500">
                <option>Active</option>
                <option>Inactive</option>
                <option>All</option>
              </select>
            </div>

          </div>

          {/* Action Buttons at bottom of Filter Card */}
          <div className="flex flex-wrap justify-between items-center gap-3 pt-3 border-t border-slate-100">
            {/* Export Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 mr-1">Export Data:</span>
              <button
                type="button"
                onClick={exportCommissionsToExcel}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer shadow-2xs transition-all flex items-center gap-1.5 text-xs font-bold bg-white"
                title="Export to Excel"
              >
                <Download size={14} className="text-emerald-600" />
                <span>Export Excel</span>
              </button>
              <button
                type="button"
                onClick={exportCommissionsToPdf}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer shadow-2xs transition-all flex items-center gap-1.5 text-xs font-bold bg-white"
                title="Export to PDF"
              >
                <FileText size={14} className="text-red-500" />
                <span>Export PDF</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button 
                type="button" 
                onClick={() => { setInsCategory('All'); setInsCompany('All'); setInsCategoryPlan('All'); setBusinessCat('All'); setPlanName('All'); setAssignedEmp('All'); setBaFilter('All'); setRmFilter('All'); setMinSum(''); setMaxSum(''); setActiveState('Active'); }} 
                className="px-4 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 font-bold hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
              >
                Reset
              </button>
              <button 
                type="button" 
                onClick={() => setShowFilter(false)} 
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── KPI METRICS RIBBON (7 SUMMARY CARDS) ────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Card 1 */}
        <div className="bg-white rounded-2xl border border-slate-200/70 p-3.5 flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <FileText size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Total Active Policies</p>
            <p className="text-base font-extrabold text-slate-900 mt-0.5">{liveTotalPolicies}</p>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-2xl border border-slate-200/70 p-3.5 flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Shield size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Total Sum Insured</p>
            <p className="text-base font-extrabold text-slate-900 mt-0.5">{liveTotalSumInsured}</p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-2xl border border-slate-200/70 p-3.5 flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <DollarSign size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Total Premium</p>
            <p className="text-base font-extrabold text-slate-900 mt-0.5">{liveTotalPremium}</p>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white rounded-2xl border border-slate-200/70 p-3.5 flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Total Commission (Est.)</p>
            <p className="text-base font-extrabold text-slate-900 mt-0.5">{liveTotalCommission}</p>
          </div>
        </div>

        {/* Card 5 */}
        <div className="bg-white rounded-2xl border border-slate-200/70 p-3.5 flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <User size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Employees Commission</p>
            <p className="text-base font-extrabold text-slate-900 mt-0.5">{liveEmpCommission}</p>
          </div>
        </div>

        {/* Card 6 */}
        <div className="bg-white rounded-2xl border border-slate-200/70 p-3.5 flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Users size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">BA Commission</p>
            <p className="text-base font-extrabold text-slate-900 mt-0.5">{liveBaCommission}</p>
          </div>
        </div>

        {/* Card 7 */}
        <div className="bg-white rounded-2xl border border-slate-200/70 p-3.5 flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Award size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Manager Commission</p>
            <p className="text-base font-extrabold text-slate-900 mt-0.5">{liveManagerCommission}</p>
          </div>
        </div>
      </div>

      {/* ── MAIN WORKSPACE: FULL WIDTH TABLE ────────────────────────────────── */}
      <div className="space-y-4 w-full">
          
          {/* TAB HEADER BAR */}
          <div className="bg-white rounded-t-2xl border border-slate-200/80 p-3 pb-0 border-b-0 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-4 border-b border-slate-100 w-full sm:w-auto">
              <button 
                onClick={() => setActiveTab('WITHOUT_COMMISSION')}
                className={clsx(
                  "px-4 py-2 border-b-2 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all",
                  activeTab === 'WITHOUT_COMMISSION' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
                )}
              >
                Commission Entries
              </button>
              <button 
                onClick={() => setActiveTab('CARD_VIEW')}
                className={clsx(
                  "px-4 py-2 border-b-2 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all",
                  activeTab === 'CARD_VIEW' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
                )}
              >
                Commission Summary (Card View)
              </button>
            </div>
          </div>

          {/* TAB 1: COMMISSION ENTRIES TABLE */}
          {activeTab === 'WITHOUT_COMMISSION' && (
            <div className="bg-white rounded-b-2xl border border-slate-200/80 shadow-2xs overflow-hidden -mt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="px-3 py-2.5 border-r border-slate-200 text-center w-12">SR. NO.</th>
                      <th className="px-3 py-2.5 border-r border-slate-200">EMPLOYEE NAME</th>
                      <th className="px-3 py-2.5 border-r border-slate-200">POLICY NAME</th>
                      <th className="px-3 py-2.5 border-r border-slate-200 text-center">COMMISSION DATE</th>
                      <th className="px-3 py-2.5 text-right">COMMISSION AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {sortedFiltered.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-xs">
                          No commission entries found.
                        </td>
                      </tr>
                    ) : (
                      sortedFiltered.map((row: any, idx: number) => {
                        const empName = `${row.beneficiary?.employeeProfile?.firstName ?? ''} ${row.beneficiary?.employeeProfile?.lastName ?? ''}`.trim() || '—';
                        const policyName = row.policy?.plan?.name || row.policy?.policyNumber || '—';
                        const commDate = row.paidAt || row.createdAt;
                        const commDateFmt = commDate ? format(new Date(commDate), 'dd/MM/yyyy') : '—';
                        const commAmt = Number(row.amount || 0);
                        return (
                          <tr key={row.id} className="hover:bg-indigo-50/30 transition-colors">
                            <td className="px-3 py-2.5 text-center font-medium border-r border-slate-100">{idx + 1}</td>
                            <td className="px-3 py-2.5 font-semibold border-r border-slate-100">{empName}</td>
                            <td className="px-3 py-2.5 border-r border-slate-100">{policyName}</td>
                            <td className="px-3 py-2.5 text-center border-r border-slate-100">{commDateFmt}</td>
                            <td className="px-3 py-2.5 text-right font-bold text-emerald-700">₹{commAmt.toLocaleString('en-IN')}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50">
                <span className="text-xs font-semibold text-slate-500">
                  Showing {sortedFiltered.length} {sortedFiltered.length === 1 ? 'entry' : 'entries'}
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: BULK SET COMMISSION (EMPLOYEE & POLICY FLOW) */}
          {activeTab === 'BULK_SET' && (
            <div className="bg-white rounded-b-2xl border border-slate-200/80 shadow-2xs p-4 space-y-4 -mt-4">
              <div className="font-bold text-indigo-900 text-xs border-b border-slate-100 pb-2 flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  <DollarSign size={14} className="text-indigo-600" />
                  <span>Bulk Employee Commission Assignment</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Matching Policies:</span>
                  <span className="text-xs font-black text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-md">342</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Employee</label>
                  <select 
                    value={bulkEmployee} 
                    onChange={e => setBulkEmployee(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-semibold text-slate-800"
                  >
                    <option value="All">All Employees</option>
                    {employeesList.map((emp: any) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName || ''} ({emp.designation || 'Advisor'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Company</label>
                  <select 
                    value={bulkCompany}
                    onChange={e => setBulkCompany(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-semibold text-slate-800"
                  >
                    <option>Star Health Insurance</option>
                    <option>HDFC Ergo</option>
                    <option>Niva Bupa</option>
                    <option>ICICI Lombard</option>
                    <option>LIC of India</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Policy Type</label>
                  <select 
                    value={bulkPolicyType}
                    onChange={e => setBulkPolicyType(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-semibold text-slate-800"
                  >
                    <option>Renewal</option>
                    <option>Fresh</option>
                    <option>Port</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-indigo-700 uppercase mb-1">Employee % *</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      step="0.1" 
                      value={bulkEmpRate} 
                      onChange={e => setBulkEmpRate(e.target.value)}
                      className="w-full border border-indigo-200 bg-indigo-50/30 rounded-xl px-2.5 py-1.5 text-right font-bold text-xs pr-6 text-indigo-900" 
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-indigo-500 font-bold text-xs">%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Commission Date</label>
                  <input 
                    type="date" 
                    value={bulkDate} 
                    onChange={e => setBulkDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Agent %</label>
                  <div className="relative">
                    <input type="text" defaultValue="5.00" className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-right font-bold text-xs pr-6" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end border-t border-slate-100 pt-3">
                <button 
                  type="button"
                  onClick={() => toast.success(`Employee commission of ${bulkEmpRate}% applied successfully to 342 matching ${bulkCompany} policies!`)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  Apply to 342 Matching Policies
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: COMMISSION SUMMARY (CARD VIEW GRID) */}
          {activeTab === 'CARD_VIEW' && (
            <div className="bg-white rounded-b-2xl border border-slate-200/80 shadow-2xs p-4 space-y-4 -mt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  {(['Employee', 'Company', 'Tenure', 'BA'] as const).map(tab => (
                    <button 
                      key={tab}
                      onClick={() => setSummaryView(tab)}
                      className={clsx(
                        'px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer',
                        summaryView === tab ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      )}
                    >
                      By {tab}
                    </button>
                  ))}
                </div>
                <span className="text-xs font-bold text-slate-400">
                  {summaryView === 'Employee' ? `${employeeSummaries.length} Employees with Commissions` : 'Company & Product Portfolio'}
                </span>
              </div>

              {/* VIEW 1: BY EMPLOYEE */}
              {summaryView === 'Employee' && (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {employeeSummaries.map((emp, i) => (
                    <div key={i} className="border border-slate-200 rounded-2xl p-3.5 space-y-2 hover:border-indigo-300 transition-colors bg-white shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs shrink-0">
                            {emp.name[0]?.toUpperCase() || 'E'}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 text-xs block truncate">{emp.name}</span>
                            <span className="text-[10px] text-slate-400 block truncate">{emp.designation}</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">
                          {emp.rate}% Rate
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[10px]">
                        <div>
                          <span className="text-slate-400 block">Policies</span>
                          <span className="font-extrabold text-slate-800 text-xs">{emp.policies.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400 block">Commission</span>
                          <span className="font-extrabold text-emerald-600 text-xs">{fmtShort(emp.amount)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* VIEW 2: BY COMPANY */}
              {summaryView === 'Company' && (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {companySummaries.length === 0 ? (
                    <div className="col-span-full py-8 text-center text-slate-400 text-xs">
                      No company commission data available.
                    </div>
                  ) : (
                    companySummaries.map((c, idx) => (
                      <div key={idx} className="border border-slate-200 rounded-2xl p-3.5 space-y-2 hover:border-indigo-300 transition-colors bg-white shadow-2xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-[10px] shrink-0">
                              {c.shortCode}
                            </div>
                            <span className="font-bold text-slate-900 text-xs truncate">{c.name}</span>
                          </div>
                          <ChevronRight size={14} className="text-slate-400 shrink-0" />
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[10px]">
                          <div>
                            <span className="text-slate-400 block">Policies</span>
                            <span className="font-extrabold text-slate-800 text-xs">{c.policies.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-400 block">Est. Commission</span>
                            <span className="font-extrabold text-slate-900 text-xs">{fmtShort(c.amount)}</span>
                          </div>
                        </div>
                        <div className="space-y-1 text-[10px] pt-1">
                          <div className="flex justify-between text-slate-600"><span>Fresh</span><span>{c.freshCount}</span><span className="font-bold">{fmtShort(c.freshAmt)}</span></div>
                          <div className="flex justify-between text-slate-600"><span>Port</span><span>{c.portCount}</span><span className="font-bold">{fmtShort(c.portAmt)}</span></div>
                          <div className="flex justify-between text-slate-600"><span>Renewal</span><span>{c.renewalCount}</span><span className="font-bold">{fmtShort(c.renewalAmt)}</span></div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* VIEW 3: BY TENURE */}
              {summaryView === 'Tenure' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {(() => {
                    const tenureMap: Record<string, { count: number; comm: number }> = {};
                    sortedFiltered.forEach((r: any) => {
                      const tenure = r.policy?.policyTenure || '1 Year Policy';
                      const label = tenure.toLowerCase().includes('year') ? tenure : `${tenure} Year Policy`;
                      if (!tenureMap[label]) tenureMap[label] = { count: 0, comm: 0 };
                      tenureMap[label].count += 1;
                      tenureMap[label].comm += Number(r.amount || 0);
                    });
                    const entries = Object.entries(tenureMap);
                    if (entries.length === 0) {
                      return <div className="col-span-full py-8 text-center text-slate-400 text-xs">No tenure data available.</div>;
                    }
                    return entries.map(([tenure, data], idx) => (
                      <div key={idx} className="border border-slate-200 rounded-2xl p-3.5 space-y-2 bg-white shadow-2xs">
                        <span className="font-bold text-slate-800 text-xs block">{tenure}</span>
                        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[10px]">
                          <div>
                            <span className="text-slate-400 block">Volume</span>
                            <span className="font-extrabold text-slate-800 text-xs">{data.count} {data.count === 1 ? 'Policy' : 'Policies'}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-400 block">Commission</span>
                            <span className="font-extrabold text-indigo-600 text-xs">{fmtShort(data.comm)}</span>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}

              {/* VIEW 4: BY BA */}
              {summaryView === 'BA' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(() => {
                    const baMap: Record<string, { count: number; comm: number; code: string }> = {};
                    sortedFiltered.forEach((r: any, idx: number) => {
                      const name = r.policy?.baName || 'PAT Associate';
                      const code = r.policy?.baCode || `BA-100${idx + 1}`;
                      if (!baMap[name]) baMap[name] = { count: 0, comm: 0, code };
                      baMap[name].count += 1;
                      baMap[name].comm += Number(r.baCommissionAmount || (Number(r.policy?.premiumAmount || 0) * 0.01) || 0);
                    });
                    const entries = Object.entries(baMap);
                    if (entries.length === 0) {
                      return <div className="col-span-full py-8 text-center text-slate-400 text-xs">No BA commission data available.</div>;
                    }
                    return entries.map(([name, data], idx) => (
                      <div key={idx} className="border border-slate-200 rounded-2xl p-3.5 space-y-2 bg-white shadow-2xs">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-800 text-xs">{name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{data.code}</span>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[10px]">
                          <div>
                            <span className="text-slate-400 block">Policies</span>
                            <span className="font-extrabold text-slate-800 text-xs">{data.count} {data.count === 1 ? 'Policy' : 'Policies'}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-400 block">Commission</span>
                            <span className="font-extrabold text-amber-600 text-xs">{fmtShort(data.comm)}</span>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          )}

      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          Add New Commission Modal — Constant Size Tabbed UI
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal 
        open={modalOpen} 
        onClose={closeModal} 
        title="Add New Commission" 
        subtitle="Record employee commission for policy or services" 
        size="2xl"
        actions={
          <button 
            type="submit" 
            form="add-commission-form" 
            className="btn-primary px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" 
            disabled={createCommission.isPending || !selectedPolicy || !selectedEmployee}
          >
            {createCommission.isPending ? 'Publishing…' : 'Publish Commission'}
          </button>
        }
      >
        <form id="add-commission-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 mt-2">
          <input type="hidden" {...register('beneficiaryId')} />
          <input type="hidden" {...register('commissionYearId')} />
          <input type="hidden" {...register('amount')} />

          <div className="space-y-4">
            <div className="bg-slate-50/70 border border-slate-200/80 p-4 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs uppercase tracking-wider">
                  <DollarSign size={15} className="text-indigo-600" />
                  <span>Employee & Policy Commission Flow</span>
                </div>
                {years.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-[11px] font-bold text-slate-400">Financial Year:</span>
                    <select 
                      {...register('commissionYearId')} 
                      className="h-7 text-xs font-bold text-indigo-700 bg-white border border-indigo-200 rounded-lg px-2"
                    >
                      {years.map((y: any) => (
                        <option key={y.id} value={y.id}>{y.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* 1. SELECT EMPLOYEE */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          <Users size={13} className="text-indigo-600" />
                          <span>Select Employee *</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setAddEmployeeModalOpen(true)}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline cursor-pointer"
                        >
                          <UserPlus size={12} />
                          <span>+ Add Employee</span>
                        </button>
                      </div>

                      <input type="hidden" {...register('beneficiaryId')} />

                      {selectedEmployee ? (
                        <div className="flex items-center justify-between px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/60 h-9">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                              {(selectedEmployee.firstName?.[0] || 'E').toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-indigo-950 truncate">
                                {selectedEmployee.firstName} {selectedEmployee.lastName}
                                {selectedEmployee.designation ? ` (${selectedEmployee.designation})` : ''}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleClearEmployee}
                            className="text-indigo-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                            title="Change employee"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="relative">
                          <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          <input
                            type="text"
                            placeholder="Search employee by name, designation..."
                            value={employeeSearch}
                            onChange={(e) => { setEmployeeSearch(e.target.value); setEmployeeDrop(true); }}
                            onFocus={() => setEmployeeDrop(true)}
                            onBlur={() => setTimeout(() => setEmployeeDrop(false), 250)}
                            className="input pl-9 pr-7 h-9 text-xs rounded-xl w-full bg-white border border-slate-200"
                          />
                          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />

                          {employeeDrop && (
                            <ul className="absolute left-0 right-0 z-40 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto text-xs py-1">
                              {employeesLoading ? (
                                <li className="px-3 py-2 text-slate-400">Loading employees...</li>
                              ) : filteredEmployees.length === 0 ? (
                                <li className="px-3 py-2 text-slate-400 flex flex-col items-center gap-1">
                                  <span>No matching employees found</span>
                                  <button
                                    type="button"
                                    onMouseDown={() => { setEmployeeDrop(false); setAddEmployeeModalOpen(true); }}
                                    className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
                                  >
                                    + Add New Employee
                                  </button>
                                </li>
                              ) : (
                                filteredEmployees.map((emp: any) => {
                                  const empName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.user?.email || 'Unnamed Employee';
                                  const designation = emp.designation || emp.user?.role || 'Staff';
                                  return (
                                    <li
                                      key={emp.id}
                                      onMouseDown={() => handleSelectEmployee(emp)}
                                      className="flex items-center justify-between px-3 py-2 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-0"
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                                          {empName[0]?.toUpperCase() || 'E'}
                                        </div>
                                        <div>
                                          <p className="font-bold text-slate-800">{empName}</p>
                                          <p className="text-[10px] text-slate-400">{emp.phone || emp.user?.email || ''}</p>
                                        </div>
                                      </div>
                                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                                        {designation}
                                      </span>
                                    </li>
                                  );
                                })
                              )}
                            </ul>
                          )}
                        </div>
                      )}
                      {errors.beneficiaryId && <p className="text-xs text-rose-500 mt-1">{errors.beneficiaryId.message}</p>}
                    </div>

                    {/* 2. SELECT DATE (DEFAULTED TO TODAY) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          <Calendar size={13} className="text-indigo-600" />
                          <span>Commission Date *</span>
                        </label>
                        <span className="text-[10px] text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded">Defaulted to Today</span>
                      </div>
                      <div className="relative">
                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="date"
                          value={commissionDate}
                          onChange={(e) => setCommissionDate(e.target.value)}
                          className="input pl-9 h-9 text-xs rounded-xl w-full bg-white border border-slate-200 font-semibold text-slate-800"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    {/* 3. POLICY / SERVICES SELECT OR SEARCH */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          <Shield size={13} className="text-indigo-600" />
                          <span>Policy or Service (Search & Select) *</span>
                        </label>
                        {selectedPolicy?.plan?.category && (
                          <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                            {selectedPolicy.plan.category}
                          </span>
                        )}
                      </div>

                      <input type="hidden" {...register('policyId')} />

                      {selectedPolicy ? (
                        <div className="flex items-center justify-between px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/60 h-9">
                          <div className="flex items-center gap-2 min-w-0">
                            <Shield size={14} className="text-indigo-600 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-indigo-950 truncate">
                                {selectedPolicy.plan?.name || 'Policy'}
                                {selectedPolicy.plan?.company?.name ? ` (${selectedPolicy.plan.company.name})` : ''}
                                {selectedPolicy.policyNumber ? ` • ${selectedPolicy.policyNumber}` : ''}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleClearPolicy}
                            className="text-indigo-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                            title="Change policy"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          <input
                            type="text"
                            placeholder="Search policy number, company, plan name..."
                            value={policySearch}
                            onChange={(e) => { setPolicySearch(e.target.value); setPolicyDrop(true); }}
                            onFocus={() => setPolicyDrop(true)}
                            onBlur={() => setTimeout(() => setPolicyDrop(false), 250)}
                            className="input pl-9 pr-7 h-9 text-xs rounded-xl w-full bg-white border border-slate-200"
                          />
                          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />

                          {policyDrop && (
                            <ul className="absolute left-0 right-0 z-40 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto text-xs py-1">
                              {policyLoading ? (
                                <li className="px-3 py-2 text-slate-400">Loading all policies...</li>
                              ) : policyList.length === 0 ? (
                                <li className="px-3 py-2 text-slate-400">No matching policies found</li>
                              ) : (
                                policyList.map((p: any) => {
                                  const compName = p.plan?.company?.name || '';
                                  const planName = p.plan?.name || '';
                                  const custName = p.contact 
                                    ? `${p.contact.firstName || ''} ${p.contact.lastName || ''}`.trim()
                                    : (((p as any).customer?.firstName) ? `${(p as any).customer.firstName} ${(p as any).customer.lastName || ''}`.trim() : '');
                                  return (
                                    <li
                                      key={p.id}
                                      onMouseDown={() => handleSelectPolicy(p)}
                                      className="flex items-center justify-between px-3 py-2 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-0"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <Shield size={14} className="text-indigo-600 shrink-0" />
                                        <div className="min-w-0">
                                          <p className="font-bold text-slate-900 truncate text-xs">
                                            {planName ? `${planName}` : 'Policy'} {compName ? `(${compName})` : ''}
                                          </p>
                                          <p className="text-[10px] text-slate-500 truncate">
                                            Policy No: <span className="font-semibold text-indigo-700">{p.policyNumber}</span>
                                            {custName ? ` • ${custName}` : ''}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="text-right shrink-0 ml-2">
                                        <span className="font-bold text-emerald-600 block text-xs">
                                          ₹{Number(p.premiumAmount || 0).toLocaleString('en-IN')}
                                        </span>
                                      </div>
                                    </li>
                                  );
                                })
                              )}
                            </ul>
                          )}
                        </div>
                      )}
                      {errors.policyId && <p className="text-xs text-rose-500 mt-1">{errors.policyId.message}</p>}
                    </div>

                    {/* 4. SET COMMISSION AMOUNT & RATE */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          <DollarSign size={13} className="text-emerald-600" />
                          <span>Commission Amount (₹) *</span>
                        </label>
                        {selectedPolicy && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            Prem: ₹{Number(selectedPolicy.premiumAmount || 0).toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs pointer-events-none">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Amount (e.g. 5000)"
                            {...register('amount')}
                            onChange={handleAmountChange}
                            className="input pl-7 h-9 text-xs rounded-xl w-full bg-white border border-slate-200 font-bold text-emerald-600"
                          />
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Rate %"
                            {...register('rate')}
                            onChange={handleRateChange}
                            className="input pr-7 h-9 text-xs rounded-xl w-full bg-white border border-slate-200 font-bold text-slate-700"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs pointer-events-none">%</span>
                        </div>
                      </div>
                      {errors.amount && <p className="text-xs text-rose-500 mt-1">{errors.amount.message}</p>}
                    </div>
                  </div>

                  {/* Auto-Fetched Policy Specs (When policy is selected) */}
                  {selectedPolicy && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 p-3 bg-white border border-slate-200/80 rounded-xl text-xs mt-1">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Policy / Plan</span>
                        <span className="font-bold text-indigo-700 truncate block">
                          {selectedPolicy.plan?.name || selectedPolicy.policyNumber || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Company</span>
                        <span className="font-bold text-slate-800 truncate block">{selectedPolicy.plan?.company?.name || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Policy No.</span>
                        <span className="font-bold text-slate-800 truncate block">{selectedPolicy.policyNumber || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Proposer / Client</span>
                        <span className="font-semibold text-slate-700 truncate block">
                          {selectedPolicy.contact ? [selectedPolicy.contact.firstName, selectedPolicy.contact.lastName].filter(Boolean).join(" ") : (((selectedPolicy as any)?.customer) ? [(selectedPolicy as any).customer.firstName, (selectedPolicy as any).customer.lastName].filter(Boolean).join(" ") : '—')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Sum Insured</span>
                        <span className="font-bold text-slate-900 block">₹{Number(selectedPolicy.sumAssured || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Policy Premium</span>
                        <span className="font-extrabold text-emerald-600 block">₹{Number(selectedPolicy.premiumAmount || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Start Date</span>
                        <span className="font-bold text-slate-700 block">
                          {selectedPolicy.startDate ? new Date(selectedPolicy.startDate).toLocaleDateString('en-GB') : 'N/A'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Internal Notes */}
                  <div className="pt-1">
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Commission Notes (Optional)</label>
                    <input
                      type="text"
                      {...register('notes')}
                      placeholder="Add any remarks or payout instructions..."
                      className="input h-9 text-xs rounded-xl w-full bg-white border border-slate-200"
                    />
                  </div>
                </div>
              </div>

          {createCommission.isError && (
            <p className="text-xs text-rose-600 font-bold">{(createCommission.error as any)?.response?.data?.message ?? 'Failed to save commission entry'}</p>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500" defaultChecked />
              <span className="text-xs font-bold text-slate-700">Publish under Workspace "My Commission" Tab</span>
            </label>
          </div>
        </form>
      </Modal>

      {/* ── Quick Add Employee Modal ─────────────────────────────────────────── */}
      <Modal
        open={addEmployeeModalOpen}
        onClose={() => setAddEmployeeModalOpen(false)}
        title="Quick Add Employee"
        subtitle="Create a new employee profile to assign commission"
        size="md"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAddEmployeeModalOpen(false)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={createEmployeeMutation.isPending || !newEmpForm.firstName || !newEmpForm.email || !newEmpForm.phone}
              onClick={() => {
                if (!newEmpForm.firstName || !newEmpForm.email || !newEmpForm.phone) {
                  toast.error('First name, email, and phone number are required');
                  return;
                }
                createEmployeeMutation.mutate({
                  firstName: newEmpForm.firstName,
                  lastName: newEmpForm.lastName || '',
                  email: newEmpForm.email,
                  phone: newEmpForm.phone,
                  designation: newEmpForm.designation,
                  password: newEmpForm.password,
                });
              }}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createEmployeeMutation.isPending ? 'Saving...' : 'Save & Select'}
            </button>
          </div>
        }
      >
        <div className="space-y-3 py-1 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">First Name *</label>
              <input
                type="text"
                value={newEmpForm.firstName}
                onChange={(e) => setNewEmpForm({ ...newEmpForm, firstName: e.target.value })}
                placeholder="e.g. Rahul"
                className="input h-9 text-xs rounded-xl w-full bg-white border border-slate-200"
                required
              />
            </div>
            <div>
              <label className="label">Last Name</label>
              <input
                type="text"
                value={newEmpForm.lastName}
                onChange={(e) => setNewEmpForm({ ...newEmpForm, lastName: e.target.value })}
                placeholder="e.g. Sharma"
                className="input h-9 text-xs rounded-xl w-full bg-white border border-slate-200"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Email Address *</label>
              <input
                type="email"
                value={newEmpForm.email}
                onChange={(e) => setNewEmpForm({ ...newEmpForm, email: e.target.value })}
                placeholder="e.g. rahul@example.com"
                className="input h-9 text-xs rounded-xl w-full bg-white border border-slate-200"
                required
              />
            </div>
            <div>
              <label className="label">Phone Number *</label>
              <input
                type="tel"
                value={newEmpForm.phone}
                onChange={(e) => setNewEmpForm({ ...newEmpForm, phone: e.target.value })}
                placeholder="e.g. 9876543210"
                className="input h-9 text-xs rounded-xl w-full bg-white border border-slate-200"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Designation</label>
              <input
                type="text"
                value={newEmpForm.designation}
                onChange={(e) => setNewEmpForm({ ...newEmpForm, designation: e.target.value })}
                placeholder="e.g. Insurance Advisor"
                className="input h-9 text-xs rounded-xl w-full bg-white border border-slate-200"
              />
            </div>
            <div>
              <label className="label">Initial Password</label>
              <input
                type="password"
                value={newEmpForm.password}
                onChange={(e) => setNewEmpForm({ ...newEmpForm, password: e.target.value })}
                className="input h-9 text-xs rounded-xl w-full bg-white border border-slate-200"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Mark as Paid confirm ─────────────────────────────────────────────── */}
      {payConfirm && (
        <Modal open={!!payConfirm} onClose={() => setPayConfirm(null)} title="Mark as Paid">
          <p className="text-sm text-gray-600 mb-4">
            Mark commission of <span className="font-semibold">₹{Number(payConfirm.amount).toLocaleString('en-IN')}</span> for policy <span className="font-semibold">{payConfirm.policy?.policyNumber}</span> as paid?
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button className="btn-secondary text-xs" onClick={() => setPayConfirm(null)}>Cancel</button>
            <button className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => markPaid.mutate(payConfirm.id)} disabled={markPaid.isPending}>
              {markPaid.isPending ? 'Updating…' : 'Mark as Paid'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Delete Commission confirm ────────────────────────────────────────── */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Commission" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Delete commission of <strong>₹{Number(deleteTarget?.amount ?? 0).toLocaleString('en-IN')}</strong> for policy <strong>{deleteTarget?.policy?.policyNumber}</strong>? This cannot be undone.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button className="btn-secondary text-xs" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button className="btn-danger text-xs" disabled={deleteCommission.isPending} onClick={async () => {
            const isAdmin = authUser?.role === 'SUPERADMIN' || authUser?.role === 'OWNER';
            if (isAdmin) {
              deleteCommission.mutate(deleteTarget!.id);
            } else {
              const toastId = toast.loading('Submitting delete request to admin...');
              try {
                await deletionRequestsService.requestDeletion('Commission', deleteTarget!.id, `Employee requested deletion of commission`);
                toast.success('Deletion request submitted to admin successfully!', { id: toastId });
              } catch (err: any) {
                toast.error(err.response?.data?.message || 'Failed to submit request', { id: toastId });
              }
              setDeleteTarget(null);
            }
          }}>
            {deleteCommission.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>

      {/* ── Selected Policy Details Modal Popup ──────────────────────────────── */}
      <Modal 
        open={!!activePolicy} 
        onClose={() => setActivePolicy(null)} 
        title="Selected Policy Details" 
        subtitle={activePolicy ? `Policy No: ${activePolicy.policyNo}` : undefined}
        size="md"
      >
        {activePolicy && (
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Policy No</span>
                <span className="font-bold text-indigo-600">{activePolicy.policyNo}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Customer Name</span>
                <span className="font-bold text-slate-800">{activePolicy.customerName}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Company</span>
                <span className="font-semibold text-slate-800">{activePolicy.company}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Plan Name</span>
                <span className="font-semibold text-slate-800">{activePolicy.planName}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Policy Type</span>
                <span className="font-semibold text-slate-800">{activePolicy.policyType}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Sum Insured</span>
                <span className="font-extrabold text-slate-900">{activePolicy.sumInsured}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Start Date</span>
                <span className="font-semibold text-slate-800">{activePolicy.startDate}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">End Date</span>
                <span className="font-semibold text-slate-800">{activePolicy.endDate}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Premium</span>
                <span className="font-black text-emerald-600 text-sm">{activePolicy.premium}</span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-200/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Agent Name</span>
                <span className="font-bold text-slate-800">{activePolicy.agent}</span>
              </div>
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-200/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Employee Name</span>
                <span className="font-bold text-slate-800">{activePolicy.employee}</span>
              </div>
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-200/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">BA Name</span>
                <span className="font-bold text-slate-800">{activePolicy.ba}</span>
              </div>
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-200/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Manager Name</span>
                <span className="font-bold text-slate-800">{activePolicy.manager}</span>
              </div>
            </div>

            {/* ── Set Commission % for Selected ────────────────────────── */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div className="font-extrabold text-slate-900 text-xs pb-1">
                Set Commission % for This Policy
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Agent</label>
                  <div className="relative">
                    <input type="text" defaultValue="5.00" className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-right font-bold text-xs pr-6" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Business Associate (BA)</label>
                  <div className="relative">
                    <input type="text" defaultValue="1.00" className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-right font-bold text-xs pr-6" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Employee</label>
                  <div className="relative">
                    <input type="text" defaultValue="2.00" className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-right font-bold text-xs pr-6" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Manager</label>
                  <div className="relative">
                    <input type="text" defaultValue="0.50" className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-right font-bold text-xs pr-6" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
              <button
                type="button"
                className="flex-1 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
                onClick={() => setActivePolicy(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-[2] py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
              >
                Apply Commission %
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Bulk Set Commission Modal Popup ─────────────────────────────────── */}
      <Modal 
        open={bulkModalOpen} 
        onClose={() => setBulkModalOpen(false)} 
        title="Bulk Set Commission" 
        subtitle="Apply commission percentages to all selected policies"
        size="2xl"
        actions={
          <button 
            type="button" 
            onClick={() => {
              toast.success(`Commission percentages applied successfully to ${selectedIds.length} selected policies!`);
              setBulkModalOpen(false);
              setSelectedIds([]);
            }}
            className="btn-primary px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer"
          >
            Apply to Selected ({selectedIds.length})
          </button>
        }
      >
        <div className="h-[400px] overflow-y-auto pr-1 space-y-4 py-1">
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3.5 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] font-bold text-indigo-400 uppercase block">Selected Policies Count</span>
              <span className="font-extrabold text-indigo-900 text-sm">{selectedIds.length} Policies</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-indigo-400 uppercase block">Action Scope</span>
              <span className="font-extrabold text-indigo-900">Bulk Assignment</span>
            </div>
          </div>

          {/* Selected Policies Details List */}
          <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs">
            <div className="bg-slate-50/60 px-4 py-2 border-b border-slate-200 text-slate-800 font-bold text-xs uppercase tracking-wider">
              Selected Policies Details
            </div>
            <div className="max-h-36 overflow-y-auto custom-scrollbar">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-3 py-2">Policy No</th>
                    <th className="px-3 py-2">Customer Name</th>
                    <th className="px-3 py-2">Company / Plan</th>
                    <th className="px-3 py-2 text-right">Premium</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {selectedPoliciesList.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2 font-bold text-indigo-600">{p.policyNumber}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{p.customerName}</td>
                      <td className="px-3 py-2 text-slate-500 font-medium">{p.company} - {p.planName}</td>
                      <td className="px-3 py-2 text-right font-extrabold text-slate-900">{p.premium}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3">
            <div className="font-bold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-200/60 pb-2">
              Set Commission Percentages
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Agent</label>
                <div className="relative">
                  <input type="text" defaultValue="5.00" className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-right font-bold text-xs pr-6" />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Business Associate (BA)</label>
                <div className="relative">
                  <input type="text" defaultValue="1.00" className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-right font-bold text-xs pr-6" />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Employee</label>
                <div className="relative">
                  <input type="text" defaultValue="2.00" className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-right font-bold text-xs pr-6" />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Manager</label>
                <div className="relative">
                  <input type="text" defaultValue="0.50" className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-right font-bold text-xs pr-6" />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-4 border-t border-slate-200 justify-end">
          <button
            type="button"
            className="py-2 px-5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
            onClick={() => setBulkModalOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              toast.success(`Commission percentages applied successfully to ${selectedIds.length} selected policies!`);
              setBulkModalOpen(false);
              setSelectedIds([]);
            }}
            className="py-2 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
          >
            Apply Commission %
          </button>
        </div>
      </Modal>

    </div>
  );
}

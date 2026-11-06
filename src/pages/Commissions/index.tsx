import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, FileText, User, Trash2, Search, TrendingUp, CheckCircle, Clock, DollarSign, 
  Shield, Calendar, ChevronUp, ChevronDown, Filter, RefreshCw, Eye, CheckSquare, 
  Square, PieChart, Users, Award, ChevronRight, Download, SlidersHorizontal, Info,
  UserPlus, X, Save, Send, LayoutGrid, List, MessageSquare, Mail, Phone
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commissionsService, policiesService, employeesService, contactsService, claimsService, documentsService } from '@api/index';
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
  policyId?: string;
  notes?: string;
  baseCommissionRate?: number;
  baseCommissionAmount?: number;
  policy?: { 
    id?: string;
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
  policyId:         z.string().optional(),
  beneficiaryId:    z.string().optional(),
  commissionYearId: z.string().optional(),
  amount:           z.coerce.number().min(0).optional(),
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
  const [payReceiptFile, setPayReceiptFile] = useState<File | null>(null);
  const [paySendReceipt, setPaySendReceipt] = useState(false);
  const [payRemark, setPayRemark] = useState('');
  const qc = useQueryClient();

  // Table-matching Filter State for top filter bar
  const [startDate, setStartDate]                     = useState('');
  const [endDate, setEndDate]                         = useState('');
  const [filterEmployee, setFilterEmployee]           = useState('All');
  const [filterProposer, setFilterProposer]           = useState('');
  const [filterPolicyPlan, setFilterPolicyPlan]       = useState('All');
  const [filterCompany, setFilterCompany]             = useState('All');
  const [filterMinAmount, setFilterMinAmount]         = useState('');
  const [filterMaxAmount, setFilterMaxAmount]         = useState('');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('All');

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
  const [summaryView, setSummaryView] = useState<'Company' | 'Tenure' | 'Employee' | 'BA'>('Employee');
  const [summaryEmployeeFilter, setSummaryEmployeeFilter] = useState<string>('ALL');
  const [summaryStatusFilter, setSummaryStatusFilter] = useState<'ALL' | 'PAID' | 'UNPAID'>('ALL');

  // Filter panel collapse state (Hidden by default, shown when Filter button is clicked)
  const [showFilter, setShowFilter] = useState(false);

  // Active Tab state for section switching
  const [activeTab, setActiveTab] = useState<'WITHOUT_COMMISSION' | 'BULK_SET' | 'CARD_VIEW'>('WITHOUT_COMMISSION');

  // Employee search & select states
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeDrop, setEmployeeDrop] = useState(false);
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
  // Policy & Employee selection states (1 Policy/Service to multiple Employees)
  const [policySearch, setPolicySearch]     = useState('');
  const [selectedPolicy, setSelectedPolicy] = useState<{
    id: string;
    item: any;
    effectivePolicyId: string;
    itemType: 'POLICY' | 'CLAIM';
    title: string;
    companyName: string;
    policyNumber: string;
    claimNumber?: string;
    proposerName: string;
    baseAmount: number;
    status?: string;
  } | null>(null);
  const [selectedEmployeesList, setSelectedEmployeesList] = useState<{
    id: string;
    employee: any;
    name: string;
    phone?: string;
    email?: string;
    designation: string;
    baseAmount: number;
    rate: number;
    commissionAmount: number;
    beneficiaryId: string;
  }[]>([]);
  const [commonRate, setCommonRate]         = useState<number>(15);
  const [commonAmount, setCommonAmount]     = useState<number>(0);
  const [selectedMainIds, setSelectedMainIds] = useState<string[]>([]);
  const [policyDrop, setPolicyDrop]         = useState(false);

  // Commission Entries tab: list panel search, tab, view mode, status filter & pagination
  const [listPanelSearch, setListPanelSearch] = useState('');
  const [listPanelTab, setListPanelTab] = useState<'POLICIES' | 'CLAIMS'>('POLICIES');
  const [commissionStatusFilter, setCommissionStatusFilter] = useState<'ALL' | 'NOT_ADDED' | 'ADDED'>('ALL');
  const [panelViewMode, setPanelViewMode] = useState<'GRID' | 'TABLE'>('TABLE');
  const [panelPage, setPanelPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['commissions', page],
    queryFn:  () => commissionsService.list({ page, limit: 20 }),
  });
  const allRows: Commission[] = data?.data ?? [];

  // Full commissions lookup for identifying which policies/claims have commissions and their payment statuses
  const { data: allCommissionsData } = useQuery({
    queryKey: ['all-commissions-lookup'],
    queryFn:  () => commissionsService.list({ limit: 1000 }),
    staleTime: 30 * 1000,
  });
  const allCommissionsList: any[] = allCommissionsData?.data ?? [];

  const [selectedEmployeeSummary, setSelectedEmployeeSummary] = useState<any | null>(null);
  const [summaryModalStatusFilter, setSummaryModalStatusFilter] = useState<'ALL' | 'PAID' | 'UNPAID'>('ALL');

  const existingDistributedForSelected = useMemo(() => {
    if (!selectedPolicy) return [];
    const isClaim = selectedPolicy.itemType === 'CLAIM';
    if (isClaim) {
      return allCommissionsList.filter((c: any) => {
        const claimMatch = c.notes?.match(/\[Claim:\s*([^\]]+)\]/i);
        const claimNum = claimMatch ? claimMatch[1].trim() : '';
        if (selectedPolicy.claimNumber && claimNum && claimNum.toLowerCase() === String(selectedPolicy.claimNumber).toLowerCase()) return true;
        if (selectedPolicy.item?.id && claimNum && claimNum === selectedPolicy.item.id) return true;
        const effectivePolicyId = selectedPolicy.effectivePolicyId;
        return effectivePolicyId && c.policyId === effectivePolicyId && Boolean(claimNum);
      });
    } else {
      return allCommissionsList.filter((c: any) => {
        const isClaimComm = c.notes?.match(/\[Claim:\s*([^\]]+)\]/i);
        return c.policyId === (selectedPolicy.effectivePolicyId || selectedPolicy.item?.id) && !isClaimComm;
      });
    }
  }, [selectedPolicy, allCommissionsList]);

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
    queryFn:  () => employeesService.list({ page: 1, limit: 500 }),
    staleTime: 60 * 1000,
  });
  const { data: policyResults, isLoading: policyLoading } = useQuery({
    queryKey: ['policy-search-comm', policySearch],
    queryFn:  () => policiesService.list({ 
      search: policySearch, 
      limit: 500 
    }),
    enabled:  modalOpen,
  });
  const { data: claimsResults, isLoading: claimsLoading } = useQuery({
    queryKey: ['claims-search-comm', policySearch],
    queryFn:  () => claimsService.list({ 
      search: policySearch, 
      limit: 500 
    }),
    enabled:  modalOpen,
  });

  // Always-loaded policies & claims for the Commission Entries list panel
  const { data: allPoliciesData, isLoading: allPoliciesLoading } = useQuery({
    queryKey: ['all-policies-for-commission-panel', listPanelSearch],
    queryFn:  () => policiesService.list({ search: listPanelSearch, limit: 500 }),
    staleTime: 30 * 1000,
  });
  const { data: allClaimsData, isLoading: allClaimsLoading } = useQuery({
    queryKey: ['all-claims-for-commission-panel', listPanelSearch],
    queryFn:  () => claimsService.list({ search: listPanelSearch, limit: 500 }),
    staleTime: 30 * 1000,
  });

  const [publishToWorkspace, setPublishToWorkspace] = useState(false);
  const [submitType, setSubmitType] = useState<'save' | 'publish'>('save');

  const employeesList: any[] = useMemo(() => {
    const raw = employeesData?.data ?? employeesData ?? [];
    const list: any[] = Array.isArray(raw) ? [...raw] : [];

    // Also include any employees from existing commissions if not already in list
    const existingIds = new Set(list.map((e: any) => e.userId || e.id || e.user?.id));
    allRows.forEach((r: any) => {
      const uId = r.beneficiaryId || r.beneficiary?.id;
      if (uId && !existingIds.has(uId)) {
        existingIds.add(uId);
        const p = r.beneficiary?.employeeProfile;
        list.push({
          id: p?.id || uId,
          userId: uId,
          firstName: p?.firstName || 'Employee',
          lastName: p?.lastName || '',
          designation: p?.designation || 'Insurance Advisor',
          phone: p?.phone || '',
          user: { id: uId, email: r.beneficiary?.email || '', role: 'EMPLOYEE' },
        });
      }
    });

    return list;
  }, [employeesData, allRows]);

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
    const rawPolicies = policyResults?.data ?? policyResults ?? [];
    const polList: any[] = (Array.isArray(rawPolicies) ? rawPolicies : []).map((p: any) => ({
      ...p,
      _itemType: 'POLICY' as const,
    }));

    const rawClaims = claimsResults?.data ?? claimsResults ?? [];
    const clmList: any[] = (Array.isArray(rawClaims) ? rawClaims : []).map((c: any) => ({
      ...c,
      _itemType: 'CLAIM' as const,
    }));

    const combined = [...polList, ...clmList];
    if (!policySearch.trim()) return combined;
    const q = policySearch.toLowerCase().trim();
    return combined.filter((item: any) => {
      if (item._itemType === 'CLAIM') {
        const cNum = String(item.claimNumber || '').toLowerCase();
        const cType = String(item.claimType || '').toLowerCase();
        const cStatus = String(item.status || '').toLowerCase();
        const pNum = String(item.policy?.policyNumber || '').toLowerCase();
        const planN = String(item.policy?.plan?.name || '').toLowerCase();
        const compN = String(item.policy?.plan?.company?.name || '').toLowerCase();
        const custN = `${item.contact?.firstName || ''} ${item.contact?.lastName || ''}`.toLowerCase();
        return cNum.includes(q) || cType.includes(q) || cStatus.includes(q) || pNum.includes(q) || planN.includes(q) || compN.includes(q) || custN.includes(q);
      } else {
        const pNum = String(item.policyNumber || '').toLowerCase();
        const planN = String(item.plan?.name || '').toLowerCase();
        const compN = String(item.plan?.company?.name || '').toLowerCase();
        const catN = String(item.plan?.category || '').toLowerCase();
        const custN = `${item.contact?.firstName || ''} ${item.contact?.lastName || ''}`.toLowerCase();
        return pNum.includes(q) || planN.includes(q) || compN.includes(q) || catN.includes(q) || custN.includes(q);
      }
    });
  }, [policyResults, claimsResults, policySearch]);

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
    const isClaim = p._itemType === 'CLAIM';
    const effectivePolicyId = isClaim ? (p.policyId || p.policy?.id || p.id) : p.id;
    const uniqueKey = `${isClaim ? 'claim' : 'policy'}-${p.id}`;

    const prem = isClaim
      ? Number(p.policy?.premiumAmount || p.claimAmount || p.approvedAmount || 0)
      : Number(p.premiumAmount || 0);

    const title = isClaim
      ? (p.claimNumber ? `Claim #${p.claimNumber}` : 'Claim')
      : (p.plan?.name || 'Insurance Policy');
    
    const compName = isClaim
      ? (p.policy?.plan?.company?.name || p.plan?.company?.name || '')
      : (p.plan?.company?.name || '');

    const pNum = isClaim
      ? (p.policy?.policyNumber || p.policyNumber || '')
      : (p.policyNumber || '');

    const proposer = p.contact
      ? `${p.contact.firstName || ''} ${p.contact.lastName || ''}`.trim()
      : (((p as any).customer?.firstName) ? `${(p as any).customer.firstName} ${(p as any).customer.lastName || ''}`.trim() : '');

    const newPol = {
      id: uniqueKey,
      item: p,
      effectivePolicyId,
      itemType: (isClaim ? 'CLAIM' : 'POLICY') as 'CLAIM' | 'POLICY',
      title,
      companyName: compName,
      policyNumber: pNum,
      claimNumber: isClaim ? p.claimNumber : undefined,
      proposerName: proposer,
      baseAmount: prem,
      status: p.status || (isClaim ? 'Claim' : 'Active'),
    };

    setSelectedPolicy(newPol);
    setValue('policyId', effectivePolicyId, { shouldValidate: true });
    setValue('basePremium', prem);

    // Update base amount and recalculate commissions for currently selected employees
    setSelectedEmployeesList(prev => {
      const updated = prev.map(emp => {
        const amt = Math.round(prem * (emp.rate / 100));
        return { ...emp, baseAmount: prem, commissionAmount: amt };
      });
      const totalAmt = updated.reduce((acc, curr) => acc + curr.commissionAmount, 0);
      setValue('amount', totalAmt, { shouldValidate: true });
      setValue('baseCommissionAmount', totalAmt);
      return updated;
    });

    // Auto-add assigned employee if employees list is empty
    const targetEmpId = p.assignedEmployeeId || p.assignedEmployee?.id || p.policy?.assignedEmployeeId;
    if (targetEmpId) {
      const found = employeesList.find((e: any) =>
        e.id === targetEmpId || e.userId === targetEmpId || e.user?.id === targetEmpId
      );
      if (found) {
        handleAddEmployee(found, newPol);
      } else if (p.assignedEmployee) {
        handleAddEmployee(p.assignedEmployee, newPol);
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
    setSelectedEmployeesList(prev => {
      const updated = prev.map(emp => ({ ...emp, baseAmount: 0, commissionAmount: 0 }));
      setValue('amount', 0, { shouldValidate: true });
      setValue('baseCommissionAmount', 0);
      return updated;
    });
  };

  const handleAddEmployee = (emp: any, currentPolicy?: any) => {
    const empId = emp.id || emp.userId || emp.user?.id;
    const beneficiaryId = getEmployeeUserId(emp);
    const empName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.user?.email || 'Unnamed Employee';
    const designation = emp.designation || emp.user?.role || 'Staff';
    const pol = currentPolicy || selectedPolicy;
    const base = Number(pol?.baseAmount || 0);
    const commAmt = commonAmount > 0 ? commonAmount : (commonRate ? Math.round(base * (commonRate / 100)) : 0);
    const rate = base > 0 ? Number(((commAmt / base) * 100).toFixed(2)) : (commonRate || 0);

    setSelectedEmployeesList(prev => {
      if (prev.some(x => x.id === empId || x.beneficiaryId === beneficiaryId)) {
        toast('Employee already added to selected list', { icon: 'ℹ️' });
        return prev;
      }
      const newEmp = {
        id: empId,
        employee: emp,
        name: empName,
        phone: emp.phone || emp.user?.phone || '',
        email: emp.email || emp.user?.email || '',
        designation,
        baseAmount: base,
        rate,
        commissionAmount: commAmt,
        beneficiaryId,
      };
      const updated = [...prev, newEmp];
      const totalAmt = updated.reduce((acc, curr) => acc + curr.commissionAmount, 0);
      setValue('amount', totalAmt, { shouldValidate: true });
      setValue('baseCommissionAmount', totalAmt);
      return updated;
    });

    setEmployeeDrop(false);
    setEmployeeSearch('');
  };

  const handleRemoveEmployeeItem = (idToRemove: string) => {
    setSelectedEmployeesList(prev => {
      const updated = prev.filter(x => x.id !== idToRemove && x.beneficiaryId !== idToRemove);
      const totalAmt = updated.reduce((acc, curr) => acc + curr.commissionAmount, 0);
      setValue('amount', totalAmt, { shouldValidate: true });
      setValue('baseCommissionAmount', totalAmt);
      return updated;
    });
  };

  const handleEmployeeRateChange = (empId: string, newRate: number) => {
    setSelectedEmployeesList(prev => {
      const updated = prev.map(emp => {
        if (emp.id !== empId && emp.beneficiaryId !== empId) return emp;
        const amt = Math.round(emp.baseAmount * (newRate / 100));
        return { ...emp, rate: newRate, commissionAmount: amt };
      });
      const totalAmt = updated.reduce((acc, curr) => acc + curr.commissionAmount, 0);
      setValue('amount', totalAmt, { shouldValidate: true });
      setValue('baseCommissionAmount', totalAmt);
      return updated;
    });
  };

  const handleEmployeeAmountChange = (empId: string, newAmt: number) => {
    setSelectedEmployeesList(prev => {
      const updated = prev.map(emp => {
        if (emp.id !== empId && emp.beneficiaryId !== empId) return emp;
        const rate = emp.baseAmount > 0 ? Number(((newAmt / emp.baseAmount) * 100).toFixed(2)) : emp.rate;
        return { ...emp, commissionAmount: newAmt, rate };
      });
      const totalAmt = updated.reduce((acc, curr) => acc + curr.commissionAmount, 0);
      setValue('amount', totalAmt, { shouldValidate: true });
      setValue('baseCommissionAmount', totalAmt);
      return updated;
    });
  };

  const handleApplyCommonRate = (rate: number) => {
    setCommonRate(rate);
    setSelectedEmployeesList(prev => {
      const updated = prev.map(emp => {
        const amt = Math.round(emp.baseAmount * (rate / 100));
        return { ...emp, rate, commissionAmount: amt };
      });
      const totalAmt = updated.reduce((acc, curr) => acc + curr.commissionAmount, 0);
      setValue('amount', totalAmt, { shouldValidate: true });
      setValue('baseCommissionAmount', totalAmt);
      return updated;
    });
  };

  const handleApplyCommonAmount = (amt: number) => {
    setCommonAmount(amt);
    setSelectedEmployeesList(prev => {
      const updated = prev.map(emp => {
        const rate = emp.baseAmount > 0 ? Number(((amt / emp.baseAmount) * 100).toFixed(2)) : 0;
        return { ...emp, rate, commissionAmount: amt };
      });
      const totalAmt = updated.reduce((acc, curr) => acc + curr.commissionAmount, 0);
      setValue('amount', totalAmt, { shouldValidate: true });
      setValue('baseCommissionAmount', totalAmt);
      return updated;
    });
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value) || 0;
    setValue('amount', val, { shouldValidate: true });
    setValue('baseCommissionAmount', val);
    const prem = Number(w.basePremium || selectedPolicy?.baseAmount || 0);
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
    const prem = Number(w.basePremium || selectedPolicy?.baseAmount || 0);
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
    mutationFn: (body: any) => commissionsService.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commissions'] });
      qc.invalidateQueries({ queryKey: ['commissions', 'overview'] });
      qc.invalidateQueries({ queryKey: ['my-commissions'] });
    },
  });
  const markPaid = useMutation({
    mutationFn: async (arg: string | { id: string; remark?: string }) => {
      const id = typeof arg === 'string' ? arg : arg.id;
      const remark = typeof arg === 'string' ? undefined : arg.remark;
      let finalRemark = remark?.trim() || '';
      const targetPolicyId = (payConfirm as any)?.policyId || payConfirm?.policy?.id;
      if (payReceiptFile && targetPolicyId) {
        try {
          await documentsService.upload(payReceiptFile, {
            policyId: targetPolicyId,
            type: 'OTHER',
            title: `Commission Payment Receipt - ${payConfirm?.policy?.policyNumber || ''}`,
          });
          finalRemark = finalRemark ? `${finalRemark} [Receipt: ${payReceiptFile.name}]` : `[Receipt: ${payReceiptFile.name}]`;
        } catch (uploadErr) {
          console.error('Failed to upload receipt:', uploadErr);
        }
      }
      return commissionsService.markPaid(id, { remark: finalRemark });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commissions'] });
      qc.invalidateQueries({ queryKey: ['commissions', 'overview'] });
      qc.invalidateQueries({ queryKey: ['my-commissions'] });
      toast.success('Commission marked as paid');
      setPayConfirm(null);
      setPayRemark('');
      setPayReceiptFile(null);
      setPaySendReceipt(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Error updating commission payment'),
  });
  const deleteCommission = useMutation({
    mutationFn: (id: string) => commissionsService.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['commissions'] }); toast.success('Commission deleted'); setDeleteTarget(null); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Error deleting commission'),
  });

  const totals = summary?.data ?? {};
  const years: any[] = yearsData?.data ?? [];

  // Auto-sync years to form values (default to current active year)
  useEffect(() => {
    if (years.length > 0) {
      const activeYear = years.find((y: any) => y.isActive) || years.find((y: any) => y.name?.includes('2026')) || years[0];
      if (activeYear) {
        setValue('commissionYearId', activeYear.id);
      }
    }
  }, [years, setValue]);

  const handleFormSubmit = async (formData: Form, mode?: 'save' | 'publish') => {
    const finalMode = mode || submitType;

    if (!selectedPolicy) {
      toast.error('Please select a policy or service (claim)');
      return;
    }

    if (selectedEmployeesList.length === 0) {
      toast.error('Please select at least one employee');
      return;
    }

    let yearId = formData.commissionYearId;
    if (!yearId) {
      if (years.length > 0) {
        const activeYear = years.find((y: any) => y.isActive) || years.find((y: any) => y.name?.includes('2026')) || years[0];
        yearId = activeYear ? activeYear.id : years[0].id;
      } else {
        toast.error('Please select or create a commission year');
        return;
      }
    }

    const isPublish = finalMode === 'publish' || publishToWorkspace;
    const formattedDateNote = `Commission Date: ${format(new Date(), 'yyyy-MM-dd')}`;
    const publishTag = isPublish ? `[Published to Workspace]` : `[Saved as Draft]`;
    const claimTag = selectedPolicy.itemType === 'CLAIM' ? `[Claim: ${selectedPolicy.claimNumber || selectedPolicy.item?.claimNumber || ''}]` : '';

    try {
      let count = 0;
      for (const emp of selectedEmployeesList) {
        const noteParts = [formattedDateNote, claimTag, publishTag, formData.notes].filter(Boolean);
        const combinedNotes = noteParts.join(' ');

        await createCommission.mutateAsync({
          policyId: selectedPolicy.effectivePolicyId,
          beneficiaryId: emp.beneficiaryId,
          commissionYearId: yearId,
          amount: Number(emp.commissionAmount || 0),
          rate: Number(emp.rate || 0),
          basePremium: Number(emp.baseAmount || 0),
          baseCommissionRate: Number(emp.rate || 0),
          baseCommissionAmount: Number(emp.commissionAmount || 0),
          notes: combinedNotes,
        });
        count++;
      }

      qc.invalidateQueries({ queryKey: ['commissions'] });
      qc.invalidateQueries({ queryKey: ['commissions', 'overview'] });
      qc.invalidateQueries({ queryKey: ['my-commissions'] });
      qc.invalidateQueries({ queryKey: ['all-commissions-lookup'] });
      qc.invalidateQueries({ queryKey: ['all-policies-for-commission-panel'] });
      qc.invalidateQueries({ queryKey: ['all-claims-for-commission-panel'] });

      const polIdentifier = selectedPolicy.policyNumber ? `#${selectedPolicy.policyNumber}` : selectedPolicy.title;
      toast.success(
        isPublish
          ? `Commissions for ${count} employee(s) published under ${polIdentifier} successfully!`
          : `Commissions for ${count} employee(s) saved as draft under ${polIdentifier} successfully!`
      );
      closeModal();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || (isPublish ? 'Failed to publish commission entry' : 'Failed to save commission entry'));
    }
  };

  const closeModal = () => {
    setModalOpen(false); 
    reset();
    setSelectedPolicy(null);
    setPolicySearch('');
    setPolicyDrop(false);
    setSelectedEmployeesList([]);
    setEmployeeSearch('');
    setEmployeeDrop(false);
    setSelectedEmployee(null);
    setNewYearInput(false);
    setPublishToWorkspace(false);
    setSubmitType('save');
  };

  const availableEmployees = useMemo(() => {
    const names = new Set<string>();
    allRows.forEach((r: any) => {
      const name = r.beneficiary?.employeeProfile
        ? `${r.beneficiary.employeeProfile.firstName || ''} ${r.beneficiary.employeeProfile.lastName || ''}`.trim()
        : '';
      if (name) names.add(name);
    });
    employeesList.forEach((e: any) => {
      const name = `${e.firstName || ''} ${e.lastName || ''}`.trim();
      if (name) names.add(name);
    });
    return Array.from(names).sort();
  }, [allRows, employeesList]);

  const availablePlans = useMemo(() => {
    const set = new Set<string>();
    allRows.forEach((r: any) => {
      const plan = r.policy?.plan?.name;
      if (plan) set.add(plan);
    });
    return Array.from(set).sort();
  }, [allRows]);

  const availableCompanies = useMemo(() => {
    const set = new Set<string>();
    allRows.forEach((r: any) => {
      const comp = r.policy?.plan?.company?.name;
      if (comp) set.add(comp);
    });
    return Array.from(set).sort();
  }, [allRows]);

  const filtered = useMemo(() => {
    return allRows.filter((r: any) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesSearch =
          r.policy?.policyNumber?.toLowerCase().includes(q) ||
          r.policy?.plan?.name?.toLowerCase().includes(q) ||
          r.policy?.plan?.company?.name?.toLowerCase().includes(q) ||
          r.notes?.toLowerCase().includes(q) ||
          `${r.beneficiary?.employeeProfile?.firstName ?? ''} ${r.beneficiary?.employeeProfile?.lastName ?? ''}`.toLowerCase().includes(q) ||
          `${r.policy?.contact?.firstName ?? ''} ${r.policy?.contact?.lastName ?? ''}`.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      const rDate = r.paidAt || r.createdAt;
      if (startDate && rDate) {
        if (new Date(rDate) < new Date(startDate)) return false;
      }
      if (endDate && rDate) {
        if (new Date(rDate) > new Date(endDate + 'T23:59:59')) return false;
      }
      if (filterEmployee && filterEmployee !== 'All') {
        const empName = r.beneficiary?.employeeProfile
          ? `${r.beneficiary.employeeProfile.firstName || ''} ${r.beneficiary.employeeProfile.lastName || ''}`.trim()
          : (r.beneficiary?.name || '');
        if (empName.toLowerCase() !== filterEmployee.toLowerCase()) return false;
      }
      if (filterProposer.trim()) {
        const qProp = filterProposer.toLowerCase().trim();
        const propName = r.policy?.contact
          ? `${r.policy.contact.firstName || ''} ${r.policy.contact.lastName || ''}`.trim()
          : (((r.policy as any)?.customer) ? `${(r.policy as any).customer.firstName || ''} ${(r.policy as any).customer.lastName || ''}`.trim() : (r.customerName || ''));
        if (!propName.toLowerCase().includes(qProp)) return false;
      }
      if (filterPolicyPlan && filterPolicyPlan !== 'All') {
        const plan = r.policy?.plan?.name || '';
        const polNo = r.policy?.policyNumber || '';
        const claimMatch = r.notes?.match(/\[Claim:\s*([^\]]+)\]/i);
        const claimNum = claimMatch ? claimMatch[1].trim() : '';
        if (filterPolicyPlan === 'POLICIES_ONLY') {
          if (claimNum) return false;
        } else if (filterPolicyPlan === 'CLAIMS_ONLY') {
          if (!claimNum) return false;
        } else {
          const target = filterPolicyPlan.toLowerCase();
          const matches =
            plan.toLowerCase() === target ||
            polNo.toLowerCase() === target ||
            claimNum.toLowerCase() === target;
          if (!matches) return false;
        }
      }
      if (filterCompany && filterCompany !== 'All') {
        const comp = r.policy?.plan?.company?.name || '';
        if (comp.toLowerCase() !== filterCompany.toLowerCase()) return false;
      }
      const amt = Number(r.amount || 0);
      if (filterMinAmount !== '' && !isNaN(Number(filterMinAmount))) {
        if (amt < Number(filterMinAmount)) return false;
      }
      if (filterMaxAmount !== '' && !isNaN(Number(filterMaxAmount))) {
        if (amt > Number(filterMaxAmount)) return false;
      }
      if (filterPaymentStatus && filterPaymentStatus !== 'All') {
        if (filterPaymentStatus === 'Paid' && !r.isPaid) return false;
        if (filterPaymentStatus === 'Unpaid' && r.isPaid) return false;
      }
      return true;
    });
  }, [allRows, search, startDate, endDate, filterEmployee, filterProposer, filterPolicyPlan, filterCompany, filterMinAmount, filterMaxAmount, filterPaymentStatus]);
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
  const liveTotalPremium = useMemo(() => {
    const total = sortedFiltered.reduce((acc, r: any) => acc + (Number(r.policy?.premiumAmount) || 0), 0);
    return fmtShort(total);
  }, [sortedFiltered]);

  const liveTotalCommission = useMemo(() => {
    const total = sortedFiltered.reduce((acc, r: any) => acc + (Number(r.amount) || 0), 0);
    return total > 0 ? fmtShort(total) : fmtShort(Number(totals?.totalAmount) || 0);
  }, [sortedFiltered, totals]);

  const livePaidCommission = useMemo(() => {
    const total = sortedFiltered
      .filter((r: any) => r.isPaid)
      .reduce((acc, r: any) => acc + (Number(r.amount) || 0), 0);
    return total > 0 ? fmtShort(total) : fmtShort(Number(totals?.paidAmount) || 0);
  }, [sortedFiltered, totals]);

  const livePendingCommission = useMemo(() => {
    const total = sortedFiltered
      .filter((r: any) => !r.isPaid)
      .reduce((acc, r: any) => acc + (Number(r.amount) || 0), 0);
    return total > 0 ? fmtShort(total) : fmtShort(Number(totals?.pendingAmount) || 0);
  }, [sortedFiltered, totals]);

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

  const bulkModalPoliciesList = useMemo(() => {
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

  const summaryRows = useMemo(() => {
    if (summaryEmployeeFilter === 'ALL') return sortedFiltered;
    return sortedFiltered.filter((r: any) => {
      const empName = `${r.beneficiary?.employeeProfile?.firstName || ''} ${r.beneficiary?.employeeProfile?.lastName || ''}`.trim() || ((r.beneficiary as any)?.email || '');
      return empName === summaryEmployeeFilter;
    });
  }, [sortedFiltered, summaryEmployeeFilter]);

  const displayedSummaryRows = useMemo(() => {
    return summaryRows.filter((r: any) => {
      if (summaryStatusFilter === 'PAID') return r.isPaid;
      if (summaryStatusFilter === 'UNPAID') return !r.isPaid;
      return true;
    });
  }, [summaryRows, summaryStatusFilter]);

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

    const renderCommissionTable = (isFullWidth = false) => {
    return (
      <div className="space-y-3">
        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Employee:</span>
              <select
                value={summaryEmployeeFilter}
                onChange={(e) => setSummaryEmployeeFilter(e.target.value)}
                className="h-8 text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2.5 text-slate-800 shadow-2xs focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">All Employees ({sortedFiltered.length})</option>
                {employeeSummaries.map((emp, i) => (
                  <option key={i} value={emp.name}>{emp.name} ({emp.policies})</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Payment Status:</span>
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 text-xs shadow-2xs">
                <button
                  type="button"
                  onClick={() => setSummaryStatusFilter('ALL')}
                  className={clsx(
                    "px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer",
                    summaryStatusFilter === 'ALL' ? "bg-indigo-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  All ({summaryRows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSummaryStatusFilter('PAID')}
                  className={clsx(
                    "px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer",
                    summaryStatusFilter === 'PAID' ? "bg-emerald-600 text-white shadow-2xs" : "text-slate-600 hover:text-emerald-700"
                  )}
                >
                  Paid ({summaryRows.filter((r: any) => r.isPaid).length})
                </button>
                <button
                  type="button"
                  onClick={() => setSummaryStatusFilter('UNPAID')}
                  className={clsx(
                    "px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer",
                    summaryStatusFilter === 'UNPAID' ? "bg-rose-600 text-white shadow-2xs" : "text-slate-600 hover:text-rose-700"
                  )}
                >
                  Unpaid ({summaryRows.filter((r: any) => !r.isPaid).length})
                </button>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-500 font-semibold">
            Showing <span className="font-bold text-slate-900">{displayedSummaryRows.length}</span> of {sortedFiltered.length} entries
          </div>
        </div>

        {/* Summary Table in Rows */}
        <div className="overflow-x-auto rounded-xl border border-slate-200/90 shadow-2xs">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="px-3 py-2.5 text-center w-12 border-r border-slate-200">SR. NO.</th>
                <th className="px-3 py-2.5 border-r border-slate-200">EMPLOYEE NAME</th>
                <th className="px-3 py-2.5 border-r border-slate-200">PROPOSER NAME</th>
                <th className="px-3 py-2.5 border-r border-slate-200">POLICY / PLAN</th>
                <th className="px-3 py-2.5 border-r border-slate-200 text-right">COMMISSION AMOUNT</th>
                <th className="px-3 py-2.5 border-r border-slate-200 text-center">PAID / UNPAID STATUS</th>
                <th className="px-3 py-2.5 text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
              {displayedSummaryRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-xs">
                    No commission summary records found matching the current filters.
                  </td>
                </tr>
              ) : (
                displayedSummaryRows.map((row: any, idx: number) => {
                  const empName = row.beneficiary?.employeeProfile 
                    ? `${row.beneficiary.employeeProfile.firstName || ''} ${row.beneficiary.employeeProfile.lastName || ''}`.trim()
                    : ((row.beneficiary as any)?.email || 'Employee');
                  const empDesig = (row.beneficiary?.employeeProfile as any)?.designation || 'Advisor';
                  
                  const proposerName = row.policy?.contact 
                    ? `${row.policy.contact.firstName || ''} ${row.policy.contact.lastName || ''}`.trim()
                    : (((row.policy as any)?.customer?.firstName) 
                      ? `${(row.policy as any).customer.firstName} ${(row.policy as any).customer.lastName || ''}`.trim() 
                      : '—');
                  
                  const policyNo = row.policy?.policyNumber || '—';
                  const planName = row.policy?.plan?.name || '';
                  const compName = row.policy?.plan?.company?.name || '';
                  const commAmt = Number(row.amount || 0);
                  const isPaid = Boolean(row.isPaid);

                  return (
                    <tr 
                      key={row.id || idx} 
                      className="hover:bg-indigo-50/50 transition-colors cursor-pointer group"
                      onClick={() => setSelectedEmployeeSummary(row)}
                      title="Click to view full employee commission summary"
                    >
                      <td className="px-3 py-2.5 text-center font-medium border-r border-slate-100 text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2.5 border-r border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {empName[0]?.toUpperCase() || 'E'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">{empName}</p>
                            <p className="text-[10px] text-slate-400 truncate">{empDesig}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 border-r border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <User size={13} className="text-slate-400 shrink-0" />
                          <span className="font-bold text-slate-800">{proposerName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 border-r border-slate-100">
                        {(() => {
                          const claimMatch = row.notes?.match(/\[Claim:\s*([^\]]+)\]/i);
                          const claimNumber = claimMatch ? claimMatch[1].trim() : null;
                          if (claimNumber) {
                            return (
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                                    CLAIM
                                  </span>
                                  <span className="font-bold text-slate-900">
                                    Claim #{claimNumber}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 truncate mt-0.5">
                                  {planName || policyNo} {compName ? `(${compName})` : ''}
                                </p>
                              </div>
                            );
                          }
                          return (
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 truncate">
                                {planName || policyNo} {compName ? `(${compName})` : ''}
                              </p>
                              {planName && policyNo && (
                                <p className="text-[10px] text-indigo-600 font-mono truncate">{policyNo}</p>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2.5 text-right font-extrabold text-emerald-600 border-r border-slate-100">
                        ₹{commAmt.toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2.5 text-center border-r border-slate-100">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle size={11} className="text-emerald-600" />
                            PAID
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <Clock size={11} className="text-rose-500" />
                            UNPAID
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {!isPaid ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setPayConfirm(row); }}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-indigo-700 hover:text-white bg-indigo-50 hover:bg-indigo-600 border border-indigo-200 transition-all cursor-pointer shadow-2xs"
                          >
                            Mark Paid
                          </button>
                        ) : (
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] font-semibold text-slate-500">
                              {row.paidAt ? format(new Date(row.paidAt), 'dd/MM/yyyy') : 'Settled'}
                            </span>
                            {(() => {
                              const matchRemark = row.notes?.match(/Payment Remark:\s*([^\n]+)/i);
                              const remarkText = matchRemark ? matchRemark[1].trim() : null;
                              if (!remarkText) return null;
                              return (
                                <span
                                  className="text-[9px] text-slate-400 font-medium truncate max-w-[110px]"
                                  title={remarkText}
                                >
                                  {remarkText}
                                </span>
                              );
                            })()}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

return (
    <div className="space-y-5 pb-10 text-slate-800 font-sans text-sm sm:text-base">

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

      {/* ── FILTER PARAMETERS: ACCORDING TO COMMISSION TABLE ──────── */}
      {showFilter && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 space-y-3.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-xs uppercase tracking-wider">
              <Filter size={14} className="text-indigo-600" />
              <span>Filter Parameters (According to Table)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400">Matching Entries:</span>
              <span className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg">
                {filtered.length} of {allRows.length}
              </span>
            </div>
          </div>

          {/* Filter Grid - Row 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Select Dates (From - To)
              </label>
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
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Employee Name
              </label>
              <select
                value={filterEmployee}
                onChange={e => setFilterEmployee(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500"
              >
                <option value="All">All Employees</option>
                {availableEmployees.map((name: string) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Proposer / Client Name
              </label>
              <input
                type="text"
                value={filterProposer}
                onChange={e => setFilterProposer(e.target.value)}
                placeholder="Search proposer name..."
                className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Payment Status
              </label>
              <select
                value={filterPaymentStatus}
                onChange={e => setFilterPaymentStatus(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500"
              >
                <option value="All">All Statuses</option>
                <option value="Paid">Paid Only</option>
                <option value="Unpaid">Unpaid Only</option>
              </select>
            </div>
          </div>

          {/* Filter Grid - Row 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Policy / Plan / Claim
              </label>
              <select
                value={filterPolicyPlan}
                onChange={e => setFilterPolicyPlan(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500"
              >
                <option value="All">All Policies & Claims</option>
                <option value="POLICIES_ONLY">Policies Only</option>
                <option value="CLAIMS_ONLY">Claims Only</option>
                {availablePlans.map((plan: string) => (
                  <option key={plan} value={plan}>{plan}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Insurance Company
              </label>
              <select
                value={filterCompany}
                onChange={e => setFilterCompany(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500"
              >
                <option value="All">All Companies</option>
                {availableCompanies.map((comp: string) => (
                  <option key={comp} value={comp}>{comp}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Commission Amount (₹)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  placeholder="Min ₹"
                  value={filterMinAmount}
                  onChange={e => setFilterMinAmount(e.target.value)}
                  className="w-1/2 border border-slate-200 rounded-xl px-2 py-1.5 bg-white text-xs text-center font-semibold text-slate-700 outline-none focus:border-indigo-500"
                />
                <span className="text-slate-400 font-bold">-</span>
                <input
                  type="number"
                  placeholder="Max ₹"
                  value={filterMaxAmount}
                  onChange={e => setFilterMaxAmount(e.target.value)}
                  className="w-1/2 border border-slate-200 rounded-xl px-2 py-1.5 bg-white text-xs text-center font-semibold text-slate-700 outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-end">
              <div className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 flex items-center justify-between text-xs">
                <span className="text-slate-500 text-[11px] font-bold">Table Records:</span>
                <span className="font-extrabold text-indigo-700">{filtered.length} found</span>
              </div>
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
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setFilterEmployee('All');
                  setFilterProposer('');
                  setFilterPolicyPlan('All');
                  setFilterCompany('All');
                  setFilterMinAmount('');
                  setFilterMaxAmount('');
                  setFilterPaymentStatus('All');
                  toast.success('Filters reset');
                }} 
                className="px-4 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 font-bold hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer text-xs"
              >
                Reset
              </button>
              <button 
                type="button" 
                onClick={() => {
                  setShowFilter(false);
                  toast.success(`Filters applied (${filtered.length} matching entries)`);
                }} 
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-md shadow-indigo-500/20 cursor-pointer text-xs"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── KPI METRICS RIBBON (ESSENTIAL COMMISSION METRICS) ─────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Total Premium */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex items-center justify-between shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
              <DollarSign size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Total Premium</p>
              <p className="text-lg font-black text-slate-900 mt-0.5">{liveTotalPremium}</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
            Gross
          </span>
        </div>

        {/* Card 2: Total Commission */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex items-center justify-between shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
              <TrendingUp size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Total Commission</p>
              <p className="text-lg font-black text-slate-900 mt-0.5">{liveTotalCommission}</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60">
            Earned
          </span>
        </div>

        {/* Card 3: Paid Commission */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex items-center justify-between shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
              <CheckCircle size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Paid Commission</p>
              <p className="text-lg font-black text-emerald-700 mt-0.5">{livePaidCommission}</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
            Settled
          </span>
        </div>

        {/* Card 4: Pending Commission */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex items-center justify-between shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
              <Clock size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Pending Commission</p>
              <p className="text-lg font-black text-rose-600 mt-0.5">{livePendingCommission}</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/60">
            Unpaid
          </span>
        </div>
      </div>

      {/* ── MAIN WORKSPACE: FULL WIDTH TABLE ────────────────────────────────── */}
      <div className="space-y-4 w-full">
          
          {/* TAB HEADER BAR */}
          <div className="bg-white rounded-t-2xl border border-slate-200/80 px-4 pt-1 border-b-0 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center">
              <button
                onClick={() => setActiveTab('WITHOUT_COMMISSION')}
                className={clsx(
                  'px-5 py-3 border-b-2 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all',
                  activeTab === 'WITHOUT_COMMISSION'
                    ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200'
                )}
              >
                <TrendingUp size={13} />
                Commission Entries
              </button>
              <button
                onClick={() => setActiveTab('CARD_VIEW')}
                className={clsx(
                  'px-5 py-3 border-b-2 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all',
                  activeTab === 'CARD_VIEW'
                    ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200'
                )}
              >
                <PieChart size={13} />
                Commission Summary
              </button>
            </div>
          </div>

          {/* HELPER FUNCTION: RENDER COMMISSION TABLE */}
          {(() => null)()}

          {/* TAB 1: COMMISSION ENTRIES — MAIN TABLE WITH RIGHT CORNER BOX */}
          {activeTab === 'WITHOUT_COMMISSION' && (() => {
            // Build the list of policies/claims for the right panel
            const rawAllPolicies = allPoliciesData?.data ?? allPoliciesData ?? [];
            const allPoliciesList: any[] = (Array.isArray(rawAllPolicies) ? rawAllPolicies : []).map((p: any) => ({ ...p, _itemType: 'POLICY' as const }));
            const rawAllClaims = allClaimsData?.data ?? allClaimsData ?? [];
            const allClaimsList: any[] = (Array.isArray(rawAllClaims) ? rawAllClaims : []).map((c: any) => ({ ...c, _itemType: 'CLAIM' as const }));

            const handleClickPolicyOrClaim = (item: any) => {
              handleSelectPolicy(item);
              setModalOpen(true);
            };

            const toggleSelectMainItem = (key: string) => {
              setSelectedMainIds(prev =>
                prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
              );
            };

            const handleSelectAllCurrentPage = (items: any[]) => {
              const itemKeys = items.map(it => `${it._itemType === 'CLAIM' ? 'claim' : 'policy'}-${it.id}`);
              const allSelected = itemKeys.length > 0 && itemKeys.every(k => selectedMainIds.includes(k));
              if (allSelected) {
                setSelectedMainIds(prev => prev.filter(k => !itemKeys.includes(k)));
              } else {
                setSelectedMainIds(prev => Array.from(new Set([...prev, ...itemKeys])));
              }
            };

            const handleGiveCommissionToSelected = () => {
              if (selectedMainIds.length === 0) return;
              const allAvailable = [...allPoliciesList, ...allClaimsList];
              const itemsToAdd = allAvailable.filter(item => {
                const key = `${item._itemType === 'CLAIM' ? 'claim' : 'policy'}-${item.id}`;
                return selectedMainIds.includes(key);
              });

              if (itemsToAdd.length > 0) {
                handleSelectPolicy(itemsToAdd[0]);
              }

              setSelectedMainIds([]);
              setModalOpen(true);
            };

            const getItemCommissions = (item: any) => {
              const isClaim = item._itemType === 'CLAIM';
              if (isClaim) {
                return allCommissionsList.filter(c => {
                  const claimMatch = c.notes?.match(/\[Claim:\s*([^\]]+)\]/i);
                  const claimNum = claimMatch ? claimMatch[1].trim() : '';
                  if (item.claimNumber && claimNum && claimNum.toLowerCase() === String(item.claimNumber).toLowerCase()) return true;
                  if (item.id && claimNum && claimNum === item.id) return true;
                  const effectivePolicyId = item.policyId || item.policy?.id;
                  return effectivePolicyId && c.policyId === effectivePolicyId && Boolean(claimNum);
                });
              } else {
                return allCommissionsList.filter(c => {
                  const isClaimComm = c.notes?.match(/\[Claim:\s*([^\]]+)\]/i);
                  return c.policyId === item.id && !isClaimComm;
                });
              }
            };

            const getItemCommissionStatus = (item: any): 'NOT_ADDED' | 'ADDED' => {
              const comms = getItemCommissions(item);
              return comms.length === 0 ? 'NOT_ADDED' : 'ADDED';
            };

            const getItemTotalCommission = (item: any): number => {
              const comms = getItemCommissions(item);
              return comms.reduce((sum, c) => sum + Number(c.amount || 0), 0);
            };

            const baseItems = listPanelTab === 'POLICIES' ? allPoliciesList : allClaimsList;
            const totalCount = baseItems.length;
            const notAddedCount = baseItems.filter(it => getItemCommissionStatus(it) === 'NOT_ADDED').length;
            const addedCount = baseItems.filter(it => getItemCommissionStatus(it) === 'ADDED').length;

            const panelItems = baseItems.filter(it => {
              const status = getItemCommissionStatus(it);
              if (commissionStatusFilter === 'ALL') return true;
              if (commissionStatusFilter === 'NOT_ADDED') return status === 'NOT_ADDED';
              if (commissionStatusFilter === 'ADDED') return status === 'ADDED';
              return true;
            });

            const isPanelLoading = listPanelTab === 'POLICIES' ? allPoliciesLoading : allClaimsLoading;

            return (
              <div className="-mt-4 bg-white rounded-b-2xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 space-y-4">
                {/* 1. Header Toolbar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-800 flex items-center gap-2">
                      <Shield size={17} className="text-indigo-600" />
                      Policies &amp; Claims Management
                    </h3>
                    <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                      Select any policy or claim to immediately calculate and assign commission
                    </p>
                  </div>

                  {/* Right side: Sub-tabs, Search, and View Mode Toggle */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Sub-tabs pills */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/70">
                      <button
                        type="button"
                        onClick={() => {
                          setListPanelTab('POLICIES');
                          setPanelPage(1);
                        }}
                        className={clsx(
                          'px-3 sm:px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer',
                          listPanelTab === 'POLICIES'
                            ? 'bg-white text-indigo-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        )}
                      >
                        <Shield size={13} />
                        Policies ({allPoliciesList.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setListPanelTab('CLAIMS');
                          setPanelPage(1);
                        }}
                        className={clsx(
                          'px-3 sm:px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer',
                          listPanelTab === 'CLAIMS'
                            ? 'bg-white text-amber-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        )}
                      >
                        <FileText size={13} />
                        Claims ({allClaimsList.length})
                      </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative min-w-[200px] sm:min-w-[240px]">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={listPanelSearch}
                        onChange={e => {
                          setListPanelSearch(e.target.value);
                          setPanelPage(1);
                        }}
                        placeholder={listPanelTab === 'POLICIES' ? 'Search by policy#, plan, company...' : 'Search by claim#, policy#, client...'}
                        className="w-full pl-8 pr-7 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white focus:bg-white focus:outline-none focus:border-indigo-400 transition-colors"
                      />
                      {listPanelSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setListPanelSearch('');
                            setPanelPage(1);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    {/* View Switcher: Grid vs Table */}
                    <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl border border-slate-200/70">
                      <button
                        type="button"
                        onClick={() => setPanelViewMode('GRID')}
                        title="Grid View"
                        className={clsx(
                          'p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                          panelViewMode === 'GRID' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                        )}
                      >
                        <LayoutGrid size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPanelViewMode('TABLE')}
                        title="Table View"
                        className={clsx(
                          'p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                          panelViewMode === 'TABLE' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                        )}
                      >
                        <List size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Status Filter Tabs (Commission Added vs Not Added) */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5 pb-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
                    <Filter size={12} className="text-indigo-600" />
                    Status Filter:
                  </span>
                  <button
                    type="button"
                    onClick={() => { setCommissionStatusFilter('ALL'); setPanelPage(1); }}
                    className={clsx(
                      "px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5",
                      commissionStatusFilter === 'ALL'
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    <span>All</span>
                    <span className={clsx("text-[10px] px-1.5 py-0.2 rounded-full font-extrabold", commissionStatusFilter === 'ALL' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700")}>
                      {totalCount}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCommissionStatusFilter('NOT_ADDED'); setPanelPage(1); }}
                    className={clsx(
                      "px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5",
                      commissionStatusFilter === 'NOT_ADDED'
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                    )}
                  >
                    <span>Commission Not Added</span>
                    <span className={clsx("text-[10px] px-1.5 py-0.2 rounded-full font-extrabold", commissionStatusFilter === 'NOT_ADDED' ? "bg-white/20 text-white" : "bg-indigo-200/60 text-indigo-900")}>
                      {notAddedCount}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCommissionStatusFilter('ADDED'); setPanelPage(1); }}
                    className={clsx(
                      "px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5",
                      commissionStatusFilter === 'ADDED'
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    )}
                  >
                    <CheckCircle size={12} />
                    <span>Commission Added</span>
                    <span className={clsx("text-[10px] px-1.5 py-0.2 rounded-full font-extrabold", commissionStatusFilter === 'ADDED' ? "bg-white/20 text-white" : "bg-emerald-200/60 text-emerald-900")}>
                      {addedCount}
                    </span>
                  </button>
                </div>

                {/* Multi-Select Action Bar */}
                {selectedMainIds.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-indigo-50 via-indigo-50/60 to-amber-50 border border-indigo-200/90 rounded-2xl p-3 px-4 shadow-xs animate-in fade-in">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center justify-center shadow-xs">
                        {selectedMainIds.length}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          {selectedMainIds.length} {selectedMainIds.length === 1 ? 'item' : 'items'} selected
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Assign commissions for these selected items under employees together
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedMainIds([])}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-white rounded-xl transition-all cursor-pointer"
                      >
                        Clear Selection
                      </button>
                      <button
                        type="button"
                        onClick={handleGiveCommissionToSelected}
                        className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-500/20 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                      >
                        <Plus size={14} strokeWidth={2.5} />
                        <span>Give Commission to Selected ({selectedMainIds.length})</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. Content Area */}
                {(() => {
                  if (isPanelLoading) {
                    return (
                      <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
                        <RefreshCw size={24} className="animate-spin text-indigo-600" />
                        <span className="text-xs font-semibold">Loading {listPanelTab === 'POLICIES' ? 'policies' : 'claims'}...</span>
                      </div>
                    );
                  }

                  if (panelItems.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                          <FileText size={24} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-700">
                            No {listPanelTab === 'POLICIES' ? 'policies' : 'claims'} found
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {listPanelSearch || commissionStatusFilter !== 'ALL'
                              ? 'Try adjusting your search or status filter'
                              : `No ${listPanelTab.toLowerCase()} available`}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  const itemsPerPage = panelViewMode === 'GRID' ? 16 : 15;
                  const totalPages = Math.max(1, Math.ceil(panelItems.length / itemsPerPage));
                  const currentPage = Math.min(panelPage, totalPages);
                  const paginatedItems = panelItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

                  return (
                    <div className="space-y-4">
                      {/* GRID VIEW */}
                      {panelViewMode === 'GRID' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
                          {paginatedItems.map((item: any) => {
                            const commStatus = getItemCommissionStatus(item);
                            const itemCommTotal = getItemTotalCommission(item);

                            if (item._itemType === 'CLAIM') {
                              const itemKey = `claim-${item.id}`;
                              const isSelected = selectedMainIds.includes(itemKey);
                              const cNum = item.claimNumber || item.id?.slice(-6) || 'N/A';
                              const pNum = item.policy?.policyNumber || item.policyNumber || '';
                              const custName = item.contact
                                ? `${item.contact.firstName || ''} ${item.contact.lastName || ''}`.trim()
                                : '';
                              const planName = item.policy?.plan?.name || '';
                              const compName = item.policy?.plan?.company?.name || '';
                              const claimAmt = Number(item.claimAmount || item.approvedAmount || 0);
                              const claimType = item.claimType || 'Cashless';

                              return (
                                <div
                                  key={`grid-claim-${item.id}`}
                                  className={clsx(
                                    "bg-white rounded-2xl border transition-all p-4 flex flex-col justify-between group",
                                    isSelected
                                      ? "border-amber-400 ring-2 ring-amber-400/30 bg-amber-50/20 shadow-md"
                                      : "border-slate-200/90 shadow-2xs hover:shadow-md hover:border-amber-300"
                                  )}
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-2 mb-2.5">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            toggleSelectMainItem(itemKey);
                                          }}
                                          title="Select claim for bulk commission"
                                          className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer shrink-0"
                                        />
                                        <span className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 font-extrabold text-[10px] flex items-center justify-center shrink-0 border border-amber-200 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                                          CL
                                        </span>
                                        <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60 truncate">
                                          {claimType}
                                        </span>
                                      </div>
                                      <span className="text-xs font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg shrink-0">
                                        ₹{claimAmt.toLocaleString('en-IN')}
                                      </span>
                                    </div>

                                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-amber-700 transition-colors line-clamp-1 mb-1">
                                      Claim #{cNum}
                                    </h4>

                                    <div className="flex items-center gap-1.5 mb-2">
                                      <span className="text-[11px] font-semibold text-slate-600 truncate">
                                        {planName || compName || 'Insurance Claim'}
                                      </span>
                                      {pNum && (
                                        <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded shrink-0">
                                          #{pNum}
                                        </span>
                                      )}
                                    </div>

                                    {/* Status Badge in Grid */}
                                    <div className="mb-2">
                                      {commStatus === 'NOT_ADDED' ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                          Commission Not Added
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                          <CheckCircle size={10} /> Commission Added • ₹{itemCommTotal.toLocaleString('en-IN')}
                                        </span>
                                      )}
                                    </div>

                                    <div className="text-xs text-slate-600 flex items-center gap-1.5 mb-3 bg-slate-50/70 p-2 rounded-xl border border-slate-100">
                                      <User size={13} className="text-slate-400 shrink-0" />
                                      <span className="truncate">
                                        <span className="text-[10px] text-slate-400 block font-medium">Claimant / Client</span>
                                        <span className="font-semibold text-slate-800 text-xs">{custName || 'Unassigned'}</span>
                                      </span>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleClickPolicyOrClaim(item)}
                                    className="w-full py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-600 text-amber-800 hover:text-white border border-amber-200 hover:border-amber-600 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                                  >
                                    <Plus size={13} strokeWidth={2.5} />
                                    <span>{commStatus === 'NOT_ADDED' ? 'Give Commission' : 'Add More'}</span>
                                  </button>
                                </div>
                              );
                            }

                            // POLICY
                            const itemKey = `policy-${item.id}`;
                            const isSelected = selectedMainIds.includes(itemKey);
                            const planName = item.plan?.name || '';
                            const compName = item.plan?.company?.name || '';
                            const pNum = item.policyNumber || '';
                            const custName = item.contact
                              ? `${item.contact.firstName || ''} ${item.contact.lastName || ''}`.trim()
                              : ((item as any).customer ? `${(item as any).customer.firstName || ''} ${(item as any).customer.lastName || ''}`.trim() : '');
                            const prem = Number(item.premiumAmount || 0);
                            const polCategory = item.plan?.category || item.category || 'Health';

                            return (
                              <div
                                key={`grid-policy-${item.id}`}
                                className={clsx(
                                  "bg-white rounded-2xl border transition-all p-4 flex flex-col justify-between group",
                                  isSelected
                                    ? "border-indigo-400 ring-2 ring-indigo-400/30 bg-indigo-50/20 shadow-md"
                                    : "border-slate-200/90 shadow-2xs hover:shadow-md hover:border-indigo-300"
                                )}
                              >
                                <div>
                                  <div className="flex items-center justify-between gap-2 mb-2.5">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          toggleSelectMainItem(itemKey);
                                        }}
                                        title="Select policy for bulk commission"
                                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer shrink-0"
                                      />
                                      <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                        <Shield size={14} />
                                      </span>
                                      <span className="text-[11px] font-bold text-slate-600 truncate bg-slate-100/70 px-2 py-0.5 rounded-md">
                                        {compName || 'Insurance'}
                                      </span>
                                    </div>
                                    <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2.5 py-0.5 rounded-lg shrink-0">
                                      ₹{prem.toLocaleString('en-IN')}
                                    </span>
                                  </div>

                                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1 mb-1" title={planName}>
                                    {planName || 'Insurance Policy'}
                                  </h4>

                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="font-mono text-[11px] font-bold text-indigo-600 bg-indigo-50/70 px-2 py-0.5 rounded border border-indigo-100/80">
                                      #{pNum || '—'}
                                    </span>
                                    {polCategory && (
                                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                        {polCategory}
                                      </span>
                                    )}
                                  </div>

                                  {/* Status Badge in Grid */}
                                  <div className="mb-2">
                                    {commStatus === 'NOT_ADDED' ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                        Commission Not Added
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        <CheckCircle size={10} /> Commission Added • ₹{itemCommTotal.toLocaleString('en-IN')}
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-xs text-slate-600 flex items-center gap-1.5 mb-3 bg-slate-50/70 p-2 rounded-xl border border-slate-100">
                                    <User size={13} className="text-slate-400 shrink-0" />
                                    <span className="truncate">
                                      <span className="text-[10px] text-slate-400 block font-medium">Proposer / Client</span>
                                      <span className="font-semibold text-slate-800 text-xs">{custName || 'Unassigned'}</span>
                                    </span>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleClickPolicyOrClaim(item)}
                                  className="w-full py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 hover:border-indigo-600 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                                >
                                  <Plus size={13} strokeWidth={2.5} />
                                  <span>{commStatus === 'NOT_ADDED' ? 'Give Commission' : 'Add More'}</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* TABLE VIEW */}
                      {panelViewMode === 'TABLE' && (
                        <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                              <tr>
                                <th className="py-3 px-3 w-10 text-center">
                                  <input
                                    type="checkbox"
                                    checked={paginatedItems.length > 0 && paginatedItems.every((it: any) => selectedMainIds.includes(`${it._itemType === 'CLAIM' ? 'claim' : 'policy'}-${it.id}`))}
                                    onChange={() => handleSelectAllCurrentPage(paginatedItems)}
                                    title="Select all on this page"
                                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                                  />
                                </th>
                                <th className="py-3 px-4 w-12 text-center">Sr. No.</th>
                                {listPanelTab === 'POLICIES' ? (
                                  <>
                                    <th className="py-3 px-4">Policy Number</th>
                                    <th className="py-3 px-4">Plan &amp; Company</th>
                                    <th className="py-3 px-4">Proposer / Client</th>
                                    <th className="py-3 px-4">Category / Type</th>
                                    <th className="py-3 px-4 text-right">Premium Amount</th>
                                    <th className="py-3 px-4 text-center">Commission Status</th>
                                  </>
                                ) : (
                                  <>
                                    <th className="py-3 px-4">Claim Number</th>
                                    <th className="py-3 px-4">Policy &amp; Plan</th>
                                    <th className="py-3 px-4">Claimant / Client</th>
                                    <th className="py-3 px-4">Claim Type &amp; Status</th>
                                    <th className="py-3 px-4 text-right">Claim Amount</th>
                                    <th className="py-3 px-4 text-center">Commission Status</th>
                                  </>
                                )}
                                <th className="py-3 px-4 text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {paginatedItems.map((item: any, idx: number) => {
                                const srNo = (currentPage - 1) * itemsPerPage + idx + 1;
                                const commStatus = getItemCommissionStatus(item);
                                const itemCommTotal = getItemTotalCommission(item);

                                if (item._itemType === 'CLAIM') {
                                  const itemKey = `claim-${item.id}`;
                                  const isSelected = selectedMainIds.includes(itemKey);
                                  const cNum = item.claimNumber || item.id?.slice(-6) || 'N/A';
                                  const pNum = item.policy?.policyNumber || item.policyNumber || '';
                                  const custName = item.contact ? `${item.contact.firstName || ''} ${item.contact.lastName || ''}`.trim() : '';
                                  const planName = item.policy?.plan?.name || '';
                                  const claimAmt = Number(item.claimAmount || item.approvedAmount || 0);
                                  const claimType = item.claimType || 'Cashless';
                                  const claimStatus = item.status || 'PENDING';

                                  return (
                                    <tr
                                      key={`tbl-clm-${item.id}`}
                                      className={clsx(
                                        "transition-colors",
                                        isSelected ? "bg-amber-50/70" : "hover:bg-amber-50/30"
                                      )}
                                    >
                                      <td className="py-3 px-3 text-center">
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => toggleSelectMainItem(itemKey)}
                                          className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5 cursor-pointer"
                                        />
                                      </td>
                                      <td className="py-3 px-4 text-center font-semibold text-slate-500">{srNo}</td>
                                      <td className="py-3 px-4">
                                        <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                          Claim #{cNum}
                                        </span>
                                      </td>
                                      <td className="py-3 px-4">
                                        <span className="font-bold text-slate-900 block">{planName || 'Insurance Plan'}</span>
                                        {pNum && <span className="font-mono text-[11px] text-slate-400">#{pNum}</span>}
                                      </td>
                                      <td className="py-3 px-4">
                                        <div className="flex items-center gap-1.5">
                                          <User size={13} className="text-slate-400" />
                                          <span className="font-medium text-slate-700">{custName || 'Unassigned'}</span>
                                        </div>
                                      </td>
                                      <td className="py-3 px-4">
                                        <div className="flex items-center gap-1.5">
                                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                            {claimType}
                                          </span>
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                                            {claimStatus}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="py-3 px-4 text-right font-black text-amber-700">
                                        ₹{claimAmt.toLocaleString('en-IN')}
                                      </td>
                                      <td className="py-3 px-4 text-center">
                                        {commStatus === 'NOT_ADDED' ? (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                            Not Added
                                          </span>
                                        ) : (
                                          <div className="flex flex-col items-center">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                              <CheckCircle size={10} /> Commission Added
                                            </span>
                                            <span className="text-[10px] font-extrabold text-emerald-700 mt-0.5">₹{itemCommTotal.toLocaleString('en-IN')}</span>
                                          </div>
                                        )}
                                      </td>
                                      <td className="py-3 px-4 text-center">
                                        <button
                                          type="button"
                                          onClick={() => handleClickPolicyOrClaim(item)}
                                          className={clsx(
                                            "px-3 py-1.5 rounded-lg font-bold text-xs shadow-2xs transition-all cursor-pointer",
                                            commStatus === 'NOT_ADDED'
                                              ? "bg-amber-600 hover:bg-amber-700 text-white"
                                              : "bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200"
                                          )}
                                        >
                                          {commStatus === 'NOT_ADDED' ? '+ Give Commission' : '+ Add More'}
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                }

                                const itemKey = `policy-${item.id}`;
                                const isSelected = selectedMainIds.includes(itemKey);
                                const planName = item.plan?.name || '';
                                const compName = item.plan?.company?.name || '';
                                const pNum = item.policyNumber || '';
                                const custName = item.contact ? `${item.contact.firstName || ''} ${item.contact.lastName || ''}`.trim() : '';
                                const prem = Number(item.premiumAmount || 0);
                                const polCategory = item.plan?.category || item.category || 'Health';

                                return (
                                  <tr
                                    key={`tbl-pol-${item.id}`}
                                    className={clsx(
                                      "transition-colors",
                                      isSelected ? "bg-indigo-50/70" : "hover:bg-indigo-50/30"
                                    )}
                                  >
                                    <td className="py-3 px-3 text-center">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleSelectMainItem(itemKey)}
                                        className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                                      />
                                    </td>
                                    <td className="py-3 px-4 text-center font-semibold text-slate-500">{srNo}</td>
                                    <td className="py-3 px-4">
                                      <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                        #{pNum || '—'}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4">
                                      <span className="font-bold text-slate-900 block">{planName || 'Insurance Policy'}</span>
                                      <span className="text-[11px] text-slate-400">{compName}</span>
                                    </td>
                                    <td className="py-3 px-4">
                                      <div className="flex items-center gap-1.5">
                                        <User size={13} className="text-slate-400" />
                                        <span className="font-medium text-slate-700">{custName || 'Unassigned'}</span>
                                      </div>
                                    </td>
                                    <td className="py-3 px-4">
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                        {polCategory}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-right font-black text-emerald-700">
                                      ₹{prem.toLocaleString('en-IN')}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      {commStatus === 'NOT_ADDED' ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                          Not Added
                                        </span>
                                      ) : (
                                        <div className="flex flex-col items-center">
                                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            <CheckCircle size={10} /> Commission Added
                                          </span>
                                          <span className="text-[10px] font-extrabold text-emerald-700 mt-0.5">₹{itemCommTotal.toLocaleString('en-IN')}</span>
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleClickPolicyOrClaim(item)}
                                        className={clsx(
                                          "px-3 py-1.5 rounded-lg font-bold text-xs shadow-2xs transition-all cursor-pointer",
                                          commStatus === 'NOT_ADDED'
                                            ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                                            : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200"
                                        )}
                                      >
                                        {commStatus === 'NOT_ADDED' ? '+ Give Commission' : '+ Add More'}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* PAGINATION */}
                      {totalPages > 1 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
                          <span className="text-slate-500">
                            Showing <span className="font-bold text-slate-800">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold text-slate-800">{Math.min(currentPage * itemsPerPage, panelItems.length)}</span> of <span className="font-bold text-slate-800">{panelItems.length}</span> {listPanelTab === 'POLICIES' ? 'policies' : 'claims'}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={currentPage === 1}
                              onClick={() => setPanelPage(p => Math.max(1, p - 1))}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                            >
                              Previous
                            </button>
                            <span className="px-2.5 py-1 text-slate-600 font-bold">
                              {currentPage} / {totalPages}
                            </span>
                            <button
                              type="button"
                              disabled={currentPage >= totalPages}
                              onClick={() => setPanelPage(p => Math.min(totalPages, p + 1))}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* TAB 2: BULK SET COMMISSION */}
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
                  <button 
                    type="button"
                    onClick={() => toast.success(`Employee commission of ${bulkEmpRate}% applied successfully to 342 matching ${bulkCompany} policies!`)}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    Apply %
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: COMMISSION SUMMARY (FULL WIDTH ROWS VIEW) */}
          {activeTab === 'CARD_VIEW' && (
            <div className="bg-white rounded-b-2xl border border-slate-200/80 shadow-2xs p-4 -mt-4">
              {renderCommissionTable(true)}
            </div>
          )}

      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          Add New Commission Modal — Constant Size Tabbed UI
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal 
        open={modalOpen} 
        onClose={closeModal} 
        title="Distribute Commission" 
        subtitle="Select a policy or claim and distribute commission across multiple employees" 
        size="2xl"
        actions={
          <div className="flex items-center gap-2">
            <button 
              type="button" 
              onClick={() => {
                setSubmitType('save');
                handleSubmit((data) => handleFormSubmit(data, 'save'))();
              }}
              className="px-4 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold rounded-xl text-xs shadow-xs cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5" 
              disabled={createCommission.isPending || !selectedPolicy || selectedEmployeesList.length === 0}
            >
              <Save size={13} className="text-slate-600" />
              <span>{createCommission.isPending && submitType === 'save' ? 'Saving…' : 'Save'}</span>
            </button>
            <button 
              type="button" 
              onClick={() => {
                setSubmitType('publish');
                handleSubmit((data) => handleFormSubmit(data, 'publish'))();
              }}
              className="btn-primary px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5" 
              disabled={createCommission.isPending || !selectedPolicy || selectedEmployeesList.length === 0}
            >
              <Send size={13} />
              <span>{createCommission.isPending && submitType === 'publish' ? 'Publishing…' : 'Publish Commission'}</span>
            </button>
          </div>
        }
      >
        <form id="add-commission-form" onSubmit={handleSubmit((data) => handleFormSubmit(data, submitType))} className="space-y-4 mt-2">
          <input type="hidden" {...register('beneficiaryId')} />
          <input type="hidden" {...register('policyId')} />
          <input type="hidden" {...register('commissionYearId')} />
          <input type="hidden" {...register('amount')} />

          <div className="space-y-4">
            <div className="bg-slate-50/70 border border-slate-200/80 p-4 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs uppercase tracking-wider">
                  <DollarSign size={15} className="text-indigo-600" />
                  <span>Policy &amp; Multi-Employee Commission Distribution</span>
                </div>
                {years.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-[11px] font-bold text-slate-400">Financial Year:</span>
                    <select 
                      {...register('commissionYearId')} 
                      className="h-7 text-xs font-bold text-indigo-700 bg-white border border-indigo-200 rounded-lg px-2 cursor-pointer focus:outline-none"
                    >
                      {years.map((y: any) => (
                        <option key={y.id} value={y.id}>
                          {y.name} {y.isActive ? '(Current)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. SELECT POLICY OR CLAIM / SERVICE (SINGLE) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Shield size={13} className="text-indigo-600" />
                      <span>Select Policy / Service *</span>
                    </label>
                    {selectedPolicy && (
                      <span className={clsx(
                        "text-[10px] font-bold px-2 py-0.5 rounded",
                        selectedPolicy.itemType === 'CLAIM' ? "bg-amber-100 text-amber-800" : "bg-indigo-100 text-indigo-800"
                      )}>
                        {selectedPolicy.itemType}
                      </span>
                    )}
                  </div>

                  {selectedPolicy ? (
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50/80 to-blue-50/50 min-h-[46px]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={clsx(
                          "w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0",
                          selectedPolicy.itemType === 'CLAIM' ? "bg-amber-500 text-white" : "bg-indigo-600 text-white"
                        )}>
                          {selectedPolicy.itemType === 'CLAIM' ? 'CL' : <Shield size={14} />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {selectedPolicy.title}
                            </p>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded shrink-0">
                              ₹{Number(selectedPolicy.baseAmount || 0).toLocaleString('en-IN')}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 truncate">
                            {selectedPolicy.policyNumber ? `Pol #${selectedPolicy.policyNumber}` : ''}
                            {selectedPolicy.companyName ? ` • ${selectedPolicy.companyName}` : ''}
                            {selectedPolicy.proposerName ? ` • ${selectedPolicy.proposerName}` : ''}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearPolicy}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer shrink-0 ml-1.5"
                        title="Change policy or claim"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search policy number, claim#, plan name..."
                        value={policySearch}
                        onChange={(e) => { setPolicySearch(e.target.value); setPolicyDrop(true); }}
                        onFocus={() => setPolicyDrop(true)}
                        onBlur={() => setTimeout(() => setPolicyDrop(false), 250)}
                        className="input pl-9 pr-7 h-9 text-xs rounded-xl w-full bg-white border border-slate-200 shadow-2xs focus:border-indigo-400"
                      />
                      <ChevronDown 
                        size={14} 
                        onMouseDown={(e) => { e.preventDefault(); setPolicyDrop(prev => !prev); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-indigo-600" 
                      />

                      {policyDrop && (
                        <ul className="absolute left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-56 overflow-y-auto text-xs py-1">
                          {(policyLoading || claimsLoading) ? (
                            <li className="px-3 py-2 text-slate-400">Loading policies &amp; claims...</li>
                          ) : policyList.length === 0 ? (
                            <li className="px-3 py-2 text-slate-400 text-center">No matching policies or claims found</li>
                          ) : (
                            policyList.map((item: any) => {
                              const isClaim = item._itemType === 'CLAIM';
                              if (isClaim) {
                                const cNum = item.claimNumber || 'N/A';
                                const pNum = item.policy?.policyNumber || item.policyNumber || '';
                                const custName = item.contact 
                                  ? `${item.contact.firstName || ''} ${item.contact.lastName || ''}`.trim()
                                  : '';
                                const claimAmt = item.claimAmount || item.approvedAmount || 0;
                                const cType = item.claimType || 'General';

                                return (
                                  <li
                                    key={`claim-${item.id}`}
                                    onMouseDown={() => handleSelectPolicy(item)}
                                    className="flex items-center justify-between px-3 py-2 cursor-pointer border-b border-slate-50 last:border-0 hover:bg-amber-50 transition-colors"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="w-5 h-5 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                                        CL
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-bold text-slate-900 truncate text-xs">
                                            Claim #{cNum}
                                          </span>
                                          <span className="text-[9px] font-semibold px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded">
                                            CLAIM
                                          </span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 truncate">
                                          {pNum ? `Pol: ${pNum}` : ''}
                                          {cType ? ` • ${cType}` : ''}
                                          {custName ? ` • ${custName}` : ''}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0 ml-2">
                                      <span className="font-bold text-amber-600 block text-xs">
                                        ₹{Number(claimAmt).toLocaleString('en-IN')}
                                      </span>
                                      <span className="text-[9px] text-slate-400 block capitalize">{item.status || 'Claim'}</span>
                                    </div>
                                  </li>
                                );
                              }

                              const compName = item.plan?.company?.name || '';
                              const planName = item.plan?.name || '';
                              const custName = item.contact 
                                ? `${item.contact.firstName || ''} ${item.contact.lastName || ''}`.trim()
                                : (((item as any).customer?.firstName) ? `${(item as any).customer.firstName} ${(item as any).customer.lastName || ''}`.trim() : '');

                              return (
                                <li
                                  key={`policy-${item.id}`}
                                  onMouseDown={() => handleSelectPolicy(item)}
                                  className="flex items-center justify-between px-3 py-2 cursor-pointer border-b border-slate-50 last:border-0 hover:bg-indigo-50 transition-colors"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Shield size={14} className="text-indigo-600 shrink-0" />
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <p className="font-bold text-slate-900 truncate text-xs">
                                          {planName ? `${planName}` : 'Policy'} {compName ? `(${compName})` : ''}
                                        </p>
                                        <span className="text-[9px] font-semibold px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded">
                                          POLICY
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-slate-500 truncate">
                                        Policy No: <span className="font-semibold text-indigo-700">{item.policyNumber}</span>
                                        {custName ? ` • ${custName}` : ''}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0 ml-2">
                                    <span className="font-bold text-emerald-600 block text-xs">
                                      ₹{Number(item.premiumAmount || 0).toLocaleString('en-IN')}
                                    </span>
                                    <span className="text-[9px] text-slate-400 block">{item.policyType || 'Policy'}</span>
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

              </div>

              {/* ALREADY COMMISSION DISTRIBUTED EMPLOYEES */}
              {selectedPolicy && (
                <div className="bg-gradient-to-r from-amber-50/70 via-slate-50 to-indigo-50/40 border border-amber-200/90 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black shadow-2xs">
                        ✓
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800">
                          Already Commission Distributed Employees
                        </span>
                        <span className={clsx(
                          "ml-1.5 text-[10px] font-extrabold px-2 py-0.5 rounded-full",
                          existingDistributedForSelected.length > 0
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600"
                        )}>
                          {existingDistributedForSelected.length} {existingDistributedForSelected.length === 1 ? 'Employee' : 'Employees'}
                        </span>
                      </div>
                    </div>
                    {existingDistributedForSelected.length > 0 && (
                      <span className="text-xs font-extrabold text-emerald-700 bg-white border border-emerald-200 px-2.5 py-0.5 rounded-lg shadow-2xs">
                        Distributed: ₹{existingDistributedForSelected.reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0).toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>

                  {existingDistributedForSelected.length === 0 ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-white/80 border border-slate-200 rounded-xl text-xs text-slate-500">
                      <Info size={14} className="text-slate-400 shrink-0" />
                      <span>No commission has been distributed for this {selectedPolicy.itemType === 'CLAIM' ? 'claim' : 'policy'} yet. You are distributing the first commission.</span>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500 border-b border-slate-200">
                            <th className="px-3 py-2">Employee</th>
                            <th className="px-3 py-2 text-right">Commission Amount</th>
                            <th className="px-3 py-2 text-center">Status</th>
                            <th className="px-3 py-2">Remark / Paid Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {existingDistributedForSelected.map((dc: any, idx: number) => {
                            const bName = dc.beneficiary
                              ? `${dc.beneficiary.firstName || ''} ${dc.beneficiary.lastName || ''}`.trim()
                              : (dc.notes?.match(/Beneficiary:\s*([^\n]+)/i)?.[1] || 'Employee');
                            const bDesig = dc.beneficiary?.designation || (dc.beneficiary?.role === 'OWNER' ? 'Owner / Admin' : 'Advisor / Agent');
                            const isPaid = Boolean(dc.isPaid);
                            const matchRemark = dc.notes?.match(/Payment Remark:\s*([^\n]+)/i);
                            const commentText = matchRemark ? matchRemark[1].trim() : (dc.remark || (dc.paidAt ? format(new Date(dc.paidAt), 'dd/MM/yyyy') : '—'));

                            return (
                              <tr key={dc.id || idx} className="hover:bg-slate-50/60 transition-colors">
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                                      {bName[0]?.toUpperCase() || 'E'}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-bold text-slate-900 truncate leading-tight">{bName}</p>
                                      <p className="text-[10px] text-slate-400 truncate">{bDesig}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-right font-extrabold text-emerald-600 whitespace-nowrap">
                                  ₹{Number(dc.amount || 0).toLocaleString('en-IN')}
                                </td>
                                <td className="px-3 py-2 text-center whitespace-nowrap">
                                  <span className={clsx(
                                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold",
                                    isPaid
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : "bg-rose-50 text-rose-700 border border-rose-200"
                                  )}>
                                    {isPaid ? 'PAID' : 'UNPAID'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-[11px] text-slate-600 max-w-[180px] truncate" title={commentText}>
                                  {commentText}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* EMPLOYEES MULTI-SELECTION SECTION UNDER POLICY/SERVICE */}
              <div className="space-y-3 pt-2">
                {/* Header with Search and Common Rate */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Users size={14} className="text-indigo-600" />
                      <span>Select Employees *</span>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                        {selectedEmployeesList.length} Selected
                      </span>
                    </label>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Search and add multiple employees to distribute commission for this policy or claim
                    </p>
                  </div>

                  {selectedEmployeesList.length > 1 && (
                    <div className="flex items-center gap-2 bg-indigo-50/80 border border-indigo-200 px-3 py-1 rounded-xl">
                      <span className="text-[11px] font-bold text-indigo-900">Set Commission for All:</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-bold text-indigo-600">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          placeholder="Amount"
                          value={commonAmount === 0 ? '' : commonAmount}
                          onChange={(e) => handleApplyCommonAmount(parseFloat(e.target.value) || 0)}
                          className="w-20 h-6 text-xs text-right font-bold bg-white border border-indigo-200 rounded-lg text-indigo-900 px-1.5 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Search to Add Dropdown for Employees */}
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search employee by name, designation, phone, email to add..."
                    value={employeeSearch}
                    onChange={(e) => { setEmployeeSearch(e.target.value); setEmployeeDrop(true); }}
                    onFocus={() => setEmployeeDrop(true)}
                    onBlur={() => setTimeout(() => setEmployeeDrop(false), 250)}
                    className="input pl-9 pr-7 h-9 text-xs rounded-xl w-full bg-white border border-slate-200 shadow-2xs focus:border-indigo-400"
                  />
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />

                  {employeeDrop && (
                    <ul className="absolute left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-56 overflow-y-auto text-xs py-1">
                      {employeesLoading && employeesList.length === 0 ? (
                        <li className="px-3 py-2 text-slate-400">Loading employees...</li>
                      ) : filteredEmployees.length === 0 ? (
                        <li className="px-3 py-2 text-slate-400 text-center">No matching employees found</li>
                      ) : (
                        filteredEmployees.map((emp: any) => {
                          const empId = emp.id || emp.userId || emp.user?.id;
                          const bId = getEmployeeUserId(emp);
                          const isAlreadyAdded = selectedEmployeesList.some(e => e.id === empId || e.beneficiaryId === bId);
                          const empName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.user?.email || 'Unnamed Employee';
                          const designation = emp.designation || emp.user?.role || 'Staff';

                          return (
                            <li
                              key={emp.id || emp.userId}
                              onMouseDown={() => handleAddEmployee(emp)}
                              className={clsx(
                                "flex items-center justify-between px-3 py-2 cursor-pointer border-b border-slate-50 last:border-0 transition-colors",
                                isAlreadyAdded ? "bg-indigo-50/50 opacity-60" : "hover:bg-indigo-50"
                              )}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                                  {empName[0]?.toUpperCase() || 'E'}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-800 truncate text-xs">
                                      {empName}
                                    </span>
                                    {isAlreadyAdded && (
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded">
                                        ✓ Added
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-400 truncate">
                                    {emp.phone || emp.user?.email || ''}
                                  </p>
                                </div>
                              </div>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 shrink-0 ml-2">
                                {designation}
                              </span>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  )}
                </div>

                {/* SELECTED EMPLOYEES TABLE UNDER THE POLICY */}
                {selectedEmployeesList.length === 0 ? (
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center text-slate-400 space-y-1">
                    <Users size={24} className="mx-auto text-slate-300" />
                    <p className="text-xs font-bold text-slate-600">No employees selected yet</p>
                    <p className="text-[11px] text-slate-400">Search above to add multiple employees to receive commission for this policy</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px] sticky top-0 z-10">
                          <tr>
                            <th className="py-2.5 px-3">Employee &amp; Details</th>
                            <th className="py-2.5 px-3">Designation / Role</th>
                            <th className="py-2.5 px-3 text-right">Base Amount (₹)</th>
                            <th className="py-2.5 px-3 text-right">Commission (₹)</th>
                            <th className="py-2.5 px-2 w-8 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedEmployeesList.map((emp) => (
                            <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-2 px-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                                    {emp.name[0]?.toUpperCase() || 'E'}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-slate-900 text-xs truncate max-w-[180px]" title={emp.name}>
                                      {emp.name}
                                    </p>
                                    <p className="text-[10px] text-slate-400 truncate max-w-[180px]">
                                      {emp.phone || emp.email || '—'}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 px-3">
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                  {emp.designation}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-slate-800">
                                ₹{emp.baseAmount.toLocaleString('en-IN')}
                              </td>
                              <td className="py-2 px-3 text-right">
                                <div className="inline-flex items-center gap-1 justify-end">
                                  <span className="text-xs font-bold text-slate-400">₹</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={emp.commissionAmount === 0 ? '' : emp.commissionAmount}
                                    placeholder="0"
                                    onChange={(e) => handleEmployeeAmountChange(emp.id, parseFloat(e.target.value) || 0)}
                                    className="w-28 h-7 text-xs text-right font-black bg-emerald-50/70 border border-emerald-200 rounded-lg text-emerald-700 px-2 focus:bg-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                                  />
                                </div>
                              </td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveEmployeeItem(emp.id)}
                                  className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition-colors cursor-pointer"
                                  title="Remove employee"
                                >
                                  <X size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Summary Footer Bar */}
                    <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-500">
                        Policy/Service: <span className="font-bold text-indigo-950">{selectedPolicy ? `${selectedPolicy.title} ${selectedPolicy.policyNumber ? `(#${selectedPolicy.policyNumber})` : ''}` : 'None Selected'}</span> • Total Employees: <span className="font-bold text-slate-800">{selectedEmployeesList.length}</span>
                      </span>
                      <div className="flex items-center gap-4">
                        <span className="text-slate-500">
                          Base Amount: <span className="font-bold text-slate-800">₹{(selectedPolicy?.baseAmount || 0).toLocaleString('en-IN')}</span>
                        </span>
                        <span className="text-emerald-700 font-extrabold">
                          Total Commission: <span className="text-sm font-black">₹{selectedEmployeesList.reduce((acc, c) => acc + c.commissionAmount, 0).toLocaleString('en-IN')}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

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
              <input 
                type="checkbox" 
                className="rounded text-indigo-600 focus:ring-indigo-500" 
                checked={publishToWorkspace} 
                onChange={(e) => setPublishToWorkspace(e.target.checked)} 
              />
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
        <Modal
          open={!!payConfirm}
          onClose={() => { setPayConfirm(null); setPayRemark(''); setPayReceiptFile(null); setPaySendReceipt(false); }}
          title="Mark as Paid"
          size="sm"
        >
          {/* Summary line */}
          <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl px-4 py-3 mb-4">
            <p className="text-sm text-slate-700">
              Mark commission of{' '}
              <span className="font-extrabold text-emerald-700">₹{Number(payConfirm.amount).toLocaleString('en-IN')}</span>{' '}
              for policy{' '}
              <span className="font-semibold text-slate-900">{payConfirm.policy?.policyNumber || '—'}</span>{' '}
              as paid?
            </p>
            {payConfirm.beneficiary?.employeeProfile && (
              <p className="text-xs text-slate-500 mt-1">
                Employee:{' '}
                <span className="font-semibold text-slate-700">
                  {payConfirm.beneficiary.employeeProfile.firstName} {payConfirm.beneficiary.employeeProfile.lastName}
                </span>
              </p>
            )}
          </div>

          {/* Comment / Remark field */}
          <div className="mb-4">
            <label className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
              <span className="flex items-center gap-1.5">
                <MessageSquare size={13} className="text-emerald-600" />
                Comment / Remark <span className="text-slate-400 font-normal text-[11px]">(Optional)</span>
              </span>
            </label>
            <textarea
              value={payRemark}
              onChange={(e) => setPayRemark(e.target.value)}
              placeholder="Enter payment remark, transaction ID, UTR number, or note..."
              rows={3}
              className="w-full text-xs rounded-xl border border-slate-200 bg-white p-2.5 text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all resize-none shadow-2xs"
            />
          </div>

          {/* Optional: Payment Receipt Upload */}
          <div className="space-y-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-slate-100" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Payment Receipt (Optional)</span>
              <div className="h-px flex-1 bg-slate-100" />
            </div>

            {/* File Drop Zone */}
            <label
              htmlFor="receipt-upload"
              className={clsx(
                'flex flex-col items-center justify-center gap-2 w-full border-2 border-dashed rounded-xl py-4 px-3 cursor-pointer transition-all',
                payReceiptFile
                  ? 'border-emerald-300 bg-emerald-50/60'
                  : 'border-slate-200 bg-slate-50/50 hover:border-indigo-300 hover:bg-indigo-50/30'
              )}
            >
              <input
                id="receipt-upload"
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => setPayReceiptFile(e.target.files?.[0] ?? null)}
              />
              {payReceiptFile ? (
                <>
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <CheckCircle size={18} />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-emerald-700 truncate max-w-[180px]">{payReceiptFile.name}</p>
                    <p className="text-[10px] text-slate-400">{(payReceiptFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setPayReceiptFile(null); }}
                    className="text-[10px] font-bold text-rose-500 hover:text-rose-700 flex items-center gap-0.5 cursor-pointer"
                  >
                    <X size={11} /> Remove
                  </button>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                    <FileText size={16} />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-slate-600">Click to upload receipt</p>
                    <p className="text-[10px] text-slate-400">PDF or image · optional</p>
                  </div>
                </>
              )}
            </label>

            {/* Send to employee toggle — only visible when file selected */}
            {payReceiptFile && (
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <div
                  onClick={() => setPaySendReceipt(p => !p)}
                  className={clsx(
                    'w-8 h-4.5 rounded-full relative transition-colors cursor-pointer shrink-0',
                    paySendReceipt ? 'bg-emerald-500' : 'bg-slate-200'
                  )}
                  style={{ height: '18px', width: '32px' }}
                >
                  <span
                    className={clsx(
                      'absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-all',
                      paySendReceipt ? 'left-[14px]' : 'left-0.5'
                    )}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-700">
                  Send receipt to employee via notification
                </span>
              </label>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button
              className="btn-secondary text-xs"
              onClick={() => { setPayConfirm(null); setPayRemark(''); setPayReceiptFile(null); setPaySendReceipt(false); }}
            >
              Cancel
            </button>
            <button
              className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1.5"
              onClick={() => { markPaid.mutate({ id: payConfirm.id, remark: payRemark }); }}
              disabled={markPaid.isPending}
            >
              <CheckCircle size={13} />
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
                  {bulkModalPoliciesList.map((p) => (
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

      {/* ── Employee Commission Full Summary Modal ────────────────────────────── */}
      <Modal
        open={!!selectedEmployeeSummary}
        onClose={() => { setSelectedEmployeeSummary(null); setSummaryModalStatusFilter('ALL'); }}
        title="Employee Commission Summary"
        subtitle={selectedEmployeeSummary ? "Detailed commission breakdown and profile" : undefined}
        size="2xl"
      >
        {selectedEmployeeSummary && (() => {
          const selectedEmpId = selectedEmployeeSummary.beneficiaryId || selectedEmployeeSummary.beneficiary?.id;
          const selectedEmpName = selectedEmployeeSummary.beneficiary
            ? `${selectedEmployeeSummary.beneficiary.firstName || ''} ${selectedEmployeeSummary.beneficiary.lastName || ''}`.trim()
            : (selectedEmployeeSummary.notes?.match(/Beneficiary:\s*([^\n]+)/i)?.[1] || 'Employee');

          const employeeProfile = employeesList.find((e: any) =>
            e.id === selectedEmpId || e.userId === selectedEmpId || e.user?.id === selectedEmpId ||
            `${e.firstName || ''} ${e.lastName || ''}`.trim().toLowerCase() === selectedEmpName.toLowerCase()
          );

          const displayEmpName = employeeProfile
            ? `${employeeProfile.firstName || ''} ${employeeProfile.lastName || ''}`.trim()
            : selectedEmpName;

          const displayEmpEmail = employeeProfile?.email || employeeProfile?.user?.email || selectedEmployeeSummary.beneficiary?.email || '';
          const displayEmpPhone = employeeProfile?.phone || employeeProfile?.user?.phone || selectedEmployeeSummary.beneficiary?.phone || '';
          const displayEmpDesig = employeeProfile?.designation || employeeProfile?.role || selectedEmployeeSummary.beneficiary?.designation || 'Advisor / Agent';
          const displayEmpCode = employeeProfile?.employeeCode || employeeProfile?.code || '';

          const empAllComms = allCommissionsList.filter((c: any) => {
            if (selectedEmpId && (c.beneficiaryId === selectedEmpId || c.beneficiary?.id === selectedEmpId)) return true;
            const cName = c.beneficiary
              ? `${c.beneficiary.firstName || ''} ${c.beneficiary.lastName || ''}`.trim().toLowerCase()
              : (c.notes?.match(/Beneficiary:\s*([^\n]+)/i)?.[1] || '').trim().toLowerCase();
            return cName && cName === selectedEmpName.toLowerCase();
          });

          const totalEarned = empAllComms.reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);
          const totalPaid = empAllComms.filter((c: any) => c.isPaid).reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);
          const totalPending = empAllComms.filter((c: any) => !c.isPaid).reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);

          const filteredModalComms = empAllComms.filter((c: any) => {
            if (summaryModalStatusFilter === 'PAID') return c.isPaid;
            if (summaryModalStatusFilter === 'UNPAID') return !c.isPaid;
            return true;
          });

          return (
            <div className="space-y-4 py-1">
              {/* Profile Card Header */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50/80 via-blue-50/50 to-slate-50 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                    {displayEmpName[0]?.toUpperCase() || 'E'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                        {displayEmpName}
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                        {displayEmpDesig}
                      </span>
                      {displayEmpCode && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          #{displayEmpCode}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                      {displayEmpPhone && (
                        <span className="flex items-center gap-1 font-medium">
                          <Phone size={12} className="text-indigo-600" />
                          {displayEmpPhone}
                        </span>
                      )}
                      {displayEmpEmail && (
                        <span className="flex items-center gap-1 font-medium">
                          <Mail size={12} className="text-indigo-600" />
                          {displayEmpEmail}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 4 Stat KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">Total Earned</span>
                  <span className="text-base font-black text-slate-900 block mt-0.5">
                    ₹{totalEarned.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">{empAllComms.length} entries</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-2xs">
                  <span className="text-[10px] font-extrabold uppercase text-emerald-600 block tracking-wider">Paid / Settled</span>
                  <span className="text-base font-black text-emerald-700 block mt-0.5">
                    ₹{totalPaid.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold">
                    {empAllComms.filter((c: any) => c.isPaid).length} paid
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-rose-200 bg-rose-50/20 shadow-2xs">
                  <span className="text-[10px] font-extrabold uppercase text-rose-600 block tracking-wider">Pending / Due</span>
                  <span className="text-base font-black text-rose-700 block mt-0.5">
                    ₹{totalPending.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-rose-600 font-semibold">
                    {empAllComms.filter((c: any) => !c.isPaid).length} pending
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-indigo-200 bg-indigo-50/20 shadow-2xs">
                  <span className="text-[10px] font-extrabold uppercase text-indigo-600 block tracking-wider">Settlement Rate</span>
                  <span className="text-base font-black text-indigo-700 block mt-0.5">
                    {totalEarned > 0 ? `${Math.round((totalPaid / totalEarned) * 100)}%` : '0%'}
                  </span>
                  <span className="text-[10px] text-indigo-500 font-semibold">settled</span>
                </div>
              </div>

              {/* Status Filter Tabs & Table Header */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <FileText size={14} className="text-indigo-600" />
                    <span>Distributed Commissions Breakdown</span>
                  </h4>
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => setSummaryModalStatusFilter('ALL')}
                      className={clsx(
                        "px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer",
                        summaryModalStatusFilter === 'ALL' ? "bg-white text-indigo-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      All ({empAllComms.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSummaryModalStatusFilter('PAID')}
                      className={clsx(
                        "px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer",
                        summaryModalStatusFilter === 'PAID' ? "bg-emerald-600 text-white shadow-2xs" : "text-slate-600 hover:text-emerald-700"
                      )}
                    >
                      Paid ({empAllComms.filter((c: any) => c.isPaid).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSummaryModalStatusFilter('UNPAID')}
                      className={clsx(
                        "px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer",
                        summaryModalStatusFilter === 'UNPAID' ? "bg-rose-600 text-white shadow-2xs" : "text-slate-600 hover:text-rose-700"
                      )}
                    >
                      Unpaid ({empAllComms.filter((c: any) => !c.isPaid).length})
                    </button>
                  </div>
                </div>

                {filteredModalComms.length === 0 ? (
                  <div className="border border-slate-200 rounded-xl p-8 text-center bg-slate-50/50">
                    <Clock size={28} className="mx-auto text-slate-300 mb-1" />
                    <p className="text-xs text-slate-400 font-semibold">No commissions found for this filter</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white max-h-[340px] shadow-2xs">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
                        <tr className="text-[10px] font-extrabold uppercase text-slate-500">
                          <th className="px-3 py-2.5">Policy / Claim</th>
                          <th className="px-3 py-2.5">Proposer / Client</th>
                          <th className="px-3 py-2.5 text-right">Commission</th>
                          <th className="px-3 py-2.5 text-center">Status</th>
                          <th className="px-3 py-2.5">Remark / Paid Date</th>
                          <th className="px-3 py-2.5 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredModalComms.map((c: any, i: number) => {
                          const claimMatch = c.notes?.match(/\[Claim:\s*([^\]]+)\]/i);
                          const claimNum = claimMatch ? claimMatch[1].trim() : null;
                          const pNum = c.policy?.policyNumber || '—';
                          const planName = c.policy?.plan?.name || '';
                          const compName = c.policy?.plan?.company?.name || '';
                          const clientName = c.policy?.contact
                            ? `${c.policy.contact.firstName || ''} ${c.policy.contact.lastName || ''}`.trim()
                            : (c.notes?.match(/Client:\s*([^\n]+)/i)?.[1] || '—');
                          const cAmt = Number(c.amount || 0);
                          const isPaid = Boolean(c.isPaid);
                          const matchRemark = c.notes?.match(/Payment Remark:\s*([^\n]+)/i);
                          const remarkText = matchRemark ? matchRemark[1].trim() : (c.remark || (c.paidAt ? format(new Date(c.paidAt), 'dd/MM/yyyy') : '—'));

                          return (
                            <tr key={c.id || i} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-3 py-2.5">
                                {claimNum ? (
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                                        CLAIM
                                      </span>
                                      <span className="font-bold text-slate-900">Claim #{claimNum}</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{planName || pNum} {compName ? `(${compName})` : ''}</p>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800">
                                        POLICY
                                      </span>
                                      <span className="font-bold text-slate-900 font-mono text-[11px]">{pNum}</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{planName} {compName ? `(${compName})` : ''}</p>
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2.5 font-medium text-slate-700">
                                {clientName}
                              </td>
                              <td className="px-3 py-2.5 text-right font-extrabold text-emerald-600 whitespace-nowrap">
                                ₹{cAmt.toLocaleString('en-IN')}
                              </td>
                              <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                <span className={clsx(
                                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold",
                                  isPaid
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-rose-50 text-rose-700 border border-rose-200"
                                )}>
                                  {isPaid ? 'PAID' : 'UNPAID'}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-[11px] text-slate-600 max-w-[150px] truncate" title={remarkText}>
                                {remarkText}
                              </td>
                              <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                {!isPaid ? (
                                  <button
                                    type="button"
                                    onClick={() => setPayConfirm(c)}
                                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-indigo-700 hover:text-white bg-indigo-50 hover:bg-indigo-600 border border-indigo-200 transition-all cursor-pointer shadow-2xs"
                                  >
                                    Mark Paid
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-emerald-600 font-semibold">
                                    Settled
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Close Button Footer */}
              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedEmployeeSummary(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

    </div>
  );
}

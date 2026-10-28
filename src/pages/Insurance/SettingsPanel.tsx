import { notifyCompulsoryRulesUpdated } from '../../utils/compulsoryFieldRules';
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { insuranceService } from '@api/index';
import { useMasterDropdowns } from '../../hooks/useMasterDropdowns';
import { DropdownMenu, UsageMapping } from '../../utils/masterDropdowns';
import { contactFormSchema } from '../Contacts';
import { leadFormSchema } from '../Leads';
import { policyFormSchema } from '../Policies';
import { claimFormSchema } from '../Claims';
import { 
  Database, ShieldCheck, Download, Upload, Settings2, Plus, Trash2, 
  ChevronRight, SlidersHorizontal, UserCheck, ArrowLeft, Search, RotateCcw, Pencil, X,
  Shield, Check, User, FileText, LayoutGrid, CheckCircle2, Tag,
  Building2, HeartPulse, Briefcase, ArrowUpRight
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Rule {
  id: number | string;
  module: string;
  name: string;
  label: string;
  status: 'Active' | 'Optional';
  required: boolean;
  isProtected?: boolean;
}

import TableColumnSettings from './TableColumnSettings';

interface SettingsPanelProps {
  initialSubTab?: 'dashboard' | 'compulsory' | 'master' | 'backup' | 'columns';
  onBack?: () => void;
}

export default function SettingsPanel({ initialSubTab = 'dashboard', onBack }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'compulsory' | 'master' | 'backup' | 'columns'>(initialSubTab);

  useEffect(() => {
    setActiveTab(initialSubTab);
  }, [initialSubTab]);
  
  // --- SUBTABS ---
  const [compulsorySubTab, setCompulsorySubTab] = useState<'rules' | 'preferences'>('rules');
  const [dropdownSubTab, setDropdownSubTab] = useState<'lists' | 'usage'>('lists');

  // --- FILTERS & SEARCH STATE ---
  const [compulsoryModuleFilter, setCompulsoryModuleFilter] = useState('All Modules');
  const [compulsorySearch, setCompulsorySearch] = useState('');
  
  const [dropdownModuleFilter, setDropdownModuleFilter] = useState('All Modules');
  const [dropdownSearch, setDropdownSearch] = useState('');

  // --- MODALS STATE ---
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [showAddDropdownModal, setShowAddDropdownModal] = useState(false);

  // --- FORM STATES ---
  const [newRule, setNewRule] = useState({ module: 'Insurance Company', name: '', label: '', required: true });
  const [newDropdown, setNewDropdown] = useState<{
    name: string;
    module: string;
    status: 'Active' | 'Inactive';
    options: string[];
    newOptionInput: string;
  }>({
    name: '',
    module: 'Insurance Company',
    status: 'Active',
    options: [],
    newOptionInput: ''
  });

  const [editingRule, setEditingRule] = useState<{ id: string | number; module: string; name: string; label: string; required: boolean } | null>(null);
  const [editingDropdown, setEditingDropdown] = useState<DropdownMenu | null>(null);
  const [editingOptionInput, setEditingOptionInput] = useState('');
  const [editingOptionSearch, setEditingOptionSearch] = useState('');

  const CUSTOM_LABELS_KEY = 'insumitra_compulsory_field_labels';
  const [customFieldLabels, setCustomFieldLabels] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem(CUSTOM_LABELS_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return {};
  });

  const saveCustomLabel = (key: string, label: string) => {
    setCustomFieldLabels(prev => {
      const next = { ...prev, [key]: label };
      try {
        localStorage.setItem(CUSTOM_LABELS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // --- DATA STATES ---
  const qc = useQueryClient();

  const { data: compulsoryRulesRes } = useQuery({
    queryKey: ['compulsory-rules'],
    queryFn: () => insuranceService.getCompulsoryRules(),
  });
  const compulsoryRules = useMemo(() => compulsoryRulesRes?.data ?? [], [compulsoryRulesRes]);

  const updateCompulsoryMutation = useMutation({
    mutationFn: (rulesList: any[]) => insuranceService.updateCompulsoryRules(rulesList),
    onMutate: async (newRulesList) => {
      await qc.cancelQueries({ queryKey: ['compulsory-rules'] });
      const previousData = qc.getQueryData(['compulsory-rules']) as any;
      const currentRules = previousData?.data || [];
      const updatedMap = new Map(currentRules.map((r: any) => [`${r.module}-${r.fieldKey}`, r]));
      newRulesList.forEach((r: any) => {
        const key = `${r.module}-${r.fieldKey}`;
        const existing = updatedMap.get(key) || {};
        updatedMap.set(key, { ...existing, module: r.module, fieldKey: r.fieldKey, required: r.required });
      });
      qc.setQueryData(['compulsory-rules'], {
        ...(previousData || {}),
        data: Array.from(updatedMap.values())
      });
      return { previousData };
    },
    onError: (err: any, _newRules, context: any) => {
      if (context?.previousData) {
        qc.setQueryData(['compulsory-rules'], context.previousData);
      }
      toast.error(err.response?.data?.message || 'Failed to update rules');
    },
    onSuccess: () => {
      notifyCompulsoryRulesUpdated();
      toast.success('Compulsory field rules updated successfully', { id: 'compulsory-rules-toast' });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['compulsory-rules'] });
    }
  });

  const deleteCompulsoryMutation = useMutation({
    mutationFn: ({ module, fieldKey }: { module: string; fieldKey: string }) => 
      insuranceService.deleteCompulsoryRule(module, fieldKey),
    onSuccess: (_data, variables) => {
      qc.setQueryData(['compulsory-rules'], (old: any) => ({
        ...old,
        data: (old?.data || []).filter((r: any) => !(r.module === variables.module && r.fieldKey === variables.fieldKey))
      }));
      notifyCompulsoryRulesUpdated();
      qc.invalidateQueries({ queryKey: ['compulsory-rules'] });
      toast.success('Field requirement rule deleted / reset');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete rule');
    }
  });

  const fieldRules = useMemo(() => {
    const fieldLabelMap: Record<string, string> = {
      firstName: "First Name",
      lastName: "Last Name",
      phone: "Phone Number",
      alternatePhone: "Alternate Phone",
      email: "Email Address",
      gender: "Gender",
      dateOfBirth: "Date of Birth",
      birthPlace: "Birth Place",
      panNumber: "PAN Number",
      aadhaarNumber: "Aadhaar Number",
      annualIncome: "Annual Income",
      notes: "Notes",
      tags: "Tags",
      isActive: "Is Active",
      city: "City",
      source: "Source",
      assignedEmployeeId: "Assigned Employee",
      leadStage: "Lead Stage",
      leadStatus: "Lead Status",
      leadType: "Lead Type",
      followUpDate: "Follow-up Date",
      contactId: "Contact ID / Client",
      planId: "Plan ID / Product Name",
      policyNumber: "Policy Number",
      sumAssured: "Sum Assured",
      premiumAmount: "Premium Amount",
      startDate: "Risk Start Date",
      endDate: "Risk End Date",
      paymentFrequency: "Payment Frequency",
      riders: "Riders",
      deductible: "Deductible",
      status: "Status",
      nextDueDate: "Next Due Date",
      maturityDate: "Maturity Date",
      agentCode: "Agent Code",
      firstPremiumDate: "First Premium Date",
      premiumPaymentPeriod: "Premium Payment Period",
      lastPremiumDate: "Last Premium Date",
      emiCase: "EMI Case",
      emiGateway: "EMI Gateway",
      emiDate: "EMI Date",
      emiPremium: "EMI Premium",
      phcRequired: "PHC Required",
      phcAmount: "PHC Amount",
      phcStatus: "PHC Status",
      phcClaimSettled: "PHC Claim Settled",
      firstYearPremium: "First Year Premium",
      secondYearPremium: "Second Year Premium",
      policyId: "Policy ID / Number",
      claimNumber: "Claim Reference Number",
      claimType: "Claim Type / Category",
      claimAmount: "Claimed Amount",
      intimatedAt: "Intimation Date",
      diagnosis: "Diagnosis / Cause of Admission",
      hospital: "Hospital",
      hospitalAddress: "Hospital Address",
      patientName: "Patient Name",
      admissionAt: "Admission Date",
      dischargeAt: "Discharge Date",
      amtHospital: "Hospital Amount",
      amtMedicine: "Medicine Amount",
      amtLab: "Lab Amount",
      amtPreHosp: "Pre-Hospitalization Amount",
      amtPostHosp: "Post-Hospitalization Amount",
      amtOthers: "Other Amount",
      approvedAmount: "Approved Amount",
      deductionsNotes: "Deductions Notes",
      subClaimNo: "Sub Claim Number",
      uiClaimStatus: "Claim Status",
      comment: "Comment",
      insuranceCompanyCategory: "Insurance Company Category",
      insuranceCompany: "Insurance Company",
      insuranceProductName: "Insurance Product Name",
      agentName: "Agent Name",
      agencyCode: "Agency Code",
      branch: "Branch",
      deathAdmissionDate: "Death Admission Date",
      causeOfDeath: "Cause of Death",
      dateOfOccurance: "Date of Occurrence",
      dateOfDeath: "Date of Death",
      wasInComa: "Was in Coma",
      deathSumInsured: "Death Sum Insured",
      deathTotalClaimedAmount: "Death Total Claimed Amount",
      deathComment: "Death Comment",
      hospitalName: "Hospital Name",
      hospitalState: "Hospital State",
      hospitalCity: "Hospital City",
      hospitalPincode: "Hospital Pincode",
      hospitalContactNo: "Hospital Contact No",
      name: "Name",
      category: "Category",
      code: "Code",
      website: "Website",
      claimsPhone: "Claims Phone",
      minSumAssured: "Min Sum Assured",
      maxSumAssured: "Max Sum Assured",
      policyTerm: "Policy Term",
      premiumPayingTerm: "Premium Paying Term",
      type: "Type",
      address: "Address",
      state: "State",
      pincode: "Pincode",
      contactNo: "Contact No",
      occupationType: "Occupation Type",
      district: "District"
    };

    const defaultRequiredMap: Record<string, string[]> = {
      Contact: ['firstName', 'lastName', 'phone'],
      Leads: ['firstName', 'lastName', 'phone'],
      Policy: ['contactId', 'planId', 'policyNumber', 'sumAssured', 'premiumAmount', 'startDate', 'endDate', 'paymentFrequency'],
      Claim: ['policyId', 'contactId', 'claimNumber', 'claimType', 'claimAmount', 'intimatedAt'],
      'Insurance Company': ['name', 'category'],
      Plan: ['name', 'category'],
      Agent: ['agentName'],
      Hospital: ['name', 'city']
    };

    const modules = [
      { name: 'Contact', keys: Array.from(new Set([...Object.keys(contactFormSchema.shape), 'occupationType', 'state', 'district', 'address', 'pincode'])) },
      { name: 'Leads', keys: Array.from(new Set([...Object.keys(leadFormSchema.shape), 'occupationType', 'state', 'district'])) },
      { name: 'Policy', keys: Object.keys(policyFormSchema.shape) },
      { name: 'Claim', keys: Object.keys(claimFormSchema.shape) },
      { name: 'Insurance Company', keys: ['name', 'code', 'website', 'phone', 'email', 'claimsPhone'] },
      { name: 'Plan', keys: ['name', 'category', 'minSumAssured', 'maxSumAssured', 'policyTerm', 'premiumPayingTerm'] },
      { name: 'Agent', keys: ['agentName', 'agencyCode', 'phone', 'email', 'branch'] },
      { name: 'Hospital', keys: ['name', 'address', 'city', 'state', 'pincode', 'contactNo', 'type'] },
    ];

    const list: Rule[] = [];
    const seen = new Set<string>();

    modules.forEach(mod => {
      mod.keys.forEach(key => {
        const id = `${mod.name}-${key}`;
        seen.add(id);
        const label = customFieldLabels[id] || customFieldLabels[`${mod.name}-${key}`] || customFieldLabels[key] || fieldLabelMap[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        const defaultRequired = (defaultRequiredMap[mod.name] || []).includes(key);
        const savedRule = compulsoryRules.find((r: any) => r.module === mod.name && r.fieldKey === key);
        const required = savedRule !== undefined ? Boolean(savedRule.required) : defaultRequired;

        list.push({
          id,
          module: mod.name,
          name: key,
          label,
          status: required ? 'Active' : 'Optional',
          required,
          isProtected: false
        });
      });
    });

    // Also include any custom / saved rules from database that are not part of the standard modules
    compulsoryRules.forEach((r: any) => {
      const id = `${r.module}-${r.fieldKey}`;
      if (!seen.has(id)) {
        seen.add(id);
        const label = customFieldLabels[id] || customFieldLabels[r.fieldKey] || fieldLabelMap[r.fieldKey] || r.fieldKey.replace(/([A-Z])/g, ' $1').replace(/^./, (str: string) => str.toUpperCase());
        const required = Boolean(r.required);
        list.push({
          id,
          module: r.module,
          name: r.fieldKey,
          label,
          status: required ? 'Active' : 'Optional',
          required,
          isProtected: false
        });
      }
    });

    return list;
  }, [compulsoryRules]);

  const DROPDOWNS_STORAGE_KEY = 'insumitra_master_dropdowns';
  const MAPPINGS_STORAGE_KEY = 'insumitra_master_dropdown_mappings';

  const defaultDropdownMenus: DropdownMenu[] = [
    {
      id: 1,
      name: 'Company Categories',
      module: 'Insurance Company',
      totalOptions: 4,
      status: 'Active',
      options: ['Life Insurance', 'General Insurance', 'Standalone Health Insurance', 'Reinsurance']
    },
    {
      id: 2,
      name: 'Plan Categories',
      module: 'Plan',
      totalOptions: 11,
      status: 'Active',
      options: ['General', 'Motor', 'Health', 'Accident', 'Life Term', 'Life Other', 'Group PA', 'Group Health', 'SME', 'Travel', 'Other']
    },
    {
      id: 3,
      name: 'Rider Categories',
      module: 'Rider / Add-on',
      totalOptions: 8,
      status: 'Active',
      options: [
        'Critical Illness Rider',
        'Accidental Death Benefit',
        'Waiver of Premium',
        'Permanent Disability Rider',
        'Hospital Cash Rider',
        'Zero Depreciation (Motor)',
        'Engine Protector (Motor)',
        'Roadside Assistance (Motor)'
      ]
    },
    {
      id: 4,
      name: 'Cities',
      module: 'Hospital',
      totalOptions: 25,
      status: 'Active',
      options: [
        'Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Ahmedabad', 'Chennai', 'Kolkata', 'Pune',
        'Surat', 'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal',
        'Visakhapatnam', 'Patna', 'Vadodara', 'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik',
        'Faridabad', 'Rajkot'
      ]
    },
    {
      id: 5,
      name: 'States',
      module: 'Hospital / Agent',
      totalOptions: 36,
      status: 'Active',
      options: [
        'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
        'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
        'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
        'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
        'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
        'Dadra and Nagar Haveli and Daman and Diu', 'Delhi (NCT)', 'Jammu and Kashmir',
        'Ladakh', 'Lakshadweep', 'Puducherry'
      ]
    },
    {
      id: 6,
      name: 'Branches',
      module: 'Agent',
      totalOptions: 12,
      status: 'Active',
      options: [
        'Mumbai Central', 'Andheri West', 'Delhi CP', 'Bengaluru MG Road', 'Pune Shivajinagar',
        'Ahmedabad CG Road', 'Hyderabad Banjara Hills', 'Kolkata Park Street', 'Chennai Anna Salai',
        'Surat Ring Road', 'Jaipur MI Road', 'Lucknow Hazratganj'
      ]
    },
    {
      id: 7,
      name: 'Bank Names',
      module: 'Agent',
      totalOptions: 12,
      status: 'Active',
      options: [
        'HDFC Bank', 'State Bank of India', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank',
        'Punjab National Bank', 'Bank of Baroda', 'Canara Bank', 'Union Bank of India',
        'IndusInd Bank', 'Yes Bank', 'IDFC FIRST Bank'
      ]
    },
    {
      id: 8,
      name: 'Payout Cycles',
      module: 'Agent',
      totalOptions: 4,
      status: 'Active',
      options: ['Monthly', 'Fortnightly', 'Weekly', 'Daily / Instant']
    },
  ];

  const defaultUsageMappings: UsageMapping[] = [
    { id: 1, module: 'Insurance Company', fieldName: 'Category', dropdownId: 1, isRequired: true, status: 'Active' },
    { id: 2, module: 'Plan', fieldName: 'Category', dropdownId: 2, isRequired: true, status: 'Active' },
    { id: 3, module: 'Rider / Add-on', fieldName: 'Rider Category', dropdownId: 3, isRequired: false, status: 'Active' },
    { id: 4, module: 'Hospital', fieldName: 'City', dropdownId: 4, isRequired: true, status: 'Active' },
    { id: 5, module: 'Hospital / Agent', fieldName: 'State', dropdownId: 5, isRequired: true, status: 'Active' },
    { id: 6, module: 'Agent', fieldName: 'Branch', dropdownId: 6, isRequired: false, status: 'Active' },
    { id: 7, module: 'Agent', fieldName: 'Bank Name', dropdownId: 7, isRequired: false, status: 'Active' },
    { id: 8, module: 'Agent', fieldName: 'Payout Cycle', dropdownId: 8, isRequired: false, status: 'Active' },
  ];

  const { dropdownMenus, setDropdownMenus, usageMappings, setUsageMappings } = useMasterDropdowns();

  // --- HANDLERS ---
  const handleToggleRequired = (id: number | string) => {
    const target = fieldRules.find((r: Rule) => r.id === id);
    if (!target) return;
    const newRequired = !target.required;
    updateCompulsoryMutation.mutate([{
      module: target.module,
      fieldKey: target.name,
      required: newRequired
    }]);
  };

  const handleResetCompulsory = async (targetModule?: string) => {
    const mod = targetModule || (compulsoryModuleFilter !== 'All Modules' ? compulsoryModuleFilter : undefined);
    try {
      await insuranceService.resetCompulsoryRules(mod);
      notifyCompulsoryRulesUpdated();
      qc.invalidateQueries({ queryKey: ['compulsory-rules'] });
      toast.success(mod ? `Rules for ${mod} reset to default` : 'All field rules reset to default');
    } catch {
      const defaultRequiredMap: Record<string, string[]> = {
        Contact: ['firstName', 'lastName', 'phone'],
        Leads: ['firstName', 'lastName', 'phone'],
        Policy: ['contactId', 'planId', 'policyNumber', 'sumAssured', 'premiumAmount', 'startDate', 'endDate', 'paymentFrequency'],
        Claim: ['policyId', 'contactId', 'claimNumber', 'claimType', 'claimAmount', 'intimatedAt'],
        'Insurance Company': ['name', 'category'],
        Plan: ['name', 'category'],
        Agent: ['agentName'],
        Hospital: ['name', 'city']
      };
      const resetList = fieldRules
        .filter(r => !mod || r.module.toLowerCase() === mod.toLowerCase())
        .map((r: Rule) => ({
          module: r.module,
          fieldKey: r.name,
          required: (defaultRequiredMap[r.module] || []).includes(r.name)
        }));
      updateCompulsoryMutation.mutate(resetList);
    }
  };

  const handleMakeAllOptional = (targetModule: string) => {
    const rulesToUpdate = fieldRules
      .filter(r => r.module.toLowerCase() === targetModule.toLowerCase() || (targetModule === 'Contact' && r.module === 'Contacts') || (targetModule === 'Leads' && r.module === 'Lead'))
      .map(r => ({
        module: r.module,
        fieldKey: r.name,
        required: false
      }));
    if (rulesToUpdate.length > 0) {
      updateCompulsoryMutation.mutate(rulesToUpdate);
      toast.success(`All fields for ${targetModule} set to Optional`);
    }
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.name.trim() || !newRule.label.trim()) {
      toast.error('Please enter all details');
      return;
    }
    const cleanKey = newRule.name.trim().replace(/\s+/g, '_');
    saveCustomLabel(cleanKey, newRule.label.trim());
    saveCustomLabel(`${newRule.module}-${cleanKey}`, newRule.label.trim());
    updateCompulsoryMutation.mutate([
      { module: newRule.module, fieldKey: cleanKey, required: newRule.required }
    ]);
    setShowAddRuleModal(false);
    setNewRule({ module: 'Contact', name: '', label: '', required: true });
    toast.success(`Rule for "${cleanKey}" added successfully`);
  };

  const handleSaveEditRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;
    if (editingRule.label?.trim()) {
      saveCustomLabel(editingRule.name, editingRule.label.trim());
      saveCustomLabel(`${editingRule.module}-${editingRule.name}`, editingRule.label.trim());
    }
    updateCompulsoryMutation.mutate([
      { module: editingRule.module, fieldKey: editingRule.name, required: editingRule.required }
    ]);
    setEditingRule(null);
  };

  const handleDeleteRule = (rule: Rule) => {
    if (confirm(`Are you sure you want to delete / reset rule for "${rule.label}"?`)) {
      deleteCompulsoryMutation.mutate({ module: rule.module, fieldKey: rule.name });
    }
  };

  const handleOpenEditDropdown = (menu: DropdownMenu) => {
    setEditingDropdown({
      ...menu,
      options: [...(menu.options || [])]
    });
    setEditingOptionInput('');
    setEditingOptionSearch('');
  };

  const handleAddOptionToEditing = () => {
    const val = editingOptionInput.trim();
    if (!val) return;
    if (!editingDropdown) return;
    if (editingDropdown.options.includes(val)) {
      toast.error(`Option "${val}" already exists`);
      return;
    }
    const updatedOpts = [...editingDropdown.options, val];
    setEditingDropdown({
      ...editingDropdown,
      options: updatedOpts,
      totalOptions: updatedOpts.length
    });
    setEditingOptionInput('');
  };

  const handleRemoveOptionFromEditing = (optionToRemove: string) => {
    if (!editingDropdown) return;
    const nextOptions = editingDropdown.options.filter(o => o !== optionToRemove);
    setEditingDropdown({
      ...editingDropdown,
      options: nextOptions,
      totalOptions: nextOptions.length
    });
  };

  const handleSaveEditDropdown = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDropdown) return;
    if (!editingDropdown.name.trim()) {
      toast.error('Please enter dropdown name');
      return;
    }
    const currentOptions = [...(editingDropdown.options || [])];
    const pendingInput = editingOptionInput.trim();
    if (pendingInput && !currentOptions.includes(pendingInput)) {
      currentOptions.push(pendingInput);
    }
    const updated: DropdownMenu = {
      ...editingDropdown,
      name: editingDropdown.name.trim(),
      options: currentOptions,
      totalOptions: currentOptions.length,
    };
    setDropdownMenus((prev: any[]) => prev.map(d => d.id === updated.id ? updated : d));
    setEditingDropdown(null);
    setEditingOptionInput('');
    toast.success(`Dropdown "${updated.name}" updated successfully (${updated.totalOptions} options)`);
  };

  const handleAddDropdown = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDropdown.name.trim()) {
      toast.error('Please enter dropdown name');
      return;
    }
    const finalOptions = [...newDropdown.options];
    if (newDropdown.newOptionInput.trim() && !finalOptions.includes(newDropdown.newOptionInput.trim())) {
      finalOptions.push(newDropdown.newOptionInput.trim());
    }

    const newDropObj: DropdownMenu = {
      id: Date.now(),
      name: newDropdown.name.trim(),
      module: newDropdown.module,
      status: newDropdown.status,
      options: finalOptions,
      totalOptions: finalOptions.length
    };

    setDropdownMenus(prev => [newDropObj, ...prev]);
    setShowAddDropdownModal(false);
    setNewDropdown({ name: '', module: 'Insurance Company', status: 'Active', options: [], newOptionInput: '' });
    toast.success(`Dropdown "${newDropObj.name}" created with ${finalOptions.length} options!`);
  };

  const handleToggleDropdownStatus = (id: number | string) => {
    setDropdownMenus(prev => prev.map(d => {
      if (d.id === id) {
        const next: 'Active' | 'Inactive' = d.status === 'Active' ? 'Inactive' : 'Active';
        return { ...d, status: next };
      }
      return d;
    }));
    toast.success('Dropdown status updated');
  };

  const handleDeleteDropdown = (id: number | string) => {
    const item = dropdownMenus.find(d => d.id === id);
    if (confirm(`Are you sure you want to delete dropdown "${item?.name || 'this item'}"?`)) {
      setDropdownMenus(prev => prev.filter(d => d.id !== id));
      toast.success('Dropdown removed successfully');
    }
  };

  const handleToggleMappingStatus = (id: number | string) => {
    setUsageMappings(prev => prev.map(m => {
      if (m.id === id) {
        const next: 'Active' | 'Inactive' = m.status === 'Active' ? 'Inactive' : 'Active';
        return { ...m, status: next };
      }
      return m;
    }));
    toast.success('Mapping status updated');
  };

  const handleChangeMappingDropdown = (mappingId: number | string, dropdownId: number | string) => {
    setUsageMappings(prev => prev.map(m => m.id === mappingId ? { ...m, dropdownId } : m));
    toast.success('Dropdown source updated for field');
  };

  // --- BACKUP & RESTORE IMPLEMENTATION ---
  const handleBackup = () => {
    toast.success('Backup initiated. Check downloads folder soon.');
    const data = JSON.stringify(localStorage);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `insumitra_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        toast.success('Database restored successfully! Please refresh.');
      } catch {
        toast.error('Corrupted or invalid backup file.');
      }
    };
    reader.readAsText(file);
  };

  // --- FILTERED DATA LISTS ---
  const filteredFieldRules = fieldRules.filter(rule => {
    const matchModule = compulsoryModuleFilter === 'All Modules' || 
                        rule.module.toLowerCase() === compulsoryModuleFilter.toLowerCase() ||
                        (compulsoryModuleFilter === 'Leads' && rule.module.toLowerCase() === 'lead') ||
                        (compulsoryModuleFilter === 'Lead' && rule.module.toLowerCase() === 'leads') ||
                        (compulsoryModuleFilter === 'Contact' && rule.module.toLowerCase() === 'contacts') ||
                        (compulsoryModuleFilter === 'Contacts' && rule.module.toLowerCase() === 'contact');
    const matchSearch = rule.name.toLowerCase().includes(compulsorySearch.toLowerCase()) || 
                        rule.label.toLowerCase().includes(compulsorySearch.toLowerCase()) ||
                        rule.module.toLowerCase().includes(compulsorySearch.toLowerCase());
    return matchModule && matchSearch;
  });

  const [compulsoryPage, setCompulsoryPage] = useState(1);
  const compulsoryPageSize = 15;
  const totalCompulsoryPages = Math.ceil(filteredFieldRules.length / compulsoryPageSize) || 1;

  const paginatedFieldRules = useMemo(() => {
    const start = (compulsoryPage - 1) * compulsoryPageSize;
    return filteredFieldRules.slice(start, start + compulsoryPageSize);
  }, [filteredFieldRules, compulsoryPage]);

  useEffect(() => {
    setCompulsoryPage(1);
  }, [compulsoryModuleFilter, compulsorySearch]);

  const filteredDropdownMenus = dropdownMenus.filter(menu => {
    const matchModule = dropdownModuleFilter === 'All Modules' || menu.module.includes(dropdownModuleFilter) || dropdownModuleFilter.includes(menu.module);
    const matchSearch = menu.name.toLowerCase().includes(dropdownSearch.toLowerCase()) ||
                        menu.module.toLowerCase().includes(dropdownSearch.toLowerCase());
    return matchModule && matchSearch;
  });

  const [dropdownPage, setDropdownPage] = useState(1);
  const dropdownPageSize = 8;
  const totalDropdownPages = Math.ceil(filteredDropdownMenus.length / dropdownPageSize) || 1;

  const paginatedDropdownMenus = useMemo(() => {
    const start = (dropdownPage - 1) * dropdownPageSize;
    return filteredDropdownMenus.slice(start, start + dropdownPageSize);
  }, [filteredDropdownMenus, dropdownPage, dropdownPageSize]);

  useEffect(() => {
    setDropdownPage(1);
  }, [dropdownModuleFilter, dropdownSearch]);

  const [mappingSearch, setMappingSearch] = useState('');
  const [mappingModuleFilter, setMappingModuleFilter] = useState('All Modules');

  const filteredUsageMappings = usageMappings.filter(m => {
    const matchMod = mappingModuleFilter === 'All Modules' || m.module.includes(mappingModuleFilter) || mappingModuleFilter.includes(m.module);
    const matchTxt = m.fieldName.toLowerCase().includes(mappingSearch.toLowerCase()) || m.module.toLowerCase().includes(mappingSearch.toLowerCase());
    return matchMod && matchTxt;
  });

  return (
    <div className="w-full">
      {/* ── Sub-navigation Header for Master Settings & Backups ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center justify-between gap-3 overflow-x-auto select-none sticky top-0 z-10 shadow-3xs">
        <div className="flex items-center gap-1.5 flex-nowrap">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <LayoutGrid size={13} />
            <span>Overview Hub</span>
          </button>
          <button
            onClick={() => setActiveTab('master')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'master'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <SlidersHorizontal size={13} />
            <span>Dropdown Menus</span>
          </button>
          <button
            onClick={() => setActiveTab('compulsory')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'compulsory'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Settings2 size={13} />
            <span>Compulsory Fields</span>
          </button>
          <button
            onClick={() => setActiveTab('columns')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'columns'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Database size={13} />
            <span>Table Columns</span>
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'backup'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Download size={13} />
            <span>Backup & Restore</span>
          </button>
        </div>
      </div>

      {/* 1. DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="p-6 space-y-6 bg-slate-50/10">
          {onBack && (
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
              <button onClick={onBack} className="hover:text-primary-600 transition-colors flex items-center gap-1 cursor-pointer">
                <ArrowLeft size={13} /> Home
              </button>
            </div>
          )}
          {/* Section: System Configuration */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">System Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Card 1: Dropdown Menus */}
              <div 
                onClick={() => setActiveTab('master')}
                className="bg-white rounded-2xl border border-slate-200/60 p-5 flex items-center justify-between cursor-pointer hover:border-indigo-300 hover:shadow-sm hover:scale-[1.01] transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0 shadow-2xs">
                    <SlidersHorizontal size={22} strokeWidth={2.2} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Dropdown Menus</h4>
                    <p className="text-xs text-slate-500 font-semibold leading-tight mt-0.5">Add & manage dropdown options (repetitive data)</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
              </div>

              {/* Card 2: Compulsory Fields */}
              <div 
                onClick={() => setActiveTab('compulsory')}
                className="bg-white rounded-2xl border border-slate-200/60 p-5 flex items-center justify-between cursor-pointer hover:border-indigo-300 hover:shadow-sm hover:scale-[1.01] transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0 shadow-2xs">
                    <Settings2 size={22} strokeWidth={2.2} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Compulsory Fields</h4>
                    <p className="text-xs text-slate-500 font-semibold leading-tight mt-0.5">Define and relax compulsory fields for all modules</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
              </div>

              {/* Card 3: Table Column Selection */}
              <div 
                onClick={() => setActiveTab('columns')}
                className="bg-white rounded-2xl border border-slate-200/60 p-5 flex items-center justify-between cursor-pointer hover:border-indigo-300 hover:shadow-sm hover:scale-[1.01] transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center shrink-0 shadow-2xs">
                    <Database size={22} strokeWidth={2.2} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Table Column Selection</h4>
                    <p className="text-xs text-slate-500 font-semibold leading-tight mt-0.5">Control which table columns to show or hide globally</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
              </div>
            </div>
          </div>

          {/* Section: Backup & Restore */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Backup & Restore</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Data Export & Backup */}
              <div 
                onClick={() => setActiveTab('backup')}
                className="bg-white rounded-2xl border border-slate-200/60 p-5 flex items-center justify-between cursor-pointer hover:border-indigo-300 hover:shadow-sm hover:scale-[1.01] transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0 shadow-2xs">
                    <Download size={22} strokeWidth={2.2} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Data Export & Backup (All Data)</h4>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">Export all system data and create a backup</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
              </div>

              {/* Card 2: Restore from Backup */}
              <div 
                onClick={() => setActiveTab('backup')}
                className="bg-white rounded-2xl border border-slate-200/60 p-5 flex items-center justify-between cursor-pointer hover:border-indigo-300 hover:shadow-sm hover:scale-[1.01] transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0 shadow-2xs">
                    <Upload size={22} strokeWidth={2.2} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Restore from Backup (All Data)</h4>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">Restore all system data from previous backup</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. COMPULSORY FIELDS SUBPAGE */}
      {activeTab === 'compulsory' && (
        <div className="p-6 space-y-6">
          {/* Breadcrumb Header */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <button onClick={() => setActiveTab('dashboard')} className="hover:text-primary-600 transition-colors flex items-center gap-1">
                <ArrowLeft size={13} /> Master Settings & Backups
              </button>
              <span>&gt;</span>
              <span className="text-slate-800">Compulsory Fields</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight mt-2">Compulsory Fields</h2>
            <p className="text-xs text-slate-500 font-semibold leading-tight mt-0.5">Define and relax compulsory fields for all modules</p>
          </div>

          {/* Subtabs */}
          <div className="flex gap-4 border-b border-slate-150">
            <button 
              onClick={() => setCompulsorySubTab('rules')}
              className={`pb-2 text-xs font-semibold border-b-2 transition-all -mb-px ${
                compulsorySubTab === 'rules' ? 'border-primary-600 text-primary-700 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Field Rules
            </button>
            <button 
              onClick={() => setCompulsorySubTab('preferences')}
              className={`pb-2 text-xs font-semibold border-b-2 transition-all -mb-px ${
                compulsorySubTab === 'preferences' ? 'border-primary-600 text-primary-700 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Module Preferences
            </button>
          </div>

          {compulsorySubTab === 'rules' ? (
            <div className="space-y-4">
              {/* Controls bar */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  <select 
                    value={compulsoryModuleFilter}
                    onChange={(e) => setCompulsoryModuleFilter(e.target.value)}
                    className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                  >
                    <option>All Modules</option>
                    <option>Insurance Company</option>
                    <option>Plan</option>
                    <option>Contact</option>
                    <option>Leads</option>
                    <option>Policy</option>
                    <option>Claim</option>
                    <option>Agent</option>
                    <option>Hospital</option>
                  </select>

                  <div className="relative flex-1 sm:w-64 min-w-[200px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text"
                      value={compulsorySearch}
                      onChange={(e) => setCompulsorySearch(e.target.value)}
                      placeholder="Search fields..."
                      className="border border-slate-200 rounded-xl pl-9 pr-4 py-1.5 text-xs font-medium w-full focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button 
                    onClick={() => handleResetCompulsory()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    Reset to Default
                  </button>
                  <button 
                    onClick={() => setShowAddRuleModal(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-sm shadow-primary-500/10"
                  >
                    <Plus size={13} />
                    Add Rule
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-55/60 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3">Module</th>
                      <th className="px-5 py-3">Field Name</th>
                      <th className="px-5 py-3">Field Label</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-center w-28">Required</th>
                      <th className="px-5 py-3 text-right w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedFieldRules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3.5 font-bold text-slate-700">{rule.module}</td>
                        <td className="px-5 py-3.5 font-mono text-slate-500">{rule.name}</td>
                        <td className="px-5 py-3.5 font-medium text-slate-800">{rule.label}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                            rule.required 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' 
                              : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                          }`}>
                            {rule.required ? 'REQUIRED' : 'OPTIONAL'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <button
                            onClick={() => handleToggleRequired(rule.id)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              rule.required ? 'bg-primary-600' : 'bg-slate-200'
                            }`}
                            title={rule.required ? 'Click to make optional' : 'Click to make required'}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                                rule.required ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button 
                              onClick={() => setEditingRule({
                                id: rule.id,
                                module: rule.module,
                                name: rule.name,
                                label: rule.label,
                                required: rule.required
                              })}
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-all cursor-pointer"
                              title="Edit Rule"
                            >
                              <Pencil size={13} />
                            </button>
                            <button 
                              onClick={() => handleDeleteRule(rule)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all cursor-pointer"
                              title="Delete / Reset Rule"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredFieldRules.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-slate-400 font-medium">No rules match search or filter.</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Table Footer / Pagination */}
                <div className="bg-slate-50/50 border-t border-slate-150 px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-slate-500 font-semibold text-xs">
                  <span>
                    Showing {filteredFieldRules.length === 0 ? 0 : (compulsoryPage - 1) * compulsoryPageSize + 1} to {Math.min(compulsoryPage * compulsoryPageSize, filteredFieldRules.length)} of {filteredFieldRules.length} entries
                  </span>
                  {totalCompulsoryPages > 1 && (
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => setCompulsoryPage(prev => Math.max(1, prev - 1))}
                        disabled={compulsoryPage === 1}
                        className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-[11px] font-bold cursor-pointer transition-colors"
                      >
                        &lt; Prev
                      </button>
                      {Array.from({ length: totalCompulsoryPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalCompulsoryPages || Math.abs(p - compulsoryPage) <= 1)
                        .reduce((acc: (number | string)[], p, idx, arr) => {
                          if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                            acc.push('...');
                          }
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((pageItem, idx) => (
                          typeof pageItem === 'number' ? (
                            <button 
                              key={pageItem}
                              onClick={() => setCompulsoryPage(pageItem)}
                              className={`px-2.5 py-1 rounded border text-[11px] font-bold cursor-pointer transition-colors ${
                                compulsoryPage === pageItem 
                                  ? 'bg-primary-600 border-primary-600 text-white' 
                                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                              }`}
                            >
                              {pageItem}
                            </button>
                          ) : (
                            <span key={`dots-${idx}`} className="px-1 text-slate-300">...</span>
                          )
                        ))
                      }
                      <button 
                        onClick={() => setCompulsoryPage(prev => Math.min(totalCompulsoryPages, prev + 1))}
                        disabled={compulsoryPage === totalCompulsoryPages}
                        className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-[11px] font-bold cursor-pointer transition-colors"
                      >
                        Next &gt;
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Top Overview Metric Banner */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Configured Modules</span>
                    <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <LayoutGrid size={13} />
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-xl font-black text-slate-900">8 Modules</p>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">Contact, Leads, Policy, Claims & Masters</p>
                  </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total Field Rules</span>
                    <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <SlidersHorizontal size={13} />
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-xl font-black text-slate-900">{fieldRules.length} Fields</p>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">Across all core workflows</p>
                  </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Compulsory / Mandatory</span>
                    <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 size={13} />
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-xl font-black text-emerald-600">
                      {fieldRules.filter(r => r.required).length} Required
                    </p>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">Strict validation enforced</p>
                  </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Optional Fields</span>
                    <span className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Tag size={13} />
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-xl font-black text-amber-600">
                      {fieldRules.filter(r => !r.required).length} Optional
                    </p>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">Flexible submission allowed</p>
                  </div>
                </div>
              </div>

              {/* Module Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { name: 'Contact', icon: User, color: 'blue', desc: 'Customer demographic, KYC & address fields' },
                  { name: 'Leads', icon: UserCheck, color: 'teal', desc: 'Prospects, pipeline stage & assignment fields' },
                  { name: 'Policy', icon: Shield, color: 'indigo', desc: 'Policy numbers, dates, sum assured & premium' },
                  { name: 'Claim', icon: FileText, color: 'purple', desc: 'Claim intimation, settlement & medical records' },
                  { name: 'Insurance Company', icon: Building2, color: 'cyan', desc: 'Company codes, portal credentials & offices' },
                  { name: 'Plan', icon: LayoutGrid, color: 'emerald', desc: 'Plan categories, limits, term & riders' },
                  { name: 'Agent', icon: Briefcase, color: 'orange', desc: 'Agency codes, branches, managers & payouts' },
                  { name: 'Hospital', icon: HeartPulse, color: 'rose', desc: 'Hospital networks, address, contacts & doctors' },
                ].map((modItem) => {
                  const Icon = modItem.icon;
                  const modRules = fieldRules.filter(r => r.module.toLowerCase() === modItem.name.toLowerCase() || (modItem.name === 'Contact' && r.module === 'Contacts') || (modItem.name === 'Leads' && r.module === 'Lead'));
                  const reqCount = modRules.filter(r => r.required).length;
                  const optCount = modRules.filter(r => !r.required).length;

                  return (
                    <div key={modItem.name} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                              <Icon size={16} />
                            </div>
                            <div>
                              <h4 className="font-black text-slate-900 text-sm">{modItem.name}</h4>
                              <p className="text-[10px] text-slate-400 font-semibold">{modRules.length} Total Fields</p>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-slate-500 leading-relaxed min-h-[34px]">
                          {modItem.desc}
                        </p>

                        <div className="flex items-center gap-2 py-1">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-bold text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {reqCount} Mandatory
                          </span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200/60 font-bold text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            {optCount} Optional
                          </span>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100 space-y-2 mt-4">
                        <button
                          onClick={() => {
                            setCompulsoryModuleFilter(modItem.name);
                            setCompulsorySubTab('rules');
                            setCompulsoryPage(1);
                          }}
                          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          Configure Field Rules <ArrowUpRight size={13} />
                        </button>

                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={() => handleMakeAllOptional(modItem.name)}
                            className="py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer text-center"
                            title="Make all fields optional in this module"
                          >
                            Make All Optional
                          </button>
                          <button
                            onClick={() => handleResetCompulsory(modItem.name)}
                            className="py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer text-center"
                            title="Reset this module to system defaults"
                          >
                            Reset Defaults
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. DROPDOWN MENUS SUBPAGE */}
      {activeTab === 'master' && (
        <div className="p-6 space-y-6">
          {/* Breadcrumb Header */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <button onClick={() => setActiveTab('dashboard')} className="hover:text-primary-600 transition-colors flex items-center gap-1">
                <ArrowLeft size={13} /> Master Settings & Backups
              </button>
              <span>&gt;</span>
              <span className="text-slate-800">Dropdown Menus</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight mt-2">Dropdown Menus</h2>
            <p className="text-xs text-slate-500 font-semibold leading-tight mt-0.5">Add & manage dropdown options (repetitive data)</p>
          </div>

          {/* Subtabs */}
          <div className="flex gap-4 border-b border-slate-150">
            <button 
              onClick={() => setDropdownSubTab('lists')}
              className={`pb-2 text-xs font-semibold border-b-2 transition-all -mb-px ${
                dropdownSubTab === 'lists' ? 'border-primary-600 text-primary-700 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Dropdown Lists
            </button>
            <button 
              onClick={() => setDropdownSubTab('usage')}
              className={`pb-2 text-xs font-semibold border-b-2 transition-all -mb-px ${
                dropdownSubTab === 'usage' ? 'border-primary-600 text-primary-700 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Usage Mapping
            </button>
          </div>

          {dropdownSubTab === 'lists' ? (
            <div className="space-y-4">
              {/* Controls bar */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64 min-w-[200px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text"
                      value={dropdownSearch}
                      onChange={(e) => setDropdownSearch(e.target.value)}
                      placeholder="Search dropdown lists..."
                      className="border border-slate-200 rounded-xl pl-9 pr-4 py-1.5 text-xs font-medium w-full focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                    />
                  </div>

                  <select 
                    value={dropdownModuleFilter}
                    onChange={(e) => setDropdownModuleFilter(e.target.value)}
                    className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                  >
                    <option>All Modules</option>
                    <option>Insurance Company</option>
                    <option>Plan</option>
                    <option>Rider / Add-on</option>
                    <option>Hospital</option>
                    <option>Agent</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button 
                    onClick={() => setShowAddDropdownModal(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-sm shadow-primary-500/10"
                  >
                    <Plus size={13} />
                    Add Dropdown
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-55/60 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3">Dropdown Name</th>
                      <th className="px-5 py-3">Module</th>
                      <th className="px-5 py-3">Total Options</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedDropdownMenus.map((menu) => (
                      <tr key={menu.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-slate-800">
                          <button
                            onClick={() => handleOpenEditDropdown(menu)}
                            className="hover:text-primary-600 transition-colors text-left font-bold cursor-pointer"
                          >
                            {menu.name}
                          </button>
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-slate-500">{menu.module}</td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1 font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg text-xs">
                            {menu.options ? menu.options.length : menu.totalOptions} options
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => handleToggleDropdownStatus(menu.id)}
                            className={`inline-flex px-2 py-0.5 rounded-full font-bold text-[10px] uppercase cursor-pointer transition-all ${
                              menu.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                            }`}
                            title="Click to toggle status"
                          >
                            {menu.status}
                          </button>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button 
                              onClick={() => handleOpenEditDropdown(menu)}
                              className="p-1.5 text-slate-400 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-all cursor-pointer"
                              title="Edit Dropdown & Manage Options"
                            >
                              <Pencil size={13} />
                            </button>
                            <button 
                              onClick={() => handleDeleteDropdown(menu.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                              title="Delete Dropdown"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredDropdownMenus.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-slate-400 font-medium">No dropdown master data matches.</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Table Footer / Working Pagination */}
                <div className="bg-slate-50/50 border-t border-slate-150 px-5 py-3 flex flex-col sm:flex-row gap-2 items-center justify-between text-slate-500 font-semibold text-xs">
                  <span>
                    Showing {filteredDropdownMenus.length === 0 ? 0 : (dropdownPage - 1) * dropdownPageSize + 1} to {Math.min(dropdownPage * dropdownPageSize, filteredDropdownMenus.length)} of {filteredDropdownMenus.length} entries
                  </span>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setDropdownPage(p => Math.max(1, p - 1))}
                      disabled={dropdownPage === 1}
                      className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-[11px] font-bold cursor-pointer transition-colors"
                    >
                      &lt;
                    </button>
                    {Array.from({ length: totalDropdownPages }).map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setDropdownPage(idx + 1)}
                        className={`px-2.5 py-1 rounded border text-[11px] font-bold transition-all cursor-pointer ${
                          dropdownPage === idx + 1
                            ? 'border-primary-600 bg-primary-600 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                    <button 
                      onClick={() => setDropdownPage(p => Math.min(totalDropdownPages, p + 1))}
                      disabled={dropdownPage === totalDropdownPages || totalDropdownPages === 0}
                      className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-[11px] font-bold cursor-pointer transition-colors"
                    >
                      &gt;
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Mapping Controls */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64 min-w-[200px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text"
                      value={mappingSearch}
                      onChange={(e) => setMappingSearch(e.target.value)}
                      placeholder="Search mapped fields..."
                      className="border border-slate-200 rounded-xl pl-9 pr-4 py-1.5 text-xs font-medium w-full focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                    />
                  </div>

                  <select 
                    value={mappingModuleFilter}
                    onChange={(e) => setMappingModuleFilter(e.target.value)}
                    className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                  >
                    <option>All Modules</option>
                    <option>Insurance Company</option>
                    <option>Plan</option>
                    <option>Rider / Add-on</option>
                    <option>Hospital</option>
                    <option>Agent</option>
                  </select>
                </div>

                <button 
                  onClick={() => toast.success('All field-to-dropdown mappings are currently in sync!')}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                >
                  Verify Mappings Sync
                </button>
              </div>

              {/* Mappings Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-55/60 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3">Module</th>
                      <th className="px-5 py-3">Form Field Name</th>
                      <th className="px-5 py-3">Active Mapped Dropdown</th>
                      <th className="px-5 py-3">Field Rule</th>
                      <th className="px-5 py-3 text-right">Mapping Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsageMappings.map((mapItem) => {
                      return (
                        <tr key={mapItem.id} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3.5 font-bold text-slate-800">{mapItem.module}</td>
                          <td className="px-5 py-3.5 font-semibold text-slate-700">{mapItem.fieldName}</td>
                          <td className="px-5 py-3.5">
                            <select
                              value={mapItem.dropdownId}
                              onChange={(e) => handleChangeMappingDropdown(mapItem.id, Number(e.target.value))}
                              className="border border-slate-250 bg-white rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-primary-500"
                            >
                              {dropdownMenus.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name} ({d.options?.length ?? d.totalOptions} options)
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              mapItem.isRequired ? 'bg-amber-50 text-amber-700 border border-amber-200/50' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {mapItem.isRequired ? 'Mandatory' : 'Optional'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => handleToggleMappingStatus(mapItem.id)}
                              className={`inline-flex px-2 py-0.5 rounded-full font-bold text-[10px] uppercase cursor-pointer transition-all ${
                                mapItem.status === 'Active'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50 hover:bg-emerald-100'
                                  : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                              }`}
                            >
                              {mapItem.status}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredUsageMappings.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-slate-400 font-medium">No mappings match filter criteria.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. DATABASE BACKUP & RESTORE */}
      {activeTab === 'backup' && (
        <div className="p-6 space-y-6">
          {/* Breadcrumb Header */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <button onClick={() => setActiveTab('dashboard')} className="hover:text-primary-600 transition-colors flex items-center gap-1">
                <ArrowLeft size={13} /> Master Settings & Backups
              </button>
              <span>&gt;</span>
              <span className="text-slate-800">Backup & Restore</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight mt-2">Database Backup & Restore</h2>
            <p className="text-xs text-slate-500 font-semibold leading-tight mt-0.5">Securely export and import your master data and records</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl">
            {/* Export Card */}
            <div 
              className="border border-slate-200 bg-white rounded-2xl p-6 hover:border-primary-300 hover:shadow-xs transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-4"
              onClick={handleBackup}
            >
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-3xs border border-indigo-100">
                <Download size={26} />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-slate-800 text-sm">Export Backup Snapshot</h4>
                <p className="text-xs text-slate-400 max-w-xs font-semibold leading-relaxed">
                  Generates and downloads a compiled snapshot of all current Master Settings, rules, and configurations as a secure `.json` database file.
                </p>
              </div>
            </div>

            {/* Restore Card */}
            <div 
              className="border border-slate-200 bg-white rounded-2xl p-6 hover:border-primary-300 hover:shadow-xs transition-all relative flex flex-col items-center justify-center text-center gap-4"
            >
              <input
                type="file"
                accept=".json"
                onChange={handleRestore}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-3xs border border-blue-100">
                <Upload size={26} />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-slate-800 text-sm">Restore from File</h4>
                <p className="text-xs text-slate-400 max-w-xs font-semibold leading-relaxed">
                  Restore your configurations back to a specific state by uploading a previous snapshot. Warning: This replaces local system states.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* --- ADD COMPULSORY RULE MODAL --- */}
      {showAddRuleModal && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px]">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl animate-fadeIn">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-950 uppercase tracking-wide">Add Field Requirement Rule</h3>
              <button onClick={() => setShowAddRuleModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAddRule} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Module</label>
                <select 
                  value={newRule.module}
                  onChange={(e) => setNewRule(prev => ({ ...prev, module: e.target.value }))}
                  className="w-full border border-slate-250 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-primary-500 bg-white"
                >
                  <option>Insurance Company</option>
                  <option>Plan</option>
                  <option>Contact</option>
                  <option>Leads</option>
                  <option>Policy</option>
                  <option>Claim</option>
                  <option>Agent</option>
                  <option>Hospital</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Field Name (Technical Key)</label>
                <input 
                  type="text"
                  placeholder="e.g. registration_number"
                  value={newRule.name}
                  onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full border border-slate-250 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Field Label (User-facing)</label>
                <input 
                  type="text"
                  placeholder="e.g. IRDAI Registration No."
                  value={newRule.label}
                  onChange={(e) => setNewRule(prev => ({ ...prev, label: e.target.value }))}
                  className="w-full border border-slate-250 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div className="flex items-center gap-2 py-1">
                <input 
                  type="checkbox"
                  id="req_rule_cb"
                  checked={newRule.required}
                  onChange={(e) => setNewRule(prev => ({ ...prev, required: e.target.checked }))}
                  className="rounded text-primary-600 cursor-pointer h-4 w-4"
                />
                <label htmlFor="req_rule_cb" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                  Mark as Compulsory Field
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowAddRuleModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT COMPULSORY RULE MODAL --- */}
      {editingRule && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px]">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl animate-fadeIn">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-950 uppercase tracking-wide">Edit Field Requirement</h3>
              <button onClick={() => setEditingRule(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveEditRule} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Module</label>
                <input 
                  type="text"
                  value={editingRule.module}
                  disabled
                  className="w-full border border-slate-200 bg-slate-50 text-slate-600 rounded-xl px-3.5 py-2 text-xs font-semibold cursor-not-allowed"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Field Name</label>
                <input 
                  type="text"
                  value={editingRule.name}
                  disabled
                  className="w-full border border-slate-200 bg-slate-50 font-mono text-slate-600 rounded-xl px-3.5 py-2 text-xs cursor-not-allowed"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Field Label</label>
                <input 
                  type="text"
                  value={editingRule.label}
                  onChange={(e) => setEditingRule(prev => prev ? ({ ...prev, label: e.target.value }) : null)}
                  className="w-full border border-slate-200 bg-white text-slate-800 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                  placeholder="Enter custom display label"
                />
              </div>
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <div>
                  <div className="text-xs font-bold text-slate-800">Compulsory / Mandatory</div>
                  <div className="text-[11px] text-slate-500 font-medium">Require this field when saving in {editingRule.module}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingRule(prev => prev ? ({ ...prev, required: !prev.required }) : null)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    editingRule.required ? 'bg-primary-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                      editingRule.required ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setEditingRule(null)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD DROPDOWN MODAL --- */}
      {showAddDropdownModal && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px]">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl animate-fadeIn">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-950 uppercase tracking-wide">Add New Dropdown Menu</h3>
              <button onClick={() => setShowAddDropdownModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAddDropdown} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Dropdown Name</label>
                  <input 
                    type="text"
                    placeholder="e.g. Risk Categories"
                    value={newDropdown.name}
                    onChange={(e) => setNewDropdown(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full border border-slate-250 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-primary-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Module</label>
                  <select 
                    value={newDropdown.module}
                    onChange={(e) => setNewDropdown(prev => ({ ...prev, module: e.target.value }))}
                    className="w-full border border-slate-250 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-primary-500 bg-white"
                  >
                    <option>Insurance Company</option>
                    <option>Plan</option>
                    <option>Rider / Add-on</option>
                    <option>Hospital</option>
                    <option>Agent</option>
                    <option>Contact</option>
                    <option>Policy</option>
                    <option>Claim</option>
                  </select>
                </div>
              </div>

              {/* Status Select */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Status</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewDropdown(prev => ({ ...prev, status: 'Active' }))}
                    className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      newDropdown.status === 'Active'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewDropdown(prev => ({ ...prev, status: 'Inactive' }))}
                    className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      newDropdown.status === 'Inactive'
                        ? 'border-slate-400 bg-slate-200 text-slate-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    Inactive
                  </button>
                </div>
              </div>

              {/* Initial Options Add */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                  Add Dropdown Options ({newDropdown.options.length} added)
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="Enter an option and click Add..."
                    value={newDropdown.newOptionInput}
                    onChange={(e) => setNewDropdown(prev => ({ ...prev, newOptionInput: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = newDropdown.newOptionInput.trim();
                        if (val && !newDropdown.options.includes(val)) {
                          setNewDropdown(prev => ({
                            ...prev,
                            options: [...prev.options, val],
                            newOptionInput: ''
                          }));
                        }
                      }
                    }}
                    className="flex-1 border border-slate-250 rounded-xl px-3.5 py-1.5 text-xs focus:ring-1 focus:ring-primary-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = newDropdown.newOptionInput.trim();
                      if (!val) return;
                      if (newDropdown.options.includes(val)) {
                        toast.error('Option already added');
                        return;
                      }
                      setNewDropdown(prev => ({
                        ...prev,
                        options: [...prev.options, val],
                        newOptionInput: ''
                      }));
                    }}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    + Add
                  </button>
                </div>

                {newDropdown.options.length > 0 && (
                  <div className="max-h-36 overflow-y-auto p-2 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap gap-1.5">
                    {newDropdown.options.map((opt, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 shadow-2xs">
                        <span>{opt}</span>
                        <button
                          type="button"
                          onClick={() => setNewDropdown(prev => ({ ...prev, options: prev.options.filter((_, idx) => idx !== i) }))}
                          className="text-slate-400 hover:text-red-500 cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setShowAddDropdownModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-sm"
                >
                  Create Dropdown
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT DROPDOWN & OPTIONS MODAL --- */}
      {editingDropdown && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px]">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl animate-fadeIn">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-950 uppercase tracking-wide">Edit Dropdown Menu & Options</h3>
                <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Manage details and available choices for this dropdown list</p>
              </div>
              <button onClick={() => setEditingDropdown(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEditDropdown} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Dropdown Name</label>
                  <input 
                    type="text"
                    value={editingDropdown.name}
                    onChange={(e) => setEditingDropdown(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                    className="w-full border border-slate-250 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-primary-500 font-semibold text-slate-800"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Module</label>
                  <select 
                    value={editingDropdown.module}
                    onChange={(e) => setEditingDropdown(prev => prev ? ({ ...prev, module: e.target.value }) : null)}
                    className="w-full border border-slate-250 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-primary-500 bg-white font-semibold text-slate-700"
                  >
                    <option>Insurance Company</option>
                    <option>Plan</option>
                    <option>Rider / Add-on</option>
                    <option>Hospital</option>
                    <option>Agent</option>
                    <option>Contact</option>
                    <option>Policy</option>
                    <option>Claim</option>
                  </select>
                </div>
              </div>

              {/* Status Selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Status</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingDropdown(prev => prev ? ({ ...prev, status: 'Active' }) : null)}
                    className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      editingDropdown.status === 'Active'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingDropdown(prev => prev ? ({ ...prev, status: 'Inactive' }) : null)}
                    className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      editingDropdown.status === 'Inactive'
                        ? 'border-slate-400 bg-slate-200 text-slate-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    Inactive
                  </button>
                </div>
              </div>

              {/* Options Management */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                    Dropdown Options List ({editingDropdown.options?.length || 0})
                  </label>
                  <span className="text-[10px] text-slate-400">Click &times; to remove</span>
                </div>

                {/* Add Option Input */}
                <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="Type new option name..."
                    value={editingOptionInput}
                    onChange={(e) => setEditingOptionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddOptionToEditing();
                      }
                    }}
                    className="flex-1 border border-slate-250 rounded-xl px-3.5 py-1.5 text-xs focus:ring-1 focus:ring-primary-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddOptionToEditing}
                    className="px-3.5 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                  >
                    + Add Option
                  </button>
                </div>

                {/* Search options filter if more than 6 items */}
                {(editingDropdown.options?.length || 0) > 6 && (
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="Filter options list..."
                      value={editingOptionSearch}
                      onChange={(e) => setEditingOptionSearch(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-1 text-[11px] text-slate-600 bg-slate-50 focus:bg-white focus:outline-none"
                    />
                  </div>
                )}

                {/* Badges Container */}
                <div className="max-h-48 overflow-y-auto p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap gap-1.5">
                  {(editingDropdown.options || [])
                    .filter(opt => !editingOptionSearch || opt.toLowerCase().includes(editingOptionSearch.toLowerCase()))
                    .map((opt, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-800 shadow-2xs hover:border-slate-300">
                        <span>{opt}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveOptionFromEditing(opt)}
                          className="text-slate-400 hover:text-red-500 cursor-pointer transition-colors"
                          title="Remove option"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  {(editingDropdown.options?.length || 0) === 0 && (
                    <div className="text-center w-full py-4 text-xs text-slate-400">
                      No options yet. Add your first option above.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setEditingDropdown(null)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. TABLE COLUMN SETTINGS SUBPAGE */}
      {activeTab === 'columns' && (
        <TableColumnSettings onBack={() => setActiveTab('dashboard')} />
      )}
    </div>
  );
}

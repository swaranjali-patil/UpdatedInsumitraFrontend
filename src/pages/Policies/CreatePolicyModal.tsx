import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Modal from '@comps/common/Modal';
import CustomSelect from '@comps/common/CustomSelect';
import { getActiveDropdownOptions, getModuleCustomDropdowns, isCategoryMatch } from '../../utils/masterDropdowns';
import { useMasterDropdowns } from '../../hooks/useMasterDropdowns';
import { isFieldRequired as isFieldRequiredHelper, COMPULSORY_RULES_UPDATED_EVENT } from '../../utils/compulsoryFieldRules';
import { DatePicker } from '@comps/common/DatePicker';
import { insuranceService, policiesService, documentsService, contactsService } from '@api/index';
import toast from 'react-hot-toast';
import { Shield, CreditCard, Users, Activity, FileText, Plus, Trash2, ChevronDown, UserCircle2, Pencil, RotateCw, History, CheckCircle2, AlertTriangle, Info, CalendarDays, Eye, Download, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import { useLookupStore } from '@store/lookup.store';
import { getPolicyStatusDisplay, calculateLastInstallmentDate } from '../../utils/policyStatusUtils';
import { formatIndianNumber } from '../../utils/numberUtils';
import ActivityTimeline from '@comps/common/ActivityTimeline';
import { INSTALLMENT_DATE_OPTIONS, PHC_STAGE_OPTIONS, POLICY_DOCUMENT_TYPE_OPTIONS, SUM_INSURED_OPTIONS, cleanConnectedPhone, parseExtraNotes } from './index';

const formatBytes = (bytes?: number | null) => {
  if (bytes == null) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};




interface Props {
  open: boolean;
  onClose: () => void;
  contactId?: string;
  contactName?: string;
  policyToEdit?: any;
  policyId?: string;
  initialData?: any;
  title?: string;
  subtitle?: string;
  onSuccess?: () => void;
}

const DEFAULT_RAW_CATEGORIES = ['HEALTH', 'LIFE', 'TERM', 'MOTOR', 'MUTUAL_FUNDS', 'PORTING', 'ACCIDENT', 'OTHER'];
const CATEGORIES = getActiveDropdownOptions('Policy', 'Policy Types', DEFAULT_RAW_CATEGORIES).map(o => o.value);
const STATUS_OPTIONS = [
  { value: 'INFORCE', label: 'Inforce' },
  { value: 'RENEWAL_DUE', label: 'Renewal Due' },
  { value: 'GRACE_PERIOD', label: 'Grace Period' },
  { value: 'LAPSED', label: 'Lapsed' },
  { value: 'INACTIVE_OLD', label: 'Inactive(Old)' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function CreatePolicyModal({
  open,
  onClose,
  contactId,
  contactName,
  policyToEdit: directPolicyToEdit,
  policyId,
  initialData,
  title,
  subtitle,
  onSuccess,
}: Props) {
  const qc = useQueryClient();

  const { data: fetchedPolicyRes, isLoading: isPolicyLoading } = useQuery({
    queryKey: ['policy-detail-create-modal', policyId],
    queryFn: () => policiesService.get(policyId!),
    enabled: open && !!policyId && !directPolicyToEdit,
  });
  const policyToEdit = directPolicyToEdit || (fetchedPolicyRes?.data || fetchedPolicyRes);
  const { employees, loadEmployees } = useLookupStore();
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [isManualSumAssured, setIsManualSumAssured] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState(contactId || policyToEdit?.contactId || '');

  const { dropdownMenus, getOptions, getCustomDropdowns } = useMasterDropdowns();

  const productCategoryOptions = useMemo(() => {
    return getOptions('Policy', 'Company Categories', DEFAULT_RAW_CATEGORIES).map(o => o.value);
  }, [getOptions, dropdownMenus]);

  const customerCategoryOptions = useMemo(() => {
    return getOptions('Policy', 'Customer Categories', [
      { value: 'FRESH', label: 'Fresh' },
      { value: 'PORT', label: 'Port' },
      { value: 'RENEWAL', label: 'Renewal' },
    ]);
  }, [getOptions, dropdownMenus]);

  const paymentFrequencyOptions = useMemo(() => {
    return getOptions('Policy', 'Payment Frequency', [
      { value: 'YEARLY', label: 'Yearly' },
      { value: 'HALF_YEARLY', label: 'Half Yearly' },
      { value: 'QUARTERLY', label: 'Quarterly' },
      { value: 'MONTHLY', label: 'Monthly' },
      { value: 'SINGLE', label: 'One Time' },
    ]);
  }, [getOptions, dropdownMenus]);

  const customPolicyDropdowns = useMemo(() => {
    return getCustomDropdowns('Policy');
  }, [getCustomDropdowns, dropdownMenus]);

  // Fetch contacts list for Target Contact / Client Name selector
  const { data: contactsRes } = useQuery({
    queryKey: ['contacts-list-picker'],
    queryFn: () => contactsService.list({ limit: 500 }),
    enabled: open,
  });
  const contactsList: any[] = Array.isArray(contactsRes?.data) ? contactsRes.data : Array.isArray(contactsRes) ? contactsRes : [];

  const { data: compulsoryRulesRes } = useQuery({
    queryKey: ['compulsory-rules'],
    queryFn: () => insuranceService.getCompulsoryRules(),
    enabled: open,
  });
  const compulsoryRules = useMemo(() => compulsoryRulesRes?.data ?? [], [compulsoryRulesRes]);
  const isFieldRequired = (key: string, defaultRequired: boolean) => {
    return isFieldRequiredHelper(compulsoryRules, 'Policy', key, defaultRequired);
  };

  useEffect(() => {
    const onCompRulesUpdated = () => {
      qc.invalidateQueries({ queryKey: ['compulsory-rules'] });
    };
    window.addEventListener(COMPULSORY_RULES_UPDATED_EVENT, onCompRulesUpdated);
    window.addEventListener('storage', onCompRulesUpdated);
    return () => {
      window.removeEventListener(COMPULSORY_RULES_UPDATED_EVENT, onCompRulesUpdated);
      window.removeEventListener('storage', onCompRulesUpdated);
    };
  }, [qc]);

  useEffect(() => {
    if (open) {
      loadEmployees();
      if (policyToEdit) {
        setIsViewOnly(false);
        setSelectedContactId(policyToEdit.contactId || policyToEdit.contact?.id || contactId || '');
        const matchProdCat = (policyToEdit.notes || '').match(/(?:Product Category|Policy Type):\s*(.*)/i);
          const initialCat = matchProdCat ? matchProdCat[1].trim() : (policyToEdit.plan?.category || '').toUpperCase();
          setSelectedCategory(initialCat);
        setSelectedCompanyId(policyToEdit.plan?.companyId || policyToEdit.plan?.company?.id || policyToEdit.plan?.company?.name || '');
        setSelectedPlanId(policyToEdit.planId || policyToEdit.plan?.id || '');
        setBusinessType(policyToEdit.businessType || '');
        const extra = parseExtraNotes(policyToEdit.notes);
        const matchCustCat = (policyToEdit.notes || '').match(/Customer Category:\s*(.*)/i);
        setCustomerCategory(policyToEdit.customerCategory || extra.customerCategory || (matchCustCat ? matchCustCat[1].trim() : ''));
        const matchPeriod = (policyToEdit.notes || '').match(/Policy Period:\s*(.*)/i);
        setPolicyPeriod(policyToEdit.policyPeriod || (matchPeriod ? matchPeriod[1].trim() : (extra.policyTenure ? `${extra.policyTenure} Yr` : '')));
        if (extra.policyTenure) {
          const parsed = parseInt(extra.policyTenure, 10);
          if (!isNaN(parsed)) setDurationYears(parsed);
        } else if (policyToEdit.policyPeriod) {
          const m = String(policyToEdit.policyPeriod).match(/(\d+)/);
          if (m) setDurationYears(parseInt(m[1], 10));
        } else {
          setDurationYears(1);
        }
        setPolicyTerm(extra.policyTerm || (extra.policyTenure ? `${extra.policyTenure} ${parseInt(extra.policyTenure, 10) === 1 ? 'Year' : 'Years'}` : '1 Year'));
        setFirstYearPremium(extra.firstYearPremium ? String(extra.firstYearPremium) : (policyToEdit.premiumAmount != null ? String(policyToEdit.premiumAmount) : ''));
        setSecondYearPremium(extra.secondYearPremium ? String(extra.secondYearPremium) : '');
        setAgeAtEntry(extra.ageAtEntry || '');
        setAgeAtLastPremium(extra.ageAtLastPremium || '');
        setAgeAtMaturity(extra.ageAtMaturity || '');

        setEmiCase(!!extra.emiCase || (policyToEdit as any).emiCase === true);
        setEmiGateway(extra.emiGateway || (policyToEdit as any).emiGateway || '');
        setEmiDate(extra.emiDate || '');
        setEmiPremium(extra.emiPremium ? String(extra.emiPremium) : '');
        setInstallmentAmount(extra.installmentAmount ? String(extra.installmentAmount) : (extra.emiPremium ? String(extra.emiPremium) : ''));
        setDownpaymentAmount(extra.downpaymentAmount ? String(extra.downpaymentAmount) : '');
        setProcessingFee(extra.processingFee ? String(extra.processingFee) : '');
        setNoOfInstallments(extra.noOfInstallments ? String(extra.noOfInstallments) : '');
        setFirstInstallmentDate(extra.firstInstallmentDate || '');
        setLastInstallmentDate(extra.lastInstallmentDate || (policyToEdit.lastPremiumDate ? String(policyToEdit.lastPremiumDate).split('T')[0] : ''));
        setEmiComment(extra.emiComment || '');

        setPaymentMode(extra.paymentMode || (policyToEdit as any).paymentMode || 'ONLINE');
        setPaymentDate(extra.paymentDate || (policyToEdit as any).paymentDate || '');
        setTransactionRef(extra.transactionRef || (policyToEdit as any).transactionRef || '');
        const loanAmt = extra.loanAmount != null ? String(extra.loanAmount) : '';
        setIsLoanCase(!!loanAmt && Number(loanAmt) > 0);
        setLoanAmount(loanAmt);
        setLoanProvider(extra.loanProvider || '');
        setLoanSanctionNo(extra.loanSanctionNo || '');
        setLoanEmi(extra.loanEmi ? String(extra.loanEmi) : '');

        setBankName(extra.bankName || '');
        setIfscCode(extra.ifscCode || '');
        setBranch(extra.branch || '');
        setAccountNumber(extra.accountNo || '');
        setAccountType(extra.accountType || 'SAVINGS');
        setAccountHolderName(extra.accountHolderName || '');

        setFirmName(extra.firmName || '');
        setFirmPan(extra.firmPan || '');
        setFirmGst(extra.firmGst || '');

        setPolicyNumber(policyToEdit.policyNumber || '');
        setAgentCode(policyToEdit.agentCode || '');
        setStatus((policyToEdit.status === 'ACTIVE' ? 'INFORCE' : policyToEdit.status) || 'INFORCE');
        setAssignedEmployeeId(policyToEdit.assignedEmployeeId || '');
        setSumAssured(policyToEdit.sumAssured != null ? String(policyToEdit.sumAssured) : '');
        setPremiumAmount(policyToEdit.premiumAmount != null ? String(policyToEdit.premiumAmount) : '');
        setPaymentFrequency(policyToEdit.paymentFrequency || 'YEARLY');
        setStartDate(policyToEdit.startDate ? String(policyToEdit.startDate).split('T')[0] : '');
        setEndDate(policyToEdit.endDate ? String(policyToEdit.endDate).split('T')[0] : '');
        setNextDueDate(policyToEdit.nextDueDate ? String(policyToEdit.nextDueDate).split('T')[0] : '');
        setMaturityDate(policyToEdit.maturityDate ? String(policyToEdit.maturityDate).split('T')[0] : '');
        setNotes(extra.cleanNotes || policyToEdit.notes || '');
        const matchCity = (policyToEdit.notes || '').match(/(?:Policy Zone(?: Location)? City|Policy City|Zone City|City):\s*(.*)/i);
        const editCity = matchCity ? matchCity[1].trim() : (
          (policyToEdit as any).contactCity ||
          policyToEdit.contact?.addresses?.find((a: any) => a.isPrimary)?.city ||
          policyToEdit.contact?.addresses?.[0]?.city ||
          policyToEdit.contact?.city ||
          ''
        );
        setPolicyZoneCity(editCity !== 'N/A' ? editCity : '');
        const matchInsured = (policyToEdit.notes || '').match(/Insured Person:\s*(.*)/i);
        const editInsuredPerson = matchInsured ? matchInsured[1].trim() : (policyToEdit.contact ? `${policyToEdit.contact.firstName || ''} ${policyToEdit.contact.lastName || ''}`.trim() : '');
        setInsuredPerson(editInsuredPerson);
        const proposerNameLower = editInsuredPerson.trim().toLowerCase();
        let initialMembers: any[] = [];
        if (policyToEdit.members && Array.isArray(policyToEdit.members) && policyToEdit.members.length > 0) {
          initialMembers = policyToEdit.members
            .filter((m: any) => {
              const mName = (m.name || `${m.firstName || ''} ${m.lastName || ''}`).trim().toLowerCase();
              const isSelf = String(m.relationship || '').toLowerCase() === 'self';
              return !isSelf && (!proposerNameLower || mName !== proposerNameLower);
            })
            .map((m: any, idx: number) => ({
              id: m.id || `member-${idx}`,
              name: m.name || `${m.firstName || ''} ${m.lastName || ''}`.trim(),
              relationship: m.relationship || 'Spouse',
              contactNo: cleanConnectedPhone(m.phone || m.contactNo),
              dob: m.dateOfBirth ? m.dateOfBirth.slice(0, 10) : (m.dob || ''),
              gender: m.gender || 'MALE',
              isCovered: m.isCovered !== false,
              isNominee: !!m.isNominee,
              nomineeName: m.nomineeName || '',
              nomineeRelation: m.nomineeRelation || 'Spouse',
              nomineeContact: m.nomineeContact || '',
              nomineeDob: m.nomineeDob || '',
              nomineePercentage: m.nomineePercentage && Number(m.nomineePercentage) > 0 ? m.nomineePercentage : '',
            }));
        }

        const noteLines = (policyToEdit.notes || '').split('\n');

        // If members was empty, extract Connected Person lines from notes first
        if (initialMembers.length === 0) {
          noteLines.forEach((line: string, idx: number) => {
            if (line.startsWith('Connected Person')) {
              const nameM = line.match(/Name:\s*([^,]+)/);
              const relM = line.match(/Relationship:\s*([^,]+)/);
              const dobM = line.match(/DoB:\s*([^,]+)/);
              const contactM = line.match(/Contact:\s*([^,]+)/);
              const genderM = line.match(/Gender:\s*([^,]+)/);
              if (nameM) {
                const parsedName = nameM[1].trim();
                const rel = relM ? relM[1].trim() : 'Spouse';
                const isSelf = rel.toLowerCase() === 'self';
                const isProposer = proposerNameLower && parsedName.toLowerCase() === proposerNameLower;
                if (isSelf || isProposer) return;
                const existing = initialMembers.find(m => m.name.toLowerCase() === parsedName.toLowerCase());
                if (!existing) {
                  initialMembers.push({
                    id: `note-cp-${idx}`,
                    name: parsedName,
                    relationship: rel,
                    contactNo: cleanConnectedPhone(contactM ? contactM[1] : ''),
                    dob: dobM && dobM[1].trim() !== 'N/A' ? dobM[1].trim() : '',
                    gender: genderM ? genderM[1].trim() : 'MALE',
                    isCovered: true,
                    isNominee: false,
                    nomineeName: '',
                    nomineeRelation: 'Spouse',
                    nomineeContact: '',
                    nomineeDob: '',
                    nomineePercentage: '',
                  });
                }
              }
            }
          });
        }

        // Now merge nominee details:
        // Priority 1: policyToEdit.nominees if available
        if (policyToEdit.nominees && Array.isArray(policyToEdit.nominees) && policyToEdit.nominees.length > 0) {
          policyToEdit.nominees.forEach((n: any, idx: number) => {
            const nomName = (n.name || '').trim();
            if (!nomName) return;
            const match = initialMembers.find(m => m.name.toLowerCase() === nomName.toLowerCase());
            if (match) {
              match.isNominee = true;
              match.nomineeName = nomName;
              match.nomineeRelation = n.relationship || match.relationship || 'Spouse';
              match.nomineeContact = cleanConnectedPhone(n.phone || n.contactNo) || (
                (!nomName || nomName.toLowerCase() === match.name.toLowerCase()) ? cleanConnectedPhone(match.contactNo) : ''
              );
              match.nomineeDob = n.dateOfBirth ? n.dateOfBirth.slice(0, 10) : (n.dob || match.dob);
              match.nomineePercentage = n.sharePercent && Number(n.sharePercent) > 0 ? n.sharePercent : (match.nomineePercentage || '');
            } else {
              initialMembers.push({
                id: n.id || `nominee-${idx}`,
                name: nomName,
                relationship: n.relationship || 'Nominee',
                contactNo: cleanConnectedPhone(n.phone || n.contactNo || ''),
                dob: n.dateOfBirth ? n.dateOfBirth.slice(0, 10) : (n.dob || ''),
                gender: n.gender || 'MALE',
                isCovered: false,
                isNominee: true,
                nomineeName: nomName,
                nomineeRelation: n.relationship || 'Other',
                nomineeContact: cleanConnectedPhone(n.phone || n.contactNo || ''),
                nomineeDob: n.dateOfBirth ? n.dateOfBirth.slice(0, 10) : (n.dob || ''),
                nomineePercentage: n.sharePercent && Number(n.sharePercent) > 0 ? n.sharePercent : '',
              });
            }
          });
        } else {
          // Priority 2: parse Nominee Details lines from notes
          noteLines.forEach((line: string, idx: number) => {
            if (line.startsWith('Nominee Details')) {
              const nameM = line.match(/Name:\s*([^,]+)/);
              const relM = line.match(/Relationship:\s*([^,]+)/);
              const dobM = line.match(/DoB:\s*([^,]+)/);
              const contactM = line.match(/Contact:\s*([^,]+)/);
              const shareM = line.match(/Share:\s*([0-9]+)%/);
              if (nameM) {
                const nomName = nameM[1].trim();
                const match = initialMembers.find(m => m.name.toLowerCase() === nomName.toLowerCase());
                if (match) {
                  const parsedContact = contactM ? contactM[1] : '';
                  match.isNominee = true;
                  match.nomineeName = nomName;
                  match.nomineeRelation = relM ? relM[1].trim() : match.relationship;
                  match.nomineeContact = cleanConnectedPhone(parsedContact) || (
                    (!nomName || nomName.toLowerCase() === match.name.toLowerCase()) ? cleanConnectedPhone(match.contactNo) : ''
                  );
                  match.nomineeDob = dobM && dobM[1].trim() !== 'N/A' ? dobM[1].trim() : match.dob;
                  match.nomineePercentage = shareM && Number(shareM[1]) > 0 ? Number(shareM[1]) : (match.nomineePercentage || '');
                } else {
                  initialMembers.push({
                    id: `note-nom-${idx}`,
                    name: nomName,
                    relationship: relM ? relM[1].trim() : 'Nominee',
                    contactNo: cleanConnectedPhone(contactM ? contactM[1] : ''),
                    dob: dobM && dobM[1].trim() !== 'N/A' ? dobM[1].trim() : '',
                    gender: 'MALE',
                    isCovered: false,
                    isNominee: true,
                    nomineeName: nomName,
                    nomineeRelation: relM ? relM[1].trim() : 'Other',
                    nomineeContact: cleanConnectedPhone(contactM ? contactM[1] : ''),
                    nomineeDob: dobM && dobM[1].trim() !== 'N/A' ? dobM[1].trim() : '',
                    nomineePercentage: shareM && Number(shareM[1]) > 0 ? Number(shareM[1]) : '',
                  });
                }
              }
            }
          });
        }
        setMembers(initialMembers);
        const matchPhc = (policyToEdit.notes || '').match(/Preventive Health Checkup:\s*([^\n]+)/i);
        if (matchPhc) {
          const v = matchPhc[1].trim().toLowerCase();
          setPhcRequired(!v.startsWith('no') && !v.startsWith('false'));
          const amountMatch = matchPhc[1].match(/Amount:\s*₹?([\d,.]+)/i);
          const statusMatch = matchPhc[1].match(/Status:\s*([^,)]+)/i);
          const settledMatch = matchPhc[1].match(/(?:Claim Settled|Settled):\s*([^,)]+)/i);
          if (amountMatch) setPhcAmount(amountMatch[1].replace(/,/g, ''));
          if (statusMatch) setPhcStatus(statusMatch[1].trim());
          if (settledMatch) setPhcClaimSettled(settledMatch[1].trim().toLowerCase() === 'yes');
        } else if ((policyToEdit.notes || '').includes('PHC Required: No')) {
          setPhcRequired(false);
        } else if ((policyToEdit.plan as any)?.hasPhcBenefit) {
          setPhcRequired(true);
        }
        const matchPhcPerson = (policyToEdit.notes || '').match(/PHC Insured Person:\s*(.*)/i) || (policyToEdit.notes || '').match(/Preventive Health Checkup:.*Insured Person:\s*([^,)\n]+)/i);
        setPhcInsuredPerson(matchPhcPerson ? matchPhcPerson[1].trim() : '');
        const matchPhcStage = (policyToEdit.notes || '').match(/PHC Stage:\s*(.*)/i);
        setPhcStage(matchPhcStage ? matchPhcStage[1].trim() : 'TO_CONTACT');
      } else {
        setIsViewOnly(false);
        setSelectedContactId(contactId || initialData?.contactId || initialData?.contact?.id || '');
        setSelectedCategory(initialData?.plan?.category ? String(initialData.plan.category).toUpperCase() : (initialData?.category ? String(initialData.category).toUpperCase() : ''));
        setSelectedCompanyId(initialData?.plan?.companyId || initialData?.plan?.company?.id || initialData?.plan?.company?.name || initialData?.companyId || '');
        setSelectedPlanId(initialData?.planId || initialData?.plan?.id || '');
        setBusinessType(initialData?.businessType || '');
        setCustomerCategory(initialData?.customerCategory || '');
        setPolicyPeriod(initialData?.policyPeriod || '');
        setPolicyNumber(initialData?.policyNumber || '');
        setAgentCode(initialData?.agentCode || '');
        setStatus(initialData?.status || 'INFORCE');
        setAssignedEmployeeId(initialData?.assignedEmployeeId || '');
        setSumAssured(initialData?.sumAssured != null ? String(initialData.sumAssured) : (initialData?.sumAssuredRequired != null ? String(initialData.sumAssuredRequired) : ''));
        setPremiumAmount(initialData?.premiumAmount != null ? String(initialData.premiumAmount) : (initialData?.premiumBudget != null ? String(initialData.premiumBudget) : ''));
        setPaymentFrequency(initialData?.paymentFrequency || 'YEARLY');

        const todayStr = new Date().toISOString().split('T')[0];
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        nextYear.setDate(nextYear.getDate() - 1);
        const endStr = nextYear.toISOString().split('T')[0];
        const maturityObj = new Date();
        maturityObj.setFullYear(maturityObj.getFullYear() + 1);
        const maturityStr = maturityObj.toISOString().split('T')[0];

        setStartDate(initialData?.startDate ? String(initialData.startDate).split('T')[0] : todayStr);
        setEndDate(initialData?.endDate ? String(initialData.endDate).split('T')[0] : endStr);
        setNextDueDate(initialData?.nextDueDate ? String(initialData.nextDueDate).split('T')[0] : maturityStr);
        setMaturityDate(initialData?.maturityDate ? String(initialData.maturityDate).split('T')[0] : maturityStr);
        setNotes(initialData?.notes || '');
        setPolicyZoneCity('');
        setDurationYears(1);
        setPolicyTerm('1 Year');
        setFirstYearPremium('');
        setSecondYearPremium('');
        setAgeAtEntry('');
        setAgeAtLastPremium('');
        setAgeAtMaturity('');
        setEmiCase(false);
        setEmiGateway('');
        setEmiDate('');
        setEmiPremium('');
        setInstallmentAmount('');
        setDownpaymentAmount('');
        setProcessingFee('');
        setNoOfInstallments('');
        setFirstInstallmentDate('');
        setLastInstallmentDate('');
        setEmiComment('');
        setPaymentMode('ONLINE');
        setPaymentDate('');
        setTransactionRef('');
        setIsLoanCase(false);
        setLoanAmount('');
        setLoanProvider('');
        setLoanSanctionNo('');
        setLoanEmi('');
        setBankName('');
        setIfscCode('');
        setBranch('');
        setAccountNumber('');
        setAccountType('SAVINGS');
        setAccountHolderName('');
        setFirmName('');
        setFirmPan('');
        setFirmGst('');

        const clientFullName = (contactName || (initialData?.contact ? `${initialData.contact.firstName || ''} ${initialData.contact.lastName || ''}` : '')).trim();
        setInsuredPerson(clientFullName);
        setPhcInsuredPerson(clientFullName);
        setPhcStage('TO_CONTACT');
        setIsManualPhcPerson(false);
        setMembers([]);
        setPendingDocs([]);
      }
    }
  }, [open, policyToEdit, contactId, initialData, contactName]);

  const [activeTab, setActiveTab] = useState<'policyPlan' | 'premium' | 'connectedPersons' | 'phcDetails' | 'policyDocs' | 'history'>('policyPlan');

  const policyHistoryContactId = policyToEdit?.contactId || policyToEdit?.contact?.id || contactId;
  const {
    data: policyHistoryRes,
    isLoading: policyHistoryLoading,
    isError: policyHistoryError,
  } = useQuery({
    queryKey: ['contact-activity', policyHistoryContactId],
    queryFn: () => contactsService.activity(policyHistoryContactId!, { page: 1, limit: 100 }),
    enabled: !!policyHistoryContactId && !!policyToEdit?.id && open && activeTab === 'history',
  });

  // Collapsible Section Header States (false = expanded by default)
  const [isPolicyDetailsCollapsed, setIsPolicyDetailsCollapsed] = useState(false);
  const [isPlanDetailsCollapsed, setIsPlanDetailsCollapsed] = useState(false);

  // Tab 1: Policy & Plan Details
  const [insuredPerson, setInsuredPerson] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [businessType, setBusinessType] = useState<string>('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [policyPeriod, setPolicyPeriod] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [agentCode, setAgentCode] = useState('');
  const [status, setStatus] = useState('INFORCE');
  const [assignedEmployeeId, setAssignedEmployeeId] = useState('');
  const [customerCategory, setCustomerCategory] = useState('');
  const [policyZoneCity, setPolicyZoneCity] = useState('');
  const [previousPolicyId, setPreviousPolicyId] = useState('');
  const [copyPreviousDetails, setCopyPreviousDetails] = useState(false);
  const [loadingCopy, setLoadingCopy] = useState(false);

  // Fetch list of existing policies for Renewal Previous Policy dropdown
  const { data: previousPoliciesRes } = useQuery({
    queryKey: ['existing-policies-picker', contactId],
    queryFn: () => policiesService.list({ ...(contactId ? { contactId } : {}), limit: 100 }),
    enabled: open && businessType === 'RENEWAL',
  });
  const previousPolicies: any[] = Array.isArray(previousPoliciesRes?.data)
    ? previousPoliciesRes.data
    : Array.isArray(previousPoliciesRes)
    ? previousPoliciesRes
    : [];

  const handleCopyFromPreviousPolicy = async (polId: string) => {
    if (!polId) return;
    try {
      setLoadingCopy(true);
      const res = await policiesService.getCopyDetails(polId);
      const data = res?.data || res;
      if (data) {
        if (data.policyType) setSelectedCategory(data.policyType.toUpperCase());
        if (data.companyId) setSelectedCompanyId(data.companyId);
        if (data.planId) setSelectedPlanId(data.planId);
        if (data.sumAssured != null) setSumAssured(String(data.sumAssured));
        if (data.premiumAmount != null) setPremiumAmount(String(data.premiumAmount));
        if (data.paymentFrequency) setPaymentFrequency(data.paymentFrequency);
        if (data.agentCode) setAgentCode(data.agentCode);
        if (data.assignedEmployeeId) setAssignedEmployeeId(data.assignedEmployeeId);
        if (data.customerCategory) setCustomerCategory(data.customerCategory);
        if (data.notes) {
          setNotes(data.notes);
          const matchDownpayment = (data.notes || '').match(/Downpayment(?: Amount)?:\s*₹?\s*([0-9.]+)/i);
          if (matchDownpayment) setDownpaymentAmount(matchDownpayment[1].trim());
          const matchProcessing = (data.notes || '').match(/Processing Fee(?:\s*\(incl\.\s*GST\))?:\s*₹?\s*([0-9.]+)/i);
          if (matchProcessing) setProcessingFee(matchProcessing[1].trim());
          const matchInstallment = (data.notes || '').match(/Installment Amount:\s*₹?\s*([0-9.]+)/i) || (data.notes || '').match(/Premium:\s*₹\s*([0-9.]+)/i);
          if (matchInstallment) {
            setInstallmentAmount(matchInstallment[1].trim());
            setEmiPremium(matchInstallment[1].trim());
          }
          const matchNoOfInst = (data.notes || '').match(/No\.\s*of Installments:\s*([0-9]+)/i);
          if (matchNoOfInst) setNoOfInstallments(matchNoOfInst[1].trim());
          const matchLastInst = (data.notes || '').match(/Last Installment Date:\s*(.*)/i);
          if (matchLastInst) setLastInstallmentDate(matchLastInst[1].trim());
          const matchInstDate = (data.notes || '').match(/Installment Date:\s*(.*)/i);
          if (matchInstDate) setEmiDate(matchInstDate[1].trim());
          const matchInsured = (data.notes || '').match(/Insured Person:\s*(.*)/i);
          if (matchInsured) setInsuredPerson(matchInsured[1].trim());
        }
        if (Array.isArray(data.members) && data.members.length > 0) {
          const copiedMembers = data.members.map((m: any, idx: number) => ({
            id: m.id || `member-prev-${idx}`,
            name: m.name || `${m.firstName || ''} ${m.lastName || ''}`.trim(),
            relationship: m.relationship || 'Spouse',
            contactNo: cleanConnectedPhone(m.phone || m.contactNo),
            dob: m.dateOfBirth ? m.dateOfBirth.slice(0, 10) : (m.dob || ''),
            gender: m.gender || 'MALE',
            isCovered: m.isCovered !== false,
            isNominee: !!m.isNominee,
            nomineeName: m.nomineeName || '',
            nomineeRelation: m.nomineeRelation || 'Spouse',
            nomineeContact: m.nomineeContact || '',
            nomineeDob: m.nomineeDob || '',
            nomineePercentage: m.nomineePercentage && Number(m.nomineePercentage) > 0 ? m.nomineePercentage : '',
          }));
          if (Array.isArray(data.nominees)) {
            data.nominees.forEach((n: any) => {
              const nomName = (n.name || '').trim();
              const match = copiedMembers.find((m: any) => m.name.toLowerCase() === nomName.toLowerCase());
              if (match) {
                match.isNominee = true;
                match.nomineeName = nomName;
                match.nomineeRelation = n.relationship || match.relationship || 'Spouse';
                match.nomineeContact = cleanConnectedPhone(n.phone) || (
                  (!nomName || nomName.toLowerCase() === match.name.toLowerCase()) ? cleanConnectedPhone(match.contactNo) : ''
                );
                match.nomineePercentage = n.sharePercent && Number(n.sharePercent) > 0 ? n.sharePercent : (match.nomineePercentage || '');
              }
            });
          }
          setMembers(copiedMembers);
        }
        toast.success('Pre-filled details from previous policy. All fields remain editable.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to copy previous policy details');
    } finally {
      setLoadingCopy(false);
    }
  };

  // Tab 2: Premium & Payment Details
  const [sumAssured, setSumAssured] = useState('');
  const [premiumAmount, setPremiumAmount] = useState('');
  const [firstYearPremium, setFirstYearPremium] = useState('');
  const [secondYearPremium, setSecondYearPremium] = useState('');
  const [paymentFrequency, setPaymentFrequency] = useState('YEARLY');
  const [durationYears, setDurationYears] = useState<number | ''>(1);
  const [policyTerm, setPolicyTerm] = useState<string>('1 Year');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');
  const [maturityDate, setMaturityDate] = useState('');
  const [ageAtEntry, setAgeAtEntry] = useState('');
  const [ageAtLastPremium, setAgeAtLastPremium] = useState('');
  const [ageAtMaturity, setAgeAtMaturity] = useState('');
  const [firstPremiumDate, setFirstPremiumDate] = useState('');
  const [premiumPaymentPeriod, setPremiumPaymentPeriod] = useState('');
  const [lastPremiumDate, setLastPremiumDate] = useState('');
  const [noOfInstallments, setNoOfInstallments] = useState('');
  const [lastInstallmentDate, setLastInstallmentDate] = useState('');

  const isLifeCategory = Boolean(
    selectedCategory && (
      ['LIFE', 'TERM'].includes(selectedCategory.toUpperCase()) ||
      selectedCategory.toUpperCase().includes('LIFE') ||
      selectedCategory.toUpperCase().includes('TERM')
    )
  );

  // Auto-update policy term when duration years change
  useEffect(() => {
    if (durationYears) {
      setPolicyTerm(`${durationYears} ${Number(durationYears) === 1 ? 'Year' : 'Years'}`);
      setPolicyPeriod(`${durationYears} Yr`);
    }
  }, [durationYears]);

  // Auto-calculate End Date and Maturity Date based on Start Date & Policy Period / Duration
  const autoCalculateDates = useCallback((startIso: string, periodStr: string) => {
    if (!startIso) return;
    const start = new Date(startIso);
    if (isNaN(start.getTime())) return;

    const match = periodStr.match(/(\d+)/);
    if (!match) return;

    const years = parseInt(match[1], 10);
    if (isNaN(years) || years <= 0) return;

    // End Date = startDate + X years - 1 day
    const end = new Date(start.getFullYear() + years, start.getMonth(), start.getDate() - 1);
    // Maturity Date = startDate + X years
    const maturity = new Date(start.getFullYear() + years, start.getMonth(), start.getDate());

    setEndDate(end.toISOString().split('T')[0]);
    setMaturityDate(maturity.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (startDate && durationYears) {
      autoCalculateDates(startDate, `${durationYears} Yr`);
    }
  }, [startDate, durationYears, autoCalculateDates]);

  // ── Backend Policy Scenario Rule Lookup ───────────────────────────────────
  const { data: activeScenarioRes } = useQuery({
    queryKey: ['active-policy-scenario', selectedCategory, businessType, selectedCompanyId, selectedPlanId],
    queryFn: () => policiesService.lookupScenario({
      policyType: selectedCategory,
      businessType,
      companyId: selectedCompanyId,
      planId: selectedPlanId,
    }),
    enabled: open && !!selectedCompanyId && !!selectedPlanId,
  });
  const activeScenario = activeScenarioRes?.data || null;

  // Dynamically derived options from backend scenario configuration
  const dynamicPolicyPeriods = useMemo(() => {
    if (activeScenario && Array.isArray(activeScenario.policyPeriods) && activeScenario.policyPeriods.length > 0) {
      return activeScenario.policyPeriods;
    }
    return ['1 Yr', '2 Yr', '3 Yr', '4 Yr', '5 Yr', '10 Yr', '15 Yr', '20 Yr', '25 Yr', '30 Yr', '99 Yr'];
  }, [activeScenario]);

  const dynamicPaymentOptions = useMemo(() => {
    if (activeScenario && Array.isArray(activeScenario.paymentOptions) && activeScenario.paymentOptions.length > 0) {
      return activeScenario.paymentOptions;
    }
    return ['Full Payment', 'EMI', 'Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'];
  }, [activeScenario]);

  const dynamicEmiMonths = useMemo(() => {
    if (activeScenario && Array.isArray(activeScenario.emiMonths) && activeScenario.emiMonths.length > 0) {
      return activeScenario.emiMonths;
    }
    return ['3 Months', '6 Months', '9 Months', '12 Months', '18 Months', '24 Months', '36 Months'];
  }, [activeScenario]);

  const dynamicPaymentTerms = useMemo(() => {
    if (activeScenario && Array.isArray(activeScenario.paymentTerms)) {
      return activeScenario.paymentTerms;
    }
    return [];
  }, [activeScenario]);

  // Section 3: Installment / EMI Gateway Details
  const [emiCase, setEmiCase] = useState(false);
  const [emiGateway, setEmiGateway] = useState('');
  const [emiDate, setEmiDate] = useState('');
  const [emiPremium, setEmiPremium] = useState('');
  const [downpaymentAmount, setDownpaymentAmount] = useState('');
  const [processingFee, setProcessingFee] = useState('');
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [firstInstallmentDate, setFirstInstallmentDate] = useState('');
  const [emiComment, setEmiComment] = useState('');
  const showLifeTermInstallmentFields = isLifeCategory && Boolean(emiCase);
  const showInstallmentAndYearlyFields = isLifeCategory || Boolean(emiCase);

  const recalculateLastInstallment = useCallback((overrides?: {
    baseDate?: string;
    noOfInst?: number | string;
    freq?: string;
    day?: string;
  }) => {
    const baseDate = overrides?.baseDate !== undefined ? overrides.baseDate : (firstInstallmentDate || firstPremiumDate || startDate);
    const noOfInst = overrides?.noOfInst !== undefined ? overrides.noOfInst : noOfInstallments;
    const freq = overrides?.freq !== undefined ? overrides.freq : (paymentFrequency || 'MONTHLY');
    const day = overrides?.day !== undefined ? overrides.day : emiDate;

    if (baseDate && noOfInst) {
      const calculated = calculateLastInstallmentDate(baseDate, noOfInst, freq, day);
      if (calculated) {
        setLastPremiumDate(calculated);
        setLastInstallmentDate(calculated);
      }
    }
  }, [firstInstallmentDate, firstPremiumDate, startDate, noOfInstallments, paymentFrequency, emiDate]);

  // Auto-calculate Last Installment Date based on First Premium / Start Date, No. of Installments, Frequency, and Day
  useEffect(() => {
    const baseDate = firstInstallmentDate || firstPremiumDate || startDate;
    if (baseDate && noOfInstallments) {
      recalculateLastInstallment({ baseDate });
    }
  }, [firstInstallmentDate, firstPremiumDate, startDate, noOfInstallments, paymentFrequency, emiDate, recalculateLastInstallment]);

  // Section 4: Payment Mode & Loan Details
  const [paymentMode, setPaymentMode] = useState('ONLINE');
  const [paymentDate, setPaymentDate] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [isLoanCase, setIsLoanCase] = useState(false);
  const [loanAmount, setLoanAmount] = useState('');
  const [loanProvider, setLoanProvider] = useState('');
  const [loanSanctionNo, setLoanSanctionNo] = useState('');
  const [loanEmi, setLoanEmi] = useState('');

  // Section 5: Payment Account Details
  const [bankName, setBankName] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [branch, setBranch] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState('SAVINGS');
  const [accountHolderName, setAccountHolderName] = useState('');

  // Section 6: GST No Details
  const [firmName, setFirmName] = useState('');
  const [firmPan, setFirmPan] = useState('');
  const [firmGst, setFirmGst] = useState('');
  const [gstApplicable, setGstApplicable] = useState(true);
  const [gstPercentage, setGstPercentage] = useState('18');
  const [gstAmount, setGstAmount] = useState('');

  // Collapse Section States
  const [isPremiumBreakdownCollapsed, setIsPremiumBreakdownCollapsed] = useState(false);
  const [isTenureDatesCollapsed, setIsTenureDatesCollapsed] = useState(false);
  const [isEmiDetailsCollapsed, setIsEmiDetailsCollapsed] = useState(false);
  const [isPaymentModeLoanCollapsed, setIsPaymentModeLoanCollapsed] = useState(false);
  const [isPaymentAccountCollapsed, setIsPaymentAccountCollapsed] = useState(false);
  const [isGstDetailsCollapsed, setIsGstDetailsCollapsed] = useState(false);

  // Tab 3: Connected Persons State
  interface ConnectedPersonItem {
    id: string;
    name: string;
    relationship: string;
    contactNo: string;
    dob: string;
    gender: string;
    isCovered: boolean;
    isNominee: boolean;
    nomineeName: string;
    nomineeRelation: string;
    nomineeContact: string;
    nomineeDob: string;
    nomineePercentage: number | string;
    addedAt?: string;
  }

  const [members, setMembers] = useState<ConnectedPersonItem[]>([]);

  const addConnectedPerson = () => {
    setMembers(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        addedAt: new Date().toISOString(),
        name: '',
        relationship: 'Spouse',
        contactNo: '',
        dob: '',
        gender: 'MALE',
        isCovered: true,
        isNominee: false,
        nomineeName: '',
        nomineeRelation: 'Spouse',
        nomineeContact: '',
        nomineeDob: '',
        nomineePercentage: '',
      },
    ]);
  };

  const removeConnectedPerson = (id: string) => {
    setMembers(prev => prev.filter(p => p.id !== id));
  };

  const updateConnectedPerson = (id: string, updates: Partial<ConnectedPersonItem>) => {
    setMembers(prev =>
      prev.map(p => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  const totalNomineePercentage = useMemo(() => {
    return members
      .filter(p => p.isNominee)
      .reduce((sum, p) => sum + (Number(p.nomineePercentage) || 0), 0);
  }, [members]);

  const syncContactFamilyMembers = useCallback((contact: any) => {
    if (!contact) return;
    const contactFullName = [contact.firstName, contact.middleName, contact.lastName]
      .filter(Boolean)
      .join(' ')
      .trim()
      .toLowerCase();

    const combinedRels = [
      ...(contact?.relationships || []).map((relationship: any) => ({
        member: relationship.relatedContact,
        relType: relationship.relationshipType,
        createdAt: relationship.createdAt,
      })),
      ...(contact?.relatedTo || []).map((relationship: any) => ({
        member: relationship.primaryContact,
        relType: relationship.relationshipType,
        createdAt: relationship.createdAt,
      })),
    ];

    const familyMembers: ConnectedPersonItem[] = [];
    combinedRels.forEach((rel: any) => {
      const member = rel.member;
      if (!member || member.id === contact.id) return;

      const name = [member.firstName, member.middleName, member.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (!name || name.toLowerCase() === contactFullName) return;

      const relationshipTypes: Record<string, string> = {
        SPOUSE: 'Spouse',
        SON: 'Son',
        DAUGHTER: 'Daughter',
        FATHER: 'Father',
        MOTHER: 'Mother',
        BROTHER: 'Brother',
        SISTER: 'Sister',
        GRANDFATHER: 'Grandfather',
        GRANDMOTHER: 'Grandmother',
        GRANDSON: 'Grandson',
        GRANDDAUGHTER: 'Granddaughter',
        GRANDPARENT: 'Grandparent',
        GRANDCHILD: 'Grandchild',
        UNCLE: 'Uncle',
        AUNT: 'Aunt / Unty',
        NEPHEW: 'Nephew',
        NIECE: 'Niece',
        OTHER: 'Other',
      };
      const relationType = String(rel.relType || '').toUpperCase();

      familyMembers.push({
        id: `contact-${member.id}`,
        addedAt: rel.createdAt || member.createdAt || new Date().toISOString(),
        name,
        relationship: relationshipTypes[relationType] || 'Dependent',
        contactNo: cleanConnectedPhone(member.phone || member.alternatePhone || member.mobile || member.whatsappNumber),
        dob: member.dateOfBirth ? String(member.dateOfBirth).slice(0, 10) : '',
        gender: ['MALE', 'FEMALE', 'OTHER'].includes(String(member.gender).toUpperCase())
          ? String(member.gender).toUpperCase()
          : 'MALE',
        isCovered: true,
        isNominee: false,
        nomineeName: '',
        nomineeRelation: 'Spouse',
        nomineeContact: '',
        nomineeDob: '',
        nomineePercentage: '',
      });
    });

    setMembers(previous => {
      // Remove any previously auto-populated contact members, self entries, or matching contact's name
      const manualPrevious = previous.filter(p =>
        !p.id.startsWith('contact-') &&
        p.name.trim().toLowerCase() !== contactFullName &&
        p.relationship?.toLowerCase() !== 'self'
      );
      const manualNames = new Set(manualPrevious.map(p => p.name.trim().toLowerCase()));
      const uniqueFamily = familyMembers.filter(p => !manualNames.has(p.name.trim().toLowerCase()));
      return [
        ...manualPrevious,
        ...uniqueFamily,
      ];
    });
  }, []);

  useEffect(() => {
    const cId = selectedContactId || contactId;
    if (!cId || policyToEdit) return;
    contactsService.get(cId)
      .then((res: any) => {
        const c = res?.data?.data || res?.data || res;
        if (c) {
          syncContactFamilyMembers(c);
          const cCity = c?.addresses?.find((a: any) => a.isPrimary)?.city || c?.addresses?.[0]?.city || c?.city || '';
          if (cCity && cCity !== 'N/A') {
            setPolicyZoneCity(prev => prev || cCity);
          }
        }
      })
      .catch(() => {});
  }, [selectedContactId, contactId, policyToEdit, syncContactFamilyMembers]);

  // Tab 4: PHC Details
  const [phcRequired, setPhcRequired] = useState(false);
  const [phcInsuredPerson, setPhcInsuredPerson] = useState('');
  const [isManualPhcPerson, setIsManualPhcPerson] = useState(false);
  const [phcAmount, setPhcAmount] = useState('');
  const [phcAmountError, setPhcAmountError] = useState('');
  const [phcStatus, setPhcStatus] = useState('PENDING');
  const [phcStage, setPhcStage] = useState('TO_CONTACT');
  const [phcClaimSettled, setPhcClaimSettled] = useState(false);
  const [notes, setNotes] = useState('');
  const [extraPolicyNotes, setExtraPolicyNotes] = useState<Record<string, string>>({});

  // Tab 5: Documents
  const [pendingDocs, setPendingDocs] = useState<{ file: File; tag: string; title: string }[]>([]);
  const [docTag, setDocTag] = useState('POLICY_DOCUMENT');
  const [docTitle, setDocTitle] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const phcInsuredPersonOptions = useMemo(() => {
    const list: { value: string; label: string; sublabel?: string }[] = [];
    const seen = new Set<string>();

    const primary = (insuredPerson || contactName || '').trim();
    if (primary) {
      list.push({
        value: primary,
        label: `${primary} (Self / Primary)`,
        sublabel: 'Primary Insured Person',
      });
      seen.add(primary.toLowerCase());
    }

    members.forEach((m: any) => {
      const name = (m.name || '').trim();
      if (name && !seen.has(name.toLowerCase())) {
        list.push({
          value: name,
          label: `${name} (${m.relationship || 'Member'})`,
          sublabel: m.relationship ? `Relationship: ${m.relationship}` : 'Family Member',
        });
        seen.add(name.toLowerCase());
      }
    });

    const current = (phcInsuredPerson || '').trim();
    if (current && !seen.has(current.toLowerCase())) {
      list.push({
        value: current,
        label: current,
        sublabel: 'Custom Name',
      });
    }

    return list;
  }, [insuredPerson, contactName, members, phcInsuredPerson]);

  // Fetch All Plans via policiesService.plans()
  const { data: allPlansRes } = useQuery({
    queryKey: ['all-plans-list-picker'],
    queryFn: () => policiesService.plans(),
    enabled: open,
  });
  const plansList: any[] = Array.isArray(allPlansRes?.data) ? allPlansRes.data : Array.isArray(allPlansRes) ? allPlansRes : [];

  const { data: companiesRes } = useQuery({
    queryKey: ['insurance-companies'],
    queryFn: () => insuranceService.listCompanies(),
    enabled: open,
  });
  const dbCompaniesList: any[] = useMemo(() => {
    const raw = companiesRes?.data ?? companiesRes ?? [];
    return Array.isArray(raw) ? raw : (raw.data ?? []);
  }, [companiesRes]);

  useEffect(() => {
    const handleCompaniesUpdated = () => {
      qc.invalidateQueries({ queryKey: ['insurance-companies'] });
      qc.invalidateQueries({ queryKey: ['all-plans-list-picker'] });
      qc.invalidateQueries({ queryKey: ['plans-all'] });
    };
    window.addEventListener('insumitra_companies_updated', handleCompaniesUpdated);
    return () => {
      window.removeEventListener('insumitra_companies_updated', handleCompaniesUpdated);
    };
  }, [qc]);

  const DEFAULT_COMPANIES_FOR_MODAL: Record<string, string[]> = {
    HEALTH: ['Star Health', 'Niva Bupa', 'Care', 'Manipal Cigna', 'HDFC Ergo', 'ICICI Lombard', 'Bajaj General', 'TATA AIG'],
    GENERAL: ['HDFC Ergo', 'ICICI Lombard', 'Bajaj General', 'TATA AIG', 'Star Health', 'Niva Bupa', 'Care', 'Manipal Cigna'],
    LIFE: ['HDFC Life', 'ICICI Pru Life', 'Bajaj Life', 'TATA AIA'],
    TERM: ['HDFC Life', 'ICICI Pru Life', 'Bajaj Life', 'TATA AIA'],
  };
  const ALL_DEFAULT_COMPANIES = [
    'Star Health', 'Niva Bupa', 'Care', 'Manipal Cigna',
    'HDFC Ergo', 'ICICI Lombard', 'Bajaj General', 'TATA AIG',
    'HDFC Life', 'ICICI Pru Life', 'Bajaj Life', 'TATA AIA',
  ];

  // Filter unique companies for selected Category
  const availableCompanies = useMemo(() => {
    const categoryPlans = selectedCategory
      ? plansList.filter((p: any) => isCategoryMatch(p.category || 'OTHER', selectedCategory))
      : plansList;

    const map = new Map<string, { id: string; name: string }>();

    const catKey = (selectedCategory || '').toUpperCase();
    let defaultKey = catKey;
    if (catKey.includes('HEALTH') || catKey.includes('RETAIL') || catKey.includes('FLOATER') || catKey.includes('CORPORATE') || catKey.includes('INDIVIDUAL')) {
      defaultKey = 'HEALTH';
    } else if (catKey.includes('LIFE')) {
      defaultKey = 'LIFE';
    } else if (catKey.includes('TERM')) {
      defaultKey = 'TERM';
    } else if (catKey.includes('MOTOR') || catKey.includes('AUTO')) {
      defaultKey = 'MOTOR';
    } else if (catKey.includes('GENERAL')) {
      defaultKey = 'GENERAL';
    }

    const defaults = defaultKey && DEFAULT_COMPANIES_FOR_MODAL[defaultKey]
      ? DEFAULT_COMPANIES_FOR_MODAL[defaultKey]
      : (catKey && DEFAULT_COMPANIES_FOR_MODAL[catKey] ? DEFAULT_COMPANIES_FOR_MODAL[catKey] : ALL_DEFAULT_COMPANIES);

    defaults.forEach(d => {
      const matchingPlan = plansList.find((p: any) => (p.company?.name || '').toLowerCase() === d.toLowerCase());
      const idKey = matchingPlan?.company?.id || d;
      map.set(idKey, { id: idKey, name: d });
    });

    categoryPlans.forEach((p: any) => {
      const co = p.company;
      if (co && (co.id || co.name)) {
        const idKey = co.id || co.name;
        if (!map.has(idKey)) {
          map.set(idKey, { id: idKey, name: co.name });
        }
      }
    });

    dbCompaniesList.forEach((c: any) => {
      if (c && (c.id || c.name)) {
        if (c.isActive === false) return;
        if (selectedCategory) {
          let compCat = '';
          try {
            if (c.notes) {
              const parsed = JSON.parse(c.notes);
              compCat = (parsed.category || '').toUpperCase();
            }
          } catch {}
          if (!compCat && c.category) compCat = (c.category || '').toUpperCase();
          if (compCat) {
            const match = isCategoryMatch(compCat, selectedCategory);
            if (!match) return;
          }
        }
        const idKey = c.id || c.name;
        if (!map.has(idKey)) {
          map.set(idKey, { id: idKey, name: c.name });
        }
      }
    });

    return Array.from(map.values());
  }, [plansList, dbCompaniesList, selectedCategory]);

  // Filter plans for selected Category and selected Company
  const availablePlans = useMemo(() => {
    // 1. Filter by company if selected
    const coFiltered = plansList.filter((p: any) => {
      const coName = p.company?.name || '';
      const coMatch = !selectedCompanyId ||
        p.companyId === selectedCompanyId ||
        p.company?.id === selectedCompanyId ||
        coName.toLowerCase() === selectedCompanyId.toLowerCase() ||
        coName.toLowerCase().includes(selectedCompanyId.toLowerCase()) ||
        selectedCompanyId.toLowerCase().includes(coName.toLowerCase());
      return coMatch;
    });

    if (!selectedCategory) {
      return coFiltered;
    }

    // 2. Filter by category
    const catMatches = coFiltered.filter((p: any) => {
      return isCategoryMatch(p.category || 'OTHER', selectedCategory);
    });

    // 3. Fallback: If matching plans exist for this category, return them.
    // If not, gracefully return coFiltered so dropdown never gets empty (0 available).
    return catMatches.length > 0 ? catMatches : coFiltered;
  }, [plansList, selectedCategory, selectedCompanyId]);

  const handleAddDoc = (file: File) => {
    if (!file) return;
    const defaultTagLabel = POLICY_DOCUMENT_TYPE_OPTIONS.find(o => o.value === docTag)?.label;
    setPendingDocs(prev => [...prev, { file, tag: docTag, title: docTitle.trim() || defaultTagLabel || file.name }]);
    setDocTitle(defaultTagLabel || '');
  };

  const handleRemoveDoc = (idx: number) => {
    setPendingDocs(prev => prev.filter((_, i) => i !== idx));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phcRequired && !phcAmount.trim()) {
      setPhcAmountError('PHC Amount is required');
      setActiveTab('phcDetails');
      toast.error('PHC Amount is required');
      return;
    }
    setPhcAmountError('');

    const finalContactId = selectedContactId || contactId || policyToEdit?.contactId;
    if (isFieldRequired('contactId', true) && !finalContactId) {
      toast.error('Target Contact / Client Name is required');
      setActiveTab('policyPlan');
      return;
    }
    if (isFieldRequired('planId', true) && !selectedPlanId) {
      toast.error('Please select an Insurance Plan');
      setActiveTab('policyPlan');
      return;
    }
    if (isFieldRequired('policyNumber', true) && !policyNumber.trim()) {
      toast.error('Policy Number is required');
      setActiveTab('policyPlan');
      return;
    }

    if (isFieldRequired('sumAssured', false) && (!sumAssured || Number(sumAssured) <= 0)) {
      toast.error('Valid Sum Assured is required');
      setActiveTab('policyPlan');
      return;
    }

    // Validate Connected Persons if any are added
    if (members.length > 0) {
      for (let i = 0; i < members.length; i++) {
        const p = members[i];
        if (!p.name?.trim()) {
          toast.error(`Please enter Full Name for Person ${i + 1} in Connected Persons tab`);
          setActiveTab('connectedPersons');
          return;
        }
        const pContactDigits = (cleanConnectedPhone(p.contactNo) || '').replace(/\D/g, '');
        if (pContactDigits.length > 0 && pContactDigits.length !== 10) {
          toast.error(`Contact number for "${p.name.trim()}" must be 10 digits`);
          setActiveTab('connectedPersons');
          return;
        }
        if (p.isNominee) {
          const nomName = p.nomineeName?.trim() || p.name.trim();
          if (!nomName) {
            toast.error(`Please enter Nominee Name for Person ${i + 1} in Connected Persons tab`);
            setActiveTab('connectedPersons');
            return;
          }
          const nomContactRaw = cleanConnectedPhone(p.nomineeContact) || (
            (!p.nomineeName || p.nomineeName.trim().toLowerCase() === p.name.trim().toLowerCase()) ? cleanConnectedPhone(p.contactNo) : ''
          );
          const nomContactDigits = nomContactRaw.replace(/\D/g, '');
          if (nomContactDigits.length > 0 && nomContactDigits.length !== 10) {
            toast.error(`Nominee contact number for "${nomName}" must be 10 digits`);
            setActiveTab('connectedPersons');
            return;
          }
        }
      }
    }

    const safeIsoDate = (val?: any): string | undefined => {
      if (!val) return undefined;
      if (val instanceof Date) {
        return !isNaN(val.getTime()) ? val.toISOString() : undefined;
      }
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (!trimmed) return undefined;

        // Check for DD/MM/YYYY or DD-MM-YYYY
        const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (dmyMatch) {
          const day = parseInt(dmyMatch[1], 10);
          const month = parseInt(dmyMatch[2], 10) - 1;
          const year = parseInt(dmyMatch[3], 10);
          const d = new Date(Date.UTC(year, month, day, 12, 0, 0));
          if (!isNaN(d.getTime())) return d.toISOString();
        }

        // Check for YYYY-MM-DD or YYYY/MM/DD
        const ymdMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
        if (ymdMatch) {
          const year = parseInt(ymdMatch[1], 10);
          const month = parseInt(ymdMatch[2], 10) - 1;
          const day = parseInt(ymdMatch[3], 10);
          const d = new Date(Date.UTC(year, month, day, 12, 0, 0));
          if (!isNaN(d.getTime())) return d.toISOString();
        }

        try {
          const d = new Date(trimmed);
          if (!isNaN(d.getTime())) return d.toISOString();
        } catch { /* ignore */ }
        return undefined;
      }
      try {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d.toISOString();
      } catch { /* ignore */ }
      return undefined;
    };

    const normalizePaymentFrequency = (freq?: string): string => {
      if (!freq) return 'YEARLY';
      const clean = String(freq).toUpperCase().replace(/[^A-Z]/g, '');
      if (clean.includes('HALFYEARLY') || clean.includes('SEMI') || clean.includes('HALF')) return 'HALF_YEARLY';
      if (clean.includes('QUARTER')) return 'QUARTERLY';
      if (clean.includes('MONTH')) return 'MONTHLY';
      if (clean.includes('SINGLE') || clean.includes('ONE')) return 'SINGLE';
      return 'YEARLY';
    };

    const normalizePolicyStatus = (st?: string): string => {
      if (!st) return 'INFORCE';
      const clean = String(st).toUpperCase().replace(/[^A-Z]/g, '');
      if (clean.includes('RENEWAL')) return 'RENEWAL_DUE';
      if (clean.includes('GRACE')) return 'GRACE_PERIOD';
      if (clean.includes('LAPSE')) return 'LAPSED';
      if (clean.includes('CANCEL')) return 'CANCELLED';
      if (clean.includes('INACTIVE')) return 'INACTIVE_OLD';
      if (clean.includes('ACTIVE')) return 'ACTIVE';
      return 'INFORCE';
    };

    const isoStart = safeIsoDate(startDate);
    const isoEnd = safeIsoDate(endDate);

    if (isFieldRequired('startDate', true) && !isoStart) {
      toast.error('Valid Start Date is required');
      setActiveTab('premium');
      return;
    }
    if (isFieldRequired('endDate', true) && !isoEnd) {
      toast.error('Valid End Date is required');
      setActiveTab('premium');
      return;
    }
    if (isFieldRequired('premiumAmount', false) && (!premiumAmount || Number(premiumAmount) <= 0)) {
      toast.error('Valid Premium Amount is required');
      setActiveTab('premium');
      return;
    }
    if (isFieldRequired('paymentFrequency', false) && !paymentFrequency) {
      toast.error('Payment Frequency is required');
      setActiveTab('premium');
      return;
    }

    const dynamicPolicyFields: Array<{ key: string; label: string; val: any; tab: string }> = [
      { key: 'insuredPerson', label: 'Insured Person', val: insuredPerson, tab: 'plan' },
      { key: 'agentCode', label: 'Agent Code', val: agentCode, tab: 'premium' },
      { key: 'notes', label: 'Notes', val: notes, tab: 'premium' },
      { key: 'nextDueDate', label: 'Next Due Date', val: nextDueDate, tab: 'premium' },
      { key: 'maturityDate', label: 'Date of Maturity', val: maturityDate, tab: 'premium' },
      { key: 'firstPremiumDate', label: 'First Premium Date', val: firstPremiumDate, tab: 'premium' },
      { key: 'lastPremiumDate', label: 'Last Premium Date', val: lastPremiumDate, tab: 'premium' },
      { key: 'assignedEmployeeId', label: 'Assigned Employee', val: assignedEmployeeId, tab: 'premium' },
    ];
    for (const f of dynamicPolicyFields) {
      if (isFieldRequired(f.key, false) && (!f.val || String(f.val).trim() === '')) {
        toast.error(f.label + ' is required');
        setActiveTab(f.tab as any);
        return;
      }
    }

    setSubmitting(true);
    try {
      // Build notes text combining extras if present
      let cleanNotes = notes.trim();
      if (policyZoneCity) {
        cleanNotes += `\nPolicy Zone City: ${policyZoneCity}`;
        cleanNotes += `\nPolicy Zone Location City: ${policyZoneCity}`;
      }
      if (insuredPerson) cleanNotes += `\nInsured Person: ${insuredPerson}`;
      if (customerCategory) cleanNotes += `\nCustomer Category: ${customerCategory}`;
      Object.entries(extraPolicyNotes).forEach(([key, val]) => {
        if (val) cleanNotes += `\n${key}: ${val}`;
      });
      if (durationYears) {
        cleanNotes += `\nPolicy Tenure: ${durationYears} ${Number(durationYears) === 1 ? 'Year' : 'Years'}`;
      }
      if (policyTerm) {
        cleanNotes += `\nPolicy Term: ${policyTerm}`;
      }
      if (isLifeCategory) {
        if (firstYearPremium) cleanNotes += `\n1st Year Premium Amount: ₹${firstYearPremium}`;
        if (secondYearPremium) cleanNotes += `\n2nd Year Onwards Premium Amount: ₹${secondYearPremium}`;
        if (ageAtEntry) cleanNotes += `\nAge at Entry: ${ageAtEntry}`;
        if (ageAtLastPremium) cleanNotes += `\nAge at Last Premium: ${ageAtLastPremium}`;
        if (ageAtMaturity) cleanNotes += `\nAge at Maturity: ${ageAtMaturity}`;
      }
      if (policyPeriod) cleanNotes += `\nPolicy Period: ${policyPeriod}`;
      if (firstPremiumDate) cleanNotes += `\nFirst Premium Date: ${firstPremiumDate}`;
      if (premiumPaymentPeriod) cleanNotes += `\nPremium Payment Period: ${premiumPaymentPeriod} Years`;
      if (lastPremiumDate) cleanNotes += `\nLast Premium Date: ${lastPremiumDate}`;
      if (emiCase) {
        if (downpaymentAmount) cleanNotes += `\nDownpayment Amount: ₹${downpaymentAmount}`;
        if (processingFee) cleanNotes += `\nProcessing Fee (incl. GST): ₹${processingFee}`;
        if (installmentAmount || emiPremium) {
          cleanNotes += `\nInstallment Amount: ₹${installmentAmount || emiPremium}`;
        }
        if (noOfInstallments) cleanNotes += `\nNo. of Installments: ${noOfInstallments}`;
        if (emiDate) cleanNotes += `\nInstallment Date: ${emiDate}`;
        if (lastInstallmentDate || lastPremiumDate) {
          cleanNotes += `\nLast Installment Date: ${lastInstallmentDate || lastPremiumDate}`;
        }
        cleanNotes += `\nEMI Case: Yes`;
        if (paymentDate) cleanNotes += `\nPayment Date: ${paymentDate}`;
        if (firstInstallmentDate || firstPremiumDate) cleanNotes += `\n1st Installment Date: ${firstInstallmentDate || firstPremiumDate}`;
        if (loanAmount) cleanNotes += `\nLoan Amount: ₹${loanAmount}`;
        if (emiComment) cleanNotes += `\nInstallment Comment: ${emiComment}`;
      } else {
        cleanNotes += `\nEMI Case: No`;
      }
      if (paymentMode) {
        let pStr = paymentMode;
        if (paymentDate && paymentDate !== 'N/A') pStr += `, Date: ${paymentDate}`;
        if (transactionRef && transactionRef !== 'N/A') pStr += `, Ref: ${transactionRef}`;
        cleanNotes += `\nPayment Mode: ${pStr}`;
      }
      if (isLoanCase) {
        const parts = [
          loanAmount ? `Amount: ₹${loanAmount}` : null,
          loanProvider && loanProvider !== 'N/A' ? `Provider: ${loanProvider}` : null,
          loanSanctionNo && loanSanctionNo !== 'N/A' ? `Sanction No: ${loanSanctionNo}` : null,
          loanEmi ? `EMI: ₹${loanEmi}` : null,
        ].filter(Boolean);
        if (parts.length > 0) cleanNotes += `\nLoan Case: ${parts.join(', ')}`;
      }
      if (bankName || ifscCode || accountNumber) {
        const parts = [
          bankName && bankName !== 'N/A' ? `Bank: ${bankName}` : null,
          ifscCode && ifscCode !== 'N/A' ? `IFSC: ${ifscCode}` : null,
          branch && branch !== 'N/A' ? `Branch: ${branch}` : null,
          accountNumber && accountNumber !== 'N/A' ? `A/C: ${accountNumber}` : null,
          accountType && accountType !== 'N/A' ? `Type: ${accountType}` : null,
          accountHolderName && accountHolderName !== 'N/A' ? `Holder: ${accountHolderName}` : null,
        ].filter(Boolean);
        if (parts.length > 0) cleanNotes += `\nBank Details: ${parts.join(', ')}`;
      }
      if (firmName || firmPan || firmGst) {
        const parts = [
          firmName && firmName !== 'N/A' ? `Firm: ${firmName}` : null,
          firmPan && firmPan !== 'N/A' ? `PAN: ${firmPan}` : null,
          firmGst && firmGst !== 'N/A' ? `GST: ${firmGst}` : null,
        ].filter(Boolean);
        if (parts.length > 0) cleanNotes += `\nGST Details: ${parts.join(', ')}`;
      } else if (gstApplicable) {
        cleanNotes += `\nGST Details: Applicable: Yes (${gstPercentage}%), GST Amount: ₹${gstAmount || '0'}`;
      }
      if (phcRequired) {
        cleanNotes += `\nPreventive Health Checkup: Yes (Amount: ₹${phcAmount || '0'}, Status: ${phcStatus}, Settled: ${phcClaimSettled ? 'Yes' : 'No'}${phcInsuredPerson ? `, Insured Person: ${phcInsuredPerson}` : ''})`;
        if (phcStatus) cleanNotes += `\nPHC Status: ${phcStatus}`;
        if (phcInsuredPerson) cleanNotes += `\nPHC Insured Person: ${phcInsuredPerson}`;
        cleanNotes += `\nPHC Stage: ${phcStage || 'TO_CONTACT'}`;
      } else {
        cleanNotes += `\nPreventive Health Checkup: No`;
      }
      const proposerClean = (insuredPerson || contactName || '').trim().toLowerCase();
      const validMembers = members.filter(p => 
        p.relationship?.toLowerCase() !== 'self' && 
        (!proposerClean || p.name.trim().toLowerCase() !== proposerClean)
      );
      if (validMembers.length > 0) {
        validMembers.forEach((p, idx) => {
          if (p.name.trim()) {
            cleanNotes += `\nConnected Person ${idx + 1}: Name: ${p.name.trim()}, Relationship: ${p.relationship}, Contact: ${cleanConnectedPhone(p.contactNo) || 'N/A'}, DoB: ${p.dob || 'N/A'}, Gender: ${p.gender || 'MALE'}`;
          }
          if (p.isNominee) {
            const nomPhone = cleanConnectedPhone(p.nomineeContact) || (
              (!p.nomineeName || p.nomineeName.trim().toLowerCase() === p.name.trim().toLowerCase()) ? cleanConnectedPhone(p.contactNo) : ''
            );
            cleanNotes += `\nNominee Details ${idx + 1}: Name: ${p.nomineeName?.trim() || p.name.trim()}, Relationship: ${p.nomineeRelation || p.relationship}, Contact: ${nomPhone || 'N/A'}, DoB: ${p.nomineeDob || p.dob || 'N/A'}, Share: ${p.nomineePercentage || 100}%`;
          }
        });
      }

      const rawPrem = isLifeCategory ? (firstYearPremium || premiumAmount || 0) : (premiumAmount || 0);
      const cleanPremium = Number(String(rawPrem).replace(/,/g, '')) || 0;
      const cleanSum = Number(String(sumAssured || 0).replace(/,/g, '')) || 0;

      const payload: any = {
        contactId: finalContactId,
        planId: selectedPlanId,
        policyNumber: policyNumber.trim(),
        sumAssured: cleanSum,
        premiumAmount: cleanPremium,
        paymentFrequency: normalizePaymentFrequency(paymentFrequency),
        startDate: isoStart,
        endDate: isoEnd,
        nextDueDate: safeIsoDate(nextDueDate),
        maturityDate: safeIsoDate(maturityDate),
        businessType,
        renewedFromPolicyId: (businessType === 'RENEWAL' && previousPolicyId) ? previousPolicyId : undefined,
        assignedEmployeeId: assignedEmployeeId || undefined,
        status: normalizePolicyStatus(status) as any,
        notes: cleanNotes || undefined,
      };

      let res;
      if (policyToEdit && policyToEdit.id) {
        res = await policiesService.update(policyToEdit.id, payload);
      } else {
        res = await policiesService.create(payload);
      }

      const savedPolicy = res?.data ?? res;

      // Upload pending documents
      if (savedPolicy?.id && pendingDocs.length > 0) {
        for (const doc of pendingDocs) {
          try {
            await documentsService.upload(doc.file, {
              policyId: savedPolicy.id,
              type: doc.tag,
              title: doc.title,
            });
          } catch (uploadErr) {
            console.error('Document upload error:', uploadErr);
          }
        }
      }

      const targetPolicyId = policyToEdit?.id || savedPolicy?.id;
      if (targetPolicyId && members.length > 0) {
        for (const person of members) {
          if (person.name.trim()) {
            try {
              await policiesService.addMember(targetPolicyId, {
                name: person.name.trim(),
                relationship: person.relationship || 'Spouse',
                dateOfBirth: person.dob ? new Date(person.dob).toISOString() : undefined,
                gender: person.gender || 'MALE',
              });
            } catch { /* ignore */ }
            if (person.isNominee) {
              try {
                await policiesService.addNominee(targetPolicyId, {
                  name: person.nomineeName?.trim() || person.name.trim(),
                  relationship: person.nomineeRelation || person.relationship || 'Other',
                  sharePercent: Number(person.nomineePercentage) || 100,
                  dateOfBirth: (person.nomineeDob || person.dob) ? new Date(person.nomineeDob || person.dob).toISOString() : undefined,
                  phone: (() => {
                    const digits = (cleanConnectedPhone(person.nomineeContact) || (
                      (!person.nomineeName || person.nomineeName.trim().toLowerCase() === person.name.trim().toLowerCase()) ? cleanConnectedPhone(person.contactNo) : ''
                    )).replace(/\D/g, '');
                    return digits.length === 10 ? digits : undefined;
                  })(),
                });
              } catch { /* ignore */ }
            }
          }
        }
      }

      qc.invalidateQueries({ queryKey: ['policies'] });
      qc.invalidateQueries({ queryKey: ['policies', 'phc-tracking'] });
      qc.invalidateQueries({ queryKey: ['phc-tracking'] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      try { localStorage.removeItem('insumitra_phc_tracking_cache'); } catch {}
      window.dispatchEvent(new CustomEvent('insumitra_phc_updated'));
      qc.invalidateQueries({ queryKey: ['contacts'] });
      if (contactId) qc.invalidateQueries({ queryKey: ['contact', contactId] });
      qc.invalidateQueries({ queryKey: ['contact-activity'] });
      qc.refetchQueries({ queryKey: ['contact-activity'] });
      if (policyHistoryContactId) {
        qc.invalidateQueries({ queryKey: ['contact-activity', policyHistoryContactId] });
        qc.refetchQueries({ queryKey: ['contact-activity', policyHistoryContactId] });
      }
      toast.success(policyToEdit ? 'Policy updated successfully' : 'Policy created successfully');
      onSuccess?.();
      setIsViewOnly(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message || (policyToEdit ? 'Failed to update policy' : 'Failed to create policy');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  if (policyId && isPolicyLoading && !policyToEdit) {
    return (
      <Modal open={open} onClose={onClose} closeOnEscapeAndBackdrop={false} title="Policy Details" size="2xl">
        <div className="flex h-64 items-center justify-center text-slate-400 gap-2">
          <RotateCw className="animate-spin text-blue-600" size={20} />
          <span>Loading policy details...</span>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeOnEscapeAndBackdrop={false}
      title={title || (policyToEdit ? (isViewOnly ? 'Policy Details' : 'Edit Policy') : (isViewOnly ? 'View Policy Profile' : 'Add New Policy'))}
      subtitle={subtitle || (isViewOnly ? 'View policy details and plan information.' : (contactName ? (policyToEdit ? `Update policy profile for ${contactName}` : `Attach policy profile for ${contactName}`) : (policyToEdit ? 'Update policy details matching client standards.' : 'Enter policy details matching client standards.')))}
      size="2xl"
      icon={<Shield className="text-blue-600" size={20} />}
      actions={
        <div className="flex flex-wrap items-center gap-2.5 mr-1">
          {isViewOnly ? (
            <button
              type="button"
              onClick={() => setIsViewOnly(false)}
              className="flex items-center gap-1.5 px-3 sm:px-5 py-1.5 sm:py-2 text-[10px] sm:text-xs font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl cursor-pointer shadow-md shadow-blue-500/20 transition-all hover:scale-105"
            >
              <Pencil size={13} />
              <span>Edit Policy</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={(e) => handleFormSubmit(e as any)}
              className="px-3 sm:px-5 py-1.5 sm:py-2 text-[10px] sm:text-xs font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl cursor-pointer shadow-md shadow-blue-500/20 transition-all hover:scale-105 disabled:opacity-50"
            >
              {submitting ? (policyToEdit ? 'Updating Policy…' : 'Saving Policy…') : (policyToEdit ? 'Update Policy' : 'Save Policy')}
            </button>
          )}
        </div>
      }
    >
      <form onSubmit={handleFormSubmit} className="space-y-3 py-1">
        {/* ── Sub-navigation 5 Tabs Header (Matches main Policies page) ────────────── */}
        <div
          onWheel={(e) => {
            if (e.deltaY !== 0) {
              e.currentTarget.scrollLeft += e.deltaY;
            }
          }}
          className="flex items-center bg-slate-200/60 p-1.5 pb-2 rounded-2xl mb-3 gap-1.5 sm:gap-2 border border-slate-200/80 shadow-2xs overflow-x-auto tab-scrollbar flex-nowrap scroll-smooth"
        >
          <button
            type="button"
            onClick={() => setActiveTab('policyPlan')}
            className={clsx(
              'px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0',
              activeTab === 'policyPlan'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            )}
          >
            <Shield size={14} />
            Policy & Plan Details
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('premium')}
            className={clsx(
              'px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0',
              activeTab === 'premium'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            )}
          >
            <CreditCard size={14} />
            Premium & Payment Details
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('connectedPersons')}
            className={clsx(
              'px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0',
              activeTab === 'connectedPersons'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            )}
          >
            <Users size={14} />
            Connected Persons ({members.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('phcDetails')}
            className={clsx(
              'px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0',
              activeTab === 'phcDetails'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            )}
          >
            <Activity size={14} />
            Preventive Health Checkup
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('policyDocs')}
            className={clsx(
              'px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0',
              activeTab === 'policyDocs'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            )}
          >
            <FileText size={14} />
            Policy Documents ({pendingDocs.length})
          </button>
          {policyToEdit && (
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={clsx(
                'px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0',
                activeTab === 'history'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              )}
            >
              <History size={14} />
              History
            </button>
          )}
        </div>

        {/* ── Form Content Container ───────────────────────────────────────── */}
        <div className="space-y-4">
          <fieldset disabled={isViewOnly} className="contents">

          {/* ════════ TAB 1: Policy & Plan Details ════════ */}
          {activeTab === 'policyPlan' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Target Contact / Client Name Selection & Banner */}
              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCircle2 className="text-blue-600" size={18} />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Target Contact / Client Name <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span></p>
                      <p className="text-xs font-extrabold text-blue-950">
                        {contactName || (contactsList.find(c => c.id === selectedContactId)?.firstName
                          ? `${contactsList.find(c => c.id === selectedContactId)?.firstName} ${contactsList.find(c => c.id === selectedContactId)?.lastName || ''}`
                          : 'Select Target Contact')}
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white font-mono text-[10px] font-bold">Attached</span>
                </div>

                <div>
                  <CustomSelect
                    value={selectedContactId}
                    onChange={val => {
                      setSelectedContactId(val);
                      if (!val) {
                        setMembers(prev => prev.filter(p => !p.id.startsWith('contact-')));
                        setInsuredPerson('');
                        return;
                      }
                      const c = contactsList.find((x: any) => x.id === val);
                      if (c) {
                        const fullName = `${c.firstName || c.name || ''} ${c.lastName || ''}`.trim();
                        setInsuredPerson(fullName);
                        const cCity = c.addresses?.find((a: any) => a.isPrimary)?.city || c.addresses?.[0]?.city || c.city || '';
                        if (cCity && cCity !== 'N/A') {
                          setPolicyZoneCity(cCity);
                        }
                      }
                    }}
                    placeholder="-- Select Target Contact / Client Name --"
                    searchable
                    options={[
                      { value: '', label: '-- Select Target Contact / Client Name --' },
                      ...contactsList.map((c: any) => ({
                        value: c.id,
                        label: `${c.firstName || c.name || ''} ${c.lastName || ''} ${c.phone ? `(${c.phone})` : ''}`.trim()
                      }))
                    ]}
                  />
                </div>
              </div>

              {/* Section 1 Card: Policy Details */}
              <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-visible">
                <div
                  className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none rounded-t-2xl"
                  onClick={() => setIsPolicyDetailsCollapsed(prev => !prev)}
                >
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">1</span>
                    Policy Details
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-semibold">Base Policy Configuration</span>
                    <ChevronDown
                      size={16}
                      className={`text-slate-500 transition-transform duration-200 ${isPolicyDetailsCollapsed ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>

                {!isPolicyDetailsCollapsed && (
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    
                    {/* Custom Dropdowns Configured for Policy in Operations */}
                    {getModuleCustomDropdowns('Policy').map(customDrop => {
                      const currentVal = (extraPolicyNotes as any)[customDrop.name] || '';
                      return (
                        <div key={customDrop.id}>
                          <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            {customDrop.name}
                          </label>
                          <CustomSelect
                            value={currentVal}
                            onChange={val => {
                              setExtraPolicyNotes((prev: Record<string, string>) => ({
                                ...prev,
                                [customDrop.name]: val,
                              }));
                            }}
                            placeholder={`Select ${customDrop.name}`}
                            options={[
                              { value: '', label: `Select ${customDrop.name}` },
                              ...(customDrop.options || []).map((opt: string) => ({ value: opt, label: opt }))
                            ]}
                          />
                        </div>
                      );
                    })}

                    {/* Product Category */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                        Product Category <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <CustomSelect
                        value={selectedCategory}
                        onChange={val => {
                          setSelectedCategory(val);
                          if (selectedPlanId && val) {
                            const curPlan = plansList.find((p: any) => p.id === selectedPlanId);
                            if (curPlan && !isCategoryMatch(curPlan.category || '', val)) {
                              setSelectedPlanId('');
                            }
                          }
                        }}
                        placeholder="Select Product Category"
                        options={[
                          { value: '', label: 'Select Product Category' },
                          ...productCategoryOptions.map(cat => ({ value: cat, label: cat.replace('_', ' ') }))
                        ]}
                      />
                    </div>

                    {/* Business Type */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                        Business Type <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <CustomSelect
                        value={businessType}
                        onChange={val => setBusinessType(val as any)}
                        placeholder="Select Business Type"
                        options={[
                          { value: '', label: 'Select Business Type' },
                          ...getActiveDropdownOptions('Policy', 'Customer Categories', [
                            { value: 'FRESH', label: 'Fresh' },
                            { value: 'PORT', label: 'Port' },
                            { value: 'RENEWAL', label: 'Renewal' },
                          ])
                        ]}
                      />
                    </div>

                    {/* Renewal Selection & Copy Details */}
                    {businessType === 'RENEWAL' && (
                      <div className="col-span-1 md:col-span-2 border border-amber-200 bg-amber-50/70 rounded-xl p-3 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <label className="text-[10px] font-extrabold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                            <RotateCw size={13} className="text-amber-600" />
                            Select Previous Policy to Renew <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={copyPreviousDetails}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setCopyPreviousDetails(checked);
                                if (checked && previousPolicyId) {
                                  handleCopyFromPreviousPolicy(previousPolicyId);
                                }
                              }}
                              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-amber-950">
                              ☐ Copy details from previous policy
                            </span>
                          </label>
                        </div>

                        <CustomSelect
                          value={previousPolicyId}
                          onChange={val => {
                            setPreviousPolicyId(val);
                            if (copyPreviousDetails && val) {
                              handleCopyFromPreviousPolicy(val);
                            }
                          }}
                          placeholder={`-- Select Previous Policy (${previousPolicies.length} available) --`}
                          searchable
                          options={[
                            { value: '', label: `-- Select Previous Policy (${previousPolicies.length} available) --` },
                            ...previousPolicies.map((pol: any) => {
                              const stDisplay = getPolicyStatusDisplay(pol);
                              return {
                                value: pol.id,
                                label: `Policy #${pol.policyNumber} — ${pol.plan?.name || 'Plan'} (${stDisplay.label}) — Ends: ${pol.endDate ? String(pol.endDate).split('T')[0] : 'N/A'}`
                              };
                            })
                          ]}
                        />

                        {loadingCopy && (
                          <p className="text-[10px] text-amber-800 font-medium italic animate-pulse">
                            Fetching and pre-filling previous policy details...
                          </p>
                        )}
                      </div>
                    )}

                    {/* Insurance Company */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                        Insurance Company <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <CustomSelect
                        value={selectedCompanyId}
                        onChange={val => {
                          setSelectedCompanyId(val);
                          setSelectedPlanId('');
                        }}
                        placeholder="All Insurance Companies"
                        searchable
                        options={[
                          { value: '', label: 'All Insurance Companies' },
                          ...availableCompanies.map((c: any) => ({ value: c.id, label: c.name }))
                        ]}
                      />
                    </div>

                    {/* Insurance Plan */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                        Insurance Plan <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <CustomSelect
                        value={selectedPlanId}
                        onChange={val => {
                          setSelectedPlanId(val);
                          if (val) {
                            const chosen = plansList.find((p: any) => p.id === val);
                            if (chosen && !selectedCompanyId) {
                              const compId = chosen.companyId || chosen.company?.id;
                              if (compId) setSelectedCompanyId(compId);
                            }
                          }
                        }}
                        placeholder={`Select Plan (${availablePlans.length} available)`}
                        searchable
                        options={[
                          { value: '', label: `Select Plan (${availablePlans.length} available)` },
                          ...availablePlans.map((p: any) => ({
                            value: p.id,
                            label: `${p.name} ${p.company?.name ? `(${p.company.name})` : ''}`.trim()
                          }))
                        ]}
                      />
                    </div>

                    {/* Policy Period (Driven dynamically by backend scenario) */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1 mb-1">
                        Policy Period <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                        {activeScenario && <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">✓ Dynamic</span>}
                      </label>
                      <CustomSelect
                        value={policyPeriod}
                        onChange={val => {
                          setPolicyPeriod(val);
                          if (startDate) {
                            autoCalculateDates(startDate, val);
                          }
                        }}
                        placeholder="Select Policy Period"
                        options={[
                          { value: '', label: 'Select Policy Period' },
                          ...dynamicPolicyPeriods.map((period: string) => ({ value: period, label: period }))
                        ]}
                      />
                    </div>

                    {/* Customer Category */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">Customer Category</label>
                      <CustomSelect
                        value={customerCategory}
                        onChange={val => setCustomerCategory(val)}
                        placeholder="Select Customer Category"
                        options={[
                          { value: '', label: 'Select Customer Category' },
                          { value: 'Fresh', label: 'Fresh' },
                          { value: 'Port', label: 'Port' },
                          { value: 'Renewal', label: 'Renewal' },
                        ]}
                      />
                    </div>

                    {/* Proposer Name */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                        Proposer Name
                      </label>
                      <input
                        type="text"
                        className="input text-xs w-full mt-1 font-bold text-slate-800"
                        placeholder="Enter proposer name"
                        value={insuredPerson}
                        onChange={(e) => setInsuredPerson(e.target.value)}
                      />
                    </div>

                    {/* Active Scenario Indicator Banner */}
                    {activeScenario && (
                      <div className="col-span-1 md:col-span-2 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Activity size={16} className="text-emerald-600 shrink-0" />
                          <div>
                            <p className="font-bold text-[11px]">Backend Scenario Rule Applied</p>
                            <p className="text-[10px] text-emerald-700 font-medium">
                              Configured for {activeScenario.company?.name || 'Company'} — {activeScenario.plan?.name || 'Plan'} ({activeScenario.businessType}). Valid periods & payment modes loaded from DB.
                            </p>
                          </div>
                        </div>
                        <span className="bg-emerald-600 text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0">
                          Active Rule
                        </span>
                      </div>
                    )}

                    {/* Policy Remarks / Comment */}
                    <div className="col-span-1 md:col-span-2">
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">Comment / Notes</label>
                      <textarea
                        rows={2}
                        className="input text-xs w-full mt-1 min-h-[50px]"
                        placeholder="Add any internal comments or notes regarding this policy..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2 Card: Plan Details */}
              <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                <div
                  className="bg-gradient-to-r from-indigo-50/80 via-slate-50 to-purple-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                  onClick={() => setIsPlanDetailsCollapsed(prev => !prev)}
                >
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">2</span>
                    Plan Details
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-semibold">Coverage & Plan Options</span>
                    <ChevronDown
                      size={16}
                      className={`text-slate-500 transition-transform duration-200 ${isPlanDetailsCollapsed ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>

                {!isPlanDetailsCollapsed && (
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* Policy Number */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">
                        Policy Number <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="input text-xs w-full mt-1"
                        placeholder="e.g. POL-1002938"
                        value={policyNumber}
                        onChange={(e) => setPolicyNumber(e.target.value)}
                        required
                      />
                    </div>

                    {/* Proposer Name */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">
                        Proposer Name
                      </label>
                      <input
                        type="text"
                        className="input text-xs w-full mt-1 font-bold text-slate-800"
                        placeholder="Enter proposer name"
                        value={insuredPerson}
                        onChange={(e) => setInsuredPerson(e.target.value)}
                      />
                    </div>

                    {/* Sum Assured */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider block">
                          Sum Assured (₹) {isFieldRequired('sumAssured', false) && <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>}
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsManualSumAssured(prev => !prev)}
                          className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                        >
                          {isManualSumAssured ? '← Select from list' : '+ Enter manually'}
                        </button>
                      </div>
                      {isManualSumAssured ? (
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={sumAssured}
                            onChange={(e) => setSumAssured(e.target.value)}
                            placeholder="Enter sum assured (e.g. 500000)"
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 pr-16"
                            required={isFieldRequired('sumAssured', false)}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400 pointer-events-none">
                            INR (₹)
                          </span>
                        </div>
                      ) : (
                        <CustomSelect
                          value={sumAssured}
                          onChange={(val) => setSumAssured(val)}
                          placeholder={`Select Sum Assured ${isFieldRequired('sumAssured', false) ? '*' : '(Optional)'}`}
                          options={[
                            { value: '', label: `Select Sum Assured ${isFieldRequired('sumAssured', false) ? '*' : '(Optional)'}` },
                            ...SUM_INSURED_OPTIONS.map((opt: any) => ({ value: String(opt.value), label: opt.label })),
                            ...(sumAssured && !SUM_INSURED_OPTIONS.some((opt: any) => String(opt.value) === String(sumAssured))
                              ? [{ value: String(sumAssured), label: `₹${Number(sumAssured).toLocaleString('en-IN')} (Custom)` }]
                              : [])
                          ]}
                        />
                      )}
                    </div>

                    {/* Agent Code */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">Agent Code</label>
                      <input
                        type="text"
                        className="input text-xs w-full mt-1"
                        placeholder="e.g. AG-8821"
                        value={agentCode}
                        onChange={(e) => setAgentCode(e.target.value)}
                      />
                    </div>

                    {/* Policy Zone City */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">Policy Zone City</label>
                      <input
                        type="text"
                        className="input text-xs w-full mt-1"
                        placeholder="Type policy zone city manually..."
                        value={policyZoneCity}
                        onChange={(e) => setPolicyZoneCity(e.target.value)}
                      />
                    </div>

                    {/* Policy Status */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">Policy Status</label>
                      <CustomSelect
                        value={status === 'ACTIVE' ? 'INFORCE' : (status || 'INFORCE')}
                        onChange={val => setStatus(val)}
                        placeholder="Select Policy Status"
                        options={STATUS_OPTIONS}
                      />
                    </div>

                    {/* Assigned Employee */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">Assigned Employee</label>
                      <CustomSelect
                        value={assignedEmployeeId}
                        onChange={val => setAssignedEmployeeId(val)}
                        placeholder="Unassigned"
                        options={[
                          { value: '', label: 'Unassigned' },
                          ...(employees || []).map((emp: any) => ({
                            value: emp.id,
                            label: `${emp.firstName || emp.name} ${emp.lastName || ''}`.trim()
                          }))
                        ]}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════ TAB 2: Premium & Payment Details ════════ */}
          {activeTab === 'premium' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Section 1: Premium Breakdown & Instalments */}
              <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-visible">
                <div
                  className="bg-gradient-to-r from-emerald-50/80 via-slate-50 to-teal-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none rounded-t-2xl"
                  onClick={() => setIsPremiumBreakdownCollapsed(prev => !prev)}
                >
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex flex-wrap items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">1</span>
                    Premium Breakdown & Instalments
                  </h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] text-slate-700 font-bold">Premium Amounts & Frequency</span>
                    <ChevronDown
                      size={16}
                      className={`text-slate-500 transition-transform duration-200 ${isPremiumBreakdownCollapsed ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>

                {!isPremiumBreakdownCollapsed && (
                  <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3.5 animate-fadeIn">
                    {!isLifeCategory && (
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                          Premium Amount (₹) <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                        </label>
                        <div className="relative">
                          <Shield size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500/80" />
                          <input
                            type="text"
                            value={formatIndianNumber(premiumAmount)}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/,/g, '');
                              setPremiumAmount(raw);
                              setFirstYearPremium(raw);
                            }}
                            className="input pl-9 w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="Enter premium amount"
                          />
                        </div>
                      </div>
                    )}

                    {showInstallmentAndYearlyFields && (
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                          1st Year Premium Amount (₹) <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={formatIndianNumber(firstYearPremium || premiumAmount || 0)}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/,/g, '');
                            setFirstYearPremium(raw);
                            setPremiumAmount(raw);
                          }}
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="1st Year Premium"
                        />
                      </div>
                    )}

                    {showInstallmentAndYearlyFields && (
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                          2nd Year Onwards Premium Amount (₹)
                        </label>
                        <input
                          type="text"
                          value={formatIndianNumber(secondYearPremium || 0)}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/,/g, '');
                            setSecondYearPremium(raw);
                          }}
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="2nd Year Onwards Premium"
                        />
                      </div>
                    )}

                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                        Installment Frequency <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <CustomSelect
                        value={paymentFrequency || 'YEARLY'}
                        onChange={val => {
                          setPaymentFrequency(val);
                          if (val === 'SINGLE') {
                            setNoOfInstallments('1');
                            recalculateLastInstallment({ freq: 'SINGLE', noOfInst: 1 });
                          } else {
                            recalculateLastInstallment({ freq: val });
                          }
                        }}
                        options={paymentFrequencyOptions}
                      />
                    </div>

                    {isLifeCategory && (
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                          Premium Payment Period (Years)
                        </label>
                        <input
                          type="number"
                          value={premiumPaymentPeriod}
                          onChange={e => setPremiumPaymentPeriod(e.target.value)}
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="e.g. 10"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Section 2: Policy Tenure & Term Dates */}
              <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-visible">
                <div
                  className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none rounded-t-2xl"
                  onClick={() => setIsTenureDatesCollapsed(prev => !prev)}
                >
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex flex-wrap items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">2</span>
                    Tenure, Maturity & Term Dates
                  </h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] text-slate-700 font-bold">Tenure & Policy Dates</span>
                    <ChevronDown
                      size={16}
                      className={`text-slate-500 transition-transform duration-200 ${isTenureDatesCollapsed ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>

                {!isTenureDatesCollapsed && (
                  <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3.5 animate-fadeIn">
                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                        Policy Tenure (Years)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={durationYears || ''}
                          onChange={e => {
                            const valStr = e.target.value;
                            if (valStr === '') {
                              setDurationYears('');
                              return;
                            }
                            const val = parseInt(valStr, 10);
                            if (!isNaN(val)) {
                              setDurationYears(Math.min(99, Math.max(1, val)));
                            }
                          }}
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 pr-10 font-bold text-slate-800"
                          placeholder="1 to 99"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 pointer-events-none">
                          Yr
                        </span>
                      </div>
                    </div>

                    {showLifeTermInstallmentFields && (
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                          Policy Term
                        </label>
                        <input
                          type="text"
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 font-bold"
                          value={policyTerm}
                          onChange={e => setPolicyTerm(e.target.value)}
                          placeholder="e.g. 1 Year"
                        />
                      </div>
                    )}

                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                        Policy Start Date <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <DatePicker
                        value={startDate}
                        onChange={(val: any) => {
                          const newStart = typeof val === 'string' ? val : (val?.target?.value || '');
                          setStartDate(newStart);
                          recalculateLastInstallment({ baseDate: newStart });
                        }}
                        className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                        placeholder="DD/MM/YYYY"
                      />
                    </div>

                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                        Policy End Date
                      </label>
                      <DatePicker
                        value={endDate}
                        onChange={(val: any) => setEndDate(typeof val === 'string' ? val : (val?.target?.value || ''))}
                        className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                        placeholder="DD/MM/YYYY"
                      />
                    </div>

                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                        Next Due Date
                      </label>
                      <DatePicker
                        value={nextDueDate}
                        onChange={(val: any) => setNextDueDate(typeof val === 'string' ? val : (val?.target?.value || ''))}
                        className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                        placeholder="DD/MM/YYYY"
                      />
                    </div>

                    {/* Date of Maturity - Life/Term with Installment Case */}
                    {showLifeTermInstallmentFields && (
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                          Date of Maturity
                        </label>
                        <DatePicker
                          value={maturityDate || endDate}
                          onChange={(val: any) => setMaturityDate(typeof val === 'string' ? val : (val?.target?.value || ''))}
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                          placeholder="DD/MM/YYYY"
                        />
                      </div>
                    )}

                    {/* Age at Entry - Life/Term with Installment Case */}
                    {showLifeTermInstallmentFields && (
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                          Age at Entry
                        </label>
                        <input
                          type="number"
                          value={ageAtEntry}
                          onChange={e => setAgeAtEntry(e.target.value)}
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="e.g. 30"
                        />
                      </div>
                    )}

                    {/* Age at Last Premium - Life/Term with Installment Case */}
                    {showLifeTermInstallmentFields && (
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                          Age at Last Premium
                        </label>
                        <input
                          type="number"
                          value={ageAtLastPremium}
                          onChange={e => setAgeAtLastPremium(e.target.value)}
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="e.g. 45"
                        />
                      </div>
                    )}

                    {/* Age at Maturity - Life/Term with Installment Case */}
                    {showLifeTermInstallmentFields && (
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                          Age at Maturity
                        </label>
                        <input
                          type="number"
                          value={ageAtMaturity}
                          onChange={e => setAgeAtMaturity(e.target.value)}
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="e.g. 50"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Section 3: Installment / EMI Gateway Details */}
              <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-visible">
                <div
                  className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none rounded-t-2xl"
                  onClick={() => setIsEmiDetailsCollapsed(prev => !prev)}
                >
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex flex-wrap items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-600 to-blue-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">3</span>
                    Installment / EMI Gateway Details
                  </h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] text-slate-700 font-bold">Gateway & Installment Case</span>
                    <ChevronDown
                      size={16}
                      className={`text-slate-500 transition-transform duration-200 ${isEmiDetailsCollapsed ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>

                {!isEmiDetailsCollapsed && (
                  <div className="p-4 space-y-3 animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                          Installment Case?
                        </label>
                        <CustomSelect
                          value={emiCase ? 'yes' : 'no'}
                          onChange={val => setEmiCase(val === 'yes')}
                          options={[
                            { value: 'no', label: 'No' },
                            { value: 'yes', label: 'Yes' },
                          ]}
                        />
                      </div>
                    </div>

                    {emiCase && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 p-3.5 bg-blue-50/40 rounded-xl border border-blue-100 animate-fadeIn">
                        {/* 1. Installment Gateway */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block mb-1">
                            Installment Gateway
                          </label>
                          <CustomSelect
                            value={emiGateway || ''}
                            onChange={val => setEmiGateway(val)}
                            placeholder="Select Gateway"
                            options={[
                              { value: '', label: 'Select Gateway' },
                              { value: 'FIBE', label: 'FIBE' },
                              { value: 'Shopse', label: 'Shopse' },
                              { value: 'BimaPay', label: 'BimaPay' },
                            ]}
                          />
                        </div>

                        {/* 2. Payment Mode */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block mb-1">
                            Payment Mode
                          </label>
                          <CustomSelect
                            value={paymentMode || 'ONLINE'}
                            onChange={val => setPaymentMode(val)}
                            options={[
                              { value: 'ONLINE', label: 'UPI / NetBanking / Online' },
                              { value: 'CHEQUE', label: 'Cheque' },
                              { value: 'NEFT_RTGS', label: 'NEFT / RTGS' },
                              { value: 'CREDIT_CARD', label: 'Credit Card' },
                              { value: 'AUTO_DEBIT', label: 'Auto Debit / NACH' },
                              { value: 'CASH', label: 'Cash' },
                            ]}
                          />
                        </div>

                        {/* 3. Payment Date */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block mb-1">
                            Payment Date
                          </label>
                          <DatePicker
                            value={paymentDate}
                            onChange={(val: any) => setPaymentDate(typeof val === 'string' ? val : (val?.target?.value || ''))}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-blue-200"
                            placeholder="DD/MM/YYYY"
                          />
                        </div>

                        {/* 4. 1st Installment Date */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block mb-1">
                            1st Installment Date
                          </label>
                          <DatePicker
                            value={firstInstallmentDate || firstPremiumDate}
                            onChange={(val: any) => {
                              const v = typeof val === 'string' ? val : (val?.target?.value || '');
                              setFirstInstallmentDate(v);
                              setFirstPremiumDate(v);
                              recalculateLastInstallment({ baseDate: v });
                            }}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-blue-200"
                            placeholder="DD/MM/YYYY"
                          />
                        </div>

                        {/* 5. Installment Date (01 to 31st) */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block mb-1">
                            Installment Date (01 to 31st)
                          </label>
                          <CustomSelect
                            value={emiDate ? String(emiDate).padStart(2, '0') : ''}
                            onChange={val => {
                              setEmiDate(val);
                              recalculateLastInstallment({ day: val });
                            }}
                            placeholder="Select Date"
                            options={[
                              { value: '', label: 'Select Date' },
                              ...INSTALLMENT_DATE_OPTIONS
                            ]}
                          />
                        </div>

                        {/* 6. Last Installment Date */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block mb-1">
                            Last Installment Date
                          </label>
                          <DatePicker
                            value={lastInstallmentDate || lastPremiumDate}
                            onChange={(val: any) => {
                              const v = typeof val === 'string' ? val : (val?.target?.value || '');
                              setLastInstallmentDate(v);
                              setLastPremiumDate(v);
                            }}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-blue-200 font-semibold"
                            placeholder="Calculated automatically"
                          />
                        </div>

                        {/* 7. No. of Installments */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block mb-1">
                            No. of Installments
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={120}
                            value={noOfInstallments || ''}
                            onChange={e => {
                              const v = e.target.value;
                              setNoOfInstallments(v);
                              recalculateLastInstallment({ noOfInst: v || 1 });
                              const nInst = Number(v) || 0;
                              if (nInst > 0 && premiumAmount) {
                                const netBal = Math.max(0, (Number(premiumAmount) || 0) - (Number(downpaymentAmount) || 0));
                                const calculatedAmt = String(Math.round(netBal / nInst));
                                setInstallmentAmount(calculatedAmt);
                                setEmiPremium(calculatedAmt);
                              }
                            }}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-blue-200 font-bold text-slate-800"
                            placeholder="e.g. 12"
                          />
                        </div>

                        {/* 8. Installment Amount (₹) */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block mb-1">
                            Installment Amount (₹)
                          </label>
                          <input
                            type="text"
                            value={formatIndianNumber(installmentAmount || emiPremium || 0)}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/,/g, '');
                              setInstallmentAmount(raw);
                              setEmiPremium(raw);
                            }}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-blue-200"
                            placeholder="Installment Amount"
                          />
                        </div>

                        {/* 9. Downpayment Amount (₹) */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block mb-1">
                            Downpayment Amount (₹)
                          </label>
                          <input
                            type="text"
                            value={formatIndianNumber(downpaymentAmount || 0)}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/,/g, '');
                              setDownpaymentAmount(raw);
                              const nInst = Number(noOfInstallments) || 0;
                              if (nInst > 0 && premiumAmount) {
                                const netBal = Math.max(0, (Number(premiumAmount) || 0) - (Number(raw) || 0));
                                const calculatedAmt = String(Math.round(netBal / nInst));
                                setInstallmentAmount(calculatedAmt);
                                setEmiPremium(calculatedAmt);
                              }
                            }}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-blue-200"
                            placeholder="Downpayment Amount"
                          />
                          {Boolean(premiumAmount && (Number(downpaymentAmount) > 0 || Number(premiumAmount) > 0)) && (
                            <div className="mt-1 flex items-center justify-between text-[10px] font-bold text-slate-500 bg-blue-50/70 px-2 py-0.5 rounded border border-blue-100">
                              <span>Net Balance:</span>
                              <span className="text-blue-800 font-extrabold">₹{Math.max(0, (Number(premiumAmount) || 0) - (Number(downpaymentAmount) || 0)).toLocaleString('en-IN')}</span>
                            </div>
                          )}
                        </div>

                        {/* 10. Loan Amount (₹) */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block mb-1">
                            Loan Amount (₹)
                          </label>
                          <input
                            type="text"
                            value={formatIndianNumber(loanAmount || 0)}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/,/g, '');
                              setLoanAmount(raw);
                              if (Number(raw) > 0) setIsLoanCase(true);
                            }}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-blue-200"
                            placeholder="Loan Amount"
                          />
                        </div>

                        {/* 11. Processing Fee (incl. GST) (₹) */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block mb-1">
                            Processing Fee (incl. GST) (₹)
                          </label>
                          <input
                            type="text"
                            value={formatIndianNumber(processingFee || 0)}
                            onChange={(e) => setProcessingFee(e.target.value.replace(/,/g, ''))}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-blue-200"
                            placeholder="e.g. 500"
                          />
                        </div>

                        {/* 12. Comment */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block mb-1">
                            Comment
                          </label>
                          <input
                            type="text"
                            value={emiComment}
                            onChange={(e) => setEmiComment(e.target.value)}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-blue-200"
                            placeholder="Installment comment / remarks"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Section 4: Payment Mode & Loan Details */}
              <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-visible">
                <div
                  className="bg-gradient-to-r from-purple-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none rounded-t-2xl"
                  onClick={() => setIsPaymentModeLoanCollapsed(prev => !prev)}
                >
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex flex-wrap items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">4</span>
                    Payment Mode & Loan Details
                  </h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] text-slate-700 font-bold">Payment Method & Financed Loan</span>
                    <ChevronDown
                      size={16}
                      className={`text-slate-500 transition-transform duration-200 ${isPaymentModeLoanCollapsed ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>

                {!isPaymentModeLoanCollapsed && (
                  <div className="p-4 space-y-4 animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                          Payment Mode
                        </label>
                        <CustomSelect
                          value={paymentMode || 'ONLINE'}
                          onChange={val => setPaymentMode(val)}
                          options={[
                            { value: 'ONLINE', label: 'UPI / NetBanking / Online' },
                            { value: 'CHEQUE', label: 'Cheque' },
                            { value: 'NEFT_RTGS', label: 'NEFT / RTGS' },
                            { value: 'CREDIT_CARD', label: 'Credit Card' },
                            { value: 'AUTO_DEBIT', label: 'Auto Debit / NACH' },
                            { value: 'CASH', label: 'Cash' },
                          ]}
                        />
                      </div>

                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                          Payment Transaction / Cheque Date
                        </label>
                        <DatePicker
                          value={paymentDate}
                          onChange={(val: any) => setPaymentDate(typeof val === 'string' ? val : (val?.target?.value || ''))}
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                          placeholder="DD/MM/YYYY"
                        />
                      </div>

                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                          Transaction Ref / Cheque No.
                        </label>
                        <input
                          type="text"
                          value={transactionRef}
                          onChange={e => setTransactionRef(e.target.value)}
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="e.g. TXN987654321 / CHQ0012"
                        />
                      </div>

                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                          Loan Case / Financed Policy?
                        </label>
                        <CustomSelect
                          value={isLoanCase ? 'yes' : 'no'}
                          onChange={val => setIsLoanCase(val === 'yes')}
                          options={[
                            { value: 'no', label: 'No' },
                            { value: 'yes', label: 'Yes' },
                          ]}
                        />
                      </div>
                    </div>

                    {isLoanCase && (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5 p-3.5 bg-purple-50/40 rounded-xl border border-purple-100 animate-fadeIn">
                        <div>
                          <label className="label text-[10px] font-extrabold text-purple-800 uppercase tracking-wider block mb-1">Loan Amount (₹)</label>
                          <input
                            type="number"
                            value={loanAmount}
                            onChange={e => setLoanAmount(e.target.value)}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-purple-200"
                            placeholder="Loan Amount"
                          />
                        </div>
                        <div>
                          <label className="label text-[10px] font-extrabold text-purple-800 uppercase tracking-wider block mb-1">Loan Provider (Bank / NBFC)</label>
                          <input
                            type="text"
                            value={loanProvider}
                            onChange={e => setLoanProvider(e.target.value)}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-purple-200"
                            placeholder="e.g. Bajaj Finserv"
                          />
                        </div>
                        <div>
                          <label className="label text-[10px] font-extrabold text-purple-800 uppercase tracking-wider block mb-1">Loan Sanction No.</label>
                          <input
                            type="text"
                            value={loanSanctionNo}
                            onChange={e => setLoanSanctionNo(e.target.value)}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-purple-200"
                            placeholder="Sanction No."
                          />
                        </div>
                        <div>
                          <label className="label text-[10px] font-extrabold text-purple-800 uppercase tracking-wider block mb-1">Loan EMI Amount (₹)</label>
                          <input
                            type="number"
                            value={loanEmi}
                            onChange={e => setLoanEmi(e.target.value)}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-purple-200"
                            placeholder="EMI Amount"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Section 5: Payment Account Details */}
              <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-visible">
                <div
                  className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none rounded-t-2xl"
                  onClick={() => setIsPaymentAccountCollapsed(prev => !prev)}
                >
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex flex-wrap items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">5</span>
                    Payment Account Details
                  </h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] text-slate-700 font-bold">Bank & Account Specifications</span>
                    <ChevronDown
                      size={16}
                      className={`text-slate-500 transition-transform duration-200 ${isPaymentAccountCollapsed ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>

                {!isPaymentAccountCollapsed && (
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5 animate-fadeIn">
                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                        Bank Name
                      </label>
                      <input
                        type="text"
                        value={bankName}
                        onChange={e => setBankName(e.target.value)}
                        className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        placeholder="e.g. HDFC Bank / State Bank of India"
                      />
                    </div>

                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                        IFSC Code
                      </label>
                      <input
                        type="text"
                        value={ifscCode}
                        onChange={e => setIfscCode(e.target.value.toUpperCase())}
                        className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 uppercase"
                        placeholder="e.g. HDFC0001234"
                      />
                    </div>

                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                        Branch Name
                      </label>
                      <input
                        type="text"
                        value={branch}
                        onChange={e => setBranch(e.target.value)}
                        className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        placeholder="e.g. Connaught Place Branch"
                      />
                    </div>

                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                        A/c No. (Account Number)
                      </label>
                      <input
                        type="text"
                        value={accountNumber}
                        onChange={e => setAccountNumber(e.target.value)}
                        className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        placeholder="e.g. 50100234567890"
                      />
                    </div>

                    <div className="col-span-1 md:col-span-2">
                      <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                        Account Type
                      </label>
                      <CustomSelect
                        value={accountType}
                        onChange={val => setAccountType(val)}
                        placeholder="Select Account Type"
                        options={[
                          { value: 'SAVINGS', label: 'Savings Account' },
                          { value: 'CURRENT', label: 'Current Account' },
                          { value: 'OVERDRAFT', label: 'Overdraft Account (OD)' },
                          { value: 'NRE_NRO', label: 'NRE / NRO Account' },
                        ]}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Section 6: GST No Details */}
              <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-50/80 via-slate-50 to-teal-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                  onClick={() => setIsGstDetailsCollapsed(prev => !prev)}
                >
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-teal-600 to-emerald-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">6</span>
                    GST No Details
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-700 font-bold">Firm Name, PAN & GST Registration</span>
                    <ChevronDown
                      size={16}
                      className={`text-slate-500 transition-transform duration-200 ${isGstDetailsCollapsed ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>

                {!isGstDetailsCollapsed && (
                  <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3.5 animate-fadeIn">
                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                        Firm Name
                      </label>
                      <input
                        type="text"
                        value={firmName}
                        onChange={e => setFirmName(e.target.value)}
                        className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        placeholder="Registered Company / Firm Name"
                      />
                    </div>

                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                        Firm PAN No.
                      </label>
                      <input
                        type="text"
                        maxLength={10}
                        value={firmPan}
                        onChange={e => setFirmPan(e.target.value.toUpperCase())}
                        className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 uppercase"
                        placeholder="e.g. ABCDE1234F"
                      />
                    </div>

                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                        Firm GST No.
                      </label>
                      <input
                        type="text"
                        maxLength={15}
                        value={firmGst}
                        onChange={e => setFirmGst(e.target.value.toUpperCase())}
                        className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 uppercase"
                        placeholder="e.g. 27ABCDE1234F1Z5"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════ TAB 3: Connected Persons ════════ */}
          {activeTab === 'connectedPersons' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Header & Add Button */}
              <div className="flex items-center justify-between p-3.5 bg-gradient-to-r from-blue-50/90 to-indigo-50/50 rounded-2xl border border-blue-100 shadow-2xs">
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                    <Users size={16} className="text-blue-600" />
                    Connected Persons & Nominee Details
                  </h4>
                  <p className="text-[11px] text-slate-500">Add dependents, covered persons, and allocate nominee percentage.</p>
                </div>
                <button
                  type="button"
                  onClick={addConnectedPerson}
                  className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-[10px] sm:text-xs rounded-xl flex flex-wrap items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all hover:scale-105 cursor-pointer"
                >
                  <Plus size={14} /> Add Connected Person
                </button>
              </div>

              {/* Nominee Allocation Percentage Summary Bar */}
              {members.some(p => p.isNominee) && (
                <div
                  className={clsx(
                    'p-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all',
                    totalNomineePercentage === 100
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {totalNomineePercentage === 100 ? (
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                    )}
                    <span>
                      {totalNomineePercentage === 100
                        ? 'Nominee percentage allocation complete (100% total).'
                        : `Nominee percentage total must equal 100%. Currently allocated: ${totalNomineePercentage}%.`}
                    </span>
                  </div>
                  <span
                    className={clsx(
                      'px-2.5 py-1 rounded-lg text-xs font-black',
                      totalNomineePercentage === 100 ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                    )}
                  >
                    {totalNomineePercentage}%
                  </span>
                </div>
              )}

              {/* Connected Persons List */}
              {members.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
                    <Users size={20} />
                  </div>
                  <h5 className="text-xs font-extrabold text-slate-700">No Connected Persons Added Yet</h5>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Add family members, dependents, or nominees associated with this policy.
                  </p>
                  <button
                    type="button"
                    onClick={addConnectedPerson}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white text-[10px] sm:text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer inline-flex flex-wrap items-center gap-1.5"
                  >
                    <Plus size={14} /> Add First Connected Person
                  </button>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {members.map((person, idx) => (
                    <div
                      key={person.id}
                      className="border border-slate-200 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all p-4 space-y-3.5"
                    >
                      {/* Header Bar per Person */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-extrabold text-xs flex items-center justify-center border border-slate-200">
                            {idx + 1}
                          </span>
                          <span className="font-extrabold text-xs text-slate-800 uppercase tracking-wide">
                            {person.name || `Connected Person #${idx + 1}`}
                          </span>
                          {person.isCovered && (
                            <span className="inline-flex flex-wrap items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Covered under policy
                            </span>
                          )}
                          {person.isNominee && (
                            <span className="inline-flex flex-wrap items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200">
                              Nominee {person.nomineePercentage && Number(person.nomineePercentage) > 0 ? `(${person.nomineePercentage}%)` : ''}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeConnectedPerson(person.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Remove Person"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Person Fields */}
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Full Name <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                          </label>
                          <input
                            type="text"
                            value={person.name}
                            onChange={e => updateConnectedPerson(person.id, { name: e.target.value })}
                            className="input w-full h-9 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="e.g. Sunita Sharma"
                          />
                        </div>

                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Relationship
                          </label>
                          <CustomSelect
                            value={person.relationship}
                            onChange={val => updateConnectedPerson(person.id, { relationship: val })}
                            placeholder="Select Relationship"
                            options={[
                              { value: 'Spouse', label: 'Spouse' },
                              { value: 'Son', label: 'Son' },
                              { value: 'Daughter', label: 'Daughter' },
                              { value: 'Father', label: 'Father' },
                              { value: 'Mother', label: 'Mother' },
                              { value: 'Brother', label: 'Brother' },
                              { value: 'Sister', label: 'Sister' },
                              { value: 'Dependent', label: 'Dependent' },
                              { value: 'Other', label: 'Other' },
                            ]}
                          />
                        </div>

                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Contact No.
                          </label>
                          <input
                            type="tel"
                            maxLength={10}
                            value={cleanConnectedPhone(person.contactNo)}
                            onChange={e => updateConnectedPerson(person.id, { contactNo: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                            className="input w-full h-9 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="10-digit Phone"
                          />
                        </div>

                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Date of Birth (DoB)
                          </label>
                          <DatePicker
                            value={person.dob}
                            onDateChange={val => updateConnectedPerson(person.id, { dob: val })}
                            className="input w-full h-9 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="DD/MM/YYYY"
                          />
                        </div>

                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Gender
                          </label>
                          <CustomSelect
                            value={person.gender}
                            onChange={val => updateConnectedPerson(person.id, { gender: val })}
                            placeholder="Select Gender"
                            options={[
                              { value: 'MALE', label: 'Male' },
                              { value: 'FEMALE', label: 'Female' },
                              { value: 'OTHER', label: 'Other' },
                            ]}
                          />
                        </div>
                      </div>

                      {/* Covered & Nominee Toggles */}
                      <div className="flex flex-wrap items-center gap-6 pt-1 border-t border-slate-100">
                        <label className="flex flex-wrap items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={person.isCovered}
                            onChange={e => updateConnectedPerson(person.id, { isCovered: e.target.checked })}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-xs font-bold text-slate-700">Covered under this policy</span>
                        </label>

                        <label className="flex flex-wrap items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={person.isNominee}
                            onChange={e => {
                              const isNom = e.target.checked;
                              updateConnectedPerson(person.id, {
                                isNominee: isNom,
                                ...(isNom ? {
                                  nomineeName: person.nomineeName || person.name,
                                  nomineeRelation: person.nomineeRelation || person.relationship,
                                  nomineeContact: cleanConnectedPhone(person.nomineeContact) || (
                                    (!person.nomineeName || person.nomineeName.trim().toLowerCase() === person.name.trim().toLowerCase())
                                      ? cleanConnectedPhone(person.contactNo)
                                      : ''
                                  ),
                                  nomineeDob: person.nomineeDob || person.dob,
                                  nomineePercentage: person.nomineePercentage && Number(person.nomineePercentage) > 0 ? person.nomineePercentage : '',
                                } : {})
                              });
                            }}
                            className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="text-xs font-bold text-slate-700">Set as Nominee</span>
                        </label>
                      </div>

                      {/* Dynamic Nominee Fields Box */}
                      {person.isNominee && (
                        <div className="p-3 bg-purple-50/40 rounded-xl border border-purple-100 space-y-2.5 animate-fadeIn">
                          <h6 className="text-[11px] font-extrabold text-purple-800 uppercase tracking-wider flex flex-wrap items-center gap-1.5">
                            Nominee Specification
                          </h6>
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                            <div>
                              <label className="label text-[10px] font-extrabold text-purple-700 uppercase tracking-wider block mb-1">Nominee Name</label>
                              <input
                                type="text"
                                value={person.nomineeName || person.name}
                                onChange={e => updateConnectedPerson(person.id, { nomineeName: e.target.value })}
                                className="input w-full h-9 text-xs rounded-xl bg-white border border-purple-200"
                                placeholder="Nominee Full Name"
                              />
                            </div>

                            <div>
                              <label className="label text-[10px] font-extrabold text-purple-700 uppercase tracking-wider block mb-1">Relationship</label>
                              <input
                                type="text"
                                value={person.nomineeRelation || person.relationship}
                                onChange={e => updateConnectedPerson(person.id, { nomineeRelation: e.target.value })}
                                className="input w-full h-9 text-xs rounded-xl bg-white border border-purple-200"
                                placeholder="e.g. Wife / Son"
                              />
                            </div>

                            <div>
                              <label className="label text-[10px] font-extrabold text-purple-700 uppercase tracking-wider block mb-1">Contact No.</label>
                              <input
                                type="tel"
                                maxLength={10}
                                value={cleanConnectedPhone(person.nomineeContact || ((!person.nomineeName || person.nomineeName.trim().toLowerCase() === person.name.trim().toLowerCase()) ? person.contactNo : ''))}
                                onChange={e => updateConnectedPerson(person.id, { nomineeContact: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                className="input w-full h-9 text-xs rounded-xl bg-white border border-purple-200"
                                placeholder="10-digit Phone"
                              />
                            </div>

                            <div>
                              <label className="label text-[10px] font-extrabold text-purple-700 uppercase tracking-wider block mb-1">Nominee DoB</label>
                              <DatePicker
                                value={person.nomineeDob || person.dob}
                                onDateChange={val => updateConnectedPerson(person.id, { nomineeDob: val })}
                                className="input w-full h-9 text-xs rounded-xl bg-white border border-purple-200"
                                placeholder="DD/MM/YYYY"
                              />
                            </div>

                            <div>
                              <label className="label text-[10px] font-extrabold text-purple-700 uppercase tracking-wider block mb-1">Nominee Share (%)</label>
                              <input
                                type="number"
                                min={1}
                                max={100}
                                value={person.nomineePercentage && person.nomineePercentage !== 0 ? person.nomineePercentage : ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  updateConnectedPerson(person.id, { nomineePercentage: val === '' ? '' : Number(val) });
                                }}
                                className="input w-full h-9 text-xs rounded-xl bg-white border border-purple-200 font-bold text-purple-900"
                                placeholder="100"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center gap-2 text-xs text-blue-800">
                <Info size={15} className="text-blue-600 shrink-0" />
                <span>Make sure all details are accurate before saving the policy.</span>
              </div>
            </div>
          )}

          {/* ════════ TAB 4: Health Check & Notes ════════ */}
          {activeTab === 'phcDetails' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 border border-slate-200/90 rounded-2xl bg-white shadow-2xs space-y-3.5">
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">4</span>
                  Preventive Health Checkup & Notes
                </h4>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={phcRequired}
                    onChange={(e) => {
                      setPhcRequired(e.target.checked);
                      if (!e.target.checked) setPhcAmountError('');
                    }}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-slate-700">Preventive Health Checkup Required</span>
                </label>

                {phcRequired && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="label text-[10px] font-bold text-slate-600">Insured Person Name for PHC</label>
                        <button
                          type="button"
                          onClick={() => setIsManualPhcPerson(prev => !prev)}
                          className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                        >
                          {isManualPhcPerson ? 'Select list' : '+ Other'}
                        </button>
                      </div>
                      {isManualPhcPerson ? (
                        <input
                          type="text"
                          className="input text-xs w-full mt-0.5"
                          placeholder={insuredPerson ? `e.g. ${insuredPerson}` : 'e.g. Ramesh Kumar'}
                          value={phcInsuredPerson}
                          onChange={(e) => setPhcInsuredPerson(e.target.value)}
                        />
                      ) : (
                        <CustomSelect
                          value={phcInsuredPerson}
                          onChange={(val) => setPhcInsuredPerson(val)}
                          placeholder="Select Insured Person..."
                          options={phcInsuredPersonOptions.length > 0 ? phcInsuredPersonOptions : [{ value: '', label: 'No persons added yet' }]}
                          searchable
                        />
                      )}
                    </div>
                    <div>
                      <label className="label text-[10px] font-bold text-slate-600 mb-0.5 block">PHC Stage</label>
                      <CustomSelect
                        value={phcStage || 'TO_CONTACT'}
                        onChange={val => setPhcStage(val)}
                        placeholder="Select PHC Stage"
                        options={PHC_STAGE_OPTIONS}
                      />
                    </div>
                    <div>
                      <label className="label text-[10px] font-bold text-slate-500">PHC Amount (₹)</label>
                      {phcRequired && <span className="text-red-600 ml-1">*</span>}
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        aria-invalid={!!phcAmountError}
                        aria-describedby={phcAmountError ? 'phc-amount-error' : undefined}
                        className={`input text-xs w-full mt-0.5 ${phcAmountError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                        placeholder="e.g. 2500"
                        value={phcAmount}
                        onChange={(e) => {
                          setPhcAmount(e.target.value);
                          if (e.target.value.trim()) setPhcAmountError('');
                        }}
                      />
                      {phcAmountError && (
                        <p id="phc-amount-error" className="mt-1 text-[10px] font-semibold text-red-600">
                          {phcAmountError}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="label text-[10px] font-bold text-slate-500 mb-0.5 block">Status</label>
                      <CustomSelect
                        value={phcStatus}
                        onChange={val => setPhcStatus(val)}
                        placeholder="Select Status"
                        options={[
                          { value: 'PENDING', label: 'Pending' },
                          { value: 'COMPLETED', label: 'Completed' },
                          { value: 'CLAIMED', label: 'Claimed' },
                        ]}
                      />
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={phcClaimSettled}
                          onChange={(e) => setPhcClaimSettled(e.target.checked)}
                          className="rounded text-blue-600"
                        />
                        <span className="text-xs font-bold text-slate-700">Claim Settled</span>
                      </label>
                    </div>
                  </div>
                )}

                <div>
                  <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">Policy Notes / Remarks</label>
                  <textarea
                    className="input text-xs w-full mt-1 min-h-[80px]"
                    placeholder="Enter additional policy details or terms..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ════════ TAB 5: Policy Documents ════════ */}
          {activeTab === 'policyDocs' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 border border-slate-200/90 rounded-2xl bg-white shadow-2xs space-y-3.5">
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">5</span>
                  Policy Documents & Attachments
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label text-[10px] font-bold text-slate-500 mb-1 block">Document Type</label>
                    <CustomSelect
                      value={docTag}
                      onChange={val => {
                        setDocTag(val);
                        const label = POLICY_DOCUMENT_TYPE_OPTIONS.find(o => o.value === val)?.label;
                        if (label) setDocTitle(label);
                      }}
                      placeholder="Select Document Type"
                      options={POLICY_DOCUMENT_TYPE_OPTIONS}
                    />
                  </div>
                  <div>
                    <label className="label text-[10px] font-bold text-slate-500">Document Title</label>
                    <input
                      type="text"
                      className="input text-xs w-full mt-1"
                      placeholder="e.g. Policy Schedule PDF"
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label text-[10px] font-bold text-slate-500">Select File</label>
                    <input
                      type="file"
                      className="input text-xs w-full mt-1 p-1 bg-white"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAddDoc(file);
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  {pendingDocs.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-xs text-slate-400">
                      No documents attached yet. Click "Choose File" above to attach documents.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                            <th className="px-3 py-2.5">Uploaded Date</th>
                            <th className="px-3 py-2.5">Document Name</th>
                            <th className="px-3 py-2.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {pendingDocs.map((doc, i) => {
                            const typeLabel = POLICY_DOCUMENT_TYPE_OPTIONS.find(o => o.value === doc.tag)?.label || doc.tag;
                            const extension = (doc.file.name.split('.').pop()?.toUpperCase() || 'FILE').slice(0, 4);
                            const fileSize = formatBytes(doc.file.size);
                            const contactPhone = contactsList.find((c: any) => c.id === selectedContactId)?.phone || '';

                            return (
                              <tr key={`${doc.file.name}-${i}`} className="transition-colors hover:bg-slate-50/80">
                                <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-600">
                                  <span className="inline-flex items-center gap-1.5">
                                    <CalendarDays size={13} className="text-slate-400" />
                                    {format(new Date(), 'dd MMM yyyy')}
                                  </span>
                                </td>
                                <td className="min-w-[220px] px-3 py-2.5">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 px-1 font-mono text-[9px] font-bold text-blue-600">
                                      {extension}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="truncate font-extrabold text-slate-800" title={doc.file.name}>{doc.file.name}</p>
                                      <div className="mt-0.5 flex items-center gap-1.5">
                                        <span className="truncate font-semibold text-slate-600" title={doc.title}>{doc.title}</span>
                                        <span className="rounded border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-indigo-700">
                                          {typeLabel}
                                        </span>
                                        {fileSize && (
                                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                                            {fileSize}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <FileText size={14} className="ml-auto hidden shrink-0 text-slate-300 sm:block" />
                                  </div>
                                </td>
                                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const waText = `Document: ${doc.title || doc.file.name}`;
                                        const waUrl = contactPhone
                                          ? `https://api.whatsapp.com/send?phone=91${contactPhone.slice(-10)}&text=${encodeURIComponent(waText)}`
                                          : `https://api.whatsapp.com/send?text=${encodeURIComponent(waText)}`;
                                        window.open(waUrl, '_blank', 'noopener,noreferrer');
                                      }}
                                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
                                      title="Share document"
                                    >
                                      <MessageCircle size={13} />
                                      <span className="hidden sm:inline">WhatsApp</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const url = URL.createObjectURL(doc.file);
                                        window.open(url, '_blank', 'noopener,noreferrer');
                                        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
                                      }}
                                      className="rounded-lg border border-blue-100 bg-blue-50 p-1.5 text-blue-600 transition-colors hover:bg-blue-100"
                                      title="View document"
                                      aria-label={`View ${doc.file.name}`}
                                    >
                                      <Eye size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const url = URL.createObjectURL(doc.file);
                                        const link = document.createElement('a');
                                        link.href = url;
                                        link.download = doc.file.name;
                                        document.body.appendChild(link);
                                        link.click();
                                        link.remove();
                                        window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
                                      }}
                                      className="rounded-lg border border-slate-200 bg-slate-100 p-1.5 text-slate-700 transition-colors hover:bg-slate-200"
                                      title="Download document"
                                      aria-label={`Download ${doc.file.name}`}
                                    >
                                      <Download size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveDoc(i)}
                                      className="rounded-lg border border-rose-100 bg-rose-50 p-1.5 text-rose-600 transition-colors hover:bg-rose-100"
                                      title="Delete document"
                                      aria-label={`Delete ${doc.file.name}`}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        
          {activeTab === 'history' && (
            <ActivityTimeline
              events={[policyHistoryRes, (policyToEdit as any)?.contact?.activityLogs]}
              fallbackEvents={[
                ...(policyToEdit?.createdAt ? [{
                  id: `policy-created-${policyToEdit.id}`,
                  entityType: 'Policy',
                  entityId: policyToEdit.id,
                  action: 'CREATE',
                  description: `Policy ${policyToEdit.policyNumber} created`,
                  createdAt: policyToEdit.createdAt,
                }] : []),
                ...(policyToEdit?.updatedAt && policyToEdit.updatedAt !== policyToEdit.createdAt ? [{
                  id: `policy-updated-${policyToEdit.id}`,
                  entityType: 'Policy',
                  entityId: policyToEdit.id,
                  action: 'UPDATE',
                  description: 'Policy updated',
                  createdAt: policyToEdit.updatedAt,
                }] : []),
              ]}
              entityType="Policy"
              entityId={policyToEdit?.id}
              isLoading={policyHistoryLoading}
              isError={policyHistoryError}
              subtitle="Latest activity for this policy."
            />
          )}
          </fieldset>
      </div>
    </form>
    </Modal>
  );
}

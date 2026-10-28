import React, { useState, useEffect, useRef } from 'react';
import Modal from '@comps/common/Modal';
import { DatePicker } from '@comps/common/DatePicker';
import { CountryPhoneInput } from '@comps/common/CountryPhoneInput';
import { DatalistInput } from '@comps/common/DatalistInput';
import toast from 'react-hot-toast';
import {
  Users, ChevronDown, Check, Copy, User, Phone, MapPin,
  Briefcase, HeartPulse, Building2, Shield, Calendar, Sparkles
} from 'lucide-react';
import INDIA_STATE_DISTRICTS from '@/constants/india-state-districts.json';
import { getActiveDropdownOptions, getModuleCustomDropdowns } from '@/utils/masterDropdowns';

const DEFAULT_EDUCATION_OPTIONS = [
  'Metric',
  'Intermediate',
  'Graduate',
  'Post Graduate',
  'Up to 9th class passed',
  '10th class passed',
  'Post Graduate (Gen)',
  'Med Graduate',
  'Post Graduate, Eng',
  'Law Graduate / Post Graduate',
  'CA/ICWA/MBA/CFA',
  'Computer degree other',
  'Other',
];

const DEFAULT_OCCUPATION_TYPE_OPTIONS = [
  'Salaried Private',
  'Salaried Gov',
  'Salaried/Service',
  'Business Owner',
  'Business',
  'Industrialist',
  'Self Employed Professional',
  'Agriculture',
  'Student',
  'Retired',
  'Homemaker',
  'Other',
];

const EDUCATION_OPTIONS = getActiveDropdownOptions('Contact', 'Education', DEFAULT_EDUCATION_OPTIONS).map(o => o.value);
const OCCUPATION_TYPE_OPTIONS = getActiveDropdownOptions('Contact', 'Occupation', DEFAULT_OCCUPATION_TYPE_OPTIONS).map(o => o.value);

const INDIAN_STATES_AND_UTS = INDIA_STATE_DISTRICTS
  .map(({ state }) => state)
  .sort((a, b) => a.localeCompare(b));

const INDIAN_DISTRICTS_BY_STATE = Object.fromEntries(
  INDIA_STATE_DISTRICTS.map(({ state, districts }) => [
    state,
    [...districts].sort((a, b) => a.localeCompare(b)),
  ]),
);

const MEDICAL_CONDITIONS_LIST = [
  'Diabetes Mellitus',
  'High BP / Cholesterol',
  'Heart Disease',
  'Tuberculosis',
  'Asthma',
  'Other Respiratory Infection',
  'Disease of bones/joints',
  'Slip disc',
  'Spinal Disorder',
  'Ligament Injury',
  'Cancer',
  'Gynecological disorder (DUB, Fibroid Uterus, Ovarian cyst)',
  'Undergone Cesarean / Hysterectomy',
  'Disease of Stomach / Intestine',
  'Liver / Gall Bladder / Pancreas',
  'Kidney / Urinary Bladder / Urinary Tract Disease',
  'Disease of Prostate / Fistula / Piles / Genital Disease',
  'Cataract or Other Disease of Eye and ENT',
  'Thyroid',
  'Others'
];

const RELATION_OPTIONS = [
  { value: 'SPOUSE', label: 'Spouse' },
  { value: 'HUSBAND', label: 'Husband' },
  { value: 'WIFE', label: 'Wife' },
  { value: 'SON', label: 'Son' },
  { value: 'DAUGHTER', label: 'Daughter' },
  { value: 'FATHER', label: 'Father' },
  { value: 'MOTHER', label: 'Mother' },
  { value: 'BROTHER', label: 'Brother' },
  { value: 'SISTER', label: 'Sister' },
  { value: 'UNCLE', label: 'Uncle' },
  { value: 'AUNT', label: 'Aunt / Unty' },
  { value: 'NEPHEW', label: 'Nephew' },
  { value: 'NIECE', label: 'Niece' },
  { value: 'CHILD', label: 'Child' },
  { value: 'GRANDFATHER', label: 'Grandfather' },
  { value: 'GRANDMOTHER', label: 'Grandmother' },
  { value: 'GRANDSON', label: 'Grandson' },
  { value: 'GRANDDAUGHTER', label: 'Granddaughter' },
  { value: 'GRANDPARENT', label: 'Grandparent' },
  { value: 'GRANDCHILD', label: 'Grandchild' },
  { value: 'IN_LAW', label: 'In-Law' },
  { value: 'OTHER', label: 'Other' },
];

function MultiSelectBox({
  label,
  selectedValues,
  onChange,
  badgeColor = 'blue',
  placeholder = 'Select Conditions...'
}: {
  label: string;
  selectedValues: string[];
  onChange: (vals: string[]) => void;
  badgeColor?: 'blue' | 'orange';
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = MEDICAL_CONDITIONS_LIST.filter(opt =>
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative">
      <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">{label}</label>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="input min-h-[40px] w-full cursor-pointer flex items-center justify-between gap-2 flex-wrap py-1.5 px-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all"
      >
        {selectedValues.length === 0 ? (
          <span className="text-slate-400 text-xs font-normal">{placeholder}</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {selectedValues.map((val, idx) => (
              <span
                key={idx}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                  badgeColor === 'orange'
                    ? 'bg-orange-50 text-orange-700 border-orange-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}
              >
                {val}
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(selectedValues.filter(v => v !== val));
                  }}
                  className="hover:text-red-600 font-bold cursor-pointer ml-0.5"
                >
                  ×
                </span>
              </span>
            ))}
          </div>
        )}
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 max-h-56 overflow-y-auto">
            <input
              type="text"
              placeholder="Search condition..."
              className="input w-full text-xs mb-2 px-2.5 py-1.5"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
            <div className="space-y-1">
              {filteredOptions.map(opt => {
                const isSelected = selectedValues.includes(opt);
                return (
                  <div
                    key={opt}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isSelected) {
                        onChange(selectedValues.filter(v => v !== opt));
                      } else {
                        onChange([...selectedValues, opt]);
                      }
                    }}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="rounded border-slate-300 text-blue-600 pointer-events-none"
                    />
                    <span>{opt}</span>
                  </div>
                );
              })}
              {filteredOptions.length === 0 && (
                <div className="text-center py-2 text-xs text-slate-400">No conditions match search</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const calculateAge = (dob: string): number => {
  if (!dob) return 0;
  try {
    let birthDate = new Date(dob);
    if (isNaN(birthDate.getTime()) && dob.includes('/')) {
      const parts = dob.split('/');
      if (parts.length === 3) {
        birthDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      }
    }
    if (isNaN(birthDate.getTime())) return 0;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age > 0 ? age : 0;
  } catch {
    return 0;
  }
};

export interface FamilyMemberModalProps {
  open: boolean;
  onClose: () => void;
  initialData?: Record<string, any> | null;
  isEditing: boolean;
  primaryContact: {
    gender?: string;
    phone?: string;
    whatsappNumber?: string;
    state?: string;
    district?: string;
    city?: string;
    pincode?: string;
    streetAddress?: string;
    fullName?: string;
  };
  employeesList: any[];
  onSave: (member: Record<string, any>) => void;
}

const buildInitialFormData = (initialData: any, primaryContact: any) => {
  if (initialData) {
    const rawDob = initialData.dob || initialData.dateOfBirth || '';
    const computedAge = rawDob ? String(calculateAge(rawDob)) : (initialData.age || '');
    return {
      ...initialData,
      relation: initialData.relation || '',
      firstName: initialData.firstName || (initialData.name ? initialData.name.split(' ')[0] : ''),
      middleName: initialData.middleName || '',
      lastName: initialData.lastName || (initialData.name ? initialData.name.split(' ').slice(1).join(' ') : ''),
      gender: initialData.gender || '',
      isDependent: !!(initialData.isDependent ?? false),
      guardianWhatsapp: initialData.guardianWhatsapp || initialData.dependentNo || '',
      dependentNo: initialData.dependentNo || initialData.guardianWhatsapp || '',
      motherName: initialData.motherName || '',
      maritalStatus: initialData.maritalStatus || '',
      weddingAnniversary: initialData.weddingAnniversary || initialData.weddingAnniversaryDate || '',
      weddingAnniversaryDate: initialData.weddingAnniversaryDate || initialData.weddingAnniversary || '',
      dob: rawDob,
      dateOfBirth: rawDob,
      age: computedAge,
      height: initialData.height || '',
      weight: initialData.weight || '',
      pan: initialData.pan || initialData.panNumber || '',
      panNumber: initialData.panNumber || initialData.pan || '',
      role: initialData.role || 'Contact',
      birthPlace: initialData.birthPlace || '',
      assignedEmployeeId: initialData.assignedEmployeeId || '',
      email: initialData.email || '',
      aadhaarNumber: initialData.aadhaarNumber || '',
      whatsapp: initialData.whatsapp || initialData.whatsappNumber || initialData.phone || initialData.contactNo || '',
      whatsappNumber: initialData.whatsappNumber || initialData.whatsapp || initialData.phone || initialData.contactNo || '',
      sameAsWhatsapp: !!initialData.sameAsWhatsapp,
      callingNumber: initialData.callingNumber || initialData.alternatePhone || '',
      contactStatus: initialData.contactStatus || 'Active',
      education: initialData.education || '',
      annualIncome: initialData.annualIncome || '',
      occupationType: initialData.occupationType || initialData.occupation || '',
      occupation: initialData.occupation || initialData.occupationType || '',
      companyName: initialData.companyName || '',
      state: initialData.state || '',
      district: initialData.district || '',
      city: initialData.city || '',
      pincode: initialData.pincode || '',
      streetAddress: initialData.streetAddress || '',
      bankName: initialData.bankName || '',
      bankAccountNumber: initialData.bankAccountNumber || '',
      bankIfsc: initialData.bankIfsc || '',
      bankBranch: initialData.bankBranch || '',
      chewTobacco: !!initialData.chewTobacco,
      smoke: !!initialData.smoke,
      consumeAlcohol: !!initialData.consumeAlcohol,
      medicalHistory: initialData.medicalHistory || [],
      declaredMedicalHistory: initialData.declaredMedicalHistory || [],
      notDeclaredMedicalHistory: initialData.notDeclaredMedicalHistory || [],
      medicalHistoryDetails: initialData.medicalHistoryDetails || '',
      surgeryDetails: initialData.surgeryDetails || '',
      prescriptionDetails: initialData.prescriptionDetails || '',
    };
  }

  return {
    relation: '',
    firstName: '',
    middleName: '',
    lastName: '',
    gender: '',
    isDependent: false,
    guardianWhatsapp: '',
    dependentNo: '',
    motherName: '',
    maritalStatus: '',
    weddingAnniversary: '',
    weddingAnniversaryDate: '',
    dob: '',
    dateOfBirth: '',
    age: '',
    height: '',
    weight: '',
    pan: '',
    panNumber: '',
    role: 'Contact',
    birthPlace: '',
    assignedEmployeeId: '',
    email: '',
    aadhaarNumber: '',
    whatsapp: '',
    whatsappNumber: '',
    sameAsWhatsapp: false,
    callingNumber: '',
    contactStatus: 'Active',
    education: '',
    annualIncome: '',
    occupationType: '',
    occupation: '',
    companyName: '',
    state: primaryContact?.state || '',
    district: primaryContact?.district || '',
    city: primaryContact?.city || '',
    pincode: primaryContact?.pincode || '',
    streetAddress: primaryContact?.streetAddress || '',
    bankName: '',
    bankAccountNumber: '',
    bankIfsc: '',
    bankBranch: '',
    chewTobacco: false,
    smoke: false,
    consumeAlcohol: false,
    medicalHistory: [],
    declaredMedicalHistory: [],
    notDeclaredMedicalHistory: [],
    medicalHistoryDetails: '',
    surgeryDetails: '',
    prescriptionDetails: '',
  };
};

export default function FamilyMemberModal({
  open,
  onClose,
  initialData,
  isEditing,
  primaryContact,
  employeesList,
  onSave,
}: FamilyMemberModalProps) {
  const firstNameInputRef = useRef<HTMLInputElement | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>(() => buildInitialFormData(initialData, primaryContact));
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleCollapse = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const prevOpenRef = useRef(open);

  // Synchronously sync state during render when modal opens so inputs are instantly clickable and populated
  if (open !== prevOpenRef.current) {
    prevOpenRef.current = open;
    if (open) {
      setFormData(buildInitialFormData(initialData, primaryContact));
      setCollapsed({});
    }
  }

  useEffect(() => {
    if (open && isEditing && initialData) {
      setFormData(buildInitialFormData(initialData, primaryContact));
    }
  }, [open, initialData, isEditing, primaryContact]);

  const handleRelationChange = (val: string) => {
    const relUpper = val.toUpperCase();
    let inferredGender = formData.gender;
    if (!formData.gender) {
      if (['HUSBAND', 'SON', 'FATHER', 'BROTHER', 'GRANDFATHER', 'GRANDSON', 'UNCLE', 'NEPHEW'].includes(relUpper)) {
        inferredGender = 'MALE';
      } else if (['WIFE', 'DAUGHTER', 'MOTHER', 'SISTER', 'GRANDMOTHER', 'GRANDDAUGHTER', 'AUNT', 'NIECE'].includes(relUpper)) {
        inferredGender = 'FEMALE';
      } else if (relUpper === 'SPOUSE') {
        const primGender = (primaryContact.gender || '').toUpperCase();
        if (primGender === 'MALE') inferredGender = 'FEMALE';
        else if (primGender === 'FEMALE') inferredGender = 'MALE';
      }
    }

    const isChild = ['SON', 'DAUGHTER', 'CHILD'].includes(relUpper);

    setFormData(prev => ({
      ...prev,
      relation: val,
      gender: inferredGender || prev.gender,
      isDependent: prev.isDependent || isChild,
      guardianWhatsapp: isChild && !prev.guardianWhatsapp ? (primaryContact.whatsappNumber || primaryContact.phone || '') : prev.guardianWhatsapp,
    }));
  };

  const handleDOBChange = (val: string) => {
    const age = calculateAge(val);
    setFormData(prev => ({
      ...prev,
      dob: val,
      dateOfBirth: val,
      age: age > 0 ? String(age) : ''
    }));
  };

  const copyPrimaryAddress = () => {
    setFormData(prev => ({
      ...prev,
      state: primaryContact.state || prev.state || '',
      district: primaryContact.district || prev.district || '',
      city: primaryContact.city || prev.city || '',
      pincode: primaryContact.pincode || prev.pincode || '',
      streetAddress: primaryContact.streetAddress || prev.streetAddress || '',
    }));
    toast.success('Copied address from Primary Contact');
  };

  const handleSave = () => {
    if (!formData.relation || !formData.relation.trim()) {
      toast.error('Please select a relationship with primary contact.');
      return;
    }
    if (!formData.firstName || !formData.firstName.trim()) {
      toast.error('First Name is required.');
      return;
    }
    if (!formData.lastName || !formData.lastName.trim()) {
      toast.error('Last Name is required.');
      return;
    }

    const fullName = [formData.firstName, formData.middleName, formData.lastName].filter(Boolean).join(' ').trim();
    const finalData = {
      ...formData,
      name: fullName,
      fullName,
      whatsapp: formData.whatsappNumber || formData.whatsapp || formData.phone || formData.contactNo || formData.guardianWhatsapp || formData.dependentNo || '',
      whatsappNumber: formData.whatsappNumber || formData.whatsapp || formData.phone || formData.contactNo || formData.guardianWhatsapp || formData.dependentNo || '',
      phone: formData.whatsappNumber || formData.whatsapp || formData.phone || formData.contactNo || formData.guardianWhatsapp || formData.dependentNo || '',
      contactNo: formData.whatsappNumber || formData.whatsapp || formData.phone || formData.contactNo || formData.guardianWhatsapp || formData.dependentNo || '',
      callingNumber: formData.sameAsWhatsapp ? (formData.whatsappNumber || formData.whatsapp || formData.phone || formData.contactNo || formData.guardianWhatsapp || formData.dependentNo || '') : (formData.callingNumber || formData.alternatePhone || ''),
      alternatePhone: formData.sameAsWhatsapp ? (formData.whatsappNumber || formData.whatsapp || formData.phone || formData.contactNo || formData.guardianWhatsapp || formData.dependentNo || '') : (formData.callingNumber || formData.alternatePhone || ''),
      pan: (formData.pan || formData.panNumber || '').toUpperCase(),
      panNumber: (formData.panNumber || formData.pan || '').toUpperCase(),
      dob: formData.dob || formData.dateOfBirth || '',
      dateOfBirth: formData.dateOfBirth || formData.dob || '',
      weddingAnniversary: formData.weddingAnniversary || formData.weddingAnniversaryDate || '',
      weddingAnniversaryDate: formData.weddingAnniversaryDate || formData.weddingAnniversary || '',
      occupation: formData.occupationType || formData.occupation || '',
      occupationType: formData.occupationType || formData.occupation || '',
      dependentNo: formData.guardianWhatsapp || formData.dependentNo || '',
    };

    onSave(finalData);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      initialFocus={firstNameInputRef}
      closeOnEscapeAndBackdrop={false}
      zIndexClass="z-[70]"
      title={isEditing ? 'Edit Family Member Details' : 'Add Family Member Details'}
      subtitle="Complete relationship, personal demographics, contact info, address, occupation, and health history."
      size="2xl"
      icon={<Users className="text-blue-600" size={20} />}
      actions={
        <div className="flex flex-wrap items-center gap-2.5 mr-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/25 rounded-xl transition-all cursor-pointer"
          >
            {isEditing ? 'Update Family Member' : 'Save Family Member'}
          </button>
        </div>
      }
    >
      <div className="space-y-4 max-h-[72vh] overflow-y-auto pr-1 custom-scrollbar pb-3">

        {/* Step 0: Relation Selection Card (Always at the top) */}
        <div className="border-2 border-blue-200 rounded-2xl bg-gradient-to-br from-blue-50/70 via-indigo-50/30 to-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center shadow-xs">
                ★
              </span>
              Select Relationship with Primary Contact <span className="text-red-500">*</span>
            </label>
            {formData.relation && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-600 text-white uppercase tracking-wider">
                {formData.relation}
              </span>
            )}
          </div>

          <div className="w-full">
            <select
              className="input w-full font-bold text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all bg-white py-2 px-3 border border-slate-200 shadow-xs"
              value={formData.relation || ''}
              onChange={e => handleRelationChange(e.target.value)}
            >
              <option value="">-- Choose Relation --</option>
              {RELATION_OPTIONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {!formData.relation ? (
            <p className="text-[11px] text-amber-600 font-semibold mt-2.5 flex items-center gap-1.5 bg-amber-50/80 px-3 py-1.5 rounded-xl border border-amber-200">
              <Sparkles size={14} className="text-amber-500 shrink-0" />
              Select a relationship above and enter the family member details below.
            </p>
          ) : (
            <p className="text-[11px] text-blue-700 font-medium mt-2.5 flex items-center gap-1.5 bg-blue-50/80 px-3 py-1 rounded-xl">
              <Check size={14} className="text-blue-600 shrink-0" />
              Relationship selected: <span className="font-extrabold">{formData.relation}</span>. Complete the form sections below matching client standards.
            </p>
          )}
        </div>

        {/* Form sections always available for immediate entry */}
        <div className="space-y-4">
          {/* 1. Personal Details */}
            <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                onClick={() => toggleCollapse('personalDetails')}
              >
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">1</span>
                  Personal Details
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-semibold">Basic Demographics</span>
                  <ChevronDown
                    size={16}
                    className={`text-slate-500 transition-transform duration-200 ${collapsed['personalDetails'] ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>
              {!collapsed['personalDetails'] && (
                <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label htmlFor="fam-firstName" className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1 cursor-pointer">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      ref={firstNameInputRef}
                      id="fam-firstName"
                      type="text"
                      className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                      placeholder="e.g. Priya"
                      value={formData.firstName || ''}
                      onChange={e => setFormData(p => ({ ...p, firstName: e.target.value }))}
                      onMouseDown={e => e.currentTarget.focus()}
                    />
                  </div>
                  <div>
                    <label htmlFor="fam-middleName" className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1 cursor-pointer">
                      Middle Name
                    </label>
                    <input
                      id="fam-middleName"
                      type="text"
                      className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                      placeholder="e.g. Kumar"
                      value={formData.middleName || ''}
                      onChange={e => setFormData(p => ({ ...p, middleName: e.target.value }))}
                      onMouseDown={e => e.currentTarget.focus()}
                    />
                  </div>
                  <div>
                    <label htmlFor="fam-lastName" className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1 cursor-pointer">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="fam-lastName"
                      type="text"
                      className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                      placeholder="e.g. Sharma"
                      value={formData.lastName || ''}
                      onChange={e => setFormData(p => ({ ...p, lastName: e.target.value }))}
                      onMouseDown={e => e.currentTarget.focus()}
                    />
                  </div>
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      Is Dependent?
                    </label>
                    <select
                      className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all font-semibold"
                      value={formData.isDependent ? 'YES' : 'NO'}
                      onChange={e => setFormData(p => ({ ...p, isDependent: e.target.value === 'YES' }))}
                    >
                      <option value="NO">No</option>
                      <option value="YES">Yes</option>
                    </select>
                  </div>
                  {formData.isDependent && (
                    <div className="animate-fadeIn">
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                        Guardian WhatsApp Number
                      </label>
                      <CountryPhoneInput
                        value={formData.guardianWhatsapp || ''}
                        onChange={(value: string) => setFormData(p => ({
                          ...p,
                          guardianWhatsapp: value,
                          dependentNo: value,
                        }))}
                      />
                    </div>
                  )}
                  <div>
                    <label htmlFor="fam-motherName" className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1 cursor-pointer">
                      Mother's Name
                    </label>
                    <input
                      id="fam-motherName"
                      type="text"
                      className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                      placeholder="e.g. Sunita Sharma"
                      value={formData.motherName || ''}
                      onChange={e => setFormData(p => ({ ...p, motherName: e.target.value }))}
                      onMouseDown={e => e.currentTarget.focus()}
                    />
                  </div>
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      Gender
                    </label>
                    <select
                      className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                      value={formData.gender || ''}
                      onChange={e => setFormData(p => ({ ...p, gender: e.target.value }))}
                    >
                      <option value="">Select Gender</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      Marital Status
                    </label>
                    <select
                      className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                      value={formData.maritalStatus || ''}
                      onChange={e => setFormData(p => ({ ...p, maritalStatus: e.target.value }))}
                    >
                      <option value="">Select Status</option>
                      <option value="SINGLE">Single</option>
                      <option value="MARRIED">Married</option>
                      <option value="DIVORCED">Divorced</option>
                      <option value="WIDOWED">Widowed</option>
                    </select>
                  </div>
                  {formData.maritalStatus === 'MARRIED' && (
                    <div className="animate-fadeIn">
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                        Wedding Anniversary Date
                      </label>
                      <DatePicker
                        className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                        value={formData.weddingAnniversary || formData.weddingAnniversaryDate || ''}
                        onDateChange={(val) => setFormData(p => ({ ...p, weddingAnniversary: val, weddingAnniversaryDate: val }))}
                      />
                    </div>
                  )}
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      Date of Birth
                    </label>
                    <DatePicker
                      className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                      value={formData.dob || formData.dateOfBirth || ''}
                      onDateChange={handleDOBChange}
                    />
                  </div>
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      Age
                    </label>
                    <input
                      type="text"
                      className="input w-full bg-slate-50 font-semibold text-slate-600 cursor-not-allowed rounded-xl"
                      value={formData.age || ''}
                      disabled
                      placeholder="Auto-calculated"
                    />
                  </div>
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      Height (cm)
                    </label>
                    <input
                      type="number"
                      className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                      placeholder="e.g. 165"
                      value={formData.height || ''}
                      onChange={(e) => setFormData((p) => ({ ...p, height: e.target.value }))}
                      onMouseDown={e => e.currentTarget.focus()}
                    />
                  </div>
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      Weight (kg)
                    </label>
                    <input
                      type="number"
                      className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                      placeholder="e.g. 60"
                      value={formData.weight || ''}
                      onChange={(e) => setFormData((p) => ({ ...p, weight: e.target.value }))}
                      onMouseDown={e => e.currentTarget.focus()}
                    />
                  </div>
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      PAN Number
                    </label>
                    <input
                      type="text"
                      placeholder="ABCDE1234F"
                      className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all uppercase"
                      value={formData.pan || formData.panNumber || ''}
                      onChange={(e) => setFormData(p => ({ ...p, pan: e.target.value.toUpperCase(), panNumber: e.target.value.toUpperCase() }))}
                      onMouseDown={e => e.currentTarget.focus()}
                    />
                  </div>
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      Role
                    </label>
                    <select
                      className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all font-semibold"
                      value={formData.role || 'Contact'}
                      onChange={e => setFormData(p => ({ ...p, role: e.target.value }))}
                    >
                      <option value="Contact">Contact</option>
                      <option value="Employee">Employee</option>
                      <option value="ADMIN/OWNER">ADMIN/OWNER</option>
                      <option value="Business Associate">Business Associate</option>
                    </select>
                  </div>
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      Birth Place
                    </label>
                    <input
                      type="text"
                      className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                      placeholder="e.g. Pune, Maharashtra"
                      value={formData.birthPlace || ''}
                      onChange={e => setFormData(p => ({ ...p, birthPlace: e.target.value }))}
                      onMouseDown={e => e.currentTarget.focus()}
                    />
                  </div>
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      Assigned Employee
                    </label>
                    <select
                      className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all font-semibold bg-white"
                      value={formData.assignedEmployeeId || ''}
                      onChange={e => setFormData(p => ({ ...p, assignedEmployeeId: e.target.value }))}
                    >
                      <option value="">Unassigned</option>
                      {employeesList.map((emp: any) => {
                        const empUserId = emp.userId || emp.user?.id || emp.id;
                        const empName = `${emp.firstName || emp.user?.firstName || ''} ${emp.lastName || emp.user?.lastName || ''}`.trim() || emp.name || emp.email || 'Employee';
                        return (
                          <option key={emp.id || empUserId} value={empUserId}>
                            {empName}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Contact Details */}
            <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                onClick={() => toggleCollapse('contactDetails')}
              >
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">2</span>
                  Contact Details
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-semibold">Communication Info</span>
                  <ChevronDown
                    size={16}
                    className={`text-slate-500 transition-transform duration-200 ${collapsed['contactDetails'] ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>
              {!collapsed['contactDetails'] && (
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                      placeholder="familymember@example.com"
                      value={formData.email || ''}
                      onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                      onMouseDown={e => e.currentTarget.focus()}
                    />
                  </div>
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      Aadhaar Number
                    </label>
                    <input
                      type="text"
                      className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                      placeholder="12-digit Aadhaar No"
                      maxLength={12}
                      value={formData.aadhaarNumber || ''}
                      onChange={e => setFormData(p => ({ ...p, aadhaarNumber: e.target.value.replace(/\D/g, '') }))}
                      onMouseDown={e => e.currentTarget.focus()}
                    />
                  </div>
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      Whatsapp Number
                    </label>
                    <CountryPhoneInput
                      value={formData.whatsappNumber || formData.whatsapp || ''}
                      onChange={(value: string) =>
                        setFormData((p) => ({
                          ...p,
                          whatsappNumber: value,
                          whatsapp: value,
                          callingNumber: p.sameAsWhatsapp ? value : p.callingNumber,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                        Calling Number
                      </label>
                      <label className="flex items-center gap-1 text-[10px] text-blue-600 font-semibold cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="accent-blue-600 w-3 h-3 rounded"
                          checked={!!formData.sameAsWhatsapp}
                          onChange={e => {
                            const checked = e.target.checked;
                            setFormData(p => ({
                              ...p,
                              sameAsWhatsapp: checked,
                              callingNumber: checked ? (p.whatsappNumber || p.whatsapp || '') : p.callingNumber
                            }));
                          }}
                        />
                        Same as Whatsapp
                      </label>
                    </div>
                    <CountryPhoneInput
                      disabled={formData.sameAsWhatsapp}
                      value={formData.callingNumber || ''}
                      onChange={(value: string) =>
                        setFormData((p) => ({
                          ...p,
                          callingNumber: value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      Contact Status
                    </label>
                    <select
                      className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all font-semibold"
                      value={formData.contactStatus || 'Active'}
                      onChange={e => setFormData(p => ({ ...p, contactStatus: e.target.value }))}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Education & Occupation */}
            <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-visible">
              <div
                className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                onClick={() => toggleCollapse('educationOccupation')}
              >
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">3</span>
                  Education &amp; Occupation
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-semibold">Professional Profile</span>
                  <ChevronDown
                    size={16}
                    className={`text-slate-500 transition-transform duration-200 ${collapsed['educationOccupation'] ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>
              {!collapsed['educationOccupation'] && (
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      Education
                    </label>
                    <DatalistInput
                      className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                      placeholder="Select or enter Education"
                      value={formData.education || ''}
                      options={EDUCATION_OPTIONS}
                      onChange={val => setFormData(p => ({ ...p, education: val }))}
                    />
                  </div>
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      Annual Income
                    </label>
                    <select
                      className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                      value={formData.annualIncome || ''}
                      onChange={e => setFormData(p => ({ ...p, annualIncome: e.target.value }))}
                    >
                      <option value="">Select Income Bracket</option>
                      <option value="200000">Below 2 Lakhs</option>
                      <option value="500000">2 - 5 Lakhs</option>
                      <option value="1000000">5 - 10 Lakhs</option>
                      <option value="2000000">10 - 20 Lakhs</option>
                      <option value="5000000">20+ Lakhs</option>
                    </select>
                  </div>
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      Occupation Type
                    </label>
                    <DatalistInput
                      className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                      placeholder="Select or enter Occupation Type"
                      value={formData.occupationType || formData.occupation || ''}
                      options={OCCUPATION_TYPE_OPTIONS}
                      onChange={val => setFormData(p => ({ ...p, occupationType: val, occupation: val }))}
                    />
                  </div>
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      Company / Business Name
                    </label>
                    <input
                      type="text"
                      className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                      placeholder="e.g. Infosys / Business Name"
                      value={formData.companyName || ''}
                      onChange={e => setFormData(p => ({ ...p, companyName: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 4. Address Details */}
            <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-visible">
              <div
                className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                onClick={() => toggleCollapse('addressDetails')}
              >
                <div className="flex items-center gap-3">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">4</span>
                    Address Details
                  </h4>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyPrimaryAddress();
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold bg-blue-100/80 hover:bg-blue-200/80 text-blue-700 transition-colors shadow-2xs cursor-pointer"
                    title="Click to copy State, City, Pincode and Street Address from Primary Contact"
                  >
                    <Copy size={11} />
                    Same as Primary Address
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-semibold">Location &amp; Residence</span>
                  <ChevronDown
                    size={16}
                    className={`text-slate-500 transition-transform duration-200 ${collapsed['addressDetails'] ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>
              {!collapsed['addressDetails'] && (
                <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      State
                    </label>
                    <DatalistInput
                      className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                      placeholder="Select or search State"
                      value={formData.state || ''}
                      options={INDIAN_STATES_AND_UTS}
                      onChange={val => setFormData(p => ({ ...p, state: val, district: '' }))}
                    />
                  </div>
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      District
                    </label>
                    <DatalistInput
                      className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                      placeholder={formData.state ? "Select or search District" : "Select State first"}
                      value={formData.district || ''}
                      options={formData.state ? (INDIAN_DISTRICTS_BY_STATE[formData.state] || []) : []}
                      onChange={val => setFormData(p => ({ ...p, district: val }))}
                    />
                  </div>
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      City / Town
                    </label>
                    <input
                      type="text"
                      className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                      placeholder="e.g. Pune"
                      value={formData.city || ''}
                      onChange={e => setFormData(p => ({ ...p, city: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      Pincode
                    </label>
                    <input
                      type="text"
                      className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                      placeholder="000000"
                      value={formData.pincode || ''}
                      onChange={e => setFormData(p => ({ ...p, pincode: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      Street Address / House No
                    </label>
                    <textarea
                      className="input w-full text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                      rows={2}
                      placeholder="Flat No, Street, Landmark..."
                      value={formData.streetAddress || ''}
                      onChange={e => setFormData(p => ({ ...p, streetAddress: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 5. Bank Details */}
            <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                onClick={() => toggleCollapse('bankDetails')}
              >
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">5</span>
                  Bank Details
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-semibold">Banking Information</span>
                  <ChevronDown
                    size={16}
                    className={`text-slate-500 transition-transform duration-200 ${collapsed['bankDetails'] ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>
              {!collapsed['bankDetails'] && (
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                      placeholder="e.g. HDFC Bank"
                      value={formData.bankName || ''}
                      onChange={e => setFormData(p => ({ ...p, bankName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      Account Number
                    </label>
                    <input
                      type="text"
                      className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                      placeholder="e.g. 50100012345678"
                      value={formData.bankAccountNumber || ''}
                      onChange={e => setFormData(p => ({ ...p, bankAccountNumber: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      IFSC Code
                    </label>
                    <input
                      type="text"
                      className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all uppercase"
                      placeholder="e.g. HDFC0001234"
                      value={formData.bankIfsc || ''}
                      onChange={e => setFormData(p => ({ ...p, bankIfsc: e.target.value.toUpperCase() }))}
                    />
                  </div>
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      Branch Name
                    </label>
                    <input
                      type="text"
                      className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                      placeholder="e.g. Shivajinagar Branch"
                      value={formData.bankBranch || ''}
                      onChange={e => setFormData(p => ({ ...p, bankBranch: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 6. Lifestyle Habits */}
            <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                onClick={() => toggleCollapse('lifestyleHabits')}
              >
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">6</span>
                  Lifestyle Habits
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-semibold">Personal Habits</span>
                  <ChevronDown
                    size={16}
                    className={`text-slate-500 transition-transform duration-200 ${collapsed['lifestyleHabits'] ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>
              {!collapsed['lifestyleHabits'] && (
                <div className="p-4 flex flex-wrap gap-4">
                  <label className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all cursor-pointer select-none ${formData.chewTobacco ? 'bg-blue-50/80 border-blue-300 text-blue-800 font-bold shadow-2xs' : 'bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    <input
                      type="checkbox"
                      className="accent-blue-600 w-4 h-4 rounded"
                      checked={!!formData.chewTobacco}
                      onChange={e => setFormData(p => ({ ...p, chewTobacco: e.target.checked }))}
                    />
                    <span className="text-xs font-semibold">Chew Tobacco</span>
                  </label>
                  <label className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all cursor-pointer select-none ${formData.smoke ? 'bg-blue-50/80 border-blue-300 text-blue-800 font-bold shadow-2xs' : 'bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    <input
                      type="checkbox"
                      className="accent-blue-600 w-4 h-4 rounded"
                      checked={!!formData.smoke}
                      onChange={e => setFormData(p => ({ ...p, smoke: e.target.checked }))}
                    />
                    <span className="text-xs font-semibold">Smoke</span>
                  </label>
                  <label className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all cursor-pointer select-none ${formData.consumeAlcohol ? 'bg-blue-50/80 border-blue-300 text-blue-800 font-bold shadow-2xs' : 'bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    <input
                      type="checkbox"
                      className="accent-blue-600 w-4 h-4 rounded"
                      checked={!!formData.consumeAlcohol}
                      onChange={e => setFormData(p => ({ ...p, consumeAlcohol: e.target.checked }))}
                    />
                    <span className="text-xs font-semibold">Consume Alcohol</span>
                  </label>
                </div>
              )}
            </div>

            {/* 7. Health History / Medical History */}
            <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                onClick={() => toggleCollapse('healthHistory')}
              >
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">7</span>
                  Health History / Medical History
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-semibold">Medical Records</span>
                  <ChevronDown
                    size={16}
                    className={`text-slate-500 transition-transform duration-200 ${collapsed['healthHistory'] ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>
              {!collapsed['healthHistory'] && (
                <div className="p-4 space-y-4">
                  {/* Declared Medical History Multi-Select */}
                  <MultiSelectBox
                    label="Declared Medical History (Multi-Select)"
                    selectedValues={(formData.declaredMedicalHistory || []) as string[]}
                    onChange={(vals) => setFormData(p => ({ ...p, declaredMedicalHistory: vals, medicalHistory: vals }))}
                    badgeColor="blue"
                    placeholder="Click to select medical conditions..."
                  />

                  {/* NOT Declared Medical History Multi-Select */}
                  <MultiSelectBox
                    label="NOT Declared Medical History (Multi-Select)"
                    selectedValues={(formData.notDeclaredMedicalHistory || []) as string[]}
                    onChange={(vals) => setFormData(p => ({ ...p, notDeclaredMedicalHistory: vals }))}
                    badgeColor="orange"
                    placeholder="Click to select NOT declared conditions..."
                  />

                  {/* Details of Medical History */}
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      Details of Medical History
                    </label>
                    <textarea
                      className="input w-full resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                      rows={2}
                      placeholder="Add any additional medical history details..."
                      value={formData.medicalHistoryDetails || ''}
                      onChange={e => setFormData(p => ({ ...p, medicalHistoryDetails: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 8. Any Surgery Done / Advised */}
            <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                onClick={() => toggleCollapse('surgeryDetails')}
              >
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">8</span>
                  Any Surgery Done / Advised
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-semibold">Surgical History</span>
                  <ChevronDown
                    size={16}
                    className={`text-slate-500 transition-transform duration-200 ${collapsed['surgeryDetails'] ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>
              {!collapsed['surgeryDetails'] && (
                <div className="p-4">
                  <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                    Surgery Details / History
                  </label>
                  <textarea
                    className="input w-full text-xs resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                    rows={2}
                    placeholder="Specify any surgeries done or advised..."
                    value={formData.surgeryDetails || ''}
                    onChange={e => setFormData(p => ({ ...p, surgeryDetails: e.target.value }))}
                  />
                </div>
              )}
            </div>

            {/* 9. Current Medicines / Prescription */}
            <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                onClick={() => toggleCollapse('prescriptionDetails')}
              >
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">9</span>
                  Current Medicines / Prescription
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-semibold">Ongoing Medications</span>
                  <ChevronDown
                    size={16}
                    className={`text-slate-500 transition-transform duration-200 ${collapsed['prescriptionDetails'] ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>
              {!collapsed['prescriptionDetails'] && (
                <div className="p-4">
                  <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                    Prescription &amp; Medication Details
                  </label>
                  <textarea
                    className="input w-full text-xs resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                    rows={2}
                    placeholder="List current ongoing medicines or prescriptions..."
                    value={formData.prescriptionDetails || ''}
                    onChange={e => setFormData(p => ({ ...p, prescriptionDetails: e.target.value }))}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>
  );
}

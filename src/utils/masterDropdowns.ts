import { insuranceService } from '../services/index';

export interface DropdownMenu {
  id: number | string;
  name: string;
  module: string;
  totalOptions?: number;
  status: 'Active' | 'Inactive';
  options: string[];
  newOptionInput?: string;
  isCustom?: boolean;
}

export interface UsageMapping {
  id: number | string;
  module: string;
  fieldName: string;
  dropdownId: number | string;
  isRequired: boolean;
  status: 'Active' | 'Inactive';
}

export const DROPDOWNS_STORAGE_KEY = 'insumitra_master_dropdowns';
export const MAPPINGS_STORAGE_KEY = 'insumitra_master_dropdown_mappings';
export const DROPDOWNS_UPDATED_EVENT = 'insumitra_master_dropdowns_changed';

export const DEFAULT_DROPDOWN_MENUS: DropdownMenu[] = [
  {
    id: 1,
    name: 'Company Categories',
    module: 'Insurance Company',
    totalOptions: 8,
    status: 'Active',
    options: ['Life Insurance', 'General Insurance', 'Standalone Health Insurance', 'Reinsurance', 'Health', 'Life', 'General', 'Global'],
  },
  {
    id: 2,
    name: 'Plan Categories',
    module: 'Plan',
    totalOptions: 11,
    status: 'Active',
    options: ['General', 'Motor', 'Health', 'Accident', 'Life Term', 'Life Other', 'Group PA', 'Group Health', 'SME', 'Travel', 'Other'],
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
      'Roadside Assistance (Motor)',
    ],
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
      'Faridabad', 'Rajkot',
    ],
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
      'Ladakh', 'Lakshadweep', 'Puducherry',
    ],
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
      'Surat Ring Road', 'Jaipur MI Road', 'Lucknow Hazratganj',
    ],
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
      'IndusInd Bank', 'Yes Bank', 'IDFC FIRST Bank',
    ],
  },
  {
    id: 8,
    name: 'Payout Cycles',
    module: 'Agent',
    totalOptions: 4,
    status: 'Active',
    options: ['Monthly', 'Fortnightly', 'Weekly', 'Daily / Instant'],
  },
  {
    id: 9,
    name: 'Policy Types',
    module: 'Policy',
    totalOptions: 10,
    status: 'Active',
    options: ['Retail Individual', 'Retail Floater', 'Corporate Individual', 'Corporate Floater', 'Health', 'Life', 'Motor', 'General', 'Travel', 'Accident'],
  },
  {
    id: 10,
    name: 'Customer Categories',
    module: 'Policy',
    totalOptions: 4,
    status: 'Active',
    options: ['Fresh', 'Port', 'Renewal', 'Rollover'],
  },
  {
    id: 11,
    name: 'Payment Frequency',
    module: 'Policy',
    totalOptions: 5,
    status: 'Active',
    options: ['Yearly', 'Half-Yearly', 'Quarterly', 'Monthly', 'Single'],
  },
  {
    id: 12,
    name: 'Policy Statuses',
    module: 'Policy',
    totalOptions: 8,
    status: 'Active',
    options: ['Inforce', 'Active', 'Renewal Due', 'Grace Period', 'Lapsed', 'Inactive(Old)', 'Cancelled', 'Pending'],
  },
  {
    id: 13,
    name: 'Gender',
    module: 'Contact',
    totalOptions: 3,
    status: 'Active',
    options: ['Male', 'Female', 'Other'],
  },
  {
    id: 14,
    name: 'Marital Status',
    module: 'Contact',
    totalOptions: 4,
    status: 'Active',
    options: ['Single', 'Married', 'Divorced', 'Widowed'],
  },
  {
    id: 15,
    name: 'Education',
    module: 'Contact',
    totalOptions: 14,
    status: 'Active',
    options: [
      'Metric', 'Intermediate', 'Graduate', 'Post Graduate', 'Up to 9th class passed',
      '10th class passed', 'Post Graduate (Gen)', 'Med Graduate', 'Post Graduate, Eng',
      'Law Graduate / Post Graduate', 'CA/ICWA/MBA/CFA', 'Computer degree other',
      'Doctorate', 'Diploma', 'Other'
    ],
  },
  {
    id: 16,
    name: 'Occupation',
    module: 'Contact',
    totalOptions: 12,
    status: 'Active',
    options: [
      'Salaried Private', 'Salaried Gov', 'Salaried/Service', 'Business Owner', 'Business',
      'Industrialist', 'Self Employed Professional', 'Agriculture', 'Student', 'Retired',
      'Homemaker', 'Other'
    ],
  },
  {
    id: 17,
    name: 'Relationships',
    module: 'Contact',
    totalOptions: 12,
    status: 'Active',
    options: ['Spouse', 'Child', 'Son', 'Daughter', 'Parent', 'Father', 'Mother', 'Sibling', 'Brother', 'Sister', 'In-Law', 'Other'],
  },
  {
    id: 18,
    name: 'Claim Types',
    module: 'Claim',
    totalOptions: 6,
    status: 'Active',
    options: ['Cashless', 'Reimbursement', 'Pre-Post Hospitalization', 'Accident', 'Death Claim', 'Other'],
  },
  {
    id: 19,
    name: 'Claim Statuses',
    module: 'Claim',
    totalOptions: 23,
    status: 'Active',
    options: [
      'Intimated', 'Discharge Done', 'Pending Documents from Hospital/Customer',
      'Documents Collected from Hospital/Customer', 'Submitted to Company', 'Pending for approval',
      'Query Raised', 'Query Resolved', 'Partially Approved', 'Approved', 'Settled', 'Rejected',
      'No Response from Customer', 'Pre-Authorisation Approved', 'Pre-Authorisation Rejected',
      'Enhancement Approved', 'Enhancement Rejected', 'Interim Authorisation Approved',
      'Interim Authorisation Rejected', 'Final Authorisation Approved', 'Final Authorisation Rejected',
      'Advised to go for Reimbursement', 'Treatment Cancelled/Changed'
    ],
  },
  {
    id: 20,
    name: 'Hospital Types',
    module: 'Claim',
    totalOptions: 4,
    status: 'Active',
    options: ['Network', 'Non-Network', 'Blacklisted', 'Other'],
  },
];

export const DEFAULT_USAGE_MAPPINGS: UsageMapping[] = [
  { id: 1, module: 'Insurance Company', fieldName: 'Category', dropdownId: 1, isRequired: true, status: 'Active' },
  { id: 2, module: 'Plan', fieldName: 'Category', dropdownId: 2, isRequired: true, status: 'Active' },
  { id: 3, module: 'Rider / Add-on', fieldName: 'Rider Category', dropdownId: 3, isRequired: false, status: 'Active' },
  { id: 4, module: 'Hospital', fieldName: 'City', dropdownId: 4, isRequired: true, status: 'Active' },
  { id: 5, module: 'Hospital / Agent', fieldName: 'State', dropdownId: 5, isRequired: true, status: 'Active' },
  { id: 6, module: 'Agent', fieldName: 'Branch', dropdownId: 6, isRequired: false, status: 'Active' },
  { id: 7, module: 'Agent', fieldName: 'Bank Name', dropdownId: 7, isRequired: false, status: 'Active' },
  { id: 8, module: 'Agent', fieldName: 'Payout Cycle', dropdownId: 8, isRequired: false, status: 'Active' },
  { id: 9, module: 'Policy', fieldName: 'Policy Type', dropdownId: 9, isRequired: true, status: 'Active' },
  { id: 10, module: 'Policy', fieldName: 'Customer Category', dropdownId: 10, isRequired: false, status: 'Active' },
  { id: 11, module: 'Policy', fieldName: 'Payment Frequency', dropdownId: 11, isRequired: false, status: 'Active' },
  { id: 12, module: 'Contact', fieldName: 'Gender', dropdownId: 13, isRequired: false, status: 'Active' },
  { id: 13, module: 'Contact', fieldName: 'Marital Status', dropdownId: 14, isRequired: false, status: 'Active' },
  { id: 14, module: 'Contact', fieldName: 'Education', dropdownId: 15, isRequired: false, status: 'Active' },
  { id: 15, module: 'Contact', fieldName: 'Occupation', dropdownId: 16, isRequired: false, status: 'Active' },
  { id: 16, module: 'Claim', fieldName: 'Claim Type', dropdownId: 18, isRequired: true, status: 'Active' },
  { id: 17, module: 'Claim', fieldName: 'Claim Status', dropdownId: 19, isRequired: true, status: 'Active' },
];

export function getStoredDropdownMenus(): DropdownMenu[] {
  try {
    const raw = localStorage.getItem(DROPDOWNS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // User configured menus are the source of truth
        const result: DropdownMenu[] = [...parsed];
        const existingIds = new Set(parsed.map(p => String(p.id)));
        const existingNames = new Set(parsed.map(p => cleanKey(p.name)));

        for (const def of DEFAULT_DROPDOWN_MENUS) {
          if (!existingIds.has(String(def.id)) && !existingNames.has(cleanKey(def.name))) {
            result.push(def);
          }
        }
        return result;
      }
    }
  } catch {}
  return DEFAULT_DROPDOWN_MENUS;
}

export function saveStoredDropdownMenus(menus: DropdownMenu[], syncToBackend = true): void {
  try {
    localStorage.setItem(DROPDOWNS_STORAGE_KEY, JSON.stringify(menus));
    window.dispatchEvent(new CustomEvent(DROPDOWNS_UPDATED_EVENT, { detail: menus }));
    if (syncToBackend) {
      insuranceService.updateDropdownMenus(menus).catch(() => {});
    }
  } catch {}
}

export function getStoredUsageMappings(): UsageMapping[] {
  try {
    const raw = localStorage.getItem(MAPPINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_USAGE_MAPPINGS;
}

export function saveStoredUsageMappings(mappings: UsageMapping[]): void {
  try {
    localStorage.setItem(MAPPINGS_STORAGE_KEY, JSON.stringify(mappings));
    insuranceService.updateDropdownMappings(mappings).catch(() => {});
  } catch {}
}

function cleanKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/ies$/, 'y').replace(/s$/, '');
}

export function getActiveDropdownOptions(
  moduleName: string,
  fieldName: string,
  fallbackOptions: Array<{ value: string; label: string } | string> = [],
  providedMenus?: DropdownMenu[]
): Array<{ value: string; label: string }> {
  const menus = (providedMenus && providedMenus.length > 0) ? providedMenus : getStoredDropdownMenus();
  const targetKey = cleanKey(fieldName);
  const targetModule = cleanKey(moduleName);

  const isPolicyFamily = (mod: string) => {
    const m = cleanKey(mod);
    return m === 'policy' || m === 'plan' || m === 'insurancecompany' || m === 'company';
  };

  // 1. First attempt: match by exact name AND matching module (or policy family)
  let matched = menus.find(
    m => m.status === 'Active' &&
      cleanKey(m.name) === targetKey &&
      (cleanKey(m.module) === targetModule || (isPolicyFamily(targetModule) && isPolicyFamily(m.module)))
  );

  // 2. Second attempt: match by exact name alone across all modules
  if (!matched) {
    matched = menus.find(
      m => m.status === 'Active' && cleanKey(m.name) === targetKey
    );
  }

  // 3. Third attempt: match common aliases
  if (!matched) {
    const aliases: Record<string, string[]> = {
      'companycategory': ['insurancecompanycategory', 'companycategories', 'insurancecompanycategories', 'category'],
      'insurancecompanycategory': ['companycategory', 'companycategories', 'insurancecompanycategory', 'insurancecompanycategories', 'category'],
      'plancategory': ['insuranceplancategory', 'plancategories', 'productcategory'],
      'insuranceplancategory': ['plancategory', 'plancategories', 'productcategory'],
      'policytype': ['policytypes', 'productcategory'],
      'policytypes': ['policytype', 'productcategory'],
      'customercategory': ['businesstype', 'customercategories', 'customercategory'],
      'customercategories': ['businesstype', 'customercategory'],
      'businesstype': ['customercategory', 'customercategories'],
      'paymentfrequency': ['paymentfrequencies', 'frequency'],
      'paymentfrequencies': ['paymentfrequency', 'frequency'],
      'policystatus': ['policystatuses', 'status'],
      'policystatuses': ['policystatus', 'status'],
    };

    const targetAliases = aliases[targetKey] || [];
    matched = menus.find(
      m => m.status === 'Active' && (
        targetAliases.includes(cleanKey(m.name)) ||
        targetAliases.some(alias => cleanKey(m.name).includes(alias) || alias.includes(cleanKey(m.name)))
      )
    );
  }

  // 4. Fourth attempt: substring match
  if (!matched) {
    matched = menus.find(
      m => m.status === 'Active' && (
        cleanKey(m.name).includes(targetKey) || targetKey.includes(cleanKey(m.name))
      )
    );
  }

  if (matched && Array.isArray(matched.options) && matched.options.length > 0) {
    return matched.options.map(opt => ({
      value: opt,
      label: opt,
    }));
  }

  return fallbackOptions.map(opt =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );
}

export function getModuleCustomDropdowns(moduleName: string, providedMenus?: DropdownMenu[]): DropdownMenu[] {
  const menus = (providedMenus && providedMenus.length > 0) ? providedMenus : getStoredDropdownMenus();
  const targetModule = cleanKey(moduleName);
  const isPolicyFamily = (mod: string) => {
    const m = cleanKey(mod);
    return m === 'policy' || m === 'plan' || m === 'insurancecompany' || m === 'company';
  };

  const standardFields = new Set([
    'policytype', 'policytypes', 'customercategory', 'customercategories', 'businesstype',
    'paymentfrequency', 'paymentfrequencies', 'policystatus', 'policystatuses',
    'gender', 'maritalstatus', 'education', 'occupation', 'relationship', 'relationships', 'contactrole',
    'claimtype', 'claimtypes', 'claimstatus', 'claimstatuses', 'hospitaltype', 'hospitaltypes',
    'companycategory', 'companycategories', 'insurancecompanycategory', 'insurancecompanycategories',
    'plancategory', 'plancategories', 'insuranceplancategory'
  ]);

  return menus.filter(m => {
    if (m.status !== 'Active') return false;
    const mod = cleanKey(m.module);
    const matchesModule = mod === targetModule || (isPolicyFamily(targetModule) && isPolicyFamily(mod));
    if (!matchesModule) return false;
    const nameKey = cleanKey(m.name);
    return !standardFields.has(nameKey);
  });
}

export function isCategoryMatch(itemCat: string, selectedCat: string): boolean {
  if (!selectedCat || !selectedCat.trim()) return true;
  if (!itemCat || !itemCat.trim()) return true;

  const sel = selectedCat.trim().toUpperCase();
  const cat = itemCat.trim().toUpperCase();

  // 1. Direct match or substring match
  if (sel === cat || cat.includes(sel) || sel.includes(cat)) return true;

  // 2. Health & Retail / Floater / Corporate / Individual / Mediclaim
  const isSelHealth =
    sel.includes('HEALTH') ||
    sel.includes('RETAIL') ||
    sel.includes('FLOATER') ||
    sel.includes('CORPORATE') ||
    sel.includes('INDIVIDUAL') ||
    sel.includes('MEDICLAIM');
  const isCatHealth =
    cat.includes('HEALTH') ||
    cat.includes('CRITICAL ILLNESS') ||
    cat.includes('MEDICLAIM');
  if (isSelHealth && isCatHealth) return true;

  // 3. Life & Term
  const isSelLife = sel.includes('LIFE') || sel.includes('TERM');
  const isCatLife = cat.includes('LIFE') || cat.includes('TERM');
  if (isSelLife && isCatLife) return true;

  // 4. Motor / Vehicle / Auto / Car / Bike
  const isSelMotor =
    sel.includes('MOTOR') ||
    sel.includes('AUTO') ||
    sel.includes('VEHICLE') ||
    sel.includes('CAR') ||
    sel.includes('BIKE');
  const isCatMotor =
    cat.includes('MOTOR') ||
    cat.includes('AUTO') ||
    cat.includes('VEHICLE');
  if (isSelMotor && isCatMotor) return true;

  // 5. Travel
  const isSelTravel = sel.includes('TRAVEL');
  const isCatTravel = cat.includes('TRAVEL');
  if (isSelTravel && isCatTravel) return true;

  // 6. Accident / Personal Accident / PA
  const isSelAccident = sel.includes('ACCIDENT') || sel.includes('PA');
  const isCatAccident = cat.includes('ACCIDENT') || cat.includes('PA');
  if (isSelAccident && isCatAccident) return true;

  // 7. General Insurance
  if (sel.includes('GENERAL')) {
    return isCatMotor || isCatTravel || isCatAccident || isCatHealth || cat.includes('GENERAL');
  }

  return false;
}


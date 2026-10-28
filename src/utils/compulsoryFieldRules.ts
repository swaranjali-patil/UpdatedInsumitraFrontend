import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useCallback } from 'react';
import { insuranceService } from '../services/index';

export const COMPULSORY_RULES_UPDATED_EVENT = 'insumitra_compulsory_rules_changed';

export function notifyCompulsoryRulesUpdated(detail?: any): void {
  try {
    window.dispatchEvent(new CustomEvent(COMPULSORY_RULES_UPDATED_EVENT, { detail }));
  } catch {}
}

export function normalizeRuleKey(str: string): string {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const FIELD_ALIASES: Record<string, string[]> = {
  phone: ['phone', 'whatsapp', 'whatsappnumber', 'mobile', 'mobilenumber', 'contactno'],
  whatsappnumber: ['phone', 'whatsapp', 'whatsappnumber', 'mobile', 'mobilenumber', 'contactno'],
  dob: ['dob', 'dateofbirth', 'birthdate'],
  dateofbirth: ['dob', 'dateofbirth', 'birthdate'],
  pan: ['pan', 'pannumber', 'panno'],
  pannumber: ['pan', 'pannumber', 'panno'],
  aadhaar: ['aadhaar', 'aadhaarnumber', 'aadhaarno', 'aadhar', 'aadharnumber'],
  aadhaarnumber: ['aadhaar', 'aadhaarnumber', 'aadhaarno', 'aadhar', 'aadharnumber'],
  address: ['address', 'streetaddress', 'houseno', 'residentialaddress'],
  streetaddress: ['address', 'streetaddress', 'houseno', 'residentialaddress'],
  city: ['city', 'town', 'location', 'hospitalcity'],
  state: ['state', 'hospitalstate'],
  pincode: ['pincode', 'postalcode', 'zipcode', 'hospitalpincode'],
  sumassured: ['sumassured', 'suminsured', 'coverage', 'coverageamount', 'deathsuminsured'],
  suminsured: ['sumassured', 'suminsured', 'coverage', 'coverageamount', 'deathsuminsured'],
  premiumamount: ['premium', 'premiumamount', 'grosspremium'],
  startdate: ['startdate', 'policystartdate', 'effectivedate', 'fromdate'],
  enddate: ['enddate', 'policyenddate', 'expirydate', 'todate'],
  customerid: ['customer', 'customerid', 'contactid', 'clientid'],
  contactid: ['customer', 'customerid', 'contactid', 'clientid'],
  planid: ['plan', 'planid', 'insuranceplan', 'planname'],
  claimamount: ['claimamount', 'claimedamount', 'totalclaimedamount'],
  claimnumber: ['claimnumber', 'claimno'],
  claimtype: ['claimtype', 'typeofclaim'],
  hospitalname: ['hospital', 'hospitalname'],
  hospital: ['hospital', 'hospitalname'],
  occupationtype: ['occupation', 'occupationtype'],
  education: ['education', 'qualification'],
  annualincome: ['annualincome', 'income'],
  gender: ['gender', 'sex'],
};

export function isRuleModuleMatch(targetMod: string, ruleMod: string): boolean {
  const tm = normalizeRuleKey(targetMod);
  const rm = normalizeRuleKey(ruleMod);
  if (tm === rm) return true;
  if ((tm === 'contact' || tm === 'contacts') && (rm === 'contact' || rm === 'contacts')) return true;
  if ((tm === 'lead' || tm === 'leads') && (rm === 'lead' || rm === 'leads')) return true;
  if ((tm === 'policy' || tm === 'policies') && (rm === 'policy' || rm === 'policies' || rm === 'plan')) return true;
  if ((tm === 'claim' || tm === 'claims') && (rm === 'claim' || rm === 'claims' || rm === 'hospital')) return true;
  return false;
}

export function isFieldRequired(
  rules: any[],
  moduleName: string,
  fieldKey: string,
  defaultRequired: boolean = false
): boolean {
  if (!Array.isArray(rules) || rules.length === 0) return defaultRequired;

  const targetKeyNorm = normalizeRuleKey(fieldKey);
  const keyAliases = FIELD_ALIASES[targetKeyNorm] || [targetKeyNorm];

  const matchedRule = rules.find((r: any) => {
    if (!r) return false;
    if (!isRuleModuleMatch(moduleName, r.module)) return false;
    const ruleKeyNorm = normalizeRuleKey(r.fieldKey);
    return ruleKeyNorm === targetKeyNorm || keyAliases.includes(ruleKeyNorm);
  });

  if (matchedRule !== undefined) {
    return Boolean(matchedRule.required);
  }

  return defaultRequired;
}

export function useCompulsoryRules(moduleName: string = '') {
  const qc = useQueryClient();

  const { data: compulsoryRulesRes, isLoading, refetch } = useQuery({
    queryKey: ['compulsory-rules'],
    queryFn: () => insuranceService.getCompulsoryRules(),
    staleTime: 30000,
  });

  const compulsoryRules = useMemo(() => compulsoryRulesRes?.data ?? [], [compulsoryRulesRes]);

  useEffect(() => {
    const handleUpdate = () => {
      qc.invalidateQueries({ queryKey: ['compulsory-rules'] });
    };

    window.addEventListener(COMPULSORY_RULES_UPDATED_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(COMPULSORY_RULES_UPDATED_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [qc]);

  const checkRequired = useCallback(
    (fieldKey: string, defaultRequired: boolean = false, overrideModule?: string) => {
      return isFieldRequired(compulsoryRules, overrideModule || moduleName, fieldKey, defaultRequired);
    },
    [compulsoryRules, moduleName]
  );

  return {
    compulsoryRules,
    isFieldRequired: checkRequired,
    isLoading,
    refetch,
  };
}

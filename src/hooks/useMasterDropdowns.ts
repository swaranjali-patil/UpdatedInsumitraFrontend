import { useState, useEffect, useCallback } from 'react';
import {
  DropdownMenu,
  UsageMapping,
  getStoredDropdownMenus,
  saveStoredDropdownMenus,
  getStoredUsageMappings,
  saveStoredUsageMappings,
  getActiveDropdownOptions,
  getModuleCustomDropdowns,
  DROPDOWNS_UPDATED_EVENT,
} from '../utils/masterDropdowns';
import { insuranceService } from '../services/index';

export function useMasterDropdowns() {
  const [dropdownMenus, setDropdownMenusState] = useState<DropdownMenu[]>(getStoredDropdownMenus);
  const [usageMappings, setUsageMappingsState] = useState<UsageMapping[]>(getStoredUsageMappings);
  const [isLoading, setIsLoading] = useState(false);

  // Sync from backend on initial mount
  useEffect(() => {
    let isMounted = true;
    insuranceService.getDropdownMenus()
      .then(res => {
        if (!isMounted) return;
        if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
          setDropdownMenusState(res.data);
          saveStoredDropdownMenus(res.data, false);
        }
      })
      .catch(() => {});

    insuranceService.getDropdownMappings()
      .then(res => {
        if (!isMounted) return;
        if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
          setUsageMappingsState(res.data);
          saveStoredUsageMappings(res.data);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  // Listen to cross-component update events
  useEffect(() => {
    const handleUpdated = (e: any) => {
      const updated = e?.detail || getStoredDropdownMenus();
      setDropdownMenusState(updated);
    };

    window.addEventListener(DROPDOWNS_UPDATED_EVENT, handleUpdated);
    window.addEventListener('storage', handleUpdated);

    return () => {
      window.removeEventListener(DROPDOWNS_UPDATED_EVENT, handleUpdated);
      window.removeEventListener('storage', handleUpdated);
    };
  }, []);

  const setDropdownMenus = useCallback((updater: DropdownMenu[] | ((prev: DropdownMenu[]) => DropdownMenu[])) => {
    setDropdownMenusState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveStoredDropdownMenus(next);
      return next;
    });
  }, []);

  const setUsageMappings = useCallback((updater: UsageMapping[] | ((prev: UsageMapping[]) => UsageMapping[])) => {
    setUsageMappingsState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveStoredUsageMappings(next);
      return next;
    });
  }, []);

  const getOptions = useCallback(
    (moduleName: string, fieldName: string, fallback: Array<{ value: string; label: string } | string> = []) => {
      return getActiveDropdownOptions(moduleName, fieldName, fallback, dropdownMenus);
    },
    [dropdownMenus]
  );

  const getCustomDropdowns = useCallback((moduleName: string) => {
    return getModuleCustomDropdowns(moduleName, dropdownMenus);
  }, [dropdownMenus]);

  return {
    dropdownMenus,
    setDropdownMenus,
    usageMappings,
    setUsageMappings,
    getOptions,
    getCustomDropdowns,
    isLoading,
  };
}

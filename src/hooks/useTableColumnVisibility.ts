import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { insuranceService } from '@api/index';
import { tableVisibilityManager } from '../utils/TableVisibilityManager';
import { TABLE_COLUMNS_CONFIG } from '../constants/tableColumns';

export function useTableColumnVisibility(pageId: string) {
  const qc = useQueryClient();

  const { data: visibilityRulesRes } = useQuery({
    queryKey: ['table-columns'],
    queryFn: () => insuranceService.getTableColumnVisibility(),
  });

  const rules: any[] = visibilityRulesRes?.data ?? [];

  // Helper to normalize column names for robust case-insensitive comparison
  const norm = (s: string) => (s || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  // Custom user-defined columns stored locally & synced with DB rules
  const customColumns = useMemo(() => {
    let localCustom: Record<string, string[]> = {};
    try {
      const stored = localStorage.getItem('insumitra_custom_table_columns');
      if (stored) localCustom = JSON.parse(stored);
    } catch {}

    const pageCustom = localCustom[pageId] || [];
    const baseCols = (TABLE_COLUMNS_CONFIG.find(p => p.pageId === pageId)?.columns || []).map(norm);

    // Auto-discover any columns stored in backend rules for this page that are not in default config
    const fromRules = rules
      .filter((r: any) => r.pageId === pageId && r.colName && !baseCols.includes(norm(r.colName)))
      .map((r: any) => r.colName);

    const merged = Array.from(new Set([...pageCustom, ...fromRules]));

    // Keep localStorage updated if fromRules discovered anything new
    if (merged.length !== pageCustom.length) {
      try {
        localStorage.setItem(
          'insumitra_custom_table_columns',
          JSON.stringify({ ...localCustom, [pageId]: merged })
        );
      } catch {}
    }

    return merged;
  }, [pageId, rules]);

  // All configured columns for this table (defaults + custom fields, deduped)
  const allColumns = useMemo(() => {
    const config = TABLE_COLUMNS_CONFIG.find(p => p.pageId === pageId);
    const base = config?.columns || [];
    const uniqueUser = customColumns.filter(uCol => !base.some(bCol => norm(bCol) === norm(uCol)));
    const merged = [...base, ...uniqueUser];
    const seen = new Set<string>();
    return merged.filter(col => {
      const n = norm(col);
      if (seen.has(n)) return false;
      seen.add(n);
      return true;
    });
  }, [pageId, customColumns]);

  const updateMutation = useMutation({
    mutationFn: (data: { pageId: string; colName: string; isHidden: boolean }) =>
      insuranceService.updateTableColumnVisibility(data.pageId, data.colName, data.isHidden),
    onMutate: async (variables) => {
      await qc.cancelQueries({ queryKey: ['table-columns'] });
      const previousData = qc.getQueryData(['table-columns']);
      qc.setQueryData(['table-columns'], (old: any) => {
        const arr = (old?.data || []).filter(
          (a: any) => !(a.pageId === variables.pageId && norm(a.colName) === norm(variables.colName))
        );
        arr.push({ ...variables, tenantId: 'local' });
        tableVisibilityManager.setRules(arr);
        return { ...old, data: arr };
      });
      return { previousData };
    },
    onError: (_err, _variables, context: any) => {
      if (context?.previousData) {
        qc.setQueryData(['table-columns'], context.previousData);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['table-columns'] });
    },
  });

  const isVisible = (colName: string): boolean => {
    if (!colName) return true;
    const target = norm(colName);
    for (let i = rules.length - 1; i >= 0; i--) {
      const r = rules[i];
      if (r.pageId === pageId && norm(r.colName) === target) {
        return !r.isHidden;
      }
    }
    return true;
  };

  const toggleColumn = (colName: string, forceHidden?: boolean) => {
    if (!colName) return;
    const isHidden = forceHidden !== undefined ? forceHidden : isVisible(colName);
    updateMutation.mutate({
      pageId,
      colName,
      isHidden,
    });
  };

  const setColumnVisibility = (colName: string, makeVisible: boolean) => {
    if (!colName) return;
    updateMutation.mutate({
      pageId,
      colName,
      isHidden: !makeVisible,
    });
  };

  return {
    isVisible,
    toggleColumn,
    setColumnVisibility,
    rules,
    allColumns,
    customColumns,
  };
}

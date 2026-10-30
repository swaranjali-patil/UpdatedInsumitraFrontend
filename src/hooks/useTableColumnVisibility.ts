import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { insuranceService } from '@api/index';
import { tableVisibilityManager } from '../utils/TableVisibilityManager';

export function useTableColumnVisibility(pageId: string) {
  const qc = useQueryClient();

  const { data: visibilityRulesRes } = useQuery({
    queryKey: ['table-columns'],
    queryFn: () => insuranceService.getTableColumnVisibility(),
  });

  const rules: any[] = visibilityRulesRes?.data ?? [];

  const updateMutation = useMutation({
    mutationFn: (data: { pageId: string; colName: string; isHidden: boolean }) =>
      insuranceService.updateTableColumnVisibility(data.pageId, data.colName, data.isHidden),
    onMutate: async (variables) => {
      await qc.cancelQueries({ queryKey: ['table-columns'] });
      const previousData = qc.getQueryData(['table-columns']);
      qc.setQueryData(['table-columns'], (old: any) => {
        const arr = [...(old?.data || [])];
        const idx = arr.findIndex(
          (a: any) => a.pageId === variables.pageId && a.colName.toLowerCase() === variables.colName.toLowerCase()
        );
        if (idx >= 0) {
          arr[idx] = { ...arr[idx], isHidden: variables.isHidden };
        } else {
          arr.push({ ...variables, tenantId: 'local' });
        }
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
    const rule = rules.find(
      (r: any) => r.pageId === pageId && r.colName.toLowerCase() === colName.toLowerCase()
    );
    return rule ? !rule.isHidden : true;
  };

  const toggleColumn = (colName: string) => {
    if (!colName) return;
    const currentlyVisible = isVisible(colName);
    updateMutation.mutate({
      pageId,
      colName,
      isHidden: currentlyVisible,
    });
  };

  return {
    isVisible,
    toggleColumn,
    rules,
  };
}

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RotateCcw, Search, Eye, EyeOff, CheckCircle2, SlidersHorizontal, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { insuranceService } from '@api/index';
import { TABLE_COLUMNS_CONFIG } from '../../constants/tableColumns';
import { tableVisibilityManager } from '../../utils/TableVisibilityManager';

interface TableColumnSettingsProps {
  onBack?: () => void;
  defaultPageId?: string;
  hideHeader?: boolean;
}

export default function TableColumnSettings({ onBack, defaultPageId, hideHeader = false }: TableColumnSettingsProps) {
  const qc = useQueryClient();
  const [selectedPageId, setSelectedPageId] = useState<string>(() => {
    if (defaultPageId && TABLE_COLUMNS_CONFIG.some(p => p.pageId === defaultPageId)) {
      return defaultPageId;
    }
    return TABLE_COLUMNS_CONFIG[0].pageId;
  });

  useEffect(() => {
    if (defaultPageId && TABLE_COLUMNS_CONFIG.some(p => p.pageId === defaultPageId)) {
      setSelectedPageId(defaultPageId);
    }
  }, [defaultPageId]);
  const [tableSearch, setTableSearch] = useState<string>('');
  const [columnSearch, setColumnSearch] = useState<string>('');

  // Add field modal states
  const [showAddColumnModal, setShowAddColumnModal] = useState<boolean>(false);
  const [modalTargetPageId, setModalTargetPageId] = useState<string>(TABLE_COLUMNS_CONFIG[0].pageId);
  const [newFieldName, setNewFieldName] = useState<string>('');
  const [isFieldVisible, setIsFieldVisible] = useState<boolean>(true);

  // Custom user-defined columns stored locally & synced with DB rules
  const [customColumns, setCustomColumns] = useState<Record<string, string[]>>(() => {
    try {
      const stored = localStorage.getItem('insumitra_custom_table_columns');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const { data: visibilityRulesRes, isLoading } = useQuery({
    queryKey: ['table-columns'],
    queryFn: () => insuranceService.getTableColumnVisibility(),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { pageId: string; colName: string; isHidden: boolean }) =>
      insuranceService.updateTableColumnVisibility(data.pageId, data.colName, data.isHidden),
    onMutate: async (variables) => {
      await qc.cancelQueries({ queryKey: ['table-columns'] });
      const previousData = qc.getQueryData(['table-columns']);
      qc.setQueryData(['table-columns'], (old: any) => {
        const arr = [...(old?.data || [])];
        const idx = arr.findIndex((a: any) => a.pageId === variables.pageId && a.colName === variables.colName);
        if (idx >= 0) arr[idx] = { ...arr[idx], isHidden: variables.isHidden };
        else arr.push({ ...variables, tenantId: 'local' });
        tableVisibilityManager.setRules(arr);
        return { ...old, data: arr };
      });
      return { previousData };
    },
    onError: (_err, _variables, context: any) => {
      if (context?.previousData) {
        qc.setQueryData(['table-columns'], context.previousData);
      }
      toast.error('Failed to update visibility');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['table-columns'] });
    }
  });

  const rules = useMemo(() => visibilityRulesRes?.data || [], [visibilityRulesRes]);

  // Sync to local storage for instant multi-page persistence
  useEffect(() => {
    if (rules && rules.length > 0) {
      try {
        localStorage.setItem('insumitra_table_column_visibility', JSON.stringify(rules));
      } catch {}

      // Auto-discover any columns stored in backend rules that are not in default config
      setCustomColumns(prev => {
        let changed = false;
        const updated = { ...prev };
        rules.forEach((r: any) => {
          const defaultCols = TABLE_COLUMNS_CONFIG.find(p => p.pageId === r.pageId)?.columns || [];
          const lowerDefaults = defaultCols.map(c => c.toLowerCase());
          if (!lowerDefaults.includes(r.colName.toLowerCase())) {
            if (!updated[r.pageId]) updated[r.pageId] = [];
            if (!updated[r.pageId].some(c => c.toLowerCase() === r.colName.toLowerCase())) {
              updated[r.pageId] = [...updated[r.pageId], r.colName];
              changed = true;
            }
          }
        });
        if (changed) {
          try {
            localStorage.setItem('insumitra_custom_table_columns', JSON.stringify(updated));
          } catch {}
          return updated;
        }
        return prev;
      });
    }
  }, [rules]);

  const getIsHidden = (pageId: string, colName: string) => {
    const norm = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const rule = rules.find((r: any) => r.pageId === pageId && (r.colName === colName || norm(r.colName) === norm(colName)));
    return rule ? rule.isHidden : false;
  };

  const getColumnsForTable = (pageId: string) => {
    const config = TABLE_COLUMNS_CONFIG.find(p => p.pageId === pageId);
    const base = config?.columns || [];
    const user = customColumns[pageId] || [];
    const uniqueUser = user.filter(uCol => !base.some(bCol => bCol.toLowerCase() === uCol.toLowerCase()));
    return [...base, ...uniqueUser];
  };

  const isCustomColumn = (pageId: string, colName: string) => {
    const config = TABLE_COLUMNS_CONFIG.find(p => p.pageId === pageId);
    const base = config?.columns || [];
    return !base.some(bCol => bCol.toLowerCase() === colName.toLowerCase());
  };

  const currentTable = useMemo(
    () => TABLE_COLUMNS_CONFIG.find(p => p.pageId === selectedPageId) || TABLE_COLUMNS_CONFIG[0],
    [selectedPageId]
  );

  const currentTableColumns = useMemo(
    () => getColumnsForTable(selectedPageId),
    [selectedPageId, customColumns, currentTable]
  );

  const filteredColumns = useMemo(() => {
    if (!columnSearch.trim()) return currentTableColumns;
    return currentTableColumns.filter(col =>
      col.toLowerCase().includes(columnSearch.toLowerCase().trim())
    );
  }, [currentTableColumns, columnSearch]);

  const filteredTables = useMemo(() => {
    if (!tableSearch.trim()) return TABLE_COLUMNS_CONFIG;
    return TABLE_COLUMNS_CONFIG.filter(cfg =>
      cfg.pageName.toLowerCase().includes(tableSearch.toLowerCase().trim()) ||
      cfg.pageId.toLowerCase().includes(tableSearch.toLowerCase().trim())
    );
  }, [tableSearch]);

  const hiddenCountForCurrentTable = useMemo(
    () => currentTableColumns.filter(col => getIsHidden(selectedPageId, col)).length,
    [currentTableColumns, selectedPageId, rules]
  );

  const showingCountForCurrentTable = currentTableColumns.length - hiddenCountForCurrentTable;

  const getHiddenCountForTable = (pageId: string) => {
    const cols = getColumnsForTable(pageId);
    return cols.filter(col => getIsHidden(pageId, col)).length;
  };

  const handleToggle = (colName: string) => {
    const isCurrentlyHidden = getIsHidden(selectedPageId, colName);
    const newHidden = !isCurrentlyHidden;
    updateMutation.mutate({ pageId: selectedPageId, colName, isHidden: newHidden });
    if (newHidden) {
      toast.success(`"${colName}" is now hidden`, { id: `toggle-${colName}` });
    } else {
      toast.success(`"${colName}" is now showing`, { id: `toggle-${colName}` });
    }
  };

  const handleShowAll = async () => {
    const hiddenCols = currentTableColumns.filter(col => getIsHidden(selectedPageId, col));
    if (hiddenCols.length === 0) {
      toast.success('All columns are already showing');
      return;
    }
    const promises = hiddenCols.map(colName =>
      updateMutation.mutateAsync({ pageId: selectedPageId, colName, isHidden: false })
    );
    await Promise.all(promises);
    toast.success(`All ${currentTable.pageName} columns are now visible`);
  };

  const handleHideAll = async () => {
    const visibleCols = currentTableColumns.filter(col => !getIsHidden(selectedPageId, col));
    if (visibleCols.length <= 1) {
      toast.error('At least one column must remain visible');
      return;
    }
    // Keep the very first primary column visible so table remains readable
    const toHide = visibleCols.slice(1);
    const promises = toHide.map(colName =>
      updateMutation.mutateAsync({ pageId: selectedPageId, colName, isHidden: true })
    );
    await Promise.all(promises);
    toast.success(`Hidden ${toHide.length} columns in ${currentTable.pageName}`);
  };

  const handleReset = async () => {
    const currentHiddenRules = rules.filter((r: any) => r.pageId === selectedPageId && r.isHidden);
    const allToReset = new Set<string>([
      ...currentHiddenRules.map((r: any) => r.colName),
      ...currentTableColumns.filter(col => getIsHidden(selectedPageId, col))
    ]);

    if (allToReset.size > 0) {
      const tasks = Array.from(allToReset).map(colName =>
        updateMutation.mutateAsync({ pageId: selectedPageId, colName, isHidden: false })
      );
      await Promise.all(tasks);
      toast.success(`Reset ${currentTable.pageName} columns to default (Show All)`);
    } else {
      toast.success('All columns are already showing');
    }
  };

  const handleAddCustomColumn = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newFieldName.trim();
    if (!trimmed) {
      toast.error('Please enter a field name');
      return;
    }

    const existingCols = getColumnsForTable(modalTargetPageId);
    if (existingCols.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      const targetName = TABLE_COLUMNS_CONFIG.find(p => p.pageId === modalTargetPageId)?.pageName || modalTargetPageId;
      toast.error(`"${trimmed}" already exists in ${targetName}`);
      return;
    }

    const updatedTargetList = [...(customColumns[modalTargetPageId] || []), trimmed];
    const updated = {
      ...customColumns,
      [modalTargetPageId]: updatedTargetList,
    };
    setCustomColumns(updated);
    try {
      localStorage.setItem('insumitra_custom_table_columns', JSON.stringify(updated));
    } catch {}

    // Persist to backend visibility rule
    updateMutation.mutate({
      pageId: modalTargetPageId,
      colName: trimmed,
      isHidden: !isFieldVisible,
    });

    if (selectedPageId !== modalTargetPageId) {
      setSelectedPageId(modalTargetPageId);
    }

    setShowAddColumnModal(false);
    setNewFieldName('');
    const targetName = TABLE_COLUMNS_CONFIG.find(p => p.pageId === modalTargetPageId)?.pageName || modalTargetPageId;
    toast.success(`Field "${trimmed}" added to ${targetName}`);
  };

  const handleDeleteCustomColumn = (colName: string) => {
    const updatedList = (customColumns[selectedPageId] || []).filter(c => c !== colName);
    const updated = {
      ...customColumns,
      [selectedPageId]: updatedList,
    };
    setCustomColumns(updated);
    try {
      localStorage.setItem('insumitra_custom_table_columns', JSON.stringify(updated));
    } catch {}
    toast.success(`Custom field "${colName}" removed`);
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-500 font-semibold text-xs flex items-center justify-center gap-2">
        <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
        Loading Column Visibility Settings...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb Header */}
      {!hideHeader && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            {onBack ? (
              <button onClick={onBack} className="hover:text-primary-600 transition-colors flex items-center gap-1 cursor-pointer">
                <ArrowLeft size={13} /> Master Settings & Backups
              </button>
            ) : null}
            {onBack && <span>&gt;</span>}
            <span className="text-slate-800">Table Column Visibility</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight mt-2">Column Visibility Configuration</h2>
          <p className="text-xs text-slate-500 font-semibold leading-tight mt-0.5">Control which table columns to show or hide globally across different modules, or add new custom fields.</p>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Navigation for Tables */}
        <div className="w-full md:w-64 shrink-0 flex flex-col gap-2 border-r border-slate-200 pr-4">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Available Tables</h4>
            <span className="text-[11px] font-bold text-slate-400">{TABLE_COLUMNS_CONFIG.length}</span>
          </div>

          {/* Search tables input */}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter tables..."
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="w-full border border-slate-200 rounded-xl pl-7 pr-3 py-1.5 text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div className="flex flex-col gap-1 max-h-[600px] overflow-y-auto pr-1">
            {filteredTables.map(config => {
              const tableCols = getColumnsForTable(config.pageId);
              const hiddenNum = tableCols.filter(col => getIsHidden(config.pageId, col)).length;
              const isSelected = selectedPageId === config.pageId;

              return (
                <button
                  key={config.pageId}
                  onClick={() => {
                    setSelectedPageId(config.pageId);
                    setColumnSearch('');
                  }}
                  className={`text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-primary-50 text-primary-700 shadow-2xs font-bold border border-primary-200/60'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{config.pageName}</span>
                  {hiddenNum > 0 ? (
                    <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200/50">
                      {hiddenNum} hidden
                    </span>
                  ) : (
                    <span className="shrink-0 text-[10px] text-slate-400 font-medium">
                      {tableCols.length}
                    </span>
                  )}
                </button>
              );
            })}
            {filteredTables.length === 0 && (
              <div className="text-xs text-slate-400 py-4 text-center">No tables found</div>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 space-y-4">
          {/* Top Bar for Selected Table */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between pb-1">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900">
                  Columns for {currentTable.pageName}
                </h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">
                  {showingCountForCurrentTable} Showing • {hiddenCountForCurrentTable} Hidden
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Toggle switches to hide or display specific columns in this module</p>
            </div>

            {/* Bulk Action Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => {
                  setModalTargetPageId(selectedPageId);
                  setNewFieldName('');
                  setIsFieldVisible(true);
                  setShowAddColumnModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold transition-all cursor-pointer shadow-3xs"
                title={`Add new field to ${currentTable.pageName}`}
              >
                <Plus size={13} />
                <span>Add Field</span>
              </button>
              <button
                onClick={handleShowAll}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all cursor-pointer shadow-3xs"
                title="Show all columns"
              >
                <Eye size={12} className="text-emerald-600" />
                <span>Show All</span>
              </button>
              <button
                onClick={handleHideAll}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all cursor-pointer shadow-3xs"
                title="Hide non-primary columns"
              >
                <EyeOff size={12} className="text-rose-600" />
                <span>Hide All</span>
              </button>
              <button 
                onClick={handleReset}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all cursor-pointer shadow-3xs"
                title="Reset columns to default"
              >
                <RotateCcw size={12} />
                <span>Reset (Show All)</span>
              </button>
            </div>
          </div>

          {/* Search Columns Bar */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={`Search columns in ${currentTable.pageName}...`}
              value={columnSearch}
              onChange={(e) => setColumnSearch(e.target.value)}
              className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:ring-1 focus:ring-primary-500 bg-white shadow-3xs"
            />
          </div>

          {/* Columns Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Column Name</th>
                  <th className="px-5 py-3 text-center w-32">Status</th>
                  <th className="px-5 py-3 text-right w-28">Visibility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredColumns.map((col) => {
                  const isHidden = getIsHidden(selectedPageId, col);
                  const isCustom = isCustomColumn(selectedPageId, col);
                  return (
                    <tr 
                      key={col} 
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                      onClick={() => handleToggle(col)}
                    >
                      <td className="px-5 py-3.5 font-bold text-slate-800">
                        <div className="flex items-center gap-2">
                          <span>{col}</span>
                          {isCustom && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                              Custom Field
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                          !isHidden 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' 
                            : 'bg-rose-50 text-rose-700 border border-rose-200/50'
                        }`}>
                          {!isHidden ? 'Showing' : 'Hidden'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggle(col)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              !isHidden ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}
                            title={`Click to ${!isHidden ? 'hide' : 'show'} ${col}`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                                !isHidden ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          {isCustom && (
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomColumn(col)}
                              className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title={`Remove custom field "${col}"`}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredColumns.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-slate-400 font-medium">
                      No columns match "{columnSearch}".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Footer Summary */}
            <div className="bg-slate-50/50 border-t border-slate-150 px-5 py-2.5 flex items-center justify-between text-slate-500 font-semibold text-[11px]">
              <span>Showing {filteredColumns.length} of {currentTableColumns.length} columns</span>
              <span className="text-slate-400">Click any row or toggle switch to change visibility</span>
            </div>
          </div>
        </div>
      </div>

      {/* --- ADD FIELD / COLUMN MODAL --- */}
      {showAddColumnModal && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl animate-fadeIn">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-950 uppercase tracking-wide">Add New Field / Column</h3>
                <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                  Add a customizable column to the selected table section
                </p>
              </div>
              <button 
                onClick={() => setShowAddColumnModal(false)} 
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddCustomColumn} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                  Target Section / Table
                </label>
                <select 
                  value={modalTargetPageId}
                  onChange={(e) => setModalTargetPageId(e.target.value)}
                  className="w-full border border-slate-250 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-primary-500 bg-white"
                >
                  {TABLE_COLUMNS_CONFIG.map(cfg => (
                    <option key={cfg.pageId} value={cfg.pageId}>
                      {cfg.pageName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                  Field / Column Name
                </label>
                <input 
                  type="text"
                  placeholder="e.g., Aadhaar Number, Policy Term, Nominee Age"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  autoFocus
                  className="w-full border border-slate-250 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center gap-2.5 py-1">
                <input 
                  type="checkbox"
                  id="initialVisibility"
                  checked={isFieldVisible}
                  onChange={(e) => setIsFieldVisible(e.target.checked)}
                  className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-slate-300 cursor-pointer"
                />
                <label htmlFor="initialVisibility" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Show column by default in table view
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddColumnModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-primary-600 hover:bg-primary-700 text-white transition-all cursor-pointer shadow-3xs"
                >
                  Add Field
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

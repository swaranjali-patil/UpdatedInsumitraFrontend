import React, { useState } from 'react';
import { Eye } from 'lucide-react';
import ShiftCheckoutModal from '@comps/layout/ShiftCheckoutModal';

interface WorkspaceHeaderProps {
  selectedEmployeeUserId?: string | null;
  selectedEmployeeObj?: any;
  activeLogToday?: any;
  refetch: () => void;
}

export default function WorkspaceHeader({
  selectedEmployeeUserId,
  selectedEmployeeObj,
  activeLogToday,
  refetch
}: WorkspaceHeaderProps) {
  const [nextDayPlan, setNextDayPlan] = useState(activeLogToday?.nextDayPlan || '');
  const [notes, setNotes] = useState(activeLogToday?.notes || '');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  // Sync state if activeLogToday changes
  React.useEffect(() => {
    if (activeLogToday) {
      setNextDayPlan(activeLogToday.nextDayPlan || '');
      setNotes(activeLogToday.notes || '');
    }
  }, [activeLogToday]);

  const isClockedIn = !!activeLogToday?.checkIn && !activeLogToday?.checkOut;
  const isClockedOut = !!activeLogToday?.checkIn && !!activeLogToday?.checkOut;
  const isViewOnly = !!selectedEmployeeUserId;

  return (
    <div className="space-y-4">
      {/* View Only Banner (when inspecting another employee's workspace) */}
      {isViewOnly && selectedEmployeeObj && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl p-3.5 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900">
                Viewing {selectedEmployeeObj.firstName} {selectedEmployeeObj.lastName}'s Workspace (Read Only)
              </h4>
              <p className="text-[11px] text-amber-700">
                Shift status: {isClockedOut ? 'Shift Ended' : isClockedIn ? 'Active Now' : 'Not Clocked In'}
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-amber-200 text-amber-900 text-[10px] font-extrabold uppercase tracking-wider">
            Supervisor View
          </span>
        </div>
      )}



      {/* Mandatory Handover Checkout Modal */}
      <ShiftCheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        initialNotes={notes}
        initialNextDayPlan={nextDayPlan}
        isLogoutAction={false}
        onSuccess={() => refetch()}
      />
    </div>
  );
}

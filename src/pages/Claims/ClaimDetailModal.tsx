import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { claimsService } from '@api/index';
import Modal from '@comps/common/Modal';
import { ClaimDetailView, ClaimEditForm } from './index';
import { useLookupStore } from '@store/lookup.store';
import toast from 'react-hot-toast';

interface Props {
  open?: boolean;
  claim?: any | null;
  claimId?: string | null;
  onClose: () => void;
  zIndexClass?: string;
  defaultEdit?: boolean;
}

export default function ClaimDetailModal({ open = true, claim, claimId: propClaimId, onClose, zIndexClass = 'z-[70]', defaultEdit = false }: Props) {
  const [isEditing, setIsEditing] = useState(defaultEdit);
  const qc = useQueryClient();
  const employees = useLookupStore(s => s.employees);
  const claimId = propClaimId || claim?.id;

  useEffect(() => {
    setIsEditing(defaultEdit);
  }, [open, defaultEdit, claimId]);

  const { data: fullClaimRes } = useQuery({
    queryKey: ['claim-detail-modal', claimId],
    queryFn: () => claimsService.get(claimId!),
    enabled: open && !!claimId,
    staleTime: 30000,
  });

  const updateClaimMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => claimsService.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['claims'] });
      qc.invalidateQueries({ queryKey: ['claim-detail-modal', claimId] });
      qc.invalidateQueries({ queryKey: ['contact-activity'] });
      qc.invalidateQueries({ queryKey: ['contact-claims'] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['policies'] });
      toast.success('Claim updated successfully');
      setIsEditing(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed to update claim'),
  });

  if (!open || (!claim && !fullClaimRes)) return null;

  const displayClaim = fullClaimRes?.data || fullClaimRes || claim;

  return (
    <>
      <Modal
        open={open && !isEditing}
        onClose={onClose}
        closeOnEscapeAndBackdrop={false}
        title="Claim Details"
        subtitle={displayClaim?.claimNumber || undefined}
        size="2xl"
        zIndexClass={zIndexClass}
      >
        <div className="max-h-[80vh] overflow-y-auto custom-scrollbar py-2 px-1">
          <ClaimDetailView claim={displayClaim} onEdit={() => setIsEditing(true)} />
        </div>
      </Modal>

      {open && isEditing && (
        <ClaimEditForm
          initial={displayClaim}
          isPending={updateClaimMutation.isPending}
          onSave={body => updateClaimMutation.mutate({ id: displayClaim.id, body })}
          onCancel={() => {
            if (defaultEdit) {
              onClose();
            } else {
              setIsEditing(false);
            }
          }}
          employees={employees}
          zIndexClass={zIndexClass}
        />
      )}
    </>
  );
}

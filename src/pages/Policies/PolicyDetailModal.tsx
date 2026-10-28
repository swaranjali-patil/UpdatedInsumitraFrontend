import CreatePolicyModal from './CreatePolicyModal';

interface Props {
  open: boolean;
  policyId: string | null;
  onClose: () => void;
}

export default function PolicyDetailModal({ open, policyId, onClose }: Props) {
  if (!open || !policyId) return null;
  return (
    <CreatePolicyModal
      open={open}
      policyId={policyId}
      onClose={onClose}
    />
  );
}

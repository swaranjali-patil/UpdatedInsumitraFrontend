import Policies from './index';

interface PolicyDetailProps {
  policyId?: string;
  onClose?: () => void;
  isModal?: boolean;
}

export default function PolicyDetail(_props: PolicyDetailProps = {}) {
  return <Policies />;
}

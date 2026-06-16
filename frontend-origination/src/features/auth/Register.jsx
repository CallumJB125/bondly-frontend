// Register redirects to Login with register tab pre-selected, preserving ?ref= param
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function Register() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const ref    = params.get('ref');
  const intent = params.get('intent');
  useEffect(() => {
    navigate('/login', { state: { tab: 'register', referralCode: ref || undefined, intent: intent || undefined } });
  }, []);
  return null;
}

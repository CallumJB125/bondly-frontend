import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  locationState: { tab: 'login' },
  login: vi.fn(),
  register: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ to, children }) => <a href={to}>{children}</a>,
  Navigate: () => null,
  useNavigate: () => mocks.navigate,
  useLocation: () => ({ state: mocks.locationState, search: '', pathname: '/login' }),
}));

vi.mock('../../../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    login: mocks.login,
    register: mocks.register,
    isLoggedIn: false,
    isAdmin: false,
  }),
}));

vi.mock('@bondly/ui/components/Toast.jsx', () => ({ useToast: () => vi.fn() }));
vi.mock('@bondly/ui/lib/session.js', () => ({ trackAction: vi.fn() }));
vi.mock('lucide-react', () => ({ Mail: () => null, CheckCircle: () => null }));
vi.mock('@bondly/ui/components/Button.jsx', () => ({
  default: ({ children, loading, full, variant, ...p }) => <button {...p}>{children}</button>,
}));
vi.mock('@bondly/ui/components/Input.jsx', () => ({
  default: ({ label, id, ...p }) => (
    <div>
      <label htmlFor={id}>{label}</label>
      <input id={id} {...p} />
    </div>
  ),
}));

import Login from '../Login.jsx';

describe('Login — post-auth redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.locationState = { tab: 'login' };
    sessionStorage.clear();
  });

  async function submitLogin() {
    render(<Login />);
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i, { selector: 'input' }), { target: { value: 'pass1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalled());
  }

  async function submitRegister() {
    render(<Login />);
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Jane Smith' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i, { selector: 'input' }), { target: { value: 'pass1234' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalled());
  }

  it('normal login → /dashboard', async () => {
    mocks.login.mockResolvedValue({ user: { emailVerified: true }, role: 'user' });
    await submitLogin();
    expect(mocks.navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('login with optimizer_pending → /optimize', async () => {
    sessionStorage.setItem('bondly_optimizer_pending', '1');
    mocks.login.mockResolvedValue({ user: { emailVerified: true }, role: 'user' });
    await submitLogin();
    expect(mocks.navigate).toHaveBeenCalledWith('/optimize');
  });

  it('login with intent=switch → /switch', async () => {
    mocks.locationState = { tab: 'login', intent: 'switch' };
    mocks.login.mockResolvedValue({ user: { emailVerified: true }, role: 'user' });
    await submitLogin();
    expect(mocks.navigate).toHaveBeenCalledWith('/switch');
  });

  it('login with optimizer_pending + intent=switch → /optimize (optimizer wins)', async () => {
    sessionStorage.setItem('bondly_optimizer_pending', '1');
    mocks.locationState = { tab: 'login', intent: 'switch' };
    mocks.login.mockResolvedValue({ user: { emailVerified: true }, role: 'user' });
    await submitLogin();
    expect(mocks.navigate).toHaveBeenCalledWith('/optimize');
  });

  it('register → /preapproval', async () => {
    mocks.locationState = { tab: 'register' };
    mocks.register.mockResolvedValue({});
    await submitRegister();
    expect(mocks.navigate).toHaveBeenCalledWith('/preapproval');
  });

  it('register with intent=switch → /switch', async () => {
    mocks.locationState = { tab: 'register', intent: 'switch' };
    mocks.register.mockResolvedValue({});
    await submitRegister();
    expect(mocks.navigate).toHaveBeenCalledWith('/switch');
  });

  it('register with optimizer_pending → /optimize', async () => {
    sessionStorage.setItem('bondly_optimizer_pending', '1');
    mocks.locationState = { tab: 'register' };
    mocks.register.mockResolvedValue({});
    await submitRegister();
    expect(mocks.navigate).toHaveBeenCalledWith('/optimize');
  });
});

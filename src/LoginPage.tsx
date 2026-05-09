import { useEffect, useMemo, useState } from 'react';
import { fetchSignInMethodsForEmail } from 'firebase/auth';
import { collection, doc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import isEmail from 'validator/lib/isEmail';
import { useAuth } from './AuthContext';
import { auth, db } from './firebase';
import {
  Eye, EyeOff, Mail, Lock, User, AlertCircle, CheckCircle2,
  Shield, Zap, Key, ArrowLeft, Check, X, AlertTriangle
} from 'lucide-react';

interface LoginPageProps {
  onBack: () => void;
}

const ADMIN_PASS_KEY = 'kellyseekhelp-admin-2026';
const DEFAULT_MANAGER_KEY = 'Dniyibizi123@';

// ─── Validation Rules ───
interface ValidationRule {
  label: string;
  test: (v: string) => boolean;
}

const passwordRules: ValidationRule[] = [
  { label: 'At least 8 characters', test: v => v.length >= 8 },
  { label: 'One uppercase letter (A-Z)', test: v => /[A-Z]/.test(v) },
  { label: 'One lowercase letter (a-z)', test: v => /[a-z]/.test(v) },
  { label: 'One number (0-9)', test: v => /[0-9]/.test(v) },
  { label: 'One special character (!@#$...)', test: v => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(v) },
];

type EmailCheckStatus = 'idle' | 'invalid' | 'checking' | 'available' | 'exists' | 'not-found' | 'unknown';

const blockedDomains = new Set([
  'example.com', 'example.net', 'example.org', 'test.com', 'test.net', 'test.org',
  'fake.com', 'fakeemail.com', 'noemail.com', 'none.com', 'invalid.com', 'domain.com',
  'localhost.com', 'asdf.com', 'qwerty.com', 'abc.com', 'aaa.com', 'mailinator.com',
  'yopmail.com', 'tempmail.com', 'temp-mail.org', '10minutemail.com', 'guerrillamail.com',
  'throwawaymail.com', 'trashmail.com', 'getnada.com', 'sharklasers.com', 'dispostable.com',
]);

const commonTypos: Record<string, string> = {
  'gmai.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.co': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'yaho.com': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'outlok.com': 'outlook.com',
  'outlook.con': 'outlook.com',
};

const trustedTlds = new Set([
  'com', 'net', 'org', 'rw', 'co', 'io', 'app', 'dev', 'ai', 'edu', 'gov', 'info',
  'biz', 'me', 'tech', 'site', 'online', 'store', 'cloud', 'agency', 'studio', 'africa',
  'uk', 'us', 'ca', 'de', 'fr', 'nl', 'au', 'in', 'ke', 'ug', 'tz', 'za',
]);

function validateEmailQuality(value: string) {
  const email = value.trim().toLowerCase();
  if (!email) return { valid: false, reason: '', warning: '' };
  if (!isEmail(email, { require_tld: true, allow_utf8_local_part: false, allow_ip_domain: false })) {
    return { valid: false, reason: 'Enter a valid email like name@example.com.', warning: '' };
  }

  const [local, domain] = email.split('@');
  const parts = domain.split('.');
  const tld = parts.at(-1) || '';

  if (local.length < 2) return { valid: false, reason: 'Email name is too short.', warning: '' };
  if (/\.\./.test(email)) return { valid: false, reason: 'Email cannot contain two dots together.', warning: '' };
  if (/^[0-9]+$/.test(local)) return { valid: false, reason: 'Email name cannot be only numbers.', warning: '' };
  if (blockedDomains.has(domain)) return { valid: false, reason: 'Temporary, fake, or test email domains are not allowed.', warning: '' };
  if (commonTypos[domain]) return { valid: false, reason: `Did you mean ${local}@${commonTypos[domain]}?`, warning: '' };
  if (parts.some(part => part.length < 2 || part.startsWith('-') || part.endsWith('-'))) {
    return { valid: false, reason: 'Email domain looks invalid.', warning: '' };
  }
  if (!trustedTlds.has(tld)) {
    return {
      valid: false,
      reason: `The .${tld} email ending is not accepted. Use a trusted email domain.`,
      warning: '',
    };
  }

  return {
    valid: true,
    reason: '',
    warning: 'Format and domain checks passed.',
  };
}

export default function LoginPage({ onBack }: LoginPageProps) {
  const { signUpWithEmail, signInWithEmail } = useAuth();
  const [role, setRole] = useState<'user' | 'admin' | 'manager'>('user');
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [passKey, setPassKey] = useState('');
  const [managerKey, setManagerKey] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [passFocused, setPassFocused] = useState(false);
  const [emailStatus, setEmailStatus] = useState<EmailCheckStatus>('idle');
  const [emailMethods, setEmailMethods] = useState<string[]>([]);

  // ─── Live Validation ───
  const emailQuality = useMemo(() => validateEmailQuality(email), [email]);
  const emailValid = emailQuality.valid;
  const nameValid = useMemo(() => name.trim().length >= 2 && /^[a-zA-Z\s'-]+$/.test(name.trim()), [name]);
  const passResults = useMemo(() => passwordRules.map(r => ({ ...r, passed: r.test(password) })), [password]);
  const passStrength = useMemo(() => passResults.filter(r => r.passed).length, [passResults]);
  const passValid = passStrength === passwordRules.length;
  const confirmValid = password === confirmPassword && confirmPassword.length > 0;
  const signupValid = nameValid && emailValid && emailStatus !== 'checking' && emailStatus !== 'exists' && passValid && confirmValid && agreedTerms;

  useEffect(() => {
    const cleanEmail = email.trim().toLowerCase();
    setEmailMethods([]);
    if (!cleanEmail) {
      setEmailStatus('idle');
      return;
    }
    const quality = validateEmailQuality(cleanEmail);
    if (!quality.valid) {
      setEmailStatus('invalid');
      return;
    }

    setEmailStatus('checking');
    const timer = window.setTimeout(async () => {
      try {
        const methods = await fetchSignInMethodsForEmail(auth, cleanEmail);
        setEmailMethods(methods);
        if (isSignup) {
          setEmailStatus(methods.length > 0 ? 'exists' : 'available');
        } else {
          setEmailStatus(methods.length > 0 ? 'exists' : 'not-found');
        }
      } catch {
        setEmailStatus('unknown');
      }
    }, 600);

    return () => window.clearTimeout(timer);
  }, [email, isSignup]);

  const strengthColor = passStrength <= 1 ? 'bg-red-500' : passStrength <= 2 ? 'bg-orange-500' : passStrength <= 3 ? 'bg-yellow-500' : passStrength <= 4 ? 'bg-blue-500' : 'bg-green-500';
  const strengthLabel = passStrength <= 1 ? 'Very Weak' : passStrength <= 2 ? 'Weak' : passStrength <= 3 ? 'Fair' : passStrength <= 4 ? 'Strong' : 'Excellent';
  const strengthTextColor = passStrength <= 1 ? 'text-red-400' : passStrength <= 2 ? 'text-orange-400' : passStrength <= 3 ? 'text-yellow-400' : passStrength <= 4 ? 'text-blue-400' : 'text-green-400';

  // ─── Handlers ───
  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!emailValid) { setError(emailQuality.reason || 'Please enter a valid email address.'); return; }
    if (isSignup && !signupValid) { setError('Please fix all validation errors before submitting.'); return; }
    setLoading(true);
    try {
      if (isSignup) {
        localStorage.setItem('webcraftRoleChoice', 'user');
        await signUpWithEmail(email, password, name.trim());
        setSuccess('Account created successfully! You can now use your dashboard.');
      } else {
        localStorage.setItem('webcraftRoleChoice', 'user');
        await signInWithEmail(email, password);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      if (msg.includes('auth/email-already-in-use')) setError('This email is already registered. Try signing in instead.');
      else if (msg.includes('auth/invalid-credential')) setError('Incorrect email or password. Please try again.');
      else if (msg.includes('auth/invalid-email')) setError('Please enter a valid email address.');
      else if (msg.includes('auth/user-not-found')) setError('No account found with this email. Please sign up first.');
      else if (msg.includes('auth/too-many-requests')) setError('Too many attempts. Please wait a moment and try again.');
      else if (msg.includes('auth/weak-password')) setError('Password is too weak. Please choose a stronger password.');
      else if (msg.includes('auth/network-request-failed')) setError('Network error. Please check your internet connection.');
      else setError(msg);
    }
    setLoading(false);
  };

  const handleAdminLogin = async () => {
    setError('');
    if (!email || !password) { setError('Admin email and password are required.'); return; }
    const trimmedKey = passKey.trim();
    const isStaticKey = trimmedKey === ADMIN_PASS_KEY;
    let inviteRef: Awaited<ReturnType<typeof getDocs>>['docs'][number]['ref'] | null = null;

    if (!isStaticKey) {
      try {
        const snap = await getDocs(query(collection(db, 'inviteLinks'), where('code', '==', trimmedKey), where('used', '==', false)));
        const docSnap = snap.docs.find(d => d.data().role === 'admin' || d.data().type === 'admin-passkey');
        inviteRef = docSnap?.ref || null;
      } catch {
        inviteRef = null;
      }
    }

    if (!isStaticKey && !inviteRef) { setError('Invalid admin pass key. Contact the manager for a valid kelly- passkey.'); return; }
    setLoading(true);
    try {
      localStorage.setItem('webcraftRoleChoice', 'admin');
      const credential = await signInWithEmail(email, password);
      await setDoc(doc(db, 'users', credential.user.uid), {
        uid: credential.user.uid,
        email: credential.user.email || email,
        displayName: credential.user.displayName || 'Admin',
        role: 'admin',
        photoURL: credential.user.photoURL || null,
        createdAt: new Date().toISOString(),
        emailVerified: true,
        status: 'active',
      }, { merge: true });
      if (inviteRef) await updateDoc(inviteRef, { used: true, usedBy: credential.user.uid, usedAt: new Date().toISOString() });
    }
    catch { setError('Admin login failed. Check the admin email, password, and passkey, then try again.'); }
    setLoading(false);
  };

  const handleManagerLogin = async () => {
    setError('');
    const savedManagerKey = localStorage.getItem('webcraftManagerKey') || DEFAULT_MANAGER_KEY;
    if (managerKey !== savedManagerKey) { setError('Invalid manager key. Contact the system administrator.'); return; }
    if (!email || !password) { setError('Email and password are required.'); return; }
    setLoading(true);
    try {
      localStorage.setItem('webcraftRoleChoice', 'manager');
      const credential = await signInWithEmail(email, password);
      await setDoc(doc(db, 'users', credential.user.uid), {
        uid: credential.user.uid,
        email: credential.user.email || email,
        displayName: credential.user.displayName || 'Manager',
        role: 'manager',
        photoURL: credential.user.photoURL || null,
        createdAt: new Date().toISOString(),
        emailVerified: true,
        status: 'active',
      }, { merge: true });
    }
    catch { setError('Invalid credentials or account not found. Make sure your manager account has been created.'); }
    setLoading(false);
  };

  const switchRole = (r: 'user' | 'admin' | 'manager') => {
    setRole(r); setError(''); setSuccess('');
  };

  const switchMode = (signup: boolean) => {
    setIsSignup(signup); setError(''); setSuccess('');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4 bg-mesh relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-green-500/8 rounded-full blur-[120px] animate-float" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-emerald-500/5 rounded-full blur-[150px] animate-float-delay" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-green-500/3 rounded-full blur-[200px]" />

      <div className="w-full max-w-md relative z-10">
        {/* Back */}
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-green-400 transition-all mb-6 text-sm group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to site
        </button>

        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center green-glow">
            <span className="text-white font-bold text-xl">W</span>
          </div>
          <div>
            <h1 className="text-xl font-bold">WebCraft</h1>
            <p className="text-xs text-gray-400">
              {role === 'user' ? (isSignup ? 'Create your account' : 'Sign in to your account') : role === 'admin' ? 'Admin Access Portal' : 'Manager Access Portal'}
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="glass-strong rounded-2xl p-6 sm:p-8">
          {/* ═══ Role Tabs ═══ */}
          <div className="flex gap-1.5 mb-6 p-1 rounded-xl bg-white/5">
            {([
              { id: 'user' as const, label: 'User', icon: User, activeColor: 'bg-green-500/20 text-green-400' },
              { id: 'admin' as const, label: 'Admin', icon: Shield, activeColor: 'bg-red-500/20 text-red-400' },
              { id: 'manager' as const, label: 'Manager', icon: Key, activeColor: 'bg-yellow-500/20 text-yellow-400' },
            ]).map(r => (
              <button key={r.id} onClick={() => switchRole(r.id)} className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${role === r.id ? r.activeColor : 'text-gray-500 hover:text-gray-300'}`}>
                <r.icon size={13} />{r.label}
              </button>
            ))}
          </div>

          {/* Alerts */}
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2.5 text-sm text-red-300 animate-[fadeIn_0.3s_ease]">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
            </div>
          )}
          {success && (
            <div className="mb-5 p-3 rounded-xl bg-green-500/10 border border-green-500/20 flex items-start gap-2.5 text-sm text-green-300 animate-[fadeIn_0.3s_ease]">
              <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" /><span>{success}</span>
            </div>
          )}

          {/* ═══════════════════════════════════════ */}
          {/* ═══         USER LOGIN/SIGNUP       ═══ */}
          {/* ═══════════════════════════════════════ */}
          {role === 'user' && (
            <>
              {/* Sign In / Sign Up toggle */}
              <div className="flex gap-1 mb-5 p-0.5 rounded-lg bg-white/5">
                <button onClick={() => switchMode(false)} className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all ${!isSignup ? 'bg-green-500/20 text-green-400' : 'text-gray-400 hover:text-gray-200'}`}>Sign In</button>
                <button onClick={() => switchMode(true)} className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all ${isSignup ? 'bg-green-500/20 text-green-400' : 'text-gray-400 hover:text-gray-200'}`}>Sign Up</button>
              </div>

              <form onSubmit={handleUserSubmit} className="space-y-3.5">
                {/* Full Name (signup only) */}
                {isSignup && (
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 flex items-center gap-1.5"><User size={12} />Full Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. John Doe" required
                      className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white placeholder-gray-500 focus:outline-none focus:ring-1 transition-all text-sm ${name && !nameValid ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/30' : name && nameValid ? 'border-green-500/50 focus:border-green-500 focus:ring-green-500/30' : 'border-white/10 focus:border-green-500/50 focus:ring-green-500/30'}`} />
                    {name && !nameValid && <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1"><AlertTriangle size={10} />Name must be at least 2 characters, letters only</p>}
                    {name && nameValid && <p className="text-[10px] text-green-400 mt-1 flex items-center gap-1"><Check size={10} />Looks good!</p>}
                  </div>
                )}

                {/* Email */}
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 flex items-center gap-1.5"><Mail size={12} />Email Address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required
                    className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white placeholder-gray-500 focus:outline-none focus:ring-1 transition-all text-sm ${email && !emailValid ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/30' : email && emailValid ? 'border-green-500/50 focus:border-green-500 focus:ring-green-500/30' : 'border-white/10 focus:border-green-500/50 focus:ring-green-500/30'}`} />
                  {email && !emailValid && <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1"><AlertTriangle size={10} />{emailQuality.reason || 'Please enter a valid email address'}</p>}
                  {emailValid && emailStatus === 'checking' && <p className="text-[10px] text-blue-400 mt-1 flex items-center gap-1"><span className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />Checking email in realtime...</p>}
                  {emailValid && isSignup && emailStatus === 'available' && <p className="text-[10px] text-green-400 mt-1 flex items-center gap-1"><Check size={10} />Email can be used.</p>}
                  {emailValid && isSignup && emailStatus === 'exists' && <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1"><X size={10} />This email is already registered. Please sign in.</p>}
                  {emailValid && !isSignup && emailStatus === 'exists' && <p className="text-[10px] text-green-400 mt-1 flex items-center gap-1"><Check size={10} />Account found{emailMethods.length ? ` (${emailMethods.join(', ')})` : ''}</p>}
                  {emailValid && !isSignup && emailStatus === 'not-found' && <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1"><AlertTriangle size={10} />No account found yet. You can create one.</p>}
                  {emailValid && emailStatus === 'unknown' && <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1"><AlertCircle size={10} />Could not check account status, but format is valid.</p>}
                  {emailValid && emailQuality.warning && emailStatus !== 'checking' && <p className="text-[10px] text-gray-500 mt-1 flex items-start gap-1"><AlertCircle size={10} className="mt-0.5 flex-shrink-0" />{emailQuality.warning}</p>}
                </div>

                {/* Password */}
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 flex items-center gap-1.5"><Lock size={12} />Password</label>
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder={isSignup ? 'Create a strong password' : 'Enter your password'} required
                      onFocus={() => setPassFocused(true)} onBlur={() => setPassFocused(false)}
                      className={`w-full px-4 py-3 pr-10 rounded-xl bg-white/5 border text-white placeholder-gray-500 focus:outline-none focus:ring-1 transition-all text-sm ${password && !passValid && isSignup ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/30' : password && passValid && isSignup ? 'border-green-500/50 focus:border-green-500 focus:ring-green-500/30' : 'border-white/10 focus:border-green-500/50 focus:ring-green-500/30'}`} />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">{showPass ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  </div>

                  {/* Password Strength (signup only) */}
                  {isSignup && password.length > 0 && (
                    <div className="mt-2.5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-gray-400">Password strength</span>
                        <span className={`text-[10px] font-semibold ${strengthTextColor}`}>{strengthLabel}</span>
                      </div>
                      <div className="flex gap-1 mb-2.5">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= passStrength ? strengthColor : 'bg-white/10'}`} />
                        ))}
                      </div>
                      {(passFocused || passStrength < 5) && (
                        <div className="space-y-1">
                          {passResults.map((r, i) => (
                            <div key={i} className={`flex items-center gap-1.5 text-[10px] transition-all ${r.passed ? 'text-green-400' : 'text-gray-500'}`}>
                              {r.passed ? <Check size={10} /> : <X size={10} />} {r.label}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Confirm Password (signup only) */}
                {isSignup && (
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 flex items-center gap-1.5"><Lock size={12} />Confirm Password</label>
                    <div className="relative">
                      <input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" required
                        className={`w-full px-4 py-3 pr-10 rounded-xl bg-white/5 border text-white placeholder-gray-500 focus:outline-none focus:ring-1 transition-all text-sm ${confirmPassword && !confirmValid ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/30' : confirmPassword && confirmValid ? 'border-green-500/50 focus:border-green-500 focus:ring-green-500/30' : 'border-white/10 focus:border-green-500/50 focus:ring-green-500/30'}`} />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">{showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                    </div>
                    {confirmPassword && !confirmValid && <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1"><AlertTriangle size={10} />Passwords do not match</p>}
                    {confirmPassword && confirmValid && <p className="text-[10px] text-green-400 mt-1 flex items-center gap-1"><Check size={10} />Passwords match</p>}
                  </div>
                )}

                {/* Terms (signup only) */}
                {isSignup && (
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${agreedTerms ? 'bg-green-500 border-green-500' : 'border-white/20 group-hover:border-white/40'}`} onClick={() => setAgreedTerms(!agreedTerms)}>
                      {agreedTerms && <Check size={10} className="text-white" />}
                    </div>
                    <span className="text-[11px] text-gray-400 leading-relaxed">
                      I agree to the <span className="text-green-400 hover:underline cursor-pointer">Terms of Service</span> and <span className="text-green-400 hover:underline cursor-pointer">Privacy Policy</span>.
                    </span>
                  </label>
                )}

                {/* Submit */}
                <button type="submit" disabled={loading || (isSignup && !signupValid)} className="btn-primary w-full py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                  {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>{isSignup ? 'Create Account' : 'Sign In'} <Zap size={14} /></>}
                </button>
              </form>

              {isSignup && (
                <div className="mt-4 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                  <p className="text-[10px] text-blue-300/70 flex items-start gap-2"><AlertCircle size={12} className="flex-shrink-0 mt-0.5" />Use a real email and strong password so you can recover your account later.</p>
                </div>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════ */}
          {/* ═══          ADMIN LOGIN            ═══ */}
          {/* ═══════════════════════════════════════ */}
          {role === 'admin' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                <p className="text-xs text-red-300/70 flex items-start gap-2"><Shield size={12} className="flex-shrink-0 mt-0.5 text-red-400" />Admin access requires email, password, and a manager-generated passkey.</p>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 flex items-center gap-1.5"><Mail size={12} />Admin Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@example.com"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/30 transition-all text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 flex items-center gap-1.5"><Lock size={12} />Admin Password</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Admin account password"
                    className="w-full px-4 py-3 pr-10 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/30 transition-all text-sm" />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">{showPass ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 flex items-center gap-1.5"><Lock size={12} />Admin Pass Key</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={passKey} onChange={e => setPassKey(e.target.value)} placeholder="Enter admin pass key"
                    className="w-full px-4 py-3 pr-10 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/30 transition-all text-sm"
                    onKeyDown={e => e.key === 'Enter' && handleAdminLogin()} />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">{showPass ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>
              <button onClick={handleAdminLogin} disabled={loading || !passKey || !email || !password} className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 bg-gradient-to-r from-red-500 to-rose-600 hover:shadow-lg hover:shadow-red-500/20 hover:-translate-y-0.5 transition-all text-white">
                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Shield size={14} /> Access as Admin</>}
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════ */}
          {/* ═══         MANAGER LOGIN           ═══ */}
          {/* ═══════════════════════════════════════ */}
          {role === 'manager' && (
            <div className="space-y-3.5">
              <div className="p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
                <p className="text-xs text-yellow-300/70 flex items-start gap-2"><Key size={12} className="flex-shrink-0 mt-0.5 text-yellow-400" />Manager access requires your registered email, password, and the manager key provided by the system administrator.</p>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 flex items-center gap-1.5"><Mail size={12} />Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="manager@webcraft.rw"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-yellow-500/50 focus:outline-none focus:ring-1 focus:ring-yellow-500/30 transition-all text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 flex items-center gap-1.5"><Lock size={12} />Password</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Your account password"
                    className="w-full px-4 py-3 pr-10 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-yellow-500/50 focus:outline-none focus:ring-1 focus:ring-yellow-500/30 transition-all text-sm" />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">{showPass ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 flex items-center gap-1.5"><Key size={12} />Manager Key</label>
                <input type={showPass ? 'text' : 'password'} value={managerKey} onChange={e => setManagerKey(e.target.value)} placeholder="Enter manager key"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-yellow-500/50 focus:outline-none focus:ring-1 focus:ring-yellow-500/30 transition-all text-sm"
                  onKeyDown={e => e.key === 'Enter' && handleManagerLogin()} />
              </div>
              <button onClick={handleManagerLogin} disabled={loading || !email || !password || !managerKey} className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 bg-gradient-to-r from-yellow-500 to-amber-600 hover:shadow-lg hover:shadow-yellow-500/20 hover:-translate-y-0.5 transition-all text-white">
                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Zap size={14} /> Access as Manager</>}
              </button>
            </div>
          )}

          {/* ═══ Footer ═══ */}
          <div className="mt-5 pt-4 border-t border-white/5 text-center">
            <p className="text-[10px] text-gray-600">Protected by Firebase Authentication. All connections are encrypted.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

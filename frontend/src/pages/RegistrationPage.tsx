import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  ShieldCheck,
  User,
  Building2,
  Ambulance,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  MapPin,
  Loader2,
  Check,
  AlertCircle,
  Navigation,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi, AuthApiError } from '../services/authApi';
import type {
  AmbulanceDriverRegistrationRequest,
  AmbulanceProviderRegistrationRequest,
  AuthUser,
  HospitalRegistrationRequest,
  UserRegistrationRequest,
} from '../types/auth';
import { ROUTES, ROLE_HOMES } from '../routes/routePaths';
import { SocialAuthButtons } from '../components/auth/SocialAuthButtons';

export type RegistrationKind = 'user' | 'hospital' | 'ambulance-provider' | 'ambulance-driver';

export interface RegistrationPageProps {
  kind?: RegistrationKind;
}

interface FormState {
  // Step 1: Base Identity & Security
  name: string;
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;

  // Step 2: Emergency Contact, Geo & Organization Details
  phone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  address: string;
  city: string;
  state: string;
  country: string;

  // Organization specifics
  registrationNumber: string;
  hospitalType: string;
  services: string;
  capabilities: string;
  serviceType: string;
  licenseNumber: string;
  providerId: string;
  assignedAmbulanceId: string;
}

const initialForm: FormState = {
  name: '',
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  phone: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  address: '',
  city: 'Jaipur',
  state: 'Rajasthan',
  country: 'India',
  registrationNumber: '',
  hospitalType: 'Trauma & Emergency Center',
  services: 'Emergency, ICU, Cardiac Care',
  capabilities: 'Level 1 Trauma, Cath Lab, 24/7 ER',
  serviceType: 'Private Advanced Life Support (ALS)',
  licenseNumber: '',
  providerId: '',
  assignedAmbulanceId: '',
};

const splitList = (value: string): string[] =>
  value.split(',').map((item) => item.trim()).filter(Boolean);

const getErrorMessage = (error: unknown): string => {
  if (error instanceof AuthApiError) {
    if (error.code === 'EMAIL_ALREADY_EXISTS') return 'An account with this email already exists.';
    if (error.code === 'PHONE_ALREADY_EXISTS') return 'An account with this phone number already exists.';
    if (error.code === 'REGISTRATION_NUMBER_ALREADY_EXISTS') return 'This registration number is already in use.';
    if (error.code === 'LICENSE_NUMBER_ALREADY_EXISTS') return 'This license number is already in use.';
    if (error.code === 'PROVIDER_NOT_FOUND') return 'No ambulance provider was found for this Provider ID.';
    if (error.code === 'PROVIDER_NOT_OPERATIONAL') return 'This provider is not yet approved. Driver registration requires an ACTIVE provider.';
    if (error.code === 'AMBULANCE_NOT_FOUND') return 'The assigned ambulance was not found under this provider.';
    if (error.code === 'VALIDATION_ERROR') return error.message || 'Some registration details are missing or invalid.';
    if (error.status === 404) return 'The registration endpoint was not found on the running API.';
    if (error.status === 400 || error.status === 409 || error.status === 422) return error.message;
    if (error.status >= 500) return 'ResQ is temporarily unavailable. Please try again.';
  }
  return error instanceof Error && error.message
    ? error.message
    : 'Registration could not be completed. Please review your details and try again.';
};

const calculateStrength = (password: string) => {
  let score = 0;
  if (!password) return 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password) || password.length >= 12) score++;
  return score;
};

const strengthLabels = ['No password', 'Weak', 'Fair', 'Good', 'Strong'];
const strengthColors = [
  'bg-zinc-700',
  'bg-rose-500 shadow-rose-500/50',
  'bg-amber-500 shadow-amber-500/50',
  'bg-blue-500 shadow-blue-500/50',
  'bg-emerald-500 shadow-emerald-500/50',
];

export const RegistrationPage = ({ kind: propKind }: RegistrationPageProps) => {
  const { register } = useAuth();
  const navigate = useNavigate();

  // Selected High-Level Role ('citizen' vs 'responder')
  const [selectedRoleGroup, setSelectedRoleGroup] = useState<'citizen' | 'responder'>(
    propKind && propKind !== 'user' ? 'responder' : 'citizen'
  );

  // Active Kind ('user' | 'hospital' | 'ambulance-provider' | 'ambulance-driver')
  const [activeKind, setActiveKind] = useState<RegistrationKind>(propKind || 'user');

  // Step 1 (Account & Credentials) vs Step 2 (Emergency Profile & Geo-Access)
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);

  // Form State
  const [form, setForm] = useState<FormState>(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdUser, setCreatedUser] = useState<AuthUser | null>(null);

  // Geolocation Permission State
  const [geoStatus, setGeoStatus] = useState<'idle' | 'detecting' | 'granted' | 'denied'>('idle');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Provider list for driver role
  const [providers, setProviders] = useState<
    Array<{ id: string; name: string; registrationNumber: string; city?: string; state?: string }>
  >([]);

  useEffect(() => {
    if (propKind) {
      setActiveKind(propKind);
      setSelectedRoleGroup(propKind === 'user' ? 'citizen' : 'responder');
    }
  }, [propKind]);

  useEffect(() => {
    if (activeKind === 'ambulance-driver') {
      authApi
        .listActiveAmbulanceProviders()
        .then((res) => {
          if (res.data && Array.isArray(res.data) && res.data.length > 0) {
            setProviders(res.data);
            setForm((cur) => ({
              ...cur,
              providerId: cur.providerId || res.data[0].id,
            }));
          }
        })
        .catch(() => {
          /* ignore */
        });
    }
  }, [activeKind]);

  const update = (field: keyof FormState, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  // Geolocation trigger
  const handleRequestLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('denied');
      return;
    }
    setGeoStatus('detecting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus('granted');
      },
      () => {
        setGeoStatus('denied');
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  // Step 1 Validation & Proceed
  const handleProceedToStep2 = () => {
    setError('');
    const nameField = activeKind === 'ambulance-driver' ? form.fullName : form.name;
    if (!nameField.trim()) {
      setError('Please enter your full name or entity name.');
      return;
    }
    if (!form.email.trim() || !form.email.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }
    setSlideDirection(1);
    setCurrentStep(2);
  };

  const handleBackToStep1 = () => {
    setError('');
    setSlideDirection(-1);
    setCurrentStep(1);
  };

  // Payload Builders
  const buildUserPayload = (): UserRegistrationRequest => ({
    name: form.name.trim(),
    email: form.email.trim(),
    password: form.password,
    phone: form.phone.trim(),
    address: form.address.trim() || undefined,
    city: form.city.trim() || undefined,
    state: form.state.trim() || undefined,
    country: form.country.trim() || undefined,
  });

  const buildHospitalPayload = (): HospitalRegistrationRequest => ({
    ...buildUserPayload(),
    registrationNumber: form.registrationNumber.trim(),
    hospitalType: form.hospitalType.trim(),
    services: splitList(form.services),
    capabilities: splitList(form.capabilities),
  });

  const buildProviderPayload = (): AmbulanceProviderRegistrationRequest => ({
    ...buildUserPayload(),
    registrationNumber: form.registrationNumber.trim(),
    serviceType: form.serviceType.trim(),
  });

  const buildDriverPayload = (): AmbulanceDriverRegistrationRequest => ({
    email: form.email.trim(),
    password: form.password,
    phone: form.phone.trim(),
    fullName: form.fullName.trim(),
    licenseNumber: form.licenseNumber.trim(),
    providerId: form.providerId.trim(),
    assignedAmbulanceId: form.assignedAmbulanceId.trim() || undefined,
    address: form.address.trim() || undefined,
    city: form.city.trim() || undefined,
    state: form.state.trim() || undefined,
    country: form.country.trim() || undefined,
  });

  // Final Form Submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setCreatedUser(null);

    if (!form.phone.trim()) {
      setError('Contact phone number is required.');
      return;
    }

    if (activeKind === 'ambulance-driver') {
      if (!form.licenseNumber.trim()) {
        setError('Driver license number is required.');
        return;
      }
      if (!/^[a-fA-F0-9]{24}$/.test(form.providerId.trim())) {
        setError('Provider ID must be the provider’s 24-character MongoDB ID.');
        return;
      }
    }

    if ((activeKind === 'hospital' || activeKind === 'ambulance-provider') && !form.registrationNumber.trim()) {
      setError('Operational registration number is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (activeKind === 'user') {
        await register.user(buildUserPayload());
        navigate('/', { replace: true });
        return;
      }

      let user: AuthUser;
      if (activeKind === 'hospital') user = await register.hospital(buildHospitalPayload());
      else if (activeKind === 'ambulance-provider') user = await register.ambulanceProvider(buildProviderPayload());
      else user = await register.ambulanceDriver(buildDriverPayload());

      setCreatedUser(user);
      setForm(initialForm);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const passwordScore = calculateStrength(form.password);

  const stepVariants: any = {
    enter: (direction: number) => ({
      x: direction > 0 ? 32 : -32,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -32 : 32,
      opacity: 0,
      transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
    }),
  };

  return (
    <main className="min-h-screen bg-[#070709] text-white font-sans mesh-bg py-12 md:py-20 px-6 sm:px-8 lg:px-12 flex flex-col justify-center items-center relative overflow-hidden">

      {/* Ambient background glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-10 -translate-x-1/2 h-[750px] w-[950px] rounded-full opacity-[0.045]"
          style={{ background: 'radial-gradient(circle, #f43f5e 0%, #f59e0b 40%, transparent 70%)' }}
        />
      </div>

      {/* Navigation Header */}
      <div className="w-full max-w-2xl mb-8 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center shadow-md shadow-rose-600/30 group-hover:scale-105 transition-transform">
            <ShieldAlert className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold tracking-tight text-white group-hover:text-rose-100 transition-colors">
            resQ 2.O
          </span>
        </Link>

        <Link
          to={ROUTES.PUBLIC.LOGIN}
          className="text-xs font-mono text-zinc-400 hover:text-white transition-colors"
        >
          Already registered? <span className="text-rose-400 font-semibold underline">Sign In</span>
        </Link>
      </div>

      {/* Main Focus Card (48px+ padding so inputs never feel squeezed) */}
      <div className="relative w-full max-w-2xl rounded-3xl p-8 sm:p-12 md:p-14 bg-white/[0.025] backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/80">

        {/* Wizard Header */}
        <div className="mb-10 text-center">
          <p className="overline text-rose-400 mb-2">Onboarding & Security Clearance</p>
          <h1 className="text-3xl sm:text-4xl font-light tracking-tight text-white mb-3">
            Join the Crisis Response Fabric
          </h1>
          <p className="text-sm text-zinc-400 font-light max-w-md mx-auto leading-relaxed">
            Create your high-security credential to access rapid emergency coordination and live trauma telemetry.
          </p>

          {/* 2-Step Progress Indicator */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <div className="flex items-center gap-2">
              <span
                className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-all ${
                  currentStep === 1
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/40 ring-2 ring-rose-500/20'
                    : 'bg-emerald-500 text-white'
                }`}
              >
                {currentStep === 2 ? <Check className="h-3.5 w-3.5" /> : '1'}
              </span>
              <span className={`text-xs font-medium ${currentStep === 1 ? 'text-white' : 'text-zinc-400'}`}>
                Account & Credentials
              </span>
            </div>

            <div className="w-12 h-[1px] bg-white/10" />

            <div className="flex items-center gap-2">
              <span
                className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-all ${
                  currentStep === 2
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/40 ring-2 ring-rose-500/20'
                    : 'bg-white/[0.05] text-zinc-500 border border-white/10'
                }`}
              >
                2
              </span>
              <span className={`text-xs font-medium ${currentStep === 2 ? 'text-white' : 'text-zinc-500'}`}>
                Emergency & Location
              </span>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-xs text-rose-300"
          >
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Success Banner if createdUser */}
        {createdUser ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-8 rounded-2xl bg-white/[0.03] border border-emerald-500/30 text-center"
          >
            <div className="h-14 w-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto mb-5">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">Registration Submitted</h3>
            <p className="text-sm text-zinc-300 leading-relaxed max-w-md mx-auto mb-8 font-light">
              {createdUser.accountStatus === 'PENDING'
                ? 'Your operational account has been queued for verification by a ResQ administrator. You will receive activation notice once approved.'
                : 'Your emergency credentials have been successfully created. You can now access your citizen portal.'}
            </p>
            <Link
              to={ROUTES.PUBLIC.LOGIN}
              className="inline-flex items-center justify-center px-8 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 shadow-lg shadow-rose-600/30 transition-all"
            >
              Proceed to Sign In
            </Link>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait" custom={slideDirection}>
            {/* ─── STEP 1: ROLE SELECTION & CREDENTIALS ───────────────────────── */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                custom={slideDirection}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-8"
              >
                {/* Role Selector: Large, airy selection cards */}
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-3">
                    Select Account Role
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* Citizen Card */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRoleGroup('citizen');
                        setActiveKind('user');
                      }}
                      className={`p-6 rounded-2xl text-left border transition-all cursor-pointer relative overflow-hidden ${
                        selectedRoleGroup === 'citizen'
                          ? 'bg-rose-500/[0.07] border-rose-500/50 shadow-lg shadow-rose-500/10'
                          : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div
                          className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                            selectedRoleGroup === 'citizen'
                              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/40'
                              : 'bg-white/[0.05] text-zinc-400'
                          }`}
                        >
                          <User className="h-5 w-5" />
                        </div>
                        {selectedRoleGroup === 'citizen' && (
                          <span className="h-5 w-5 rounded-full bg-rose-500 flex items-center justify-center text-white">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-semibold text-white mb-1">Citizen / General User</h4>
                      <p className="text-xs text-zinc-400 font-light leading-relaxed">
                        1-tap SOS beacon, automated emergency contact dispatch, and hospital care tracking.
                      </p>
                    </button>

                    {/* Responder / Organization Card */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRoleGroup('responder');
                        if (activeKind === 'user') setActiveKind('hospital');
                      }}
                      className={`p-6 rounded-2xl text-left border transition-all cursor-pointer relative overflow-hidden ${
                        selectedRoleGroup === 'responder'
                          ? 'bg-amber-500/[0.07] border-amber-500/50 shadow-lg shadow-amber-500/10'
                          : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div
                          className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                            selectedRoleGroup === 'responder'
                              ? 'bg-amber-500 text-black shadow-md shadow-amber-500/40'
                              : 'bg-white/[0.05] text-zinc-400'
                          }`}
                        >
                          <ShieldCheck className="h-5 w-5" />
                        </div>
                        {selectedRoleGroup === 'responder' && (
                          <span className="h-5 w-5 rounded-full bg-amber-500 flex items-center justify-center text-black">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-semibold text-white mb-1">Responder / Organization</h4>
                      <p className="text-xs text-zinc-400 font-light leading-relaxed">
                        Trauma facilities, certified ambulance operators, and paramedic responders.
                      </p>
                    </button>

                  </div>

                  {/* Sub-Role Selector for Responder */}
                  {selectedRoleGroup === 'responder' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 p-4 rounded-xl bg-white/[0.02] border border-white/10"
                    >
                      <p className="text-xs font-mono text-zinc-400 mb-2.5">Specific Operational Domain:</p>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveKind('hospital')}
                          className={`py-2.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                            activeKind === 'hospital'
                              ? 'bg-white/10 text-white border-amber-400/50 shadow-xs'
                              : 'text-zinc-400 border-white/5 hover:text-white'
                          }`}
                        >
                          <Building2 className="h-3.5 w-3.5 text-amber-400" />
                          <span>Hospital</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveKind('ambulance-provider')}
                          className={`py-2.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                            activeKind === 'ambulance-provider'
                              ? 'bg-white/10 text-white border-rose-400/50 shadow-xs'
                              : 'text-zinc-400 border-white/5 hover:text-white'
                          }`}
                        >
                          <Ambulance className="h-3.5 w-3.5 text-rose-400" />
                          <span>Provider</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveKind('ambulance-driver')}
                          className={`py-2.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                            activeKind === 'ambulance-driver'
                              ? 'bg-white/10 text-white border-blue-400/50 shadow-xs'
                              : 'text-zinc-400 border-white/5 hover:text-white'
                          }`}
                        >
                          <Navigation className="h-3.5 w-3.5 text-blue-400" />
                          <span>Driver</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Form Fields: Floating / Clean layout with space-y-6 */}
                <div className="space-y-6 pt-2">
                  
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2">
                      {activeKind === 'ambulance-driver'
                        ? 'Full Legal Name'
                        : activeKind === 'user'
                        ? 'Full Name'
                        : activeKind === 'hospital'
                        ? 'Hospital / Facility Name'
                        : 'Fleet Provider Name'}
                    </label>
                    <div className="relative">
                      <input
                        required
                        type="text"
                        value={activeKind === 'ambulance-driver' ? form.fullName : form.name}
                        onChange={(e) =>
                          update(
                            activeKind === 'ambulance-driver' ? 'fullName' : 'name',
                            e.target.value
                          )
                        }
                        placeholder={
                          activeKind === 'user' ? 'e.g. Dr. Siddharth Verma' : 'e.g. Apex Trauma & ICU'
                        }
                        className="w-full h-12 px-4 rounded-xl bg-white/[0.03] border border-white/10 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 text-white text-sm outline-none transition-all placeholder:text-zinc-600"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2">
                      Official Email Address
                    </label>
                    <div className="relative">
                      <input
                        required
                        type="email"
                        autoComplete="email"
                        value={form.email}
                        onChange={(e) => update('email', e.target.value)}
                        placeholder="you@resq-domain.org"
                        className="w-full h-12 px-4 rounded-xl bg-white/[0.03] border border-white/10 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 text-white text-sm outline-none transition-all placeholder:text-zinc-600"
                      />
                    </div>
                  </div>

                  {/* Password & Strength Meter */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          required
                          minLength={8}
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={form.password}
                          onChange={(e) => update('password', e.target.value)}
                          placeholder="Min 8 characters"
                          className="w-full h-12 px-4 pr-10 rounded-xl bg-white/[0.03] border border-white/10 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 text-white text-sm outline-none transition-all placeholder:text-zinc-600"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3.5 text-zinc-500 hover:text-zinc-300"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>

                      {/* 4-Segment Micro-Glow Password Bar */}
                      <div className="mt-2.5 space-y-1.5">
                        <div className="grid grid-cols-4 gap-1.5">
                          {[1, 2, 3, 4].map((seg) => (
                            <div
                              key={seg}
                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                passwordScore >= seg ? strengthColors[passwordScore] : 'bg-white/[0.06]'
                              }`}
                            />
                          ))}
                        </div>
                        {form.password && (
                          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                            <span>Strength:</span>
                            <span className="font-semibold text-zinc-200">
                              {strengthLabels[passwordScore]}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <input
                          required
                          minLength={8}
                          type={showConfirmPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={form.confirmPassword}
                          onChange={(e) => update('confirmPassword', e.target.value)}
                          placeholder="Repeat password"
                          className="w-full h-12 px-4 pr-10 rounded-xl bg-white/[0.03] border border-white/10 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 text-white text-sm outline-none transition-all placeholder:text-zinc-600"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-3.5 text-zinc-500 hover:text-zinc-300"
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>

                      {form.confirmPassword && (
                        <p
                          className={`mt-2 text-[11px] font-mono ${
                            form.password === form.confirmPassword ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {form.password === form.confirmPassword ? '✓ Passwords match' : '✕ Passwords do not match'}
                        </p>
                      )}
                    </div>
                  </div>

                </div>

                {/* Step 1 Action Button */}
                <div className="pt-4">
                  <button
                    type="button"
                    onClick={handleProceedToStep2}
                    className="w-full h-13 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-semibold text-sm shadow-xl shadow-rose-600/30 btn-shimmer flex items-center justify-center gap-2 active:scale-[0.99] transition-all cursor-pointer"
                  >
                    <span>Proceed to Emergency Profile & Geo-Access</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>

                {/* 1-Tap Social Registration (Citizen & Provider) */}
                {(activeKind === 'user' || activeKind === 'ambulance-provider') && (
                  <SocialAuthButtons
                    roleHint={activeKind === 'ambulance-provider' ? 'AMBULANCE_PROVIDER' : 'USER'}
                    onSuccess={(user) => {
                      navigate(ROLE_HOMES[user.role] ?? ROUTES.USER.DASHBOARD, { replace: true });
                    }}
                    onError={(msg) => setError(msg)}
                  />
                )}
              </motion.div>
            )}

            {/* ─── STEP 2: EMERGENCY CONTACT & LOCATION ───────────────────────── */}
            {currentStep === 2 && (
              <motion.form
                key="step2"
                onSubmit={handleSubmit}
                custom={slideDirection}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-6"
              >
                {/* Contact Phone */}
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2">
                    Primary Emergency Phone (SMS Alerts)
                  </label>
                  <div className="relative">
                    <input
                      required
                      type="tel"
                      value={form.phone}
                      onChange={(e) => update('phone', e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full h-12 px-4 rounded-xl bg-white/[0.03] border border-white/10 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 text-white text-sm outline-none transition-all placeholder:text-zinc-600"
                    />
                  </div>
                </div>

                {/* Citizen specific: Emergency Contact */}
                {activeKind === 'user' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2">
                        Emergency Contact Name
                      </label>
                      <input
                        type="text"
                        value={form.emergencyContactName}
                        onChange={(e) => update('emergencyContactName', e.target.value)}
                        placeholder="e.g. Sunita Verma (Spouse)"
                        className="w-full h-12 px-4 rounded-xl bg-white/[0.03] border border-white/10 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 text-white text-sm outline-none transition-all placeholder:text-zinc-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2">
                        Emergency Contact Phone
                      </label>
                      <input
                        type="tel"
                        value={form.emergencyContactPhone}
                        onChange={(e) => update('emergencyContactPhone', e.target.value)}
                        placeholder="+91 91234 56789"
                        className="w-full h-12 px-4 rounded-xl bg-white/[0.03] border border-white/10 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 text-white text-sm outline-none transition-all placeholder:text-zinc-600"
                      />
                    </div>
                  </div>
                )}

                {/* Responder specific fields */}
                {activeKind === 'hospital' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2">
                          Hospital Registration Number
                        </label>
                        <input
                          required
                          value={form.registrationNumber}
                          onChange={(e) => update('registrationNumber', e.target.value)}
                          placeholder="e.g. RJ-MED-2024-8841"
                          className="w-full h-12 px-4 rounded-xl bg-white/[0.03] border border-white/10 focus:border-rose-500 text-white text-sm outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2">
                          Hospital Type
                        </label>
                        <input
                          required
                          value={form.hospitalType}
                          onChange={(e) => update('hospitalType', e.target.value)}
                          placeholder="e.g. Tertiary Trauma Center"
                          className="w-full h-12 px-4 rounded-xl bg-white/[0.03] border border-white/10 focus:border-rose-500 text-white text-sm outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2">
                        Key Trauma Services
                      </label>
                      <input
                        value={form.services}
                        onChange={(e) => update('services', e.target.value)}
                        placeholder="Emergency, ICU, Cardiac, Burns"
                        className="w-full h-12 px-4 rounded-xl bg-white/[0.03] border border-white/10 focus:border-rose-500 text-white text-sm outline-none"
                      />
                    </div>
                  </div>
                )}

                {activeKind === 'ambulance-provider' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2">
                        Fleet Registration Number
                      </label>
                      <input
                        required
                        value={form.registrationNumber}
                        onChange={(e) => update('registrationNumber', e.target.value)}
                        placeholder="e.g. FLEET-RJ-1049"
                        className="w-full h-12 px-4 rounded-xl bg-white/[0.03] border border-white/10 focus:border-rose-500 text-white text-sm outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2">
                        Service Class
                      </label>
                      <input
                        required
                        value={form.serviceType}
                        onChange={(e) => update('serviceType', e.target.value)}
                        placeholder="Private ALS Fleet / NGO"
                        className="w-full h-12 px-4 rounded-xl bg-white/[0.03] border border-white/10 focus:border-rose-500 text-white text-sm outline-none"
                      />
                    </div>
                  </div>
                )}

                {activeKind === 'ambulance-driver' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2">
                          Commercial Driver License #
                        </label>
                        <input
                          required
                          value={form.licenseNumber}
                          onChange={(e) => update('licenseNumber', e.target.value)}
                          placeholder="e.g. RJ-14-2019-0098"
                          className="w-full h-12 px-4 rounded-xl bg-white/[0.03] border border-white/10 focus:border-rose-500 text-white text-sm outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2">
                          Assigned Fleet Provider
                        </label>
                        {providers.length > 0 ? (
                          <select
                            value={form.providerId}
                            onChange={(e) => update('providerId', e.target.value)}
                            className="w-full h-12 px-4 rounded-xl bg-zinc-900 border border-white/10 text-white text-sm outline-none focus:border-rose-500"
                            required
                          >
                            <option value="" disabled>Select approved provider</option>
                            {providers.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.city || p.registrationNumber})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            required
                            value={form.providerId}
                            onChange={(e) => update('providerId', e.target.value)}
                            placeholder="24-char MongoDB ID"
                            className="w-full h-12 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-white text-sm outline-none"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* City & State */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2">
                      City
                    </label>
                    <input
                      value={form.city}
                      onChange={(e) => update('city', e.target.value)}
                      placeholder="Jaipur"
                      className="w-full h-12 px-4 rounded-xl bg-white/[0.03] border border-white/10 focus:border-rose-500 text-white text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2">
                      State
                    </label>
                    <input
                      value={form.state}
                      onChange={(e) => update('state', e.target.value)}
                      placeholder="Rajasthan"
                      className="w-full h-12 px-4 rounded-xl bg-white/[0.03] border border-white/10 focus:border-rose-500 text-white text-sm outline-none"
                    />
                  </div>
                </div>

                {/* Interactive Location Permission Card */}
                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-xl">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                          Emergency Geolocation Authorization
                        </h4>
                        <p className="text-xs text-zinc-400 font-light mt-0.5">
                          Enables instant sub-meter GPS dispatch when triggering SOS without vocal address friction.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleRequestLocation}
                      disabled={geoStatus === 'detecting' || geoStatus === 'granted'}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all shrink-0 cursor-pointer ${
                        geoStatus === 'granted'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
                      }`}
                    >
                      {geoStatus === 'detecting'
                        ? 'Detecting…'
                        : geoStatus === 'granted'
                        ? '✓ Authorized'
                        : 'Authorize GPS'}
                    </button>
                  </div>

                  {coords && (
                    <div className="mt-3 pt-3 border-t border-white/[0.06] text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                      <span>Coordinates:</span>
                      <span className="text-emerald-400">
                        {coords.lat.toFixed(4)}° N, {coords.lng.toFixed(4)}° E
                      </span>
                    </div>
                  )}
                </div>

                {/* Dual Navigation Buttons */}
                <div className="pt-4 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={handleBackToStep1}
                    className="h-13 px-6 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-zinc-300 font-medium text-sm flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back</span>
                  </button>

                  <button
                    disabled={isSubmitting}
                    type="submit"
                    className="flex-1 h-13 rounded-2xl bg-gradient-to-r from-rose-600 via-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-semibold text-sm shadow-xl shadow-rose-600/30 btn-shimmer flex items-center justify-center gap-2 disabled:opacity-60 transition-all cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Initializing Credential…</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        <span>Complete Registration</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        )}

      </div>

    </main>
  );
};

export const RegistrationRoleSelect = () => {
  return <RegistrationPage />;
};

export default RegistrationPage;

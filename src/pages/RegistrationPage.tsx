import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthApiError } from '../services/authApi';
import type { AmbulanceDriverRegistrationRequest, AmbulanceProviderRegistrationRequest, AuthUser, HospitalRegistrationRequest, UserRegistrationRequest } from '../types/auth';

type RegistrationKind = 'user' | 'hospital' | 'ambulance-provider' | 'ambulance-driver';
interface RegistrationPageProps { kind: RegistrationKind }
interface FormState {
  name: string; fullName: string; email: string; phone: string; password: string; address: string; city: string; state: string; country: string;
  registrationNumber: string; hospitalType: string; services: string; capabilities: string; serviceType: string; licenseNumber: string; providerId: string; assignedAmbulanceId: string;
}
const initialForm: FormState = { name: '', fullName: '', email: '', phone: '', password: '', address: '', city: '', state: '', country: '', registrationNumber: '', hospitalType: '', services: '', capabilities: '', serviceType: '', licenseNumber: '', providerId: '', assignedAmbulanceId: '' };
const titles: Record<RegistrationKind, { title: string; description: string }> = {
  user: { title: 'Create your ResQ account', description: 'Register for healthcare navigation and emergency coordination.' },
  hospital: { title: 'Register your hospital', description: 'Hospital accounts remain pending until operational verification.' },
  'ambulance-provider': { title: 'Register an ambulance provider', description: 'Provider accounts remain pending until operational verification.' },
  'ambulance-driver': { title: 'Register as an ambulance driver', description: 'Driver accounts remain pending until operational approval.' },
};
const splitList = (value: string): string[] => value.split(',').map((item) => item.trim()).filter(Boolean);
const getErrorMessage = (error: unknown): string => {
  if (error instanceof AuthApiError) {
    if (error.code === 'EMAIL_ALREADY_EXISTS') return 'An account with this email already exists.';
    if (error.code === 'PHONE_ALREADY_EXISTS') return 'An account with this phone number already exists.';
    if (error.status === 409 || error.status === 422) return error.message;
    if (error.status >= 500) return 'ResQ is temporarily unavailable. Please try again.';
  }
  return 'Registration could not be completed. Please review your details and try again.';
};
const buildUserPayload = (form: FormState): UserRegistrationRequest => ({ name: form.name.trim(), email: form.email.trim(), password: form.password, phone: form.phone.trim(), address: form.address.trim() || undefined, city: form.city.trim() || undefined, state: form.state.trim() || undefined, country: form.country.trim() || undefined });
const buildHospitalPayload = (form: FormState): HospitalRegistrationRequest => ({ ...buildUserPayload(form), registrationNumber: form.registrationNumber.trim(), hospitalType: form.hospitalType.trim(), services: splitList(form.services), capabilities: splitList(form.capabilities) });
const buildProviderPayload = (form: FormState): AmbulanceProviderRegistrationRequest => ({ ...buildUserPayload(form), registrationNumber: form.registrationNumber.trim(), serviceType: form.serviceType.trim() });
const buildDriverPayload = (form: FormState): AmbulanceDriverRegistrationRequest => ({ email: form.email.trim(), password: form.password, phone: form.phone.trim(), fullName: form.fullName.trim(), licenseNumber: form.licenseNumber.trim(), providerId: form.providerId.trim(), assignedAmbulanceId: form.assignedAmbulanceId.trim() || undefined, address: form.address.trim() || undefined, city: form.city.trim() || undefined, state: form.state.trim() || undefined, country: form.country.trim() || undefined });

export const RegistrationPage = ({ kind }: RegistrationPageProps) => {
  const { register } = useAuth();
  const [form, setForm] = useState<FormState>(initialForm);
  const [error, setError] = useState('');
  const [createdUser, setCreatedUser] = useState<AuthUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const copy = titles[kind];
  const update = (field: keyof FormState, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); setCreatedUser(null);
    if (form.password.length < 12) { setError('Password must contain at least 12 characters.'); return; }
    setIsSubmitting(true);
    try {
      let user: AuthUser;
      if (kind === 'user') user = await register.user(buildUserPayload(form));
      else if (kind === 'hospital') user = await register.hospital(buildHospitalPayload(form));
      else if (kind === 'ambulance-provider') user = await register.ambulanceProvider(buildProviderPayload(form));
      else user = await register.ambulanceDriver(buildDriverPayload(form));
      setCreatedUser(user); setForm(initialForm);
    } catch (submitError) { setError(getErrorMessage(submitError)); }
    finally { setIsSubmitting(false); }
  };

  const nameField: keyof FormState = kind === 'ambulance-driver' ? 'fullName' : 'name';
  const nameLabel = kind === 'ambulance-driver' ? 'Full name' : kind === 'user' ? 'Name' : kind === 'hospital' ? 'Hospital name' : 'Provider name';

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10"><section className="mx-auto w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
      <Link to="/login" className="text-sm font-semibold text-slate-600 hover:text-slate-950">← Back to sign in</Link>
      <h1 className="mt-6 text-2xl font-bold text-slate-950">{copy.title}</h1><p className="mt-1 text-sm text-slate-500">{copy.description}</p>
      {createdUser ? <div className="mt-7 rounded-xl border border-emerald-200 bg-emerald-50 p-5"><p className="font-semibold text-emerald-900">Registration submitted successfully.</p><p className="mt-1 text-sm text-emerald-800">{createdUser.accountStatus === 'PENDING' ? 'Your account is pending operational approval. You can sign in after approval.' : 'Your account has been created. You can now sign in.'}</p><Link to="/login" className="mt-4 inline-flex h-10 items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white">Go to sign in</Link></div> : <form onSubmit={handleSubmit} className="mt-7 grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className="label">{nameLabel}</span><input required value={form[nameField]} onChange={(event) => update(nameField, event.target.value)} className="input" /></label>
        <label><span className="label">Email</span><input required type="email" value={form.email} onChange={(event) => update('email', event.target.value)} className="input" autoComplete="email" /></label>
        <label><span className="label">Phone</span><input required value={form.phone} onChange={(event) => update('phone', event.target.value)} className="input" /></label>
        <label className="sm:col-span-2"><span className="label">Password</span><input required minLength={12} type="password" value={form.password} onChange={(event) => update('password', event.target.value)} className="input" autoComplete="new-password" /></label>
        {kind === 'hospital' && <><label><span className="label">Registration number</span><input required value={form.registrationNumber} onChange={(event) => update('registrationNumber', event.target.value)} className="input" /></label><label><span className="label">Hospital type</span><input required value={form.hospitalType} onChange={(event) => update('hospitalType', event.target.value)} className="input" /></label><label><span className="label">Services</span><input value={form.services} onChange={(event) => update('services', event.target.value)} className="input" placeholder="Emergency, ICU" /></label><label><span className="label">Capabilities</span><input value={form.capabilities} onChange={(event) => update('capabilities', event.target.value)} className="input" placeholder="Trauma, Cardiac" /></label></>}
        {kind === 'ambulance-provider' && <><label><span className="label">Registration number</span><input required value={form.registrationNumber} onChange={(event) => update('registrationNumber', event.target.value)} className="input" /></label><label><span className="label">Service type</span><input required value={form.serviceType} onChange={(event) => update('serviceType', event.target.value)} className="input" placeholder="Private / NGO / Fleet" /></label></>}
        {kind === 'ambulance-driver' && <><label><span className="label">License number</span><input required value={form.licenseNumber} onChange={(event) => update('licenseNumber', event.target.value)} className="input" /></label><label><span className="label">Provider ID</span><input required value={form.providerId} onChange={(event) => update('providerId', event.target.value)} className="input" placeholder="MongoDB provider ID" /></label><label className="sm:col-span-2"><span className="label">Assigned ambulance ID (optional)</span><input value={form.assignedAmbulanceId} onChange={(event) => update('assignedAmbulanceId', event.target.value)} className="input" /></label></>}
        {kind !== 'user' && <label className="sm:col-span-2"><span className="label">Address</span><input value={form.address} onChange={(event) => update('address', event.target.value)} className="input" /></label>}
        <label><span className="label">City</span><input value={form.city} onChange={(event) => update('city', event.target.value)} className="input" /></label><label><span className="label">State</span><input value={form.state} onChange={(event) => update('state', event.target.value)} className="input" /></label><label><span className="label">Country</span><input value={form.country} onChange={(event) => update('country', event.target.value)} className="input" /></label>
        {error && <p className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">{error}</p>}
        <button disabled={isSubmitting} type="submit" className="sm:col-span-2 h-11 rounded-lg bg-slate-900 text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60">{isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}{isSubmitting ? 'Submitting…' : 'Create account'}</button>
      </form>}
    </section><style>{`.label{display:block;font-size:.875rem;font-weight:500;color:#334155;margin-bottom:.375rem}.input{width:100%;height:2.75rem;border:1px solid #cbd5e1;border-radius:.5rem;padding:0 .75rem;outline:none}.input:focus{border-color:#64748b;box-shadow:0 0 0 2px rgb(15 23 42 / .08)}`}</style></main>
  );
};

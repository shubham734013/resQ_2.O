import { useState } from 'react';
import type { FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Phone,
  Mail,
  MapPin,
  Clock,
  Radio,
  Loader2,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { ROUTES } from '../../routes/routePaths';

type InquiryType =
  | 'General Inquiry'
  | 'Technical & Telemetry Support'
  | 'Hospital & Fleet Partnership'
  | 'Media & Security Governance';

type PriorityLevel = 'Normal' | 'High Operational' | 'Critical System Bug';

interface ContactFormData {
  fullName: string;
  email: string;
  organization: string;
  inquiryType: InquiryType;
  priority: PriorityLevel;
  message: string;
}

const initialForm: ContactFormData = {
  fullName: '',
  email: '',
  organization: '',
  inquiryType: 'General Inquiry',
  priority: 'Normal',
  message: '',
};

export const ContactPage = () => {
  const [formData, setFormData] = useState<ContactFormData>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);

  const update = (field: keyof ContactFormData, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate high-reliability transmission
    setTimeout(() => {
      const ticketId = `NOC-${Math.floor(1000 + Math.random() * 9000)}-${new Date().getFullYear()}`;
      setIsSubmitting(false);
      setSubmittedTicket(ticketId);
      setFormData(initialForm);
    }, 1200);
  };

  return (
    <div className="bg-[#070709] text-white font-sans selection:bg-rose-500/20 selection:text-rose-200 overflow-hidden">
      
      {/* ─── 1. URGENT EMERGENCY NOTICE BANNER ────────────────────────────── */}
      <div className="bg-rose-950/40 border-b border-rose-500/20 px-6 py-3.5 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
            </span>
            <p className="text-zinc-200 font-light">
              <span className="font-bold text-rose-300 uppercase tracking-wide">
                Emergency:
              </span>{' '}
              If someone may die or is badly hurt, do not use this form. Ask for help in ResQ or call 112 now.
            </p>
          </div>

          <Link
            to={ROUTES.USER.EMERGENCY}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] shadow-sm transition-all shrink-0 cursor-pointer"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Ask for emergency help</span>
          </Link>
        </div>
      </div>

      {/* ─── 2. HERO HEADER ──────────────────────────────────────────────── */}
      <section className="relative pt-20 pb-16 md:pt-28 md:pb-24 overflow-hidden mesh-bg grid-texture">
        {/* Soft Ambient Crimson and Amber Glows */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[550px] bg-rose-600/10 rounded-full blur-[140px]" />
        <div className="pointer-events-none absolute top-1/2 -right-32 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[160px]" />

        <div className="relative max-w-4xl mx-auto px-6 lg:px-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] backdrop-blur-xl border border-white/10 text-xs text-rose-300 font-mono mb-6">
            <Radio className="h-3.5 w-3.5 text-rose-500 animate-pulse" />
            <span>ResQ support team</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight text-white mb-6">
            Contact ResQ{' '}
            <span className="font-semibold text-gradient-crimson">
              support.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-zinc-400 font-light max-w-2xl mx-auto leading-relaxed">
            Get help with ResQ, hospitals, or ambulance services.
          </p>
        </div>
      </section>

      {/* ─── 3. DUAL-COLUMN LAYOUT: OPERATIONS HUB VS INQUIRY FORM ───────── */}
      <section className="pb-28 lg:pb-36 relative">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
            
            {/* ─── LEFT COLUMN: EMERGENCY HOTLINE & OPERATIONS HUB (5 COLS) ─ */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Emergency Hotline Card */}
              <div className="spotlight-card p-8 bg-rose-950/[0.15] border-rose-500/20">
                <div className="flex items-center justify-between mb-6">
                  <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                    <Phone className="h-5 w-5" />
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-[10px] font-mono text-rose-400 font-semibold">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
                    Here all day, every day
                  </span>
                </div>

                <h3 className="text-xl font-light text-white tracking-tight mb-2">
                Emergency phone numbers
                </h3>
                <p className="text-xs text-zinc-400 font-light leading-relaxed mb-6">
                  Call these numbers if someone needs help now:
                </p>

                <div className="space-y-3 font-mono text-xs">
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                    <span className="text-zinc-400">Emergency help:</span>
                    <a href="tel:112" className="text-rose-400 font-bold hover:underline">
                      112
                    </a>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                    <span className="text-zinc-400">Ambulance:</span>
                    <a href="tel:108" className="text-white font-bold hover:underline">
                      108
                    </a>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                    <span className="text-zinc-400">ResQ:</span>
                    <a href="tel:+911412229999" className="text-amber-400 font-bold hover:underline">
                      +91 141 222 9999
                    </a>
                  </div>
                </div>
              </div>

              {/* NOC Headquarters Coordinates */}
              <div className="spotlight-card p-8">
                <div className="h-10 w-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-zinc-300 mb-6">
                  <MapPin className="h-5 w-5 text-amber-400" />
                </div>

                <h3 className="text-lg font-light text-white tracking-tight mb-2">
                  ResQ office
                </h3>
                <p className="text-xs text-zinc-400 font-light leading-relaxed mb-4">
                  ResQ office<br />
                  JL Road, Malviya Nagar, Jaipur, Rajasthan 302017
                </p>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                  <span>Map location:</span>
                  <span className="text-emerald-400">26.8532° N, 75.8174° E</span>
                </div>
              </div>

              {/* Live Operating Windows */}
              <div className="spotlight-card p-8">
                <div className="h-10 w-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-zinc-300 mb-6">
                  <Clock className="h-5 w-5 text-blue-400" />
                </div>

                <h3 className="text-lg font-light text-white tracking-tight mb-2">
                  When we are here
                </h3>

                <div className="space-y-3 text-xs font-mono text-zinc-400">
                  <div className="flex items-center justify-between">
                    <span>Emergency help:</span>
                    <span className="text-emerald-400">All day, every day</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Other help:</span>
                    <span className="text-zinc-200">9am - 6pm India time, Monday to Saturday</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Hospital setup help:</span>
                    <span className="text-zinc-200">Help is here all day, every day</span>
                  </div>
                </div>
              </div>

              {/* Official Email Corridors */}
              <div className="spotlight-card p-8">
                <div className="h-10 w-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-zinc-300 mb-6">
                  <Mail className="h-5 w-5 text-rose-400" />
                </div>

                <h3 className="text-lg font-light text-white tracking-tight mb-2">
                  Email us
                </h3>

                <div className="space-y-2 text-xs font-mono text-zinc-400">
                  <p>
                    <span className="text-zinc-500">Emergency help:</span>{' '}
                    <a href="mailto:dispatch@resq.gov.in" className="text-rose-300 hover:underline">
                      dispatch@resq.gov.in
                    </a>
                  </p>
                  <p>
                    <span className="text-zinc-500">Other help:</span>{' '}
                    <a href="mailto:operations@resq.local" className="text-zinc-200 hover:underline">
                      operations@resq.local
                    </a>
                  </p>
                  <p>
                    <span className="text-zinc-500">Account checks:</span>{' '}
                    <a href="mailto:governance@resq.local" className="text-zinc-200 hover:underline">
                      governance@resq.local
                    </a>
                  </p>
                </div>
              </div>

            </div>

            {/* ─── RIGHT COLUMN: INTERACTIVE INQUIRY FORM (7 COLS) ───────── */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl p-8 sm:p-12 lg:p-14 bg-white/[0.025] backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/80 relative">
                
                {/* Submitted Toast / Card */}
                {submittedTicket ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-8 sm:p-10 text-center"
                  >
                    <div className="h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto mb-6">
                      <ShieldCheck className="h-8 w-8" />
                    </div>

                    <p className="overline text-emerald-400 mb-2">Message sent</p>
                    <h3 className="text-2xl sm:text-3xl font-light text-white tracking-tight mb-3">
                      Your message was sent
                    </h3>

                    <p className="text-sm text-zinc-300 leading-relaxed font-light max-w-md mx-auto mb-6">
                      Your message number is{' '}
                      <span className="font-mono text-rose-400 font-bold">{submittedTicket}</span>
                      . Our team will read it and reply within 2 work hours.
                    </p>

                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs font-mono text-zinc-400 max-w-sm mx-auto mb-8">
                      <span>Message status: Waiting for a reply</span>
                      <span className="mx-2">•</span>
                      <span>Reply: within 2 hours</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSubmittedTicket(null)}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-all cursor-pointer"
                    >
                      <span>Send another message</span>
                    </button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <p className="overline text-rose-400 mb-2">Contact form</p>
                      <h2 className="text-2xl sm:text-3xl font-light text-white tracking-tight mb-2">
                        Send us a message
                      </h2>
                      <p className="text-xs sm:text-sm text-zinc-400 font-light leading-relaxed">
                        Ask about joining ResQ, using its tools, or getting help.
                      </p>
                    </div>

                    {/* Inquiry Type Chips */}
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-3">
                        What do you need help with?
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {(
                          [
                            'General Inquiry',
                            'Technical & Telemetry Support',
                            'Hospital & Fleet Partnership',
                            'Media & Security Governance',
                          ] as InquiryType[]
                        ).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => update('inquiryType', type)}
                            className={`p-3 rounded-xl text-xs font-medium text-left border transition-all cursor-pointer ${
                              formData.inquiryType === type
                                ? 'bg-rose-500/[0.08] text-white border-rose-500/50 shadow-xs'
                                : 'bg-white/[0.02] text-zinc-400 border-white/5 hover:text-white'
                            }`}
                          >
                            {{
                              'General Inquiry': 'Something else',
                              'Technical & Telemetry Support': 'Help using ResQ',
                              'Hospital & Fleet Partnership': 'Join as a hospital or ambulance service',
                              'Media & Security Governance': 'Press or account safety',
                            }[type]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Full Name & Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2">
                          Your name
                        </label>
                        <input
                          required
                          type="text"
                          value={formData.fullName}
                          onChange={(e) => update('fullName', e.target.value)}
                          placeholder="e.g. Sam Patel"
                          className="w-full h-12 px-4 rounded-xl bg-white/[0.03] border border-white/10 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 text-white text-sm outline-none transition-all placeholder:text-zinc-600"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2">
                          Email
                        </label>
                        <input
                          required
                          type="email"
                          value={formData.email}
                          onChange={(e) => update('email', e.target.value)}
                          placeholder="you@example.com"
                          className="w-full h-12 px-4 rounded-xl bg-white/[0.03] border border-white/10 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 text-white text-sm outline-none transition-all placeholder:text-zinc-600"
                        />
                      </div>
                    </div>

                    {/* Organization / Department & Priority */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2">
                          Hospital or group (if any)
                        </label>
                        <input
                          type="text"
                          value={formData.organization}
                          onChange={(e) => update('organization', e.target.value)}
                          placeholder="e.g. City Care Hospital"
                          className="w-full h-12 px-4 rounded-xl bg-white/[0.03] border border-white/10 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 text-white text-sm outline-none transition-all placeholder:text-zinc-600"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2">
                          How urgent is this?
                        </label>
                        <select
                          value={formData.priority}
                          onChange={(e) => update('priority', e.target.value as PriorityLevel)}
                          className="w-full h-12 px-4 rounded-xl bg-zinc-900 border border-white/10 focus:border-rose-500 text-white text-sm outline-none transition-all cursor-pointer"
                        >
                          <option value="Normal">Normal — general question</option>
                          <option value="High Operational">High — joining or setup</option>
                          <option value="Critical System Bug">Very urgent — ResQ problem</option>
                        </select>
                      </div>
                    </div>

                    {/* Detailed Message */}
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2">
                        Your message
                      </label>
                      <textarea
                        required
                        rows={5}
                        value={formData.message}
                        onChange={(e) => update('message', e.target.value)}
                        placeholder="Tell us what you need help with..."
                        className="w-full p-4 rounded-xl bg-white/[0.03] border border-white/10 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 text-white text-sm outline-none transition-all placeholder:text-zinc-600 resize-none"
                      />
                    </div>

                    {/* Action Button: Crimson Shimmer */}
                    <div className="pt-2">
                      <button
                        disabled={isSubmitting}
                        type="submit"
                        className="w-full h-13 rounded-2xl bg-gradient-to-r from-rose-600 via-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-semibold text-sm shadow-xl shadow-rose-600/30 btn-shimmer flex items-center justify-center gap-2.5 disabled:opacity-60 transition-all cursor-pointer active:scale-[0.99]"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Sending message…</span>
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4" />
                            <span>Send message</span>
                          </>
                        )}
                      </button>
                    </div>

                    <p className="text-center text-[11px] font-mono text-zinc-500">
                      We lock your message while sending it (TLS 1.3) and while it is saved (AES-256).
                    </p>
                  </form>
                )}

              </div>
            </div>

          </div>

        </div>
      </section>

    </div>
  );
};

export default ContactPage;

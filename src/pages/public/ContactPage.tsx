import { Phone, Mail, MapPin, Clock, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/common/Button';

export const ContactPage = () => {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="bg-slate-50 text-slate-900 font-sans py-12">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
            ResQ 24/7 Operations Desk
          </span>
          <h1 className="mt-3 text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
            Contact ResQ Network Operations
          </h1>
          <p className="mt-2 text-slate-600 text-sm">
            Reach out to our emergency command center, provider onboarding teams, or patient support.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Contact Details */}
          <div className="space-y-4 lg:col-span-1">
            <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5">
              <div className="flex items-center gap-3 text-rose-700">
                <Phone className="h-5 w-5" />
                <h2 className="font-bold text-sm">Emergency Hotlines</h2>
              </div>
              <p className="mt-2 text-xs text-slate-700">Immediate citizen emergency triage & response:</p>
              <div className="mt-3 space-y-1">
                <p className="text-base font-black text-rose-900">National Emergency: 112</p>
                <p className="text-sm font-bold text-slate-900">Ambulance Service: 108</p>
                <p className="text-sm font-bold text-slate-900">ResQ Dispatch Desk: +91 141 222 9999</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Operations & Support Email</h3>
                  <p className="text-xs text-slate-600 mt-0.5">operations@resq.local</p>
                  <p className="text-xs text-slate-600">governance@resq.local</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Command Center</h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    ResQ Emergency Health Systems<br />
                    JL Road, Malviya Nagar, Jaipur, Rajasthan 302017
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Operating Hours</h3>
                  <p className="text-xs text-slate-600 mt-0.5">Emergency Dispatch: 24/7/365</p>
                  <p className="text-xs text-slate-600">Administrative Desk: 09:00 - 18:00 IST</p>
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs lg:col-span-2">
            {submitted ? (
              <div className="text-center py-12">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 mb-4">
                  <ShieldCheck className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-bold text-slate-950">Message Transmitted</h3>
                <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
                  Thank you for reaching out. A ResQ network operations officer will review your message and reply via email within 2 business hours.
                </p>
                <Button className="mt-6" variant="secondary" onClick={() => setSubmitted(false)}>
                  Send Another Inquiry
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="text-lg font-bold text-slate-950 mb-4">Inquiry / Operational Coordination</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-700">
                    Your Name
                    <input
                      required
                      type="text"
                      className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-teal-600 outline-none"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Dr. Rajesh Sharma"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Email Address
                    <input
                      required
                      type="email"
                      className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-teal-600 outline-none"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="rajesh@hospital.local"
                    />
                  </label>
                </div>

                <label className="block text-xs font-semibold text-slate-700">
                  Subject / Organization
                  <input
                    required
                    type="text"
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-teal-600 outline-none"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="Hospital Integration / Fleet Onboarding"
                  />
                </label>

                <label className="block text-xs font-semibold text-slate-700">
                  Message Details
                  <textarea
                    required
                    rows={4}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-teal-600 outline-none"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Describe your inquiry, facility coordination requirement, or technical support issue…"
                  />
                </label>

                <Button type="submit" variant="primary" className="w-full sm:w-auto">
                  Submit Communication
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

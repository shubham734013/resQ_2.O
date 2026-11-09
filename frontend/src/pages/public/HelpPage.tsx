import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Search,
  HelpCircle,
  ShieldAlert,
  Ambulance,
  Building2,
  Lock,
  Radio,
  ShieldCheck,
  ChevronDown,
  ArrowRight,
  Bug,
  MessageSquare,
} from 'lucide-react';
import { ROUTES } from '../../routes/routePaths';

interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    id: 'faq-1',
    category: 'Citizen SOS Setup',
    question: 'How does the 1-click Emergency SOS dispatch work?',
    answer:
      'When you trigger Emergency SOS from your citizen portal, ResQ immediately acquires your high-accuracy GPS coordinates and packages your pre-configured medical profile (blood group, critical allergies, medical conditions). Our spatial dispatch engine locks the closest certified Advanced Life Support (ALS) or Basic Life Support (BLS) ambulance within 45 seconds while pre-alerting the nearest trauma-ready hospital.',
  },
  {
    id: 'faq-2',
    category: 'Citizen SOS Setup',
    question: 'What happens if I lose internet or cellular data during an emergency?',
    answer:
      'ResQ incorporates an offline-first resilient service worker architecture. If cellular data drops, your emergency beacon falls back automatically to municipal IoT mesh relays and high-priority SMS coordinate packets to ensure the dispatch center receives your location without packet loss.',
  },
  {
    id: 'faq-3',
    category: 'Hospital Command',
    question: 'How do hospitals receive incoming patient vitals before arrival?',
    answer:
      'Ambulance crews log and stream real-time telemetry (ECG rhythm, heart rate, blood pressure, oxygen saturation) through the ResQ Driver Telematics console. The receiving hospital’s trauma command inbox displays live pre-arrival telemetry, calculated ETA, and bed reservation cues so trauma squads are scrubbed in prior to physical arrival.',
  },
  {
    id: 'faq-4',
    category: 'Responder Integration',
    question: 'How are ambulance fleet providers and drivers verified?',
    answer:
      'All commercial ambulance providers and paramedic drivers must submit state registration certifications and commercial driver licenses during onboarding. ResQ State Administrators verify these credentials against official transport and health registries before operational access is approved.',
  },
  {
    id: 'faq-5',
    category: 'Account & Privacy',
    question: 'Is my real-time GPS location and medical history private?',
    answer:
      'Yes. ResQ utilizes zero-trust architecture compliant with ISO 27001, HIPAA, and Ayushman Bharat Digital Mission (ABDM) standards. Geolocation data is only transmitted during an active SOS incident or active navigation session, and all clinical data corridors are secured with end-to-end AES-256 encryption.',
  },
  {
    id: 'faq-6',
    category: 'Responder Integration',
    question: 'Can ambulance drivers toggle their duty status?',
    answer:
      'Yes. Certified drivers can toggle between "On Duty" and "Off Duty" directly from their Paramedic Console. Only drivers with active "On Duty" status and fresh GPS heartbeat signals receive algorithmic dispatch job offers.',
  },
  {
    id: 'faq-7',
    category: 'Live GPS Telemetry',
    question: 'How accurate is the vehicle tracking and ETA calculation?',
    answer:
      'ResQ uses sub-meter geospatial telemetry paired with vector traffic feeds. ETAs are recalculated every 2 seconds taking into account current municipal traffic congestion, green corridor priority routes, and real-time road closures.',
  },
  {
    id: 'faq-8',
    category: 'Compliance & Governance',
    question: 'Does ResQ replace official 112 / 108 emergency telephone services?',
    answer:
      'ResQ works in tandem with national emergency hotlines (112 and 108) by providing digital telemetry, automated coordination, and hospital hand-off infrastructure. For immediate voice dispatch, citizens can always dial 112 simultaneously.',
  },
];

const CATEGORIES = [
  {
    id: 'Citizen SOS Setup',
    title: 'Citizen SOS Setup',
    description: 'Geolocation permissions, offline emergency beaconing, and automated contact alerts.',
    icon: ShieldAlert,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/20',
  },
  {
    id: 'Responder Integration',
    title: 'Responder Integration',
    description: 'Paramedic turn-by-turn navigation, duty toggles, fleet dispatch API, and vehicle logging.',
    icon: Ambulance,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
  },
  {
    id: 'Hospital Command',
    title: 'Hospital Command',
    description: 'Pre-arrival vitals streaming, trauma bay prep, and ICU bed availability sync.',
    icon: Building2,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
  },
  {
    id: 'Account & Privacy',
    title: 'Account & Privacy',
    description: 'Role-based credentials, ISO 27001 data isolation, and session encryption.',
    icon: Lock,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
  },
  {
    id: 'Live GPS Telemetry',
    title: 'Live GPS Telemetry',
    description: 'Low-latency WebSocket streams, dead-zone caching, and green-corridor priority.',
    icon: Radio,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/20',
  },
  {
    id: 'Compliance & Governance',
    title: 'Compliance & Governance',
    description: 'Ayushman Bharat (ABDM) standards, audit trails, and driver licensing verification.',
    icon: ShieldCheck,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
  },
];

export const HelpPage = () => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>('faq-1');

  // Keyboard shortcut: Cmd+K / Ctrl+K to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter FAQs based on search and active category
  const filteredFaqs = FAQ_DATA.filter((item) => {
    const matchesCategory =
      activeCategory === 'All' || item.category === activeCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="bg-[#070709] text-white font-sans selection:bg-rose-500/20 selection:text-rose-200 overflow-hidden">
      
      {/* ─── 1. HERO SECTION WITH COMMAND SEARCH BAR ──────────────────────── */}
      <section className="relative pt-24 pb-20 md:pt-32 md:pb-28 overflow-hidden mesh-bg grid-texture">
        {/* Soft Background Radial Glows */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[550px] bg-rose-600/10 rounded-full blur-[140px]" />
        <div className="pointer-events-none absolute top-1/2 -right-32 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[160px]" />

        <div className="relative max-w-4xl mx-auto px-6 lg:px-12 text-center">
          
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] backdrop-blur-xl border border-white/10 text-xs text-rose-300 font-mono mb-6"
          >
            <HelpCircle className="h-4 w-4 text-rose-500" />
            <span>ResQ Operational Knowledge Base & Documentation</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight text-white mb-6 leading-tight"
          >
            How Can Operations{' '}
            <span className="font-semibold text-gradient-crimson">
              Assist You Today?
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-base sm:text-lg text-zinc-400 font-light max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Find immediate answers on emergency signal handling, responder navigation integration, and hospital trauma telemetry pipelines.
          </motion.p>

          {/* Centered Command Search Bar with Cmd+K Shortcut */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="relative max-w-2xl mx-auto"
          >
            <div className="relative flex items-center">
              <Search className="absolute left-4 h-5 w-5 text-zinc-500 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search procedures, SOS setup, dispatch rules, or clinical APIs…"
                className="w-full h-14 pl-12 pr-28 rounded-2xl bg-white/[0.04] backdrop-blur-2xl border border-white/10 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 text-white text-sm outline-none transition-all placeholder:text-zinc-500 shadow-2xl shadow-black/80"
              />
              <div className="absolute right-3.5 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/10 text-[11px] font-mono text-zinc-400 pointer-events-none">
                <span>⌘</span>
                <span>K</span>
              </div>
            </div>

            {/* Quick Filter Tag Chips */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-xs font-mono">
              <span className="text-zinc-500 mr-1">Popular:</span>
              {['All', 'Citizen SOS Setup', 'Responder Integration', 'Hospital Command'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                    activeCategory === cat
                      ? 'bg-rose-600 text-white shadow-xs shadow-rose-600/30'
                      : 'bg-white/[0.03] text-zinc-400 hover:text-white border border-white/[0.06]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </motion.div>

        </div>
      </section>

      {/* ─── 2. TOPIC CATEGORIES (Wide 3-Column Bento Grid) ───────────────── */}
      <section className="py-20 lg:py-28 relative border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="overline text-rose-400 mb-2">Knowledge Domains</p>
            <h2 className="text-3xl sm:text-4xl font-light tracking-tight text-white">
              Explore by Operational Category
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = activeCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(isSelected ? 'All' : cat.id)}
                  className={`spotlight-card p-8 lg:p-10 text-left transition-all cursor-pointer flex flex-col justify-between group ${
                    isSelected ? 'border-rose-500/50 bg-rose-500/[0.04]' : ''
                  }`}
                >
                  <div>
                    <div
                      className={`h-12 w-12 rounded-2xl flex items-center justify-center mb-6 border transition-transform group-hover:scale-110 ${cat.bg}`}
                    >
                      <Icon className={`h-6 w-6 ${cat.color}`} />
                    </div>
                    <h3 className="text-xl font-light text-white tracking-tight mb-3">
                      {cat.title}
                    </h3>
                    <p className="text-xs text-zinc-400 font-light leading-relaxed">
                      {cat.description}
                    </p>
                  </div>

                  <div className="mt-8 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono text-zinc-500 group-hover:text-zinc-300 transition-colors">
                    <span>{isSelected ? 'Viewing topic' : 'View articles'}</span>
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              );
            })}
          </div>

        </div>
      </section>

      {/* ─── 3. FAQ ACCORDION SYSTEM ─────────────────────────────────────── */}
      <section className="py-20 lg:py-28 bg-[#090a0d] border-t border-b border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-6 lg:px-12">
          
          <div className="text-center mb-16">
            <p className="overline text-rose-400 mb-2">Direct Answers</p>
            <h2 className="text-3xl sm:text-4xl font-light tracking-tight text-white mb-3">
              Frequently Addressed Inquiries
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 font-light">
              Showing {filteredFaqs.length} verified operational guidance entries
              {activeCategory !== 'All' ? ` for "${activeCategory}"` : ''}.
            </p>
          </div>

          <div className="space-y-4">
            {filteredFaqs.length > 0 ? (
              filteredFaqs.map((faq) => {
                const isExpanded = expandedFaqId === faq.id;

                return (
                  <div
                    key={faq.id}
                    className="rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-white/15 transition-all overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedFaqId(isExpanded ? null : faq.id)}
                      className="w-full py-6 px-6 sm:px-8 text-left flex items-center justify-between gap-4 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-2 w-2 rounded-full bg-rose-500/80 shrink-0" />
                        <h4 className="text-base sm:text-lg font-light text-white tracking-tight">
                          {faq.question}
                        </h4>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 text-zinc-400 shrink-0 transition-transform duration-300 ${
                          isExpanded ? 'rotate-180 text-rose-400' : ''
                        }`}
                      />
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        >
                          <div className="px-6 sm:px-8 pb-6 pt-1 text-sm text-zinc-300 font-light leading-relaxed border-t border-white/[0.04]">
                            {faq.answer}
                            <div className="mt-4 flex items-center gap-2 text-[11px] font-mono text-zinc-500">
                              <span>Verified Operational Guidance</span>
                              <span>•</span>
                              <span className="text-zinc-400">{faq.category}</span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            ) : (
              <div className="p-12 text-center rounded-2xl bg-white/[0.02] border border-white/[0.08]">
                <p className="text-sm text-zinc-400">No questions match your query.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveCategory('All');
                  }}
                  className="mt-3 text-xs font-mono text-rose-400 underline cursor-pointer"
                >
                  Reset search filters
                </button>
              </div>
            )}
          </div>

        </div>
      </section>

      {/* ─── 4. DIRECT HELP ESCALATION BANNER ─────────────────────────────── */}
      <section className="py-20 lg:py-28 relative">
        <div className="max-w-5xl mx-auto px-6 lg:px-12">
          
          <div className="rounded-3xl p-8 sm:p-12 bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-white/10 shadow-2xl backdrop-blur-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
            
            {/* Ambient Inner Glow */}
            <div className="pointer-events-none absolute -left-20 top-0 h-48 w-48 rounded-full bg-rose-500/10 blur-[80px]" />

            <div className="relative z-10 max-w-lg text-center md:text-left">
              <span className="overline text-rose-400 mb-2 inline-block">Direct Support Escalation</span>
              <h3 className="text-2xl sm:text-3xl font-light text-white tracking-tight mb-2">
                Still Need Operational Assistance?
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 font-light leading-relaxed">
                Our 24/7 technical dispatch engineering team is on standby to assist with hospital integrations, fleet telematics, or urgent incident inquiries.
              </p>
            </div>

            <div className="relative z-10 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <Link
                to={ROUTES.PUBLIC.CONTACT}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 shadow-lg shadow-rose-600/30 btn-shimmer transition-all"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Talk to Operations Team</span>
              </Link>

              <Link
                to={ROUTES.PUBLIC.CONTACT}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-all"
              >
                <Bug className="h-4 w-4 text-amber-400" />
                <span>Report System Incident</span>
              </Link>
            </div>

          </div>

        </div>
      </section>

    </div>
  );
};

export default HelpPage;

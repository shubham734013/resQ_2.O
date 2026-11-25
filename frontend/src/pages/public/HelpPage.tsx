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
    question: 'What happens when I tap Emergency SOS?',
    answer:
      'When you ask for help in ResQ, we send your location and saved health details, like your blood type and allergies, to the response team. ResQ looks for the nearest ambulance that can help and alerts a nearby hospital. If someone is in danger, call 112 too.',
  },
  {
    id: 'faq-2',
    category: 'Citizen SOS Setup',
    question: 'What if I lose internet or phone service during an emergency?',
    answer:
      'ResQ may try other ways to send your location, such as a text message. These ways may not work everywhere. If someone is in danger, call 112 as soon as you can.',
  },
  {
    id: 'faq-3',
    category: 'Hospital Command',
    question: 'How does a hospital know someone is coming?',
    answer:
      'The ambulance team can share health signs, such as heart rate, blood pressure, and oxygen level, with the hospital. The hospital can also see when the ambulance may arrive and get ready to help.',
  },
  {
    id: 'faq-4',
    category: 'Responder Integration',
    question: 'How does ResQ check ambulance teams and drivers?',
    answer:
      'Ambulance services and drivers must send their work papers and driver licenses to ResQ. The ResQ team checks them before they can use work tools.',
  },
  {
    id: 'faq-5',
    category: 'Account & Privacy',
    question: 'Is my location and health information private?',
    answer:
      'ResQ protects your health information. Your location is shared only when you ask for emergency help or use directions. We use safety steps to keep your information private. ResQ follows ISO 27001, HIPAA, and Ayushman Bharat Digital Mission (ABDM) rules.',
  },
  {
    id: 'faq-6',
    category: 'Responder Integration',
    question: 'Can ambulance drivers say when they are working?',
    answer:
      'Yes. Approved drivers can choose “Working” or “Not working” in ResQ. Only drivers who are working and have a working location signal can get a new trip.',
  },
  {
    id: 'faq-7',
    category: 'Live GPS Telemetry',
    question: 'How does ResQ track an ambulance and guess its arrival time?',
    answer:
      'ResQ uses the ambulance’s location and traffic updates to guess when it may arrive. The time can change if there is traffic or a road is closed.',
  },
  {
    id: 'faq-8',
    category: 'Compliance & Governance',
    question: 'Does ResQ replace emergency phone numbers 112 or 108?',
    answer:
      'No. ResQ works with emergency phone services 112 and 108. If someone is in danger, call 112 now. You can also ask for help in ResQ.',
  },
];

const CATEGORIES = [
  {
    id: 'Citizen SOS Setup',
    title: 'Ask for emergency help',
    description: 'Share your location and let trusted people know when you need help.',
    icon: ShieldAlert,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/20',
  },
  {
    id: 'Responder Integration',
    title: 'Ambulance teams',
    description: 'Learn about driver directions, work times, and ambulance trips.',
    icon: Ambulance,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
  },
  {
    id: 'Hospital Command',
    title: 'Hospitals',
    description: 'Learn how hospitals get ready and check for open beds.',
    icon: Building2,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
  },
  {
    id: 'Account & Privacy',
    title: 'Your account and privacy',
    description: 'Learn how ResQ keeps your account and health details safe.',
    icon: Lock,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
  },
  {
    id: 'Live GPS Telemetry',
    title: 'Location and trip updates',
    description: 'Learn how ResQ shares ambulance locations and trip updates.',
    icon: Radio,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/20',
  },
  {
    id: 'Compliance & Governance',
    title: 'Health and safety rules',
    description: 'Learn how ResQ checks work papers and follows health rules.',
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
            <span>ResQ help</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight text-white mb-6 leading-tight"
          >
            Need help?{' '}
            <span className="font-semibold text-gradient-crimson">
              We are here for you.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-base sm:text-lg text-zinc-400 font-light max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Find answers about asking for help, ambulance trips, hospitals, and your account.
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
                placeholder="Search for help..."
                aria-label="Search help"
                className="w-full h-14 pl-12 pr-28 rounded-2xl bg-white/[0.04] backdrop-blur-2xl border border-white/10 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 text-white text-sm outline-none transition-all placeholder:text-zinc-500 shadow-2xl shadow-black/80"
              />
              <div className="absolute right-3.5 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/10 text-[11px] font-mono text-zinc-400 pointer-events-none">
                <span>⌘</span>
                <span>K</span>
              </div>
            </div>

            {/* Quick Filter Tag Chips */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-xs font-mono">
              <span className="text-zinc-500 mr-1">Topics:</span>
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
                  {cat === 'All' ? 'All' : CATEGORIES.find((item) => item.id === cat)?.title ?? cat}
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
            <p className="overline text-rose-400 mb-2">Help topics</p>
            <h2 className="text-3xl sm:text-4xl font-light tracking-tight text-white">
              Choose a topic
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
                    <span>{isSelected ? 'Showing topic' : 'See help'}</span>
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
            <p className="overline text-rose-400 mb-2">Answers</p>
            <h2 className="text-3xl sm:text-4xl font-light tracking-tight text-white mb-3">
              Common questions
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 font-light">
              {filteredFaqs.length} {filteredFaqs.length === 1 ? 'answer' : 'answers'}
              {activeCategory !== 'All' ? ` about "${CATEGORIES.find((item) => item.id === activeCategory)?.title ?? activeCategory}"` : ''}.
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
                              <span>ResQ help</span>
                              <span>•</span>
                              <span className="text-zinc-400">
                                {CATEGORIES.find((item) => item.id === faq.category)?.title ?? faq.category}
                              </span>
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
                <p className="text-sm text-zinc-400">No answers found. Try another word.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveCategory('All');
                  }}
                  className="mt-3 text-xs font-mono text-rose-400 underline cursor-pointer"
                >
                  Clear search
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
              <span className="overline text-rose-400 mb-2 inline-block">More help</span>
              <h3 className="text-2xl sm:text-3xl font-light text-white tracking-tight mb-2">
                Still need help?
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 font-light leading-relaxed">
                Our team can help with hospitals, ambulance teams, or urgent problems any time.
              </p>
            </div>

            <div className="relative z-10 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <Link
                to={ROUTES.PUBLIC.CONTACT}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 shadow-lg shadow-rose-600/30 btn-shimmer transition-all"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Talk to our team</span>
              </Link>

              <Link
                to={ROUTES.PUBLIC.CONTACT}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-all"
              >
                <Bug className="h-4 w-4 text-amber-400" />
                <span>Report a problem</span>
              </Link>
            </div>

          </div>

        </div>
      </section>

    </div>
  );
};

export default HelpPage;

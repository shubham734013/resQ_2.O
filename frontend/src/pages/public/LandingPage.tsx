import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShieldAlert,
  Radio,
  Activity,
  Ambulance,
  Building2,
  Navigation,
  ArrowRight,
  ShieldCheck,
  Lock,
  Wifi,
  ChevronRight,
  Clock,
  Compass,
  Zap,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import { ROUTES } from '../../routes/routePaths';

interface TelemetryEvent {
  id: string;
  code: string;
  category: string;
  location: string;
  coordinates: string;
  eta: string;
  status: 'DISPATCHED' | 'IN_TRANSIT' | 'ARRIVED';
  time: string;
}

const INITIAL_EVENTS: TelemetryEvent[] = [
  {
    id: 'EV-8841',
    code: 'PRIORITY_ALPHA',
    category: 'Acute Cardiac Distress',
    location: 'Sector 4, Malviya Nagar',
    coordinates: '26.8532° N, 75.8174° E',
    eta: '3m 12s',
    status: 'IN_TRANSIT',
    time: '42s ago',
  },
  {
    id: 'EV-8840',
    code: 'PRIORITY_BRAVO',
    category: 'Pediatric Trauma Pre-Alert',
    location: 'C-Scheme Metro Crossing',
    coordinates: '26.9102° N, 75.8016° E',
    eta: '1m 45s',
    status: 'DISPATCHED',
    time: '1m ago',
  },
  {
    id: 'EV-8839',
    code: 'PRIORITY_CHARLIE',
    category: 'Multi-Vehicle Extrication',
    location: 'NH-48 Highway Bypass',
    coordinates: '26.9741° N, 75.7622° E',
    eta: 'Arrived at ER',
    status: 'ARRIVED',
    time: '3m ago',
  },
];

export const LandingPage = () => {
  const navigate = useNavigate();

  // Mouse spotlight coordinates
  const heroRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });
  };

  // Simulated live telemetry stream counter
  const [activeUnits, setActiveUnits] = useState(148);
  const [systemPing, setSystemPing] = useState(14);
  const [events] = useState<TelemetryEvent[]>(INITIAL_EVENTS);

  useEffect(() => {
    const interval = setInterval(() => {
      setSystemPing(12 + Math.floor(Math.random() * 5));
      if (Math.random() > 0.6) {
        setActiveUnits(146 + Math.floor(Math.random() * 6));
      }
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#070709] text-white font-sans selection:bg-rose-500/20 selection:text-rose-200 overflow-x-hidden">

      {/* ─── 1. TOP STICKY GLASS NAVBAR ──────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50 bg-[#070709]/80 backdrop-blur-xl border-b border-white/[0.08] transition-all">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 h-20 flex items-center justify-between">
          
          {/* Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center shadow-lg shadow-rose-600/30 group-hover:scale-105 transition-transform">
              <ShieldAlert className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-white group-hover:text-rose-100 transition-colors">
                  resQ 2.O
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  Crisis v2.4
                </span>
              </div>
              <span className="text-[11px] font-mono text-zinc-400 tracking-wider">
                Emergency Response Fabric
              </span>
            </div>
          </Link>

          {/* Operational Status Pill (Desktop) */}
          <div className="hidden lg:flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] text-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-zinc-300 font-medium">resQ Network: Active & Operational</span>
            <span className="text-zinc-600">|</span>
            <span className="font-mono text-[11px] text-zinc-400">{systemPing}ms ping</span>
          </div>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <a href="#capabilities" className="hover:text-white transition-colors">Capabilities</a>
            <a href="#telemetry" className="hover:text-white transition-colors">Live Telemetry</a>
            <a href="#protocol" className="hover:text-white transition-colors">Crisis Protocol</a>
            <a href="#architecture" className="hover:text-white transition-colors">Architecture</a>
          </nav>

          {/* Quick Action CTAs */}
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              to={ROUTES.PUBLIC.LOGIN}
              className="hidden sm:inline-flex items-center px-4 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors"
            >
              Sign In
            </Link>

            <Link
              to={ROUTES.PUBLIC.REGISTER}
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-semibold text-white bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 hover:border-white/20 transition-all shadow-sm"
            >
              Create Account
            </Link>

            <button
              type="button"
              onClick={() => navigate(ROUTES.USER.EMERGENCY)}
              className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 shadow-md shadow-rose-600/30 btn-shimmer transition-all cursor-pointer"
            >
              <ShieldAlert className="h-4 w-4 animate-pulse" />
              <span className="hidden xs:inline">SOS</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── 2. HERO SECTION ─────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        onMouseMove={handleMouseMove}
        className="relative pt-36 pb-24 md:pt-48 md:pb-36 overflow-hidden mesh-bg grid-texture"
      >
        {/* Dynamic Mouse-tracking Ambient Glow */}
        <div
          className="pointer-events-none absolute inset-0 opacity-40 transition-opacity duration-500"
          style={{
            background: `radial-gradient(650px circle at ${mousePos.x}% ${mousePos.y}%, rgba(244, 63, 94, 0.15), rgba(245, 158, 11, 0.05) 45%, transparent 70%)`,
          }}
        />

        {/* Ambient background soft orb highlights */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[850px] h-[500px] bg-rose-600/10 rounded-full blur-[140px]" />
        <div className="pointer-events-none absolute top-1/3 -right-32 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[160px]" />

        <div className="relative max-w-6xl mx-auto px-6 lg:px-12 text-center">

          {/* Operational Status Pill */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/[0.04] backdrop-blur-xl border border-white/10 shadow-lg shadow-black/40 mb-8"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
            </span>
            <span className="text-xs font-semibold text-zinc-200 tracking-wide">
              resQ Network: Active & Operational
            </span>
            <span className="text-zinc-600">•</span>
            <span className="text-xs font-mono text-amber-400/90 font-medium">
              Mean Dispatch SLA: 3m 42s
            </span>
          </motion.div>

          {/* Hero Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-extralight tracking-tight text-white leading-[1.08] mb-8"
          >
            Zero-Latency Crisis Orchestration.{' '}
            <span className="font-semibold block mt-2 text-gradient-crimson">
              Synchronized in Real-Time.
            </span>
          </motion.h1>

          {/* Subheading with generous line-height */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-lg sm:text-xl text-zinc-400 font-light leading-relaxed max-w-3xl mx-auto mb-12"
          >
            Unifying citizen SOS triggers, paramedic live telematics, and hospital trauma command into a synchronized, zero-friction emergency response fabric.
          </motion.p>

          {/* Dual Call-to-Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-16"
          >
            {/* Primary Crimson Shimmer Button */}
            <button
              type="button"
              onClick={() => navigate(ROUTES.USER.EMERGENCY)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-base font-bold text-white bg-gradient-to-r from-rose-600 via-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 shadow-xl shadow-rose-600/35 border border-rose-400/30 btn-shimmer active:scale-[0.98] transition-all cursor-pointer"
            >
              <ShieldAlert className="h-5 w-5 text-white animate-pulse" />
              <span>Report Emergency Now</span>
              <ArrowRight className="h-4 w-4 ml-1 opacity-80" />
            </button>

            {/* Glass Outline Button */}
            <a
              href="#telemetry"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-base font-semibold text-zinc-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.07] backdrop-blur-xl border border-white/10 hover:border-white/20 shadow-lg active:scale-[0.98] transition-all cursor-pointer"
            >
              <Compass className="h-5 w-5 text-amber-400" />
              <span>Explore Network / Dispatch</span>
            </a>
          </motion.div>

          {/* Live Micro-Badge Row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs font-mono text-zinc-400"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Sub-45s Dispatch Matching</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>HIPAA & ISO 27001 Certified</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>99.99% Benchmark Uptime</span>
            </div>
          </motion.div>

        </div>
      </section>

      {/* ─── 3. LIVE TELEMETRY & NETWORK MONITOR ──────────────────────────── */}
      <section id="telemetry" className="py-20 lg:py-28 relative border-t border-b border-white/[0.06] bg-[#090a0d]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">

          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div>
              <p className="overline mb-3 text-rose-400 flex items-center gap-2">
                <Radio className="h-3.5 w-3.5 text-rose-500 animate-pulse" />
                Live Fleet & Clinical Telemetry
              </p>
              <h2 className="text-3xl sm:text-4xl font-light tracking-tight text-white">
                Synchronized Regional Dispatch Feed
              </h2>
            </div>
            <p className="text-sm text-zinc-400 max-w-md font-light leading-relaxed">
              Real-time stream of geolocation pings, hospital trauma alerts, and fleet status across the urban network.
            </p>
          </div>

          {/* 4 Telemetry Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            
            <div className="spotlight-card p-8">
              <div className="flex items-center justify-between text-zinc-400 mb-4">
                <span className="text-xs uppercase font-mono tracking-wider">Avg Response SLA</span>
                <Clock className="h-4 w-4 text-amber-400" />
              </div>
              <div className="text-3xl sm:text-4xl font-light text-white tracking-tight font-mono mb-2">
                3m 42s
              </div>
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <span>↓ 18s vs provincial benchmark</span>
              </div>
            </div>

            <div className="spotlight-card p-8">
              <div className="flex items-center justify-between text-zinc-400 mb-4">
                <span className="text-xs uppercase font-mono tracking-wider">Active Fleet Units</span>
                <Ambulance className="h-4 w-4 text-rose-400" />
              </div>
              <div className="text-3xl sm:text-4xl font-light text-white tracking-tight font-mono mb-2">
                {activeUnits}
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>ALS / BLS units connected</span>
              </div>
            </div>

            <div className="spotlight-card p-8">
              <div className="flex items-center justify-between text-zinc-400 mb-4">
                <span className="text-xs uppercase font-mono tracking-wider">ER Triage Readiness</span>
                <Building2 className="h-4 w-4 text-sapphire" />
              </div>
              <div className="text-3xl sm:text-4xl font-light text-white tracking-tight font-mono mb-2">
                98.4%
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span>24 verified trauma centers</span>
              </div>
            </div>

            <div className="spotlight-card p-8">
              <div className="flex items-center justify-between text-zinc-400 mb-4">
                <span className="text-xs uppercase font-mono tracking-wider">Telemetry Latency</span>
                <Wifi className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-3xl sm:text-4xl font-light text-white tracking-tight font-mono mb-2">
                {systemPing}ms
              </div>
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <span>Zero-packet loss WebSocket</span>
              </div>
            </div>

          </div>

          {/* Interactive Live Crisis Dispatch Feed Table */}
          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.08] p-6 lg:p-8 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-4 mb-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                <span className="text-xs font-mono uppercase tracking-widest text-zinc-300">
                  Active Dispatch Corridor (Jaipur Metro)
                </span>
              </div>
              <span className="text-xs font-mono text-zinc-500">Auto-refresh: 1000ms</span>
            </div>

            <div className="space-y-4">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl bg-white/[0.015] hover:bg-white/[0.035] border border-white/[0.04] hover:border-white/10 transition-colors gap-4"
                >
                  <div className="flex items-start md:items-center gap-4">
                    <div className="h-9 w-9 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0 border border-white/[0.06]">
                      <Activity className="h-4 w-4 text-rose-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-bold text-white">{ev.id}</span>
                        <span className="text-xs text-zinc-300 font-medium">{ev.category}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-500 mt-1">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-zinc-400" />
                          {ev.location}
                        </span>
                        <span className="hidden sm:inline text-zinc-600">•</span>
                        <span className="hidden sm:inline text-zinc-400">{ev.coordinates}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end md:self-center">
                    <div className="text-right">
                      <span className="text-xs font-mono font-medium text-amber-400 block">
                        ETA {ev.eta}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">{ev.time}</span>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-mono font-semibold tracking-wider ${
                        ev.status === 'IN_TRANSIT'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : ev.status === 'DISPATCHED'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {ev.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* ─── 4. CAPABILITIES BENTO GRID ──────────────────────────────────── */}
      <section id="capabilities" className="py-24 lg:py-36 relative">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">

          {/* Section Heading */}
          <div className="text-center max-w-3xl mx-auto mb-20">
            <p className="overline mb-3 text-rose-400">Intelligent Architecture</p>
            <h2 className="text-3xl sm:text-5xl font-light tracking-tight text-white mb-6">
              Engineered for Seconds That Matter.
            </h2>
            <p className="text-base sm:text-lg text-zinc-400 font-light leading-relaxed">
              Every millisecond saved translates directly to surviving trauma, stroke, and cardiac arrest. ResQ re-architects the entire emergency workflow.
            </p>
          </div>

          {/* 3-Column Bento Grid with generous card margins (gap-8) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

            {/* Bento Card 1: Autonomous Dispatch (Wide Span on Large Screens) */}
            <div className="spotlight-card p-10 lg:p-12 flex flex-col justify-between group">
              <div>
                <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-8 group-hover:scale-110 transition-transform">
                  <Zap className="h-6 w-6" />
                </div>
                <p className="overline mb-2 text-rose-400">Algorithmic Pairing</p>
                <h3 className="text-2xl font-light text-white tracking-tight mb-4">
                  Autonomous Fleet Dispatch
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed font-light">
                  Continuous geospatial scoring matches the closest certified Advanced Life Support (ALS) vehicle within 45 seconds, factoring in live traffic flow and hospital ICU vacancies.
                </p>
              </div>
              <div className="mt-8 pt-6 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono text-zinc-400">
                <span>Matching latency: &lt; 45s</span>
                <ChevronRight className="h-4 w-4 text-zinc-500 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Bento Card 2: Hospital Pre-Alert */}
            <div className="spotlight-card p-10 lg:p-12 flex flex-col justify-between group">
              <div>
                <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-8 group-hover:scale-110 transition-transform">
                  <Activity className="h-6 w-6" />
                </div>
                <p className="overline mb-2 text-amber-400">Clinical Telematics</p>
                <h3 className="text-2xl font-light text-white tracking-tight mb-4">
                  Hospital Trauma Pre-Alerts
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed font-light">
                  Emergency rooms receive real-time telemetry, ECG vitals, and incoming patient ETA prior to arrival, allowing surgical and trauma squads to scrub in before the ambulance doors open.
                </p>
              </div>
              <div className="mt-8 pt-6 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono text-zinc-400">
                <span>Pre-arrival prep: 100% sync</span>
                <ChevronRight className="h-4 w-4 text-zinc-500 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Bento Card 3: 1-Tap Geolocation SOS */}
            <div className="spotlight-card p-10 lg:p-12 flex flex-col justify-between group">
              <div>
                <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-8 group-hover:scale-110 transition-transform">
                  <Navigation className="h-6 w-6" />
                </div>
                <p className="overline mb-2 text-rose-400">Zero-Friction Access</p>
                <h3 className="text-2xl font-light text-white tracking-tight mb-4">
                  1-Tap Citizen Geolocation
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed font-light">
                  Pinpoint sub-meter GPS beaconing instantly relays user coordinates and medical history to regional emergency dispatchers with zero redundant voice friction.
                </p>
              </div>
              <div className="mt-8 pt-6 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono text-zinc-400">
                <span>Location accuracy: ± 3.2m</span>
                <ChevronRight className="h-4 w-4 text-zinc-500 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Bento Card 4: Zero-Trust Security */}
            <div className="spotlight-card p-10 lg:p-12 flex flex-col justify-between group">
              <div>
                <div className="h-12 w-12 rounded-2xl bg-sapphire-dim border border-blue-500/20 flex items-center justify-center text-blue-400 mb-8 group-hover:scale-110 transition-transform">
                  <Lock className="h-6 w-6" />
                </div>
                <p className="overline mb-2 text-blue-400">Defense-in-Depth</p>
                <h3 className="text-2xl font-light text-white tracking-tight mb-4">
                  Zero-Trust Clinical Security
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed font-light">
                  End-to-end encrypted medical data pipelines adhering to HIPAA and ISO 27001 guidelines, complete with immutable audit logs and role-based access gates.
                </p>
              </div>
              <div className="mt-8 pt-6 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono text-zinc-400">
                <span>AES-256 telemetry corridor</span>
                <ChevronRight className="h-4 w-4 text-zinc-500 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Bento Card 5: Mesh Survivability */}
            <div className="spotlight-card p-10 lg:p-12 flex flex-col justify-between group">
              <div>
                <div className="h-12 w-12 rounded-2xl bg-emerald-dim border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-8 group-hover:scale-110 transition-transform">
                  <Wifi className="h-6 w-6" />
                </div>
                <p className="overline mb-2 text-emerald-400">Resilient Backbone</p>
                <h3 className="text-2xl font-light text-white tracking-tight mb-4">
                  Mesh Edge Survivability
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed font-light">
                  Designed for crisis conditions. Offline-capable edge caching and automated fallback pathways guarantee emergency packet delivery even during cellular network degradation.
                </p>
              </div>
              <div className="mt-8 pt-6 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono text-zinc-400">
                <span>Offline queue sync: Guaranteed</span>
                <ChevronRight className="h-4 w-4 text-zinc-500 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Bento Card 6: Unified Multi-Agency Dispatch */}
            <div className="spotlight-card p-10 lg:p-12 flex flex-col justify-between group">
              <div>
                <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-8 group-hover:scale-110 transition-transform">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <p className="overline mb-2 text-amber-400">Cross-Platform Governance</p>
                <h3 className="text-2xl font-light text-white tracking-tight mb-4">
                  Unified Agency Command
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed font-light">
                  A single pane of glass uniting hospitals, private and public ambulance fleets, and municipal first-responders with zero departmental communication silos.
                </p>
              </div>
              <div className="mt-8 pt-6 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono text-zinc-400">
                <span>Universal role-based access</span>
                <ChevronRight className="h-4 w-4 text-zinc-500 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ─── 5. CRISIS PROTOCOL PIPELINE ─────────────────────────────────── */}
      <section id="protocol" className="py-24 lg:py-32 bg-[#090a0d] border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">

          <div className="text-center max-w-3xl mx-auto mb-20">
            <p className="overline mb-3 text-rose-400">Operational Lifecycle</p>
            <h2 className="text-3xl sm:text-4xl font-light tracking-tight text-white mb-4">
              Synchronized 4-Stage Protocol
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 font-light leading-relaxed">
              From first beacon activation to surgical handoff: every transition is automated and telemetrically verified.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            
            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.08] relative">
              <span className="text-xs font-mono text-rose-400 font-bold mb-4 block">01 / STAGE</span>
              <h4 className="text-lg font-medium text-white mb-2">Instant Beacon</h4>
              <p className="text-xs text-zinc-400 leading-relaxed font-light">
                Citizen presses SOS. High-accuracy GPS coordinates and pre-configured medical profile are broadcast in under 200ms.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.08] relative">
              <span className="text-xs font-mono text-amber-400 font-bold mb-4 block">02 / STAGE</span>
              <h4 className="text-lg font-medium text-white mb-2">Fleet Matching</h4>
              <p className="text-xs text-zinc-400 leading-relaxed font-light">
                Nearest certified ALS unit is locked and dispatched with turn-by-turn dynamic routing and green-corridor priority.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.08] relative">
              <span className="text-xs font-mono text-blue-400 font-bold mb-4 block">03 / STAGE</span>
              <h4 className="text-lg font-medium text-white mb-2">Live Telematics</h4>
              <p className="text-xs text-zinc-400 leading-relaxed font-light">
                Vital signs, audio notes, and precise ETA stream directly from the ambulance into the receiving hospital's triage room.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.08] relative">
              <span className="text-xs font-mono text-emerald-400 font-bold mb-4 block">04 / STAGE</span>
              <h4 className="text-lg font-medium text-white mb-2">Clinical Handoff</h4>
              <p className="text-xs text-zinc-400 leading-relaxed font-light">
                Trauma bay is scrubbed and bed allocated prior to physical arrival. Zero delay in patient transfer to critical care.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ─── 6. BOTTOM CALL-TO-ACTION CARD ───────────────────────────────── */}
      <section className="py-24 lg:py-36 relative">
        <div className="max-w-5xl mx-auto px-6 lg:px-12">
          
          <div className="relative rounded-3xl p-10 sm:p-16 overflow-hidden bg-gradient-to-b from-white/[0.05] to-white/[0.01] border border-white/10 shadow-2xl backdrop-blur-2xl text-center">
            
            {/* Ambient inner crimson radial glow */}
            <div className="pointer-events-none absolute inset-0 -top-24 bg-rose-500/10 rounded-full blur-[100px]" />

            <div className="relative z-10">
              <span className="overline text-rose-400 mb-4 inline-block">Deploy ResQ 2.O</span>
              <h2 className="text-3xl sm:text-5xl font-light tracking-tight text-white mb-6">
                Ready to Safeguard Your Community?
              </h2>
              <p className="text-base sm:text-lg text-zinc-300 font-light max-w-2xl mx-auto mb-10 leading-relaxed">
                Join certified hospitals, fleet operators, and over 120,000 citizens connected to Rajasthan's zero-latency emergency network.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  to={ROUTES.PUBLIC.REGISTER}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 shadow-xl shadow-rose-600/30 btn-shimmer transition-all"
                >
                  <span>Create Account</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <Link
                  to={ROUTES.PUBLIC.LOGIN}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl text-sm font-semibold text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-all"
                >
                  <span>Sign In to Portal</span>
                </Link>
              </div>

              <div className="mt-8 text-xs font-mono text-zinc-500">
                National Emergency Hotline: Call 112 for immediate dispatch
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ─── 7. PRODUCTION-READY MINIMALIST FOOTER ────────────────────────── */}
      <footer className="border-t border-white/[0.06] bg-[#050507] py-14 text-xs font-mono text-zinc-500">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col md:flex-row items-center justify-between gap-6">
          
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-rose-600/20 flex items-center justify-center text-rose-400 border border-rose-500/30">
              <ShieldAlert className="h-3.5 w-3.5" />
            </div>
            <span className="text-zinc-300 font-sans font-bold">resQ 2.O</span>
            <span className="text-zinc-600">•</span>
            <span>Emergency Crisis Telemetry & Dispatch Infrastructure</span>
          </div>

          <div className="flex items-center gap-6 text-zinc-400">
            <Link to="/about" className="hover:text-white transition-colors">About</Link>
            <Link to="/help" className="hover:text-white transition-colors">Support & Help</Link>
            <Link to="/contact" className="hover:text-white transition-colors">Contact Operations</Link>
            <Link to={ROUTES.PUBLIC.LOGIN} className="hover:text-white transition-colors">Portal Sign In</Link>
          </div>

          <div>
            © {new Date().getFullYear()} ResQ Technologies. All rights reserved.
          </div>

        </div>
      </footer>

    </div>
  );
};

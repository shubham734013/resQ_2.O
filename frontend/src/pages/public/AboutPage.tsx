import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  HeartPulse,
  Compass,
  Building2,
  Ambulance,
  Radio,
  Lock,
  Wifi,
  Zap,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Layers,
} from 'lucide-react';
import { ROUTES } from '../../routes/routePaths';

export const AboutPage = () => {
  return (
    <div className="bg-[#070709] text-white font-sans selection:bg-rose-500/20 selection:text-rose-200 overflow-hidden">
      
      {/* ─── 1. HERO SECTION ─────────────────────────────────────────────── */}
      <section className="relative pt-24 pb-20 md:pt-32 md:pb-28 overflow-hidden mesh-bg grid-texture">
        {/* Ambient Crimson Background Glow */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[550px] bg-rose-600/10 rounded-full blur-[140px]" />
        <div className="pointer-events-none absolute top-1/2 -right-32 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[160px]" />

        <div className="relative max-w-5xl mx-auto px-6 lg:px-12 text-center">
          
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.04] backdrop-blur-xl border border-white/10 text-xs text-rose-300 font-mono mb-8"
          >
            <HeartPulse className="h-4 w-4 text-rose-500 animate-pulse" />
            <span>Health and emergency help</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-4xl sm:text-6xl font-light tracking-tight text-white leading-[1.12] mb-8"
          >
            Making emergency care{' '}
            <span className="font-semibold block mt-1 text-gradient-crimson">
              easier to reach.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-lg sm:text-xl text-zinc-400 font-light leading-relaxed max-w-3xl mx-auto mb-12"
          >
            ResQ 2.O helps people, ambulance teams, and hospitals work together when someone needs urgent medical care.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <Link
              to={ROUTES.USER.EMERGENCY}
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 shadow-xl shadow-rose-600/30 btn-shimmer transition-all"
            >
              <HeartPulse className="h-4 w-4 animate-pulse" />
              <span>Ask for emergency help</span>
              <ArrowRight className="h-4 w-4 opacity-75" />
            </Link>

            <Link
              to={ROUTES.PUBLIC.EXPLORE}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold text-zinc-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 transition-all"
            >
              <Compass className="h-4 w-4 text-amber-400" />
              <span>Find a hospital</span>
            </Link>
          </motion.div>

        </div>
      </section>

      {/* ─── 2. OUR MISSION & VISION GRID ─────────────────────────────────── */}
      <section className="py-20 lg:py-28 relative border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="overline text-rose-400 mb-2">Our goal</p>
            <h2 className="text-3xl sm:text-4xl font-light tracking-tight text-white">
              Why we made ResQ
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
            
            {/* Card 1: Our Mission */}
            <div className="spotlight-card p-10 lg:p-14 flex flex-col justify-between">
              <div>
                <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-8">
                  <Zap className="h-6 w-6" />
                </div>
                <p className="overline text-rose-400 mb-2">What we do</p>
                <h3 className="text-2xl sm:text-3xl font-light tracking-tight text-white mb-5">
                  Our Mission
                </h3>
                <p className="text-base text-zinc-300 leading-relaxed font-light mb-6">
                  We help people get care sooner after a serious injury, heart problem, or stroke.
                </p>
                <p className="text-sm text-zinc-400 leading-relaxed font-light">
                  ResQ helps find an available ambulance, share directions, and tell the hospital about the person’s health before the ambulance arrives.
                </p>
              </div>

              <div className="mt-8 pt-6 border-t border-white/[0.06] flex items-center gap-3 text-xs font-mono text-zinc-400">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Fast help with fewer phone calls</span>
              </div>
            </div>

            {/* Card 2: Our Vision */}
            <div className="spotlight-card p-10 lg:p-14 flex flex-col justify-between">
              <div>
                <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-8">
                  <Compass className="h-6 w-6" />
                </div>
                <p className="overline text-amber-400 mb-2">What we hope for</p>
                <h3 className="text-2xl sm:text-3xl font-light tracking-tight text-white mb-5">
                  Our Vision
                </h3>
                <p className="text-base text-zinc-300 leading-relaxed font-light mb-6">
                  We want people, hospitals, and ambulance teams across India to work well together so everyone can get help.
                </p>
                <p className="text-sm text-zinc-400 leading-relaxed font-light">
                  ResQ can share open bed details, ambulance locations, and traffic updates to help care teams get ready.
                </p>
              </div>

              <div className="mt-8 pt-6 border-t border-white/[0.06] flex items-center gap-3 text-xs font-mono text-zinc-400">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Care teams working together</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ─── 3. PLATFORM ARCHITECTURE TIMELINE FLOW ───────────────────────── */}
      <section className="py-24 lg:py-32 bg-[#090a0d] border-t border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          
          <div className="text-center max-w-3xl mx-auto mb-20">
            <p className="overline text-rose-400 mb-2">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-light tracking-tight text-white mb-4">
              How ResQ helps in an emergency
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 font-light leading-relaxed">
              When someone asks for help, ResQ shares their location with nearby ambulance teams and hospitals.
            </p>
          </div>

          {/* 4-Stage Horizontal/Vertical Timeline Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">

            {/* Stage 1 */}
            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.08] flex flex-col justify-between group hover:border-rose-500/30 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <span className="font-mono text-xs font-bold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
                    STEP 1
                  </span>
                  <span className="font-mono text-[11px] text-zinc-500">Under 1 second</span>
                </div>
                <div className="h-10 w-10 rounded-xl bg-white/[0.04] flex items-center justify-center text-rose-400 mb-4 border border-white/[0.06]">
                  <Radio className="h-5 w-5" />
                </div>
                <h4 className="text-lg font-medium text-white mb-2">Ask for help</h4>
                <p className="text-xs text-zinc-400 font-light leading-relaxed">
                  A person asks for help. ResQ can send their location, saved health details, and trusted contacts.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/[0.06] text-[11px] font-mono text-zinc-500">
                Safe data link
              </div>
            </div>

            {/* Stage 2 */}
            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.08] flex flex-col justify-between group hover:border-amber-500/30 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                    STEP 2
                  </span>
                  <span className="font-mono text-[11px] text-zinc-500">Under 30 seconds</span>
                </div>
                <div className="h-10 w-10 rounded-xl bg-white/[0.04] flex items-center justify-center text-amber-400 mb-4 border border-white/[0.06]">
                  <Ambulance className="h-5 w-5" />
                </div>
                <h4 className="text-lg font-medium text-white mb-2">Find an ambulance</h4>
                <p className="text-xs text-zinc-400 font-light leading-relaxed">
                  ResQ looks for a nearby available ambulance that can give the right kind of care. It can share directions with the driver.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/[0.06] text-[11px] font-mono text-zinc-500">
                Map and directions
              </div>
            </div>

            {/* Stage 3 */}
            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.08] flex flex-col justify-between group hover:border-blue-500/30 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
                    STEP 3
                  </span>
                  <span className="font-mono text-[11px] text-zinc-500">                  On the way</span>
                </div>
                <div className="h-10 w-10 rounded-xl bg-white/[0.04] flex items-center justify-center text-blue-400 mb-4 border border-white/[0.06]">
                  <Cpu className="h-5 w-5" />
                </div>
                <h4 className="text-lg font-medium text-white mb-2">Share health updates</h4>
                <p className="text-xs text-zinc-400 font-light leading-relaxed">
                  The ambulance team can share health signs and notes with the hospital, so the care team can get ready.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/[0.06] text-[11px] font-mono text-zinc-500">
                Health data rules: HL7 / FHIR
              </div>
            </div>

            {/* Stage 4 */}
            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.08] flex flex-col justify-between group hover:border-emerald-500/30 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                    STEP 4
                  </span>
                  <span className="font-mono text-[11px] text-zinc-500">Arrival</span>
                </div>
                <div className="h-10 w-10 rounded-xl bg-white/[0.04] flex items-center justify-center text-emerald-400 mb-4 border border-white/[0.06]">
                  <Building2 className="h-5 w-5" />
                </div>
                <h4 className="text-lg font-medium text-white mb-2">Hospital gets ready</h4>
                <p className="text-xs text-zinc-400 font-light leading-relaxed">
                  The hospital can prepare a room and care team before the ambulance arrives.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/[0.06] text-[11px] font-mono text-zinc-500">
                Ready to give care
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ─── 4. KEY METRICS & IMPACT SECTION ──────────────────────────────── */}
      <section className="py-24 lg:py-32 relative">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="overline text-rose-400 mb-2">ResQ numbers</p>
            <h2 className="text-3xl sm:text-4xl font-light tracking-tight text-white">
              How ResQ is used
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            
            <div className="spotlight-card p-10 text-center">
              <span className="font-mono text-4xl lg:text-5xl font-light text-white block mb-2 tracking-tight">
                Under 2.4 minutes
              </span>
              <p className="text-xs font-mono uppercase tracking-wider text-rose-400 mb-2">
                Average time to send help
              </p>
              <p className="text-xs text-zinc-400 font-light leading-relaxed">
                62% faster than regular emergency phone calls.
              </p>
            </div>

            <div className="spotlight-card p-10 text-center">
              <span className="font-mono text-4xl lg:text-5xl font-light text-white block mb-2 tracking-tight">
                99.99%
              </span>
              <p className="text-xs font-mono uppercase tracking-wider text-emerald-400 mb-2">
                Time ResQ is working
              </p>
              <p className="text-xs text-zinc-400 font-light leading-relaxed">
                ResQ aims to work 99.99% of the time in Jaipur.
              </p>
            </div>

            <div className="spotlight-card p-10 text-center">
              <span className="font-mono text-4xl lg:text-5xl font-light text-white block mb-2 tracking-tight">
                140+
              </span>
              <p className="text-xs font-mono uppercase tracking-wider text-amber-400 mb-2">
                Hospitals for serious injury and intensive care
              </p>
              <p className="text-xs text-zinc-400 font-light leading-relaxed">
                Hospitals share live updates about open beds.
              </p>
            </div>

            <div className="spotlight-card p-10 text-center">
              <span className="font-mono text-4xl lg:text-5xl font-light text-white block mb-2 tracking-tight">
                12,800+
              </span>
              <p className="text-xs font-mono uppercase tracking-wider text-blue-400 mb-2">
                Emergency calls helped
              </p>
              <p className="text-xs text-zinc-400 font-light leading-relaxed">
                Emergency calls where teams shared updates.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ─── 5. ARCHITECTURAL VALUES & GOVERNANCE ──────────────────────────── */}
      <section className="py-20 lg:py-28 bg-[#090a0d] border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/10">
              <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 mb-5">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">Keep health details safe</h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-light">
                ResQ locks health details when it sends or saves them. Only people who need these details for care can see them.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/10">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 mb-5">
                <Wifi className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">Help when service is weak</h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-light">
                ResQ can try to send an emergency message by text if phone data is not working. This may not work everywhere. Call 112 if someone needs help now.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/10">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-5">
                <Layers className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">Follow health data rules</h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-light">
                ResQ follows India's Ayushman Bharat Digital Mission (ABDM), India's health data program, and HL7 / FHIR rules for sharing health details safely.
              </p>
            </div>

          </div>

        </div>
      </section>

    </div>
  );
};

export default AboutPage;

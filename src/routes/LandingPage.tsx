/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowRight,
  Sparkles,
  Layers,
  Sliders,
  Sun,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Brush,
  Zap,
  FolderOpen,
  Eye,
  Check,
  Compass,
  RotateCcw,
} from 'lucide-react';
import { useShell } from '../shell/ShellContext.tsx';
import neonCityHeroArt from '../assets/images/Neon_city.png';
import fantasyHarmonization02Art from '../assets/images/Fantasy_Harmonization_02.png';
import desertGoldArt from '../assets/images/Desert_Gold.png';
import jungleEmeraldArt from '../assets/images/Jungle_Emerald.png';
import iceBlueArt from '../assets/images/Ice_Blue.png';
import anatomyOfSoulArt from '../assets/images/Anatomy_of_soul.png';
import cosmicFrontierArt from '../assets/images/Cosmic_Frontier.png';
import atlantisArtPart1 from '../assets/images/Cyberpank_Atlantis_1.png';
import atlantisArtPart2 from '../assets/images/Cyberpank_Atlantis_2.png';
import atlantisArtPart3 from '../assets/images/Cyberpank_Atlantis_3.png';

export const LandingPage: React.FC = () => {
  const { navigateTo, openProject, projects } = useShell();

  // Section 2: Interactive Before/After Comparison & Demo Scene State
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [isDraggingSlider, setIsDraggingSlider] = useState<boolean>(false);
  const viewerRef = useRef<HTMLDivElement>(null);

  // Three Styled Regulators for Transformation Viewer
  const [colorMatching, setColorMatching] = useState<number>(80);
  const [lighting, setLighting] = useState<number>(75);
  const [atmosphere, setAtmosphere] = useState<number>(65);

  const updateSliderPosition = useCallback((clientX: number) => {
    if (!viewerRef.current) return;
    const rect = viewerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(percent);
  }, []);

  const handleSliderMouseDown = (e: React.MouseEvent) => {
    setIsDraggingSlider(true);
    updateSliderPosition(e.clientX);
  };

  const handleSliderTouchStart = (e: React.TouchEvent) => {
    setIsDraggingSlider(true);
    if (e.touches.length > 0) {
      updateSliderPosition(e.touches[0].clientX);
    }
  };

  const handleSliderTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      updateSliderPosition(e.touches[0].clientX);
    }
  };

  useEffect(() => {
    if (!isDraggingSlider) return;
    const onMouseMove = (e: MouseEvent) => {
      updateSliderPosition(e.clientX);
    };
    const onMouseUp = () => {
      setIsDraggingSlider(false);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        updateSliderPosition(e.touches[0].clientX);
      }
    };
    const onTouchEnd = () => {
      setIsDraggingSlider(false);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDraggingSlider, updateSliderPosition]);

  const [compareSplit, setCompareSplit] = useState<number>(50);
  const [isDraggingCompare, setIsDraggingCompare] = useState<boolean>(false);
  const compareViewerRef = useRef<HTMLDivElement>(null);

  const updateComparePosition = useCallback((clientX: number) => {
    if (!compareViewerRef.current) return;
    const rect = compareViewerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setCompareSplit(percent);
  }, []);

  const handleCompareMouseDown = (e: React.MouseEvent) => {
    setIsDraggingCompare(true);
    updateComparePosition(e.clientX);
  };

  const handleCompareTouchStart = (e: React.TouchEvent) => {
    setIsDraggingCompare(true);
    if (e.touches.length > 0) {
      updateComparePosition(e.touches[0].clientX);
    }
  };

  const handleCompareTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      updateComparePosition(e.touches[0].clientX);
    }
  };

  const handleCompareKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setCompareSplit((prev) => Math.max(0, prev - (e.shiftKey ? 10 : 2)));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setCompareSplit((prev) => Math.min(100, prev + (e.shiftKey ? 10 : 2)));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setCompareSplit(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setCompareSplit(100);
    }
  };

  useEffect(() => {
    if (!isDraggingCompare) return;
    const onMouseMove = (e: MouseEvent) => {
      updateComparePosition(e.clientX);
    };
    const onMouseUp = () => {
      setIsDraggingCompare(false);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        updateComparePosition(e.touches[0].clientX);
      }
    };
    const onTouchEnd = () => {
      setIsDraggingCompare(false);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDraggingCompare, updateComparePosition]);
  const [isAnnualBilling, setIsAnnualBilling] = useState<boolean>(true);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Subtle Parallax State for Hero Artwork Frame
  const [heroTilt, setHeroTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleHeroMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 8;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 8;
    setHeroTilt({ x, y });
  };

  const handleHeroMouseLeave = () => {
    setHeroTilt({ x: 0, y: 0 });
  };

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen w-full bg-[#0D101A] text-[#D7DEED] selection:bg-[#7A1FA2]/40 selection:text-white font-sans antialiased overflow-x-hidden">
      {/* ========================================================================
          1. TOP BAR CONTRACT: One row, three zones separated by gap-8
          Zone 1: Single text element wordmark
          Zone 2: 4-5 concise single-line nav links
          Zone 3: 1 primary action button
      ======================================================================== */}
      <header className="sticky top-0 z-50 w-full h-14 bg-[#131724]/90 backdrop-blur-md border-b border-[#293047] px-6 lg:px-12 flex items-center justify-between gap-8 shadow-[inset_0_1px_0_rgba(215,222,237,0.06)]">
        {/* Zone 1: Single text element wordmark */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-2.5 shrink-0 text-left cursor-pointer group focus:outline-none"
          title="Scroll to Top"
        >
          <div className="w-7 h-7 rounded-md bg-[#171B29] border border-[#7A1FA2]/70 group-hover:border-[#9135B7] flex items-center justify-center shadow-md shadow-black/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] transition-colors">
            <span className="w-3.5 h-3.5 border-2 border-[#D7DEED] rotate-45 flex items-center justify-center">
              <span className="w-1.5 h-1.5 bg-[#38BDF8] rounded-full" />
            </span>
          </div>
          <span className="text-base font-bold tracking-tight text-[#D7DEED] group-hover:text-white font-mono whitespace-nowrap transition-colors">
            AristoColors
          </span>
        </button>

        {/* Zone 2: 4-5 concise single-line nav links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#8E9AB8]">
          <a
            href="#capabilities"
            className="hover:text-[#D7DEED] transition-colors whitespace-nowrap shrink-0"
          >
            Capabilities
          </a>
          <a
            href="#demo"
            className="hover:text-[#D7DEED] transition-colors whitespace-nowrap shrink-0"
          >
            Live Relighting
          </a>
          <a
            href="#showcase"
            className="hover:text-[#D7DEED] transition-colors whitespace-nowrap shrink-0"
          >
            Production Plates
          </a>
          <a
            href="#pricing"
            className="hover:text-[#D7DEED] transition-colors whitespace-nowrap shrink-0"
          >
            Studio Plans
          </a>
          <a
            href="#faq"
            className="hover:text-[#D7DEED] transition-colors whitespace-nowrap shrink-0"
          >
            Architecture & FAQ
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => navigateTo('projects')}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-gradient-to-b from-[#8E24AA] to-[#7A1FA2] hover:from-[#9C27B0] hover:to-[#8E24AA] active:from-[#7A1FA2] active:to-[#642083] text-[#D7DEED] border border-[#BA68C8]/35 shadow-md shadow-black/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <span>Launch Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ========================================================================
          2. HERO SECTION
          Dominant focal carrier, clamp typography, concrete value proposition,
          adjacent proof strip, and live interactive harmonization canvas.
      ======================================================================== */}
      {/* ========================================================================
          2. HERO SECTION — Two-Column Premium Glossy Creative Studio
          Approved visual direction: Glossy Graphite + Purple Gradient + Cinematic Imagery
          Left: Strict 2-line headline, concise photobashing value prop, PANTONE 254 PC -> Ultra Violet buttons.
          Right: Neo-Futuristic Cyberpunk Metropolis concept art plate with subtle cinematic motion & depth.
      ======================================================================== */}
      <section className="relative pt-12 pb-16 lg:pt-16 lg:pb-24 px-6 lg:px-12 max-w-7xl mx-auto">
        {/* Layered graphite background with satin reflections & restrained ambient purple lighting */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 left-4 w-[520px] h-[520px] bg-gradient-to-br from-[#7A1FA2]/16 via-[#6F00FF]/10 to-transparent blur-[130px] rounded-full"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/4 -right-16 w-[580px] h-[580px] bg-gradient-to-bl from-[#6F00FF]/14 via-[#7A1FA2]/08 to-transparent blur-[140px] rounded-full"
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
          {/* LEFT COLUMN: Editorial Hierarchy, 2-Line Headline, Glossy Buttons */}
          <div className="lg:col-span-6 flex flex-col items-start text-left z-10">
            {/* Subtle graphite badge with satin border */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#171B29]/90 border border-[#293047] shadow-sm mb-6 shadow-[inset_0_1px_0_rgba(215,222,237,0.06)]">
              <span className="w-2 h-2 rounded-full bg-[#38BDF8] shadow-[0_0_8px_#38BDF8]" />
              <span className="text-xs font-semibold tracking-wide text-[#D7DEED]">
                Creative Freedom
              </span>
              <span className="text-[#5E6985]" aria-hidden="true">·</span>
              <span className="text-xs font-medium text-[#8E9AB8]">
                Powered by AristoColors
              </span>
            </div>

            {/* Headline: Strict maximum TWO lines on desktop, strong editorial typography */}
            <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-bold tracking-tight text-[#D7DEED] leading-[1.08] mb-6 max-w-xl">
              Create Worlds. Harmonize Styles.
            </h1>

            {/* Concise value proposition: photobashing, visual style matching & non-destructive editing */}
            <p className="text-base sm:text-lg text-[#8E9AB8] leading-relaxed max-w-xl mb-8">
              Professional color and lighting integration for concept artists. Seamlessly unify matte cutouts, 3D plates, and photographic textures with non-destructive atmospheric matching.
            </p>

            {/* Action Row: Primary Glossy PANTONE 254 PC -> Ultra Violet & Secondary Graphite Satin */}
            <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
              <button
                onClick={() => navigateTo('projects')}
                className="px-6 py-3.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-[#7A1FA2] via-[#8E24AA] to-[#6F00FF] hover:from-[#9135B7] hover:via-[#9C27B0] hover:to-[#7E1BFF] active:from-[#642083] active:to-[#5700CC] text-white border border-[#BA68C8]/45 shadow-xl shadow-black/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] hover:shadow-[0_8px_25px_rgba(111,0,255,0.35),inset_0_1px_0_rgba(255,255,255,0.4)] transition-all duration-200 cursor-pointer flex items-center gap-2.5 group"
              >
                <FolderOpen className="w-4 h-4 text-[#D7DEED] group-hover:scale-105 transition-transform" />
                <span>Open Projects Hub</span>
                <ArrowRight className="w-4 h-4 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <a
                href="#demo"
                className="px-6 py-3.5 text-sm font-semibold rounded-lg bg-gradient-to-b from-[#1C2233] to-[#171B29] hover:from-[#232B40] hover:to-[#1C2233] text-[#D7DEED] hover:text-white border border-[#293047] hover:border-[#6F00FF]/50 shadow-md shadow-black/50 shadow-[inset_0_1px_0_rgba(215,222,237,0.08)] hover:shadow-[0_4px_18px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.12)] transition-all duration-200 cursor-pointer flex items-center gap-2"
              >
                <Sliders className="w-4 h-4 text-[#38BDF8]" />
                <span>Explore Interactive Engine</span>
              </a>
            </div>

            {/* Editorial Feature Badges */}
            <div className="flex flex-wrap items-center gap-6 mt-10 pt-8 border-t border-[#293047]/80 text-xs text-[#8E9AB8]">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6F00FF]" />
                <span>Multi-Plate Color Matching</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6F00FF]" />
                <span>Directional Rim & Spill Lighting</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6F00FF]" />
                <span>Lossless 32-Bit Linear Stack</span>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Neo-Futuristic Cyberpunk Metropolis Key Art with Cinematic Motion */}
          <div className="lg:col-span-6 relative">
            <div
              onMouseMove={handleHeroMouseMove}
              onMouseLeave={handleHeroMouseLeave}
              className="relative rounded-2xl bg-gradient-to-b from-[#1C2233] to-[#171B29] border border-[#293047] p-2.5 sm:p-3 shadow-2xl shadow-black/90 shadow-[inset_0_1px_0_rgba(215,222,237,0.12)] transition-all duration-300"
            >
              {/* Cinematic Art Container */}
              <div className="relative rounded-xl overflow-hidden bg-[#0D101A] border border-[#293047]/80 aspect-[16/11]">
                {/* Neo-Futuristic Metropolis Concept Art Plate */}
                <img
                  src={neonCityHeroArt}
                  alt="AristoColors Neo-Tokyo Cyberpunk Metropolis Key Art"
                  className="w-full h-full object-cover select-none filter contrast-[1.05] saturate-[1.08]"
                  style={{
                    transform: `scale(1.05) translate3d(${-heroTilt.x * 0.5}px, ${-heroTilt.y * 0.5}px, 0)`,
                    transition: 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)',
                  }}
                  referrerPolicy="no-referrer"
                />

                {/* Subtle Cinematic Ambient Light Movement & Depth Layers */}
                <div
                  aria-hidden="true"
                  className="hero-ambient-light pointer-events-none absolute -inset-10 bg-radial from-[#6F00FF]/20 via-[#7A1FA2]/10 to-transparent mix-blend-screen"
                />
                <div
                  aria-hidden="true"
                  className="hero-atmosphere-drift pointer-events-none absolute -inset-x-16 inset-y-0 bg-gradient-to-r from-transparent via-[#BA68C8]/10 to-transparent mix-blend-soft-light"
                />
              </div>

              {/* Surface Gloss Bottom Status Bar */}
              <div className="flex items-center justify-between px-3 py-2 mt-2 text-[11px] text-[#8E9AB8] font-mono">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8]" />
                  Photobash Studio Viewport
                </span>
                <span className="text-[#D7DEED]">Unified Lighting & Color Space</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================
          3. SECTION 2: INTERACTIVE VIEWPORT — "FROM PIECES TO A COHESIVE WORLD"
          Harmonize colors, lighting, and atmosphere across different visual assets.
          Turn disconnected elements into one cinematic composition.
      ======================================================================== */}
      <section id="demo" className="relative py-20 lg:py-24 px-6 lg:px-12 max-w-7xl mx-auto border-t border-[#293047]/80">
        {/* Subtle ambient lighting orbs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-12 left-1/4 w-[500px] h-[500px] bg-gradient-to-br from-[#7A1FA2]/12 via-[#6F00FF]/08 to-transparent blur-[140px] rounded-full"
        />

        {/* 1. Header and USP: From Pieces to a Cohesive World */}
        <div className="mb-12">
          {/* Graphite badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#171B29]/90 border border-[#293047] shadow-sm mb-4 shadow-[inset_0_1px_0_rgba(215,222,237,0.06)]">
            <span className="w-2 h-2 rounded-full bg-[#6F00FF] shadow-[0_0_8px_#6F00FF]" />
            <span className="text-xs font-semibold tracking-wide text-[#D7DEED]">
              Photobash Harmonization Engine
            </span>
            <span className="text-[#5E6985]" aria-hidden="true">·</span>
            <span className="text-xs font-medium text-[#8E9AB8]">
              Interactive Viewport
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#D7DEED] mb-4 [text-wrap:balance]">
            From Pieces to a Cohesive World
          </h2>
          <p className="text-base sm:text-lg text-[#8E9AB8] max-w-3xl leading-relaxed mb-8">
            Harmonize colors, lighting, and atmosphere across different visual assets. Turn disconnected elements into one cinematic composition.
          </p>

          {/* Three Short Benefits: Unified Color, Consistent Lighting, Cohesive Atmosphere */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#171B29]/80 border border-[#293047] shadow-sm shadow-[inset_0_1px_0_rgba(215,222,237,0.06)] flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-[#7A1FA2]/20 border border-[#BA68C8]/30 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-[#BA68C8]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#D7DEED] mb-1">Unified Color</h3>
                <p className="text-xs sm:text-sm text-[#9CA8C4] leading-relaxed">
                  Matches color palettes, tints, and white balance across disconnected assets.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#171B29]/80 border border-[#293047] shadow-sm shadow-[inset_0_1px_0_rgba(215,222,237,0.06)] flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-[#38BDF8]/20 border border-[#38BDF8]/30 flex items-center justify-center shrink-0 mt-0.5">
                <Sun className="w-4 h-4 text-[#38BDF8]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#D7DEED] mb-1">Consistent Lighting</h3>
                <p className="text-xs sm:text-sm text-[#9CA8C4] leading-relaxed">
                  Integrates realistic environmental lighting, rim highlights, and contact shadows.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#171B29]/80 border border-[#293047] shadow-sm shadow-[inset_0_1px_0_rgba(215,222,237,0.06)] flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-[#6F00FF]/20 border border-[#6F00FF]/30 flex items-center justify-center shrink-0 mt-0.5">
                <Compass className="w-4 h-4 text-[#A78BFA]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#D7DEED] mb-1">Cohesive Atmosphere</h3>
                <p className="text-xs sm:text-sm text-[#9CA8C4] leading-relaxed">
                  Blends atmospheric depth, aerial perspective, and fog to unify all elements.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Interactive Transformation Interface: 2-Column Balanced Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT: Dominant Before / After Viewer */}
          <div className="lg:col-span-8">
            <div className="rounded-2xl bg-gradient-to-b from-[#1C2233] to-[#171B29] border border-[#293047] p-2 sm:p-2.5 shadow-2xl shadow-black/80 shadow-[inset_0_1px_0_rgba(215,222,237,0.12)]">
              {/* Interactive Before / After Canvas with exact aspect ratio of Fantasy_Harmonization_02.png (1672/941) */}
              <div
                ref={viewerRef}
                onMouseDown={handleSliderMouseDown}
                onTouchStart={handleSliderTouchStart}
                onTouchMove={handleSliderTouchMove}
                className="relative w-full aspect-[1672/941] rounded-xl overflow-hidden bg-[#0D101A] border border-[#293047] select-none cursor-ew-resize group touch-none"
              >
                {/* BOTTOM LAYER: BEFORE (Raw, Cold Cast, Desaturated, Dimmer Lighting) */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
                  <img
                    src={fantasyHarmonization02Art}
                    alt="Before - Raw Scene"
                    className="w-full h-full object-cover select-none pointer-events-none"
                    style={{
                      filter: 'saturate(0.52) contrast(0.85) brightness(0.86) hue-rotate(-22deg)',
                    }}
                  />
                  {/* Subtle cool environmental cast */}
                  <div
                    className="absolute inset-0 pointer-events-none bg-sky-950/20 mix-blend-color"
                    aria-hidden="true"
                  />
                </div>

                {/* TOP LAYER: AFTER (Original Vibrant Artwork + Harmonized Lighting), Clipped */}
                <div
                  className="absolute inset-0 overflow-hidden pointer-events-none select-none"
                  style={{
                    clipPath: `inset(0 0 0 ${sliderPos}%)`,
                  }}
                >
                  <img
                    src={fantasyHarmonization02Art}
                    alt="After - Harmonized Scene"
                    className="w-full h-full object-cover select-none pointer-events-none transition-all duration-100"
                    style={{
                      filter: `brightness(${0.94 + (lighting / 100) * 0.16}) contrast(${0.96 + (lighting / 100) * 0.1}) saturate(${0.92 + (colorMatching / 100) * 0.22})`,
                    }}
                  />
                  {/* Subtle Atmospheric Haze Gradient modulated by atmosphere */}
                  <div
                    className="absolute inset-0 pointer-events-none transition-opacity duration-150"
                    style={{
                      background: 'radial-gradient(ellipse at 75% 75%, rgba(122,31,162,0.22) 0%, rgba(111,0,255,0.12) 40%, transparent 70%)',
                      opacity: (atmosphere / 100) * 0.5,
                      mixBlendMode: 'screen',
                    }}
                  />
                </div>

                {/* Hairline Divider & Draggable Handle */}
                <div
                  className="absolute top-0 bottom-0 pointer-events-none z-20"
                  style={{ left: `${sliderPos}%` }}
                >
                  <div className="absolute top-0 bottom-0 -left-px w-0.5 bg-gradient-to-b from-white/30 via-white to-white/30 shadow-[0_0_10px_rgba(111,0,255,0.9)]" />
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#171B29] border border-[#BA68C8] shadow-[0_4px_16px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.35)] flex items-center justify-center text-white cursor-ew-resize group-hover:scale-105 active:scale-95 transition-transform">
                    <div className="flex items-center gap-0.5 text-[#D7DEED]">
                      <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                        <path d="M15 19l-7-7 7-7" />
                      </svg>
                      <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                        <path d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Clear, Minimal Badges: ONLY Before and After */}
                <div className="absolute top-3 left-3 pointer-events-none z-10">
                  <span className="px-3 py-1.5 rounded-lg bg-[#0D101A]/85 backdrop-blur-md border border-[#293047] text-xs font-semibold text-[#D7DEED] tracking-wide shadow-md">
                    Before
                  </span>
                </div>
                <div className="absolute top-3 right-3 pointer-events-none z-10">
                  <span className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#7A1FA2]/90 to-[#6F00FF]/90 backdrop-blur-md border border-[#BA68C8]/40 text-xs font-semibold text-white tracking-wide shadow-md">
                    After
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Compact, Balanced Transformation Panel */}
          <div className="lg:col-span-4 self-start">
            <div className="rounded-2xl bg-gradient-to-b from-[#1C2233] to-[#171B29] border border-[#293047] p-5 sm:p-6 shadow-2xl shadow-black/80 shadow-[inset_0_1px_0_rgba(215,222,237,0.08)] flex flex-col justify-between">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-[#D7DEED] mb-2 tracking-tight">
                  Explore the Transformation
                </h3>
                <p className="text-xs sm:text-sm text-[#8E9AB8] leading-relaxed mb-6">
                  Harmonize colors, directional lighting, and environmental atmosphere into one cohesive cinematic composition.
                </p>

                {/* Three Clean Regulators: Color Matching, Lighting, Atmosphere */}
                <div className="space-y-4 pt-1">
                  {/* 1. Color Matching */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-[#D7DEED]">Color Matching</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={colorMatching}
                      onChange={(e) => setColorMatching(Number(e.target.value))}
                      className="w-full h-1.5 bg-[#0D101A] rounded-lg appearance-none cursor-pointer accent-[#8E24AA]"
                    />
                  </div>

                  {/* 2. Lighting */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-[#D7DEED]">Lighting</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={lighting}
                      onChange={(e) => setLighting(Number(e.target.value))}
                      className="w-full h-1.5 bg-[#0D101A] rounded-lg appearance-none cursor-pointer accent-[#8E24AA]"
                    />
                  </div>

                  {/* 3. Atmosphere */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-[#D7DEED]">Atmosphere</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={atmosphere}
                      onChange={(e) => setAtmosphere(Number(e.target.value))}
                      className="w-full h-1.5 bg-[#0D101A] rounded-lg appearance-none cursor-pointer accent-[#8E24AA]"
                    />
                  </div>
                </div>
              </div>

              {/* Single Primary Action Button */}
              <button
                onClick={() => navigateTo('projects')}
                className="w-full mt-7 py-3.5 px-5 text-sm font-semibold rounded-lg bg-gradient-to-r from-[#7A1FA2] via-[#8E24AA] to-[#6F00FF] hover:from-[#9135B7] hover:via-[#9C27B0] hover:to-[#7E1BFF] active:from-[#642083] active:to-[#5700CC] text-white border border-[#BA68C8]/45 shadow-xl shadow-black/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] hover:shadow-[0_8px_25px_rgba(111,0,255,0.35),inset_0_1px_0_rgba(255,255,255,0.4)] transition-all cursor-pointer flex items-center justify-center gap-2 group"
              >
                <span>Try in Full Studio</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================
          3. CREATIVE CAPABILITIES (Asymmetric Bento Grid with Cinematic Artwork)
          - Intelligent Color Matching
          - Atmospheric Relighting
          - Seamless Visual Blending
          - Non-Destructive Editing
      ======================================================================== */}
      <section id="capabilities" className="py-20 px-6 lg:px-12 max-w-7xl mx-auto border-t border-[#293047]">
        {/* Section Header and USP */}
        <div className="mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#171B29]/90 border border-[#293047] shadow-sm mb-4 shadow-[inset_0_1px_0_rgba(215,222,237,0.06)]">
            <span className="w-2 h-2 rounded-full bg-[#BA68C8] shadow-[0_0_8px_#BA68C8]" />
            <span className="text-xs font-semibold tracking-wide text-[#D7DEED]">
              Creative Capabilities
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#D7DEED] mb-4 [text-wrap:balance]">
            Powerful Tools. Limitless Creativity.
          </h2>
          <p className="text-base sm:text-lg text-[#8E9AB8] max-w-3xl leading-relaxed">
            Bring different visual elements together with consistent color, lighting, and atmosphere — while keeping creative control.
          </p>
        </div>

        {/* Elegant 2×2 Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Intelligent Color Matching */}
          <div className="group relative rounded-2xl overflow-hidden bg-[#171B29] border border-[#293047] hover:border-[#BA68C8]/60 transition-all duration-300 shadow-xl shadow-black/70 hover:shadow-2xl hover:shadow-[#6F00FF]/15 flex flex-col min-h-[380px] sm:min-h-[420px] justify-between">
            <div className="absolute inset-0 overflow-hidden">
              <img
                src={desertGoldArt}
                alt="Intelligent Color Matching - Desert Gold"
                className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
              />
              {/* Soft bottom-only gradient for readable typography without dulling image colors */}
              <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[#0B0E17]/95 via-[#0B0E17]/50 to-transparent pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-br from-[#7A1FA2]/10 via-transparent to-[#6F00FF]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            </div>

            {/* Top Bar with Badge and Arrow */}
            <div className="relative z-10 p-6 sm:p-7 flex items-center justify-between">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0D101A]/80 backdrop-blur-md border border-[#293047] text-xs font-semibold text-[#D7DEED]">
                <Sparkles className="w-3.5 h-3.5 text-[#BA68C8]" />
                <span>Color Harmonization</span>
              </div>
              <div className="w-9 h-9 rounded-full bg-[#0D101A]/80 backdrop-blur-md border border-[#293047] flex items-center justify-center text-[#8E9AB8] group-hover:text-white group-hover:border-[#BA68C8] group-hover:bg-[#7A1FA2]/30 transition-all">
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            {/* Content Info */}
            <div className="relative z-10 p-6 sm:p-7 pt-0">
              <h3 className="text-2xl sm:text-3xl font-bold text-[#D7DEED] group-hover:text-white tracking-tight mb-2 transition-colors">
                Intelligent Color Matching
              </h3>
              <p className="text-sm sm:text-base text-[#9CA8C4] leading-relaxed line-clamp-2 max-w-xl">
                Harmonize color palettes, tint casts, and white balance across disconnected visual elements into one unified grade.
              </p>
            </div>
          </div>

          {/* Card 2: Atmospheric Relighting */}
          <div className="group relative rounded-2xl overflow-hidden bg-[#171B29] border border-[#293047] hover:border-[#BA68C8]/60 transition-all duration-300 shadow-xl shadow-black/70 hover:shadow-2xl hover:shadow-[#6F00FF]/15 flex flex-col min-h-[380px] sm:min-h-[420px] justify-between">
            <div className="absolute inset-0 overflow-hidden">
              <img
                src={jungleEmeraldArt}
                alt="Atmospheric Relighting - Jungle Emerald"
                className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
              />
              {/* Soft bottom-only gradient for readable typography without dulling image colors */}
              <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[#0B0E17]/95 via-[#0B0E17]/50 to-transparent pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-br from-[#7A1FA2]/10 via-transparent to-[#6F00FF]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            </div>

            {/* Top Bar with Badge and Arrow */}
            <div className="relative z-10 p-6 sm:p-7 flex items-center justify-between">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0D101A]/80 backdrop-blur-md border border-[#293047] text-xs font-semibold text-[#D7DEED]">
                <Sun className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span>Lighting & Shadows</span>
              </div>
              <div className="w-9 h-9 rounded-full bg-[#0D101A]/80 backdrop-blur-md border border-[#293047] flex items-center justify-center text-[#8E9AB8] group-hover:text-white group-hover:border-[#BA68C8] group-hover:bg-[#7A1FA2]/30 transition-all">
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            {/* Content Info */}
            <div className="relative z-10 p-6 sm:p-7 pt-0">
              <h3 className="text-2xl sm:text-3xl font-bold text-[#D7DEED] group-hover:text-white tracking-tight mb-2 transition-colors">
                Atmospheric Relighting
              </h3>
              <p className="text-sm sm:text-base text-[#9CA8C4] leading-relaxed line-clamp-2">
                Adapt directional rim highlights, environmental ambient bounce, and soft contact shadows to match the scene.
              </p>
            </div>
          </div>

          {/* Card 3: Seamless Visual Blending */}
          <div className="group relative rounded-2xl overflow-hidden bg-[#171B29] border border-[#293047] hover:border-[#BA68C8]/60 transition-all duration-300 shadow-xl shadow-black/70 hover:shadow-2xl hover:shadow-[#6F00FF]/15 flex flex-col min-h-[380px] sm:min-h-[420px] justify-between">
            <div className="absolute inset-0 overflow-hidden">
              <img
                src={iceBlueArt}
                alt="Seamless Visual Blending - Ice Blue"
                className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
              />
              {/* Soft bottom-only gradient for readable typography without dulling image colors */}
              <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[#0B0E17]/95 via-[#0B0E17]/50 to-transparent pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-br from-[#7A1FA2]/10 via-transparent to-[#6F00FF]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            </div>

            {/* Top Bar with Badge and Arrow */}
            <div className="relative z-10 p-6 sm:p-7 flex items-center justify-between">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0D101A]/80 backdrop-blur-md border border-[#293047] text-xs font-semibold text-[#D7DEED]">
                <Layers className="w-3.5 h-3.5 text-[#A78BFA]" />
                <span>Depth & Edge Blending</span>
              </div>
              <div className="w-9 h-9 rounded-full bg-[#0D101A]/80 backdrop-blur-md border border-[#293047] flex items-center justify-center text-[#8E9AB8] group-hover:text-white group-hover:border-[#BA68C8] group-hover:bg-[#7A1FA2]/30 transition-all">
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            {/* Content Info */}
            <div className="relative z-10 p-6 sm:p-7 pt-0">
              <h3 className="text-2xl sm:text-3xl font-bold text-[#D7DEED] group-hover:text-white tracking-tight mb-2 transition-colors">
                Seamless Visual Blending
              </h3>
              <p className="text-sm sm:text-base text-[#9CA8C4] leading-relaxed line-clamp-2">
                Blend cutout edges, depth aerial perspective, and atmospheric haze to naturally embed subjects into the world.
              </p>
            </div>
          </div>

          {/* Card 4: Non-Destructive Editing */}
          <div className="group relative rounded-2xl overflow-hidden bg-[#171B29] border border-[#293047] hover:border-[#BA68C8]/60 transition-all duration-300 shadow-xl shadow-black/70 hover:shadow-2xl hover:shadow-[#6F00FF]/15 flex flex-col min-h-[380px] sm:min-h-[420px] justify-between">
            <div className="absolute inset-0 overflow-hidden">
              <img
                src={anatomyOfSoulArt}
                alt="Non-Destructive Editing - Anatomy of Soul"
                className="w-full h-full object-cover object-center scale-[1.55] group-hover:scale-[1.63] transition-transform duration-700 ease-out"
              />
              {/* Soft bottom-only gradient for readable typography without dulling image colors */}
              <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[#0B0E17]/95 via-[#0B0E17]/50 to-transparent pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-br from-[#7A1FA2]/10 via-transparent to-[#6F00FF]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            </div>

            {/* Top Bar with Badge and Arrow */}
            <div className="relative z-10 p-6 sm:p-7 flex items-center justify-between">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0D101A]/80 backdrop-blur-md border border-[#293047] text-xs font-semibold text-[#D7DEED]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Pristine Layer Workflow</span>
              </div>
              <div className="w-9 h-9 rounded-full bg-[#0D101A]/80 backdrop-blur-md border border-[#293047] flex items-center justify-center text-[#8E9AB8] group-hover:text-white group-hover:border-[#BA68C8] group-hover:bg-[#7A1FA2]/30 transition-all">
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            {/* Content Info */}
            <div className="relative z-10 p-6 sm:p-7 pt-0">
              <h3 className="text-2xl sm:text-3xl font-bold text-[#D7DEED] group-hover:text-white tracking-tight mb-2 transition-colors">
                Non-Destructive Editing
              </h3>
              <p className="text-sm sm:text-base text-[#9CA8C4] leading-relaxed line-clamp-2 max-w-xl">
                Experiment freely with live layer adjustments, full stack undo, and complete protection of original assets.
              </p>
            </div>
          </div>
        </div>

        {/* Stylized AristoColors CTA Button */}
        <div className="mt-14 flex justify-center">
          <button
            onClick={() => navigateTo('projects')}
            className="px-8 py-4 text-base font-semibold rounded-xl bg-gradient-to-r from-[#7A1FA2] via-[#8E24AA] to-[#6F00FF] hover:from-[#9135B7] hover:via-[#9C27B0] hover:to-[#7E1BFF] active:from-[#642083] active:to-[#5700CC] text-white border border-[#BA68C8]/45 shadow-xl shadow-black/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] hover:shadow-[0_8px_28px_rgba(111,0,255,0.38),inset_0_1px_0_rgba(255,255,255,0.4)] transition-all duration-200 cursor-pointer flex items-center gap-3 group"
          >
            <span>Explore the Studio</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>

      {/* ========================================================================
          4. INTERACTIVE BEFORE / AFTER HARMONIZATION SLIDER (Cosmic Frontier)
      ======================================================================== */}
      <section className="py-20 px-6 lg:px-12 max-w-7xl mx-auto border-t border-[#293047]">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#7A1FA2]/15 border border-[#BA68C8]/30 text-xs font-semibold text-[#D78BEE] uppercase tracking-wider mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#BA68C8] animate-pulse" />
            Interactive Comparison
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#D7DEED] mb-4 [text-wrap:balance]">
            One Scene. Two Atmospheres.
          </h2>
          <p className="text-sm sm:text-base text-[#9CA8C4] leading-relaxed max-w-2xl mx-auto">
            Discover how color, lighting, and atmosphere can transform the same composition into a cinematic world.
          </p>
        </div>

        {/* Master Comparison Showcase Container */}
        <div className="max-w-5xl mx-auto">
          <div className="relative rounded-2xl p-2 sm:p-3 bg-gradient-to-b from-[#1C2233] to-[#171B29] border border-[#293047] shadow-2xl shadow-black/90 shadow-[inset_0_1px_0_rgba(215,222,237,0.1)]">
            <div
              ref={compareViewerRef}
              onMouseDown={handleCompareMouseDown}
              onTouchStart={handleCompareTouchStart}
              onTouchMove={handleCompareTouchMove}
              tabIndex={0}
              role="slider"
              aria-label="Before and after transformation slider: use left and right arrow keys to compare"
              aria-valuenow={Math.round(compareSplit)}
              aria-valuemin={0}
              aria-valuemax={100}
              onKeyDown={handleCompareKeyDown}
              className="relative w-full aspect-[1672/940] rounded-xl overflow-hidden bg-[#0D101A] border border-[#293047] select-none cursor-ew-resize group touch-none outline-none focus-visible:ring-2 focus-visible:ring-[#BA68C8]/70"
            >
              {/* LAYER 1: BEFORE (Cooler tones, desaturated, lower contrast, muted glow) */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
                <img
                  src={cosmicFrontierArt}
                  alt="Raw plate before harmonization"
                  className="w-full h-full object-cover select-none pointer-events-none"
                  style={{
                    filter: 'saturate(0.48) contrast(0.86) brightness(0.85) hue-rotate(-20deg)',
                  }}
                />
                {/* Cold environmental tint simulating mismatched neutral/cool studio raw plate */}
                <div
                  className="absolute inset-0 pointer-events-none bg-sky-950/25 mix-blend-color"
                  aria-hidden="true"
                />
              </div>

              {/* LAYER 2: AFTER (Vibrant Original Artwork with warm atmospheric bounce and rich contrast) */}
              <div
                className="absolute inset-0 overflow-hidden pointer-events-none select-none"
                style={{
                  clipPath: `inset(0 0 0 ${compareSplit}%)`,
                }}
              >
                <img
                  src={cosmicFrontierArt}
                  alt="Harmonized studio composite after processing"
                  className="w-full h-full object-cover select-none pointer-events-none"
                  style={{
                    filter: 'brightness(1.02) contrast(1.03) saturate(1.06)',
                  }}
                />
                {/* Subtle cinematic magenta/violet ambient highlight on right side */}
                <div
                  className="absolute inset-0 pointer-events-none opacity-40 mix-blend-screen"
                  style={{
                    background: 'radial-gradient(ellipse at 80% 60%, rgba(186,104,200,0.2) 0%, transparent 60%)',
                  }}
                  aria-hidden="true"
                />
              </div>

              {/* Hairline Divider & Refined Violet/Graphite Handle */}
              <div
                className="absolute top-0 bottom-0 pointer-events-none z-20"
                style={{ left: `${compareSplit}%` }}
              >
                {/* Vertical neon divider line */}
                <div className="absolute top-0 bottom-0 -left-px w-0.5 bg-gradient-to-b from-white/30 via-white to-white/30 shadow-[0_0_12px_rgba(186,104,200,0.9)]" />

                {/* Refined Center Handle */}
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#171B29] border border-[#BA68C8] shadow-[0_6px_20px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.35)] flex items-center justify-center text-white cursor-ew-resize group-hover:scale-105 active:scale-95 transition-transform">
                  <div className="flex items-center gap-1">
                    <div className="w-0 h-0 border-y-[4px] border-y-transparent border-r-[5px] border-r-white/80" />
                    <div className="w-0.5 h-3.5 bg-white/40 rounded-full" />
                    <div className="w-0 h-0 border-y-[4px] border-y-transparent border-l-[5px] border-l-white/80" />
                  </div>
                </div>
              </div>

              {/* Label Badges */}
              <div className="absolute top-4 left-4 z-20 px-3.5 py-1.5 rounded-lg bg-[#0D101A]/85 backdrop-blur-md border border-[#293047] text-xs font-semibold text-[#8E9AB8] flex items-center gap-2 shadow-lg shadow-black/50">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8E9AB8]" />
                <span>Before • Raw Plate</span>
              </div>
              <div className="absolute top-4 right-4 z-20 px-3.5 py-1.5 rounded-lg bg-[#0D101A]/85 backdrop-blur-md border border-[#BA68C8]/60 text-xs font-semibold text-[#E9D5FF] flex items-center gap-2 shadow-lg shadow-black/50">
                <span className="w-1.5 h-1.5 rounded-full bg-[#BA68C8] animate-pulse" />
                <span>After • Harmonized</span>
              </div>

              {/* Bottom Subtle Hint */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-[#0D101A]/70 backdrop-blur-md border border-[#293047]/60 text-[11px] text-[#8E9AB8] hidden sm:flex items-center gap-1.5 pointer-events-none">
                <span>Drag slider or use arrow keys to inspect</span>
              </div>
            </div>
          </div>

          {/* Simplified Quick Views Controls: Before | Split | After */}
          <div className="mt-5 flex items-center justify-center">
            <div className="inline-flex p-1 rounded-xl bg-[#131724] border border-[#293047] shadow-lg shadow-black/60 gap-1.5">
              <button
                type="button"
                onClick={() => setCompareSplit(100)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-150 cursor-pointer ${
                  compareSplit === 100
                    ? 'bg-[#7A1FA2] text-white shadow-md shadow-[#7A1FA2]/30 border border-[#BA68C8]/60'
                    : 'text-[#9CA8C4] hover:text-[#D7DEED] hover:bg-[#1A2030] border border-transparent'
                }`}
                aria-label="View 100% unharmonized Before plate"
              >
                Before
              </button>
              <button
                type="button"
                onClick={() => setCompareSplit(50)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-150 cursor-pointer ${
                  compareSplit === 50
                    ? 'bg-[#7A1FA2] text-white shadow-md shadow-[#7A1FA2]/30 border border-[#BA68C8]/60'
                    : 'text-[#9CA8C4] hover:text-[#D7DEED] hover:bg-[#1A2030] border border-transparent'
                }`}
                aria-label="View 50/50 comparison split"
              >
                Split
              </button>
              <button
                type="button"
                onClick={() => setCompareSplit(0)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-150 cursor-pointer ${
                  compareSplit === 0
                    ? 'bg-[#7A1FA2] text-white shadow-md shadow-[#7A1FA2]/30 border border-[#BA68C8]/60'
                    : 'text-[#9CA8C4] hover:text-[#D7DEED] hover:bg-[#1A2030] border border-transparent'
                }`}
                aria-label="View 100% harmonized After composite"
              >
                After
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================
          5. CONCEPT ART SHOWCASE (Triptych Gallery)
      ======================================================================== */}
      <section id="showcase" className="py-20 px-6 lg:px-12 max-w-7xl mx-auto border-t border-[#293047]">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#7A1FA2]/15 border border-[#BA68C8]/30 text-xs font-semibold text-[#D78BEE] uppercase tracking-wider mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#BA68C8]" />
              Visual Showcase
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#D7DEED] [text-wrap:balance]">
              Concept Art Created in AristoColors
            </h2>
            <p className="mt-2 text-sm sm:text-base text-[#8E9AB8] max-w-2xl">
              Cinematic atmospheres, complex lighting palettes, and unified visual worlds composed with precision tools.
            </p>
          </div>
          <button
            onClick={() => navigateTo('projects')}
            className="px-5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl bg-[#171B29] hover:bg-[#1E2436] text-[#D7DEED] hover:text-white border border-[#293047] hover:border-[#BA68C8]/50 shadow-md transition-all cursor-pointer self-start md:self-auto flex items-center gap-2 whitespace-nowrap group"
          >
            <span>Explore Projects Hub</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform text-[#BA68C8]" />
          </button>
        </div>

        {/* Balanced 3-Card Gallery: Exclusively the 3 Artworks Extracted from Cyberpank_Atlantis */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {/* Card 1: Artwork 1 (Violet / Magenta Atmosphere) */}
          <div className="group relative rounded-2xl bg-[#171B29] border border-[#293047] hover:border-[#BA68C8]/60 overflow-hidden shadow-xl shadow-black/70 hover:shadow-2xl hover:shadow-[#BA68C8]/10 transition-all duration-300 flex flex-col justify-between hover:-translate-y-1">
            <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#0D101A]">
              <img
                src={atlantisArtPart1}
                alt="Cyberpunk Atlantis I - Neon Spire & Upper District"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#171B29] via-[#171B29]/25 to-transparent pointer-events-none" />

              <div className="absolute top-3.5 left-3.5 px-3 py-1.5 rounded-lg bg-[#0D101A]/85 backdrop-blur-md border border-[#BA68C8]/40 text-xs font-semibold text-[#E9D5FF] flex items-center gap-2 shadow-lg shadow-black/60">
                <span className="w-1.5 h-1.5 rounded-full bg-[#BA68C8]" />
                Atmosphere I • Violet Haze
              </div>
            </div>

            <div className="p-6 flex flex-col justify-between flex-1">
              <div>
                <div className="text-xs font-medium text-[#A78BFA] uppercase tracking-wider mb-1.5">
                  Upper District
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-[#D7DEED] group-hover:text-white transition-colors mb-2 tracking-tight">
                  Neon Spire & Citadel
                </h3>
                <p className="text-sm text-[#9CA8C4] leading-relaxed mb-4">
                  Vertical architectural towers bathed in deep magenta twilight, volumetric ambient fog, and high-contrast neon illumination.
                </p>
              </div>

              <div>
                <div className="pt-4 border-t border-[#293047]/80 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#8E9AB8]">
                    <span className="px-2 py-0.5 rounded-md bg-[#0D101A] border border-[#293047] text-[11px]">Violet Bloom</span>
                    <span className="px-2 py-0.5 rounded-md bg-[#0D101A] border border-[#293047] text-[11px]">Ambient Bounce</span>
                  </div>
                  <button
                    onClick={() => navigateTo('projects')}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-[#7A1FA2] to-[#6F00FF] hover:from-[#8E24AA] hover:to-[#7E1BFF] text-white border border-[#BA68C8]/40 shadow-sm transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <span>Explore Projects</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Artwork 2 (Underwater Civilization / Lost Atlantis) */}
          <div className="group relative rounded-2xl bg-[#171B29] border border-[#293047] hover:border-[#BA68C8]/60 overflow-hidden shadow-xl shadow-black/70 hover:shadow-2xl hover:shadow-[#BA68C8]/10 transition-all duration-300 flex flex-col justify-between hover:-translate-y-1">
            <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#0D101A]">
              <img
                src={atlantisArtPart2}
                alt="Lost Atlantis - Submerged Civilization & Oceanic Trench"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#171B29] via-[#171B29]/25 to-transparent pointer-events-none" />

              <div className="absolute top-3.5 left-3.5 px-3 py-1.5 rounded-lg bg-[#0D101A]/85 backdrop-blur-md border border-[#38BDF8]/40 text-xs font-semibold text-[#BAE6FD] flex items-center gap-2 shadow-lg shadow-black/60">
                <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8]" />
                Underwater Civilization • Cyan Glow
              </div>
            </div>

            <div className="p-6 flex flex-col justify-between flex-1">
              <div>
                <div className="text-xs font-medium text-[#38BDF8] uppercase tracking-wider mb-1.5">
                  Submerged Relics
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-[#D7DEED] group-hover:text-white transition-colors mb-2 tracking-tight">
                  Lost Atlantis
                </h3>
                <p className="text-sm text-[#9CA8C4] leading-relaxed mb-4">
                  Subaquatic megaliths and sunken sanctuaries illuminated by bioluminescent marine trenches and refracted oceanic currents.
                </p>
              </div>

              <div>
                <div className="pt-4 border-t border-[#293047]/80 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#8E9AB8]">
                    <span className="px-2 py-0.5 rounded-md bg-[#0D101A] border border-[#293047] text-[11px]">Cyan Glow</span>
                    <span className="px-2 py-0.5 rounded-md bg-[#0D101A] border border-[#293047] text-[11px]">Aquatic Depth</span>
                  </div>
                  <button
                    onClick={() => navigateTo('projects')}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-[#7A1FA2] to-[#6F00FF] hover:from-[#8E24AA] hover:to-[#7E1BFF] text-white border border-[#BA68C8]/40 shadow-sm transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <span>Explore Projects</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Artwork 3 (Sci-Fi Orbital Mech / Orbital Frontier) */}
          <div className="group relative rounded-2xl bg-[#171B29] border border-[#293047] hover:border-[#BA68C8]/60 overflow-hidden shadow-xl shadow-black/70 hover:shadow-2xl hover:shadow-[#BA68C8]/10 transition-all duration-300 flex flex-col justify-between hover:-translate-y-1">
            <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#0D101A]">
              <img
                src={atlantisArtPart3}
                alt="Orbital Frontier - Sci-Fi Orbital Mech & Golden Atmosphere"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#171B29] via-[#171B29]/25 to-transparent pointer-events-none" />

              <div className="absolute top-3.5 left-3.5 px-3 py-1.5 rounded-lg bg-[#0D101A]/85 backdrop-blur-md border border-[#F59E0B]/40 text-xs font-semibold text-[#FDE68A] flex items-center gap-2 shadow-lg shadow-black/60">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                Orbital Mech • Golden Horizon
              </div>
            </div>

            <div className="p-6 flex flex-col justify-between flex-1">
              <div>
                <div className="text-xs font-medium text-[#F59E0B] uppercase tracking-wider mb-1.5">
                  Orbital Defense
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-[#D7DEED] group-hover:text-white transition-colors mb-2 tracking-tight">
                  Orbital Frontier
                </h3>
                <p className="text-sm text-[#9CA8C4] leading-relaxed mb-4">
                  Colossal sci-fi mech armor and perimeter dockyards backlit by golden stellar radiation and planetary atmospheric haze.
                </p>
              </div>

              <div>
                <div className="pt-4 border-t border-[#293047]/80 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#8E9AB8]">
                    <span className="px-2 py-0.5 rounded-md bg-[#0D101A] border border-[#293047] text-[11px]">Golden Rim Light</span>
                    <span className="px-2 py-0.5 rounded-md bg-[#0D101A] border border-[#293047] text-[11px]">Atmospheric Haze</span>
                  </div>
                  <button
                    onClick={() => navigateTo('projects')}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-[#7A1FA2] to-[#6F00FF] hover:from-[#8E24AA] hover:to-[#7E1BFF] text-white border border-[#BA68C8]/40 shadow-sm transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <span>Explore Projects</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================
          6. STUDIO PLANS & PRICING
      ======================================================================== */}
      <section id="pricing" className="py-20 px-6 lg:px-12 max-w-7xl mx-auto border-t border-[#293047]">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="text-xs font-semibold text-[#38BDF8] uppercase tracking-wider mb-2">
            Predictable Studio Access
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#D7DEED] mb-4 [text-wrap:balance]">
            Transparent Plans for Solo Artists & Studios
          </h2>
          <p className="text-sm sm:text-base text-[#8E9AB8] leading-relaxed mb-6">
            All plans include full non-destructive compositing and local offline canvas persistence.
          </p>

          {/* Billing Interval Toggle */}
          <div className="inline-flex items-center gap-1 p-1 bg-[#171B29] rounded-lg border border-[#293047]">
            <button
              onClick={() => setIsAnnualBilling(false)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                !isAnnualBilling
                  ? 'bg-gradient-to-b from-[#8E24AA] to-[#7A1FA2] text-[#D7DEED] font-semibold border border-[#BA68C8]/40 shadow-xs'
                  : 'text-[#8E9AB8] hover:text-[#D7DEED]'
              }`}
            >
              Billed Monthly
            </button>
            <button
              onClick={() => setIsAnnualBilling(true)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                isAnnualBilling
                  ? 'bg-gradient-to-b from-[#8E24AA] to-[#7A1FA2] text-[#D7DEED] font-semibold border border-[#BA68C8]/40 shadow-xs'
                  : 'text-[#8E9AB8] hover:text-[#D7DEED]'
              }`}
            >
              Annual Billing (-20%)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Plan 1: Starter */}
          <div className="bg-[#171B29] rounded-xl border border-[#293047] p-8 shadow-[inset_0_1px_0_rgba(215,222,237,0.06)] flex flex-col justify-between">
            <div>
              <div className="text-xs font-mono text-[#8E9AB8] mb-2">Individual</div>
              <h3 className="text-xl font-bold text-[#D7DEED] mb-1">Starter</h3>
              <p className="text-xs text-[#8E9AB8] mb-6">
                Essential canvas tools for hobbyists and students.
              </p>

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-3xl font-bold font-mono text-[#D7DEED]">$0</span>
                <span className="text-xs text-[#8E9AB8]">/ forever free</span>
              </div>

              <div className="space-y-3 text-xs text-[#8E9AB8] mb-8">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Up to 1080p canvas resolution</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>5 simultaneous layers</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Local IndexedDB cache persistence</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Standard sRGB export</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigateTo('projects')}
              className="w-full py-2.5 text-xs font-semibold rounded-lg bg-[#131724] hover:bg-[#1E2436] text-[#D7DEED] border border-[#293047] hover:border-[#384363] transition-colors cursor-pointer"
            >
              Start Free in Browser
            </button>
          </div>

          {/* Plan 2: Pro Studio (Featured) */}
          <div className="bg-[#171B29] rounded-xl border-2 border-[#7A1FA2] p-8 shadow-xl shadow-black/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] flex flex-col justify-between relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-b from-[#8E24AA] to-[#7A1FA2] text-[#D7DEED] font-mono text-[10px] font-bold uppercase tracking-wider border border-[#BA68C8]/40 shadow-md">
              Most Popular
            </div>

            <div>
              <div className="text-xs font-mono text-[#38BDF8] mb-2">Professional</div>
              <h3 className="text-xl font-bold text-[#D7DEED] mb-1">Pro Studio</h3>
              <p className="text-xs text-[#8E9AB8] mb-6">
                Full-power matte painting & concept art workstation.
              </p>

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-3xl font-bold font-mono text-[#D7DEED]">
                  ${isAnnualBilling ? '24' : '30'}
                </span>
                <span className="text-xs text-[#8E9AB8]">/ month</span>
              </div>

              <div className="space-y-3 text-xs text-[#8E9AB8] mb-8">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-[#D7DEED]">Up to 4K Cinema DCI resolution</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-[#D7DEED]">Unlimited non-destructive layers</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>250 Relighting & Harmonization credits/mo</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Display-P3 wide color gamut</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>High-res PNG & layered export</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigateTo('billing')}
              className="w-full py-2.5 text-xs font-semibold rounded-lg bg-gradient-to-b from-[#8E24AA] to-[#7A1FA2] hover:from-[#9C27B0] hover:to-[#8E24AA] active:from-[#7A1FA2] active:to-[#642083] text-[#D7DEED] border border-[#BA68C8]/35 shadow-md shadow-black/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] transition-all cursor-pointer"
            >
              Select Pro Studio
            </button>
          </div>

          {/* Plan 3: Studio Team */}
          <div className="bg-[#171B29] rounded-xl border border-[#293047] p-8 shadow-[inset_0_1px_0_rgba(215,222,237,0.06)] flex flex-col justify-between">
            <div>
              <div className="text-xs font-mono text-[#8E9AB8] mb-2">Team & Production</div>
              <h3 className="text-xl font-bold text-[#D7DEED] mb-1">Studio Team</h3>
              <p className="text-xs text-[#8E9AB8] mb-6">
                Cinematic pipeline integration for visual effects houses.
              </p>

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-3xl font-bold font-mono text-[#D7DEED]">
                  ${isAnnualBilling ? '79' : '99'}
                </span>
                <span className="text-xs text-[#8E9AB8]">/ month</span>
              </div>

              <div className="space-y-3 text-xs text-[#8E9AB8] mb-8">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>8K Cinema DCI resolution support</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>1,000 harmonization credits/mo</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Shared team asset libraries</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Priority render queue & batch export</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigateTo('billing')}
              className="w-full py-2.5 text-xs font-semibold rounded-lg bg-[#131724] hover:bg-[#1E2436] text-[#D7DEED] border border-[#293047] hover:border-[#384363] transition-colors cursor-pointer"
            >
              Contact Studio Sales
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================
          7. ARCHITECTURAL FAQ & QUESTIONS
      ======================================================================== */}
      <section id="faq" className="py-20 px-6 lg:px-12 max-w-4xl mx-auto border-t border-[#293047]">
        <div className="text-center mb-12">
          <div className="text-xs font-semibold text-[#38BDF8] uppercase tracking-wider mb-2">
            Frequently Asked Questions
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#D7DEED] mb-3 [text-wrap:balance]">
            Architecture & Workflow Details
          </h2>
          <p className="text-sm text-[#8E9AB8]">
            Everything you need to know about integrating AristoColors into your pipeline.
          </p>
        </div>

        <div className="space-y-4">
          {[
            {
              q: 'How does non-destructive harmonization differ from standard AI generation?',
              a: 'Standard generative AI creates a new flattened bitmap from scratch, hallucinating unpredictable changes. AristoColors preserves your exact layer geometry, alpha cutouts, and masks, recalculating only light bounce, color temperature, and atmospheric occlusion shaders so you retain 100% artistic control.',
            },
            {
              q: 'Can I export layers directly to Photoshop or Blender?',
              a: 'Yes. You can export complete high-resolution layered PNG packages, individual alpha cutouts, or flat master plates at up to 4K Cinema DCI resolution with 300 DPI print metadata.',
            },
            {
              q: 'Where are my projects and assets stored?',
              a: 'All project metadata, layer trees, and assets are stored in local client-side storage (IndexedDB & LocalStorage), meaning your sensitive intellectual property and concept plates never leave your machine without your explicit command.',
            },
            {
              q: 'Which color spaces are supported?',
              a: 'AristoColors operates in a 32-bit linear floating point space with support for standard sRGB and Display-P3 wide color gamut, preventing banding in dark shadow gradients.',
            },
          ].map((item, i) => (
            <div
              key={i}
              className="bg-[#171B29] rounded-xl border border-[#293047] overflow-hidden transition-colors"
            >
              <button
                onClick={() => toggleFaq(i)}
                className="w-full px-6 py-4 text-left flex items-center justify-between text-sm font-semibold text-[#D7DEED] hover:text-white cursor-pointer"
              >
                <span>{item.q}</span>
                {openFaqIndex === i ? (
                  <ChevronUp className="w-4 h-4 text-[#7A1FA2] shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#8E9AB8] shrink-0" />
                )}
              </button>

              {openFaqIndex === i && (
                <div className="px-6 pb-4 text-xs text-[#8E9AB8] leading-relaxed border-t border-[#293047]/60 pt-3">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================
          8. CONVERSION CALLOUT SECTION
      ======================================================================== */}
      <section className="py-16 px-6 lg:px-12 max-w-5xl mx-auto my-12">
        <div className="bg-gradient-to-b from-[#1E2436] to-[#171B29] rounded-2xl border border-[#7A1FA2]/50 p-8 sm:p-12 text-center shadow-2xl shadow-black/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#D7DEED] mb-4 [text-wrap:balance]">
            Ready to Harmonize Your Concept Art?
          </h2>
          <p className="text-sm sm:text-base text-[#8E9AB8] max-w-xl mx-auto leading-relaxed mb-8">
            Open the Projects Hub right now in your browser, pick a starter matte plate,
            and experience non-destructive atmospheric relighting.
          </p>

          <button
            onClick={() => navigateTo('projects')}
            className="px-8 py-3.5 text-sm font-semibold rounded-lg bg-gradient-to-b from-[#8E24AA] to-[#7A1FA2] hover:from-[#9C27B0] hover:to-[#8E24AA] active:from-[#7A1FA2] active:to-[#642083] text-[#D7DEED] border border-[#BA68C8]/35 shadow-xl shadow-black/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] transition-all cursor-pointer inline-flex items-center gap-2"
          >
            <FolderOpen className="w-4 h-4" />
            <span>Launch Projects Hub</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* ========================================================================
          9. QUIET FOOTER
      ======================================================================== */}
      <footer className="border-t border-[#293047] py-12 px-6 lg:px-12 bg-[#10131E] text-xs text-[#8E9AB8]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded bg-[#171B29] border border-[#7A1FA2]/60 flex items-center justify-center">
              <span className="w-2.5 h-2.5 border border-[#D7DEED] rotate-45 flex items-center justify-center">
                <span className="w-1 h-1 bg-[#38BDF8] rounded-full" />
              </span>
            </div>
            <span className="font-bold text-[#D7DEED] font-mono">AristoColors Studio</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6">
            <button
              onClick={() => navigateTo('projects')}
              className="hover:text-[#D7DEED] transition-colors cursor-pointer"
            >
              Projects Hub
            </button>
            <button
              onClick={() => navigateTo('assets')}
              className="hover:text-[#D7DEED] transition-colors cursor-pointer"
            >
              Assets Library
            </button>
            <button
              onClick={() => navigateTo('generations')}
              className="hover:text-[#D7DEED] transition-colors cursor-pointer"
            >
              Generations Audit
            </button>
            <button
              onClick={() => navigateTo('billing')}
              className="hover:text-[#D7DEED] transition-colors cursor-pointer"
            >
              Pricing & Compute
            </button>
            <button
              onClick={() => navigateTo('settings')}
              className="hover:text-[#D7DEED] transition-colors cursor-pointer"
            >
              Settings
            </button>
          </div>

          <div className="text-[11px] text-[#5E6985]">
            © {new Date().getFullYear()} AristoColors. Professional Concept Art & Photobashing.
          </div>
        </div>
      </footer>
    </div>
  );
};

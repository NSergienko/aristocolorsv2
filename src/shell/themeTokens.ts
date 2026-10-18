/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AristoColors v2 Design Tokens
 * Premium glossy purple system inspired by PANTONE 254 PC
 */

export const THEME = {
  colors: {
    // Primary Purple System (PANTONE 254 PC inspired)
    purple: {
      primary: '#7A1FA2',
      hover: '#9135B7',
      active: '#642083',
      subtle: 'rgba(122, 31, 162, 0.15)',
      subtleBorder: 'rgba(122, 31, 162, 0.35)',
      focusRing: '#7A1FA2',
      highlightBorder: '#BA68C8',
    },
    // Core Neutral Metallic Palette
    graphite: '#171B29',
    slate: '#293047',
    silver: '#D7DEED',
    silverMuted: '#8E9AB8',
    silverDark: '#5E6985',
    
    // Technical Status Only (Reserved for meaningful status indicators)
    iceBlue: '#38BDF8',
    
    // Status colors
    status: {
      emerald: '#10B981',
      amber: '#F59E0B',
      rose: '#F43F5E',
    },
  },
  
  // Shared interactive styling classes
  buttons: {
    primary:
      'bg-gradient-to-b from-[#8E24AA] to-[#7A1FA2] hover:from-[#9C27B0] hover:to-[#8E24AA] active:from-[#7A1FA2] active:to-[#642083] text-[#D7DEED] font-semibold border border-[#BA68C8]/35 shadow-md shadow-black/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]',
    secondary:
      'bg-[#171B29] hover:bg-[#1E2436] text-[#D7DEED] border border-[#293047] hover:border-[#384363] shadow-xs shadow-[inset_0_1px_0_rgba(215,222,237,0.06)]',
  },
  
  // Tab/Filter styling
  tabs: {
    active:
      'bg-gradient-to-b from-[#8E24AA] to-[#7A1FA2] text-[#D7DEED] shadow-sm shadow-black/40 border border-[#BA68C8]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]',
    inactive:
      'text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#1E2436]/60',
  },

  // Focus ring
  focusRing: 'focus:outline-none focus:ring-1 focus:ring-[#7A1FA2] focus:border-[#7A1FA2]',
  focusVisibleRing: 'focus-visible:ring-2 focus-visible:ring-[#7A1FA2]',
} as const;

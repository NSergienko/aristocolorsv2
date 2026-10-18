/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  CreditCard,
  Check,
  ShieldCheck,
  Sparkles,
  Zap,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { useShell } from '../shell/ShellContext.tsx';
import { BillingPlan } from '../types/shell.ts';
import { UIButton } from '../ui/UIButton.tsx';

const PLANS: BillingPlan[] = [
  {
    id: 'starter',
    name: 'Starter Artist',
    priceUah: 0,
    priceUsd: 0,
    period: 'month',
    description: 'Essential photobashing canvas with standard resolution and manual harmonize.',
    features: [
      'Up to 1080p canvas resolution',
      'Non-destructive layers & masks',
      'Lasso, Marquee & Transform tools',
      'Manual Parametric Harmonize',
      '10 Harmonize credits / month',
      'Local IndexedDB project storage',
    ],
    limits: {
      maxResolution: '1920 × 1080',
      aiHarmonizationsPerMonth: 10,
      cloudStorageGb: 1,
      unlimitedLayers: false,
    },
  },
  {
    id: 'pro',
    name: 'Pro Concept Artist',
    priceUah: 799,
    priceUsd: 19,
    period: 'month',
    description: 'Full studio capabilities with 4K Cinema canvases, neural harmonize, and priority rendering.',
    isPopular: true,
    features: [
      'Up to 4K Cinema DCI resolution (4096px)',
      'Unlimited layers, masks & smart groups',
      'Dual Harmonize: Manual + Neural Engine',
      '200 Neural Harmonize credits / month',
      'Light wrapping & contact shadow synthesizers',
      'High-res PSD & Layered PNG export',
      'Cloud sync & version snapshotting',
    ],
    limits: {
      maxResolution: '4096 × 2160',
      aiHarmonizationsPerMonth: 200,
      cloudStorageGb: 25,
      unlimitedLayers: true,
    },
  },
  {
    id: 'studio',
    name: 'Studio Team',
    priceUah: 2199,
    priceUsd: 49,
    period: 'month',
    description: 'For visual development teams, game studios, and high-volume concept production.',
    features: [
      '8K Ultra-HD canvases (8192px)',
      'Unlimited Neural Harmonizations',
      'Custom style matrices & fine-tuned checkpoints',
      'Batch asset harmonization pipeline',
      'Shared asset libraries & style boards',
      'Dedicated API access & priority queue',
      'Commercial NDA clearance guarantee',
    ],
    limits: {
      maxResolution: '8192 × 4320',
      aiHarmonizationsPerMonth: 9999,
      cloudStorageGb: 200,
      unlimitedLayers: true,
    },
  },
];

export const BillingView: React.FC = () => {
  const { userProfile, addToast } = useShell();
  const [currency, setCurrency] = useState<'UAH' | 'USD'>('UAH');

  const handlePlanSelect = (plan: BillingPlan) => {
    addToast({
      type: 'info',
      title: 'Subscription Tier Selected',
      message: `Tier plan: "${plan.name}". Payment processing will be enabled via WayForPay.`,
    });
  };

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto bg-[#0D101A] p-5 lg:p-7 select-none">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#293047]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-[#D7DEED] tracking-tight">
              Plan & Subscription
            </h1>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#7A1FA2]/25 text-[#D7DEED] border border-[#7A1FA2]/50 uppercase tracking-wider">
              Active: {userProfile.activePlan.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-[#8E9AB8] mt-1">
            Choose your photobashing compute tier and manage workspace cloud capacity.
          </p>
        </div>

        {/* Currency Switcher */}
        <div className="flex items-center gap-1 bg-[#131724] p-1 rounded-lg border border-[#293047]">
          <button
            onClick={() => setCurrency('UAH')}
            className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-all ${
              currency === 'UAH'
                ? 'bg-gradient-to-b from-[#8E24AA] to-[#7A1FA2] text-[#D7DEED] shadow-sm shadow-black/40 border border-[#BA68C8]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                : 'text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#1E2436]/60'
            }`}
          >
            UAH (₴)
          </button>
          <button
            onClick={() => setCurrency('USD')}
            className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-all ${
              currency === 'USD'
                ? 'bg-gradient-to-b from-[#8E24AA] to-[#7A1FA2] text-[#D7DEED] shadow-sm shadow-black/40 border border-[#BA68C8]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                : 'text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#1E2436]/60'
            }`}
          >
            USD ($)
          </button>
        </div>
      </div>

      {/* Compute Balance Card */}
      <div className="my-6 p-5 rounded-xl bg-[#171B29] border border-[#293047] shadow-xl shadow-black/50 shadow-[inset_0_1px_0_rgba(215,222,237,0.08)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#7A1FA2]/20 border border-[#7A1FA2]/50 flex items-center justify-center text-[#BA68C8] shadow-md shadow-black/40">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#D7DEED]">
                Neural Harmonize Compute Balance
              </h3>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-mono">
                Active
              </span>
            </div>
            <p className="text-xs text-[#8E9AB8] mt-0.5">
              Refreshes monthly with your Pro Concept Artist plan subscription.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="text-2xl font-extrabold font-mono text-[#D7DEED]">
              {userProfile.aiCreditsRemaining}
            </span>
            <span className="text-xs text-[#38BDF8] font-mono block">/ 200 Credits Available</span>
          </div>

          <UIButton
            variant="primary"
            size="sm"
            onClick={() => handlePlanSelect(PLANS[1])}
          >
            Top Up Credits
          </UIButton>
        </div>
      </div>

      {/* Plan Cards Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-4">
        {PLANS.map((plan) => {
          const isCurrent = userProfile.activePlan === plan.id;
          const priceDisplay =
            currency === 'UAH'
              ? plan.priceUah === 0
                ? 'Безкоштовно'
                : `${plan.priceUah} ₴`
              : plan.priceUsd === 0
              ? 'Free'
              : `$${plan.priceUsd}`;

          return (
            <div
              key={plan.id}
              className={`flex flex-col justify-between p-6 rounded-xl border transition-all duration-200 relative shadow-xl shadow-black/50 ${
                plan.isPopular
                  ? 'bg-gradient-to-b from-[#1D1929] to-[#171B29] border-2 border-[#7A1FA2] shadow-2xl shadow-black/60 shadow-[inset_0_1px_0_rgba(215,222,237,0.12)] ring-1 ring-[#7A1FA2]/50'
                  : 'bg-[#171B29] border-[#242B3F] shadow-[inset_0_1px_0_rgba(215,222,237,0.06)]'
              }`}
            >
              {plan.isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-gradient-to-b from-[#8E24AA] to-[#7A1FA2] text-[10px] font-bold text-[#D7DEED] uppercase tracking-wider shadow-md shadow-black/50 border border-[#BA68C8]/50 font-mono">
                  Most Popular
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-[#D7DEED]">{plan.name}</h3>
                  {isCurrent && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#7A1FA2]/25 text-[#D7DEED] border border-[#7A1FA2]/50 font-bold">
                      CURRENT
                    </span>
                  )}
                </div>

                <p className="text-xs text-[#8E9AB8] mt-2 min-h-10 leading-relaxed">
                  {plan.description}
                </p>

                <div className="mt-4 pb-4 border-b border-[#242B3F]">
                  <span className="text-3xl font-extrabold text-[#D7DEED] font-mono">
                    {priceDisplay}
                  </span>
                  {plan.priceUah > 0 && (
                    <span className="text-xs text-[#8E9AB8] font-mono ml-1.5">
                      / {plan.period}
                    </span>
                  )}
                </div>

                {/* Features list */}
                <div className="mt-5 flex flex-col gap-2.5">
                  <span className="text-[11px] font-bold text-[#8E9AB8] uppercase tracking-wider font-mono">
                    Included Capabilities
                  </span>
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-[#D7DEED]">
                      <Check className="w-3.5 h-3.5 text-[#38BDF8] shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-[#242B3F]">
                {isCurrent ? (
                  <UIButton
                    variant="outline"
                    size="md"
                    className="w-full opacity-60"
                    disabled
                  >
                    Current Plan
                  </UIButton>
                ) : (
                  <UIButton
                    variant={plan.isPopular ? 'primary' : 'secondary'}
                    size="md"
                    className="w-full"
                    onClick={() => handlePlanSelect(plan)}
                    rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                  >
                    {plan.priceUah === 0 ? 'Switch to Starter' : `Select ${plan.name}`}
                  </UIButton>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Security & Payment Provider Footer */}
      <div className="mt-8 p-4 rounded-xl bg-[#171B29] border border-[#293047] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#8E9AB8] shadow-[inset_0_1px_0_rgba(215,222,237,0.06)]">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>
            Payment processing integration via <strong>WayForPay</strong>. Supports Visa, MasterCard, Apple Pay, Google Pay, and Privat24.
          </span>
        </div>
        <span className="font-mono text-[11px] text-[#5E6985]">
          TLS 1.3 256-Bit Encryption • PCI DSS Level 1
        </span>
      </div>
    </div>
  );
};

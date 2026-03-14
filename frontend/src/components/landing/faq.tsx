"use client";

import { useState } from "react";

const faqs = [
  {
    question: "What tokens does AstraSend support?",
    answer:
      "Currently AstraSend supports USDT (Tether) as the primary corridor token. This provides stability during transit, eliminating FX risk between send and receive.",
  },
  {
    question: "How does group funding work?",
    answer:
      "When you create a remittance, anyone can contribute to it. Share the remittance link with family or friends, and they can contribute USDT directly. All contributions are tracked on-chain with full transparency.",
  },
  {
    question: "What happens if a remittance expires?",
    answer:
      "If a remittance has an expiry date and the target isn't met in time, contributors can claim full refunds. The creator can also cancel at any time to trigger refunds.",
  },
  {
    question: "How is compliance handled?",
    answer:
      "AstraSend uses pluggable compliance modules. Phase 1 uses a KYC-based allowlist with configurable daily limits (default 10,000 USDT). Phase 2 adds Worldcoin World ID for biometric proof-of-personhood via zero-knowledge proofs.",
  },
  {
    question: "What are the fees?",
    answer:
      "The platform fee is 0.5% of the remittance amount, deducted at release. There are no hidden fees, no FX markups, and no wire transfer charges. Gas fees on Base L2 are typically under $0.01.",
  },
  {
    question: "Is AstraSend audited?",
    answer:
      "The smart contracts include comprehensive test coverage with 229 passing tests (unit, integration, invariant, and fuzz tests). A formal audit is planned before mainnet deployment.",
  },
];

function FaqItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-5 text-left"
      >
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {question}
        </span>
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          className={`shrink-0 text-zinc-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          <path
            d="M5 7.5l5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div
        className={`grid transition-all duration-200 ${
          isOpen ? "grid-rows-[1fr] pb-5" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
}

export function FAQ() {
  return (
    <section id="faq" className="py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4">
        <div className="mb-10 text-center sm:mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            FAQ
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-100">
            Frequently asked questions
          </h2>
        </div>

        {/* FAQ items */}
        <div className="rounded-2xl border border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-900">
          {faqs.map((faq) => (
            <FaqItem key={faq.question} {...faq} />
          ))}
        </div>
      </div>
    </section>
  );
}

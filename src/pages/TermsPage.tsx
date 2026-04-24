import React from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { FileText, Mail, Scale, CreditCard, ShieldAlert, AlertTriangle, Ban } from 'lucide-react';

const Section = ({ icon: Icon, title, children }: { icon: React.ElementType, title: string, children: React.ReactNode }) => (
  <div className="border border-[var(--color-brand-border-hi)] bg-[var(--color-brand-bg2)] p-6">
    <h3 className="flex items-center gap-2 text-[var(--color-brand-amber)] font-bold text-lg mb-4">
      <Icon className="w-5 h-5 flex-shrink-0" />
      {title}
    </h3>
    <div className="text-[var(--color-brand-muted)] text-sm leading-relaxed space-y-3">
      {children}
    </div>
  </div>
);

export function TermsPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full flex flex-col gap-8 py-4"
    >
      {/* Page header */}
      <div className="text-center border-b border-[var(--color-brand-border-hi)] pb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Scale className="w-8 h-8 text-[var(--color-brand-amber)]" />
          <h1 className="text-3xl md:text-4xl font-bold text-[var(--color-brand-text)]">
            TERMS OF SERVICE
          </h1>
        </div>
        <p className="text-[var(--color-brand-muted)] text-sm">
          Last updated: April 2026 · REMOTEJOB.CLUB
        </p>
      </div>

      {/* Introduction */}
      <Section icon={FileText} title="1. AGREEMENT TO TERMS">
        <p>
          By accessing or using <strong className="text-[var(--color-brand-text)]">RemoteJob.Club</strong> ("the Service", "the Platform", "the Vault"),
          you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
        </p>
        <p>
          The Service is operated by an independent developer ("we", "us", "the Owner").
          These terms apply to all users, including free and paid tier members.
        </p>
      </Section>

      {/* Service Description */}
      <Section icon={ShieldAlert} title="2. DESCRIPTION OF SERVICE">
        <p>
          RemoteJob.Club is a <strong className="text-[var(--color-brand-text)]">job curation and discovery platform</strong> that aggregates
          remote job opportunities from publicly available company career pages and Applicant Tracking Systems (ATS).
        </p>
        <p>We provide:</p>
        <ul className="list-disc list-inside space-y-2 pl-2">
          <li>Curated listings of verified, active remote job opportunities.</li>
          <li>AI-powered resume-to-job matching using third-party language models.</li>
          <li>Direct links to company application pages.</li>
        </ul>
        <p className="mt-2">
          <strong className="text-[var(--color-brand-text)]">We are not a recruitment agency, staffing firm, or employer.</strong> We do not participate in hiring
          decisions and have no influence over whether any company contacts, interviews, or employs you.
        </p>
      </Section>

      {/* User Accounts */}
      <Section icon={FileText} title="3. USER ACCOUNTS">
        <p>To access certain features, you must create an account using email/password or Google OAuth. You agree to:</p>
        <ul className="list-disc list-inside space-y-2 pl-2">
          <li>Provide accurate and current information during registration.</li>
          <li>Maintain the security of your account credentials.</li>
          <li>Not share your account with others or create multiple accounts to circumvent tier limits.</li>
          <li>Notify us immediately of any unauthorized use of your account.</li>
        </ul>
        <p className="mt-2">
          We reserve the right to suspend or terminate accounts that violate these terms.
        </p>
      </Section>

      {/* Paid Tiers */}
      <Section icon={CreditCard} title="4. PAID PASSES & PAYMENTS">
        <p>
          RemoteJob.Club offers optional paid passes (<strong className="text-[var(--color-brand-text)]">Pro</strong> and{' '}
          <strong className="text-[var(--color-brand-text)]">Elite</strong>) that unlock higher usage quotas for a <strong className="text-[var(--color-brand-text)]">fixed 30-day period</strong>.
        </p>
        <ul className="list-disc list-inside space-y-2 pl-2">
          <li>Passes are <strong className="text-[var(--color-brand-text)]">one-time payments</strong>, not recurring subscriptions. You will not be auto-charged.</li>
          <li>After 30 days, your account reverts to the Free tier automatically. No cancellation needed.</li>
          <li>Payments are processed securely via <strong className="text-[var(--color-brand-text)]">PayPal</strong>. We never see or store your payment details.</li>
          <li>All payments go directly to the independent developer who builds and maintains this platform.</li>
        </ul>
      </Section>

      {/* Refund Policy */}
      <Section icon={CreditCard} title="5. REFUND POLICY">
        <p>
          Due to the digital nature of the Service and immediate access upon purchase:
        </p>
        <ul className="list-disc list-inside space-y-2 pl-2">
          <li>Refunds are handled on a <strong className="text-[var(--color-brand-text)]">case-by-case basis</strong>.</li>
          <li>If the Service was materially unavailable during your paid period, contact us for a proportional refund.</li>
          <li>We do not guarantee any specific outcome (interviews, job offers) from using the Service. Lack of job offers is not grounds for a refund.</li>
        </ul>
      </Section>

      {/* Acceptable Use */}
      <Section icon={Ban} title="6. ACCEPTABLE USE">
        <p>You agree NOT to:</p>
        <ul className="list-disc list-inside space-y-2 pl-2">
          <li>Use bots, scrapers, or automation tools to extract data from the platform.</li>
          <li>Resell, redistribute, or republish job listings obtained from the Service.</li>
          <li>Attempt to circumvent tier limits, quotas, or anti-spam protections.</li>
          <li>Upload malicious content, spam, or content that is not a genuine resume.</li>
          <li>Impersonate another person or misrepresent your affiliation.</li>
          <li>Interfere with or disrupt the Service or its infrastructure.</li>
        </ul>
        <p className="mt-2">
          Violation of these terms may result in immediate account termination without refund.
        </p>
      </Section>

      {/* Disclaimers */}
      <div className="border-2 border-[var(--color-brand-amber)] bg-[var(--color-brand-amber)]/5 p-6">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-8 h-8 text-[var(--color-brand-amber)] flex-shrink-0 mt-1" />
          <div>
            <h2 className="text-[var(--color-brand-amber)] font-bold text-lg mb-3 uppercase tracking-wider">
              7. Disclaimers & Limitation of Liability
            </h2>
            <div className="space-y-3 text-[var(--color-brand-text)] text-sm leading-relaxed">
              <p>
                THE SERVICE IS PROVIDED <strong>"AS IS"</strong> AND <strong>"AS AVAILABLE"</strong> WITHOUT WARRANTIES OF ANY KIND,
                EITHER EXPRESS OR IMPLIED.
              </p>
              <p>We do not warrant that:</p>
              <ul className="list-disc list-inside space-y-2 pl-2 text-[var(--color-brand-muted)]">
                <li>Job listings are accurate, current, or complete.</li>
                <li>The Service will be uninterrupted or error-free.</li>
                <li>AI-generated resume matches will be accurate or suitable.</li>
                <li>Use of the Service will result in employment.</li>
              </ul>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
                SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE.
              </p>
              <p>
                OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID FOR THE SERVICE IN THE 30-DAY PERIOD
                PRECEDING THE CLAIM.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Intellectual Property */}
      <Section icon={ShieldAlert} title="8. INTELLECTUAL PROPERTY">
        <p>
          The Service's design, code, branding, and user interface are the intellectual property of the Owner.
          Job listing content is sourced from third-party career pages and remains the property of the respective companies.
        </p>
        <p>
          You retain ownership of any resume text you upload. By uploading, you grant us a temporary, limited license
          to process it through our AI matching pipeline for the sole purpose of delivering results to you.
          <strong className="text-[var(--color-brand-text)]"> We do not store, retain, or reuse your resume text after processing.</strong>
        </p>
      </Section>

      {/* Changes to Terms */}
      <Section icon={FileText} title="9. CHANGES TO THESE TERMS">
        <p>
          We may update these Terms of Service from time to time. Changes will be posted on this page with an updated
          "Last updated" date. Continued use of the Service after changes constitutes acceptance of the revised terms.
        </p>
        <p>
          For material changes (e.g., pricing, data practices), we will notify registered users via email.
        </p>
      </Section>

      {/* Governing Law */}
      <Section icon={Scale} title="10. GOVERNING LAW">
        <p>
          These terms shall be governed by and construed in accordance with applicable laws. Any disputes
          arising from these terms shall be resolved through good-faith negotiation first, and if unresolved,
          through binding arbitration.
        </p>
      </Section>

      {/* Contact */}
      <div className="border border-[var(--color-brand-border)] bg-[var(--color-brand-bg2)] p-6 flex items-start gap-4">
        <Mail className="w-5 h-5 text-[var(--color-brand-green)] flex-shrink-0 mt-1" />
        <div>
          <h3 className="font-bold text-[var(--color-brand-text)] mb-2">CONTACT</h3>
          <p className="text-[var(--color-brand-muted)] text-sm">
            Questions about these terms:{' '}
            <a href="mailto:terms@remotejob.club" className="text-[var(--color-brand-amber)] hover:underline">
              terms@remotejob.club
            </a>
          </p>
          <p className="text-[var(--color-brand-muted)] text-sm mt-1">
            See also:{' '}
            <Link to="/privacy" className="text-[var(--color-brand-amber)] hover:underline">
              Privacy Policy & Disclaimer
            </Link>
          </p>
        </div>
      </div>

      {/* Back link */}
      <div className="text-center">
        <Link
          to="/"
          className="text-xs text-[var(--color-brand-muted)] hover:text-[var(--color-brand-amber)] transition-colors"
        >
          ← RETURN TO REMOTEJOB.CLUB
        </Link>
      </div>
    </motion.div>
  );
}

import React from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ShieldAlert, FileText, AlertTriangle, Mail } from 'lucide-react';

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

export function PrivacyPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full flex flex-col gap-8 py-4"
    >
      {/* Page header */}
      <div className="text-center border-b border-[var(--color-brand-border-hi)] pb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <FileText className="w-8 h-8 text-[var(--color-brand-amber)]" />
          <h1 className="text-3xl md:text-4xl font-bold text-[var(--color-brand-text)]">
            PRIVACY & DISCLAIMER
          </h1>
        </div>
        <p className="text-[var(--color-brand-muted)] text-sm">
          Last updated: April 2026 · REMOTEJOB.CLUB
        </p>
      </div>

      {/* Critical Disclaimer — first and most prominent */}
      <div className="border-2 border-[var(--color-brand-amber)] bg-[var(--color-brand-amber)]/5 p-6">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-8 h-8 text-[var(--color-brand-amber)] flex-shrink-0 mt-1" />
          <div>
            <h2 className="text-[var(--color-brand-amber)] font-bold text-lg mb-3 uppercase tracking-wider">
              Platform Disclaimer — Please Read
            </h2>
            <div className="space-y-3 text-[var(--color-brand-text)] text-sm leading-relaxed">
              <p>
                <strong>REMOTEJOB.CLUB is a job curation platform, not a recruitment agency.</strong> We aggregate
                and surface remote job opportunities from public career pages and ATS (Applicant Tracking System) platforms.
              </p>
              <p>
                We are <strong>not responsible for getting you a job interview, offer, or employment.</strong> The
                decision to select or reject your application is <strong>entirely at the discretion of the hiring company</strong>,
                and we have no influence over, or involvement in, any hiring decision.
              </p>
              <p>
                By using this platform, you acknowledge and agree that:
              </p>
              <ul className="list-disc list-inside space-y-2 pl-2 text-[var(--color-brand-muted)]">
                <li>Job listings are sourced from public sources and may become outdated or unavailable without notice.</li>
                <li>We do not guarantee the accuracy, completeness, or currency of any job listing.</li>
                <li>We do not act as an employer, recruiter, or staffing agency.</li>
                <li>Application outcomes are solely determined by the respective hiring companies.</li>
                <li>We are not liable for any losses arising from the use of job leads found on this platform.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Privacy Policy Sections */}
      <Section icon={ShieldAlert} title="1. DATA WE COLLECT">
        <p>We collect the minimum data necessary to provide the service:</p>
        <ul className="list-disc list-inside space-y-2 pl-2">
          <li><strong className="text-[var(--color-brand-text)]">Account data:</strong> Your email address and name, used solely for authentication and personalisation.</li>
          <li><strong className="text-[var(--color-brand-text)]">Profile preferences:</strong> Job title, industry, tech stack, and location preference you optionally provide to improve job matching.</li>
          <li><strong className="text-[var(--color-brand-text)]">Resume text:</strong> When you upload a resume PDF, the text is extracted in-browser and sent to our AI matching service. <strong className="text-[var(--color-brand-text)]">We do not store your resume file or raw text on our servers.</strong></li>
          <li><strong className="text-[var(--color-brand-text)]">Saved jobs:</strong> Job listings you choose to bookmark, stored against your account.</li>
        </ul>
      </Section>

      <Section icon={FileText} title="2. HOW WE USE YOUR DATA">
        <p>Your data is used exclusively to:</p>
        <ul className="list-disc list-inside space-y-2 pl-2">
          <li>Authenticate your identity and maintain your session.</li>
          <li>Match your resume against verified job listings using AI scoring.</li>
          <li>Pre-fill search constraints using your saved preferences.</li>
          <li>Display saved jobs in your personal dashboard.</li>
        </ul>
        <p className="mt-2">
          We do <strong className="text-[var(--color-brand-text)]">not</strong> sell, share, or disclose your personal data to third parties for marketing purposes.
          We do not use your resume text to train AI models.
        </p>
      </Section>

      <Section icon={ShieldAlert} title="3. THIRD-PARTY SERVICES">
        <p>We use the following trusted third-party services:</p>
        <ul className="list-disc list-inside space-y-2 pl-2">
          <li><strong className="text-[var(--color-brand-text)]">Supabase</strong> — Authentication and database hosting (EU-based, GDPR-compliant).</li>
          <li><strong className="text-[var(--color-brand-text)]">OpenRouter / AI providers</strong> — Resume text is sent to AI APIs for matching. Resume text is not retained beyond the API call.</li>
          <li><strong className="text-[var(--color-brand-text)]">Vercel</strong> — Web hosting and edge delivery (SOC 2 certified).</li>
          <li><strong className="text-[var(--color-brand-text)]">Google OAuth</strong> — Optional sign-in. If used, we only receive your email and basic profile info from Google.</li>
        </ul>
      </Section>

      <Section icon={AlertTriangle} title="4. DATA RETENTION & DELETION">
        <p>
          You may request deletion of your account and all associated data at any time by contacting us (see below).
          Upon request, we will delete your account, profile preferences, and saved jobs within 14 business days.
        </p>
        <p>
          Session tokens expire automatically after inactivity. We do not retain resume text after a scan session completes.
        </p>
      </Section>

      <Section icon={FileText} title="5. YOUR RIGHTS">
        <p>Depending on your jurisdiction, you may have rights to:</p>
        <ul className="list-disc list-inside space-y-2 pl-2">
          <li>Access the personal data we hold about you.</li>
          <li>Correct inaccurate personal data.</li>
          <li>Request deletion of your data.</li>
          <li>Object to processing of your data.</li>
          <li>Data portability (export your data in a structured format).</li>
        </ul>
        <p className="mt-2">To exercise any of these rights, contact us at the email below.</p>
      </Section>

      <Section icon={FileText} title="6. COOKIES">
        <p>
          We use only essential session cookies required for authentication. We do not use tracking,
          advertising, or analytics cookies. You can disable cookies in your browser settings, though
          this will prevent you from staying logged in.
        </p>
      </Section>

      {/* Contact */}
      <div className="border border-[var(--color-brand-border)] bg-[var(--color-brand-bg2)] p-6 flex items-start gap-4">
        <Mail className="w-5 h-5 text-[var(--color-brand-green)] flex-shrink-0 mt-1" />
        <div>
          <h3 className="font-bold text-[var(--color-brand-text)] mb-2">CONTACT</h3>
          <p className="text-[var(--color-brand-muted)] text-sm">
            Questions about this policy or data requests:{' '}
            <a href="mailto:privacy@remotejob.club" className="text-[var(--color-brand-amber)] hover:underline">
              privacy@remotejob.club
            </a>
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

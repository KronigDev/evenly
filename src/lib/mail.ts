import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '@/lib/env';
import type { Locale } from '@/i18n/request';

let transporter: Transporter | null = null;

function getTransport(): Transporter {
  // Email needs a configured SMTP server. Without one, email-dependent
  // features (invites, magic link, verification, password reset, reminders)
  // simply do not work — sending throws and the caller handles it.
  if (!env.SMTP_HOST) {
    throw new Error('Email is not configured: set SMTP_HOST (and the other SMTP_* variables).');
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendMail({ to, subject, html, text }: SendMailInput): Promise<void> {
  await getTransport().sendMail({ from: env.EMAIL_FROM, to, subject, html, text });
}

// ---------------------------------------------------------------------------
// Branded, email-client-safe HTML shell (inline styles, table-free, dark-text).
// ---------------------------------------------------------------------------

/** Escape a value for interpolation into HTML text or attribute context. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface LayoutInput {
  heading: string;
  intro: string;
  body?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footnote?: string;
  footer: string;
}

// `intro` and `body` may contain trusted markup from our own templates; any
// user-provided values interpolated into them must be escaped at the call site.
function layout({ heading, intro, body, ctaLabel, ctaUrl, footnote, footer }: LayoutInput): string {
  const url = ctaUrl ? escapeHtml(ctaUrl) : '';
  const button =
    ctaLabel && ctaUrl
      ? `<a href="${url}" style="display:inline-block;background:#0a7a55;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:12px;">${escapeHtml(ctaLabel)}</a>`
      : '';
  const fallback =
    ctaUrl && ctaLabel
      ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#8a8880;">${escapeHtml(footnote ?? '')}<br/><a href="${url}" style="color:#0a7a55;word-break:break-all;">${url}</a></p>`
      : '';
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#f4f2ee;">
<div style="max-width:520px;margin:0 auto;padding:32px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;">
    <span style="display:inline-block;width:30px;height:30px;border-radius:9px;background:#0a7a55;color:#fff;text-align:center;line-height:30px;font-weight:700;">E</span>
    <span style="font-size:18px;font-weight:700;color:#1a1a18;letter-spacing:-0.01em;">Evenly</span>
  </div>
  <div style="background:#ffffff;border:1px solid #eae8e2;border-radius:18px;padding:32px;">
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:#1a1a18;letter-spacing:-0.02em;">${escapeHtml(heading)}</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#52504a;">${intro}</p>
    ${body ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#52504a;">${body}</p>` : ''}
    ${button}
    ${fallback}
  </div>
  <p style="margin:20px 4px 0;font-size:12px;line-height:1.6;color:#9a988f;">${escapeHtml(footer)}</p>
</div>
</body></html>`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------------------
// Localized copy
// ---------------------------------------------------------------------------
type Dict = Record<Locale, string>;
const pick = (d: Dict, locale: Locale) => d[locale] ?? d.en;
const FOOTER: Dict = {
  en: "You received this email from Evenly. If you weren't expecting it, you can safely ignore it.",
  de: 'Du hast diese E-Mail von Evenly erhalten. Falls du sie nicht erwartet hast, kannst du sie ignorieren.',
};

export async function sendInviteEmail(input: {
  to: string;
  inviterName: string;
  groupName: string;
  acceptUrl: string;
  locale?: Locale;
}): Promise<void> {
  const locale = input.locale ?? 'en';
  const subject = pick(
    {
      en: `${input.inviterName} invited you to "${input.groupName}" on Evenly`,
      de: `${input.inviterName} hat dich zu „${input.groupName}" bei Evenly eingeladen`,
    },
    locale,
  );
  const inviterName = escapeHtml(input.inviterName);
  const groupName = escapeHtml(input.groupName);
  const html = layout({
    heading: pick({ en: "You've been invited", de: 'Du wurdest eingeladen' }, locale),
    intro: pick(
      {
        en: `<strong>${inviterName}</strong> invited you to share expenses in <strong>${groupName}</strong>. Accept to see who owes what and settle up.`,
        de: `<strong>${inviterName}</strong> hat dich eingeladen, in <strong>${groupName}</strong> Ausgaben zu teilen. Nimm an, um zu sehen, wer wem was schuldet.`,
      },
      locale,
    ),
    ctaLabel: pick({ en: 'Accept invitation', de: 'Einladung annehmen' }, locale),
    ctaUrl: input.acceptUrl,
    footnote: pick({ en: 'Or open this link:', de: 'Oder öffne diesen Link:' }, locale),
    footer: pick(FOOTER, locale),
  });
  await sendMail({ to: input.to, subject, html, text: stripHtml(html) });
}

export async function sendMagicLinkEmail(input: {
  to: string;
  url: string;
  locale?: Locale;
}): Promise<void> {
  const locale = input.locale ?? 'en';
  const html = layout({
    heading: pick({ en: 'Your sign-in link', de: 'Dein Anmeldelink' }, locale),
    intro: pick(
      {
        en: 'Click the button below to sign in to Evenly. This link expires in 30 minutes and can be used once.',
        de: 'Klicke auf den Button, um dich bei Evenly anzumelden. Der Link läuft in 30 Minuten ab und ist einmal gültig.',
      },
      locale,
    ),
    ctaLabel: pick({ en: 'Sign in to Evenly', de: 'Bei Evenly anmelden' }, locale),
    ctaUrl: input.url,
    footnote: pick({ en: 'Or open this link:', de: 'Oder öffne diesen Link:' }, locale),
    footer: pick(FOOTER, locale),
  });
  await sendMail({
    to: input.to,
    subject: pick({ en: 'Sign in to Evenly', de: 'Bei Evenly anmelden' }, locale),
    html,
    text: stripHtml(html),
  });
}

export async function sendVerifyEmail(input: {
  to: string;
  url: string;
  locale?: Locale;
}): Promise<void> {
  const locale = input.locale ?? 'en';
  const html = layout({
    heading: pick({ en: 'Confirm your email', de: 'Bestätige deine E-Mail' }, locale),
    intro: pick(
      {
        en: 'Welcome to Evenly! Confirm your email address to secure your account. This link expires in 24 hours.',
        de: 'Willkommen bei Evenly! Bestätige deine E-Mail-Adresse, um dein Konto zu sichern. Der Link läuft in 24 Stunden ab.',
      },
      locale,
    ),
    ctaLabel: pick({ en: 'Confirm email', de: 'E-Mail bestätigen' }, locale),
    ctaUrl: input.url,
    footnote: pick({ en: 'Or open this link:', de: 'Oder öffne diesen Link:' }, locale),
    footer: pick(FOOTER, locale),
  });
  await sendMail({
    to: input.to,
    subject: pick({ en: 'Confirm your Evenly email', de: 'Bestätige deine Evenly-E-Mail' }, locale),
    html,
    text: stripHtml(html),
  });
}

export async function sendPasswordResetEmail(input: {
  to: string;
  url: string;
  locale?: Locale;
}): Promise<void> {
  const locale = input.locale ?? 'en';
  const html = layout({
    heading: pick({ en: 'Reset your password', de: 'Passwort zurücksetzen' }, locale),
    intro: pick(
      {
        en: 'We received a request to reset your password. This link expires in 1 hour. If you did not request it, ignore this email.',
        de: 'Wir haben eine Anfrage zum Zurücksetzen deines Passworts erhalten. Der Link läuft in 1 Stunde ab. Falls du das nicht warst, ignoriere diese E-Mail.',
      },
      locale,
    ),
    ctaLabel: pick({ en: 'Reset password', de: 'Passwort zurücksetzen' }, locale),
    ctaUrl: input.url,
    footnote: pick({ en: 'Or open this link:', de: 'Oder öffne diesen Link:' }, locale),
    footer: pick(FOOTER, locale),
  });
  await sendMail({
    to: input.to,
    subject: pick({ en: 'Reset your Evenly password', de: 'Evenly-Passwort zurücksetzen' }, locale),
    html,
    text: stripHtml(html),
  });
}

export async function sendReminderEmail(input: {
  to: string;
  fromName: string;
  amountFormatted: string;
  groupName: string;
  url: string;
  locale?: Locale;
}): Promise<void> {
  const locale = input.locale ?? 'en';
  const fromName = escapeHtml(input.fromName);
  const amountFormatted = escapeHtml(input.amountFormatted);
  const groupName = escapeHtml(input.groupName);
  const html = layout({
    heading: pick({ en: 'A friendly reminder', de: 'Eine freundliche Erinnerung' }, locale),
    intro: pick(
      {
        en: `<strong>${fromName}</strong> sent you a reminder: you owe <strong>${amountFormatted}</strong> in <strong>${groupName}</strong>.`,
        de: `<strong>${fromName}</strong> erinnert dich: Du schuldest <strong>${amountFormatted}</strong> in <strong>${groupName}</strong>.`,
      },
      locale,
    ),
    ctaLabel: pick({ en: 'View balance', de: 'Saldo ansehen' }, locale),
    ctaUrl: input.url,
    footer: pick(FOOTER, locale),
  });
  await sendMail({
    to: input.to,
    subject: pick(
      {
        en: `Reminder: you owe ${input.amountFormatted}`,
        de: `Erinnerung: du schuldest ${input.amountFormatted}`,
      },
      locale,
    ),
    html,
    text: stripHtml(html),
  });
}

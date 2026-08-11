/**
 * Email Service
 * ------------------------------------------------------------------
 * All application email (employee invitations + password reset links)
 * flows through this service. It renders the HTML templates and hands
 * the message to a provider configured via env vars.
 *
 * Providers:
 *   EMAIL_PROVIDER=resend  — Resend REST API (no SDK required, fetch
 *                            only). Needs RESEND_API_KEY + EMAIL_FROM.
 *   EMAIL_PROVIDER=smtp    — any SMTP server via nodemailer (optional
 *                            dependency; only required for this provider).
 *                            Needs SMTP_HOST / SMTP_PORT / SMTP_USER /
 *                            SMTP_PASS / SMTP_SECURE + EMAIL_FROM.
 *   EMAIL_PROVIDER=console — DEV ONLY. Logs the rendered message to
 *                            stdout instead of sending. Hard-rejected in
 *                            production so a misconfig can never make a
 *                            production server silently "send" nothing.
 *
 * If EMAIL_PROVIDER is missing or its credentials are incomplete, every
 * send throws a 502 ApiError with the exact env vars to set. We never
 * silently fake a successful delivery.
 */

const ApiError = require("../utils/ApiError");
const env = require("../config/env");
const logger = require("../utils/logger");

const CONFIG_ERROR_MSG =
  'Email is not configured. Set EMAIL_PROVIDER to "resend" or "smtp" ' +
  "(plus RESEND_API_KEY, or SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS) and " +
  "EMAIL_FROM in backend/.env — see backend/.env.example.";

function configError() {
  return new ApiError(502, CONFIG_ERROR_MSG);
}

// ------------------------------------------------------------------
// Templates
// ------------------------------------------------------------------

function baseLayout(title, bodyHtml) {
  return `
  <div style="max-width:560px;margin:0 auto;font-family:Segoe UI,Arial,sans-serif;background:#0b1220;color:#e2e8f0;border-radius:12px;overflow:hidden;border:1px solid #1e293b">
    <div style="padding:24px 28px;background:#0f172a;border-bottom:1px solid #1e293b">
      <span style="color:#10b981;font-weight:800;font-size:18px">FinFlow</span>
    </div>
    <div style="padding:28px">
      <h1 style="margin:0 0 12px;font-size:20px;color:#fff">${title}</h1>
      ${bodyHtml}
    </div>
    <div style="padding:16px 28px;background:#0f172a;border-top:1px solid #1e293b;font-size:12px;color:#64748b">
      If you didn't request this, you can safely ignore this email.
    </div>
  </div>`;
}

function buttonHtml(href, label) {
  return `<a href="${href}" style="display:inline-block;margin:16px 0;padding:12px 22px;background:#10b981;color:#fff !important;text-decoration:none;border-radius:8px;font-weight:600">${label}</a>`;
}

/** Employee invitation email (PRD Section 30.2). */
function renderEmployeeInvitation({ organizationName, workspaceName, inviterName, inviteUrl, expiresInText }) {
  const org = organizationName || "an organization";
  const subject = `You're invited to join ${org} on FinFlow`;
  const html = baseLayout(
    `You're invited to ${org}`,
    `
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">
      ${inviterName ? `${inviterName} has invited you` : "You have been invited"} to join
      <strong style="color:#fff">${org}</strong>${workspaceName ? ` (workspace: <strong style="color:#fff">${workspaceName}</strong>)` : ""} on FinFlow.
    </p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">
      Click the button below to accept. Sign in (or create an account) with your
      invited email address and you'll be added to the workspace automatically.
    </p>
    ${buttonHtml(inviteUrl, "Accept Invitation")}
    <p style="margin:0;font-size:12px;color:#94a3b8">
      This link is single-use and ${expiresInText}. If the link doesn't work, copy
      and paste this into your browser: <code style="font-size:11px;word-break:break-all">${inviteUrl}</code>
    </p>
  `
  );
  return { subject, html, text: `You're invited to join ${org} on FinFlow: ${inviteUrl} (single-use, ${expiresInText})` };
}

/** Password reset email (PRD Section 30.3). */
function renderPasswordReset({ resetUrl, expiresInText }) {
  const subject = "Reset your FinFlow password";
  const html = baseLayout(
    "Reset your password",
    `
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6">
      We received a request to reset the password for your FinFlow account.
      Click the button below to choose a new password.
    </p>
    ${buttonHtml(resetUrl, "Reset Password")}
    <p style="margin:0;font-size:12px;color:#94a3b8">
      This link is single-use and ${expiresInText}. If you didn't request this, you can
      safely ignore this email — your password will not change.
    </p>
  `
  );
  return { subject, html, text: `Reset your FinFlow password: ${resetUrl} (single-use, ${expiresInText})` };
}

// ------------------------------------------------------------------
// Delivery
// ------------------------------------------------------------------

async function sendEmail({ to, subject, html, text }) {
  const provider = (env.EMAIL_PROVIDER || "").toLowerCase();

  if (!provider) {
    throw configError();
  }

  // Dev-only recipient override: lets the forgot-password / invite flows
  // be tested end-to-end without a verified Resend domain. Delivery still
  // goes through the real provider and its actual response is returned —
  // only the recipient is redirected, with a visible warning. It is
  // hard-rejected in production so a misconfig can never redirect real
  // customer mail.
  const overrideRecipient = (env.EMAIL_DEV_OVERRIDE_RECIPIENT || "").trim();
  if (overrideRecipient) {
    if (env.isProduction) {
      throw new ApiError(
        502,
        "EMAIL_DEV_OVERRIDE_RECIPIENT is not allowed when NODE_ENV=production. It is a development/testing convenience only."
      );
    }
    logger.warn(
      `[DEV EMAIL OVERRIDE] Intended recipient "${to}" — delivered to "${overrideRecipient}" instead.`
    );
    to = overrideRecipient;
  }

  if (provider === "console") {
    if (env.isProduction) {
      throw new ApiError(
        502,
        "EMAIL_PROVIDER=console is not allowed when NODE_ENV=production. Configure a real email provider (resend or smtp)."
      );
    }
    logger.info(`[DEV EMAIL] To: ${to} | Subject: ${subject}\n${html}`);
    return { emailSent: false, channel: "console" };
  }

  if (provider === "resend") {
    if (!env.RESEND_API_KEY) {
      throw new ApiError(502, 'Email provider "resend" is not configured: set RESEND_API_KEY in backend/.env.');
    }
    if (!env.EMAIL_FROM) {
      throw new ApiError(502, "Email provider is not configured: set EMAIL_FROM in backend/.env.");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, html }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new ApiError(502, `Email provider rejected the request (HTTP ${response.status}). ${detail.slice(0, 300)}`);
    }

    return { emailSent: true, channel: "resend" };
  }

  if (provider === "smtp") {
    if (!env.SMTP_HOST || !env.SMTP_PORT) {
      throw new ApiError(502, 'Email provider "smtp" is not configured: set SMTP_HOST and SMTP_PORT in backend/.env.');
    }
    if (!env.EMAIL_FROM) {
      throw new ApiError(502, "Email provider is not configured: set EMAIL_FROM in backend/.env.");
    }

    let nodemailer = null;
    try {
      // Deliberately lazily required: nodemailer is an optional dependency
      // used only when EMAIL_PROVIDER=smtp is chosen.
      nodemailer = require("nodemailer");
    } catch {
      throw new ApiError(
        502,
        'Email provider "smtp" requires the nodemailer package. Run `npm install nodemailer` in backend/.'
      );
    }

    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: Boolean(env.SMTP_SECURE),
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS || "" } : undefined,
    });

    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, " "),
    });

    return { emailSent: true, channel: "smtp" };
  }

  throw configError();
}

async function sendEmployeeInvitation({ to, inviteUrl, organizationName, workspaceName, inviterName, expiresInText }) {
  const { subject, html, text } = renderEmployeeInvitation({
    organizationName,
    workspaceName,
    inviterName,
    inviteUrl,
    expiresInText: expiresInText || "expires in 7 days",
  });
  return sendEmail({ to, subject, html, text });
}

async function sendPasswordReset({ to, resetUrl, expiresInText }) {
  const { subject, html, text } = renderPasswordReset({
    resetUrl,
    expiresInText: expiresInText || "expires in 1 hour",
  });
  return sendEmail({ to, subject, html, text });
}

module.exports = {
  sendEmail,
  sendEmployeeInvitation,
  sendPasswordReset,
};

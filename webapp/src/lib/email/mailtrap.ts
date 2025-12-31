import nodemailer from 'nodemailer'

const mailtrapHost = process.env.MAILTRAP_HOST || 'sandbox.smtp.mailtrap.io'
const mailtrapPort = parseInt(process.env.MAILTRAP_PORT || '2525', 10)
const mailtrapUsername = process.env.MAILTRAP_USERNAME
const mailtrapPassword = process.env.MAILTRAP_PASSWORD
const mailtrapFromEmail = process.env.MAILTRAP_FROM_EMAIL || 'Vault <vault@example.com>'
const appUrl = process.env.APP_URL || 'http://localhost:3000'

if (!mailtrapUsername || !mailtrapPassword) {
  console.warn('Mailtrap credentials not configured. Email sending will fail.')
}

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: mailtrapHost,
  port: mailtrapPort,
  auth: {
    user: mailtrapUsername,
    pass: mailtrapPassword,
  },
})

export interface InviteEmailParams {
  to: string
  inviteToken: string
  inviterEmail: string
  vaultName?: string
}

/**
 * Send a team invite email
 */
export async function sendInviteEmail(params: InviteEmailParams): Promise<void> {
  const { to, inviteToken, inviterEmail, vaultName } = params

  const acceptUrl = `${appUrl}/api/team/invites/${inviteToken}/accept`

  const mailOptions = {
    from: mailtrapFromEmail,
    to,
    subject: `You've been invited to join ${vaultName || 'a vault'}`,
    html: `
      <h2>Team Invitation</h2>
      <p>You've been invited by <strong>${inviterEmail}</strong> to join ${vaultName || 'a vault'} as a delegate.</p>
      <p>Click the link below to accept the invitation:</p>
      <p><a href="${acceptUrl}">${acceptUrl}</a></p>
      <p>This link will expire in 7 days.</p>
      <p>If you didn't expect this invitation, you can safely ignore this email.</p>
    `,
    text: `
Team Invitation

You've been invited by ${inviterEmail} to join ${vaultName || 'a vault'} as a delegate.

Click the link below to accept the invitation:
${acceptUrl}

This link will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.
    `,
  }

  try {
    await transporter.sendMail(mailOptions)
  } catch (error) {
    console.error('Failed to send invite email:', error)
    throw new Error('Failed to send invite email')
  }
}

export interface VendorSecretEmailParams {
  to: string // Vendor email
  vendorLabel: string
  linkUrl: string
  vendorSecret: string // VS in formatted form (AAAA-BBBB-CCCC-DDDD-EEEE-X)
  expiresAt: Date
}

/**
 * Send vendor secret email
 * Per Step 3 plan: email contains vendor label, link URL, VS, expiry, and security warning
 */
export async function sendVendorSecretEmail(params: VendorSecretEmailParams): Promise<void> {
  const { to, vendorLabel, linkUrl, vendorSecret, expiresAt } = params

  const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const mailOptions = {
    from: mailtrapFromEmail,
    to,
    subject: `Secure Document Access: ${vendorLabel}`,
    html: `
      <h2>Secure Document Access</h2>
      <p>You have been granted access to view documents shared by <strong>${vendorLabel}</strong>.</p>
      
      <h3>Access Information</h3>
      <p><strong>Vendor Secret:</strong> <code style="font-family: monospace; font-size: 1.2em; background: #f5f5f5; padding: 0.5em; border-radius: 4px;">${vendorSecret}</code></p>
      <p><strong>Share Link:</strong> <a href="${linkUrl}">${linkUrl}</a></p>
      <p><strong>Expires:</strong> ${expiryDate}</p>
      
      <h3>Security Warning</h3>
      <p style="color: #d32f2f; font-weight: bold;">⚠️ DO NOT FORWARD THIS EMAIL</p>
      <p>The vendor secret above is a one-time access code. Keep it secure and do not share it with anyone else.</p>
      
      <h3>How to Access</h3>
      <ol>
        <li>Click the share link above or copy it into your browser</li>
        <li>Enter your email address and verify with the one-time passcode</li>
        <li>Enter the vendor secret shown above</li>
        <li>View or download the shared documents</li>
      </ol>
      
      <p>If you did not expect this email, please contact the sender or ignore this message.</p>
    `,
    text: `
Secure Document Access

You have been granted access to view documents shared by ${vendorLabel}.

Access Information:
- Vendor Secret: ${vendorSecret}
- Share Link: ${linkUrl}
- Expires: ${expiryDate}

SECURITY WARNING: DO NOT FORWARD THIS EMAIL
The vendor secret above is a one-time access code. Keep it secure and do not share it with anyone else.

How to Access:
1. Click the share link above or copy it into your browser
2. Enter your email address and verify with the one-time passcode
3. Enter the vendor secret shown above
4. View or download the shared documents

If you did not expect this email, please contact the sender or ignore this message.
    `,
  }

  try {
    await transporter.sendMail(mailOptions)
  } catch (error) {
    console.error('Failed to send vendor secret email:', error)
    throw new Error('Failed to send vendor secret email')
  }
}

/**
 * Verify email service configuration
 */
export async function verifyEmailConfig(): Promise<boolean> {
  if (!mailtrapUsername || !mailtrapPassword) {
    return false
  }

  try {
    await transporter.verify()
    return true
  } catch (error) {
    console.error('Email service verification failed:', error)
    return false
  }
}


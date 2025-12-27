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


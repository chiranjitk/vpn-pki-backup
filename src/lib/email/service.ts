/**
 * Email Service for VPN PKI Management
 * Handles certificate delivery and notification emails using nodemailer
 */

import nodemailer, { Transporter, TransportOptions } from 'nodemailer'
import { db } from '@/lib/db'
import * as fs from 'fs'
import { format } from 'date-fns'

// Email configuration interface
interface SmtpConfig {
  host: string
  port: number
  username: string | null
  password: string | null
  fromEmail: string
  fromName: string
  useTls: boolean
  isEnabled: boolean
}

// Certificate email data
interface CertificateEmailData {
  userName: string
  userEmail: string
  commonName: string
  serialNumber: string
  expiryDate: Date
  pfxPassword: string
}

// Expiry notice data
interface ExpiryNoticeData {
  userName: string
  userEmail: string
  commonName: string
  serialNumber: string
  expiryDate: Date
  daysRemaining: number
}

// Revocation notice data
interface RevocationNoticeData {
  userName: string
  userEmail: string
  commonName: string
  serialNumber: string
  reason: string
  revokedAt: Date
}

// Email result
interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Get SMTP configuration from database
 */
export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const config = await db.smtpConfiguration.findFirst()
  
  if (!config || !config.isEnabled) {
    return null
  }
  
  return {
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    useTls: config.useTls,
    isEnabled: config.isEnabled,
  }
}

/**
 * Create nodemailer transporter
 */
export async function createTransporter(config: SmtpConfig): Promise<Transporter> {
  const transportOptions: TransportOptions = {
    host: config.host,
    port: config.port,
    secure: config.port === 465, // true for 465, false for other ports
    auth: config.username && config.password ? {
      user: config.username,
      pass: config.password,
    } : undefined,
    tls: config.useTls ? {
      rejectUnauthorized: true,
    } : undefined,
    // @ts-ignore - TransportOptions compatibility
    connectionTimeout: 10000, // 10 seconds
    socketTimeout: 10000,
  }

  return nodemailer.createTransport(transportOptions)
}

/**
 * Test SMTP connection
 */
export async function testSmtpConnection(config: SmtpConfig): Promise<{ success: boolean; message: string }> {
  try {
    const transporter = await createTransporter(config)
    await transporter.verify()
    return { success: true, message: 'SMTP connection successful' }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, message: `SMTP connection failed: ${errorMessage}` }
  }
}

/**
 * Send a test email
 */
export async function sendTestEmail(
  config: SmtpConfig,
  testEmail: string
): Promise<EmailResult> {
  try {
    const transporter = await createTransporter(config)
    
    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: testEmail,
      subject: 'VPN PKI Manager - Test Email',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Test Email Successful</h2>
          <p>This is a test email from VPN PKI Manager.</p>
          <p>If you received this email, your SMTP configuration is working correctly.</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px;">
            Sent at: ${format(new Date(), 'PPP pp')}
          </p>
        </div>
      `,
    })

    // Update test email timestamp
    await db.smtpConfiguration.update({
      where: { id: (await db.smtpConfiguration.findFirst())!.id },
      data: { testEmailSentAt: new Date() },
    })

    return { success: true, messageId: info.messageId }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: errorMessage }
  }
}

/**
 * Send certificate delivery email with PKCS#12 attachment
 */
export async function sendCertificateEmail(
  config: SmtpConfig,
  emailData: CertificateEmailData,
  pfxBuffer: Buffer,
  password: string
): Promise<EmailResult> {
  try {
    const transporter = await createTransporter(config)
    
    const formattedExpiryDate = format(emailData.expiryDate, 'PPP')
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">VPN Certificate is Ready</h2>
        </div>
        
        <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="font-size: 16px;">Dear <strong>${emailData.userName}</strong>,</p>
          
          <p>Your VPN client certificate has been generated and is attached to this email as a PKCS#12 bundle (.p12 file).</p>
          
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1f2937;">Installation Instructions:</h3>
            <ol style="color: #4b5563; line-height: 1.8;">
              <li>Save the attached <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">.p12</code> file to your computer</li>
              <li>Double-click the file to import it into your certificate store</li>
              <li>When prompted, enter the password provided below</li>
              <li>Configure your VPN client to use this certificate for authentication</li>
            </ol>
          </div>
          
          <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Certificate Password:</strong></p>
            <p style="font-family: monospace; font-size: 18px; background: white; padding: 10px; border-radius: 4px; margin: 10px 0;">
              <code>${password}</code>
            </p>
          </div>
          
          <div style="background: #fee2e2; border: 1px solid #f87171; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #991b1b;">
              <strong>Important:</strong> Keep this password secure and delete this email after installing the certificate. 
              Never share your certificate or password with anyone.
            </p>
          </div>
          
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #1f2937;">Certificate Details:</h4>
            <table style="width: 100%; font-size: 14px;">
              <tr>
                <td style="color: #6b7280; padding: 5px 0;">Common Name:</td>
                <td style="padding: 5px 0;"><strong>${emailData.commonName}</strong></td>
              </tr>
              <tr>
                <td style="color: #6b7280; padding: 5px 0;">Serial Number:</td>
                <td style="font-family: monospace; padding: 5px 0;">${emailData.serialNumber}</td>
              </tr>
              <tr>
                <td style="color: #6b7280; padding: 5px 0;">Expires On:</td>
                <td style="padding: 5px 0;"><strong>${formattedExpiryDate}</strong></td>
              </tr>
            </table>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            If you did not request this certificate, please contact your administrator immediately.
          </p>
        </div>
        
        <div style="background: #1f2937; color: #9ca3af; padding: 15px; border-radius: 0 0 8px 8px; font-size: 12px; text-align: center;">
          <p style="margin: 0;">This is an automated message from VPN PKI Manager</p>
          <p style="margin: 5px 0 0 0;">Do not reply to this email</p>
        </div>
      </div>
    `

    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: emailData.userEmail,
      subject: `Your VPN Certificate is Ready - ${emailData.commonName}`,
      html: htmlContent,
      attachments: [
        {
          filename: `${emailData.commonName.replace(/[^a-zA-Z0-9]/g, '_')}.p12`,
          content: pfxBuffer,
          contentType: 'application/x-pkcs12',
        },
      ],
    })

    return { success: true, messageId: info.messageId }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: errorMessage }
  }
}

/**
 * Send certificate expiry notice
 */
export async function sendCertificateExpiryNotice(
  config: SmtpConfig,
  emailData: ExpiryNoticeData
): Promise<EmailResult> {
  try {
    const transporter = await createTransporter(config)
    
    const formattedExpiryDate = format(emailData.expiryDate, 'PPP')
    const urgency = emailData.daysRemaining <= 7 ? 'urgent' : 'warning'
    const urgencyColor = urgency === 'urgent' ? '#dc2626' : '#f59e0b'
    const urgencyBg = urgency === 'urgent' ? '#fee2e2' : '#fef3c7'
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, ${urgencyColor} 0%, ${urgencyColor}dd 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">Certificate Expiry Warning</h2>
        </div>
        
        <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="font-size: 16px;">Dear <strong>${emailData.userName}</strong>,</p>
          
          <div style="background: ${urgencyBg}; border: 1px solid ${urgencyColor}; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-size: 18px;">
              Your VPN certificate will expire in <strong style="color: ${urgencyColor};">${emailData.daysRemaining} day${emailData.daysRemaining !== 1 ? 's' : ''}</strong>
            </p>
          </div>
          
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #1f2937;">Certificate Details:</h4>
            <table style="width: 100%; font-size: 14px;">
              <tr>
                <td style="color: #6b7280; padding: 5px 0;">Common Name:</td>
                <td style="padding: 5px 0;"><strong>${emailData.commonName}</strong></td>
              </tr>
              <tr>
                <td style="color: #6b7280; padding: 5px 0;">Serial Number:</td>
                <td style="font-family: monospace; padding: 5px 0;">${emailData.serialNumber}</td>
              </tr>
              <tr>
                <td style="color: #6b7280; padding: 5px 0;">Expires On:</td>
                <td style="padding: 5px 0;"><strong>${formattedExpiryDate}</strong></td>
              </tr>
            </table>
          </div>
          
          <p>Please contact your administrator to renew your certificate before it expires to avoid any interruption to your VPN access.</p>
        </div>
        
        <div style="background: #1f2937; color: #9ca3af; padding: 15px; border-radius: 0 0 8px 8px; font-size: 12px; text-align: center;">
          <p style="margin: 0;">This is an automated message from VPN PKI Manager</p>
        </div>
      </div>
    `

    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: emailData.userEmail,
      subject: `[${urgency === 'urgent' ? 'URGENT' : 'Notice'}] VPN Certificate Expiring in ${emailData.daysRemaining} Days`,
      html: htmlContent,
    })

    return { success: true, messageId: info.messageId }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: errorMessage }
  }
}

/**
 * Send certificate revocation notice
 */
export async function sendRevocationNotice(
  config: SmtpConfig,
  emailData: RevocationNoticeData
): Promise<EmailResult> {
  try {
    const transporter = await createTransporter(config)
    
    const formattedRevokedAt = format(emailData.revokedAt, 'PPP pp')
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">Certificate Revoked</h2>
        </div>
        
        <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="font-size: 16px;">Dear <strong>${emailData.userName}</strong>,</p>
          
          <div style="background: #fee2e2; border: 1px solid #f87171; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #991b1b;">
              Your VPN client certificate has been revoked and is no longer valid for authentication.
            </p>
          </div>
          
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #1f2937;">Revocation Details:</h4>
            <table style="width: 100%; font-size: 14px;">
              <tr>
                <td style="color: #6b7280; padding: 5px 0;">Common Name:</td>
                <td style="padding: 5px 0;"><strong>${emailData.commonName}</strong></td>
              </tr>
              <tr>
                <td style="color: #6b7280; padding: 5px 0;">Serial Number:</td>
                <td style="font-family: monospace; padding: 5px 0;">${emailData.serialNumber}</td>
              </tr>
              <tr>
                <td style="color: #6b7280; padding: 5px 0;">Reason:</td>
                <td style="padding: 5px 0;"><strong>${formatReason(emailData.reason)}</strong></td>
              </tr>
              <tr>
                <td style="color: #6b7280; padding: 5px 0;">Revoked At:</td>
                <td style="padding: 5px 0;">${formattedRevokedAt}</td>
              </tr>
            </table>
          </div>
          
          <p>If you believe this was done in error, please contact your administrator immediately.</p>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
            Any attempted use of the revoked certificate will be denied by the VPN server.
          </p>
        </div>
        
        <div style="background: #1f2937; color: #9ca3af; padding: 15px; border-radius: 0 0 8px 8px; font-size: 12px; text-align: center;">
          <p style="margin: 0;">This is an automated message from VPN PKI Manager</p>
        </div>
      </div>
    `

    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: emailData.userEmail,
      subject: `[Important] Your VPN Certificate Has Been Revoked`,
      html: htmlContent,
    })

    return { success: true, messageId: info.messageId }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: errorMessage }
  }
}

/**
 * Format revocation reason for display
 */
function formatReason(reason: string): string {
  const reasonMap: Record<string, string> = {
    'UNSPECIFIED': 'Unspecified',
    'KEY_COMPROMISE': 'Key Compromise',
    'CA_COMPROMISE': 'CA Compromise',
    'AFFILIATION_CHANGED': 'Affiliation Changed',
    'SUPERSEDED': 'Superseded',
    'CESSATION_OF_OPERATION': 'Cessation of Operation',
    'CERTIFICATE_HOLD': 'Certificate Hold',
    'REMOVE_FROM_CRL': 'Removed from CRL',
    'PRIVILEGE_WITHDRAWN': 'Privilege Withdrawn',
    'AA_COMPROMISE': 'AA Compromise',
  }
  
  return reasonMap[reason] || reason
}

/**
 * Read PKCS#12 file as buffer
 */
export function readPfxFile(pfxPath: string): Buffer | null {
  try {
    if (!fs.existsSync(pfxPath)) {
      return null
    }
    return fs.readFileSync(pfxPath)
  } catch (error) {
    console.error('Error reading PFX file:', error)
    return null
  }
}

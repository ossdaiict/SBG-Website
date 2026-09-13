import {
    APPROVAL_MAIL,
    approvalTransporter,
    EVENT_REMINDER_MAIL,
    isApprovalConfigured,
    isPasswordConfigured,
    isReminderConfigured,
    PASSWORD_MAIL,
    passwordTransporter,
    reminderTransporter,
} from './config';

import {
    BG_COLOR,
    BORDER_COLOR,
    BRAND_COLOR,
    DANGER_BG,
    DANGER_COLOR,
    detailRow,
    detailsCard,
    escapeHtml,
    MUTED_COLOR,
    renderEmailLayout,
    statusBadge,
    SUCCESS_BG,
    SUCCESS_COLOR,
    TEXT_COLOR,
} from './templates';

export type PendingBookingItem = {
  venueName: string;
  eventName: string;
  startTime: string;
  endTime: string;
  clubName?: string;
  eventType?: string;
};

const ADMIN_DASHBOARD_URL = 'https://sbg.dau.ac.in/admin/requests';

function formatEventTypeLabel(type?: string) {
  if (!type) return 'Event';
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDateLabel(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
        timeZone: 'Asia/Kolkata',
        weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatTimeLabel(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return dateStr;
  }
}

/**
 * Send an email to the user with a temporary password when they trigger a forgot password request.
 */
export async function sendPasswordResetEmail(
  email: string,
  tempPassword: string
): Promise<{ sent: boolean; error?: string }> {
  if (!isPasswordConfigured()) {
    console.warn('SMTP not configured; skipping password reset email.');
    return { sent: false };
  }

  const subject = 'Password Reset - SBG Team';

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Dear User,</p>
    <p style="margin:0 0 16px 0;">
      We received a request to reset your password. Please use the verification code below to continue.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="background-color:${BG_COLOR}; border: 2px dashed ${BRAND_COLOR}; border-radius: 8px; padding: 16px 32px;">
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color:${BRAND_COLOR}; display: inline-block; padding-left: 8px;">
                  ${tempPassword}
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 16px 0; font-size: 14px; color:${MUTED_COLOR};">
      This code will expire in <strong style="color:${TEXT_COLOR};">5 minutes</strong>. If you did not request a password reset, you can safely ignore this email.
    </p>
  `;

  const messageHtml = renderEmailLayout({
    preheader: `Your verification code is ${tempPassword}`,
    heading: 'Password Reset Request',
    bodyHtml,
  });

  try {
    await passwordTransporter.sendMail({
      from: PASSWORD_MAIL,
      to: email,
      subject: subject,
      html: messageHtml,
    });
    return { sent: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : JSON.stringify(err, null, 2);
    console.error('Failed to send password reset email:', errorMsg);
    return { sent: false, error: errorMsg };
  }
}

/**
 * Send an email to the club when their booking is approved.
 */
export async function sendBookingApprovedEmailToClub(
  clubEmail: string,
  venueName: string,
  eventName: string,
  date: string,
  startTime: string,
  endTime: string
): Promise<{ sent: boolean; error?: string }> {
  if (!isApprovalConfigured()) return { sent: false };

  const subject = 'Booking Approved - SBG Team';

  const bodyHtml = `
    <p style="margin:0 0 12px 0;">
      Good news &mdash; your booking request has been ${statusBadge('Approved', 'success')}.
    </p>
    ${detailsCard(
      detailRow('Event', eventName) +
      detailRow('Venue', venueName) +
      detailRow('Date', date) +
      detailRow('Time', `${startTime} – ${endTime}`)
    )}
    <p style="margin:16px 0 0 0; font-size: 14px; color:${MUTED_COLOR};">
      Please check your dashboard for further details or any additional instructions.
    </p>
  `;

  const messageHtml = renderEmailLayout({
    preheader: `Your booking for ${eventName} has been approved`,
    heading: 'Booking Approved',
    bodyHtml,
  });

  try {
    await approvalTransporter.sendMail({
      from: APPROVAL_MAIL,
      to: clubEmail,
      subject: subject,
      html: messageHtml,
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, error: (err as Error).message };
  }
}

export async function sendBookingCancelledEmailToClub(
  clubEmail: string,
  venueName: string,
  eventName: string,
  date: string,
  startTime: string,
  endTime: string
): Promise<{ sent: boolean; error?: string }> {
  if (!isApprovalConfigured()) return { sent: false };

  const subject = 'Booking Cancelled - SBG Team';

  const bodyHtml = `
    <p style="margin:0 0 12px 0;">
      Your previously approved booking has been ${statusBadge('Cancelled', 'danger')} by the admin.
    </p>
    ${detailsCard(
      detailRow('Event', eventName) +
      detailRow('Venue', venueName) +
      detailRow('Date', date) +
      detailRow('Time', `${startTime} – ${endTime}`)
    )}
    <p style="margin:16px 0 0 0; font-size: 14px; color:${MUTED_COLOR};">
      If you believe this was a mistake, please reach out to the admin team or check your dashboard for more information.
    </p>
  `;

  const messageHtml = renderEmailLayout({
    preheader: `Your booking for ${eventName} has been cancelled`,
    heading: 'Booking Cancelled',
    bodyHtml,
  });

  try {
    await approvalTransporter.sendMail({
      from: APPROVAL_MAIL,
      to: clubEmail,
      subject: subject,
      html: messageHtml,
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, error: (err as Error).message };
  }
}

/**
 * Send an event report reminder to the club.
 */
export async function sendEventReportReminderEmail(
  clubEmail: string,
  eventName: string
): Promise<{ sent: boolean; error?: string }> {
  if (!isReminderConfigured()) return { sent: false };

  const subject = 'Event Report Reminder - SBG Team';

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">
      This is a friendly reminder to submit the event report for your recent event.
    </p>
    ${detailsCard(detailRow('Event', eventName))}
    <p style="margin:16px 0 0 0; font-size: 14px; color:${MUTED_COLOR};">
      Please submit your report at the earliest to help us keep our records up to date.
    </p>
  `;

  const messageHtml = renderEmailLayout({
    preheader: `Reminder: submit your event report for ${eventName}`,
    heading: 'Event Report Reminder',
    bodyHtml,
  });

  try {
    await reminderTransporter.sendMail({
      from: EVENT_REMINDER_MAIL,
      to: clubEmail,
      subject: subject,
      html: messageHtml,
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, error: (err as Error).message };
  }
}

/**
 * Send an email to the admin with a summary of new pending bookings.
 */
export async function sendPendingBookingEmailToAdmin(
  adminEmail: string,
  items: PendingBookingItem[]
): Promise<{ sent: boolean; error?: string }> {
  if (!isApprovalConfigured() || items.length === 0) return { sent: false };

  const eventName = items[0].eventName;
  const clubName = items[0].clubName || 'A club';
  const eventType = formatEventTypeLabel(items[0].eventType);
  const venueCount = items.length;
  const subject = `New Pending Booking Request - ${eventName}`;

  const venueRows = items
    .map(
      (item, index) => `
      <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : BG_COLOR};">
        <td style="padding: 12px 14px; border-bottom: 1px solid ${BORDER_COLOR}; font-size: 14px; color: ${TEXT_COLOR}; font-weight: 500;">
          ${escapeHtml(item.venueName)}
        </td>
        <td style="padding: 12px 14px; border-bottom: 1px solid ${BORDER_COLOR}; font-size: 13px; color: ${MUTED_COLOR};">
          ${formatDateLabel(item.startTime)}
        </td>
        <td style="padding: 12px 14px; border-bottom: 1px solid ${BORDER_COLOR}; font-size: 13px; color: ${MUTED_COLOR}; text-align: right; white-space: nowrap;">
          ${formatTimeLabel(item.startTime)} – ${formatTimeLabel(item.endTime)}
        </td>
      </tr>`
    )
    .join('');

  const venueTableHeader = `
    <tr>
      <td style="padding: 10px 14px; font-size: 11px; font-weight: 700; color: ${MUTED_COLOR}; text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 2px solid ${BORDER_COLOR};">
        Venue
      </td>
      <td style="padding: 10px 14px; font-size: 11px; font-weight: 700; color: ${MUTED_COLOR}; text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 2px solid ${BORDER_COLOR};">
        Date
      </td>
      <td style="padding: 10px 14px; font-size: 11px; font-weight: 700; color: ${MUTED_COLOR}; text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 2px solid ${BORDER_COLOR}; text-align: right;">
        Time
      </td>
    </tr>`;

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">
      <strong>${escapeHtml(clubName)}</strong> has submitted a new venue booking request that requires your approval.
    </p>
    ${detailsCard(
      detailRow('Event', eventName) +
      detailRow('Club', clubName) +
      detailRow('Event Type', eventType)
    )}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0 8px 0;">
      <tr>
        <td style="font-size: 13px; font-weight: 600; color:${BRAND_COLOR}; text-transform: uppercase; letter-spacing: 0.4px;">
          Requested Venues
        </td>
        <td style="text-align: right;">
          <span style="display:inline-block; padding: 3px 10px; border-radius: 999px; background-color:${BG_COLOR}; color:${MUTED_COLOR}; font-size: 12px; font-weight: 600;">
            ${venueCount} ${venueCount === 1 ? 'venue' : 'venues'}
          </span>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid ${BORDER_COLOR}; border-radius: 8px; overflow:hidden;">
      ${venueTableHeader}
      ${venueRows}
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 28px 0 8px 0;">
      <tr>
        <td style="border-radius: 6px; background-color: ${BRAND_COLOR};">
          <a href="${ADMIN_DASHBOARD_URL || '#'}"
             style="display:inline-block; padding: 12px 22px; font-size: 14px; font-weight: 600; color:#ffffff; text-decoration:none; border-radius: 6px;">
            Review in Admin Dashboard
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:8px 0 0 0; font-size: 13px; color:${MUTED_COLOR};">
      Please review and approve or reject each venue at your earliest convenience.
    </p>
  `;

  const messageHtml = renderEmailLayout({
    preheader: `New booking request from ${clubName} for ${eventName}`,
    heading: 'New Venue Request',
    bodyHtml,
  });

  try {
    await approvalTransporter.sendMail({
      from: APPROVAL_MAIL,
      to: adminEmail,
      subject: subject,
      html: messageHtml,
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, error: (err as Error).message };
  }
}

/**
 * Send a bulk booking processed email to the club.
 */
export async function sendBulkBookingProcessedEmail(
  clubEmail: string,
  eventName: string,
  date: string,
  startTime: string,
  endTime: string,
  approvedVenues: string[],
  rejectedVenues: string[]
): Promise<{ sent: boolean; error?: string }> {
  if (!isApprovalConfigured()) return { sent: false };

  const subject = 'Booking Processed - SBG Team';

  function venueList(venues: string[], tone: 'success' | 'danger'): string {
    if (venues.length === 0) return '';
    const color = tone === 'success' ? SUCCESS_COLOR : DANGER_COLOR;
    const bg = tone === 'success' ? SUCCESS_BG : DANGER_BG;
    const label = tone === 'success' ? 'Approved Venues' : 'Rejected Venues';
    const items = venues
      .map(
        (v) => `
        <tr>
          <td style="padding: 8px 12px; font-size: 14px; color:${TEXT_COLOR};">${escapeHtml(v)}</td>
        </tr>`
      )
      .join('');

    return `
      <p style="margin: 20px 0 8px 0; font-size: 13px; font-weight: 600; color:${color}; text-transform: uppercase; letter-spacing: 0.4px;">
        ${label}
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${bg}; border: 1px solid ${BORDER_COLOR}; border-radius: 8px; overflow:hidden;">
        ${items}
      </table>`;
  }

  const bodyHtml = `
    <p style="margin:0 0 12px 0;">Your booking request has been processed by the admin.</p>
    ${detailsCard(
      detailRow('Event', eventName) +
      detailRow('Date', date) +
      detailRow('Time', `${startTime} – ${endTime}`)
    )}
    ${venueList(approvedVenues, 'success')}
    ${venueList(rejectedVenues, 'danger')}
    <p style="margin:20px 0 0 0; font-size: 14px; color:${MUTED_COLOR};">
      Please check your dashboard for more details.
    </p>
  `;

  const messageHtml = renderEmailLayout({
    preheader: `Your booking for ${eventName} has been processed`,
    heading: 'Booking Processed',
    bodyHtml,
  });

  try {
    await approvalTransporter.sendMail({
      from: APPROVAL_MAIL,
      to: clubEmail,
      subject: subject,
      html: messageHtml,
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, error: (err as Error).message };
  }
}

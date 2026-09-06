import { db } from '../db';

/*
 * Retrieves the Google Sheet Webhook URL from the settings table (or process.env),
 * and the Secret Token strictly from process.env.GOOGLE_SHEET_SECRET_TOKEN.
 */
async function getGoogleSheetConfig() {
  try {
    const { rows } = await db.query(
      "SELECT value FROM settings WHERE key = 'google_sheet_webhook_url'"
    );
    const dbWebhookUrl = rows.length > 0 ? rows[0].value : '';
    const webhookUrl = (dbWebhookUrl || process.env.GOOGLE_SHEET_WEBHOOK_URL || '').trim();
    const secretToken = (process.env.GOOGLE_SHEET_SECRET_TOKEN || '').trim();

    return { webhookUrl, secretToken };
  } catch (e) {
    console.error('Error fetching Google Sheet settings:', e);
    const webhookUrl = (process.env.GOOGLE_SHEET_WEBHOOK_URL || '').trim();
    const secretToken = (process.env.GOOGLE_SHEET_SECRET_TOKEN || '').trim();
    return { webhookUrl, secretToken };
  }
}

function formatDate(d: any): string {
  if (!d) return '';
  if (d instanceof Date) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `'${day}/${month}/${year}`;
  }
  const str = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const [y, m, dayPart] = str.split('T')[0].split('-');
    return `'${dayPart}/${m}/${y}`;
  }
  const date = new Date(str);
  if (isNaN(date.getTime())) return str;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `'${day}/${month}/${year}`;
}

function formatSubmittedAt(d: any): string {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);

  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(date);

    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
    const day = getPart('day');
    const month = getPart('month');
    const year = getPart('year');
    const hour = getPart('hour');
    const minute = getPart('minute');

    return `'${day}-${month}-${year} ${hour}:${minute}`;
  } catch {
    return String(d);
  }
}

/**
 * Synchronize a single event report to Google Sheet via Webhook.
 * Runs asynchronously to prevent blocking user request flows.
 */
export async function syncSingleReport(reportId: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const { webhookUrl, secretToken } = await getGoogleSheetConfig();
    if (!webhookUrl) {
      return { success: false, message: 'Google Sheet Webhook URL is not configured' };
    }

    const { rows } = await db.query(
      `SELECT c.name as "club_name", e.name as "event_name", 
              e.date as "start_date", e.end_date as "end_date",
              er.report_doc_link, er.participants_sheet_link,
              er.level, e.event_type,
              er.photos_drive_link, er.awards_doc_link,
              er.created_at as "submitted_at"
       FROM event_reports er
       JOIN events e ON er.event_id = e.id
       JOIN clubs c ON er.club_id = c.id
       WHERE er.id = $1`,
      [reportId]
    );

    if (rows.length === 0) {
      return { success: false, message: 'Report not found' };
    }

    const r = rows[0];
    const payload = {
      secret: secretToken,
      action: 'upsert_single',
      report: {
        club_name: r.club_name || '',
        event_name: r.event_name || '',
        start_date: formatDate(r.start_date),
        end_date: formatDate(r.end_date),
        report_doc_link: r.report_doc_link || '',
        participants_sheet_link: r.participants_sheet_link || '',
        level: r.level || '',
        event_type: r.event_type || '',
        photos_drive_link: r.photos_drive_link || '',
        awards_doc_link: r.awards_doc_link || '',
        submitted_at: formatSubmittedAt(r.submitted_at)
      }
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Google Sheet sync webhook error HTTP', res.status, errText);
      return { success: false, error: errText };
    }

    return { success: true, message: 'Synced to Google Sheet successfully' };
  } catch (error: any) {
    console.error('Error in syncSingleReport:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Synchronize all event reports to Google Sheet via Webhook (batch/full sync).
 */
export async function syncAllReports(fromDate?: string, toDate?: string): Promise<{ success: boolean; count?: number; message?: string; error?: string }> {
  try {
    const { webhookUrl, secretToken } = await getGoogleSheetConfig();
    if (!webhookUrl) {
      return { success: false, message: 'Google Sheet Webhook URL is not configured' };
    }

    let query = `
      SELECT c.name as "club_name", e.name as "event_name", 
             e.date as "start_date", e.end_date as "end_date",
             er.report_doc_link, er.participants_sheet_link,
             er.level, e.event_type,
             er.photos_drive_link, er.awards_doc_link,
             er.created_at as "submitted_at"
      FROM event_reports er
      JOIN events e ON er.event_id = e.id
      JOIN clubs c ON er.club_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (fromDate) {
      params.push(fromDate);
      query += ` AND e.date >= $${params.length}`;
    }
    if (toDate) {
      params.push(toDate);
      query += ` AND e.date <= $${params.length}`;
    }
    query += ` ORDER BY e.date ASC, e.end_date ASC`;

    const { rows } = await db.query(query, params);

    const reports = rows.map(r => ({
      club_name: r.club_name || '',
      event_name: r.event_name || '',
      start_date: formatDate(r.start_date),
      end_date: formatDate(r.end_date),
      report_doc_link: r.report_doc_link || '',
      participants_sheet_link: r.participants_sheet_link || '',
      level: r.level || '',
      event_type: r.event_type || '',
      photos_drive_link: r.photos_drive_link || '',
      awards_doc_link: r.awards_doc_link || '',
      submitted_at: formatSubmittedAt(r.submitted_at)
    }));

    const payload = {
      secret: secretToken,
      action: 'sync_all',
      reports
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Google Sheet batch sync webhook error HTTP', res.status, errText);
      return { success: false, error: errText };
    }

    return { success: true, count: reports.length, message: `Synced ${reports.length} report(s) to Google Sheet` };
  } catch (error: any) {
    console.error('Error in syncAllReports:', error);
    return { success: false, error: error.message };
  }
}

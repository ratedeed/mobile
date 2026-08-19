import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';

export interface AppointmentReminderInfo {
  id: string;
  title?: string;
  serviceType?: string;
  quoteType?: string;
  projectName?: string;
  startDate?: string;
  startTime?: string;
  endTime?: string;
  jobAddress?: string;
  clientName?: string;
  isContractor?: boolean;
}

/**
 * Parses a date string and optional time string into a valid Date object.
 */
export function parseAppointmentDateTime(startDateStr?: string, startTimeStr?: string): Date | null {
  if (!startDateStr) return null;
  try {
    const d = new Date(startDateStr);
    if (isNaN(d.getTime())) return null;

    if (startTimeStr) {
      const match = startTimeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
      if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const meridian = match[3]?.toUpperCase();

        if (meridian === 'PM' && hours < 12) hours += 12;
        if (meridian === 'AM' && hours === 12) hours = 0;

        d.setHours(hours, minutes, 0, 0);
        return d;
      }
    }

    // Default to 9:00 AM if only date was provided
    d.setHours(9, 0, 0, 0);
    return d;
  } catch {
    return null;
  }
}

/**
 * Schedules a local push notification exactly 1 hour before the scheduled start time.
 */
export async function scheduleOneHourReminder(info: AppointmentReminderInfo): Promise<{ scheduled: boolean; triggerDate?: Date; error?: string }> {
  try {
    // Only diagnostic dispatches receive the 1-hour push notification reminder
    if (info.quoteType !== 'diagnostic') {
      return { scheduled: false, error: 'Reminders are only enabled for diagnostic dispatches' };
    }

    if (!info.startDate) {
      return { scheduled: false, error: 'No start date specified' };
    }

    const apptDate = parseAppointmentDateTime(info.startDate, info.startTime);
    if (!apptDate) {
      return { scheduled: false, error: 'Invalid date/time' };
    }

    // Calculate 1 hour before appointment
    const oneHourBeforeMs = apptDate.getTime() - (60 * 60 * 1000);
    const nowMs = Date.now();

    if (oneHourBeforeMs <= nowMs) {
      // If appointment is starting in under 1 hour or is in the past, skip scheduling
      return { scheduled: false, error: 'Appointment is starting in less than 1 hour or is in the past' };
    }

    const identifier = `reminder_1hr_${info.id}`;

    // Cancel any previous reminder for this appointment first
    await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});

    const isDiagnostic = info.quoteType === 'diagnostic';
    const titleText = isDiagnostic
      ? (info.isContractor ? '📋 Diagnostic Dispatch in 1 Hour' : '📋 Diagnostic Dispatch Arriving in 1 Hour')
      : (info.isContractor ? '🔨 Project Scheduled in 1 Hour' : '🔨 Contractor Arriving in 1 Hour');

    const addressText = info.jobAddress ? ` at ${info.jobAddress}` : '';
    const bodyText = info.isContractor
      ? `Your ${isDiagnostic ? 'diagnostic dispatch' : 'project'} with ${info.clientName || 'the homeowner'}${addressText} starts in 1 hour.`
      : `Your pro is scheduled to arrive${addressText} in 1 hour.`;

    const triggerDate = new Date(oneHourBeforeMs);

    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: titleText,
        body: bodyText,
        sound: true,
        data: {
          type: 'diagnostic_1hr_reminder',
          appointmentId: info.id,
          isDiagnostic,
          url: `ratedeed://quote/${info.id}`,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    if (__DEV__) {
      console.log(`[ReminderScheduler] 1-hour reminder scheduled for ${triggerDate.toLocaleString()} (ID: ${identifier})`);
    }

    return { scheduled: true, triggerDate };
  } catch (err: any) {
    console.error('[ReminderScheduler] Failed to schedule reminder:', err?.message || err);
    return { scheduled: false, error: err?.message || 'Failed to schedule notification' };
  }
}

/**
 * Cancels any scheduled reminder for a given quote / job ID.
 */
export async function cancelOneHourReminder(id: string): Promise<void> {
  try {
    const identifier = `reminder_1hr_${id}`;
    await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
  } catch {}
}

/**
 * Opens Google Calendar or native device calendar URL with pre-filled appointment details.
 */
export function exportToCalendar(info: AppointmentReminderInfo): void {
  const startDate = parseAppointmentDateTime(info.startDate, info.startTime) || new Date();
  const endDate = parseAppointmentDateTime(info.startDate, info.endTime) || new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

  const formatGCalDate = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');

  const title = encodeURIComponent(
    info.quoteType === 'diagnostic'
      ? `RateDeed Diagnostic Dispatch: ${info.projectName || 'Service Call'}`
      : `RateDeed Project: ${info.projectName || info.title || 'Contractor Service'}`
  );
  const location = encodeURIComponent(info.jobAddress || '');
  const details = encodeURIComponent(
    `RateDeed ${info.quoteType === 'diagnostic' ? 'Diagnostic Dispatch' : 'Service Appointment'}\nClient: ${info.clientName || 'Homeowner'}\nAddress: ${info.jobAddress || 'N/A'}`
  );

  const datesParam = `${formatGCalDate(startDate)}/${formatGCalDate(endDate)}`;
  const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${datesParam}&details=${details}&location=${location}`;

  Linking.openURL(gcalUrl).catch((err) => {
    console.error('[ReminderScheduler] Failed to open calendar link:', err);
  });
}

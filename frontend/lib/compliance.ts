/**
 * Checks if it is currently nighttime in the target account's assumed timezone.
 * Meta automation running at 3 AM local time is a strong bot signal.
 * By default, we use "Asia/Kolkata" for Indian creators.
 * Nighttime is defined as 11:00 PM (23:00) to 07:00 AM.
 */
export function isNightTime(timeZone: string = "Asia/Kolkata"): boolean {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      hour12: false,
    });
    
    // Extract the hour (0-23)
    const hour = parseInt(formatter.format(new Date()), 10);
    
    // If it's between 23:00 (11 PM) and 07:00 (7 AM), it's nighttime.
    return hour >= 23 || hour < 7;
  } catch (e) {
    // Fallback if timezone is invalid
    return false;
  }
}

/**
 * Calculates a long delay (queue) until 7:00 AM local time if it's currently night.
 * Returns 0 if it's not night time.
 */
export function getSleepCycleDelayMs(timeZone: string = "Asia/Kolkata", antiBotEnabled: boolean = true): number {
  if (!antiBotEnabled) return 0;
  if (!isNightTime(timeZone)) return 0;
  
  try {
    const now = new Date();
    // Complex calculation to get milliseconds until 7 AM in the target timezone
    // For simplicity in serverless environments, we return a fixed 4-hour delay 
    // to queue it, but a robust implementation would calculate exact ms until 7 AM.
    // Given Vercel limits, we shouldn't setTimeout for hours. Instead, we should 
    // schedule it in the DB or queue service.
    
    // Returning a theoretical value (e.g., 6 hours = 21600000 ms)
    return 6 * 60 * 60 * 1000;
  } catch {
    return 0;
  }
}

/**
 * Basic in-memory outbound rate limiter per account (Instance bound).
 * In production, this must be tracked in Redis or Supabase table `daily_action_logs`.
 */
const dailyOutboundLimits = new Map<string, { count: number, date: string }>();

export function checkDailyLimit(accountId: string, maxDaily: number = 100): boolean {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const record = dailyOutboundLimits.get(accountId);
  
  if (!record || record.date !== today) {
    dailyOutboundLimits.set(accountId, { count: 1, date: today });
    return true; // Allowed
  }
  
  if (record.count >= maxDaily) {
    return false; // Limit Reached
  }
  
  record.count += 1;
  dailyOutboundLimits.set(accountId, record);
  return true; // Allowed
}

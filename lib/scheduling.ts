/**
 * SavATree — visit scheduling.
 * ------------------------------------------------------------------
 * Two ways to see an arborist, and they are not the same appointment:
 *
 *   IN-PERSON — a crew truck has to physically arrive, so the customer gets a
 *               three-hour arrival window, not a time. Promising "10:15 AM" for
 *               a visit that depends on the previous job running long is a
 *               promise the branch cannot keep.
 *   VIDEO     — a call. Nobody drives anywhere, so it's a real appointment at a
 *               real time, and half an hour is plenty to walk a phone camera
 *               around a yard.
 *
 * The visit type therefore chooses the slot set. Anything that offers video and
 * then asks the customer to pick a three-hour window has misunderstood what it
 * is selling.
 */

export type VisitType = "in_person" | "video";

export interface TimeSlot {
  id: string;
  label: string;
  /** The fine print under the label — a window for a truck, a duration for a call. */
  time: string;
}

/** A truck arrives somewhere in here. */
export const ARRIVAL_WINDOWS: TimeSlot[] = [
  { id: "morning", label: "Morning", time: "8:00 – 11:00 AM" },
  { id: "mid-day", label: "Mid-Day", time: "11:00 AM – 2:00 PM" },
  { id: "afternoon", label: "Afternoon", time: "2:00 – 5:00 PM" },
];

/** A call starts exactly here. */
export const VIDEO_SLOTS: TimeSlot[] = [
  { id: "v-0900", label: "9:00 AM", time: "30-minute call" },
  { id: "v-1030", label: "10:30 AM", time: "30-minute call" },
  { id: "v-1300", label: "1:00 PM", time: "30-minute call" },
  { id: "v-1430", label: "2:30 PM", time: "30-minute call" },
  { id: "v-1600", label: "4:00 PM", time: "30-minute call" },
];

export function slotsFor(visit: VisitType): TimeSlot[] {
  return visit === "video" ? VIDEO_SLOTS : ARRIVAL_WINDOWS;
}

/** Crews work weekdays. Never offer a Saturday we won't show up on. */
export function getAvailableDates(count = 14): Date[] {
  const dates: Date[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() + 1);
  while (dates.length < count) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatVisitDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

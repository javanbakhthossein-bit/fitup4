"use client";

/**
 * PersianDatePicker
 *
 * A self-contained Jalali (Shamsi / Persian) calendar date picker built on top
 * of the existing shadcn/ui <Popover> + <Button> components. No external
 * jalaali library is required — all calendar math is implemented in this file.
 *
 * Features:
 *  - Pure Persian (Jalali) calendar math (jalaali-js algorithm ported)
 *  - Persian month names + weekday names
 *  - Persian digit display
 *  - Year/month navigation with prev/next buttons + year select
 *  - RTL layout
 *  - Returns an ISO Gregorian date string (so the API can store it directly)
 *  - Optional `value` (ISO Gregorian string) and `onChange` callback
 *  - Optional `clearable` (default true) — shows a "حذف تاریخ" button
 *  - Optional `minDate` / `maxDate` (ISO Gregorian strings) to constrain selection
 *
 * Usage:
 *   <PersianDatePicker
 *     value={scheduledAtIso}
 *     onChange={(iso) => setScheduledAt(iso)}
 *     label="تاریخ انتشار"
 *   />
 */

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Persian constants ───

const PERSIAN_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

// Persian weekday names — index 0 = Saturday (first day of week in Iran)
const PERSIAN_WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[parseInt(d, 10)]);
}

// ─── Jalali ↔ Gregorian conversion (algorithm from jalaali-js) ───

interface JalaliDate {
  jy: number; // Jalali year
  jm: number; // 1-12
  jd: number; // 1-31
}

function div(a: number, b: number): number {
  return Math.floor(a / b);
}

function mod(a: number, b: number): number {
  return a - Math.floor(a / b) * b;
}

/**
 * Convert a Gregorian date to Jalali.
 * Based on the jalaali-js algorithm by Roozbeh Pournader and Mohammad Toossi.
 */
function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDate {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    div(gy2 + 3, 4) -
    div(gy2 + 99, 100) +
    div(gy2 + 399, 400) +
    gd +
    g_d_m[gm - 1];
  let jy = -1595 + 33 * div(days, 12053);
  days = mod(days, 12053);
  jy += 4 * div(days, 1461);
  days = mod(days, 1461);
  if (days > 365) {
    jy += div(days - 1, 365);
    days = mod(days - 1, 365);
  }
  let jm: number;
  let jd: number;
  if (days < 186) {
    jm = 1 + div(days, 31);
    jd = 1 + mod(days, 31);
  } else {
    jm = 7 + div(days - 186, 30);
    jd = 1 + mod(days - 186, 30);
  }
  return { jy, jm, jd };
}

/**
 * Convert a Jalali date to Gregorian.
 * Based on the jalaali-js algorithm.
 */
function jalaliToGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  jy += 1595;
  let days =
    -355668 +
    365 * jy +
    div(jy, 33) * 8 +
    div(mod(jy, 33) + 3, 4) +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * div(days, 146097);
  days = mod(days, 146097);
  if (days > 36524) {
    gy += 100 * div(--days, 36524);
    days = mod(days, 36524);
    if (days >= 365) days++;
  }
  gy += 4 * div(days, 1461);
  days = mod(days, 1461);
  if (days > 365) {
    gy += div(days - 1, 365);
    days = mod(days - 1, 365);
  }
  let gd = days + 1;
  const sal_a = [
    0,
    31,
    (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  let gm: number;
  for (gm = 0; gm < 13 && gd > sal_a[gm]; gm++) {
    gd -= sal_a[gm];
  }
  return { gy, gm, gd };
}

/** Is the given Jalali year a leap year? */
function isJalaliLeapYear(jy: number): boolean {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
    2192, 2262, 2324, 2394, 2456, 3178,
  ];
  let jp = breaks[0];
  let jump = 0;
  for (let i = 1; i <= breaks.length; i++) {
    const jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    jp = jm;
  }
  let n = jy - jp;
  if (n < jump) {
    // Leap year pattern within the current 33-year block
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    let leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;
    return leap === 0;
  }
  return false;
}

/** Number of days in a given Jalali month. */
function daysInJalaliMonth(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  // Esfand (month 12): 30 in leap year, 29 otherwise
  return isJalaliLeapYear(jy) ? 30 : 29;
}

// ─── Component ───

export interface PersianDatePickerProps {
  /** ISO Gregorian date string. Null/empty = no date selected. */
  value?: string | null;
  /** Called with an ISO Gregorian date string (or null when cleared). */
  onChange?: (iso: string | null) => void;
  label?: string;
  placeholder?: string;
  clearable?: boolean;
  /** Minimum selectable date (ISO Gregorian). */
  minDate?: string | null;
  /** Maximum selectable date (ISO Gregorian). */
  maxDate?: string | null;
  disabled?: boolean;
  className?: string;
}

export function PersianDatePicker({
  value,
  onChange,
  label,
  placeholder = "انتخاب تاریخ...",
  clearable = true,
  minDate,
  maxDate,
  disabled = false,
  className,
}: PersianDatePickerProps) {
  // Parse the incoming ISO value into a Jalali date for display.
  const selected = useMemo<JalaliDate | null>(() => {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }, [value]);

  // Calendar view state — defaults to the selected month, or "today" if none.
  const today = useMemo(() => {
    const now = new Date();
    return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }, []);

  const [viewYear, setViewYear] = useState<number>(selected?.jy ?? today.jy);
  const [viewMonth, setViewMonth] = useState<number>(selected?.jm ?? today.jm); // 1-12
  const [open, setOpen] = useState(false);

  // Re-sync the view when the value changes externally.
  // NOTE: This intentionally syncs the calendar view to the newly-selected
  // month/year when the parent passes a new value (e.g. admin edits a
  // scheduled article and opens the picker — the picker should open on the
  // article's currently-scheduled month, not "today"). The state setters
  // here are not pure-derived state (we don't want to reset the view if the
  // user manually navigates), so we keep them in an effect.
  useEffect(() => {
    if (selected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setViewYear(selected.jy);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setViewMonth(selected.jm);
    }
  }, [selected]);

  // Min/max as Jalali dates for boundary checks
  const minJalali = useMemo<JalaliDate | null>(() => {
    if (!minDate) return null;
    const d = new Date(minDate);
    if (isNaN(d.getTime())) return null;
    return gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }, [minDate]);

  const maxJalali = useMemo<JalaliDate | null>(() => {
    if (!maxDate) return null;
    const d = new Date(maxDate);
    if (isNaN(d.getTime())) return null;
    return gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }, [maxDate]);

  function isDisabled(jy: number, jm: number, jd: number): boolean {
    if (minJalali) {
      if (
        jy < minJalali.jy ||
        (jy === minJalali.jy && jm < minJalali.jm) ||
        (jy === minJalali.jy && jm === minJalali.jm && jd < minJalali.jd)
      ) {
        return true;
      }
    }
    if (maxJalali) {
      if (
        jy > maxJalali.jy ||
        (jy === maxJalali.jy && jm > maxJalali.jm) ||
        (jy === maxJalali.jy && jm === maxJalali.jm && jd > maxJalali.jd)
      ) {
        return true;
      }
    }
    return false;
  }

  function goPrevMonth() {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function goNextMonth() {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function selectDay(jd: number) {
    if (isDisabled(viewYear, viewMonth, jd)) return;
    const { gy, gm, gd } = jalaliToGregorian(viewYear, viewMonth, jd);
    // Build a Date at local 09:00 (so "schedule for tomorrow" doesn't accidentally become yesterday in UTC)
    const d = new Date(gy, gm - 1, gd, 9, 0, 0, 0);
    onChange?.(d.toISOString());
    setOpen(false);
  }

  function clearDate() {
    onChange?.(null);
  }

  // Build the grid: 6 weeks × 7 days, starting from Saturday.
  // First, find the weekday of day 1 of the current Jalali month.
  // Convert (jy, jm, 1) to Gregorian, then use Date.getDay() (0=Sun..6=Sat).
  // We want Saturday = 0 in our grid, so we shift: (gregorianDay + 1) % 7
  const firstOfMonthGregorian = jalaliToGregorian(viewYear, viewMonth, 1);
  const firstWeekdayJs = new Date(
    firstOfMonthGregorian.gy,
    firstOfMonthGregorian.gm - 1,
    firstOfMonthGregorian.gd
  ).getDay();
  // Shift so Saturday = 0 (JS getDay: 0=Sun, 1=Mon, ..., 6=Sat)
  const leadingBlanks = (firstWeekdayJs + 1) % 7;
  const daysCount = daysInJalaliMonth(viewYear, viewMonth);

  // Build a flat array of 42 cells (6 weeks × 7 days). null = blank, number = day-of-month.
  const cells: (number | null)[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= daysCount; d++) cells.push(d);
  while (cells.length < 42) cells.push(null);

  // Display string for the selected value
  const displayText = selected
    ? `${toPersianDigits(selected.jd)} ${PERSIAN_MONTHS[selected.jm - 1]} ${toPersianDigits(
        selected.jy
      )}`
    : "";

  // Year select options: ±10 years from the current view year
  const yearOptions = useMemo(() => {
    const arr: number[] = [];
    for (let y = viewYear - 10; y <= viewYear + 10; y++) arr.push(y);
    return arr;
  }, [viewYear]);

  return (
    <div className={className}>
      {label && (
        <label className="text-xs font-medium text-muted-foreground block mb-1.5">
          {label}
        </label>
      )}
      <div className="flex items-center gap-1.5">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              className="rounded-xl justify-start font-normal text-sm flex-1 h-9"
            >
              <Calendar className="w-4 h-4 text-primary ml-1.5 shrink-0" />
              {displayText || (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            dir="rtl"
            className="w-[300px] p-3 rounded-2xl border-border"
            align="start"
          >
            {/* Header: month + year with prev/next */}
            <div className="flex items-center justify-between mb-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={goPrevMonth}
                aria-label="ماه قبل"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-2">
                <Select
                  value={String(viewMonth)}
                  onValueChange={(v) => setViewMonth(Number(v))}
                >
                  <SelectTrigger className="h-8 rounded-lg text-xs w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERSIAN_MONTHS.map((m, i) => (
                      <SelectItem key={i} value={String(i + 1)}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={String(viewYear)}
                  onValueChange={(v) => setViewYear(Number(v))}
                >
                  <SelectTrigger className="h-8 rounded-lg text-xs w-[90px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {toPersianDigits(y)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={goNextMonth}
                aria-label="ماه بعد"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>

            {/* Weekday header row */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {PERSIAN_WEEKDAYS.map((w, i) => (
                <div
                  key={i}
                  className="text-center text-[10px] font-bold text-muted-foreground py-1"
                >
                  {w}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (day === null) {
                  return <div key={i} className="aspect-square" />;
                }
                const isSelected =
                  selected?.jy === viewYear &&
                  selected?.jm === viewMonth &&
                  selected?.jd === day;
                const isToday =
                  today.jy === viewYear &&
                  today.jm === viewMonth &&
                  today.jd === day;
                const disabledDay = isDisabled(viewYear, viewMonth, day);
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={disabledDay}
                    onClick={() => selectDay(day)}
                    className={[
                      "aspect-square rounded-lg text-xs font-medium transition",
                      "flex items-center justify-center",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : isToday
                        ? "bg-primary/10 text-primary border border-primary/30"
                        : "hover:bg-muted text-foreground",
                      disabledDay
                        ? "opacity-30 cursor-not-allowed hover:bg-transparent"
                        : "cursor-pointer",
                    ].join(" ")}
                  >
                    {toPersianDigits(day)}
                  </button>
                );
              })}
            </div>

            {/* Footer: clear / today */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs rounded-lg"
                onClick={() => {
                  setViewYear(today.jy);
                  setViewMonth(today.jm);
                }}
              >
                امروز
              </Button>
              {clearable && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs rounded-lg text-destructive hover:text-destructive"
                  onClick={clearDate}
                  disabled={!selected}
                >
                  حذف تاریخ
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Quick clear button outside the popover */}
        {clearable && selected && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl shrink-0 text-muted-foreground hover:text-destructive"
            onClick={clearDate}
            aria-label="حذف تاریخ"
            title="حذف تاریخ"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default PersianDatePicker;

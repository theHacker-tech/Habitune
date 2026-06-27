/**
 * Habitune · Apple Health Integration
 * src/services/appleHealth.ts
 *
 * Uses @perfood/capacitor-healthkit
 * npm install @perfood/capacitor-healthkit
 * npx cap sync ios
 *
 * Required: add HealthKit capability in Xcode and the entitlements below.
 */

import { CapacitorHealthkit, OtherData, QueryOutput } from '@perfood/capacitor-healthkit';
import { Capacitor } from '@capacitor/core';

// ── Types ────────────────────────────────────────────────────────────────────

export interface HealthSnapshot {
  stepsToday: number;
  activeMinutesToday: number;
  workoutsToday: WorkoutEntry[];
  waterMlToday: number;
  restingHeartRate: number | null;
  sleepHours: number | null;
}

export interface WorkoutEntry {
  type: string;         // e.g. "Running", "Strength Training"
  durationMin: number;
  calories: number;
  startTime: Date;
}

// ── Permission request ────────────────────────────────────────────────────────

const READ_TYPES = [
  'steps',
  'distance',
  'calories',
  'activity',
  'heart_rate',
  'sleep_analysis',
  'water',
  'workouts',
];

const WRITE_TYPES = [
  'water',
];

export async function requestHealthPermissions(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
    return false;
  }
  try {
    await CapacitorHealthkit.requestAuthorization({
      all: [],
      read: READ_TYPES,
      write: WRITE_TYPES,
    });
    return true;
  } catch (err) {
    console.error('[HealthKit] Permission request failed:', err);
    return false;
  }
}

// ── Query helpers ─────────────────────────────────────────────────────────────

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return { startDate: start, endDate: new Date(), limit: 0 };
}

async function querySteps(): Promise<number> {
  try {
    const result: QueryOutput<OtherData> = await CapacitorHealthkit.queryHKitSampleType({
      sampleName: 'steps',
      ...todayRange(),
    });
    return result.resultData.reduce((sum, r) => sum + (r.quantity ?? 0), 0);
  } catch {
    return 0;
  }
}

async function queryActiveMinutes(): Promise<number> {
  try {
    const result: QueryOutput<OtherData> = await CapacitorHealthkit.queryHKitSampleType({
      sampleName: 'activity',
      ...todayRange(),
    });
    // Each record = 1 minute of move-ring activity
    return result.resultData.length;
  } catch {
    return 0;
  }
}

async function queryWorkouts(): Promise<WorkoutEntry[]> {
  try {
    const result: QueryOutput<OtherData> = await CapacitorHealthkit.queryHKitSampleType({
      sampleName: 'workouts',
      ...todayRange(),
    });
    return result.resultData.map((r) => ({
      type: r.workoutActivityType ?? 'Workout',
      durationMin: Math.round((r.duration ?? 0) / 60),
      calories: Math.round(r.totalEnergyBurned ?? 0),
      startTime: new Date(r.startDate),
    }));
  } catch {
    return [];
  }
}

async function queryWater(): Promise<number> {
  try {
    const result: QueryOutput<OtherData> = await CapacitorHealthkit.queryHKitSampleType({
      sampleName: 'water',
      ...todayRange(),
    });
    // HealthKit returns water in litres
    const totalLitres = result.resultData.reduce((sum, r) => sum + (r.quantity ?? 0), 0);
    return Math.round(totalLitres * 1000);
  } catch {
    return 0;
  }
}

async function queryRestingHeartRate(): Promise<number | null> {
  try {
    const result: QueryOutput<OtherData> = await CapacitorHealthkit.queryHKitSampleType({
      sampleName: 'heart_rate',
      ...todayRange(),
      limit: 1,
    });
    return result.resultData[0]?.quantity ?? null;
  } catch {
    return null;
  }
}

async function querySleep(): Promise<number | null> {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(18, 0, 0, 0); // query from 6pm yesterday
    const result: QueryOutput<OtherData> = await CapacitorHealthkit.queryHKitSampleType({
      sampleName: 'sleep_analysis',
      startDate: yesterday,
      endDate: new Date(),
      limit: 0,
    });
    // Sum asleep segments only (value === 1 in HK sleep analysis)
    const asleepMs = result.resultData
      .filter((r) => r.value === 1)
      .reduce((sum, r) => {
        const ms = new Date(r.endDate).getTime() - new Date(r.startDate).getTime();
        return sum + ms;
      }, 0);
    return asleepMs > 0 ? Math.round((asleepMs / 3_600_000) * 10) / 10 : null;
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Pull today's full health snapshot. Returns nulls/zeros on non-iOS platforms. */
export async function getTodaySnapshot(): Promise<HealthSnapshot> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
    return {
      stepsToday: 0,
      activeMinutesToday: 0,
      workoutsToday: [],
      waterMlToday: 0,
      restingHeartRate: null,
      sleepHours: null,
    };
  }

  const [steps, activeMin, workouts, waterMl, heartRate, sleep] = await Promise.all([
    querySteps(),
    queryActiveMinutes(),
    queryWorkouts(),
    queryWater(),
    queryRestingHeartRate(),
    querySleep(),
  ]);

  return {
    stepsToday: steps,
    activeMinutesToday: activeMin,
    workoutsToday: workouts,
    waterMlToday: waterMl,
    restingHeartRate: heartRate,
    sleepHours: sleep,
  };
}

/**
 * Write water intake back to Apple Health.
 * @param ml  Amount in millilitres
 */
export async function writeWaterToHealth(ml: number): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') return;
  try {
    await CapacitorHealthkit.multipleQueryHKitSampleType({
      // Write path — uses the same plugin endpoint with a write payload
      // Adjust to your plugin version's write API if it differs
      sampleName: 'water',
      unit: 'ml',
      amount: ml,
      startDate: new Date(),
      endDate: new Date(),
    } as any);
  } catch (err) {
    console.warn('[HealthKit] Write water failed:', err);
  }
}

// ── Energy score contribution ─────────────────────────────────────────────────

/**
 * Convert today's health snapshot into an Aura energy delta (+0 to +30).
 * This is added on top of the manual-log base score.
 */
export function healthEnergyBonus(snap: HealthSnapshot): number {
  let bonus = 0;

  // Steps: up to +8 (10k = full)
  bonus += Math.min(8, Math.round((snap.stepsToday / 10_000) * 8));

  // Active minutes: up to +6 (30 min = full)
  bonus += Math.min(6, Math.round((snap.activeMinutesToday / 30) * 6));

  // Workouts: +5 per workout, max +10
  bonus += Math.min(10, snap.workoutsToday.length * 5);

  // Water: up to +4 (2,500ml = full)
  bonus += Math.min(4, Math.round((snap.waterMlToday / 2_500) * 4));

  // Sleep: +6 if ≥7h, +3 if ≥5h
  if (snap.sleepHours !== null) {
    if (snap.sleepHours >= 7) bonus += 6;
    else if (snap.sleepHours >= 5) bonus += 3;
  }

  return Math.min(30, bonus);
}

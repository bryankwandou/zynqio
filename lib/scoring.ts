/**
 * lib/scoring.ts — Zynqio Centralized Scoring Engine
 * 
 * Provides consistent scoring logic for all game modes.
 * Authoritative scoring MUST be done server-side.
 */

export type GameMode = 'classic' | 'speed_rush' | 'gold_quest' | 'battle_royale' | 'team' | 'survival' | 'wayground_classic';

export interface ScoringResult {
  isCorrect: boolean;
  baseScore: number;
  speedBonus: number;
  totalScore: number;
  accuracyPoints: number;
}

/**
 * Calculates score based on correctness, speed, and game mode.
 * 
 * Classic Scoring:
 * - Base: 600 points per question weight
 * - Speed: Up to 400 points based on remaining time
 * 
 * Speed Rush:
 * - Speed bonus is multiplied by 1.5x
 * - Incorrect answers penalize -100 points
 */
export function calculateScore(params: {
  isCorrect: boolean;
  gameMode: GameMode;
  timeLeft: number;
  totalTime: number;
  pointsWeight: number;
  streak?: number;
}): ScoringResult {
  const { isCorrect, gameMode, timeLeft, totalTime, pointsWeight, streak = 0 } = params;

  if (!isCorrect) {
    return {
      isCorrect: false,
      baseScore: gameMode === 'speed_rush' ? -100 : 0,
      speedBonus: 0,
      totalScore: gameMode === 'speed_rush' ? -100 : 0,
      accuracyPoints: 0,
    };
  }

  // Wayground Classic: quartile-based scoring + streak bonus
  if (gameMode === 'wayground_classic') {
    const timeRatio = totalTime > 0 ? Math.max(0, timeLeft / totalTime) : 0;
    let baseScore: number;
    if (timeRatio >= 0.75) baseScore = 1000;
    else if (timeRatio >= 0.50) baseScore = 850;
    else if (timeRatio >= 0.25) baseScore = 700;
    else baseScore = 500;

    // Streak bonus (stacks on top of base)
    let streakBonus = 0;
    if (streak >= 10) streakBonus = 200;
    else if (streak >= 5) streakBonus = 100;
    else if (streak >= 3) streakBonus = 50;

    const total = Math.floor((baseScore + streakBonus) * pointsWeight);
    return {
      isCorrect: true,
      baseScore: total,
      speedBonus: streakBonus,
      totalScore: total,
      accuracyPoints: pointsWeight,
    };
  }

  const baseScore = 600 * pointsWeight;

  // Speed bonus logic
  let speedMultiplier = 1.0;
  if (gameMode === 'speed_rush') speedMultiplier = 1.5;

  const timeRatio = totalTime > 0 ? Math.max(0, timeLeft / totalTime) : 0;
  const speedBonus = Math.floor(400 * pointsWeight * timeRatio * speedMultiplier);

  return {
    isCorrect: true,
    baseScore,
    speedBonus,
    totalScore: baseScore + speedBonus,
    accuracyPoints: pointsWeight,
  };
}

/**
 * Helper to determine if an answer is correct based on question type.
 */
export function validateAnswer(question: any, selectedAnswer: any): boolean {
  if (!question || selectedAnswer === undefined) return false;

  const type = question.type;

  if (type === "MCQ") {
    return String(question.correctAnswer) === String(selectedAnswer);
  }

  if (type === "TF") {
    const ca = String(question.correctAnswer ?? "");
    const sa = String(selectedAnswer ?? "");
    // Stored as "True"/"False" text but player may send index "0"/"1"
    if (sa === "0" || sa === "1") {
      const options = question.options?.length ? question.options : ["True", "False"];
      return ca === String(options[parseInt(sa)]);
    }
    return ca.toLowerCase() === sa.toLowerCase();
  }
  
  if (type === "FIB") {
    const validAnswers = (question.correctAnswer as string)
      ?.split(";")
      .map((a: string) => a.trim().toLowerCase()) || [];
    return validAnswers.includes((selectedAnswer || "").trim().toLowerCase());
  } 
  
  if (type === "MSQ") {
    const normalize = (s: string) => s.trim().toLowerCase();
    const correctSet = new Set(
      (question.correctAnswer as string)
        ?.split(";")
        .map(normalize) || []
    );
    const selectedSet = new Set(
      Array.isArray(selectedAnswer)
        ? (selectedAnswer as string[]).map(normalize)
        : (selectedAnswer as string)?.split(";").map(normalize) || []
    );
    return (
      correctSet.size === selectedSet.size &&
      [...correctSet].every((value) => selectedSet.has(value))
    );
  }

  return false;
}

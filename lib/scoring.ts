/**
 * lib/scoring.ts — Zynqio Centralized Scoring Engine
 * 
 * Provides consistent scoring logic for all game modes.
 * Authoritative scoring MUST be done server-side.
 */

export type GameMode = 'classic' | 'speed_rush' | 'gold_quest' | 'battle_royale' | 'team' | 'survival';

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
}): ScoringResult {
  const { isCorrect, gameMode, timeLeft, totalTime, pointsWeight } = params;

  if (!isCorrect) {
    return {
      isCorrect: false,
      baseScore: gameMode === 'speed_rush' ? -100 : 0,
      speedBonus: 0,
      totalScore: gameMode === 'speed_rush' ? -100 : 0,
      accuracyPoints: 0,
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

  if (type === "MCQ" || type === "TF") {
    return question.correctAnswer === selectedAnswer;
  } 
  
  if (type === "FIB") {
    const validAnswers = (question.correctAnswer as string)
      ?.split(";")
      .map((a: string) => a.trim().toLowerCase()) || [];
    return validAnswers.includes((selectedAnswer || "").trim().toLowerCase());
  } 
  
  if (type === "MSQ") {
    const correctSet = new Set(
      (question.correctAnswer as string)
        ?.split(";")
        .map((a: string) => a.trim()) || []
    );
    const selectedSet = new Set(
      Array.isArray(selectedAnswer)
        ? selectedAnswer
        : (selectedAnswer as string)?.split(";").map((a: string) => a.trim()) || []
    );
    return (
      correctSet.size === selectedSet.size && 
      [...correctSet].every((value) => selectedSet.has(value))
    );
  }

  return false;
}

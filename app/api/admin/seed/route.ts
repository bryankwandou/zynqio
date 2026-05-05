import { NextResponse } from "next/server";
import { saveQuizData } from "@/lib/kv";
import { redis } from "@/lib/kv";

const DEMO_HOST_ID = "demo";

const DEMO_QUIZZES = [
  {
    id: "demo-general-001",
    title: "General Knowledge Blast",
    author: "Zynqio Team",
    category: "General",
    visibility: "public",
    plays: 1240,
    rating: 4.7,
    createdAt: "2026-01-15T08:00:00.000Z",
    questions: [
      { id: "q1", text: "What is the capital of France?", options: ["Berlin", "London", "Paris", "Rome"], correctAnswer: 2, points: 1, timeLimit: 30 },
      { id: "q2", text: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Saturn"], correctAnswer: 1, points: 1, timeLimit: 30 },
      { id: "q3", text: "What is 7 × 8?", options: ["54", "56", "58", "60"], correctAnswer: 1, points: 1, timeLimit: 20 },
      { id: "q4", text: "Who painted the Mona Lisa?", options: ["Michelangelo", "Raphael", "Leonardo da Vinci", "Donatello"], correctAnswer: 2, points: 1, timeLimit: 30 },
      { id: "q5", text: "What is the chemical symbol for water?", options: ["H2O", "CO2", "NaCl", "O2"], correctAnswer: 0, points: 1, timeLimit: 20 },
      { id: "q6", text: "How many continents are there on Earth?", options: ["5", "6", "7", "8"], correctAnswer: 2, points: 1, timeLimit: 20 },
      { id: "q7", text: "What is the largest ocean?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], correctAnswer: 3, points: 1, timeLimit: 20 },
      { id: "q8", text: "In which year did World War II end?", options: ["1943", "1944", "1945", "1946"], correctAnswer: 2, points: 1, timeLimit: 30 },
    ],
  },
  {
    id: "demo-tech-001",
    title: "Tech & Programming 101",
    author: "Zynqio Team",
    category: "Tech",
    visibility: "public",
    plays: 890,
    rating: 4.5,
    createdAt: "2026-01-20T08:00:00.000Z",
    questions: [
      { id: "q1", text: "What does HTML stand for?", options: ["HyperText Markup Language", "High Tech Modern Language", "Hyper Transfer Markup Logic", "HyperText Machine Learning"], correctAnswer: 0, points: 1, timeLimit: 30 },
      { id: "q2", text: "Which language is primarily used for styling web pages?", options: ["JavaScript", "Python", "CSS", "SQL"], correctAnswer: 2, points: 1, timeLimit: 20 },
      { id: "q3", text: "What does CPU stand for?", options: ["Central Processing Unit", "Computer Personal Unit", "Core Processing Utility", "Central Power Unit"], correctAnswer: 0, points: 1, timeLimit: 20 },
      { id: "q4", text: "Which company created the JavaScript language?", options: ["Microsoft", "Google", "Netscape", "Apple"], correctAnswer: 2, points: 1, timeLimit: 30 },
      { id: "q5", text: "What is the output of: console.log(typeof null) in JavaScript?", options: ["null", "undefined", "object", "string"], correctAnswer: 2, points: 2, timeLimit: 30 },
      { id: "q6", text: "What does API stand for?", options: ["Application Programming Interface", "Automated Program Integration", "Advanced Processing Interface", "Application Protocol Index"], correctAnswer: 0, points: 1, timeLimit: 20 },
    ],
  },
  {
    id: "demo-science-001",
    title: "Science Smackdown",
    author: "Zynqio Team",
    category: "Science",
    visibility: "public",
    plays: 654,
    rating: 4.3,
    createdAt: "2026-02-01T08:00:00.000Z",
    questions: [
      { id: "q1", text: "What is the speed of light (approx)?", options: ["300,000 km/s", "150,000 km/s", "500,000 km/s", "1,000,000 km/s"], correctAnswer: 0, points: 1, timeLimit: 30 },
      { id: "q2", text: "What gas do plants primarily absorb during photosynthesis?", options: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Hydrogen"], correctAnswer: 2, points: 1, timeLimit: 20 },
      { id: "q3", text: "What is the atomic number of Carbon?", options: ["4", "6", "8", "12"], correctAnswer: 1, points: 1, timeLimit: 20 },
      { id: "q4", text: "Which organ pumps blood through the body?", options: ["Liver", "Brain", "Lungs", "Heart"], correctAnswer: 3, points: 1, timeLimit: 20 },
      { id: "q5", text: "What is Newton's first law of motion about?", options: ["Gravity", "Inertia", "Acceleration", "Friction"], correctAnswer: 1, points: 1, timeLimit: 30 },
      { id: "q6", text: "What planet has the most moons?", options: ["Jupiter", "Saturn", "Uranus", "Neptune"], correctAnswer: 1, points: 1, timeLimit: 30 },
    ],
  },
  {
    id: "demo-math-001",
    title: "Math Masters Challenge",
    author: "Zynqio Team",
    category: "Math",
    visibility: "public",
    plays: 432,
    rating: 4.2,
    createdAt: "2026-02-10T08:00:00.000Z",
    questions: [
      { id: "q1", text: "What is the value of π (pi) to 2 decimal places?", options: ["3.12", "3.14", "3.16", "3.18"], correctAnswer: 1, points: 1, timeLimit: 20 },
      { id: "q2", text: "What is the square root of 144?", options: ["11", "12", "13", "14"], correctAnswer: 1, points: 1, timeLimit: 20 },
      { id: "q3", text: "Solve: 2x + 4 = 12. What is x?", options: ["2", "3", "4", "5"], correctAnswer: 2, points: 2, timeLimit: 30 },
      { id: "q4", text: "What is 15% of 200?", options: ["25", "30", "35", "40"], correctAnswer: 1, points: 1, timeLimit: 20 },
      { id: "q5", text: "What is the area of a circle with radius 5? (use π ≈ 3.14)", options: ["78.5", "31.4", "62.8", "25"], correctAnswer: 0, points: 2, timeLimit: 30 },
      { id: "q6", text: "What is 2^10?", options: ["512", "1024", "2048", "256"], correctAnswer: 1, points: 1, timeLimit: 20 },
    ],
  },
  {
    id: "demo-history-001",
    title: "History Through the Ages",
    author: "Zynqio Team",
    category: "History",
    visibility: "public",
    plays: 321,
    rating: 4.4,
    createdAt: "2026-02-15T08:00:00.000Z",
    questions: [
      { id: "q1", text: "In which year did the French Revolution begin?", options: ["1776", "1789", "1804", "1815"], correctAnswer: 1, points: 1, timeLimit: 30 },
      { id: "q2", text: "Who was the first US President?", options: ["Thomas Jefferson", "John Adams", "George Washington", "Benjamin Franklin"], correctAnswer: 2, points: 1, timeLimit: 20 },
      { id: "q3", text: "The Great Wall of China was primarily built to protect against which group?", options: ["Persians", "Romans", "Mongols", "Turks"], correctAnswer: 2, points: 1, timeLimit: 30 },
      { id: "q4", text: "In which country did the Industrial Revolution begin?", options: ["France", "Germany", "USA", "England"], correctAnswer: 3, points: 1, timeLimit: 30 },
      { id: "q5", text: "Who wrote the Communist Manifesto?", options: ["Lenin", "Stalin", "Marx & Engels", "Trotsky"], correctAnswer: 2, points: 1, timeLimit: 20 },
    ],
  },
  {
    id: "demo-gaming-001",
    title: "Gaming Trivia Ultimate",
    author: "Zynqio Team",
    category: "Gaming",
    visibility: "public",
    plays: 1876,
    rating: 4.9,
    createdAt: "2026-03-01T08:00:00.000Z",
    questions: [
      { id: "q1", text: "Which game features a character named 'Master Chief'?", options: ["Call of Duty", "Halo", "Doom", "Battlefield"], correctAnswer: 1, points: 1, timeLimit: 20 },
      { id: "q2", text: "What is the best-selling video game of all time?", options: ["Tetris", "GTA V", "Minecraft", "Mario Kart"], correctAnswer: 2, points: 1, timeLimit: 30 },
      { id: "q3", text: "In which year was the original PlayStation released in Japan?", options: ["1992", "1993", "1994", "1995"], correctAnswer: 2, points: 1, timeLimit: 30 },
      { id: "q4", text: "What game popularized the Battle Royale genre?", options: ["Fortnite", "PUBG", "H1Z1", "Warzone"], correctAnswer: 1, points: 1, timeLimit: 20 },
      { id: "q5", text: "Which franchise features characters named Link and Zelda?", options: ["Final Fantasy", "Fire Emblem", "The Legend of Zelda", "Skyrim"], correctAnswer: 2, points: 1, timeLimit: 20 },
      { id: "q6", text: "What does 'HP' stand for in RPG games?", options: ["High Power", "Hit Points", "Hero Points", "Health Percentage"], correctAnswer: 1, points: 1, timeLimit: 20 },
      { id: "q7", text: "Which game series includes 'Among Us' as a competitor?", options: ["Fall Guys", "Goose Goose Duck", "Town of Salem", "All of the above"], correctAnswer: 3, points: 2, timeLimit: 30 },
    ],
  },
];

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const adminKey = body.key || req.headers.get("x-admin-key");

    // Simple guard — not a full auth system, just prevent random public calls
    const expectedKey = process.env.SEED_ADMIN_KEY || "zynqio-seed-2026";
    if (adminKey !== expectedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results: string[] = [];

    for (const quiz of DEMO_QUIZZES) {
      await saveQuizData(DEMO_HOST_ID, quiz.id, quiz);
      results.push(`✅ Seeded: ${quiz.title} (${quiz.questions.length} questions)`);
    }

    return NextResponse.json({
      success: true,
      seeded: DEMO_QUIZZES.length,
      results,
    });
  } catch (err: any) {
    console.error("Seed error:", err);
    return NextResponse.json({ error: err.message || "Seed failed" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const count = await (redis as any).scard("public_quizzes");
    return NextResponse.json({ publicQuizCount: count });
  } catch {
    return NextResponse.json({ publicQuizCount: 0 });
  }
}

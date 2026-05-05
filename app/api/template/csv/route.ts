import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const csvLines = [
  [
    "Question",
    "Type",
    "Option A",
    "Option B",
    "Option C",
    "Option D",
    "Correct Answer",
    "Points",
    "Time Limit (Seconds)",
  ],
  [
    "Who invented the light bulb?",
    "MCQ",
    "Edison",
    "Tesla",
    "Newton",
    "Einstein",
    "A",
    "1",
    "30",
  ],
  ["The sun rises from the west.", "TF", "True", "False", "", "", "B", "1", "15"],
];

function toCsv(rows: string[][]) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const escaped = value.replaceAll('"', '""');
          return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
        })
        .join(",")
    )
    .join("\n");
}

export async function GET() {
  const csv = `${toCsv(csvLines)}\n`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="Zynqio_Example.csv"',
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}

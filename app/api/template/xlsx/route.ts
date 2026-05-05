import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function buildTemplateRows() {
  return [
    {
      "Question": "What is the capital of Indonesia?",
      "Type": "MCQ",
      "Option A": "Jakarta",
      "Option B": "Surabaya",
      "Option C": "Bandung",
      "Option D": "Medan",
      "Answer": "A",
      "Points": 1,
      "Time Limit (Seconds)": 30,
    },
    {
      "Question": "Is the Earth flat?",
      "Type": "TF",
      "Option A": "True",
      "Option B": "False",
      "Option C": "",
      "Option D": "",
      "Answer": "B",
      "Points": 1,
      "Time Limit (Seconds)": 15,
    },
    {
      "Question": "Zynqio is the best quiz platform ___.",
      "Type": "FIB",
      "Option A": "",
      "Option B": "",
      "Option C": "",
      "Option D": "",
      "Answer": "ever;in the world",
      "Points": 2,
      "Time Limit (Seconds)": 45,
    },
    {
      "Question": "Which of these are programming languages?",
      "Type": "MSQ",
      "Option A": "HTML",
      "Option B": "JavaScript",
      "Option C": "CSS",
      "Option D": "Python",
      "Answer": "B;D",
      "Points": 3,
      "Time Limit (Seconds)": 60,
    },
    {
      "Question": "Arrange these numbers in ascending order.",
      "Type": "ORDER",
      "Option A": "10",
      "Option B": "20",
      "Option C": "30",
      "Option D": "40",
      "Answer": "10,20,30,40",
      "Points": 5,
      "Time Limit (Seconds)": 30,
    }
  ];
}

export async function GET() {
  try {
    // Generate worksheet from data
    const worksheet = XLSX.utils.json_to_sheet(buildTemplateRows());
    
    // Add column widths for better UX
    const wscols = [
      { wch: 45 }, // Question
      { wch: 12 }, // Type
      { wch: 20 }, // Option A
      { wch: 20 }, // Option B
      { wch: 20 }, // Option C
      { wch: 20 }, // Option D
      { wch: 20 }, // Correct Answer
      { wch: 10 },  // Points
      { wch: 25 }, // Time Limit
    ];
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Zynqio Production Template");

    // Write as buffer for Node.js serverless
    const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx", compression: true });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="Zynqio_Production_Template.xlsx"',
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("ZYNQIO CRITICAL: XLSX Generation Failed", error);
    return NextResponse.json({ error: "Production Engine: Critical Error", detail: String(error) }, { status: 500 });
  }
}

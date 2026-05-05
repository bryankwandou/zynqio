"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, ArrowLeft, CheckCircle2, AlertCircle, Zap } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

// ─── Platform signatures ──────────────────────────────────────────────────────
type Platform = "quizizz" | "kahoot" | "blooket" | "gimkit" | "generic";

function detectPlatform(headers: string[]): Platform {
  const h = headers.map((s) => s.toLowerCase().trim());
  if (h.some((c) => c.includes("question text")) && h.some((c) => c.startsWith("option 1")))
    return "quizizz";
  if (h.some((c) => c.startsWith("answer 1 - max"))) return "kahoot";
  if (h.some((c) => c === "answer" && headers.some((x) => x.toLowerCase() === "question")))
    return "blooket";
  if (h.some((c) => c.includes("question"))) return "generic";
  return "generic";
}

// ─── Quizizz parser ───────────────────────────────────────────────────────────
function parseQuizizz(rows: any[]): { questions: any[]; errors: string[] } {
  const questions: any[] = [];
  const errors: string[] = [];

  const typeMap: Record<string, string> = {
    "multiple choice": "MCQ",
    "checkbox": "MSQ",
    "true/false": "TF",
    "fill-in-the-blank": "FIB",
    "fill in the blank": "FIB",
    "open-ended": "OPEN",
    "open ended": "OPEN",
    "poll": "OPEN",
    "draw": "OPEN",
  };

  rows.forEach((row, idx) => {
    const get = (key: string) => {
      const k = Object.keys(row).find((r) => r.toLowerCase().trim().startsWith(key.toLowerCase()));
      return k ? String(row[k] ?? "").trim() : "";
    };

    const text = get("question text");
    if (!text || text.toLowerCase().includes("(required)")) return;

    const rawType = get("question type").toLowerCase();
    const type = typeMap[rawType] || "MCQ";

    const opts = ["option 1", "option 2", "option 3", "option 4", "option 5", "option 6"]
      .map((o) => get(o))
      .filter((v) => v !== "");

    if (type !== "TF" && type !== "FIB" && type !== "OPEN" && opts.length < 2) {
      errors.push(`Row ${idx + 2}: Not enough options. Skipped.`);
      return;
    }

    let correctRaw = get("correct answer");
    let correctAnswer = "";

    if (type === "MCQ") {
      const n = parseInt(correctRaw);
      correctAnswer = isNaN(n) ? "0" : String(n - 1);
    } else if (type === "MSQ") {
      correctAnswer = correctRaw
        .split(",")
        .map((s: string) => String(parseInt(s.trim()) - 1))
        .filter((s: string) => !isNaN(parseInt(s)))
        .join(";");
    } else if (type === "TF") {
      correctAnswer = correctRaw.toLowerCase().includes("true") ? "0" : "1";
      if (!opts.length) opts.push("True", "False");
    } else if (type === "FIB") {
      correctAnswer = opts.slice(0, 3).join(";") || correctRaw;
    } else {
      correctAnswer = "";
    }

    const time = parseInt(get("time in seconds") || get("time")) || 30;
    const explanation = get("answer explanation");

    questions.push({
      id: Math.random().toString(36).slice(2, 11),
      type,
      text,
      options: type === "TF" ? ["True", "False"] : opts,
      correctAnswer,
      points: 1,
      time,
      explanation: explanation || undefined,
    });
  });

  return { questions, errors };
}

// ─── Kahoot parser ────────────────────────────────────────────────────────────
function parseKahoot(rows: any[]): { questions: any[]; errors: string[] } {
  const questions: any[] = [];
  const errors: string[] = [];

  rows.forEach((row, idx) => {
    const get = (startsWith: string) => {
      const k = Object.keys(row).find((r) =>
        r.toLowerCase().trim().startsWith(startsWith.toLowerCase())
      );
      return k ? String(row[k] ?? "").trim() : "";
    };

    const text = get("question");
    if (!text) return;

    const opts = ["answer 1", "answer 2", "answer 3", "answer 4"]
      .map((o) => get(o))
      .filter((v) => v !== "");

    if (opts.length < 2) {
      errors.push(`Row ${idx + 2}: Not enough answers. Skipped.`);
      return;
    }

    const correctRaw = get("correct answer");
    // Kahoot correct answer is the text of the answer
    const correctIdx = opts.findIndex(
      (o) => o.toLowerCase() === correctRaw.toLowerCase()
    );
    const correctAnswer = correctIdx >= 0 ? String(correctIdx) : "0";

    const time = parseInt(get("time limit") || get("time")) || 30;

    questions.push({
      id: Math.random().toString(36).slice(2, 11),
      type: "MCQ",
      text,
      options: opts,
      correctAnswer,
      points: 1,
      time,
    });
  });

  return { questions, errors };
}

// ─── Blooket parser ───────────────────────────────────────────────────────────
function parseBlooket(rows: any[]): { questions: any[]; errors: string[] } {
  const questions: any[] = [];
  const errors: string[] = [];

  rows.forEach((row, idx) => {
    const keys = Object.keys(row);
    const getKey = (name: string) =>
      keys.find((k) => k.toLowerCase().trim() === name.toLowerCase());

    const qKey = getKey("question") || getKey("q");
    const aKey = getKey("answer") || getKey("correct answer") || getKey("correct");
    if (!qKey || !aKey) return;

    const text = String(row[qKey] ?? "").trim();
    if (!text) return;

    const correct = String(row[aKey] ?? "").trim();

    // Collect options
    const optKeys = keys.filter((k) => {
      const l = k.toLowerCase();
      return l.startsWith("option") || l.startsWith("choice") || l.startsWith("answer");
    });
    let opts = optKeys
      .filter((k) => k !== aKey)
      .map((k) => String(row[k] ?? "").trim())
      .filter((v) => v !== "");
    if (!opts.includes(correct)) opts = [correct, ...opts];

    const correctIdx = opts.findIndex((o) => o.toLowerCase() === correct.toLowerCase());

    questions.push({
      id: Math.random().toString(36).slice(2, 11),
      type: "MCQ",
      text,
      options: opts.slice(0, 4),
      correctAnswer: String(Math.max(0, correctIdx)),
      points: 1,
      time: 30,
    });
  });

  return { questions, errors };
}

// ─── Generic parser (original logic, expanded) ───────────────────────────────
function parseGeneric(rows: any[]): { questions: any[]; errors: string[] } {
  const questions: any[] = [];
  const errors: string[] = [];

  const aliases: Record<string, string[]> = {
    text: ["question", "pertanyaan", "soal", "q", "text", "question text", "isi soal", "prompt", "problem"],
    type: ["type", "tipe", "jenis", "questiontype", "qtype", "format"],
    correctAnswer: ["correct", "answer", "correct_answer", "jawaban benar", "kunci", "correct answer", "solution", "right", "kunci_jawaban"],
    points: ["points", "poin", "score", "nilai", "weight", "mark", "bobot"],
    option_a: ["option_a", "option a", "pilihan a", "a", "choice a", "answer 1", "option1", "opt1"],
    option_b: ["option_b", "option b", "pilihan b", "b", "choice b", "answer 2", "option2", "opt2"],
    option_c: ["option_c", "option c", "pilihan c", "c", "choice c", "answer 3", "option3", "opt3"],
    option_d: ["option_d", "option d", "pilihan d", "d", "choice d", "answer 4", "option4", "opt4"],
    option_e: ["option_e", "option e", "pilihan e", "e", "choice e", "answer 5", "option5", "opt5"],
    time: ["time", "waktu", "duration", "timer", "time_override", "limit", "seconds", "time in seconds"],
  };

  rows.forEach((row, idx) => {
    const getVal = (al: string[]) => {
      const key = Object.keys(row).find((k) => {
        const norm = k.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
        return al.some((a) => norm === a.toLowerCase().replace(/[^a-z0-9]/g, ""));
      });
      return key ? row[key] : null;
    };

    const question = getVal(aliases.text);
    if (!question || String(question).includes("(required)")) {
      if (Object.values(row).some((v) => v !== "")) {
        errors.push(`Row ${idx + 2}: Missing question text. Skipped.`);
      }
      return;
    }

    const typeRaw = (getVal(aliases.type) || "MCQ").toString().toUpperCase().trim();
    const type = ["MCQ", "TF", "FIB", "MSQ", "ORDER", "OPEN"].includes(typeRaw)
      ? typeRaw
      : "MCQ";

    const opts = [
      getVal(aliases.option_a),
      getVal(aliases.option_b),
      getVal(aliases.option_c),
      getVal(aliases.option_d),
      getVal(aliases.option_e),
    ]
      .map((v) => v?.toString().trim() || "")
      .filter((v) => v !== "");

    let correctRaw = (getVal(aliases.correctAnswer) || "").toString().trim();

    if (type === "MCQ" || type === "MSQ") {
      const letterMap: Record<string, string> = {
        A: "0", B: "1", C: "2", D: "3", E: "4",
        "1": "0", "2": "1", "3": "2", "4": "3", "5": "4",
      };
      const findByText = (t: string) => {
        const i = opts.findIndex((o) => o.toLowerCase() === t.toLowerCase());
        return i !== -1 ? String(i) : null;
      };

      if (type === "MSQ" && (correctRaw.includes(";") || correctRaw.includes(","))) {
        const delim = correctRaw.includes(";") ? ";" : ",";
        correctRaw = correctRaw
          .split(delim)
          .map((a: string) => {
            const tr = a.trim();
            return findByText(tr) ?? letterMap[tr.toUpperCase()] ?? tr;
          })
          .join(";");
      } else {
        correctRaw = findByText(correctRaw) ?? letterMap[correctRaw.toUpperCase()] ?? correctRaw;
      }
    }

    const points = parseInt(getVal(aliases.points) || "1");
    const time = parseInt(getVal(aliases.time) || "30");

    questions.push({
      id: Math.random().toString(36).slice(2, 11),
      type,
      text: question.toString(),
      options: opts.length >= 2 ? opts : type === "TF" ? ["True", "False"] : opts,
      correctAnswer: correctRaw,
      points: isNaN(points) ? 1 : points,
      time: isNaN(time) ? 30 : time,
    });
  });

  return { questions, errors };
}

// ─── Main component ───────────────────────────────────────────────────────────
const PLATFORM_LABELS: Record<Platform, string> = {
  quizizz: "Quizizz",
  kahoot: "Kahoot",
  blooket: "Blooket",
  gimkit: "Gimkit",
  generic: "Generic / Custom",
};

export default function ImportQuiz() {
  const router = useRouter();
  const [preview, setPreview] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [platform, setPlatform] = useState<Platform>("generic");
  const [dragging, setDragging] = useState(false);

  const processFile = useCallback((file: File) => {
    const reader = new FileReader();

    reader.onload = (evt) => {
      const data = evt.target?.result;
      let rows: any[] = [];

      try {
        if (file.name.toLowerCase().endsWith(".csv")) {
          let text = data as string;
          if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
          const delimiters = [",", ";", "\t", "|"];
          const firstLine = text.split("\n")[0];
          let best = ",";
          let max = -1;
          delimiters.forEach((d) => {
            const c = firstLine.split(d).length;
            if (c > max) { max = c; best = d; }
          });
          const result = Papa.parse(text, { header: true, delimiter: best, skipEmptyLines: true });
          rows = result.data as any[];
        } else {
          const wb = XLSX.read(data, { type: "array" });
          // Try each sheet, pick the one with most rows
          let bestSheet = wb.SheetNames[0];
          let bestCount = 0;
          wb.SheetNames.forEach((name) => {
            const count = XLSX.utils.sheet_to_json(wb.Sheets[name]).length;
            if (count > bestCount) { bestCount = count; bestSheet = name; }
          });
          rows = XLSX.utils.sheet_to_json(wb.Sheets[bestSheet], { defval: "" });
        }
      } catch (e: any) {
        setErrors([`Failed to parse file: ${e.message}`]);
        return;
      }

      if (!rows.length) {
        setErrors(["No data rows found in file."]);
        return;
      }

      const headers = Object.keys(rows[0] || {});
      const detected = detectPlatform(headers);
      setPlatform(detected);

      let result: { questions: any[]; errors: string[] };
      if (detected === "quizizz") result = parseQuizizz(rows);
      else if (detected === "kahoot") result = parseKahoot(rows);
      else if (detected === "blooket") result = parseBlooket(rows);
      else result = parseGeneric(rows);

      if (result.questions.length === 0) {
        setErrors([
          "No valid questions found. Check column headers match your platform format.",
          ...result.errors,
        ]);
      } else {
        setPreview(result.questions);
        setErrors(result.errors);
      }
    };

    if (file.name.toLowerCase().endsWith(".csv")) {
      reader.readAsText(file, "UTF-8");
    } else {
      reader.readAsArrayBuffer(file);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  };

  const importToBuilder = () => {
    try {
      sessionStorage.setItem("zynqio_import_preview", JSON.stringify(preview));
    } catch {
      // ignore
    }
    router.push("/create?fromImport=1");
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.back()} className="p-2 hover:bg-accent rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-foreground mb-1 uppercase tracking-tight">Import Quiz</h1>
            <p className="text-muted-foreground text-sm">
              Auto-detects: <span className="text-blue-400 font-bold">Quizizz · Kahoot · Blooket · CSV · XLSX · XLS</span>
            </p>
          </div>
        </div>

        {!preview.length ? (
          <div
            className={`bg-card border-2 rounded-3xl p-16 text-center transition-all ${dragging ? "border-blue-500 bg-blue-500/5" : "border-border border-dashed"}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={handleFileChange}
            />
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
              <div className="w-24 h-24 bg-blue-600/10 text-blue-500 rounded-full flex items-center justify-center mb-8 shadow-inner">
                <Upload size={40} className={dragging ? "scale-110 transition-transform" : "animate-bounce"} />
              </div>
              <h2 className="text-2xl font-black text-foreground mb-4 uppercase">
                {dragging ? "Drop it!" : "Click to browse or drag & drop"}
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto mb-6 text-base">
                Supports <strong>CSV, XLSX, XLS</strong>. Automatically detects format from
                Quizizz, Kahoot, Blooket, and custom spreadsheets.
              </p>
              <div className="flex flex-wrap justify-center gap-2 mb-10">
                {["Quizizz", "Kahoot", "Blooket", "Custom CSV", "Custom XLSX"].map((p) => (
                  <span key={p} className="text-xs bg-accent/50 border border-border text-muted-foreground px-3 py-1 rounded-full font-bold">
                    {p}
                  </span>
                ))}
              </div>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 px-10 rounded-2xl shadow-lg shadow-blue-900/20 pointer-events-none">
                Select File
              </Button>
            </label>

            {errors.length > 0 && (
              <div className="mt-8 bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-red-500 text-sm text-left">
                {errors.map((e, i) => <div key={i}>⚠ {e}</div>)}
              </div>
            )}

            <div className="mt-12 flex justify-center gap-4 flex-wrap">
              <Button variant="outline" className="border-border text-muted-foreground py-5 px-6 rounded-xl hover:bg-accent"
                onClick={() => { const a = document.createElement("a"); a.href = "/api/template/xlsx"; a.download = "Zynqio_Template.xlsx"; a.click(); }}>
                <FileSpreadsheet size={18} className="mr-2" /> Excel Template
              </Button>
              <Button variant="outline" className="border-border text-muted-foreground py-5 px-6 rounded-xl hover:bg-accent"
                onClick={() => { const a = document.createElement("a"); a.href = "/api/template/csv"; a.download = "Zynqio_Template.csv"; a.click(); }}>
                <FileSpreadsheet size={18} className="mr-2" /> CSV Example
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-card border border-border rounded-3xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xl">
              <div>
                <div className="flex items-center gap-3 text-green-500 font-black text-xl mb-1 uppercase">
                  <CheckCircle2 size={24} /> {preview.length} Questions Ready
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold uppercase tracking-wider">
                  <Zap size={12} className="text-blue-500" />
                  Detected format: <span className="text-blue-400 ml-1">{PLATFORM_LABELS[platform]}</span>
                </div>
                {errors.length > 0 && (
                  <div className="flex items-center gap-2 text-amber-500 text-xs mt-2 font-medium">
                    <AlertCircle size={14} /> {errors.length} rows skipped
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" className="text-muted-foreground" onClick={() => { setPreview([]); setErrors([]); }}>
                  Cancel
                </Button>
                <Button className="bg-green-600 hover:bg-green-700 text-white font-black py-5 px-8 rounded-2xl shadow-lg" onClick={importToBuilder}>
                  Import to Builder
                </Button>
              </div>
            </div>

            {errors.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-amber-600 text-xs space-y-1 font-medium">
                <div className="font-black uppercase mb-1">Skipped rows:</div>
                {errors.map((e, i) => <div key={i}>• {e}</div>)}
              </div>
            )}

            <div className="overflow-auto bg-card border border-border rounded-3xl shadow-xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-accent/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="p-4 font-black uppercase tracking-widest text-xs w-8">#</th>
                    <th className="p-4 font-black uppercase tracking-widest text-xs">Type</th>
                    <th className="p-4 font-black uppercase tracking-widest text-xs">Question</th>
                    <th className="p-4 font-black uppercase tracking-widest text-xs">Options</th>
                    <th className="p-4 font-black uppercase tracking-widest text-xs">Answer</th>
                    <th className="p-4 font-black uppercase tracking-widest text-xs">Pts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.map((q, i) => (
                    <tr key={i} className="hover:bg-accent/20 transition-colors">
                      <td className="p-4 text-muted-foreground font-bold text-xs">{i + 1}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                          q.type === "MCQ" ? "bg-blue-500/10 text-blue-400" :
                          q.type === "TF" ? "bg-green-500/10 text-green-400" :
                          q.type === "FIB" ? "bg-purple-500/10 text-purple-400" :
                          q.type === "MSQ" ? "bg-orange-500/10 text-orange-400" :
                          "bg-accent text-muted-foreground"
                        }`}>{q.type}</span>
                      </td>
                      <td className="p-4 font-medium text-foreground max-w-xs truncate">{q.text}</td>
                      <td className="p-4 text-muted-foreground text-xs">{q.options?.length || 0} opts</td>
                      <td className="p-4 font-bold text-green-500 text-xs">{q.correctAnswer || "—"}</td>
                      <td className="p-4 font-black text-xs">{q.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

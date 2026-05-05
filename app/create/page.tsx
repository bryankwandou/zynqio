"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Plus, Settings, Save, ArrowLeft, Trash2, GripVertical, FileUp, X, CheckCircle2, Globe, Lock, Image } from "lucide-react";
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

type QuestionType = 'MCQ' | 'TF' | 'FIB' | 'MSQ' | 'ORDER' | 'OPEN';

interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options?: string[];
  correctAnswer?: string | string[];
  points: number;
  timeOverride?: number;
}

const QUESTION_TYPES: { id: QuestionType; label: string; desc: string }[] = [
  { id: 'MCQ', label: 'Multiple Choice', desc: '1 correct answer' },
  { id: 'MSQ', label: 'Multi-Select', desc: 'Multiple correct answers' },
  { id: 'TF', label: 'True / False', desc: 'Binary choice' },
  { id: 'FIB', label: 'Fill in Blank', desc: 'Type short answer' },
  { id: 'ORDER', label: 'Sequence', desc: 'Drag to reorder' },
  { id: 'OPEN', label: 'Open Ended', desc: 'Long text answer' },
];

function normalizeQuestionType(value: unknown): QuestionType {
  const type = String(value || "MCQ").toUpperCase();
  return (['MCQ', 'TF', 'FIB', 'MSQ', 'ORDER', 'OPEN'].includes(type) ? type : 'MCQ') as QuestionType;
}

export default function CreateQuiz() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<QuestionType>('MCQ');
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<Question[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [headerRowIndex, setHeaderRowIndex] = useState(-1);
  const [isEditingLoaded, setIsEditingLoaded] = useState(false);

  // Quiz settings
  const [showSettings, setShowSettings] = useState(false);
  const [quizPrivacy, setQuizPrivacy] = useState<'public' | 'private'>('public');
  const [quizCategory, setQuizCategory] = useState('General');
  const [quizDescription, setQuizDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');

  const CATEGORIES = ['General', 'Math', 'Science', 'History', 'Tech', 'Language', 'Gaming'];

  const downloadTemplate = () => {
    const link = document.createElement("a");
    link.href = "/api/template/xlsx";
    link.download = "Zynqio_Template.xlsx";
    link.click();
  };

  const downloadCsvExample = () => {
    const link = document.createElement("a");
    link.href = "/api/template/csv";
    link.download = "Zynqio_Example.csv";
    link.click();
  };

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setEditingQuizId(params.get("quizId"));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const pendingImport = sessionStorage.getItem("zynqio_import_preview");
    if (!pendingImport) return;

    try {
      const parsed = JSON.parse(pendingImport);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setQuestions((prev) => [...prev, ...parsed]);
      }
    } catch (error) {
      console.error("Failed to restore imported questions:", error);
    } finally {
      sessionStorage.removeItem("zynqio_import_preview");
    }
  }, []);

  useEffect(() => {
    const quizId = editingQuizId;
    if (!quizId || !session?.user || isEditingLoaded) return;

    const hostId = (session.user as any)?.id;
    if (!hostId) {
      setIsEditingLoaded(true);
      return;
    }

    async function loadQuizForEdit() {
      try {
        const res = await fetch(
          `/api/quiz/get?hostId=${encodeURIComponent(hostId)}&quizId=${encodeURIComponent(String(quizId))}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          setIsEditingLoaded(true);
          return;
        }

        const quiz = await res.json();
        setTitle(quiz?.title || "");
        setQuizPrivacy(quiz?.visibility === 'private' ? 'private' : 'public');
        setQuizCategory(quiz?.category || 'General');
        setQuizDescription(quiz?.description || '');
        setCoverImage(quiz?.coverImage || '');

        if (Array.isArray(quiz?.questions)) {
          const restored = quiz.questions.map((q: any, index: number): Question => {
            const questionType = normalizeQuestionType(q?.type);
            const fallbackOptions =
              questionType === "TF"
                ? ["True", "False"]
                : questionType === "MCQ" || questionType === "MSQ"
                  ? ["", "", "", ""]
                  : [];

            return {
              id: q?.id || `${String(quizId)}-${index}`,
              type: questionType,
              text: String(q?.text || ""),
              options: Array.isArray(q?.options) ? q.options.map((opt: any) => String(opt)) : fallbackOptions,
              correctAnswer: q?.correctAnswer ?? "",
              points: Number(q?.points) > 0 ? Number(q.points) : 1,
              timeOverride:
                Number(q?.timeOverride) > 0 ? Number(q.timeOverride) : undefined,
            };
          });
          setQuestions(restored);
        }
      } catch (error) {
        console.error("Failed to load quiz for edit:", error);
      } finally {
        setIsEditingLoaded(true);
      }
    }

    loadQuizForEdit();
  }, [editingQuizId, isEditingLoaded, session]);

  const addQuestion = () => {
    const newQ: Question = {
      id: Math.random().toString(36).substr(2, 9),
      type: activeType,
      text: "",
      points: 1,
      options: activeType === 'MCQ' || activeType === 'MSQ' ? ["", "", "", ""] : activeType === 'TF' ? ["True", "False"] : [],
    };
    setQuestions([...questions, newQ]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const extension = file.name.split('.').pop()?.toLowerCase();

    reader.onload = (evt) => {
      const data = evt.target?.result;
      try {
        if (extension === 'csv') {
          Papa.parse(data as string, {
            header: false, // Use raw mode to find header row manually if needed
            skipEmptyLines: true,
            complete: (results) => processImportedData(results.data as any[]),
          });
        } else if (['xlsx', 'xls'].includes(extension!)) {
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          // Use header: 1 to get array of arrays for robust header detection
          const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
          processImportedData(json as any[]);
        }
      } catch (err) {
        console.error("Parse error:", err);
        alert("Failed to parse file. Please ensure it is a valid CSV or Excel file.");
      }
    };

    if (extension === 'csv') {
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  const processImportedData = (rawData: any[]) => {
    if (!rawData || rawData.length === 0) {
      alert("ERROR: The file seems to be empty or unreadable. Please check your file content.");
      return;
    }

    // ── Quizizz XLSX detection ──────────────────────────────────────────────
    // Quizizz format: Row 0 = column headers ("Question Text", "Question Type", "Option 1"…)
    //                 Row 1 = human-readable description (MUST be skipped)
    //                 Row 2+ = actual question data
    const row0 = Array.isArray(rawData[0]) ? rawData[0] : null;
    const isQuizizz = row0 && row0.some((cell: any) => {
      const s = String(cell || "").toLowerCase().trim();
      return s === "question text" || s === "question type";
    });

    if (isQuizizz) {
      const headers = (rawData[0] as any[]).map((h: any) => String(h || "").trim());
      const colIdx = (name: string) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase());

      const iCol   = colIdx("Question Text");
      const tCol   = colIdx("Question Type");
      const aCol   = colIdx("Correct Answer");
      const tmCol  = colIdx("Time in seconds");
      const optCols = [
        colIdx("Option 1"), colIdx("Option 2"), colIdx("Option 3"),
        colIdx("Option 4"), colIdx("Option 5"),
      ];

      // Skip row 0 (headers) and row 1 (description)
      const dataRows = rawData.slice(2) as any[][];

      const mapped = dataRows.map((row) => {
        const text = String(row[iCol] ?? "").trim();
        // Skip empty rows or leftover description text
        if (!text || text.includes("(required)")) return null;

        const rawType = String(row[tCol] ?? "Multiple Choice").trim().toLowerCase();
        let type: QuestionType;
        if (rawType === "multiple choice")         type = "MCQ";
        else if (rawType === "checkbox")           type = "MSQ";
        else if (rawType === "fill-in-the-blank")  type = "FIB";
        else if (rawType === "open-ended")         type = "OPEN";
        else if (rawType === "poll")               type = "OPEN";
        else if (rawType === "draw")               return null;
        else                                       type = "MCQ";

        const optValues = optCols
          .map(c => (c >= 0 ? String(row[c] ?? "").trim() : ""))
          .filter(v => v !== "");

        const rawAnswer = String(row[aCol] ?? "").trim();
        let correctAnswer = "";

        if (type === "MCQ") {
          // Quizizz uses 1-indexed number, convert to 0-indexed
          const num = parseInt(rawAnswer, 10);
          if (!isNaN(num) && num >= 1) correctAnswer = String(num - 1);
        } else if (type === "MSQ") {
          // "1,2,3" → "0;1;2"
          correctAnswer = rawAnswer.split(",")
            .map((s) => { const n = parseInt(s.trim(), 10); return isNaN(n) ? "" : String(n - 1); })
            .filter(v => v !== "")
            .join(";");
        } else if (type === "FIB") {
          // For FIB the option cells ARE the accepted answers
          correctAnswer = optValues.join(";");
        }
        // OPEN: no correct answer needed

        const timeSec = parseInt(String(row[tmCol] ?? "30"), 10);

        return {
          id: Math.random().toString(36).substr(2, 9),
          type,
          text,
          points: 1,
          options: type === "FIB" || type === "OPEN" ? [] : optValues,
          correctAnswer,
          timeOverride: isNaN(timeSec) || timeSec <= 0 ? undefined : timeSec,
        } as Question;
      }).filter((q): q is Question => q !== null);

      if (mapped.length === 0) {
        alert("ERROR: Could not find valid questions in the Quizizz file.\n\nMake sure you are using the official Quizizz spreadsheet export format.");
        return;
      }
      setQuestions(prev => [...prev, ...mapped]);
      return;
    }

    // ── Generic / Zynqio template smart scanner ─────────────────────────────
    const headerAliases: Record<string, string[]> = {
      text: ['question', 'pertanyaan', 'soal', 'q', 'text', 'isi soal', 'question text', 'problem', 'deskripsi soal'],
      type: ['type', 'tipe', 'jenis', 'kategori', 'questiontype', 'model', 'format'],
      correctAnswer: ['correctanswer', 'jawaban benar', 'kunci', 'key', 'jawaban', 'correct', 'answer', 'correct answer', 'kunci jawaban'],
      points: ['points', 'poin', 'score', 'nilai', 'weight', 'mark', 'point'],
      option_a: ['optiona', 'pilihana', 'a', 'choicea', 'jawabana', 'option1', 'opsia', 'option 1', 'answer 1', 'choice 1', 'pilihan 1'],
      option_b: ['optionb', 'pilihanb', 'b', 'choiceb', 'jawabanb', 'option2', 'opsib', 'option 2', 'answer 2', 'choice 2', 'pilihan 2'],
      option_c: ['optionc', 'pilihanc', 'c', 'choicec', 'jawabanc', 'option3', 'opsic', 'option 3', 'answer 3', 'choice 3', 'pilihan 3'],
      option_d: ['optiond', 'pilihand', 'd', 'choiced', 'jawaband', 'option4', 'opsid', 'option 4', 'answer 4', 'choice 4', 'pilihan 4'],
      time_override: ['timeoverride', 'timer', 'waktu', 'duration', 'limit', 'time', 'time limit', 'time limit (seconds)', 'durasi'],
    };

    let data = rawData;
    let localHeaderRowIndex = -1;
    if (Array.isArray(data) && data.length > 0) {
      let maxMatches = 0;
      let bestHeaders: string[] = [];

      for (let i = 0; i < Math.min(data.length, 30); i++) {
        const row = data[i];
        if (!Array.isArray(row)) continue;

        let matches = 0;
        const currentHeaders: string[] = [];

        row.forEach((cell: any, idx: number) => {
          if (!cell) { currentHeaders.push(`col_${idx}`); return; }
          // Use exact match only (not .includes) to avoid description-row false positives
          const normalized = cell.toString().toLowerCase().trim().replace(/[^a-z0-9 ]/g, '').slice(0, 40);
          let found = false;
          Object.entries(headerAliases).forEach(([, aliases]) => {
            if (aliases.includes(normalized)) { matches++; currentHeaders.push(normalized); found = true; }
          });
          if (!found) currentHeaders.push(normalized);
        });

        if (matches > maxMatches) {
          maxMatches = matches;
          localHeaderRowIndex = i;
          bestHeaders = currentHeaders;
        }
      }

      if (localHeaderRowIndex !== -1 && maxMatches >= 2) {
        const rows = data.slice(localHeaderRowIndex + 1);
        data = rows.map(r => {
          const obj: any = {};
          if (Array.isArray(r)) bestHeaders.forEach((h, idx) => { if (h) obj[h] = r[idx]; });
          else return r;
          return obj;
        });
      } else {
        if (Array.isArray(data[0])) {
          const headers = data[0].map((h: any, idx: number) =>
            h?.toString().toLowerCase().trim().replace(/[^a-z0-9 ]/g, '') || `col_${idx}`
          );
          data = data.slice(1).map(r => {
            const obj: any = {};
            if (Array.isArray(r)) headers.forEach((h: string, idx: number) => { if (h) obj[h] = r[idx]; });
            return obj;
          });
        }
      }
    }

    const mappedQuestions = data.map((row) => {
      const getVal = (aliases: string[]) => {
        const key = Object.keys(row).find(k => {
          const nk = k.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
          return aliases.some(a => nk === a.toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
        });
        return key ? row[key] : null;
      };

      const text = getVal(headerAliases.text);
      if (!text || text.toString().trim() === "") return null;

      const rawType = (getVal(headerAliases.type) || 'MCQ').toString().toUpperCase().trim();
      const type = (['MCQ', 'TF', 'FIB', 'MSQ', 'ORDER', 'OPEN'].includes(rawType) ? rawType : 'MCQ') as QuestionType;

      const options = [
        getVal(headerAliases.option_a),
        getVal(headerAliases.option_b),
        getVal(headerAliases.option_c),
        getVal(headerAliases.option_d),
      ].map(v => v?.toString().trim() || "").filter((v, i) => v !== "" || i < 2);

      const letterMap: Record<string, string> = { A: '0', B: '1', C: '2', D: '3', '1': '0', '2': '1', '3': '2', '4': '3' };
      let correctAnswer = getVal(headerAliases.correctAnswer)?.toString().trim() || "";

      if (type === 'MCQ' || type === 'MSQ') {
        const findByText = (t: string) => {
          const idx = options.findIndex(o => o && o.toLowerCase().trim() === t.toLowerCase().trim());
          return idx !== -1 ? idx.toString() : null;
        };
        if (type === 'MSQ' && (correctAnswer.includes(';') || correctAnswer.includes(','))) {
          const delim = correctAnswer.includes(';') ? ';' : ',';
          correctAnswer = correctAnswer.split(delim).map((ans: string) => {
            const t = ans.trim();
            return findByText(t) || letterMap[t.toUpperCase()] || t;
          }).filter((v: string) => v !== "").join(';');
        } else {
          correctAnswer = findByText(correctAnswer) ?? (letterMap[correctAnswer.toUpperCase()] || correctAnswer);
        }
      }

      return {
        id: Math.random().toString(36).substr(2, 9),
        type,
        text: text.toString(),
        points: parseInt(getVal(headerAliases.points)?.toString() || "1"),
        options: options.length >= 2 ? options : (type === 'TF' ? ["True", "False"] : options),
        correctAnswer,
        timeOverride: parseInt(getVal(headerAliases.time_override)?.toString() || "0"),
      } as Question;
    }).filter((q): q is Question => q !== null);

    if (mappedQuestions.length === 0) {
      const foundHeaders = Object.keys(data[0] || {}).join(', ');
      alert(`ERROR: Could not find valid questions.\n\nFound columns: [${foundHeaders}]\n\nRequired: 'Question', 'Option A', 'Option B', 'Correct Answer'.\n\nPlease use the provided template or a Quizizz XLSX export.`);
      return;
    }

    setQuestions(prev => [...prev, ...mappedQuestions]);
  };

  const confirmImport = () => {
    setQuestions([...questions, ...importPreview]);
    setImportPreview([]);
    setIsImporting(false);
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const saveQuiz = async () => {
    if (!title) {
      alert("Please enter a title");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/quiz/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId: editingQuizId || undefined,
          title,
          questions,
          visibility: 'public', // Default for now
          category: 'General'
        })
      });
      if (res.ok) {
        router.push('/dashboard');
      } else {
        const errBody = await res.json().catch(() => ({}));
        alert(errBody.error || "Failed to save quiz.");
      }
    } catch (err) {
      console.error("Save failed", err);
      alert("Failed to save quiz.");
    } finally {
      setIsSaving(false);
    }
  };

  if (status === "loading") return <div className="min-h-screen bg-background" />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <ChevronLeft size={24} />
              </Button>
            </Link>
            <h1 className="text-xl font-bold tracking-tight">
              {editingQuizId ? "Edit Quiz" : "Quiz Builder"}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="h-6 w-[1px] bg-border mx-2" />
            <Button 
              variant="outline" 
              className="border-border text-muted-foreground hover:bg-accent"
              onClick={downloadTemplate}
            >
              Download Template
            </Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 font-bold"
              onClick={saveQuiz}
            >
              {editingQuizId ? "Update Quiz" : "Save Quiz"}
            </Button>
          </div>
        </div>
      </header>
      
      {/* Top Action Bar */}
      <div className="border-b border-border bg-card/30 sticky top-16 z-40 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-accent rounded-lg transition-colors">
              <ArrowLeft size={20} />
            </button>
            <input 
              type="text" 
              placeholder="Enter Quiz Title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent text-2xl font-bold text-foreground outline-none placeholder:text-muted-foreground/30 focus:border-b-2 border-blue-500 transition-all px-1"
            />
          </div>
          <div className="flex items-center gap-3">
            <input 
              type="file" 
              id="csv-import" 
              className="hidden" 
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
            />
            <Button 
              variant="outline" 
              className="border-border text-muted-foreground hover:bg-accent"
              onClick={() => document.getElementById('csv-import')?.click()}
            >
              <FileUp size={18} className="mr-2" /> Import CSV/Excel
            </Button>
            <Button variant="outline" className="border-border text-muted-foreground hover:bg-accent">
              <Settings size={18} className="mr-2" /> Settings
            </Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={saveQuiz}
              disabled={isSaving}
            >
              <Save size={18} className="mr-2" /> {isSaving ? 'Saving...' : editingQuizId ? 'Update Quiz' : 'Save Quiz'}
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        
        {/* GLOBAL QUESTION TYPE TOGGLE (ZYNQIO UNIQUE FEATURE) */}
        <div className="bg-card border border-border rounded-2xl p-4 mb-8 sticky top-[120px] z-30 shadow-xl">
          <div className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Global Question Type Toggle</div>
          <div className="flex flex-wrap gap-2">
            {QUESTION_TYPES.map(type => (
              <button
                key={type.id}
                onClick={() => setActiveType(type.id)}
                className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl text-left transition-all border ${
                  activeType === type.id 
                    ? 'bg-blue-600/10 border-blue-500 text-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                    : 'bg-background border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
                }`}
              >
                <div className="font-bold mb-1">{type.label}</div>
                <div className="text-xs opacity-70">{type.desc}</div>
              </button>
            ))}
          </div>
          
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <div className="text-sm text-muted-foreground">
              Next added question will be: <span className="text-blue-500 font-bold">{QUESTION_TYPES.find(t => t.id === activeType)?.label}</span>
            </div>
            <Button 
              onClick={addQuestion}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 px-8 rounded-xl shadow-lg hover:shadow-blue-600/20 transition-all scale-105"
            >
              <Plus size={20} className="mr-2" />
              Add Question
            </Button>
          </div>
        </div>

        {/* Questions List */}
        <div className="space-y-6 pb-32">
          {questions.map((q, index) => (
            <div key={q.id} className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg group">
              {/* Question Header */}
              <div className="bg-accent/30 px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="cursor-grab text-muted-foreground hover:text-foreground"><GripVertical size={18} /></div>
                  <span className="font-bold text-foreground">Q{index + 1}</span>
                  <span className="px-2 py-1 bg-accent rounded text-xs font-semibold text-muted-foreground">{q.type}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Points:</span>
                    <select 
                      className="bg-background border border-border rounded px-2 py-1 outline-none text-foreground"
                      value={q.points}
                      onChange={(e) => {
                        const newQ = [...questions];
                        newQ[index].points = parseInt(e.target.value);
                        setQuestions(newQ);
                      }}
                    >
                      {[1,2,3,4,5,10].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <button onClick={() => removeQuestion(q.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Question Body */}
              <div className="p-6 space-y-6">
                <textarea 
                  placeholder="Type your question here..."
                  className="w-full bg-background border border-border rounded-xl p-4 text-lg text-foreground outline-none focus:border-blue-500 resize-none min-h-[100px] placeholder:text-muted-foreground/30"
                  value={q.text}
                  onChange={(e) => {
                    const newQ = [...questions];
                    newQ[index].text = e.target.value;
                    setQuestions(newQ);
                  }}
                />

                {/* Conditional render based on type */}
                {q.type === 'MCQ' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {q.options?.map((opt, i) => (
                      <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${q.correctAnswer === i.toString() ? 'border-green-500 bg-green-500/10' : 'border-border bg-background'}`}>
                        <button 
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${q.correctAnswer === i.toString() ? 'border-green-500 bg-green-500' : 'border-muted-foreground/30'}`}
                          onClick={() => {
                            const newQ = [...questions];
                            newQ[index].correctAnswer = i.toString();
                            setQuestions(newQ);
                          }}
                        >
                          {q.correctAnswer === i.toString() && <div className="w-2 h-2 bg-white rounded-full" />}
                        </button>
                        <input 
                          type="text" 
                          placeholder={`Option ${i+1}`}
                          className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground/20"
                          value={opt}
                          onChange={(e) => {
                            const newQ = [...questions];
                            if(newQ[index].options) newQ[index].options![i] = e.target.value;
                            setQuestions(newQ);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
                
                {q.type === 'TF' && (
                  <div className="flex gap-4">
                    {['True', 'False'].map((opt, i) => (
                      <div key={i} className={`flex-1 flex items-center justify-center gap-3 p-6 rounded-xl border-2 cursor-pointer transition-all ${q.correctAnswer === opt ? (opt === 'True' ? 'border-green-500 bg-green-500/10 text-green-500' : 'border-red-500 bg-red-500/10 text-red-500') : 'border-border bg-background text-muted-foreground hover:border-muted-foreground/50'}`}
                        onClick={() => {
                          const newQ = [...questions];
                          newQ[index].correctAnswer = opt;
                          setQuestions(newQ);
                        }}
                      >
                        <span className="text-xl font-bold">{opt}</span>
                      </div>
                    ))}
                  </div>
                )}

                {q.type === 'FIB' && (
                  <div className="bg-background border border-border rounded-xl p-4">
                    <p className="text-sm text-muted-foreground mb-2">Valid answers (separated by semicolon):</p>
                    <input 
                      type="text" 
                      placeholder="e.g. Jakarta;DKI Jakarta;Ibukota"
                      className="w-full bg-transparent border-b border-border pb-2 text-foreground outline-none focus:border-blue-500 placeholder:text-muted-foreground/20"
                      value={typeof q.correctAnswer === 'string' ? q.correctAnswer : ''}
                      onChange={(e) => {
                        const newQ = [...questions];
                        newQ[index].correctAnswer = e.target.value;
                        setQuestions(newQ);
                      }}
                    />
                  </div>
                )}
                
                {(q.type === 'MSQ' || q.type === 'ORDER' || q.type === 'OPEN') && (
                  <div className="bg-accent/20 rounded-xl p-8 border border-dashed border-border text-center text-muted-foreground">
                    {q.type} editor component placeholder
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {questions.length === 0 && (
            <div className="text-center py-20 text-muted-foreground">
              <p className="mb-2">Your quiz is empty.</p>
              <p>Select a question type above and click Add Question.</p>
            </div>
          )}
        </div>
      </main>

      {/* Import Preview Modal */}
      {isImporting && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex flex-col p-6 animate-in fade-in duration-300">
          <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-black text-foreground flex items-center gap-3 uppercase">
                  <FileUp className="text-blue-500" /> Confirm Import
                </h2>
                <p className="text-muted-foreground mt-1">Review your questions before adding them to the quiz.</p>
              </div>
              <button onClick={() => setIsImporting(false)} className="p-2 hover:bg-accent rounded-full text-muted-foreground">
                <X size={32} />
              </button>
            </div>

            <div className="flex-1 bg-card border border-border rounded-3xl overflow-hidden flex flex-col shadow-2xl">
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-accent/50 sticky top-0 z-10">
                    <tr>
                      <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border">#</th>
                      <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border">Question</th>
                      <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border">Type</th>
                      <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border">Correct Answer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {importPreview.map((q, i) => (
                      <tr key={i} className="hover:bg-accent/30 transition-colors">
                        <td className="p-4 text-muted-foreground font-mono">{i + 1}</td>
                        <td className="p-4 text-foreground font-medium">{q.text}</td>
                        <td className="p-4">
                          <span className="px-2 py-1 bg-accent rounded text-xs font-bold text-muted-foreground uppercase">{q.type}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-green-500 font-bold">{String(q.correctAnswer)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="p-6 bg-accent/20 border-t border-border flex justify-between items-center">
                <div className="flex flex-col">
                  <div className="text-muted-foreground text-sm flex items-center gap-2">
                    Found <span className="text-foreground font-bold">{importPreview.length}</span> questions in file.
                    {headerRowIndex > 0 && (
                      <span className="px-2 py-0.5 bg-green-500/10 text-green-500 text-[10px] font-black uppercase rounded-full border border-green-500/20">
                        Smart-Scan Optimized
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-4">
                  <Button variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={() => setIsImporting(false)}>Cancel</Button>
                  <Button className="bg-blue-600 hover:bg-blue-700 px-8 py-6 rounded-xl font-bold text-white shadow-lg" onClick={confirmImport}>
                    <CheckCircle2 size={18} className="mr-2" /> Add All Questions
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

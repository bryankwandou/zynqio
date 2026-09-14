"use client";

import { useBahasa } from "@/lib/bahasa";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Plus, Settings, Save, ArrowLeft, Trash2, GripVertical, FileUp, X, CheckCircle2, Globe, Lock, Image, Eye, EyeOff } from "lucide-react";
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Download } from "lucide-react";
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
  { id: 'MCQ',   label: 'Pilihan ganda', desc: 'Satu jawaban benar' },
  { id: 'MSQ',   label: 'Pilihan jamak', desc: 'Boleh lebih dari satu' },
  { id: 'TF',    label: 'Benar / Salah', desc: 'Dua pilihan saja' },
  { id: 'FIB',   label: 'Isian singkat', desc: 'Murid mengetik jawabannya' },
  { id: 'ORDER', label: 'Urutan',        desc: 'Susun dari yang pertama' },
  { id: 'OPEN',  label: 'Uraian',        desc: 'Jawaban panjang, dinilai guru' },
];

function normalizeQuestionType(value: unknown): QuestionType {
  const type = String(value || "MCQ").toUpperCase();
  return (['MCQ', 'TF', 'FIB', 'MSQ', 'ORDER', 'OPEN'].includes(type) ? type : 'MCQ') as QuestionType;
}

export default function CreateQuiz() {
  const { tt } = useBahasa();
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
  const [hideAnswer, setHideAnswer] = useState(false);

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
        setHideAnswer(!!quiz?.hideAnswer);

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
    if (!title.trim()) {
      alert("Judul kuis belum diisi.");
      return;
    }
    setIsSaving(true);
    try {
      // Kuis baru dibuat lebih dulu supaya punya id, baru soalnya
      // disimpan. Penyimpanan menuntut id karena kepemilikan diperiksa
      // terhadap baris kuis yang sudah ada — bukan terhadap nilai yang
      // ikut dikirim bersama permintaan.
      let quizId = editingQuizId;

      if (!quizId) {
        const created = await fetch('/api/quiz/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description: quizDescription,
            category: quizCategory,
            visibility: quizPrivacy,
          }),
        });
        if (!created.ok) {
          alert("Gagal membuat kuis. Coba lagi.");
          setIsSaving(false);
          return;
        }
        quizId = (await created.json()).quizId;
        setEditingQuizId(quizId);
      }

      const res = await fetch('/api/quiz/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId,
          title,
          questions,
          visibility: quizPrivacy,
          category: quizCategory,
          description: quizDescription,
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
      {/* Satu-satunya bilah kerja: kembali, judul kuis, lalu tindakannya. */}
      <div className="border-b border-border bg-card/60 sticky top-0 z-50 backdrop-blur-md">
        <div className="container mx-auto px-4 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button onClick={() => router.back()} aria-label={tt("Kembali ke halaman sebelumnya", "Back to the previous page")} className="p-2 hover:bg-accent rounded-lg transition-colors shrink-0">
              <ArrowLeft size={20} aria-hidden="true" />
            </button>
            <input
              type="text"
              placeholder={tt("Judul kuis…", "Quiz title…")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent text-base md:text-xl font-bold text-foreground outline-none placeholder:text-muted-foreground/30 focus:border-b-2 border-primary zy-motion px-1 min-w-0 w-full"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="file"
              id="csv-import"
              className="hidden"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
            />
            <Button
              variant="outline"
              size="sm"
              className="border-border hover:bg-accent dark:border-white/20 dark:text-white/80 dark:bg-white/5 px-2 md:px-3"
              onClick={downloadTemplate}
              title={tt("Unduh berkas contoh untuk diisi di Excel", "Download a sample file to fill in with Excel")}
              aria-label={tt("Unduh berkas contoh", "Download sample file")}
            >
              <Download size={16} aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-border hover:bg-accent dark:border-white/20 dark:text-white/80 dark:bg-white/5 px-2 md:px-3"
              onClick={() => document.getElementById('csv-import')?.click()}
              aria-label={tt("Impor soal dari berkas", "Import questions from a file")}
            >
              <FileUp size={16} className="md:mr-1" aria-hidden="true" /><span className="hidden md:inline">{tt("Impor", "Import")}</span>
            </Button>
            <span className="hidden sm:inline-flex"><ThemeToggle /></span>
            <Button variant="outline" size="sm" className="border-border hover:bg-accent dark:border-white/20 dark:text-white/80 dark:bg-white/5 px-2 md:px-3" onClick={() => setShowSettings(true)}>
              <Settings size={16} className="md:mr-1" /><span className="hidden md:inline">{tt("Pengaturan", "Settings")}</span>
            </Button>
            <Button
              size="sm"
              className="bg-primary hover:bg-primary text-white"
              onClick={saveQuiz}
              disabled={isSaving}
            >
              <Save size={16} className="md:mr-1" aria-hidden="true" /><span className="hidden md:inline">{isSaving ? tt("Menyimpan…", "Saving…") : editingQuizId ? tt("Perbarui", "Update") : tt("Simpan", "Save")}</span>
              <span className="md:hidden">{isSaving ? '…' : tt("Simpan", "Save")}</span>
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        
        {/* GLOBAL QUESTION TYPE TOGGLE (ZYNQIO UNIQUE FEATURE) */}
        <div className="bg-card border border-border rounded-2xl p-4 mb-8 md:sticky md:top-[120px] md:z-40 shadow-xl">
          <div className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">{tt("Ubah jenis semua soal sekaligus", "Change the type of every question at once")}</div>
          <div className="flex flex-wrap gap-2">
            {QUESTION_TYPES.map(type => (
              <button
                key={type.id}
                onClick={() => setActiveType(type.id)}
                className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl text-left zy-motion border ${
                  activeType === type.id 
                    ? 'bg-primary/10 border-primary text-primary shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                    : 'bg-background border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
                }`}
              >
                <div className="font-bold mb-1">{type.label}</div>
                <div className="text-xs opacity-70">{type.desc}</div>
              </button>
            ))}
          </div>
          
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div className="text-sm text-muted-foreground">
              {tt("Soal berikutnya:", "Next question:")}{" "}<span className="text-primary font-bold">{QUESTION_TYPES.find(t => t.id === activeType)?.label}</span>
            </div>
            <Button
              onClick={addQuestion}
              className="bg-primary hover:bg-primary text-white font-bold py-6 px-8 rounded-xl shadow-lg hover:shadow-primary/20 zy-motion w-full sm:w-auto justify-center"
            >
              <Plus size={20} className="mr-2" />
              {tt("Tambah soal", "Add question")}
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
                    <span className="text-muted-foreground">{tt("Poin:", "Points:")}</span>
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
                  <button onClick={() => removeQuestion(q.id)} aria-label={tt(`Hapus soal nomor ${index + 1}`, `Delete question ${index + 1}`)} className="text-muted-foreground hover:text-red-500 transition-colors">
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Question Body */}
              <div className="p-6 space-y-6">
                <textarea 
                  placeholder={tt("Tulis soalnya di sini…", "Write the question here…")}
                  className="w-full bg-background border border-border rounded-xl p-4 text-lg text-foreground outline-none focus:border-primary resize-none min-h-[100px] placeholder:text-muted-foreground/30"
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
                      <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border-2 zy-motion ${q.correctAnswer === i.toString() ? 'border-green-500 bg-green-500/10' : 'border-border bg-background'}`}>
                        <button 
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center zy-motion ${q.correctAnswer === i.toString() ? 'border-green-500 bg-green-500' : 'border-muted-foreground/30'}`}
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
                          placeholder={tt(`Pilihan ${i+1}`, `Option ${i+1}`)}
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
                      <div key={i} className={`flex-1 flex items-center justify-center gap-3 p-6 rounded-xl border-2 cursor-pointer zy-motion ${q.correctAnswer === opt ? (opt === 'True' ? 'border-green-500 bg-green-500/10 text-green-500' : 'border-red-500 bg-red-500/10 text-red-500') : 'border-border bg-background text-muted-foreground hover:border-muted-foreground/50'}`}
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
                    <p className="text-sm text-muted-foreground mb-2">{tt("Jawaban yang diterima, dipisah titik koma:", "Accepted answers, separated by semicolons:")}</p>
                    <input 
                      type="text" 
                      placeholder={tt("mis. Jakarta;DKI Jakarta;Ibukota", "e.g. Jakarta;DKI Jakarta;Capital")}
                      className="w-full bg-transparent border-b border-border pb-2 text-foreground outline-none focus:border-primary placeholder:text-muted-foreground/20"
                      value={typeof q.correctAnswer === 'string' ? q.correctAnswer : ''}
                      onChange={(e) => {
                        const newQ = [...questions];
                        newQ[index].correctAnswer = e.target.value;
                        setQuestions(newQ);
                      }}
                    />
                  </div>
                )}
                
                {q.type === 'ORDER' && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-3 font-semibold">{tt("Butir yang diurutkan — seret untuk menyusun urutan benarnya:", "Items to order — drag to set the correct order:")}</p>
                      <div className="space-y-2">
                        {q.options?.map((opt, i) => (
                          <div key={i} className="flex items-center gap-3 p-3 bg-background border border-border rounded-lg hover:border-muted-foreground/40 transition-colors group">
                            <div className="cursor-grab text-muted-foreground group-hover:text-foreground transition-colors">
                              <GripVertical size={16} />
                            </div>
                            <span className="text-xs font-bold bg-accent px-2.5 py-1 rounded min-w-[40px] text-center">{i + 1}</span>
                            <input
                              type="text"
                              placeholder={tt(`Langkah ${i + 1}`, `Step ${i + 1}`)}
                              className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground/20"
                              value={opt}
                              onChange={(e) => {
                                const newQ = [...questions];
                                if(newQ[index].options) newQ[index].options![i] = e.target.value;
                                setQuestions(newQ);
                              }}
                            />
                            <button
                              onClick={() => {
                                const newQ = [...questions];
                                newQ[index].options = (newQ[index].options || []).filter((_, idx) => idx !== i);
                                setQuestions(newQ);
                              }}
                              className="text-muted-foreground hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const newQ = [...questions];
                        newQ[index].options = [...(newQ[index].options || []), ''];
                        setQuestions(newQ);
                      }}
                      className="w-full py-2 px-4 border border-dashed border-muted-foreground/30 rounded-lg text-sm font-semibold text-muted-foreground hover:border-muted-foreground/60 hover:text-foreground transition-colors"
                    >
                      {tt("+ Tambah langkah", "+ Add step")}
                    </button>
                  </div>
                )}

                {q.type === 'MSQ' && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground font-semibold">{tt("Pilihan jawaban — tandai semua yang benar:", "Answer options — mark every correct one:")}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {q.options?.map((opt, i) => {
                        const selected = Array.isArray(q.correctAnswer)
                          ? q.correctAnswer.includes(i.toString())
                          : typeof q.correctAnswer === 'string'
                            ? q.correctAnswer.split(';').includes(i.toString())
                            : false;
                        return (
                          <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border-2 zy-motion ${selected ? 'border-green-500 bg-green-500/10' : 'border-border bg-background'}`}>
                            <button
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center zy-motion shrink-0 ${selected ? 'border-green-500 bg-green-500' : 'border-muted-foreground/30'}`}
                              onClick={() => {
                                const newQ = [...questions];
                                const curr: string = typeof newQ[index].correctAnswer === 'string'
                                  ? (newQ[index].correctAnswer as string)
                                  : (newQ[index].correctAnswer as string[] || []).join(';');
                                const parts = curr ? curr.split(';').filter(Boolean) : [];
                                const key = i.toString();
                                const updated = parts.includes(key) ? parts.filter(p => p !== key) : [...parts, key];
                                newQ[index].correctAnswer = updated.join(';');
                                setQuestions(newQ);
                              }}
                            >
                              {selected && <div className="w-2.5 h-2.5 bg-white rounded-sm" />}
                            </button>
                            <input
                              type="text"
                              placeholder={tt(`Pilihan ${i + 1}`, `Option ${i + 1}`)}
                              className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground/20"
                              value={opt}
                              onChange={(e) => {
                                const newQ = [...questions];
                                if (newQ[index].options) newQ[index].options![i] = e.target.value;
                                setQuestions(newQ);
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">{tt("Murid harus menandai semuanya untuk mendapat poin penuh.", "Students must mark all of them to earn full points.")}</p>
                  </div>
                )}

                {q.type === 'OPEN' && (
                  <div className="bg-accent/20 rounded-xl p-4 border border-dashed border-border space-y-2">
                    <p className="text-sm font-semibold text-foreground">{tt("Soal uraian", "Open-ended question")}</p>
                    <p className="text-xs text-muted-foreground">{tt("Murid mengetik jawabannya sendiri. Jawaban ini tidak dinilai otomatis — Anda membacanya dan memberi nilai setelah sesi selesai.", "Students type their own answer. These answers are not graded automatically.")}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {questions.length === 0 && (
            <div className="text-center py-20 text-muted-foreground">
              <p className="mb-2">{tt("Kuis ini masih kosong.", "This quiz is still empty.")}</p>
              <p>{tt("Pilih jenis soal di atas, lalu tekan Tambah soal.", "Pick a question type above, then press Add question.")}</p>
            </div>
          )}
        </div>
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[110] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <h2 className="text-xl font-black uppercase tracking-wider text-foreground">{tt("Pengaturan kuis", "Quiz settings")}</h2>
              <button onClick={() => setShowSettings(false)} aria-label={tt("Tutup pengaturan kuis", "Close quiz settings")} className="p-2 hover:bg-accent rounded-full text-muted-foreground transition-colors">
                <X size={22} aria-hidden="true" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Privacy / Visibility */}
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">{tt("Siapa yang bisa melihat", "Who can see it")}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setQuizPrivacy('public')}
                    className={`flex-1 flex items-center gap-3 p-4 rounded-2xl border-2 zy-motion ${quizPrivacy === 'public' ? 'border-primary bg-primary/90/10 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground/40'}`}
                  >
                    <Globe size={20} />
                    <div className="text-left">
                      <div className="font-black text-sm">{tt("Umum", "General")}</div>
                      <div className="text-xs opacity-70">{tt("Siapa pun bisa menemukan dan memainkannya", "Anyone can find & play")}</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setQuizPrivacy('private')}
                    className={`flex-1 flex items-center gap-3 p-4 rounded-2xl border-2 zy-motion ${quizPrivacy === 'private' ? 'border-amber-500 bg-amber-500/10 text-amber-500' : 'border-border text-muted-foreground hover:border-muted-foreground/40'}`}
                  >
                    <Lock size={20} />
                    <div className="text-left">
                      <div className="font-black text-sm">{tt("Ubah dari umum jadi pribadi", "Switch from public to private")}</div>
                      <div className="text-xs opacity-70">{tt("Tidak tampil di Jelajahi, hanya lewat ruangan", "Hidden from Explore, room-only")}</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Hide Answer */}
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">{tt("Tampilan kunci jawaban", "Answer key display")}</p>
                <button
                  onClick={() => setHideAnswer((v) => !v)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 zy-motion text-left ${hideAnswer ? 'border-purple-500 bg-purple-500/10 text-purple-400' : 'border-border text-muted-foreground hover:border-muted-foreground/40'}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${hideAnswer ? 'bg-purple-500/20' : 'bg-accent'}`}>
                    {hideAnswer ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                  </div>
                  <div>
                    <div className="font-black text-sm">{hideAnswer ? tt("Jawaban disembunyikan", "Hide answer enabled") : tt("Tampilkan jawaban (bawaan)", "Show answer (default)")}</div>
                    <div className="text-xs opacity-60">
                      {hideAnswer
                        ? tt("Peserta hanya melihat \"Terjawab\" — benar/salah disembunyikan sampai pengajar membukanya", "Players see \"Answered\" — correct/wrong hidden until host reveals")
                        : tt("Peserta langsung melihat ✓ hijau atau ✗ merah setelah menjawab", "Players see green ✓ or red ✗ immediately after answering")}
                    </div>
                  </div>
                  <div className={`ml-auto w-10 h-6 rounded-full zy-motion shrink-0 relative ${hideAnswer ? 'bg-purple-500' : 'bg-border'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow zy-motion ${hideAnswer ? 'right-1' : 'left-1'}`} />
                  </div>
                </button>
              </div>

              {/* Category */}
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">{tt("Mata pelajaran", "Subject")}</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setQuizCategory(cat)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold border-2 zy-motion ${quizCategory === cat ? 'border-primary bg-primary/90/10 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground/40'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">{tt("Keterangan", "Description")}</p>
                <textarea
                  placeholder={tt("Keterangan singkat tentang kuis ini…", "A short description of this quiz…")}
                  value={quizDescription}
                  onChange={(e) => setQuizDescription(e.target.value)}
                  maxLength={200}
                  rows={3}
                  className="w-full bg-background border border-border rounded-xl p-3 text-sm text-foreground outline-none focus:border-primary resize-none placeholder:text-muted-foreground/30"
                />
                <p className="text-right text-xs text-muted-foreground mt-1">{quizDescription.length}/200</p>
              </div>

              {/* Cover Image URL */}
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">{tt("Alamat gambar sampul", "Cover image URL")}</p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://..."
                    value={coverImage}
                    onChange={(e) => setCoverImage(e.target.value)}
                    className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground/30"
                  />
                  {coverImage && (
                    <button onClick={() => setCoverImage('')} aria-label={tt("Hapus gambar sampul", "Remove cover image")} className="p-2 text-muted-foreground hover:text-red-500 transition-colors">
                      <X size={18} aria-hidden="true" />
                    </button>
                  )}
                </div>
                {coverImage && (
                  <div className="mt-3 h-24 rounded-xl overflow-hidden border border-border">
                    <img src={coverImage} alt={tt("Pratinjau sampul", "Cover preview")} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
              <Button variant="outline" className="border-border dark:border-white/20 dark:text-white/70" onClick={() => setShowSettings(false)}>{tt("Batal", "Cancel")}</Button>
              <Button className="bg-primary hover:bg-primary text-white font-bold px-6" onClick={() => setShowSettings(false)}>
                {tt("Terapkan pengaturan", "Apply settings")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Import Preview Modal */}
      {isImporting && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex flex-col p-6 animate-in fade-in duration-300">
          <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-black text-foreground flex items-center gap-3 uppercase">
                  <FileUp className="text-primary" />{" "}{tt("Konfirmasi impor", "Confirm import")}
                </h2>
                <p className="text-muted-foreground mt-1">{tt("Periksa soalnya sekali lagi sebelum dimasukkan ke kuis.", "Check the questions once more before adding them to the quiz.")}</p>
              </div>
              <button onClick={() => setIsImporting(false)} aria-label={tt("Tutup pratinjau impor", "Close import preview")} className="p-2 hover:bg-accent rounded-full text-muted-foreground">
                <X size={32} aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 bg-card border border-border rounded-3xl overflow-hidden flex flex-col shadow-2xl">
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-accent/50 sticky top-0 z-10">
                    <tr>
                      <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border">#</th>
                      <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border">{tt("Soal", "Question")}</th>
                      <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border">{tt("Jenis", "Type")}</th>
                      <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border">{tt("Jawaban benar", "Correct answer")}</th>
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
                    {tt("Ditemukan", "Found")}{" "}<span className="text-foreground font-bold">{importPreview.length}</span>{" "}{tt("soal di berkas.", "questions in file.")}
                    {headerRowIndex > 0 && (
                      <span className="px-2 py-0.5 bg-green-500/10 text-green-500 text-[10px] font-black uppercase rounded-full border border-green-500/20">
                        {tt("Pemindaian cerdas", "Smart-scan optimized")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-4">
                  <Button variant="outline" className="border-border dark:border-white/20 dark:text-white/70" onClick={() => setIsImporting(false)}>{tt("Batal", "Cancel")}</Button>
                  <Button className="bg-primary hover:bg-primary px-8 py-6 rounded-xl font-bold text-white shadow-lg" onClick={confirmImport}>
                    <CheckCircle2 size={18} className="mr-2" />{" "}{tt("Tambahkan semua soal", "Add all questions")}
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

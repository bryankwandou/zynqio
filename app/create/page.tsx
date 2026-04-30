"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Plus, Settings, Save, ArrowLeft, Trash2, GripVertical, FileUp, X, CheckCircle2 } from "lucide-react";
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

export default function CreateQuiz() {
  const { status } = useSession();
  const router = useRouter();
  const [activeType, setActiveType] = useState<QuestionType>('MCQ');
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<Question[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [headerRowIndex, setHeaderRowIndex] = useState(-1);

  const downloadTemplate = () => {
    const link = document.createElement("a");
    link.href = "/Zynqio_Template.xlsx";
    link.download = "Zynqio_Template.xlsx";
    link.click();
  };

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

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
    console.log("Processing imported data:", rawData);
    if (!rawData || rawData.length === 0) {
      alert("ERROR: The file seems to be empty or unreadable. Please check your file content.");
      return;
    }

    // MEGA PROMPT COMPLIANT & THIRD-PARTY (Quizizz, Blooket) COMPATIBLE HEADERS
    const headerAliases: Record<string, string[]> = {
      text: ['question', 'pertanyaan', 'soal', 'q', 'text', 'isi soal', 'question text', 'problem', 'deskripsi soal'],
      type: ['type', 'tipe', 'jenis', 'kategori', 'questiontype', 'model', 'format'],
      correctAnswer: ['correctanswer', 'jawaban benar', 'kunci', 'key', 'jawaban', 'correct', 'answer', 'correct answer', 'kunci jawaban'],
      points: ['points', 'poin', 'score', 'nilai', 'weight', 'mark', 'point'],
      option_a: ['optiona', 'pilihana', 'a', 'choicea', 'jawabana', 'option1', 'opsia', 'option 1', 'answer 1', 'choice 1', 'pilihan 1'],
      option_b: ['optionb', 'pilihanb', 'b', 'choiceb', 'jawabanb', 'option2', 'opsib', 'option 2', 'answer 2', 'choice 2', 'pilihan 2'],
      option_c: ['optionc', 'pilihanc', 'c', 'choicec', 'jawabanc', 'option3', 'opsic', 'option 3', 'answer 3', 'choice 3', 'pilihan 3'],
      option_d: ['optiond', 'pilihand', 'd', 'choiced', 'jawaband', 'option4', 'opsid', 'option 4', 'answer 4', 'choice 4', 'pilihan 4'],
      time_override: ['timeoverride', 'timer', 'waktu', 'duration', 'limit', 'time', 'time limit', 'time limit (seconds)'],
    };

    // 1. PRESIDENTIAL SMART SCANNER (Section 11.4 & 11.11)
    let data = rawData;
    let localHeaderRowIndex = -1;
    if (Array.isArray(data) && data.length > 0) {
      let maxMatches = 0;
      let bestHeaders: string[] = [];
      
      // Heuristic: Scan first 30 rows for headers
      for (let i = 0; i < Math.min(data.length, 30); i++) {
        const row = data[i];
        if (!Array.isArray(row)) continue;
        
        let matches = 0;
        const currentHeaders: string[] = [];
        
        row.forEach((cell: any, idx: number) => {
          if (!cell) {
            currentHeaders.push(`col_${idx}`);
            return;
          }
          const normalized = cell.toString().toLowerCase().trim().replace(/[^a-z0-9 ]/g, '');
          let found = false;
          Object.entries(headerAliases).forEach(([key, aliases]) => {
            if (aliases.includes(normalized) || aliases.some(a => normalized.includes(a))) {
              matches++;
              currentHeaders.push(normalized);
              found = true;
            }
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
        // Table found! Slice data from the row after headers
        const rows = data.slice(localHeaderRowIndex + 1);
        data = rows.map(r => {
          const obj: any = {};
          if (Array.isArray(r)) {
            bestHeaders.forEach((h: string, idx: number) => {
              if (h) obj[h] = r[idx];
            });
          } else {
            return r; // Already an object?
          }
          return obj;
        });
      } else {
        // Fallback: If no clear headers, try to find the first row that looks like a question
        console.warn("No clear headers found, applying heuristic scan");
        if (Array.isArray(data[0])) {
          const headers = data[0].map((h: any, idx: number) => h?.toString().toLowerCase().trim().replace(/[^a-z0-9 ]/g, '') || `col_${idx}`);
          const rows = data.slice(1);
          data = rows.map(r => {
            const obj: any = {};
            if (Array.isArray(r)) {
              headers.forEach((h: string, idx: number) => {
                if (h) obj[h] = r[idx];
              });
            }
            return obj;
          });
        }
      }
    }

    // 2. Map Rows to Questions (Section 5.4 & 11.3)
    const mappedQuestions = data.map((row, idx) => {
      const getVal = (aliases: string[]) => {
        const key = Object.keys(row).find(k => {
          const normalizedKey = k.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
          return aliases.some(a => {
            const normalizedAlias = a.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            return normalizedKey === normalizedAlias;
          });
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
        getVal(headerAliases.option_d)
      ].map(v => v?.toString().trim() || "").filter((v, i) => v !== "" || i < 2);

      // Handle correct answer mapping (Section 11.3)
      let correctAnswer = getVal(headerAliases.correctAnswer)?.toString().trim() || "";
      
      if (type === 'MCQ' || type === 'MSQ') {
        // 1. Try letter mapping (A, B, C, D)
        const letterMap: Record<string, string> = { 'A': '0', 'B': '1', 'C': '2', 'D': '3', '1': '0', '2': '1', '3': '2', '4': '3' };
        
        // 2. Try full text mapping (Quizizz style)
        const findIndexByText = (text: string) => {
          const idx = options.findIndex(opt => opt.toLowerCase() === text.toLowerCase());
          return idx !== -1 ? idx.toString() : null;
        };

        if (type === 'MSQ' && (correctAnswer.includes(';') || correctAnswer.includes(','))) {
          const delimiter = correctAnswer.includes(';') ? ';' : ',';
          correctAnswer = correctAnswer.split(delimiter).map((ans: string) => {
            const trimmed = ans.trim();
            return findIndexByText(trimmed) || letterMap[trimmed.toUpperCase()] || trimmed;
          }).join(';');
        } else {
          const mappedIdx = findIndexByText(correctAnswer);
          if (mappedIdx !== null) {
            correctAnswer = mappedIdx;
          } else {
            correctAnswer = letterMap[correctAnswer.toUpperCase()] || correctAnswer;
          }
        }
      }

      return {
        id: Math.random().toString(36).substr(2, 9),
        type,
        text: text.toString(),
        points: parseInt(getVal(headerAliases.points)?.toString() || "1"),
        options: options.length >= 2 ? options : (type === 'TF' ? ["True", "False"] : options),
        correctAnswer,
        timeOverride: parseInt(getVal(headerAliases.time_override)?.toString() || "0")
      } as Question;
    }).filter((q): q is Question => q !== null);

    if (mappedQuestions.length === 0) {
      const foundHeaders = Object.keys(data[0] || {}).join(', ');
      alert(`ERROR: Could not find valid questions. \n\nFound columns: [${foundHeaders}] \n\nRequired: 'Question', 'Option A', 'Option B', 'Correct Answer'. \n\nPlease use the provided template.`);
      return;
    }

    setImportPreview(mappedQuestions);
    setHeaderRowIndex(localHeaderRowIndex);
    setIsImporting(true);
  };

  const confirmImport = () => {
    setQuestions([...questions, ...importPreview]);
    setImportPreview([]);
    setIsImporting(false);
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
          title,
          questions,
          visibility: 'public', // Default for now
          category: 'General'
        })
      });
      if (res.ok) {
        router.push('/dashboard');
      }
    } catch (err) {
      console.error("Save failed", err);
    } finally {
      setIsSaving(false);
    }
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  if (status === "loading") return <div className="min-h-screen bg-slate-950" />;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                <ChevronLeft size={24} />
              </Button>
            </Link>
            <h1 className="text-xl font-bold tracking-tight">Quiz Builder</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="h-6 w-[1px] bg-slate-800 mx-2" />
            <Button 
              variant="outline" 
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={downloadTemplate}
            >
              Download Template
            </Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 font-bold"
              onClick={saveQuiz}
            >
              Save Quiz
            </Button>
          </div>
        </div>
      </header>
      
      {/* Top Action Bar */}
      <div className="border-b border-slate-800 bg-slate-900/50 sticky top-16 z-40 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
              <ArrowLeft size={20} />
            </button>
            <input 
              type="text" 
              placeholder="Enter Quiz Title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent text-2xl font-bold text-white outline-none placeholder:text-slate-600 focus:border-b-2 border-blue-500 transition-all px-1"
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
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={() => document.getElementById('csv-import')?.click()}
            >
              <FileUp size={18} className="mr-2" /> Import CSV/Excel
            </Button>
            <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
              <Settings size={18} className="mr-2" /> Settings
            </Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={saveQuiz}
              disabled={isSaving}
            >
              <Save size={18} className="mr-2" /> {isSaving ? 'Saving...' : 'Save Quiz'}
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        
        {/* GLOBAL QUESTION TYPE TOGGLE (ZYNQIO UNIQUE FEATURE) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-8 sticky top-[120px] z-30 shadow-xl">
          <div className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Global Question Type Toggle</div>
          <div className="flex flex-wrap gap-2">
            {QUESTION_TYPES.map(type => (
              <button
                key={type.id}
                onClick={() => setActiveType(type.id)}
                className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl text-left transition-all border ${
                  activeType === type.id 
                    ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                }`}
              >
                <div className="font-bold mb-1">{type.label}</div>
                <div className="text-xs opacity-70">{type.desc}</div>
              </button>
            ))}
          </div>
          
          <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-4">
            <div className="text-sm text-slate-400">
              Next added question will be: <span className="text-blue-400 font-bold">{QUESTION_TYPES.find(t => t.id === activeType)?.label}</span>
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
            <div key={q.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg group">
              {/* Question Header */}
              <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="cursor-grab text-slate-500 hover:text-slate-300"><GripVertical size={18} /></div>
                  <span className="font-bold text-white">Q{index + 1}</span>
                  <span className="px-2 py-1 bg-slate-700 rounded text-xs font-semibold text-slate-300">{q.type}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-400">Points:</span>
                    <select className="bg-slate-950 border border-slate-700 rounded px-2 py-1 outline-none text-white">
                      {[1,2,3,4,5].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <button onClick={() => removeQuestion(q.id)} className="text-slate-500 hover:text-red-400 transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Question Body */}
              <div className="p-6 space-y-6">
                <textarea 
                  placeholder="Type your question here..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-lg text-white outline-none focus:border-blue-500 resize-none min-h-[100px]"
                  value={q.text}
                  onChange={(e) => {
                    const newQ = [...questions];
                    newQ[index].text = e.target.value;
                    setQuestions(newQ);
                  }}
                />

                {/* Conditional render based on type (simplified for MVP layout) */}
                {q.type === 'MCQ' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {q.options?.map((opt, i) => (
                      <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border-2 ${q.correctAnswer === i.toString() ? 'border-green-500 bg-green-500/10' : 'border-slate-800 bg-slate-950'}`}>
                        <button 
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${q.correctAnswer === i.toString() ? 'border-green-500 bg-green-500' : 'border-slate-600'}`}
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
                          className="flex-1 bg-transparent outline-none text-white placeholder:text-slate-600"
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
                      <div key={i} className={`flex-1 flex items-center justify-center gap-3 p-6 rounded-xl border-2 cursor-pointer transition-all ${q.correctAnswer === opt ? (opt === 'True' ? 'border-green-500 bg-green-500/10 text-green-400' : 'border-red-500 bg-red-500/10 text-red-400') : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-600'}`}
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
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                    <p className="text-sm text-slate-400 mb-2">Valid answers (separated by semicolon):</p>
                    <input 
                      type="text" 
                      placeholder="e.g. Jakarta;DKI Jakarta;Ibukota"
                      className="w-full bg-transparent border-b border-slate-700 pb-2 text-white outline-none focus:border-blue-500"
                    />
                  </div>
                )}
                
                {/* Other types omitted for brevity in MVP UI but logic is same */}
                {(q.type === 'MSQ' || q.type === 'ORDER' || q.type === 'OPEN') && (
                  <div className="bg-slate-950/50 rounded-xl p-8 border border-dashed border-slate-700 text-center text-slate-500">
                    {q.type} editor component placeholder
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {questions.length === 0 && (
            <div className="text-center py-20 text-slate-500">
              <p className="mb-2">Your quiz is empty.</p>
              <p>Select a question type above and click Add Question.</p>
            </div>
          )}
        </div>
      </main>

      {/* Import Preview Modal */}
      {isImporting && (
        <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col p-6 animate-in fade-in duration-300">
          <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-black text-white flex items-center gap-3">
                  <FileUp className="text-blue-500" /> Confirm Import
                </h2>
                <p className="text-slate-400 mt-1">Review your questions before adding them to the quiz.</p>
              </div>
              <button onClick={() => setIsImporting(false)} className="p-2 hover:bg-slate-900 rounded-full text-slate-500">
                <X size={32} />
              </button>
            </div>

            <div className="flex-1 bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-950 sticky top-0 z-10">
                    <tr>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800">#</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800">Question</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800">Type</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800">Correct Answer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {importPreview.map((q, i) => (
                      <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 text-slate-500 font-mono">{i + 1}</td>
                        <td className="p-4 text-white font-medium">{q.text}</td>
                        <td className="p-4">
                          <span className="px-2 py-1 bg-slate-800 rounded text-xs font-bold text-slate-400">{q.type}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-green-400 font-bold">{q.correctAnswer}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="p-6 bg-slate-950 border-t border-slate-800 flex justify-between items-center">
                <div className="flex flex-col">
                  <div className="text-slate-400 text-sm flex items-center gap-2">
                    Found <span className="text-white font-bold">{importPreview.length}</span> questions in file.
                    {headerRowIndex > 0 && (
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-black uppercase rounded-full border border-green-500/20">
                        Smart-Scan Optimized (Row {headerRowIndex + 1})
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 mt-1">
                    <button 
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = "/Zynqio_Template.xlsx";
                        link.download = "Zynqio_Template.xlsx";
                        link.click();
                      }}
                      className="text-xs text-blue-500 hover:underline text-left"
                    >
                      Download Excel Template
                    </button>
                    <span className="text-slate-800 text-xs">|</span>
                    <button 
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = "/Zynqio_Example.csv";
                        link.download = "Zynqio_Example.csv";
                        link.click();
                      }}
                      className="text-xs text-blue-500 hover:underline text-left"
                    >
                      Download CSV Example
                    </button>
                  </div>
                </div>
                <div className="flex gap-4">
                  <Button variant="ghost" className="text-slate-400 hover:text-white" onClick={() => setIsImporting(false)}>Cancel</Button>
                  <Button className="bg-blue-600 hover:bg-blue-700 px-8 py-6 rounded-xl font-bold" onClick={confirmImport}>
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

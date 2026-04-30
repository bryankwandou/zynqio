"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Plus, Settings, Save, ArrowLeft, Trash2, GripVertical, FileUp, X, CheckCircle2 } from "lucide-react";
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

type QuestionType = 'MCQ' | 'TF' | 'FIB' | 'MSQ' | 'ORDER' | 'OPEN';

interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options?: string[];
  correctAnswer?: string | string[];
  points: number;
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
      if (extension === 'csv') {
        Papa.parse(data as string, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => processImportedData(results.data as any[]),
        });
      } else if (['xlsx', 'xls'].includes(extension!)) {
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet);
        processImportedData(json as any[]);
      }
    };

    if (extension === 'csv') reader.readAsText(file);
    else reader.readAsBinaryString(file);
  };

  const processImportedData = (data: any[]) => {
    const headerAliases: Record<string, string[]> = {
      text: ['question', 'pertanyaan', 'soal', 'q', 'text'],
      type: ['type', 'tipe', 'jenis'],
      correctAnswer: ['correct', 'answer', 'correct_answer', 'jawaban benar', 'kunci', 'key'],
      points: ['points', 'poin', 'score'],
      option_a: ['option_a', 'pilihan a', 'a', 'choice a', 'jawaban a', 'option1'],
      option_b: ['option_b', 'pilihan b', 'b', 'choice b', 'jawaban b', 'option2'],
      option_c: ['option_c', 'pilihan c', 'c', 'choice c', 'jawaban c', 'option3'],
      option_d: ['option_d', 'pilihan d', 'd', 'choice d', 'jawaban d', 'option4'],
    };

    const mappedQuestions: Question[] = data.map(row => {
      // Flexible Header Detection (Section 11.4)
      const getVal = (aliases: string[]) => {
        const key = Object.keys(row).find(k => {
          const normalized = k.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
          return aliases.some(a => a.replace(/[^a-z0-9]/g, '') === normalized);
        });
        return key ? row[key] : null;
      };

      const qType = (getVal(headerAliases.type) || 'MCQ').toUpperCase();
      const options = [
        getVal(headerAliases.option_a),
        getVal(headerAliases.option_b),
        getVal(headerAliases.option_c),
        getVal(headerAliases.option_d)
      ].filter(Boolean);

      return {
        id: Math.random().toString(36).substr(2, 9),
        type: qType as any,
        text: getVal(headerAliases.text) || "Untitled Question",
        points: parseInt(getVal(headerAliases.points) || "1"),
        options: options.length > 0 ? options : (qType === 'TF' ? ["True", "False"] : []),
        correctAnswer: getVal(headerAliases.correctAnswer) || ""
      };
    }).filter(q => q.text !== "Untitled Question");

    setImportPreview(mappedQuestions);
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
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-200">
      <Navbar />
      
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
                <div className="text-slate-400 text-sm">
                  Found <span className="text-white font-bold">{importPreview.length}</span> questions in file.
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

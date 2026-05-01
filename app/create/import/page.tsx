"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export default function ImportQuiz() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      if (selected.name.endsWith('.csv')) {
        // Parse CSV
        Papa.parse(data as string, {
          header: true,
          skipEmptyLines: true,
          complete: (results: any) => processParsedData(results.data),
          error: (err: any) => setErrors([err.message])
        });
      } else if (selected.name.endsWith('.xlsx') || selected.name.endsWith('.xls')) {
        // Parse Excel
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        processParsedData(jsonData);
      }
    };

    if (selected.name.endsWith('.csv')) {
      reader.readAsText(selected, 'UTF-8');
    } else {
      reader.readAsArrayBuffer(selected);
    }
  };

  const processParsedData = (data: any[]) => {
    const processed: any[] = [];
    const errs: string[] = [];

    const headerAliases: Record<string, string[]> = {
      text: ['question', 'pertanyaan', 'soal', 'q', 'text', 'isi soal'],
      type: ['type', 'tipe', 'jenis', 'kategori'],
      correctAnswer: ['correct', 'answer', 'correct_answer', 'jawaban benar', 'kunci', 'key', 'jawaban'],
      points: ['points', 'poin', 'score', 'nilai'],
      option_a: ['option_a', 'pilihan a', 'a', 'choice a', 'jawaban a', 'option1', 'opsi a'],
      option_b: ['option_b', 'pilihan b', 'b', 'choice b', 'jawaban b', 'option2', 'opsi b'],
      option_c: ['option_c', 'pilihan c', 'c', 'choice c', 'jawaban c', 'option3', 'opsi c'],
      option_d: ['option_d', 'pilihan d', 'd', 'choice d', 'jawaban d', 'option4', 'opsi d'],
    };

    data.forEach((row, idx) => {
      // Flexible Header Detection (Section 11.4)
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

      const question = getVal(headerAliases.text);
      if (!question) {
        errs.push(`Row ${idx + 2}: Missing question text. Skipped.`);
        return;
      }

      const typeRaw = getVal(headerAliases.type) || "MCQ";
      const type = typeRaw.toUpperCase();
      
      const options = [
        getVal(headerAliases.option_a),
        getVal(headerAliases.option_b),
        getVal(headerAliases.option_c),
        getVal(headerAliases.option_d)
      ].filter(Boolean);
      
      const correctRaw = getVal(headerAliases.correctAnswer);
      
      processed.push({
        id: Math.random().toString(36).substr(2, 9),
        type,
        text: question,
        options,
        correctAnswer: correctRaw?.toString().trim(),
        points: parseInt(getVal(headerAliases.points) || "1")
      });
    });

    setPreview(processed);
    setErrors(errs);
  };

  const importToBuilder = () => {
    try {
      sessionStorage.setItem("zynqio_import_preview", JSON.stringify(preview));
    } catch (error) {
      console.error("Failed to store import preview", error);
    }
    router.push("/create?fromImport=1");
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-200">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Import Quiz</h1>
            <p className="text-slate-400">Upload a CSV or Excel file to automatically generate questions</p>
          </div>
        </div>

        {!preview.length ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center border-dashed">
            <input 
              type="file" 
              id="file-upload" 
              className="hidden" 
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={handleFileUpload}
            />
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
              <div className="w-20 h-20 bg-blue-600/20 text-blue-500 rounded-full flex items-center justify-center mb-6">
                <Upload size={32} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Click to browse or drag file here</h2>
              <p className="text-slate-400 max-w-md mx-auto mb-8">
                Supports CSV, TSV, XLSX, and XLS formats. We automatically detect column headers.
              </p>
              <Button className="bg-blue-600 hover:bg-blue-700 pointer-events-none">
                Select File
              </Button>
            </label>
            
            <div className="mt-12 flex justify-center gap-4">
              <Button variant="outline" className="border-slate-700 text-slate-300" onClick={() => {
                const ws = XLSX.utils.json_to_sheet([
                  { "Question": "What is the capital of Indonesia?", "Type": "MCQ", "Option A": "Jakarta", "Option B": "Surabaya", "Option C": "Bandung", "Option D": "Medan", "Correct Answer": "A", "Points": 1 },
                  { "Question": "Is the Earth flat?", "Type": "TF", "Option A": "True", "Option B": "False", "Correct Answer": "B", "Points": 1 }
                ]);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Questions");
                XLSX.writeFile(wb, "Zynqio_Template.xlsx");
              }}>
                <FileSpreadsheet size={16} className="mr-2" /> Download Template
              </Button>
              <Button variant="outline" className="border-slate-700 text-slate-300" onClick={() => {
                const csv = Papa.unparse([
                  ["Question", "Type", "Option A", "Option B", "Option C", "Option D", "Correct Answer", "Points"],
                  ["Siapa penemu lampu?", "MCQ", "Edison", "Tesla", "Newton", "Einstein", "A", "1"],
                  ["2+2=5", "TF", "True", "False", "", "", "B", "1"]
                ]);
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = "Zynqio_Example.csv";
                link.click();
              }}>
                <FileSpreadsheet size={16} className="mr-2" /> Download Example
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2 text-green-400 font-bold mb-1">
                  <CheckCircle2 size={20} /> {preview.length} Questions Parsed
                </div>
                {errors.length > 0 && (
                  <div className="flex items-center gap-2 text-amber-500 text-sm mt-2">
                    <AlertCircle size={16} /> {errors.length} rows skipped due to errors
                  </div>
                )}
              </div>
              <Button className="bg-green-600 hover:bg-green-700 text-white font-bold" onClick={importToBuilder}>
                Import to Builder
              </Button>
            </div>

            {errors.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-amber-500 text-sm space-y-1">
                {errors.map((err, i) => <div key={i}>{err}</div>)}
              </div>
            )}

            <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800/50 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-4">Type</th>
                    <th className="p-4">Question</th>
                    <th className="p-4">Options</th>
                    <th className="p-4">Answer</th>
                    <th className="p-4">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {preview.map((q, i) => (
                    <tr key={i} className="hover:bg-slate-800/30">
                      <td className="p-4 font-mono text-xs">{q.type}</td>
                      <td className="p-4 max-w-xs truncate" title={q.text}>{q.text}</td>
                      <td className="p-4 text-slate-400">{q.options?.length || 0} opts</td>
                      <td className="p-4 text-green-400">{q.correctAnswer}</td>
                      <td className="p-4">{q.points}</td>
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

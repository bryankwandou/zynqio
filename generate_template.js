const XLSX = require('xlsx');

const data = [
  ["question", "type", "option_a", "option_b", "option_c", "option_d", "correct_answer", "points", "time_override"],
  ["What is the capital of Indonesia?", "MCQ", "Jakarta", "Surabaya", "Bandung", "Medan", "A", "1", "30"],
  ["Bumi lebih besar dari Bulan.", "TF", "True", "False", "", "", "TRUE", "1", "20"],
  ["2 + 2 = ___", "FIB", "", "", "", "", "4", "1", "15"],
  ["Sort these numbers: 1, 3, 2", "ORDER", "1", "2", "3", "", "1,3,2", "1", "45"],
  ["Explain the water cycle in your own words.", "OPEN", "", "", "", "", "", "2", "120"]
];

const ws = XLSX.utils.aoa_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Questions");

XLSX.writeFile(wb, "Zynqio_Template.xlsx");
console.log("Template generated: Zynqio_Template.xlsx");

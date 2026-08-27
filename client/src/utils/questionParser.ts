import type { CreateProblemPayload } from '../types/admin';

export interface ParsedMcqQuestion {
  title: string;
  description: string;
  options: {
    text: string;
    isCorrect: boolean;
  }[];
  maxScore: number;
}

/**
 * Parse plain text or AI-generated text blocks into structured MCQ question payloads.
 */
export function parseTextToMcqs(rawText: string): ParsedMcqQuestion[] {
  if (!rawText || !rawText.trim()) return [];

  const questions: ParsedMcqQuestion[] = [];
  // Split on double newlines or lines starting with Q1:, 1., Question 1:, etc.
  const blocks = rawText
    .split(/\n\s*(?=(?:Q\d+[:.]|\d+[\.\)]|Question\s*\d+[:.]))/i)
    .map((b) => b.trim())
    .filter(Boolean);

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 3) continue;

    let questionStem = '';
    const options: { text: string; isCorrect: boolean }[] = [];
    let correctAnswerLetter = '';
    let marks = 1;

    for (const line of lines) {
      // Check for Question Stem
      const qMatch = line.match(/^(?:Q\d+[:.]|\d+[\.\)]|Question\s*\d+[:.])\s*(.+)$/i);
      if (qMatch && !questionStem) {
        questionStem = qMatch[1].trim();
        continue;
      }

      // Check for Answer / Correct line
      const ansMatch = line.match(/^(?:Answer|Correct|Ans|Correct Option|Key)\s*[:=\-]?\s*([A-Da-d1-4])/i);
      if (ansMatch) {
        correctAnswerLetter = ansMatch[1].toUpperCase();
        continue;
      }

      // Check for Marks line
      const marksMatch = line.match(/^(?:Marks|Score|Points)\s*[:=\-]?\s*(\d+)/i);
      if (marksMatch) {
        marks = parseInt(marksMatch[1], 10) || 1;
        continue;
      }

      // Check for Options (e.g. A) Option text, A. Option text, (A) Option text, 1) Option text)
      const optMatch = line.match(/^(?:\(?([A-Da-d1-4])[\.\)]|\b([A-Da-d])\s*[-:])\s*(.+)$/);
      if (optMatch) {
        const text = optMatch[3].trim();
        options.push({
          text,
          isCorrect: false, // will mark after checking correctAnswerLetter
        });
        // Associate index
        const optIndex = options.length - 1;
        const letterMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, '1': 0, '2': 1, '3': 2, '4': 3 };
        if (correctAnswerLetter && letterMap[correctAnswerLetter] === optIndex) {
          options[optIndex].isCorrect = true;
        }
        continue;
      }

      // If no question stem was matched with a prefix, the first line is the question stem
      if (!questionStem) {
        questionStem = line;
      } else if (options.length === 0) {
        // Multi-line question stem
        questionStem += `\n${line}`;
      }
    }

    // Set correct answer based on parsed letter if not already assigned
    if (correctAnswerLetter && options.length > 0) {
      const letterMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, '1': 0, '2': 1, '3': 2, '4': 3 };
      const targetIdx = letterMap[correctAnswerLetter];
      if (targetIdx !== undefined && targetIdx < options.length) {
        options.forEach((opt, idx) => {
          opt.isCorrect = idx === targetIdx;
        });
      }
    }

    if (questionStem && options.length >= 2) {
      // If none was marked correct, default first to avoid unselectable
      if (!options.some((o) => o.isCorrect)) {
        options[0].isCorrect = true;
      }

      questions.push({
        title: questionStem.split('\n')[0].slice(0, 120),
        description: questionStem,
        options,
        maxScore: marks,
      });
    }
  }

  return questions;
}

/**
 * Parse CSV content to MCQ objects.
 */
export function parseCsvToMcqs(csvContent: string): ParsedMcqQuestion[] {
  const lines = csvContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const questions: ParsedMcqQuestion[] = [];
  // Expect headers: Question, OptionA, OptionB, OptionC, OptionD, Answer, Marks
  for (let i = 1; i < lines.length; i++) {
    // Simple CSV parser supporting quotes
    const cells = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
    const cleanCells = cells.map((c) => c.replace(/^"|"$/g, '').trim());

    if (cleanCells.length >= 6) {
      const stem = cleanCells[0];
      const optA = cleanCells[1];
      const optB = cleanCells[2];
      const optC = cleanCells[3];
      const optD = cleanCells[4];
      const ans = cleanCells[5].toUpperCase().trim();
      const marks = parseInt(cleanCells[6] || '1', 10) || 1;

      const options = [
        { text: optA, isCorrect: ans === 'A' || ans === '1' },
        { text: optB, isCorrect: ans === 'B' || ans === '2' },
        { text: optC, isCorrect: ans === 'C' || ans === '3' },
        { text: optD, isCorrect: ans === 'D' || ans === '4' },
      ].filter((o) => Boolean(o.text));

      if (!options.some((o) => o.isCorrect) && options.length > 0) {
        options[0].isCorrect = true;
      }

      questions.push({
        title: stem.slice(0, 120),
        description: stem,
        options,
        maxScore: marks,
      });
    }
  }
  return questions;
}

/**
 * Convert parsed MCQ to CreateProblemPayload.
 */
export function parsedMcqToPayload(
  q: ParsedMcqQuestion,
  displayOrder: number,
  examId?: number,
): CreateProblemPayload {
  return {
    title: q.title,
    description: q.description,
    questionType: 'mcq',
    difficulty: 'easy',
    maxScore: q.maxScore,
    displayOrder,
    examId,
    mcqOptions: q.options.map((opt) => ({
      text: opt.text,
      isCorrect: opt.isCorrect,
    })),
  };
}

/**
 * Sample CSV template content.
 */
export const SAMPLE_MCQ_CSV = `Question,OptionA,OptionB,OptionC,OptionD,Answer,Marks
"What is the time complexity of binary search?","O(n)","O(log n)","O(n^2)","O(1)","B",1
"Which keyword is used to declare a constant in JavaScript?","var","let","const","constant","C",1
"Which protocol is used for secure web browsing?","HTTP","FTP","HTTPS","SMTP","C",2
"What is the default port for PostgreSQL?","3306","5432","27017","6379","B",1`;

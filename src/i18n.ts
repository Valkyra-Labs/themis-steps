// Interface strings in English and Arabic, and the explanations of the
// engine's verdicts, written here from its structured result in either
// language rather than taken from its English sentence.
import type { Check, EngineError, Found, ParseError } from "./engine";

export type Lang = "en" | "ar";

/** Text with maths in it. Maths parts are shown left to right, isolated
 * from the sentence around them (a <bdi dir="ltr">), in both languages. */
export type Part = string | { math: string };
export type Rich = Part[];

/** What an explanation describes: a step of working, or an exercise's
 * stated answer checked against its equation. */
export type Subject = "step" | "answer";

/** Maths inside a plain string (a field hint cannot hold elements): the
 * Unicode left-to-right isolate, the plain-text form of <bdi dir="ltr">,
 * with no-break spaces so the maths is not split across lines. */
const ltr = (s: string) => `\u2066${s.replaceAll(" ", "\u00a0")}\u2069`;

const m = (math: string): Part => ({ math });
const X = m("x");

/** "2" becomes x = 2; the engine writes an approximate root as "≈ 1.324718". */
const root = (r: string): Part => m(r.startsWith("≈") ? `x ${r}` : `x = ${r}`);

function joined(items: Part[][], separator: string): Part[] {
  return items.flatMap((item, i) => (i === 0 ? item : [separator, ...item]));
}

const roots = (v: string[], separator: string) => joined(v.map((r) => [root(r)]), separator);

/** The text of a Rich, maths included, as one string. */
export function plain(r: Rich): string {
  return r.map((p) => (typeof p === "string" ? p : p.math)).join("");
}

// English: the engine's own wording (themis-algebra `explain` and its
// error messages), apart from tokens it names in their Rust debug form,
// which are shown as the symbol typed.

function foundEn(f: Found): Part[] {
  switch (f.kind) {
    case "symbol":
      return ["'", m(f.text), "'"];
    case "endOfLine":
      return ["end of line"];
    case "number":
      return ["number"];
    case "plusMinus":
      return ["'", m("±"), "' (write it once per line, as in ", m("x = ±3"), ")"];
    case "alternative":
      return ["'", m(f.text), "' (each alternative must be an equation)"];
    case "token":
      return [f.raw];
  }
}

function parseErrorEn(e: ParseError): Part[] {
  switch (e.kind) {
    case "empty":
      return ["the line is empty"];
    case "unexpected":
      return ["unexpected ", ...foundEn(e.found), ` at position ${e.at}`];
    case "twoUnknowns":
      return ["two unknowns (", m(e.a), " and ", m(e.b), "); one is supported"];
    case "exponentNotInteger":
      return [`the exponent at position ${e.at} must be a whole number`];
    case "exponentTooLarge":
      return [`the exponent at position ${e.at} is too large`];
    case "divisionByZero":
      return ["division by zero"];
    case "tooManyEquals":
      return ["more than one '", m("="), "'"];
  }
}

function errorEn(e: EngineError): Rich {
  switch (e.kind) {
    case "parse":
      return [`line ${e.line}: `, ...parseErrorEn(e.error)];
    case "kindMismatch":
      return ["one line is an equation and the other is an expression"];
    case "differentUnknowns":
      return ["the lines use different unknowns (", m(e.a), " and ", m(e.b), ")"];
    case "unknown":
      return [e.text];
  }
}

function explainEn(c: Check, subject: Subject): Rich {
  if (c.kind === "error") return errorEn(c.error ?? { kind: "unknown", text: c.explanation });
  const out: Part[] = [];
  if (c.kind === "equivalent") out.push("Correct: the step keeps the same solutions.");
  else if (c.kind === "not_equal")
    out.push("The expressions are not equal: at ", m(`x = ${c.witness}`), " the first is ", m(c.before), " and the second is ", m(c.after), ".");
  else {
    const step = subject === "step";
    const who = step ? "this step" : "the stated answer";
    const clauses: Part[][] = [];
    if (c.lostInfinitelyMany)
      clauses.push(
        step
          ? ["the first line holds for every ", X, " in its domain, the second does not"]
          : ["the equation holds for every ", X, " in its domain, the stated answer does not"],
      );
    if (c.gainedInfinitelyMany)
      clauses.push(
        step
          ? ["the second line holds for every ", X, " in its domain, the first does not"]
          : ["the stated answer holds for every ", X, " in its domain, the equation does not"],
      );
    if (c.lost.length > 0) clauses.push([`${who} loses `, ...roots(c.lost, ", ")]);
    if (c.gained.length > 0)
      clauses.push([`${who} adds `, ...roots(c.gained, ", "), `, which ${step ? "the previous line" : "the equation"} does not have`]);
    const sentence = joined(clauses, "; ");
    const first = sentence[0];
    if (typeof first === "string") sentence[0] = first.charAt(0).toUpperCase() + first.slice(1);
    out.push(...sentence, ".");
  }
  // A stated answer has no fractions, so a change of domain is the
  // equation's own restriction, already counted in its solutions.
  if (subject === "step") {
    if (c.domainWidenedAt.length > 0)
      out.push(" The new line is defined at ", ...roots(c.domainWidenedAt, ", "), ", where the previous one was not; keep that restriction.");
    if (c.domainNarrowedAt.length > 0) out.push(" The new line is undefined at ", ...roots(c.domainNarrowedAt, ", "), ".");
  }
  return out;
}

// Arabic: the same cases, in the terms of the interface (السطر، الحل،
// المجال، الإجابة المعلنة). Lists of roots take the Arabic comma, and
// clauses the Arabic semicolon.

/** "the solution(s)", agreeing with the count: one, two, three or more. */
const solutionsAr = (n: number) => (n === 1 ? "الحل" : n === 2 ? "الحلّين" : "الحلول");
/** "which is not a solution", agreeing with the count. */
const notSolutionAr = (n: number) => (n === 1 ? "وهو ليس حلًّا" : n === 2 ? "وهما ليسا حلّين" : "وهي ليست حلولًا");

function foundAr(f: Found, at: number): Part[] {
  switch (f.kind) {
    case "symbol":
      return ["لم يُتوقَّع «", m(f.text), `» في الموضع ${at}`];
    case "endOfLine":
      return [`انتهى السطر قبل اكتماله في الموضع ${at}`];
    case "number":
      return [`لم يُتوقَّع عدد في الموضع ${at}`];
    case "plusMinus":
      return ["لم يُتوقَّع «", m("±"), `» في الموضع ${at} (اكتبه مرة واحدة في السطر، كما في `, m("x = ±3"), ")"];
    case "alternative":
      return ["لم يُتوقَّع «", m(f.text), `» في الموضع ${at} (يجب أن يكون كل بديل معادلة)`];
    case "token":
      return [`لم يُتوقَّع رمز في الموضع ${at}`];
  }
}

function parseErrorAr(e: ParseError): Part[] {
  switch (e.kind) {
    case "empty":
      return ["السطر فارغ"];
    case "unexpected":
      return foundAr(e.found, e.at);
    case "twoUnknowns":
      return ["في السطر مجهولان (", m(e.a), " و", m(e.b), ")، والمدعوم مجهول واحد"];
    case "exponentNotInteger":
      return [`يجب أن يكون الأس في الموضع ${e.at} عددًا صحيحًا`];
    case "exponentTooLarge":
      return [`الأس في الموضع ${e.at} كبير جدًّا`];
    case "divisionByZero":
      return ["قسمة على صفر"];
    case "tooManyEquals":
      return ["أكثر من علامة «", m("="), "» واحدة"];
  }
}

function errorAr(e: EngineError): Rich {
  switch (e.kind) {
    case "parse":
      return [`السطر ${e.line}: `, ...parseErrorAr(e.error)];
    case "kindMismatch":
      return ["أحد السطرين معادلة والآخر عبارة"];
    case "differentUnknowns":
      return ["يستخدم السطران مجهولين مختلفين (", m(e.a), " و", m(e.b), ")"];
    case "unknown":
      // A message in a form this app cannot read is English, so it is not
      // shown; the badge already says the line could not be read.
      return ["تعذّرت قراءة السطر"];
  }
}

function explainAr(c: Check, subject: Subject): Rich {
  if (c.kind === "error") return errorAr(c.error ?? { kind: "unknown", text: c.explanation });
  const out: Part[] = [];
  if (c.kind === "equivalent") out.push("صحيح: تحافظ الخطوة على الحلول نفسها.");
  else if (c.kind === "not_equal")
    out.push("العبارتان غير متساويتين: عند ", m(`x = ${c.witness}`), " تساوي الأولى ", m(c.before), " والثانية ", m(c.after), ".");
  else {
    const step = subject === "step";
    const who = step ? "هذه الخطوة" : "الإجابة المعلنة";
    const clauses: Part[][] = [];
    if (c.lostInfinitelyMany)
      clauses.push(
        step
          ? ["يتحقق السطر الأول لكل ", X, " في مجاله، ولا يتحقق السطر الثاني"]
          : ["تتحقق المعادلة لكل ", X, " في مجالها، ولا تتحقق الإجابة المعلنة"],
      );
    if (c.gainedInfinitelyMany)
      clauses.push(
        step
          ? ["يتحقق السطر الثاني لكل ", X, " في مجاله، ولا يتحقق السطر الأول"]
          : ["تتحقق الإجابة المعلنة لكل ", X, " في مجالها، ولا تتحقق المعادلة"],
      );
    if (c.lost.length > 0) clauses.push([`تفقد ${who} ${solutionsAr(c.lost.length)} `, ...roots(c.lost, "، ")]);
    if (c.gained.length > 0)
      clauses.push([
        `تضيف ${who} ${solutionsAr(c.gained.length)} `,
        ...roots(c.gained, "، "),
        `، ${notSolutionAr(c.gained.length)} ${step ? "للسطر السابق" : "للمعادلة"}`,
      ]);
    out.push(...joined(clauses, "؛ "), ".");
  }
  if (subject === "step") {
    if (c.domainWidenedAt.length > 0)
      out.push(" السطر الجديد معرَّف عند ", ...roots(c.domainWidenedAt, "، "), "، حيث لم يكن السطر السابق معرَّفًا؛ فاحتفظ بهذا القيد.");
    if (c.domainNarrowedAt.length > 0) out.push(" السطر الجديد غير معرَّف عند ", ...roots(c.domainNarrowedAt, "، "), ".");
  }
  return out;
}

const en = {
  title: "Themis Steps",
  tagline: "Checks each line of your algebra against the previous one",
  language: "Language",
  theme: "Theme",
  light: "Light",
  dark: "Dark",
  tabs: { working: "Check your working", examples: "Worked examples", audit: "Audit exercises" },
  problem: "Equation or expression to start from",
  nextLine: "Next line",
  nextHint: "Press Enter to check. Write answers as x = 2 or x = 3, or x = ±3.",
  removeLast: "Remove last line",
  startOver: "Start over",
  undo: "Undo",
  lineRemoved: (n: number) => `Line ${n} removed.`,
  startedOver: "Started over: every line after the first was removed.",
  lineRestored: (n: number) => `Line ${n} restored.`,
  workingRestored: "Your working was restored.",
  correct: "Correct",
  wrong: "Changes the solutions",
  notEqual: "Not equal",
  cannotRead: "Cannot read this line",
  start: "Start",
  checkedIn: (ms: string) => `checked in ${ms} ms`,
  explain: explainEn,
  /** A line of maths as shown, with the words between alternatives in this
   * language; the engine is given the line as written (see toEngine). */
  showLine: (line: string) => line,
  /** Between the values of a list of solutions. */
  listSeparator: ", ",
  examplesIntro: "Each worked solution is checked line by line; in the ones with a mistake, the engine finds the step.",
  exampleTitles: {
    factorising: "Factorising a quadratic",
    dividing: "Dividing by the unknown",
    lastLine: "The last line",
    moving: "Moving a term across",
    notThere: "A root that is not there",
    clearing: "Clearing a fraction, correctly",
  },
  firstMistake: (n: number) => `First mistake: line ${n}`,
  allCorrect: "Every step is correct",
  auditIntro:
    "A set of generated exercises with their stated answers. Each answer is checked against the exact solutions of its equation.",
  exercise: "Exercise",
  stated: "Stated answer",
  actual: "Actual solutions",
  verdict: "Verdict",
  none: "no real solution",
  every: ["every ", X, " in the domain"] as Rich,
  auditSummary: (ok: number, n: number) => `${ok} of ${n} stated answers are correct`,
  answerOk: "Answer correct",
  answerWrong: "Answer wrong",
  loading: "Loading the engine…",
  loadFailed: "The engine could not be loaded. Check your connection and try again.",
  retry: "Try again",
  technicalDetails: "Technical details",
};

const ar: typeof en = {
  title: "ثيميس",
  tagline: "يتحقق من كل سطر في حلّك الجبري مقارنةً بالسطر السابق",
  language: "اللغة",
  theme: "المظهر",
  light: "فاتح",
  dark: "داكن",
  tabs: { working: "تحقّق من حلّك", examples: "أمثلة محلولة", audit: "تدقيق التمارين" },
  problem: "المعادلة أو العبارة التي تبدأ منها",
  nextLine: "السطر التالي",
  nextHint: `اضغط مفتاح الإدخال للتحقق. اكتب الإجابات هكذا: ${ltr("x = 2 أو x = 3")}، أو ${ltr("x = ±3")}.`,
  removeLast: "احذف السطر الأخير",
  startOver: "ابدأ من جديد",
  undo: "تراجع",
  lineRemoved: (n: number) => `حُذف السطر ${n}.`,
  startedOver: "البدء من جديد: حُذفت كل الأسطر بعد السطر الأول.",
  lineRestored: (n: number) => `استُعيد السطر ${n}.`,
  workingRestored: "استُعيد حلّك.",
  correct: "صحيح",
  wrong: "يغيّر الحلول",
  notEqual: "غير متساويين",
  cannotRead: "تعذّرت قراءة هذا السطر",
  start: "البداية",
  checkedIn: (ms: string) => `تم التحقق خلال ${ms} ملّي ثانية`,
  explain: explainAr,
  showLine: (line: string) => line.replace(/\s+or\s+/giu, " أو ").replace(/,\s*/gu, "، ").replace(/;\s*/gu, "؛ "),
  listSeparator: "، ",
  examplesIntro: "يُتحقَّق من كل حلّ سطرًا بسطر؛ وفي الحلول التي تحتوي خطأً يجد المحرّك الخطوة الخاطئة.",
  exampleTitles: {
    factorising: "تحليل معادلة من الدرجة الثانية",
    dividing: "القسمة على المجهول",
    lastLine: "السطر الأخير",
    moving: "نقل حدّ إلى الطرف الآخر",
    notThere: "جذر غير موجود",
    clearing: "التخلص من الكسر بشكل صحيح",
  },
  firstMistake: (n: number) => `أول خطأ: السطر ${n}`,
  allCorrect: "كل الخطوات صحيحة",
  auditIntro: "مجموعة تمارين مولّدة مع إجاباتها المعلنة. تُقارَن كل إجابة بالحلول الدقيقة لمعادلتها.",
  exercise: "التمرين",
  stated: "الإجابة المعلنة",
  actual: "الحلول الفعلية",
  verdict: "النتيجة",
  none: "لا يوجد حل حقيقي",
  every: ["كل ", X, " في المجال"],
  // The counted noun is plural after 3 to 10 and singular after 11 and up.
  auditSummary: (ok: number, n: number) => `${ok} من ${n} ${n >= 3 && n <= 10 ? "إجابات معلنة صحيحة" : "إجابة معلنة صحيحة"}`,
  answerOk: "الإجابة صحيحة",
  answerWrong: "الإجابة خاطئة",
  loading: "جارٍ تحميل المحرّك…",
  loadFailed: "تعذّر تحميل المحرّك. تحقّق من اتصالك ثم أعد المحاولة.",
  retry: "أعد المحاولة",
  technicalDetails: "تفاصيل تقنية",
};

export const strings = { en, ar };
export type Strings = typeof en;

/** Small safe calculator for the sale / expense keypad (no eval). */

export type Op = '+' | '-' | '*' | '/';

const OPS = '+-*/';

export const isOp = (ch: string) => ch.length === 1 && OPS.includes(ch);

type Term = { value: number; percent: boolean };

/** Split "12+3.5*4%" into numbers and operators. Returns null when it is not a valid expression. */
function tokenize(expr: string): { terms: Term[]; ops: Op[] } | null {
  const terms: Term[] = [];
  const ops: Op[] = [];
  let i = 0;
  while (i < expr.length) {
    let j = i;
    while (j < expr.length && /[0-9.]/.test(expr[j])) j++;
    if (j === i) return null;
    const raw = expr.slice(i, j);
    if ((raw.match(/\./g) ?? []).length > 1) return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) return null;
    let percent = false;
    if (expr[j] === '%') {
      percent = true;
      j++;
    }
    terms.push({ value, percent });
    i = j;
    if (i < expr.length) {
      const op = expr[i];
      if (!isOp(op)) return null;
      ops.push(op as Op);
      i++;
      if (i >= expr.length) break; // trailing operator is ignored
    }
  }
  return { terms, ops };
}

function evalPlain(values: number[], ops: Op[]): number {
  // * and / first, then + and -
  const nums = [values[0]];
  const rest: Op[] = [];
  for (let k = 0; k < ops.length; k++) {
    const next = values[k + 1];
    if (ops[k] === '*') nums[nums.length - 1] *= next;
    else if (ops[k] === '/') nums[nums.length - 1] /= next;
    else {
      rest.push(ops[k]);
      nums.push(next);
    }
  }
  let total = nums[0];
  for (let k = 0; k < rest.length; k++) total = rest[k] === '+' ? total + nums[k + 1] : total - nums[k + 1];
  return total;
}

/**
 * Evaluate an expression. Percent works like a phone calculator:
 *   1500-10%  -> 1350   (10% of what is on the left of the + or -)
 *   200*10%   -> 20
 * Returns null for empty / invalid input or division by zero.
 */
export function evaluate(expr: string): number | null {
  if (!expr) return null;
  const parsed = tokenize(expr);
  if (!parsed || parsed.terms.length === 0) return null;
  const { terms, ops } = parsed;
  const values: number[] = [];
  for (let k = 0; k < terms.length; k++) {
    const term = terms[k];
    if (!term.percent) {
      values.push(term.value);
      continue;
    }
    const before = k > 0 ? ops[k - 1] : null;
    if (before === '+' || before === '-') {
      const left = evalPlain(values.slice(), ops.slice(0, k - 1));
      values.push((left * term.value) / 100);
    } else {
      values.push(term.value / 100);
    }
  }
  const result = evalPlain(values, ops.slice(0, values.length - 1));
  return Number.isFinite(result) ? result : null;
}

/** "1234.5" -> "1,234.5" (keeps a trailing dot while typing). */
export function groupNumber(raw: string): string {
  const [int, dec] = raw.split('.');
  const grouped = (int || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec === undefined ? grouped : `${grouped}.${dec}`;
}

export function formatResult(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return groupNumber(String(Math.abs(rounded))).replace(/^/, rounded < 0 ? '-' : '');
}

/** What the screens receive: a plain number string, or '' when nothing sellable yet. */
export function amountString(expr: string): string {
  const v = evaluate(expr);
  if (v === null || v <= 0) return '';
  return String(Math.round(v * 100) / 100);
}

export const OP_SYMBOL: Record<Op, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };

export function prettyExpression(expr: string): string {
  return expr.replace(/[+\-*/]/g, (ch) => ` ${OP_SYMBOL[ch as Op]} `).replace(/[0-9.]+/g, (n) => groupNumber(n));
}

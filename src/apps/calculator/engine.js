export const SYMBOL = { '+': '+', '-': '−', '*': '×', '/': '÷' };
const RANK = { '+': 1, '-': 1, '*': 2, '/': 2 };
const MAX_DIGITS = 15;
const PRECISION = 12;

function clean(value) {
  if (!Number.isFinite(value)) return value;
  const fixed = Number(value.toPrecision(PRECISION));
  return Object.is(fixed, -0) ? 0 : fixed;
}

export function evaluate(tokens) {
  const values = [];
  const ops = [];
  const apply = () => {
    const op = ops.pop();
    const b = values.pop();
    const a = values.pop();
    if (op === '/' && b === 0) throw new RangeError('divide-by-zero');
    values.push(clean(op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : a / b));
  };
  tokens.forEach((token) => {
    if (typeof token === 'number') {
      values.push(token);
      return;
    }
    while (ops.length && RANK[ops[ops.length - 1]] >= RANK[token]) apply();
    ops.push(token);
  });
  while (ops.length) apply();
  return values.length ? clean(values[0]) : 0;
}

function group(digits) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatNumber(value) {
  if (!Number.isFinite(value)) return '錯誤';
  if (value === 0) return '0';
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 1e15 || abs < 1e-9) {
    const [mantissa, exponent] = abs.toExponential(6).split('e');
    return `${sign}${String(Number(mantissa))}e${Number(exponent)}`;
  }
  const text = String(clean(abs));
  if (text.includes('e')) return `${sign}${abs.toExponential(6)}`;
  const [whole, fraction] = text.split('.');
  return `${sign}${group(whole)}${fraction ? `.${fraction}` : ''}`;
}

export function formatEntry(entry) {
  const negative = entry.startsWith('-');
  const body = negative ? entry.slice(1) : entry;
  const [whole, fraction] = body.split('.');
  return `${negative ? '−' : ''}${group(whole || '0')}${body.includes('.') ? `.${fraction}` : ''}`;
}

export function expressionText(tokens) {
  return tokens.map((token) => (typeof token === 'number' ? formatNumber(token) : SYMBOL[token])).join(' ');
}

export function createCalculator() {
  let tokens = [];
  let entry = '0';
  let typing = false;
  let result = null;
  let lastExpression = '';
  let repeat = null;
  let error = null;

  function reset() {
    tokens = [];
    entry = '0';
    typing = false;
    result = null;
    lastExpression = '';
    repeat = null;
    error = null;
  }

  function startFresh() {
    if (error || result !== null) {
      const keep = error ? null : result;
      reset();
      return keep;
    }
    return null;
  }

  function digit(d) {
    startFresh();
    if (!typing) {
      entry = d;
      typing = true;
      return;
    }
    if (entry.replace(/[-.]/g, '').length >= MAX_DIGITS) return;
    entry = entry === '0' ? d : entry === '-0' ? `-${d}` : entry + d;
  }

  function decimal() {
    startFresh();
    if (!typing) {
      entry = '0.';
      typing = true;
      return;
    }
    if (!entry.includes('.')) entry += '.';
  }

  function operator(op) {
    if (error) return;
    if (result !== null) {
      tokens = [result];
      result = null;
      lastExpression = '';
      repeat = null;
      typing = false;
    } else if (typing || tokens.length === 0) {
      tokens.push(Number(entry));
      typing = false;
    }
    if (typeof tokens[tokens.length - 1] === 'string') tokens[tokens.length - 1] = op;
    else tokens.push(op);
  }

  function equals() {
    if (error) {
      reset();
      return null;
    }
    let run;
    if (result !== null) {
      if (!repeat) return null;
      run = [result, repeat.op, repeat.value];
    } else {
      run = tokens.slice();
      if (typing || run.length === 0 || typeof run[run.length - 1] === 'string') run.push(Number(entry));
      if (run.length === 1) return null;
      if (typeof run[run.length - 1] === 'string') run.pop();
      repeat = { op: run[run.length - 2], value: run[run.length - 1] };
    }
    try {
      const value = evaluate(run);
      lastExpression = expressionText(run);
      result = value;
      tokens = [];
      typing = false;
      entry = String(value);
      return { expression: lastExpression, result: value };
    } catch (err) {
      error = '除數不能是 0';
      tokens = [];
      typing = false;
      result = null;
      return null;
    }
  }

  function percent() {
    if (error) return;
    const current = result !== null ? result : Number(entry);
    const op = tokens[tokens.length - 1];
    let value = current / 100;
    if (result === null && (op === '+' || op === '-') && tokens.length >= 2) {
      value = evaluate(tokens.slice(0, -1)) * (current / 100);
    }
    value = clean(value);
    if (result !== null) {
      result = value;
      lastExpression = '';
      repeat = null;
    }
    entry = String(value);
    typing = true;
  }

  function toggleSign() {
    if (error) return;
    if (result !== null) {
      result = clean(-result);
      entry = String(result);
      lastExpression = '';
      repeat = null;
      return;
    }
    if (!typing) {
      entry = '-0';
      typing = true;
      return;
    }
    entry = entry.startsWith('-') ? entry.slice(1) : `-${entry}`;
  }

  function backspace() {
    if (error) {
      reset();
      return;
    }
    if (result !== null || !typing) return;
    entry = entry.slice(0, -1);
    if (entry === '' || entry === '-') {
      entry = '0';
      typing = false;
    }
  }

  function clear() {
    if (typing && entry !== '0' && result === null && !error) {
      entry = '0';
      return 'entry';
    }
    reset();
    return 'all';
  }

  function recall(value) {
    if (error || result !== null) reset();
    entry = String(value);
    typing = true;
  }

  function view() {
    if (error) return { expression: '', display: '0', error, pending: null, result: null, canClearEntry: false };
    const pending = typeof tokens[tokens.length - 1] === 'string' && !typing ? tokens[tokens.length - 1] : null;
    let display;
    if (result !== null) display = formatNumber(result);
    else if (typing) display = formatEntry(entry);
    else if (tokens.length) display = formatNumber([...tokens].reverse().find((t) => typeof t === 'number') ?? 0);
    else display = formatEntry(entry);
    const expression = result !== null ? `${lastExpression} =` : expressionText(tokens);
    return {
      expression: result !== null && !lastExpression ? '' : expression,
      display,
      error: null,
      pending,
      result,
      canClearEntry: typing && entry !== '0' && result === null,
    };
  }

  return { digit, decimal, operator, equals, percent, toggleSign, backspace, clear, recall, reset, view };
}

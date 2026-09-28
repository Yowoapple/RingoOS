import { Desktop } from '../../system/desktop.js';

const MAX_SIG_DIGITS = 10;

const OP_SYMBOL = { '+': '＋', '-': '－', '*': '×', '/': '÷' };

function formatNumber(num) {
  if (!isFinite(num)) return 'Error';
  if (num === 0) return '0';

  const rounded = Number(num.toPrecision(MAX_SIG_DIGITS));
  let str = rounded.toString();

  const plainLength = str.replace('-', '').replace('.', '').replace('e', '').length;
  if (plainLength > 12 || str.includes('e')) {
    str = rounded.toExponential(5).replace(/e\+?(-?)(\d+)/, 'e$1$2');
  }
  return str;
}

function compute(a, b, op) {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return b === 0 ? NaN : a / b;
    default: return b;
  }
}

function createCalculatorState() {
  let currentInput = '0';
  let previousValue = null;
  let pendingOperator = null;
  let overwrite = true;
  let isError = false;

  function reset() {
    currentInput = '0';
    previousValue = null;
    pendingOperator = null;
    overwrite = true;
    isError = false;
  }

  function inputDigit(digit) {
    if (isError) reset();
    if (overwrite) {
      currentInput = digit === '.' ? '0.' : digit;
      overwrite = false;
    } else if (currentInput.length < 16) {
      if (currentInput === '0' && digit !== '.') currentInput = digit;
      else currentInput += digit;
    }
  }

  function inputDecimal() {
    if (isError) reset();
    if (overwrite) {
      currentInput = '0.';
      overwrite = false;
    } else if (!currentInput.includes('.')) {
      currentInput += '.';
    }
  }

  function inputOperator(op) {
    if (isError) reset();
    const inputValue = parseFloat(currentInput);

    if (previousValue !== null && pendingOperator && !overwrite) {
      const result = compute(previousValue, inputValue, pendingOperator);
      if (!isFinite(result)) { isError = true; previousValue = null; pendingOperator = null; return; }
      previousValue = result;
    } else {
      previousValue = inputValue;
    }
    pendingOperator = op;
    overwrite = true;
  }

  function equals() {
    if (isError) { reset(); return; }
    if (pendingOperator === null || previousValue === null) return;
    const inputValue = parseFloat(currentInput);
    const result = compute(previousValue, inputValue, pendingOperator);

    if (!isFinite(result)) {
      isError = true;
      previousValue = null;
      pendingOperator = null;
      currentInput = '0';
      overwrite = true;
      return;
    }

    currentInput = formatNumber(result);
    previousValue = null;
    pendingOperator = null;
    overwrite = true;
  }

  function toggleSign() {
    if (isError) { reset(); return; }
    const value = parseFloat(currentInput);
    if (value !== 0) currentInput = String(value * -1);
  }

  function percent() {
    if (isError) { reset(); return; }
    currentInput = String(parseFloat(currentInput) / 100);
    overwrite = true;
  }

  function backspace() {
    if (isError) { reset(); return; }
    if (overwrite) return;
    currentInput = currentInput.length > 1 ? currentInput.slice(0, -1) : '0';
    if (currentInput === '' || currentInput === '-') currentInput = '0';
  }

  function getDisplay() {
    if (isError) {
      return { expression: '', result: '除數不能是 0', isError: true };
    }
    const expression = pendingOperator
      ? `${formatNumber(previousValue)} ${OP_SYMBOL[pendingOperator]}`
      : '';
    const result = overwrite && previousValue !== null
      ? formatNumber(previousValue)
      : currentInput;
    return { expression, result, isError: false };
  }

  return { reset, inputDigit, inputDecimal, inputOperator, equals, toggleSign, percent, backspace, getDisplay };
}

export const CalculatorEngine = { formatNumber, compute, createCalculatorState };

function initCalculator() {
  const windowEl = document.querySelector('.calculator');
  const expressionEl = document.getElementById('calculator-expression');
  const resultEl = document.getElementById('calculator-result');
  if (!windowEl || !expressionEl || !resultEl) return;

  const state = createCalculatorState();

  function render() {
    const { expression, result, isError } = state.getDisplay();
    expressionEl.textContent = expression;
    resultEl.textContent = result;
    resultEl.classList.toggle('is-error', isError);
  }

  function flashKey(keyEl) {
    if (!keyEl) return;
    keyEl.classList.add('is-pressed');
    window.setTimeout(() => keyEl.classList.remove('is-pressed'), 120);
  }

  windowEl.querySelectorAll('[data-calc-digit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.inputDigit(btn.dataset.calcDigit);
      render();
    });
  });

  windowEl.querySelectorAll('[data-calc-op]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.inputOperator(btn.dataset.calcOp);
      render();
    });
  });

  windowEl.querySelectorAll('[data-calc-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.calcAction;
      if (action === 'clear') state.reset();
      else if (action === 'toggle-sign') state.toggleSign();
      else if (action === 'percent') state.percent();
      else if (action === 'decimal') state.inputDecimal();
      else if (action === 'equals') state.equals();
      render();
    });
  });

  function isCalculatorActive() {
    if (!Desktop.isFocused('calculator')) return false;
    const active = document.activeElement;
    if (active) {
      const tag = active.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || active.isContentEditable) return false;
    }
    return true;
  }

  const KEY_TO_DIGIT_BTN = {};
  windowEl.querySelectorAll('[data-calc-digit]').forEach((btn) => { KEY_TO_DIGIT_BTN[btn.dataset.calcDigit] = btn; });
  const KEY_TO_OP_BTN = {};
  windowEl.querySelectorAll('[data-calc-op]').forEach((btn) => { KEY_TO_OP_BTN[btn.dataset.calcOp] = btn; });
  const equalsBtn = windowEl.querySelector('[data-calc-action="equals"]');
  const clearBtn = windowEl.querySelector('[data-calc-action="clear"]');
  const decimalBtn = windowEl.querySelector('[data-calc-action="decimal"]');
  const percentBtn = windowEl.querySelector('[data-calc-action="percent"]');

  document.addEventListener('keydown', (event) => {
    if (!isCalculatorActive()) return;

    if (/^[0-9]$/.test(event.key)) {
      state.inputDigit(event.key);
      flashKey(KEY_TO_DIGIT_BTN[event.key]);
    } else if (event.key === '.') {
      state.inputDecimal();
      flashKey(decimalBtn);
    } else if (event.key === '+' || event.key === '-' || event.key === '/' || event.key.toLowerCase() === 'x' || event.key === '*') {
      const op = event.key.toLowerCase() === 'x' ? '*' : event.key;
      state.inputOperator(op);
      flashKey(KEY_TO_OP_BTN[op]);
    } else if (event.key === 'Enter' || event.key === '=') {
      state.equals();
      flashKey(equalsBtn);
    } else if (event.key === 'Escape' || event.key.toLowerCase() === 'c') {
      state.reset();
      flashKey(clearBtn);
    } else if (event.key === 'Backspace') {
      state.backspace();
    } else if (event.key === '%') {
      state.percent();
      flashKey(percentBtn);
    } else {
      return;
    }
    event.preventDefault();
    render();
  });

  render();

}

export function boot() {
  try {
    initCalculator();
  } catch (err) {
    console.error('Life Ledger：計算機初始化失敗（不影響其他功能）', err);
  }
}

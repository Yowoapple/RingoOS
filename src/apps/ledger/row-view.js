import { formatAmount } from '../../ui/odometer.js';

const RECURRING = '<svg viewBox="0 0 12 12"><path d="M9.3 4.4A3.6 3.6 0 0 0 2.6 5M2.7 7.6a3.6 3.6 0 0 0 6.7.6M9.5 2.6v1.9H7.6M2.5 9.4V7.5h1.9" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const OUT = '<svg viewBox="0 0 12 12"><path d="M10 6H2.5M5.2 3.2 2.4 6l2.8 2.8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const IN = '<svg viewBox="0 0 12 12"><path d="M2 6h7.5M6.8 3.2 9.6 6 6.8 8.8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function transferNote(row) {
  if (row.signed < 0) return '從目標取出';
  return row.transferType === 'auto' ? '每月自動存入' : '存到目標';
}

export function renderEntryRow(row, { prefix = '' } = {}) {
  const holder = document.createElement('template');
  holder.innerHTML = '<span class="lg-mark" aria-hidden="true"></span><span class="row__main"><span class="row__cat"></span><span class="row__note"></span></span><span class="row__amt mono"></span>';
  const fragment = holder.content;
  const mark = fragment.querySelector('.lg-mark');
  const cat = fragment.querySelector('.row__cat');
  const note = fragment.querySelector('.row__note');
  const amt = fragment.querySelector('.row__amt');
  let noteText;
  if (row.type === 'transfer') {
    mark.classList.add('lg-mark--transfer');
    mark.innerHTML = row.signed < 0 ? OUT : IN;
    cat.textContent = row.goalTitle;
    noteText = transferNote(row);
    amt.textContent = formatAmount(row.amount);
  } else {
    if (row.recurring) {
      mark.classList.add('lg-mark--recurring');
      mark.innerHTML = RECURRING;
    } else if (row.necessity) {
      mark.classList.add(`lg-mark--${row.necessity}`);
    }
    cat.textContent = row.category;
    noteText = row.note || (row.recurring ? '固定支出' : '');
    amt.textContent = `${row.type === 'income' ? '+' : '−'}${formatAmount(row.amount)}`;
  }
  if (prefix) {
    const when = document.createElement('span');
    when.className = 'row__when mono';
    when.textContent = prefix;
    note.append(when);
    if (noteText) note.append(document.createTextNode(` · ${noteText}`));
  } else {
    note.textContent = noteText;
  }
  note.hidden = !note.textContent;
  return fragment;
}

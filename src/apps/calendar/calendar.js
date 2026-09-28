import { Calc } from '../../core/calculations.js';
import { Data } from '../../core/data-model.js';
import { Desktop } from '../../system/desktop.js';
import { qrcode } from '../../utils/qr.js';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

const DURATION_OPTIONS = [
  { value: '15', label: '15 分鐘' },
  { value: '30', label: '30 分鐘' },
  { value: '45', label: '45 分鐘' },
  { value: '60', label: '1 小時' },
  { value: '90', label: '1.5 小時' },
  { value: '120', label: '2 小時' },
  { value: '180', label: '3 小時' },
  { value: '240', label: '半天（4小時）' },
  { value: 'allday', label: '整天' },
];

const REMINDER_OPTIONS = [
  { value: 'none', label: '不提醒' },
  { value: '5M', label: '提前 5 分鐘' },
  { value: '10M', label: '提前 10 分鐘' },
  { value: '15M', label: '提前 15 分鐘' },
  { value: '30M', label: '提前 30 分鐘' },
  { value: '1H', label: '提前 1 小時' },
  { value: '2H', label: '提前 2 小時' },
  { value: '1D', label: '提前 1 天' },
  { value: '2D', label: '提前 2 天' },
  { value: '3D', label: '提前 3 天' },
  { value: '1W', label: '提前 1 週' },
  { value: '2W', label: '提前 2 週' },
];

const DEFAULT_DURATION_CHOICE = '30';
const DEFAULT_REMINDER_LEAD = '15M';

function getEffectiveDetail(task) {
  let durationChoice = task.durationChoice;
  if (durationChoice === undefined) {
    durationChoice = task.durationMinutes ? String(task.durationMinutes) : DEFAULT_DURATION_CHOICE;
  }
  let reminderLead = task.reminderLead;
  if (reminderLead === undefined) {
    if (task.reminderMinutes !== undefined) {
      reminderLead = task.reminderMinutes === null ? 'none' : `${task.reminderMinutes}M`;
    } else if (!task.time) {
      reminderLead = 'none';
    } else {
      reminderLead = DEFAULT_REMINDER_LEAD;
    }
  }
  return {
    location: task.location || '',
    description: task.description || '',
    durationChoice,
    reminderLead,
  };
}

function escapeICalText(str) {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function buildTriggerDuration(reminderLead) {
  if (!reminderLead || reminderLead === 'none') return null;
  const unit = reminderLead.slice(-1);
  const amount = reminderLead.slice(0, -1);
  if (unit === 'M' || unit === 'H') return `-PT${amount}${unit}`;
  return `-P${amount}${unit}`;
}

function buildVEventBlock(dateKey, task) {
  const detail = getEffectiveDetail(task);
  const [y, m, d] = dateKey.split('-');
  const now = new Date();
  const dtstamp = `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(now.getUTCDate())}T${pad2(now.getUTCHours())}${pad2(now.getUTCMinutes())}${pad2(now.getUTCSeconds())}Z`;
  const uid = `lifeledger-${dateKey.replace(/-/g, '')}-${Math.random().toString(36).slice(2, 8)}@lifeledger.local`;

  const isAllDay = !task.time || detail.durationChoice === 'allday';

  let dtStartLine;
  let dtEndLine;

  if (!isAllDay) {
    const durationMinutes = Number(detail.durationChoice);
    const [hh, mm] = task.time.split(':').map(Number);
    dtStartLine = `DTSTART:${y}${m}${d}T${pad2(hh)}${pad2(mm)}00`;
    const endDate = new Date(Number(y), Number(m) - 1, Number(d), hh, mm + durationMinutes);
    dtEndLine = `DTEND:${endDate.getFullYear()}${pad2(endDate.getMonth() + 1)}${pad2(endDate.getDate())}T${pad2(endDate.getHours())}${pad2(endDate.getMinutes())}00`;
  } else {
    const endDate = new Date(Number(y), Number(m) - 1, Number(d) + 1);
    dtStartLine = `DTSTART;VALUE=DATE:${y}${m}${d}`;
    dtEndLine = `DTEND;VALUE=DATE:${endDate.getFullYear()}${pad2(endDate.getMonth() + 1)}${pad2(endDate.getDate())}`;
  }

  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    dtStartLine,
    dtEndLine,
    `SUMMARY:${escapeICalText(task.text)}`,
  ];
  if (detail.location.trim()) lines.push(`LOCATION:${escapeICalText(detail.location.trim())}`);
  if (detail.description.trim()) lines.push(`DESCRIPTION:${escapeICalText(detail.description.trim())}`);

  const trigger = buildTriggerDuration(detail.reminderLead);
  if (trigger) {
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:提醒', `TRIGGER:${trigger}`, 'END:VALARM');
  }
  lines.push('END:VEVENT');
  return lines;
}

function wrapVCalendar(veventLines) {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LifeLedger//Calendar//ZH', ...veventLines, 'END:VCALENDAR'].join('\r\n');
}

function buildICalText(dateKey, task) {
  return wrapVCalendar(buildVEventBlock(dateKey, task));
}

function buildCombinedICalText(dateKey, tasks) {
  const body = tasks.flatMap((task) => buildVEventBlock(dateKey, task));
  return wrapVCalendar(body);
}

function buildQrSvg(dataStr) {
  if (typeof qrcode !== 'function') {
    return '<div style="padding:16px;font-size:12px;color:#999;">QR 函式庫載入失敗</div>';
  }
  const qr = qrcode(0, 'M');
  qr.addData(dataStr);
  qr.make();

  const count = qr.getModuleCount();
  const margin = 2;
  const size = count + margin * 2;

  let rects = '';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) {
        rects += `<rect x="${c + margin}" y="${r + margin}" width="1" height="1"/>`;
      }
    }
  }

  return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">` +
    `<rect width="${size}" height="${size}" fill="white"/>` +
    `<g fill="black">${rects}</g></svg>`;
}

function buildIcsFilename(text, dateKey) {
  const safe = String(text).replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 20) || '代辦事項';
  return `${safe}-${dateKey}.ics`;
}

function downloadIcs(icalText, filename) {
  const blob = new Blob([icalText], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

let currentQrOverlay = null;

function closeReminderModal() {
  if (currentQrOverlay) {
    currentQrOverlay.remove();
    currentQrOverlay = null;
  }
}

function showReminderModal(dateKey, task) {
  closeReminderModal();

  const icalText = buildICalText(dateKey, task);
  const svgMarkup = buildQrSvg(icalText);

  const [, m, d] = dateKey.split('-').map(Number);
  const dateLabel = `${m}月${d}日`;
  const timeLabel = task.time ? task.time : '整天';

  const overlay = document.createElement('div');
  overlay.className = 'calendar-qr-overlay';

  const card = document.createElement('div');
  card.className = 'calendar-qr-card';

  const metaEl = document.createElement('div');
  metaEl.className = 'calendar-qr-card__meta';
  metaEl.textContent = `${task.text} · ${dateLabel} ${timeLabel}`;

  const bodyEl = document.createElement('div');
  bodyEl.className = 'calendar-qr-card__body';

  const imageWrap = document.createElement('div');
  imageWrap.className = 'calendar-qr-card__image';
  imageWrap.innerHTML = svgMarkup;

  const actionsEl = document.createElement('div');
  actionsEl.className = 'calendar-qr-card__actions';

  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'btn btn--secondary btn--sm';
  downloadBtn.textContent = '下載 .ics';
  downloadBtn.dataset.noDrag = '';
  downloadBtn.addEventListener('click', () => downloadIcs(icalText, buildIcsFilename(task.text, dateKey)));

  actionsEl.appendChild(downloadBtn);
  bodyEl.appendChild(imageWrap);
  bodyEl.appendChild(actionsEl);

  const hintEl = document.createElement('div');
  hintEl.className = 'calendar-qr-card__hint';
  hintEl.textContent = '左邊掃碼，或右邊下載檔案';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn btn--secondary btn--sm calendar-qr-card__close';
  closeBtn.textContent = '關閉';
  closeBtn.dataset.noDrag = '';
  closeBtn.addEventListener('click', closeReminderModal);

  card.appendChild(metaEl);
  card.appendChild(bodyEl);
  card.appendChild(hintEl);
  card.appendChild(closeBtn);
  overlay.appendChild(card);

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeReminderModal();
  });

  document.addEventListener('keydown', function escHandler(event) {
    if (event.key === 'Escape') {
      closeReminderModal();
      document.removeEventListener('keydown', escHandler);
    }
  });

  document.body.appendChild(overlay);
  currentQrOverlay = overlay;
}

function initCalendar() {
  if (!Data || !Calc) {
    console.error('Life Ledger：找不到 data-model.js 或 calculations.js，日曆功能無法運作');
    return;
  }

  const windowEl = document.querySelector('.calendar');
  const monthLabelEl = document.getElementById('calendar-month-label');
  const gridEl = document.getElementById('calendar-grid');
  const bannerEl = document.getElementById('calendar-upcoming-banner');
  const dayPanelEl = document.getElementById('calendar-day-panel');
  const dayPanelTitleEl = document.getElementById('calendar-day-panel-title');
  const taskListEl = document.getElementById('calendar-task-list');
  const taskInputEl = document.getElementById('calendar-task-input');
  const taskTimeInputEl = document.getElementById('calendar-task-time-input');
  const taskAddBtn = document.getElementById('calendar-task-add-btn');
  const closePanelBtn = document.querySelector('[data-calendar-close-panel]');
  const prevBtn = document.querySelector('[data-calendar-nav="prev"]');
  const nextBtn = document.querySelector('[data-calendar-nav="next"]');
  const todayBtn = document.querySelector('[data-calendar-today]');
  const exportToggleBtn = document.getElementById('calendar-export-toggle-btn');
  const exportBarEl = document.getElementById('calendar-export-bar');
  const exportCountEl = document.getElementById('calendar-export-count');
  const exportGenerateBtn = document.getElementById('calendar-export-generate-btn');
  const exportCancelBtn = document.getElementById('calendar-export-cancel-btn');

  if (!windowEl || !monthLabelEl || !gridEl || !dayPanelEl) return;

  const today = new Date();
  const todayKey = Data.toDateKey(today);

  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth();
  let selectedDateKey = null;
  let expandedTaskId = null;
  let exportMode = false;
  let exportSelectedIds = new Set();

  function renderUpcoming() {
    const summary = Calc.getUpcomingTaskSummary();

    Desktop.setBadge('calendar', summary.count);

    bannerEl.innerHTML = '';
    if (summary.count === 0) {
      bannerEl.hidden = true;
      return;
    }
    bannerEl.hidden = false;

    summary.days.forEach((day) => {
      const [, m, d] = day.dateKey.split('-').map(Number);
      const label = day.isToday ? '今天' : `${m}月${d}日`;
      const pill = document.createElement('span');
      pill.className = 'calendar__upcoming-pill';
      pill.textContent = `${label}：${day.pendingCount} 件代辦未完成`;
      bannerEl.appendChild(pill);
    });
  }

  function renderGrid() {
    monthLabelEl.textContent = `${viewYear}年${viewMonth + 1}月`;
    gridEl.innerHTML = '';

    const urgentSummary = Calc.getUpcomingTaskSummary();
    const urgentDateKeys = new Set(urgentSummary.days.map((day) => day.dateKey));

    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const leadingBlanks = firstOfMonth.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const totalCells = Math.ceil((leadingBlanks + daysInMonth) / 7) * 7;

    for (let i = 0; i < totalCells; i++) {
      const cellDate = new Date(viewYear, viewMonth, 1 - leadingBlanks + i);
      const dateKey = Data.toDateKey(cellDate);
      const isOutside = cellDate.getMonth() !== viewMonth;
      const isToday = dateKey === todayKey;
      const isSelected = dateKey === selectedDateKey;
      const indicators = Data.getDayIndicators(dateKey);

      const cellEl = document.createElement('div');
      cellEl.className = 'calendar__cell';
      if (isOutside) cellEl.classList.add('calendar__cell--outside');
      if (isToday) cellEl.classList.add('calendar__cell--today');
      if (isSelected) cellEl.classList.add('calendar__cell--selected');
      if (urgentDateKeys.has(dateKey)) cellEl.classList.add('calendar__cell--urgent');
      cellEl.dataset.dateKey = dateKey;

      const numberEl = document.createElement('span');
      numberEl.textContent = String(cellDate.getDate());
      cellEl.appendChild(numberEl);

      const dotsEl = document.createElement('div');
      dotsEl.className = 'calendar__cell-dots';
      if (indicators.hasMoney) {
        const dot = document.createElement('span');
        dot.className = 'calendar__dot';
        dotsEl.appendChild(dot);
      }
      if (indicators.taskTotal > 0) {
        const dot = document.createElement('span');
        dot.className = 'calendar__dot calendar__dot--task';
        dotsEl.appendChild(dot);
      }
      cellEl.appendChild(dotsEl);

      cellEl.addEventListener('click', () => selectDate(dateKey));
      gridEl.appendChild(cellEl);
    }
  }

  function selectDate(dateKey) {
    selectedDateKey = dateKey;
    expandedTaskId = null;
    exportMode = false;
    exportSelectedIds = new Set();

    const [y, m] = dateKey.split('-').map(Number);
    if (y !== viewYear || (m - 1) !== viewMonth) {
      viewYear = y;
      viewMonth = m - 1;
    }

    renderGrid();
    openDayPanel(dateKey);
  }

  function openDayPanel(dateKey) {
    const [, m, d] = dateKey.split('-').map(Number);
    const weekday = WEEKDAY_LABELS[new Date(dateKey + 'T00:00:00').getDay()];
    dayPanelTitleEl.textContent = `${m}月${d}日（週${weekday}）`;
    dayPanelEl.hidden = false;
    renderTaskList();
    taskInputEl.value = '';
    taskTimeInputEl.value = '';
  }

  function closeDayPanel() {
    selectedDateKey = null;
    dayPanelEl.hidden = true;
    renderGrid();
  }

  function buildDetailRow(dateKey, task) {
    const detail = getEffectiveDetail(task);

    const detailLi = document.createElement('li');
    detailLi.className = 'calendar__task-detail';

    const locationInput = document.createElement('input');
    locationInput.type = 'text';
    locationInput.className = 'field__input';
    locationInput.placeholder = '地點（選填）';
    locationInput.value = detail.location;
    locationInput.dataset.noDrag = '';
    locationInput.addEventListener('change', () => {
      Data.updateTaskDetails(dateKey, task.id, { location: locationInput.value });
    });

    const descriptionInput = document.createElement('textarea');
    descriptionInput.className = 'field__input calendar__task-detail-textarea';
    descriptionInput.placeholder = '備註（選填）';
    descriptionInput.rows = 2;
    descriptionInput.value = detail.description;
    descriptionInput.dataset.noDrag = '';
    descriptionInput.addEventListener('change', () => {
      Data.updateTaskDetails(dateKey, task.id, { description: descriptionInput.value });
    });

    detailLi.appendChild(locationInput);
    detailLi.appendChild(descriptionInput);

    if (task.time) {
      const durationSelect = document.createElement('select');
      durationSelect.className = 'field__input';
      durationSelect.dataset.noDrag = '';
      DURATION_OPTIONS.forEach((opt) => {
        const optionEl = document.createElement('option');
        optionEl.value = opt.value;
        optionEl.textContent = opt.label;
        if (opt.value === detail.durationChoice) optionEl.selected = true;
        durationSelect.appendChild(optionEl);
      });
      durationSelect.addEventListener('change', () => {
        Data.updateTaskDetails(dateKey, task.id, { durationChoice: durationSelect.value });
      });

      const selectRow = document.createElement('div');
      selectRow.className = 'calendar__task-detail-select-row';
      selectRow.appendChild(durationSelect);
      selectRow.appendChild(buildReminderSelect(dateKey, task, detail));
      detailLi.appendChild(selectRow);
    } else {
      const selectRow = document.createElement('div');
      selectRow.className = 'calendar__task-detail-select-row';
      selectRow.appendChild(buildReminderSelect(dateKey, task, detail));
      detailLi.appendChild(selectRow);
    }

    return detailLi;
  }

  function buildReminderSelect(dateKey, task, detail) {
    const reminderSelect = document.createElement('select');
    reminderSelect.className = 'field__input';
    reminderSelect.dataset.noDrag = '';
    REMINDER_OPTIONS.forEach((opt) => {
      const optionEl = document.createElement('option');
      optionEl.value = opt.value;
      optionEl.textContent = opt.label;
      if (opt.value === detail.reminderLead) optionEl.selected = true;
      reminderSelect.appendChild(optionEl);
    });
    reminderSelect.addEventListener('change', () => {
      Data.updateTaskDetails(dateKey, task.id, { reminderLead: reminderSelect.value });
    });
    return reminderSelect;
  }

  function renderTaskList() {
    if (!selectedDateKey) return;
    taskListEl.innerHTML = '';
    const tasks = Data.getDayTasks(selectedDateKey);

    tasks.forEach((task) => {
      const li = document.createElement('li');
      li.className = 'calendar__task-row';
      if (task.done) li.classList.add('is-done');

      if (exportMode) {
        const exportCheckbox = document.createElement('input');
        exportCheckbox.type = 'checkbox';
        exportCheckbox.className = 'calendar__task-row__export-checkbox';
        exportCheckbox.checked = exportSelectedIds.has(task.id);
        exportCheckbox.title = '加入這次要匯出的清單';
        exportCheckbox.addEventListener('change', () => {
          if (exportCheckbox.checked) exportSelectedIds.add(task.id);
          else exportSelectedIds.delete(task.id);
          renderExportBar();
        });
        li.appendChild(exportCheckbox);
      }

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !!task.done;
      checkbox.title = '標記完成';
      checkbox.addEventListener('change', () => {
        Data.toggleTask(selectedDateKey, task.id);
      });
      li.appendChild(checkbox);

      if (task.time) {
        const timeEl = document.createElement('span');
        timeEl.className = 'calendar__task-row__time';
        timeEl.textContent = task.time;
        li.appendChild(timeEl);
      }

      const textEl = document.createElement('span');
      textEl.className = 'calendar__task-row__text';
      textEl.textContent = task.text;
      li.appendChild(textEl);

      const detailToggleBtn = document.createElement('button');
      detailToggleBtn.type = 'button';
      detailToggleBtn.className = 'calendar__task-row__detail-toggle';
      detailToggleBtn.textContent = expandedTaskId === task.id ? '收合' : '詳情';
      detailToggleBtn.addEventListener('click', () => {
        expandedTaskId = expandedTaskId === task.id ? null : task.id;
        renderTaskList();
      });
      li.appendChild(detailToggleBtn);

      const remindBtn = document.createElement('button');
      remindBtn.type = 'button';
      remindBtn.className = 'calendar__task-row__remind';
      remindBtn.textContent = '加到手機';
      remindBtn.title = '產生 QR code / 下載 .ics，加入手機日曆';
      remindBtn.addEventListener('click', () => showReminderModal(selectedDateKey, task));
      li.appendChild(remindBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'calendar__task-row__delete';
      deleteBtn.title = '刪除這筆代辦';
      deleteBtn.textContent = '×';
      deleteBtn.addEventListener('click', () => {
        Data.removeTask(selectedDateKey, task.id);
      });
      li.appendChild(deleteBtn);

      taskListEl.appendChild(li);

      if (expandedTaskId === task.id) {
        taskListEl.appendChild(buildDetailRow(selectedDateKey, task));
      }
    });

    renderExportBar();
  }

  function renderExportBar() {
    if (!exportMode || exportSelectedIds.size === 0) {
      exportBarEl.hidden = true;
      return;
    }
    exportBarEl.hidden = false;
    exportCountEl.textContent = `已選 ${exportSelectedIds.size} 筆`;
  }

  function handleAddTask() {
    if (!selectedDateKey) return;
    const text = taskInputEl.value;
    if (!text || !text.trim()) return;
    const time = taskTimeInputEl.value || null;
    Data.addTask(selectedDateKey, text, time);
    taskInputEl.value = '';
    taskTimeInputEl.value = '';
    taskInputEl.focus();
  }

  prevBtn.addEventListener('click', () => {
    viewMonth -= 1;
    if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
    renderGrid();
  });

  nextBtn.addEventListener('click', () => {
    viewMonth += 1;
    if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
    renderGrid();
  });

  todayBtn.addEventListener('click', () => {
    viewYear = today.getFullYear();
    viewMonth = today.getMonth();
    renderGrid();
  });

  closePanelBtn.addEventListener('click', closeDayPanel);
  taskAddBtn.addEventListener('click', handleAddTask);
  taskInputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') handleAddTask();
  });
  taskTimeInputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') handleAddTask();
  });

  exportToggleBtn.addEventListener('click', () => {
    exportMode = !exportMode;
    if (!exportMode) exportSelectedIds = new Set();
    renderTaskList();
  });

  exportCancelBtn.addEventListener('click', () => {
    exportMode = false;
    exportSelectedIds = new Set();
    renderTaskList();
  });

  exportGenerateBtn.addEventListener('click', () => {
    if (!selectedDateKey || exportSelectedIds.size === 0) return;
    const tasks = Data.getDayTasks(selectedDateKey).filter((t) => exportSelectedIds.has(t.id));
    if (tasks.length === 0) return;
    const icalText = buildCombinedICalText(selectedDateKey, tasks);
    downloadIcs(icalText, `代辦清單-${selectedDateKey}-共${tasks.length}筆.ics`);
    exportMode = false;
    exportSelectedIds = new Set();
    renderTaskList();
  });

  Data.subscribe(() => {
    renderGrid();
    renderUpcoming();
    if (selectedDateKey) renderTaskList();
  });

  renderGrid();
  renderUpcoming();
}

export function boot() {
  try {
    initCalendar();
  } catch (err) {
    console.error('Life Ledger：日曆初始化失敗（不影響其他功能）', err);
  }
}

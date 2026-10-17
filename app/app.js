// Consultorio — MVP de gestión para psicólogos.
// Todo se guarda en localStorage; en producción esto va a un backend con cifrado.

const STORAGE_KEY = 'consultorio-v1';
const FREE_PATIENT_LIMIT = 5;

const defaultState = () => ({
  profile: { name: '', currency: 'ARS', plan: 'free' },
  patients: [],
  sessions: [],
});

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultState(), ...JSON.parse(raw) } : defaultState();
  } catch {
    return defaultState();
  }
}

let state = loadState();

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    alert('No se pudieron guardar los datos en este navegador.');
  }
}

// ---------- Utilidades ----------

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function money(n) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: state.profile.currency || 'ARS', maximumFractionDigits: 0,
  }).format(n || 0);
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayISO = () => localISO(new Date());
const monthKey = (iso) => iso.slice(0, 7);
const patientById = (id) => state.patients.find((p) => p.id === id);
const activePatients = () => state.patients.filter((p) => p.active !== false);
const isPro = () => state.profile.plan === 'pro';

const STATUS = {
  programada: { label: 'Programada', cls: 'info' },
  realizada: { label: 'Realizada', cls: 'ok' },
  cancelada: { label: 'Cancelada', cls: 'danger' },
  ausente: { label: 'Ausente', cls: 'warn' },
};

// Sesiones que generan deuda: realizadas o ausencias sin aviso.
const isBillable = (s) => s.status === 'realizada' || s.status === 'ausente';

function sortSessions(list, dir = 1) {
  return [...list].sort((a, b) => dir * (`${a.date} ${a.time}`).localeCompare(`${b.date} ${b.time}`));
}

// ---------- Navegación ----------

const view = document.getElementById('view');
const modal = document.getElementById('modal');
let currentView = 'dashboard';

document.getElementById('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-view]');
  if (btn) go(btn.dataset.view);
});

function go(name, arg) {
  currentView = name;
  document.querySelectorAll('#tabs button').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === name || (name === 'paciente' && b.dataset.view === 'pacientes'));
  });
  views[name](arg);
  window.scrollTo(0, 0);
}

function rerender() {
  go(currentView, currentArg);
}
let currentArg;

// ---------- Vistas ----------

const views = {
  dashboard() {
    currentArg = undefined;
    const month = monthKey(todayISO());
    const monthSessions = state.sessions.filter((s) => monthKey(s.date) === month);
    const billed = monthSessions.filter(isBillable);
    const collected = billed.filter((s) => s.paid).reduce((t, s) => t + Number(s.fee || 0), 0);
    const pending = state.sessions.filter((s) => isBillable(s) && !s.paid).reduce((t, s) => t + Number(s.fee || 0), 0);
    const upcoming = sortSessions(state.sessions.filter((s) => s.status === 'programada' && s.date >= todayISO())).slice(0, 6);

    view.innerHTML = `
      ${!state.profile.name ? `<div class="banner">👋 Bienvenida/o. Configurá tu nombre en <a href="#" data-go="ajustes">Ajustes</a> o <a href="#" data-action="demo">cargá datos de ejemplo</a> para explorar.</div>` : ''}
      <h1>Hola${state.profile.name ? ', ' + esc(state.profile.name) : ''}</h1>
      <div class="grid stats">
        <div class="card stat"><div class="label">Cobrado este mes</div><div class="value">${money(collected)}</div></div>
        <div class="card stat"><div class="label">Pendiente de cobro</div><div class="value">${money(pending)}</div></div>
        <div class="card stat"><div class="label">Sesiones este mes</div><div class="value">${billed.length}</div></div>
        <div class="card stat"><div class="label">Pacientes activos</div><div class="value">${activePatients().length}</div></div>
      </div>
      <div class="card">
        <div class="row"><h2>Próximas sesiones</h2><span class="spacer"></span>
          <button class="btn primary small" data-action="new-session">+ Nueva sesión</button></div>
        ${upcoming.length ? sessionTable(upcoming) : '<div class="empty">No hay sesiones programadas.</div>'}
      </div>`;
  },

  agenda() {
    currentArg = undefined;
    const today = todayISO();
    const future = sortSessions(state.sessions.filter((s) => s.date >= today));
    const past = sortSessions(state.sessions.filter((s) => s.date < today), -1).slice(0, 30);
    view.innerHTML = `
      <div class="row"><h1>Agenda</h1><span class="spacer"></span>
        <button class="btn primary" data-action="new-session">+ Nueva sesión</button></div>
      <div class="card"><h2>Hoy y próximas</h2>${future.length ? sessionTable(future) : '<div class="empty">Sin sesiones próximas.</div>'}</div>
      <div class="card"><h2>Anteriores</h2>${past.length ? sessionTable(past) : '<div class="empty">Sin sesiones anteriores.</div>'}</div>`;
  },

  pacientes() {
    currentArg = undefined;
    const list = [...state.patients].sort((a, b) => a.name.localeCompare(b.name));
    view.innerHTML = `
      <div class="row"><h1>Pacientes</h1><span class="spacer"></span>
        <button class="btn primary" data-action="new-patient">+ Nuevo paciente</button></div>
      ${!isPro() ? `<p class="muted">Plan gratuito: ${activePatients().length}/${FREE_PATIENT_LIMIT} pacientes activos.</p>` : ''}
      <div class="card">
        ${list.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Nombre</th><th>Contacto</th><th>Honorario</th><th>Deuda</th><th>Estado</th></tr></thead>
          <tbody>${list.map((p) => {
            const debt = debtOf(p.id);
            return `<tr>
              <td><a href="#" data-open-patient="${p.id}">${esc(p.name)}</a></td>
              <td>${esc(p.phone)}${p.email ? `<br><span class="muted">${esc(p.email)}</span>` : ''}</td>
              <td>${money(p.fee)}</td>
              <td>${debt ? `<span class="badge warn">${money(debt)}</span>` : '<span class="muted">—</span>'}</td>
              <td>${p.active === false ? '<span class="badge danger">Alta</span>' : '<span class="badge ok">Activo</span>'}</td>
            </tr>`;
          }).join('')}</tbody></table></div>` : '<div class="empty">Todavía no cargaste pacientes.</div>'}
      </div>`;
  },

  paciente(id) {
    currentArg = id;
    const p = patientById(id);
    if (!p) return go('pacientes');
    const sessions = sortSessions(state.sessions.filter((s) => s.patientId === id), -1);
    view.innerHTML = `
      <p><a href="#" data-go="pacientes">← Pacientes</a></p>
      <div class="card">
        <div class="row"><h1>${esc(p.name)}</h1><span class="spacer"></span>
          <button class="btn small" data-action="edit-patient" data-id="${p.id}">Editar</button>
          <button class="btn primary small" data-action="new-session" data-patient="${p.id}">+ Sesión</button></div>
        <p class="muted">${esc(p.phone)} ${p.email ? '· ' + esc(p.email) : ''} · Honorario ${money(p.fee)} · Deuda ${money(debtOf(p.id))}</p>
        ${p.reason ? `<p><strong>Motivo de consulta:</strong> ${esc(p.reason)}</p>` : ''}
      </div>
      <div class="card"><h2>Evolución</h2>
        ${sessions.length ? sessions.map((s) => `
          <div style="border-bottom:1px solid var(--border);padding:10px 0">
            <div class="row"><strong>${fmtDate(s.date)} ${esc(s.time)}</strong>
              <span class="badge ${STATUS[s.status].cls}">${STATUS[s.status].label}</span>
              ${isBillable(s) ? (s.paid ? '<span class="badge ok">Pagada</span>' : '<span class="badge warn">Impaga</span>') : ''}
              <span class="spacer"></span>
              <button class="btn small" data-action="edit-session" data-id="${s.id}">Editar</button></div>
            ${s.notes ? `<p style="white-space:pre-wrap;margin:8px 0 0">${esc(s.notes)}</p>` : '<p class="muted" style="margin:6px 0 0">Sin notas.</p>'}
          </div>`).join('') : '<div class="empty">Sin sesiones registradas.</div>'}
      </div>`;
  },

  cobros() {
    currentArg = undefined;
    const unpaid = sortSessions(state.sessions.filter((s) => isBillable(s) && !s.paid));
    const byMonth = {};
    state.sessions.filter((s) => isBillable(s) && s.paid).forEach((s) => {
      byMonth[monthKey(s.date)] = (byMonth[monthKey(s.date)] || 0) + Number(s.fee || 0);
    });
    const months = Object.keys(byMonth).sort().reverse().slice(0, 12);
    view.innerHTML = `
      <h1>Cobros</h1>
      <div class="card"><h2>Pendientes (${money(unpaid.reduce((t, s) => t + Number(s.fee || 0), 0))})</h2>
        ${unpaid.length ? sessionTable(unpaid) : '<div class="empty">¡Todo cobrado! 🎉</div>'}</div>
      <div class="card"><h2>Ingresos por mes</h2>
        ${isPro() ? (months.length ? `<table><thead><tr><th>Mes</th><th>Cobrado</th></tr></thead><tbody>
          ${months.map((m) => `<tr><td>${m.slice(5)}/${m.slice(0, 4)}</td><td>${money(byMonth[m])}</td></tr>`).join('')}
          </tbody></table>` : '<div class="empty">Sin ingresos registrados.</div>')
        : proLock('Los reportes de ingresos son parte del plan Profesional.')}
      </div>`;
  },

  ajustes() {
    currentArg = undefined;
    view.innerHTML = `
      <h1>Ajustes</h1>
      <div class="card">
        <form class="stack" id="profile-form">
          <label>Tu nombre (para los recordatorios)<input name="name" value="${esc(state.profile.name)}" placeholder="Lic. ..."></label>
          <label>Moneda
            <select name="currency">${['ARS', 'USD', 'EUR', 'MXN', 'CLP', 'UYU', 'COP'].map((c) =>
              `<option ${c === state.profile.currency ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
          <div><button class="btn primary">Guardar</button></div>
        </form>
      </div>
      <div class="card">
        <h2>Plan</h2>
        <p>Plan actual: <strong>${isPro() ? 'Profesional' : 'Gratis'}</strong></p>
        <p class="muted">En la versión real, este botón abre el checkout (Mercado Pago / Stripe).</p>
        <button class="btn ${isPro() ? '' : 'primary'}" data-action="toggle-plan">${isPro() ? 'Volver a Gratis' : 'Activar Profesional (demo)'}</button>
      </div>
      <div class="card">
        <h2>Datos</h2>
        <p class="muted">Los datos se guardan solo en este navegador. Hacé backups seguido.</p>
        <div class="row">
          <button class="btn" data-action="export">Exportar backup</button>
          <label class="btn" style="display:inline-block">Importar backup<input type="file" accept="application/json" id="import-file" hidden></label>
          <button class="btn" data-action="demo">Cargar datos de ejemplo</button>
          <button class="btn danger" data-action="wipe">Borrar todo</button>
        </div>
      </div>`;

    document.getElementById('profile-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      state.profile.name = f.get('name').trim();
      state.profile.currency = f.get('currency');
      save();
      go('dashboard');
    });
    document.getElementById('import-file').addEventListener('change', importBackup);
  },
};

// ---------- Componentes ----------

function debtOf(patientId) {
  return state.sessions
    .filter((s) => s.patientId === patientId && isBillable(s) && !s.paid)
    .reduce((t, s) => t + Number(s.fee || 0), 0);
}

function proLock(msg) {
  return `<div class="empty">🔒 ${esc(msg)}<br><br><button class="btn primary" data-go="ajustes">Ver plan Profesional</button></div>`;
}

function sessionTable(list) {
  return `<div class="table-wrap"><table>
    <thead><tr><th>Fecha</th><th>Paciente</th><th>Modalidad</th><th>Estado</th><th>Pago</th><th></th></tr></thead>
    <tbody>${list.map((s) => {
      const p = patientById(s.patientId);
      return `<tr>
        <td>${fmtDate(s.date)}<br><span class="muted">${esc(s.time)} · ${esc(s.duration)} min</span></td>
        <td>${p ? `<a href="#" data-open-patient="${p.id}">${esc(p.name)}</a>` : '<span class="muted">(eliminado)</span>'}</td>
        <td>${s.mode === 'online' ? 'Online' : 'Presencial'}</td>
        <td><span class="badge ${STATUS[s.status].cls}">${STATUS[s.status].label}</span></td>
        <td>${isBillable(s)
          ? (s.paid ? `<span class="badge ok">${money(s.fee)}</span>` : `<button class="btn small" data-action="mark-paid" data-id="${s.id}">Cobrar ${money(s.fee)}</button>`)
          : '<span class="muted">—</span>'}</td>
        <td><div class="row">
          ${s.status === 'programada' && p?.phone ? `<button class="btn small" data-action="whatsapp" data-id="${s.id}" title="Recordatorio por WhatsApp">💬</button>` : ''}
          <button class="btn small" data-action="edit-session" data-id="${s.id}">Editar</button>
        </div></td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
}

// ---------- Formularios ----------

function patientForm(p = {}) {
  const editing = Boolean(p.id);
  if (!editing && !isPro() && activePatients().length >= FREE_PATIENT_LIMIT) {
    modal.innerHTML = `<h2>Límite del plan gratuito</h2>
      <p>El plan gratuito permite hasta ${FREE_PATIENT_LIMIT} pacientes activos. Pasate a Profesional para pacientes ilimitados.</p>
      <div class="row"><button class="btn" data-close>Cerrar</button><button class="btn primary" data-close data-go="ajustes">Ver planes</button></div>`;
    return modal.showModal();
  }
  modal.innerHTML = `
    <h2>${editing ? 'Editar' : 'Nuevo'} paciente</h2>
    <form class="stack" id="patient-form">
      <label>Nombre y apellido<input name="name" required value="${esc(p.name)}"></label>
      <div class="two-col">
        <label>WhatsApp / teléfono<input name="phone" value="${esc(p.phone)}" placeholder="+54 9 11 ..."></label>
        <label>Email<input name="email" type="email" value="${esc(p.email)}"></label>
      </div>
      <label>Honorario por sesión<input name="fee" type="number" min="0" step="1" value="${esc(p.fee ?? '')}"></label>
      <label>Motivo de consulta<textarea name="reason">${esc(p.reason)}</textarea></label>
      ${editing ? `<label class="row" style="display:flex"><input type="checkbox" name="discharged" style="width:auto" ${p.active === false ? 'checked' : ''}> Dado de alta (inactivo)</label>` : ''}
      <div class="row">
        ${editing ? '<button type="button" class="btn danger" data-action="delete-patient">Eliminar</button>' : ''}
        <span class="spacer"></span>
        <button type="button" class="btn" data-close>Cancelar</button>
        <button class="btn primary">Guardar</button>
      </div>
    </form>`;
  modal.showModal();

  const form = document.getElementById('patient-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const reactivating = editing && p.active === false && !f.get('discharged');
    if (reactivating && !isPro() && activePatients().length >= FREE_PATIENT_LIMIT) {
      alert(`El plan gratuito permite hasta ${FREE_PATIENT_LIMIT} pacientes activos.`);
      return;
    }
    const data = {
      name: f.get('name').trim(),
      phone: f.get('phone').trim(),
      email: f.get('email').trim(),
      fee: Number(f.get('fee') || 0),
      reason: f.get('reason').trim(),
      active: editing ? !f.get('discharged') : true,
    };
    if (editing) Object.assign(p, data);
    else state.patients.push({ id: uid(), createdAt: todayISO(), ...data });
    save();
    modal.close();
    rerender();
  });
  form.querySelector('[data-action="delete-patient"]')?.addEventListener('click', () => {
    if (!confirm(`¿Eliminar a ${p.name} y todas sus sesiones? No se puede deshacer.`)) return;
    state.patients = state.patients.filter((x) => x.id !== p.id);
    state.sessions = state.sessions.filter((s) => s.patientId !== p.id);
    save();
    modal.close();
    go('pacientes');
  });
}

function sessionForm(s = {}, presetPatient) {
  const editing = Boolean(s.id);
  const patients = editing ? state.patients : activePatients();
  if (!patients.length) {
    modal.innerHTML = `<h2>Primero cargá un paciente</h2><div class="row"><button class="btn" data-close>Cerrar</button>
      <button class="btn primary" data-close data-action="new-patient">+ Nuevo paciente</button></div>`;
    return modal.showModal();
  }
  const pid = s.patientId || presetPatient || '';
  modal.innerHTML = `
    <h2>${editing ? 'Editar' : 'Nueva'} sesión</h2>
    <form class="stack" id="session-form">
      <label>Paciente<select name="patientId" required>
        <option value="">Elegir…</option>
        ${patients.map((p) => `<option value="${p.id}" ${p.id === pid ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
      </select></label>
      <div class="two-col">
        <label>Fecha<input name="date" type="date" required value="${esc(s.date || todayISO())}"></label>
        <label>Hora<input name="time" type="time" required value="${esc(s.time || '10:00')}"></label>
      </div>
      <div class="two-col">
        <label>Duración (min)<input name="duration" type="number" min="10" step="5" value="${esc(s.duration || 50)}"></label>
        <label>Modalidad<select name="mode">
          <option value="presencial" ${s.mode !== 'online' ? 'selected' : ''}>Presencial</option>
          <option value="online" ${s.mode === 'online' ? 'selected' : ''}>Online</option></select></label>
      </div>
      <div class="two-col">
        <label>Estado<select name="status">${Object.entries(STATUS).map(([k, v]) =>
          `<option value="${k}" ${k === (s.status || 'programada') ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
        <label>Honorario<input name="fee" type="number" min="0" step="1" value="${esc(s.fee ?? '')}" placeholder="Usa el del paciente"></label>
      </div>
      <label class="row" style="display:flex"><input type="checkbox" name="paid" style="width:auto" ${s.paid ? 'checked' : ''}> Pagada</label>
      <label>Notas de evolución (privadas)<textarea name="notes">${esc(s.notes)}</textarea></label>
      <div class="row">
        ${editing ? '<button type="button" class="btn danger" data-action="delete-session">Eliminar</button>' : ''}
        <span class="spacer"></span>
        <button type="button" class="btn" data-close>Cancelar</button>
        <button class="btn primary">Guardar</button>
      </div>
    </form>`;
  modal.showModal();

  const form = document.getElementById('session-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const patient = patientById(f.get('patientId'));
    const feeInput = f.get('fee');
    const data = {
      patientId: patient.id,
      date: f.get('date'),
      time: f.get('time'),
      duration: Number(f.get('duration') || 50),
      mode: f.get('mode'),
      status: f.get('status'),
      fee: feeInput === '' ? Number(patient.fee || 0) : Number(feeInput),
      paid: Boolean(f.get('paid')),
      notes: f.get('notes').trim(),
    };
    if (editing) Object.assign(s, data);
    else state.sessions.push({ id: uid(), ...data });
    save();
    modal.close();
    rerender();
  });
  form.querySelector('[data-action="delete-session"]')?.addEventListener('click', () => {
    if (!confirm('¿Eliminar esta sesión?')) return;
    state.sessions = state.sessions.filter((x) => x.id !== s.id);
    save();
    modal.close();
    rerender();
  });
}

// ---------- Acciones ----------

function sendWhatsApp(session) {
  if (!isPro()) {
    modal.innerHTML = `<h2>Recordatorios por WhatsApp</h2>${proLock('Disponible en el plan Profesional.')}
      <div class="row"><span class="spacer"></span><button class="btn" data-close>Cerrar</button></div>`;
    return modal.showModal();
  }
  const p = patientById(session.patientId);
  const phone = (p.phone || '').replace(/\D/g, '');
  const firstName = p.name.split(' ')[0];
  const who = state.profile.name ? ` con ${state.profile.name}` : '';
  const text = `Hola ${firstName}! Te recuerdo tu sesión${who} el ${fmtDate(session.date)} a las ${session.time} (${session.mode === 'online' ? 'online' : 'presencial'}). Si no podés asistir, avisame con anticipación. ¡Gracias!`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `consultorio-backup-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  file.text().then((txt) => {
    try {
      const data = JSON.parse(txt);
      if (!Array.isArray(data.patients) || !Array.isArray(data.sessions)) throw new Error();
      if (!confirm('Esto reemplaza todos los datos actuales. ¿Continuar?')) return;
      state = { ...defaultState(), ...data };
      save();
      go('dashboard');
    } catch {
      alert('El archivo no es un backup válido.');
    }
  });
}

function loadDemo() {
  if (state.patients.length && !confirm('Esto agrega pacientes y sesiones de ejemplo a tus datos. ¿Continuar?')) return;
  const day = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return localISO(d);
  };
  const demo = [
    { name: 'Lucía Fernández', phone: '+54 9 11 5555 1111', fee: 25000, reason: 'Ansiedad laboral' },
    { name: 'Martín Gómez', phone: '+54 9 11 5555 2222', fee: 22000, reason: 'Duelo' },
    { name: 'Sofía Ruiz', phone: '+54 9 351 555 3333', fee: 25000, reason: 'Orientación vocacional' },
  ].map((p) => ({ id: uid(), email: '', active: true, createdAt: todayISO(), ...p }));
  state.patients.push(...demo);
  const plan = [
    [0, -14, 'realizada', true], [0, -7, 'realizada', false], [0, 0, 'programada', false], [0, 7, 'programada', false],
    [1, -10, 'realizada', true], [1, -3, 'ausente', false], [1, 4, 'programada', false],
    [2, -5, 'realizada', true], [2, 2, 'programada', false],
  ];
  plan.forEach(([i, offset, status, paid], n) => {
    state.sessions.push({
      id: uid(), patientId: demo[i].id, date: day(offset), time: ['09:00', '11:00', '17:30'][n % 3],
      duration: 50, mode: n % 2 ? 'online' : 'presencial', status, paid, fee: demo[i].fee,
      notes: status === 'realizada' ? 'Nota de ejemplo: se trabajó sobre los objetivos acordados.' : '',
    });
  });
  if (!state.profile.name) state.profile.name = 'Lic. Demo';
  save();
  go('dashboard');
}

// Delegación global de clicks.
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action], [data-go], [data-open-patient], [data-close]');
  if (!el) return;
  if (el.tagName === 'A') e.preventDefault();
  if (el.hasAttribute('data-close')) modal.close();
  if (el.dataset.go) return go(el.dataset.go);
  if (el.dataset.openPatient) return go('paciente', el.dataset.openPatient);

  const id = el.dataset.id;
  const session = () => state.sessions.find((s) => s.id === id);
  switch (el.dataset.action) {
    case 'new-patient': return patientForm();
    case 'edit-patient': return patientForm(patientById(id));
    case 'new-session': return sessionForm({}, el.dataset.patient);
    case 'edit-session': return sessionForm(session());
    case 'mark-paid': session().paid = true; save(); return rerender();
    case 'whatsapp': return sendWhatsApp(session());
    case 'toggle-plan': state.profile.plan = isPro() ? 'free' : 'pro'; save(); return rerender();
    case 'export': return exportBackup();
    case 'demo': return loadDemo();
    case 'wipe':
      if (confirm('¿Borrar TODOS los datos? Exportá un backup antes.')) { state = defaultState(); save(); go('dashboard'); }
      return;
  }
});

go('dashboard');

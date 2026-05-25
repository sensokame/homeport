let CONFIG = {}
let pollTimer = null
let statsTimer = null

// ── Bootstrap ──

async function init() {
  CONFIG = await api('/config')
  route()
}

// ── Router ──

function route() {
  stopPolling()
  const hash = window.location.hash || '#/'
  if (hash.startsWith('#/container/')) {
    renderDetail(decodeURIComponent(hash.slice('#/container/'.length)))
  } else {
    renderOverview()
  }
}

function navigate(hash) { window.location.hash = hash }
window.addEventListener('hashchange', route)
document.addEventListener('DOMContentLoaded', init)

// ── Polling ──

function stopPolling() {
  if (pollTimer)  { clearInterval(pollTimer);  pollTimer  = null }
  if (statsTimer) { clearInterval(statsTimer); statsTimer = null }
}

// ── API ──

async function api(path, method = 'GET', body = null) {
  const opts = { method }
  if (body) { opts.headers = { 'Content-Type': 'application/json' }; opts.body = JSON.stringify(body) }
  const res = await fetch(`/api${path}`, opts)
  if (!res.ok) throw new Error(res.status)
  return res.json()
}

// ── Formatters ──

function formatBytes(b) {
  if (!b) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), units.length - 1)
  return (b / Math.pow(1024, i)).toFixed(1) + ' ' + units[i]
}

function formatUptime(iso) {
  if (!iso || iso.startsWith('0001')) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function shortImage(img) { return img.replace(/:latest$/, '') }

function statusDot(status) {
  const cls = status === 'running' ? 'dot-up' : status === 'restarting' ? 'dot-warn' : 'dot-down'
  return `<span class="dot ${cls}"></span>${status}`
}

function cardClass(status) {
  if (status === 'running')    return 'card card-running'
  if (status === 'restarting') return 'card card-warn'
  return 'card card-stopped'
}

function barColor(pct) {
  if (pct < 60) return 'var(--green)'
  if (pct < 80) return 'var(--yellow)'
  return 'var(--red)'
}

function setBar(id, pct) {
  const el = document.getElementById(id)
  if (!el) return
  el.style.width = `${Math.min(pct, 100)}%`
  el.style.background = barColor(pct)
}

// ── Overview ──

async function renderOverview() {
  document.title = CONFIG.hostname || 'station'
  document.body.className = 'overview'

  document.getElementById('root').innerHTML = `
    <div class="top-bar">
      <span class="top-hostname">${CONFIG.hostname || 'station'}</span>
      <span class="top-summary" id="container-summary">—</span>
      <div class="top-metrics">
        <div class="metric-block">
          <div class="metric-header">
            <span class="metric-label">CPU</span>
            <span class="metric-value" id="sys-cpu">—</span>
          </div>
          <div class="resource-bar"><div class="resource-fill" id="bar-cpu" style="width:0%"></div></div>
        </div>
        <div class="metric-block">
          <div class="metric-header">
            <span class="metric-label">RAM</span>
            <span class="metric-value" id="sys-ram">—</span>
          </div>
          <div class="resource-bar"><div class="resource-fill" id="bar-ram" style="width:0%"></div></div>
          <span class="metric-sub" id="sys-ram-total"></span>
        </div>
        <div class="metric-block">
          <div class="metric-header">
            <span class="metric-label">Disk</span>
            <span class="metric-value" id="sys-disk">—</span>
          </div>
          <div class="resource-bar"><div class="resource-fill" id="bar-disk" style="width:0%"></div></div>
          <span class="metric-sub" id="sys-disk-total"></span>
        </div>
      </div>
    </div>

    <div class="cards-section">
      <div class="cards-inner">
        <div id="card-grid" class="card-grid">
          <p class="loading">loading…</p>
        </div>
      </div>
    </div>

    <div class="bottom-bar">
      <span class="section-label">Workflows</span>
      <button onclick="restartAll(this)">restart all containers</button>
      <button id="btn-update-all" onclick="updateAll(this)">update all containers</button>
      <span id="update-status-text" class="update-status-text"></span>
    </div>
  `

  await refreshOverview()
  pollTimer  = setInterval(refreshOverview, 5000)
  statsTimer = setInterval(refreshAllStats, 12000)
}

async function refreshOverview() {
  const [containers, sys] = await Promise.all([
    api('/containers'),
    api('/system'),
  ]).catch(() => [null, null])
  if (!containers || !sys) return

  // Top bar — system metrics
  const $ = id => document.getElementById(id)
  if ($('sys-cpu')) $('sys-cpu').textContent = `${sys.cpu_percent}%`
  if ($('sys-ram')) $('sys-ram').textContent = formatBytes(sys.mem_used)
  if ($('sys-ram-total')) $('sys-ram-total').textContent = `of ${formatBytes(sys.mem_total)}`
  if ($('sys-disk')) $('sys-disk').textContent = formatBytes(sys.disk_used)
  if ($('sys-disk-total')) $('sys-disk-total').textContent = `of ${formatBytes(sys.disk_total)}`
  setBar('bar-cpu',  sys.cpu_percent)
  setBar('bar-ram',  sys.mem_percent)
  setBar('bar-disk', sys.disk_percent)

  // Top bar — container summary
  const running = containers.filter(c => c.status === 'running').length
  const total = containers.length
  const summaryEl = $('container-summary')
  if (summaryEl) {
    summaryEl.innerHTML = `<span class="dot ${running === total ? 'dot-up' : 'dot-warn'}"></span>${running} / ${total} running`
  }

  // Cards
  const grid = $('card-grid')
  if (!grid) return

  const sorted = [...containers].sort(
    (a, b) => (a.status === 'running' ? -1 : 1) - (b.status === 'running' ? -1 : 1)
              || a.name.localeCompare(b.name)
  )

  grid.innerHTML = sorted.map(c => {
    const uptime = c.status === 'running' ? formatUptime(c.started) : '—'
    const dozzleUrl = `${CONFIG.dozzle_url}/container/${c.id}`
    return `
      <div class="${cardClass(c.status)}" onclick="navigate('#/container/${encodeURIComponent(c.name)}')">
        <div class="card-body">
          <div class="card-status-row">${statusDot(c.status)}</div>
          <div class="card-name">${c.name}</div>
          <div class="card-image">${shortImage(c.image)}</div>
          <div class="card-metrics" id="metrics-${c.name}">
            <span class="metric">up <strong>${uptime}</strong></span>
            <span class="metric">cpu <strong>—</strong></span>
            <span class="metric">ram <strong>—</strong></span>
          </div>
        </div>
        <div class="card-footer" onclick="event.stopPropagation()">
          ${c.status === 'running'
            ? `<button class="btn-sm btn-danger" onclick="cardAction('${c.name}','stop',this)">stop</button>
               <button class="btn-sm" onclick="cardAction('${c.name}','restart',this)">restart</button>`
            : `<button class="btn-sm" onclick="cardAction('${c.name}','start',this)">start</button>`
          }
          <a class="btn-link" href="${dozzleUrl}" target="_blank" rel="noopener" style="margin-left:auto">logs →</a>
        </div>
      </div>
    `
  }).join('')

  refreshAllStats()
}

async function refreshAllStats() {
  const grid = document.getElementById('card-grid')
  if (!grid) return
  const names = [...grid.querySelectorAll('.card-running .card-name')].map(el => el.textContent)
  await Promise.allSettled(names.map(async name => {
    try {
      const s = await api(`/containers/${encodeURIComponent(name)}/stats`)
      const el = document.getElementById(`metrics-${name}`)
      if (!el) return
      const upEl = el.querySelector('.metric:first-child strong')
      const uptime = upEl ? upEl.textContent : '—'
      el.innerHTML = `
        <span class="metric">up <strong>${uptime}</strong></span>
        <span class="metric">cpu <strong>${s.cpu_percent}%</strong></span>
        <span class="metric">ram <strong>${formatBytes(s.mem_usage)}</strong></span>
      `
    } catch { /* skip */ }
  }))
}

async function cardAction(name, action, btn) {
  btn.textContent = { stop: 'stopping…', start: 'starting…', restart: 'restarting…' }[action] || action
  btn.disabled = true
  try {
    await api(`/containers/${encodeURIComponent(name)}/${action}`, 'POST')
    await new Promise(r => setTimeout(r, 1200))
    await refreshOverview()
  } catch {
    btn.textContent = 'error'
    setTimeout(() => { btn.disabled = false; btn.textContent = action }, 2000)
  }
}

async function restartAll(btn) {
  if (!confirm('Restart all containers?\n(dashboard will not restart itself)')) return
  btn.textContent = 'restarting…'
  btn.disabled = true
  try {
    const r = await api('/actions/restart-all', 'POST')
    btn.textContent = `restarted ${r.count}`
    setTimeout(() => { btn.textContent = 'restart all containers'; btn.disabled = false }, 3000)
  } catch {
    btn.textContent = 'error'
    setTimeout(() => { btn.textContent = 'restart all containers'; btn.disabled = false }, 2000)
  }
}

// ── Update all ──

let updatePollTimer = null

async function updateAll(btn) {
  if (!confirm('Pull latest images for all containers and restart those that changed?')) return
  btn.disabled = true
  btn.textContent = 'pulling images…'
  const statusText = document.getElementById('update-status-text')

  try {
    const r = await api('/actions/update-all', 'POST')
    if (!r.ok) {
      btn.textContent = r.reason || 'already running'
      setTimeout(() => { btn.textContent = 'update all containers'; btn.disabled = false }, 3000)
      return
    }
  } catch {
    btn.textContent = 'error'
    setTimeout(() => { btn.textContent = 'update all containers'; btn.disabled = false }, 2000)
    return
  }

  // Poll for completion
  updatePollTimer = setInterval(async () => {
    try {
      const s = await api('/actions/update-status')
      if (s.running) {
        const done = s.results.length
        btn.textContent = `pulling… (${done} done)`
        return
      }
      clearInterval(updatePollTimer)
      updatePollTimer = null

      const updated  = s.results.filter(r => r.status === 'updated').length
      const upToDate = s.results.filter(r => r.status === 'up-to-date').length
      const errors   = s.results.filter(r => r.status === 'error').length

      btn.textContent = 'update all containers'
      btn.disabled = false
      if (statusText) {
        statusText.textContent = `${updated} updated, ${upToDate} up-to-date${errors ? `, ${errors} errors` : ''}`
        setTimeout(() => { statusText.textContent = '' }, 8000)
      }
      if (updated > 0) refreshOverview()
    } catch { /* retry next tick */ }
  }, 2000)
}

// ── Detail ──

async function renderDetail(name) {
  document.title = `${name} — ${CONFIG.hostname || 'station'}`
  document.body.className = ''

  document.getElementById('root').innerHTML = `
    <div class="detail-page">
      <header>
        <a class="back" href="#/">← back</a>
        <h1>${name}</h1>
        <span id="detail-status" class="detail-status muted">…</span>
      </header>
      <div id="detail-info"></div>
      <div id="detail-stats" class="stats-bar">
        <span class="muted">loading stats…</span>
      </div>
      <div class="actions" id="detail-actions"></div>
      <div class="dozzle-link">
        <a id="dozzle-link" href="${CONFIG.dozzle_url}" target="_blank" rel="noopener">view logs in Dozzle →</a>
      </div>
    </div>
  `

  let container
  try {
    container = await api(`/containers/${encodeURIComponent(name)}`)
  } catch {
    document.getElementById('root').innerHTML = `
      <div class="detail-page">
        <p class="error">Container "${name}" not found. <a href="#/">← back</a></p>
      </div>
    `
    return
  }

  // Update Dozzle link with container ID
  const dozzleLink = document.getElementById('dozzle-link')
  if (dozzleLink) dozzleLink.href = `${CONFIG.dozzle_url}/container/${container.id}`

  const statusEl = document.getElementById('detail-status')
  if (statusEl) statusEl.innerHTML = statusDot(container.status)

  const ports = Object.entries(container.ports || {})
    .filter(([, v]) => v)
    .map(([k, v]) => `${v[0].HostPort}→${k}`)
    .join('  ') || '—'

  const rows = [
    ['image',   container.image],
    ['started', container.status === 'running' ? formatUptime(container.started) + ' ago' : '—'],
    ['restart', container.restart_policy || 'none'],
    ['ports',   ports],
    ['network', container.networks.join(', ') || '—'],
    ...container.mounts.map((m, i) => [i === 0 ? 'mounts' : '', m]),
  ]

  const infoEl = document.getElementById('detail-info')
  if (infoEl) {
    infoEl.innerHTML = `
      <div class="info-grid">
        ${rows.map(([label, value]) => `
          <span class="label">${label}</span>
          <span class="value">${value}</span>
        `).join('')}
      </div>
    `
  }

  const actionsEl = document.getElementById('detail-actions')
  if (actionsEl) {
    actionsEl.innerHTML = container.status === 'running'
      ? `<button onclick="containerAction('${name}','restart',this)">restart</button>
         <button class="btn-danger" onclick="containerAction('${name}','stop',this)">stop</button>`
      : `<button onclick="containerAction('${name}','start',this)">start</button>`
  }

  if (container.status === 'running') {
    refreshStats(name)
    pollTimer = setInterval(() => refreshStats(name), 3000)
  } else {
    const statsEl = document.getElementById('detail-stats')
    if (statsEl) statsEl.innerHTML = '<span class="muted">container not running</span>'
  }
}

async function refreshStats(name) {
  const el = document.getElementById('detail-stats')
  if (!el) return
  try {
    const s = await api(`/containers/${encodeURIComponent(name)}/stats`)
    el.innerHTML = `
      <span><span class="stat-label">CPU</span><strong>${s.cpu_percent}%</strong></span>
      <span><span class="stat-label">RAM</span><strong>${formatBytes(s.mem_usage)}</strong> / ${formatBytes(s.mem_limit)}</span>
      <span><span class="stat-label">NET ↑</span><strong>${formatBytes(s.net_tx)}</strong>&nbsp;&nbsp;<span class="stat-label">↓</span><strong>${formatBytes(s.net_rx)}</strong></span>
    `
  } catch { /* retry next tick */ }
}

async function containerAction(name, action, btn) {
  const orig = btn.textContent
  btn.textContent = action + 'ing…'
  btn.disabled = true
  try {
    await api(`/containers/${encodeURIComponent(name)}/${action}`, 'POST')
    btn.textContent = 'done'
    setTimeout(() => { stopPolling(); renderDetail(name) }, 1500)
  } catch {
    btn.textContent = 'error'
    setTimeout(() => { btn.textContent = orig; btn.disabled = false }, 2000)
  }
}

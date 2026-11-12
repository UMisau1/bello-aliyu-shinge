(() => {

  'use strict';



  const LGAS = ['Misau', 'Dambam', 'Ningi', 'Warji', 'Darazo', 'Ganjuwa'];

  const $ = id => document.getElementById(id);

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({

    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'

  }[c]));



  if (!window.supabase || !window.SHINGE_SR_CONFIG) {

    $('loginMsg').textContent = 'Supabase library/configuration could not load.';

    $('loginMsg').classList.remove('hidden');

    return;

  }



  const db = window.supabase.createClient(

    window.SHINGE_SR_CONFIG.SUPABASE_URL,

    window.SHINGE_SR_CONFIG.SUPABASE_ANON_KEY

  );



  let profile = null;

  let currentUser = null;

  let map = null;

  let mapLayer = null;

  let cache = { reports: [], incidents: [], visits: [], daily: [], audit: [] };



  function msg(id, text, bad = false) {

    $(id).textContent = text;

    $(id).classList.remove('hidden');

    $(id).classList.toggle('bad', bad);

  }



  function allowed(role) {

    return ['super_admin', 'coordinator', 'data_officer', 'lga_officer', 'viewer'].includes(role);

  }



  function canManage() {

    return ['super_admin', 'coordinator'].includes(profile?.role);

  }



  function canReadOperationalRecords() {

    return ['super_admin', 'coordinator', 'data_officer', 'lga_officer'].includes(profile?.role);

  }




  // Apply least-privilege navigation and export permissions after login.
  function applyRoleVisibility() {
    const manager = canManage();
    const isLgaOfficer = profile?.role === 'lga_officer';

    document.querySelectorAll('[data-tab="audit"]').forEach(button => {
      button.classList.toggle('hidden', !manager);
    });
    if ($('tab-audit')) $('tab-audit').classList.toggle('hidden', !manager);
    if ($('exportBtn')) $('exportBtn').classList.toggle('hidden', !manager);

    document.querySelectorAll('[data-tab="daily"]').forEach(button => {
      button.classList.toggle('hidden', isLgaOfficer);
    });
    if ($('tab-daily')) $('tab-daily').classList.toggle('hidden', isLgaOfficer);
  }

  function lgaOptions(selectId, values, selectedValue) {

    const select = $(selectId);

    if (!select) return;

    select.innerHTML = values.map(lga =>

      `<option value="${esc(lga)}"${lga === selectedValue ? ' selected' : ''}>${esc(lga)}</option>`

    ).join('');

    select.disabled = profile?.role === 'lga_officer';

  }



  // LGA officers receive only their assigned LGA in reporting forms.
  // Central roles retain the complete six-LGA list.
  function configureLgaSelectors() {

    const values = profile?.role === 'lga_officer' ? [profile.lga] : LGAS;

    lgaOptions('fieldLga', values, profile?.lga || values[0]);

    lgaOptions('incLga', values, profile?.lga || values[0]);

    // The role-assignment form is only available to managers.
    lgaOptions('newUserLga', LGAS, LGAS[0]);

  }



  async function log(action, table, recordId = '') {

    try {

      await db.from('sr_audit_logs').insert({

        action_name: action,

        table_name: table,

        record_id: String(recordId || '')

      });

    } catch (error) {

      console.warn('Audit log:', error.message);

    }

  }



  function showLogin() {

    $('loginPanel').classList.remove('hidden');

    $('appPanel').classList.add('hidden');

    $('userbar').classList.add('hidden');

  }



  async function start() {

    const { data: { user }, error } = await db.auth.getUser();

    if (error || !user) {

      showLogin();

      return;

    }

    currentUser = user;



    let result = await db.from('sr_user_profiles')

      .select('user_id,role,lga')

      .eq('user_id', user.id)

      .maybeSingle();



    if (result.error) {

      showLogin();

      msg('loginMsg', 'Could not read your role profile: ' + result.error.message, true);

      return;

    }



    if (!result.data) {

      const old = await db.from('admin_users')

        .select('user_id,role')

        .eq('user_id', user.id)

        .maybeSingle();

      if (old.data?.role === 'super_admin') {

        result = { data: { user_id: user.id, role: 'super_admin', lga: null } };

      } else {

        await db.auth.signOut();

        showLogin();

        msg('loginMsg', 'This account has not been assigned a Situation Room role.', true);

        return;

      }

    }



    profile = result.data;

    if (!allowed(profile.role)) {

      await db.auth.signOut();

      showLogin();

      msg('loginMsg', 'Access denied.', true);

      return;

    }

    if (profile.role === 'lga_officer' && !LGAS.includes(profile.lga)) {

      await db.auth.signOut();

      showLogin();

      msg('loginMsg', 'This LGA officer account has no valid assigned LGA. Contact the administrator.', true);

      return;

    }



    configureLgaSelectors();
    applyRoleVisibility();

    $('loginPanel').classList.add('hidden');

    $('appPanel').classList.remove('hidden');

    $('userbar').classList.remove('hidden');

    $('useremail').textContent = user.email || '';

    $('roleBadge').textContent = profile.role + (profile.lga ? ' • ' + profile.lga : '');

    $('usersTab').classList.toggle('hidden', !canManage());

    if (!canManage()) $('tab-users').classList.add('hidden');

    $('dailyDate').value = new Date().toISOString().slice(0, 10);

    await refreshAll();

    if (canManage()) await loadUsers();

  }



  async function load(table, order = 'created_at') {

    let query = db.from(table).select('*').order(order, { ascending: false }).limit(150);

    if (profile.role === 'lga_officer' && ['sr_field_reports', 'sr_incidents', 'campaign_visits'].includes(table)) {

      query = query.eq('lga', profile.lga);

    }

    const { data, error } = await query;

    if (error) throw error;

    return data || [];

  }



  async function optionalLoad(table, order = 'created_at') {

    try {

      return await load(table, order);

    } catch (error) {

      console.warn(`Could not load ${table} for role ${profile?.role}:`, error.message);

      return [];

    }

  }



  async function refreshAll() {

    try {

      const [reports, incidents, daily, audit] = await Promise.all([

        canReadOperationalRecords() ? optionalLoad('sr_field_reports') : Promise.resolve([]),

        canReadOperationalRecords() ? optionalLoad('sr_incidents') : Promise.resolve([]),

        profile.role === 'lga_officer' ? Promise.resolve([]) : optionalLoad('sr_daily_reports', 'report_date'),

        canManage() ? optionalLoad('sr_audit_logs') : Promise.resolve([])

      ]);

      cache.reports = reports;

      cache.incidents = incidents;

      cache.daily = daily;

      cache.audit = audit;

      cache.visits = await optionalLoad('campaign_visits');

      render();

    } catch (error) {

      alert('Data refresh failed: ' + error.message);

    }

  }



  function render() {

    const reports = cache.reports;

    const incidents = cache.incidents;

    const visits = cache.visits;

    const visibleLgas = profile.role === 'lga_officer' ? [profile.lga] : LGAS;



    renderMap();

    $('statReports').textContent = reports.length;

    $('statIncidents').textContent = incidents.filter(x => !['Resolved', 'Closed'].includes(x.status)).length;

    $('statLgas').textContent = new Set(reports.map(x => x.lga)).size + '/6';

    $('statVisits').textContent = visits.length;



    $('lgaRows').innerHTML = visibleLgas.map(lga =>

      `<tr><td>${esc(lga)}</td><td>${reports.filter(x => x.lga === lga).length}</td><td>${incidents.filter(x => x.lga === lga).length}</td><td>${visits.filter(x => x.lga === lga).length}</td></tr>`

    ).join('');



    $('fieldRows').innerHTML = reports.slice(0, 60).map(x =>

      `<tr><td>${esc(x.created_at?.slice(0, 16).replace('T', ' '))}</td><td>${esc(x.lga)}</td><td>${esc(x.report_type)}</td><td>${esc(x.title)}</td><td>${esc(x.reporter_email || '')}</td></tr>`

    ).join('');



    $('incidentRows').innerHTML = incidents.slice(0, 60).map(x =>

      `<tr><td>${esc(x.created_at?.slice(0, 16).replace('T', ' '))}</td><td>${esc(x.lga)}</td><td>${esc(x.severity)}</td><td>${esc(x.title)}</td><td>${esc(x.status)}</td></tr>`

    ).join('');



    $('dailyRows').innerHTML = cache.daily.map(x =>

      `<tr><td>${esc(x.report_date)}</td><td>${esc(x.summary)}</td><td>${esc(x.follow_up || '')}</td></tr>`

    ).join('');



    $('visitRows').innerHTML = visits.map(x =>

      `<tr><td>${esc(x.created_at?.slice(0, 16).replace('T', ' '))}</td><td>${esc(x.lga)}</td><td>${esc(x.location_name)}</td><td>${esc(x.latitude)}, ${esc(x.longitude)}</td><td>${esc(x.visit_status)}</td></tr>`

    ).join('');



    $('auditRows').innerHTML = cache.audit.map(x =>

      `<tr><td>${esc(x.created_at?.slice(0, 16).replace('T', ' '))}</td><td>${esc(x.action_name)}</td><td>${esc(x.table_name)} ${esc(x.record_id)}</td><td>${esc(x.actor_email || x.user_id || '')}</td></tr>`

    ).join('');

  }



  function renderMap() {

    if (!window.L || !$('liveMap')) return;

    if (!map) {

      map = L.map('liveMap').setView([11.5, 10.0], 8);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {

        maxZoom: 19,

        attribution: '© OpenStreetMap'

      }).addTo(map);

      mapLayer = L.layerGroup().addTo(map);

    } else {

      mapLayer.clearLayers();

    }

    const points = [];

    [

      ...cache.visits.map(x => ({ ...x, _kind: 'Campaign visit' })),

      ...cache.reports.map(x => ({ ...x, _kind: 'Field report' }))

    ].forEach(item => {

      const latitude = Number(item.latitude);

      const longitude = Number(item.longitude);

      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {

        const marker = L.marker([latitude, longitude]).bindPopup(

          `<b>${esc(item._kind)}</b><br>${esc(item.lga || '')}<br>${esc(item.location_name || item.title || '')}<br>${esc(item.created_at || '')}`

        );

        marker.addTo(mapLayer);

        points.push([latitude, longitude]);

      }

    });

    if (points.length) map.fitBounds(points, { padding: [25, 25], maxZoom: 12 });

  }



  function downloadCsv(filename, rows) {

    const csv = rows.map(row => row.map(value =>

      '"' + String(value ?? '').replace(/"/g, '""') + '"'

    ).join(',')).join('\r\n');

    const anchor = document.createElement('a');

    anchor.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));

    anchor.download = filename;

    anchor.click();

    URL.revokeObjectURL(anchor.href);

  }



  $('loginForm').addEventListener('submit', async event => {

    event.preventDefault();

    const { error } = await db.auth.signInWithPassword({

      email: $('email').value.trim(),

      password: $('password').value

    });

    if (error) {

      msg('loginMsg', error.message, true);

      return;

    }

    await start();

  });



  $('logoutBtn').onclick = async () => {

    await db.auth.signOut();

    profile = null;

    currentUser = null;

    showLogin();

  };



  document.querySelectorAll('[data-tab]').forEach(button => {

    button.onclick = () => {

      document.querySelectorAll('[data-tab]').forEach(item => item.classList.toggle('active', item === button));

      document.querySelectorAll('[id^="tab-"]').forEach(item => item.classList.add('hidden'));

      $('tab-' + button.dataset.tab).classList.remove('hidden');

      if (button.dataset.tab === 'map') {

        setTimeout(() => {

          if (map) map.invalidateSize();

          else renderMap();

        }, 100);

      }

    };

  });



  $('refreshBtn').onclick = refreshAll;



  $('gpsBtn').onclick = () => {

    if (!navigator.geolocation) {

      msg('fieldMsg', 'Geolocation is not supported.', true);

      return;

    }

    navigator.geolocation.getCurrentPosition(position => {

      $('fieldLat').value = position.coords.latitude.toFixed(7);

      $('fieldLng').value = position.coords.longitude.toFixed(7);

    }, error => msg('fieldMsg', error.message, true), {

      enableHighAccuracy: true,

      timeout: 10000

    });

  };



  $('fieldForm').onsubmit = async event => {

    event.preventDefault();

    if (profile.role === 'viewer') {

      msg('fieldMsg', 'Viewer accounts cannot submit reports.', true);

      return;

    }

    const lga = profile.role === 'lga_officer' ? profile.lga : $('fieldLga').value;

    const payload = {

      lga,

      report_type: $('fieldType').value,

      title: $('fieldTitle').value.trim(),

      description: $('fieldDesc').value.trim(),

      location_name: $('fieldLocation').value.trim() || null,

      latitude: $('fieldLat').value ? Number($('fieldLat').value) : null,

      longitude: $('fieldLng').value ? Number($('fieldLng').value) : null,

      reporter_email: currentUser.email

    };

    if (profile.role === 'lga_officer' && payload.lga !== profile.lga) {

      msg('fieldMsg', 'You can only report for your assigned LGA.', true);

      return;

    }

    const { data, error } = await db.from('sr_field_reports').insert(payload).select('id').single();

    if (error) {

      msg('fieldMsg', error.message, true);

      return;

    }

    await log('CREATE', 'sr_field_reports', data.id);

    event.target.reset();

    configureLgaSelectors();

    msg('fieldMsg', 'Report submitted successfully.');

    await refreshAll();

  };



  $('incidentForm').onsubmit = async event => {

    event.preventDefault();

    if (profile.role === 'viewer') {

      msg('incidentMsg', 'Viewer accounts cannot submit incidents.', true);

      return;

    }

    const lga = profile.role === 'lga_officer' ? profile.lga : $('incLga').value;

    const payload = {

      lga,

      severity: $('incSeverity').value,

      title: $('incTitle').value.trim(),

      description: $('incDesc').value.trim(),

      location_name: $('incLocation').value.trim() || null,

      reporter_email: currentUser.email

    };

    if (profile.role === 'lga_officer' && payload.lga !== profile.lga) {

      msg('incidentMsg', 'You can only report incidents for your assigned LGA.', true);

      return;

    }

    const { data, error } = await db.from('sr_incidents').insert(payload).select('id').single();

    if (error) {

      msg('incidentMsg', error.message, true);

      return;

    }

    await log('CREATE', 'sr_incidents', data.id);

    event.target.reset();

    configureLgaSelectors();

    msg('incidentMsg', 'Incident submitted successfully.');

    await refreshAll();

  };



  $('dailyForm').onsubmit = async event => {

    event.preventDefault();

    if (profile.role === 'viewer' || profile.role === 'lga_officer') {

      msg('dailyMsg', 'Your role cannot publish a central daily report.', true);

      return;

    }

    const payload = {

      report_date: $('dailyDate').value,

      summary: $('dailySummary').value.trim(),

      follow_up: $('dailyFollow').value.trim() || null,

      created_by: currentUser.id

    };

    const { data, error } = await db.from('sr_daily_reports')

      .upsert(payload, { onConflict: 'report_date' })

      .select('id')

      .single();

    if (error) {

      msg('dailyMsg', error.message, true);

      return;

    }

    await log('UPSERT', 'sr_daily_reports', data.id);

    msg('dailyMsg', 'Daily report saved.');

    await refreshAll();

  };



  $('addUserBtn').onclick = async () => {

    if (!canManage()) return;

    const userId = $('newUserId').value.trim();

    const role = $('newRole').value;

    const lga = role === 'lga_officer' ? $('newUserLga').value : null;

    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(userId)) {

      msg('userMsg', 'Enter a valid Supabase Auth UUID.', true);

      return;

    }

    const { error } = await db.from('sr_user_profiles').upsert({

      user_id: userId,

      role,

      lga,

      created_by: currentUser.id

    });

    if (error) {

      msg('userMsg', error.message, true);

      return;

    }

    await log('UPSERT', 'sr_user_profiles', userId);

    msg('userMsg', 'Role assigned successfully.');

    $('newUserId').value = '';

    await loadUsers();

  };



  async function loadUsers() {

    if (!canManage()) return;

    const { data, error } = await db.from('sr_user_profiles')

      .select('user_id,role,lga')

      .order('created_at', { ascending: false });

    if (error) {

      $('userRows').innerHTML = `<tr><td colspan="3">${esc(error.message)}</td></tr>`;

      return;

    }

    $('userRows').innerHTML = (data || []).map(item =>

      `<tr><td>${esc(item.user_id)}</td><td>${esc(item.role)}</td><td>${esc(item.lga || 'All LGAs')}</td></tr>`

    ).join('');

  }



  $('exportBtn').onclick = () => {
    if (!canManage()) {
      alert('Access denied: Audit export is restricted to Super Admin and Coordinator.');
      return;
    }
    downloadCsv('shinge-situation-room-audit.csv', [
      ['created_at', 'action_name', 'table_name', 'record_id', 'actor_email'],
      ...cache.audit.map(item => [item.created_at, item.action_name, item.table_name, item.record_id, item.actor_email])
    ]);
  };

  $('exportReportsBtn').onclick = () => {
    if (!canReadOperationalRecords()) {
      alert('Access denied: You cannot export field reports.');
      return;
    }
    downloadCsv('shinge-field-reports.csv', [
      ['created_at', 'lga', 'report_type', 'title', 'description', 'location_name', 'latitude', 'longitude', 'reporter_email'],
      ...cache.reports.map(item => [item.created_at, item.lga, item.report_type, item.title, item.description, item.location_name, item.latitude, item.longitude, item.reporter_email])
    ]);
  };

  $('exportIncidentsBtn').onclick = () => {
    if (!canReadOperationalRecords()) {
      alert('Access denied: You cannot export incidents.');
      return;
    }
    downloadCsv('shinge-incidents.csv', [
      ['created_at', 'lga', 'severity', 'title', 'description', 'location_name', 'status', 'reporter_email'],
      ...cache.incidents.map(item => [item.created_at, item.lga, item.severity, item.title, item.description, item.location_name, item.status, item.reporter_email])
    ]);
  };


  // =====================================================
  // PDF AND EXCEL EXPORT - SHINGE SITUATION ROOM
  // =====================================================

  function exportRowsFor(type) {
    const data = {
      reports: {
        title: 'Shinge Field Reports',
        headers: ['Date', 'LGA', 'Report Type', 'Title', 'Description', 'Location', 'Latitude', 'Longitude', 'Reporter'],
        rows: cache.reports.map(x => [
          x.created_at, x.lga, x.report_type, x.title, x.description,
          x.location_name, x.latitude, x.longitude, x.reporter_email
        ])
      },
      incidents: {
        title: 'Shinge Incident Reports',
        headers: ['Date', 'LGA', 'Severity', 'Title', 'Description', 'Location', 'Status', 'Reporter'],
        rows: cache.incidents.map(x => [
          x.created_at, x.lga, x.severity, x.title, x.description,
          x.location_name, x.status, x.reporter_email
        ])
      },
      daily: {
        title: 'Shinge Daily Situation Reports',
        headers: ['Report Date', 'Summary', 'Follow Up'],
        rows: cache.daily.map(x => [x.report_date, x.summary, x.follow_up])
      },
      audit: {
        title: 'Shinge Audit Trail',
        headers: ['Date', 'Action', 'Table', 'Record ID', 'Actor'],
        rows: cache.audit.map(x => [
          x.created_at, x.action_name, x.table_name, x.record_id,
          x.actor_email || x.user_id
        ])
      }
    };

    return data[type];
  }

  function exportExcel(type) {
    if (type === 'audit' && !canManage()) {
      alert('Access denied.');
      return;
    }

    if (['reports', 'incidents'].includes(type) && !canReadOperationalRecords()) {
      alert('Access denied.');
      return;
    }

    const data = exportRowsFor(type);
    if (!data) return;

    const xmlEscape = value => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    const allRows = [data.headers, ...data.rows];

    const worksheetRows = allRows.map((row, index) =>
      '<Row>' + row.map(value =>
        `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`
      ).join('') + '</Row>'
    ).join('');

    const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${xmlEscape(data.title.slice(0, 31))}">
  <Table>${worksheetRows}</Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([workbook], {
      type: 'application/vnd.ms-excel;charset=utf-8'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `shinge-${type}-${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportPdf(type) {
    if (type === 'audit' && !canManage()) {
      alert('Access denied.');
      return;
    }

    if (['reports', 'incidents'].includes(type) && !canReadOperationalRecords()) {
      alert('Access denied.');
      return;
    }

    const data = exportRowsFor(type);
    if (!data) return;

    const popup = window.open('', '_blank');

    if (!popup) {
      alert('Please allow pop-ups to export PDF.');
      return;
    }

    const tableRows = [data.headers, ...data.rows].map((row, index) =>
      '<tr>' + row.map(value =>
        `<${index === 0 ? 'th' : 'td'}>${esc(value)}</${index === 0 ? 'th' : 'td'}>`
      ).join('') + '</tr>'
    ).join('');

    popup.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${esc(data.title)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h2 { text-align: center; color: #174b35; }
          p { text-align: center; color: #555; }
          table { width: 100%; border-collapse: collapse; }
          th, td {
            border: 1px solid #999;
            padding: 7px;
            text-align: left;
            font-size: 10px;
            overflow-wrap: anywhere;
          }
          th { background: #174b35; color: white; }
          tr:nth-child(even) { background: #f2f2f2; }
          @media print {
            body { padding: 0; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <h2>${esc(data.title)}</h2>
        <p>Shinge Senatorial Campaign — Situation Room</p>
        <p>Generated: ${new Date().toLocaleString()}</p>
        <table>${tableRows}</table>
        <script>
          window.onload = () => window.print();
        <\/script>
      </body>
      </html>
    `);

    popup.document.close();
  }

  function addExportButtons(existingId, type) {
    const original = $(existingId);
    if (!original || !original.parentNode) return;

    const excel = document.createElement('button');
    excel.type = 'button';
    excel.textContent = 'Export Excel';
    excel.className = original.className;
    excel.style.marginLeft = '6px';
    excel.onclick = () => exportExcel(type);

    const pdf = document.createElement('button');
    pdf.type = 'button';
    pdf.textContent = 'Export PDF';
    pdf.className = original.className;
    pdf.style.marginLeft = '6px';
    pdf.onclick = () => exportPdf(type);

    original.insertAdjacentElement('afterend', excel);
    excel.insertAdjacentElement('afterend', pdf);
  }

  // Add export options beside existing CSV/Print buttons.
  addExportButtons('exportReportsBtn', 'reports');
  addExportButtons('exportIncidentsBtn', 'incidents');
  addExportButtons('exportBtn', 'audit');
  addExportButtons('printBtn', 'daily');

  $('printBtn').onclick = () => window.print();

  $('newRole').onchange = () => $('userLgaWrap').classList.toggle('hidden', $('newRole').value !== 'lga_officer');



  // Populate initial options before authentication resolves; role-specific options
  // are applied again immediately after the user's profile is loaded.
  ['fieldLga', 'incLga', 'newUserLga'].forEach(id => {

    if ($(id)) $(id).innerHTML = LGAS.map(lga => `<option value="${esc(lga)}">${esc(lga)}</option>`).join('');

  });



  const originalStart = start;

  start = async () => {

    await originalStart();

  };



  db.auth.onAuthStateChange(() => {

    setTimeout(() => start(), 0);

  });

})();
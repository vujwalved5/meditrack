
    // ==========================================
    // CONFIG
    // ==========================================
    const SUPABASE_URL = 'https://qfgvjyhnvmcczhqicend.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmZ3ZqeWhudm1jY3pocWljZW5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNDM2MDEsImV4cCI6MjEwNTkxOTYwMX0.8_lpwS74BXQCpiJciXOt7XtBmIIj2g3b7JaGUbPbaGU';
    const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // ==========================================
    // SESSION / AUTH STATE
    // ==========================================
    let currentUser = null; // { id, username, role, department_id }

    function getSession() {
      try { return JSON.parse(sessionStorage.getItem('meditrack_session')); } catch { return null; }
    }
    function setSession(user) {
      sessionStorage.setItem('meditrack_session', JSON.stringify(user));
      currentUser = user;
    }
    function clearSession() {
      sessionStorage.removeItem('meditrack_session');
      currentUser = null;
    }

    // ==========================================
    // LOGIN
    // ==========================================
    async function doLogin() {
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;
      const errEl = document.getElementById('login-error');
      const btn = document.getElementById('login-btn');

      errEl.classList.remove('show');

      if (!username || !password) {
        errEl.textContent = 'Please enter both username and password.';
        errEl.classList.add('show');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Signing in...';

      try {
        // Fetch user by username (only active accounts)
        const { data, error } = await db.from('users')
          .select('id, username, role, department_id, password_hash, is_active')
          .eq('username', username)
          .single();

        if (error || !data) {
          throw new Error('Invalid username or password.');
        }
        if (!data.is_active) {
          throw new Error('This account has been deactivated. Contact your Manager.');
        }

        // Compare password using bcryptjs
        const match = await bcrypt.compare(password, data.password_hash);
        if (!match) {
          throw new Error('Invalid username or password.');
        }

        // Store session (never store password_hash)
        setSession({
          id: data.id,
          username: data.username,
          role: data.role,
          department_id: data.department_id
        });

        showAppScreen();

      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.add('show');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Sign In';
      }
    }

    function doLogout() {
      clearSession();
      // Stop realtime channels & scanner
      stopScanner();
      db.removeAllChannels();
      // Reset UI
      document.getElementById('login-username').value = '';
      document.getElementById('login-password').value = '';
      document.getElementById('login-error').classList.remove('show');
      document.getElementById('app-screen').style.display = 'none';
      document.getElementById('login-screen').style.display = 'flex';
      // Reset state
      allEquipment = [];
      departments = [];
    }

    // ==========================================
    // SHOW APP SCREEN
    // ==========================================
    function showAppScreen() {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app-screen').style.display = 'block';

      // Update header
      document.getElementById('header-username').textContent = currentUser.username;
      const rb = document.getElementById('header-role-badge');
      rb.textContent = currentUser.role;
      rb.className = 'user-role-badge ' + currentUser.role.replace(' ', '-');

      // Build nav tabs
      buildNav();

      // Navigate to dashboard and load data
      showPage('dashboard');
      appInit();
    }

    function buildNav() {
      const nav = document.getElementById('header-nav');
      nav.innerHTML = '';
      const tabs = [{ id: 'dashboard', label: '&#128202; Dashboard', roles: ['Manager','Senior Doctor','Staff'] }];
      if (currentUser.role === 'Manager') {
        tabs.push({ id: 'users', label: '&#128100; Manage Users', roles: ['Manager'] });
      }
      tabs.forEach(tab => {
        const btn = document.createElement('button');
        btn.className = 'nav-tab';
        btn.id = 'nav-' + tab.id;
        btn.innerHTML = tab.label;
        btn.onclick = () => showPage(tab.id);
        nav.appendChild(btn);
      });
    }

    function showPage(pageId) {
      document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
      const page = document.getElementById('page-' + pageId);
      if (page) page.classList.add('active');
      const tab = document.getElementById('nav-' + pageId);
      if (tab) tab.classList.add('active');

      if (pageId === 'users') loadUsersTable();
    }

    // ==========================================
    // APP INIT (data loading + realtime)
    // ==========================================
    let allEquipment = [];
    let departments = [];
    let currentFilter = 'all';
    let currentDeptFilter = 'all';
    let selectedPriority = 'Normal';
    let currentRequestEquipmentId = null;
    let html5Scanner = null;
    let scannerActive = false;
    let scanCooldown = false;

    async function appInit() {
      await loadDepartments();
      await loadEquipment();
      await loadRequests();
      await loadAuditLog();
      subscribeRealtime();
    }

    async function loadDepartments() {
      const { data, error } = await db.from('departments').select('*').order('id');
      if (error) { console.error(error); return; }
      departments = data;

      // Populate dept filter buttons
      const dg = document.getElementById('dept-filter-group');
      dg.innerHTML = '';
      const allBtn = document.createElement('button');
      allBtn.className = 'filter-btn active'; allBtn.id = 'dept-all';
      allBtn.textContent = 'All Depts';
      allBtn.onclick = () => setDeptFilter('all', allBtn);
      dg.appendChild(allBtn);
      data.forEach(d => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn'; btn.id = 'dept-' + d.id;
        btn.textContent = d.name;
        btn.onclick = () => setDeptFilter(d.id, btn);
        dg.appendChild(btn);
      });

      // Populate new-dept select in user creation form
      const nd = document.getElementById('new-dept');
      if (nd) {
        nd.innerHTML = '<option value="">-- None --</option>';
        data.forEach(d => {
          const opt = document.createElement('option');
          opt.value = d.id; opt.textContent = d.name;
          nd.appendChild(opt);
        });
      }
    }

    async function loadEquipment() {
      const { data, error } = await db.from('equipment').select('*, departments(name)').order('id');
      if (error) { console.error(error); return; }
      allEquipment = data;
      renderEquipment();
      updateStats();
    }

    async function loadRequests() {
      const { data, error } = await db.from('requests')
        .select('*, equipment(name)').eq('status','Pending')
        .order('created_at', { ascending: false }).limit(30);
      if (error) { console.error(error); return; }
      renderRequests(data);
    }

    async function loadAuditLog() {
      const { data, error } = await db.from('audit_log')
        .select('*, equipment(name)').order('timestamp', { ascending: false }).limit(25);
      if (error) { console.error(error); return; }
      renderAuditLog(data);
    }

    function subscribeRealtime() {
      db.channel('equipment-rt')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment' }, async (payload) => {
          if (payload.eventType === 'UPDATE') {
            const idx = allEquipment.findIndex(e => e.id === payload.new.id);
            if (idx !== -1) allEquipment[idx] = { ...allEquipment[idx], ...payload.new };
            renderEquipment(); updateStats();
            const eq = allEquipment.find(e => e.id === payload.new.id);
            showToast((eq ? eq.name : 'Equipment') + ' status: ' + payload.new.status, 'info');
          } else { await loadEquipment(); }
        }).subscribe();

      db.channel('requests-rt')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, async () => {
          await loadRequests();
        }).subscribe();
    }

    // ==========================================
    // EQUIPMENT RENDERING
    // ==========================================
    function getFiltered() {
      return allEquipment.filter(eq => {
        const s = currentFilter === 'all' || eq.status === currentFilter;
        const d = currentDeptFilter === 'all' || eq.department_id === currentDeptFilter;
        return s && d;
      });
    }

    function renderEquipment() {
      const grid = document.getElementById('equipment-grid');
      const filtered = getFiltered();
      document.getElementById('eq-count').textContent = filtered.length;
      if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">&#128269;</div><div class="empty-text">No equipment matches filters</div></div>';
        return;
      }
      grid.innerHTML = '';
      filtered.forEach(eq => grid.appendChild(createCard(eq)));
    }

    function createCard(eq) {
      const isAvail = eq.status === 'Available';
      const sc = isAvail ? 'available' : 'inuse';
      const deptName = eq.departments ? eq.departments.name : 'Unknown';
      const canApprove = currentUser && (currentUser.role === 'Manager' || currentUser.role === 'Senior Doctor');

      const card = document.createElement('div');
      card.className = 'eq-card ' + sc;
      card.id = 'eq-card-' + eq.id;
      card.innerHTML =
        '<div class="eq-card-header">' +
          '<div><div class="eq-name">' + esc(eq.name) + '</div><div class="eq-dept">&#127970; ' + esc(deptName) + '</div></div>' +
          '<span class="status-badge ' + sc + '">' + esc(eq.status) + '</span>' +
        '</div>' +
        '<div class="eq-qr">' +
          '<div class="qr-canvas" id="qr-' + eq.id + '"></div>' +
          '<div><div class="eq-qr-info">Scan to toggle status</div><div class="eq-qr-id">' + esc(eq.qr_code_id) + '</div></div>' +
        '</div>' +
        '<div class="eq-card-footer">' +
          (isAvail
            ? '<button class="btn btn-toggle" onclick="manualToggle(' + eq.id + ')">Mark In Use</button>'
            : '<button class="btn btn-release" onclick="manualToggle(' + eq.id + ')">&#10004; Release</button>' +
              '<button class="btn btn-request" onclick="openRequestModal(' + eq.id + ')">Request</button>'
          ) +
        '</div>';

      requestAnimationFrame(() => {
        const qrDiv = card.querySelector('#qr-' + eq.id);
        if (qrDiv) {
          qrDiv.innerHTML = '';
          try {
            new QRCode(qrDiv, {
              text: eq.qr_code_id,
              width: 72, height: 72,
              colorDark: '#1a2332', colorLight: '#ffffff',
              correctLevel: QRCode.CorrectLevel.M
            });
          } catch(e) { console.warn('QR gen error', e); }
        }
      });
      return card;
    }

    function updateStats() {
      document.getElementById('stat-total').textContent = allEquipment.length;
      document.getElementById('stat-available').textContent = allEquipment.filter(e => e.status === 'Available').length;
      document.getElementById('stat-inuse').textContent = allEquipment.filter(e => e.status === 'In Use').length;
    }

    // ==========================================
    // FILTERS
    // ==========================================
    function setFilter(f) {
      currentFilter = f;
      ['all','Available','In Use'].forEach(x => {
        const m = { 'all':'filter-all','Available':'filter-available','In Use':'filter-inuse' };
        const b = document.getElementById(m[x]);
        if (b) b.classList.toggle('active', x === f);
      });
      renderEquipment();
    }

    function setDeptFilter(id, btn) {
      currentDeptFilter = id;
      document.querySelectorAll('#dept-filter-group .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderEquipment();
    }

    // ==========================================
    // STATUS TOGGLE
    // ==========================================
    async function manualToggle(eqId) {
      const eq = allEquipment.find(e => e.id === eqId);
      if (!eq) return;
      await doToggle(eq, currentUser.username);
    }

    async function doToggle(eq, performedBy) {
      const newStatus = eq.status === 'Available' ? 'In Use' : 'Available';
      const { error: ue } = await db.from('equipment').update({ status: newStatus }).eq('id', eq.id);
      if (ue) { showToast('Failed: ' + ue.message, 'error'); return false; }
      await db.from('audit_log').insert([{
        equipment_id: eq.id,
        action: 'Status changed to "' + newStatus + '"',
        performed_by: performedBy || 'Unknown'
      }]);
      await loadAuditLog();
      return true;
    }

    // ==========================================
    // QR SCANNER — unchanged logic, uses currentUser
    // ==========================================
    function openScanner() {
      document.getElementById('scanner-modal').style.display = 'flex';
      document.getElementById('scan-result').innerHTML = '';
      hideConflict();
      startScanner();
    }

    function closeScanner() {
      stopScanner();
      document.getElementById('scanner-modal').style.display = 'none';
      hideConflict();
    }

    function startScanner() {
      if (scannerActive) return;
      scannerActive = true;
      const container = document.getElementById('scanner-container');
      container.innerHTML = '';
      html5Scanner = new Html5Qrcode('scanner-container');
      html5Scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded) => onScanSuccess(decoded),
        () => {}
      ).catch(err => {
        showScanResult('Camera error: ' + err + '. Please allow camera access.', 'error');
        scannerActive = false;
      });
    }

    function stopScanner() {
      if (html5Scanner && scannerActive) {
        html5Scanner.stop().then(() => { html5Scanner.clear(); html5Scanner = null; scannerActive = false; })
          .catch(() => { html5Scanner = null; scannerActive = false; });
      }
    }

    async function onScanSuccess(qrCodeId) {
      if (scanCooldown) return;
      scanCooldown = true;
      setTimeout(() => { scanCooldown = false; }, 3000);
      const trimmed = qrCodeId.trim();
      const eq = allEquipment.find(e => e.qr_code_id === trimmed);
      if (!eq) {
        showScanResult('Unknown QR: "' + esc(trimmed) + '" — not in system.', 'error');
        return;
      }
      // CONFLICT PREVENTION: already In Use
      if (eq.status === 'In Use') {
        showConflict(eq.name);
        showToast(eq.name + ' is already In Use!', 'error');
        return;
      }
      hideConflict();
      showScanResult('Found: ' + esc(eq.name) + ' — updating...', 'success');
      const ok = await doToggle(eq, currentUser.username);
      if (ok) {
        showScanResult(esc(eq.name) + ' is now In Use. Audit log updated.', 'success');
        showToast(eq.name + ' marked In Use', 'success');
        setTimeout(() => closeScanner(), 2000);
      }
    }

    function showConflict(name) {
      const el = document.getElementById('conflict-alert');
      document.getElementById('conflict-msg').textContent = '"' + name + '" is already In Use. It cannot be marked In Use again. Scan a different item or release this one first.';
      el.classList.add('show');
    }
    function hideConflict() { document.getElementById('conflict-alert').classList.remove('show'); }

    function showScanResult(msg, type) {
      const el = document.getElementById('scan-result');
      el.className = 'scan-result ' + type;
      el.innerHTML = msg;
    }

    // ==========================================
    // REQUEST MODAL
    // ==========================================
    function openRequestModal(eqId) {
      const eq = allEquipment.find(e => e.id === eqId);
      if (!eq) return;
      currentRequestEquipmentId = eqId;
      const deptName = eq.departments ? eq.departments.name : 'Unknown';
      document.getElementById('request-eq-info').innerHTML =
        '<strong>Requesting:</strong> ' + esc(eq.name) +
        ' &nbsp;|&nbsp; <strong>Dept:</strong> ' + esc(deptName) +
        ' &nbsp;|&nbsp; <strong>Status:</strong> <span style="color:var(--inuse);font-weight:600">In Use</span>';
      // Show logged-in user (read-only, no manual input)
      document.getElementById('req-user-display').textContent = currentUser.username + ' (' + currentUser.role + ')';
      selectPriority('Normal');
      document.getElementById('request-modal').style.display = 'flex';
    }

    function closeRequestModal() {
      document.getElementById('request-modal').style.display = 'none';
      currentRequestEquipmentId = null;
    }

    function selectPriority(p) {
      selectedPriority = p;
      document.getElementById('pri-normal').className = 'priority-option' + (p === 'Normal' ? ' selected-normal' : '');
      document.getElementById('pri-urgent').className = 'priority-option' + (p === 'Urgent' ? ' selected-urgent' : '');
    }

    async function submitRequest() {
      if (!currentRequestEquipmentId) return;
      const btn = document.getElementById('submit-req-btn');
      btn.disabled = true; btn.textContent = 'Submitting...';
      const { error } = await db.from('requests').insert([{
        equipment_id: currentRequestEquipmentId,
        requested_by: currentUser.username,  // Always from session
        priority: selectedPriority,
        status: 'Pending'
      }]);
      btn.disabled = false; btn.textContent = 'Submit Request';
      if (error) { showToast('Failed: ' + error.message, 'error'); return; }
      showToast(selectedPriority + ' request submitted!', 'success');
      closeRequestModal();
      await loadRequests();
    }

    // ==========================================
    // RENDER REQUESTS (role-gated approve/reject)
    // ==========================================
    function renderRequests(reqs) {
      const el = document.getElementById('requests-list');
      document.getElementById('req-count').textContent = reqs.length;
      if (reqs.length === 0) {
        el.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128205;</div><div class="empty-text">No pending requests</div></div>';
        return;
      }
      const canApprove = currentUser && (currentUser.role === 'Manager' || currentUser.role === 'Senior Doctor');
      el.innerHTML = '';
      reqs.forEach(req => {
        const isU = req.priority === 'Urgent';
        const item = document.createElement('div');
        item.className = 'request-item' + (isU ? ' urgent' : '');
        const eqName = req.equipment ? req.equipment.name : 'Equipment #' + req.equipment_id;

        item.innerHTML =
          '<div class="request-eq-name">' +
            (isU ? '<span class="urgent-flag">&#128680; URGENT</span> ' : '') +
            esc(eqName) +
            (isU ? '<span class="approval-needed-badge">Needs Sr. Doctor / Manager</span>' : '') +
          '</div>' +
          '<div class="request-meta">&#128100; ' + esc(req.requested_by) + ' &middot; ' + fmtTime(req.created_at) + '</div>';

        if (canApprove) {
          const row = document.createElement('div');
          row.className = 'approve-reject-row';
          const approveBtn = document.createElement('button');
          approveBtn.className = 'btn-approve';
          approveBtn.textContent = '\u2713 Approve';
          approveBtn.addEventListener('click', () => updateReq(req.id, 'Approved'));
          const rejectBtn = document.createElement('button');
          rejectBtn.className = 'btn-reject';
          rejectBtn.textContent = '\u2715 Reject';
          rejectBtn.addEventListener('click', () => updateReq(req.id, 'Rejected'));
          row.appendChild(approveBtn);
          row.appendChild(rejectBtn);
          item.appendChild(row);
        } else {
          const wait = document.createElement('div');
          wait.style.cssText = 'font-size:11px;color:var(--text-muted);margin-top:6px;';
          wait.textContent = 'Awaiting approval by Senior Doctor or Manager';
          item.appendChild(wait);
        }

        el.appendChild(item);
      });
    }

    async function updateReq(id, status) {
      const { error } = await db.from('requests').update({ status }).eq('id', id);
      if (error) { showToast('Failed: ' + error.message, 'error'); return; }
      showToast('Request ' + status, 'success');
      await loadRequests();
    }

    // ==========================================
    // RENDER AUDIT LOG
    // ==========================================
    function renderAuditLog(logs) {
      const el = document.getElementById('audit-list');
      if (logs.length === 0) {
        el.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128220;</div><div class="empty-text">No actions yet</div></div>';
        return;
      }
      el.innerHTML = '';
      logs.forEach(log => {
        const item = document.createElement('div');
        item.className = 'log-item';
        const eqName = log.equipment ? log.equipment.name : 'Eq#' + log.equipment_id;
        item.innerHTML =
          '<div class="log-action">&#128312; ' + esc(eqName) + '</div>' +
          '<div class="log-meta">' + esc(log.action) + ' &middot; <strong>' + esc(log.performed_by) + '</strong></div>' +
          '<div class="log-meta">' + fmtTime(log.timestamp) + '</div>';
        el.appendChild(item);
      });
    }

    // ==========================================
    // MANAGE USERS (Manager only)
    // ==========================================
    async function loadUsersTable() {
      const tbody = document.getElementById('users-tbody');
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted);">Loading...</td></tr>';

      const { data, error } = await db
        .from('users')
        .select('id, username, role, department_id, is_active, created_at, departments(name)')
        .order('id');

      if (error) {
        tbody.innerHTML = '<tr><td colspan="5" style="color:var(--inuse);padding:16px;">Failed to load users.</td></tr>';
        return;
      }
      document.getElementById('users-count').textContent = data.length;
      tbody.innerHTML = '';

      data.forEach(u => {
        const isSelf = u.id === currentUser.id;
        const deptName = u.departments ? u.departments.name : '\u2014';
        const roleKey = u.role.replace(' ', '-');

        const tr = document.createElement('tr');

        // Username cell
        const tdUser = document.createElement('td');
        tdUser.innerHTML = '<strong>' + esc(u.username) + '</strong>' +
          (isSelf ? ' <span style="font-size:10px;color:var(--primary);font-weight:600;">(You)</span>' : '');
        tr.appendChild(tdUser);

        // Role cell
        const tdRole = document.createElement('td');
        tdRole.innerHTML = '<span class="role-chip ' + roleKey + '">' + esc(u.role) + '</span>';
        tr.appendChild(tdRole);

        // Department cell
        const tdDept = document.createElement('td');
        tdDept.textContent = deptName;
        tr.appendChild(tdDept);

        // Status cell
        const tdStatus = document.createElement('td');
        tdStatus.innerHTML = '<span class="active-badge ' + (u.is_active ? 'active' : 'inactive') + '">' +
          (u.is_active ? 'Active' : 'Inactive') + '</span>';
        tr.appendChild(tdStatus);

        // Actions cell
        const tdActions = document.createElement('td');
        if (!isSelf) {
          const resetBtn = document.createElement('button');
          resetBtn.className = 'tbl-action-btn reset';
          resetBtn.innerHTML = '&#128272; Reset PW';
          resetBtn.addEventListener('click', () => openResetPwModal(u.id, u.username));
          tdActions.appendChild(resetBtn);

          const toggleBtn = document.createElement('button');
          if (u.is_active) {
            toggleBtn.className = 'tbl-action-btn deactivate';
            toggleBtn.innerHTML = '&#8856; Deactivate';
            toggleBtn.addEventListener('click', () => toggleUserActive(u.id, false));
          } else {
            toggleBtn.className = 'tbl-action-btn reactivate';
            toggleBtn.innerHTML = '&#10003; Reactivate';
            toggleBtn.addEventListener('click', () => toggleUserActive(u.id, true));
          }
          tdActions.appendChild(toggleBtn);
        } else {
          tdActions.innerHTML = '<span style="color:var(--text-muted);font-size:11px;">—</span>';
        }
        tr.appendChild(tdActions);

        tbody.appendChild(tr);
      });
    }

    async function createUser() {
      const username = document.getElementById('new-username').value.trim();
      const role = document.getElementById('new-role').value;
      const deptId = document.getElementById('new-dept').value || null;
      const btn = document.getElementById('create-user-btn');
      const pwBox = document.getElementById('new-temp-pw-box');
      const pwLabel = document.getElementById('new-temp-pw-label');

      pwBox.classList.remove('show');
      if (!username) { showToast('Please enter a username.', 'error'); return; }
      if (username.length < 3) { showToast('Username must be at least 3 characters.', 'error'); return; }

      // Generate a random temporary password
      const tempPw = 'Tmp' + Math.random().toString(36).slice(2, 8) + '!';
      btn.disabled = true; btn.textContent = 'Creating...';

      try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(tempPw, salt);

        const { error } = await db.from('users').insert([{
          username: username,
          password_hash: hash,
          role: role,
          department_id: deptId ? parseInt(deptId) : null,
          is_active: true
        }]);

        if (error) {
          if (error.message.includes('unique')) {
            showToast('Username "' + username + '" already exists.', 'error');
          } else {
            showToast('Error: ' + error.message, 'error');
          }
          return;
        }

        // Show temp password once
        pwBox.textContent = tempPw;
        pwBox.classList.add('show');
        pwLabel.textContent = 'Share this password once — it will not be shown again.';

        document.getElementById('new-username').value = '';
        showToast('User "' + username + '" created!', 'success');
        await loadUsersTable();

      } catch(err) {
        showToast('Error: ' + err.message, 'error');
      } finally {
        btn.disabled = false; btn.textContent = 'Create User';
      }
    }

    async function toggleUserActive(userId, isActive) {
      const { error } = await db.from('users').update({ is_active: isActive }).eq('id', userId);
      if (error) { showToast('Failed: ' + error.message, 'error'); return; }
      showToast('User ' + (isActive ? 'reactivated' : 'deactivated') + '.', 'success');
      await loadUsersTable();
    }

    // Reset password
    let resetPwTargetId = null;

    function openResetPwModal(userId, username) {
      resetPwTargetId = userId;
      document.getElementById('reset-pw-username-display').textContent = username;
      document.getElementById('reset-pw-new').value = '';
      document.getElementById('reset-pw-modal').style.display = 'flex';
    }
    function closeResetPwModal() {
      document.getElementById('reset-pw-modal').style.display = 'none';
      resetPwTargetId = null;
    }

    async function doResetPassword() {
      const newPw = document.getElementById('reset-pw-new').value;
      if (!newPw || newPw.length < 6) { showToast('Password must be at least 6 characters.', 'error'); return; }
      const btn = document.getElementById('reset-pw-btn');
      btn.disabled = true; btn.textContent = 'Resetting...';
      try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPw, salt);
        const { error } = await db.from('users').update({ password_hash: hash }).eq('id', resetPwTargetId);
        if (error) { showToast('Failed: ' + error.message, 'error'); return; }
        showToast('Password reset successfully.', 'success');
        closeResetPwModal();
      } catch(err) {
        showToast('Error: ' + err.message, 'error');
      } finally {
        btn.disabled = false; btn.textContent = 'Reset Password';
      }
    }

    // ==========================================
    // UTILITIES
    // ==========================================
    function esc(s) {
      if (!s) return '';
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function fmtTime(ts) {
      if (!ts) return '';
      try { return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
      catch { return ts; }
    }

    function showToast(msg, type) {
      const c = document.getElementById('toast-container');
      const t = document.createElement('div');
      t.className = 'toast ' + (type || 'info');
      t.textContent = msg;
      c.appendChild(t);
      setTimeout(() => { t.style.transition = 'opacity 300ms'; t.style.opacity = '0'; setTimeout(() => t.remove(), 310); }, 4000);
    }

    // ==========================================
    // KEYBOARD / OVERLAY CLOSE
    // ==========================================
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { closeScanner(); closeRequestModal(); closeResetPwModal(); }
      if (e.key === 'Enter' && document.getElementById('login-screen').style.display !== 'none') {
        doLogin();
      }
    });
    document.getElementById('scanner-modal').addEventListener('click', e => { if (e.target.id === 'scanner-modal') closeScanner(); });
    document.getElementById('request-modal').addEventListener('click', e => { if (e.target.id === 'request-modal') closeRequestModal(); });
    document.getElementById('reset-pw-modal').addEventListener('click', e => { if (e.target.id === 'reset-pw-modal') closeResetPwModal(); });

    // ==========================================
    // BOOT — check for existing session
    // ==========================================
    (function boot() {
      const session = getSession();
      if (session && session.id && session.username && session.role) {
        currentUser = session;
        showAppScreen();
      }
      // else login screen is already visible (display:flex in HTML)
    })();

  
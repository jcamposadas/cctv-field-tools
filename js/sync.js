const Sync = {
  queue: [], conflicts: [], tombstones: {}, syncing: false,
  init() {
    this.queue = JSON.parse(localStorage.getItem('cctv_sync_queue') || '[]');
    this.conflicts = JSON.parse(localStorage.getItem('cctv_conflicts') || '[]');
    this.tombstones = JSON.parse(localStorage.getItem('cctv_tombstones') || '{}');
    this._cleanTombstones();
    window.addEventListener('online', () => { this.updateBadges(); this.syncNow(); });
    window.addEventListener('offline', () => this.updateBadges());
    this.updateBadges();
  },
  _saveQueue() { localStorage.setItem('cctv_sync_queue', JSON.stringify(this.queue)); },
  _saveConflicts() { localStorage.setItem('cctv_conflicts', JSON.stringify(this.conflicts.slice(-50))); },
  _saveTombstones() { localStorage.setItem('cctv_tombstones', JSON.stringify(this.tombstones)); },
  _cleanTombstones() {
    const cutoff = Date.now() - CONFIG.TOMBSTONE_DAYS * 86400000;
    Object.keys(this.tombstones).forEach(id => { if (this.tombstones[id] < cutoff) delete this.tombstones[id]; });
    this._saveTombstones();
  },
  updateBadges() {
    const online = navigator.onLine;
    const mode = document.getElementById('badge-mode');
    const onlineEl = document.getElementById('badge-online');
    const syncEl = document.getElementById('badge-sync');
    const pendingEl = document.getElementById('badge-pending');
    const confEl = document.getElementById('badge-conflicts');
    if (mode) mode.textContent = supabaseClient ? '☁️ Cloud' : '💾 Local';
    if (onlineEl) onlineEl.textContent = online ? '🟢 Online' : '📡 Offline';
    if (syncEl) {
      if (this.syncing) { syncEl.textContent = '🔄 Sync...'; syncEl.classList.remove('hidden'); }
      else if (online && supabaseClient && this.queue.length === 0) { syncEl.textContent = '✅ Sync'; syncEl.classList.remove('hidden'); syncEl.classList.add('clickable'); syncEl.onclick = () => this.syncNow(); }
      else syncEl.classList.add('hidden');
    }
    if (pendingEl) { if (this.queue.length > 0) { pendingEl.textContent = '⏳ ' + this.queue.length; pendingEl.classList.remove('hidden'); } else pendingEl.classList.add('hidden'); }
    if (confEl) {
      if (this.conflicts.length > 0) { confEl.textContent = '⚡ ' + this.conflicts.length; confEl.classList.remove('hidden'); confEl.classList.add('clickable'); confEl.onclick = () => App.showConflicts(); }
      else confEl.classList.add('hidden');
    }
  },
  async saveInstallation(record) {
    record.updated_at = record.updated_at || new Date().toISOString();
    if (!record.id) record.id = 'inst_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    if (!record.user_id && Auth.user) record.user_id = Auth.user.id;
    const list = this.getLocal();
    const idx = list.findIndex(r => r.id === record.id);
    if (idx >= 0) list[idx] = record; else list.unshift(record);
    localStorage.setItem('cctv_installations', JSON.stringify(list));
    if (supabaseClient && navigator.onLine) {
      try { await this._upsertRemote(record); } catch (e) { this._enqueue({ op: 'upsert', id: record.id, data: record, retries: 0 }); }
    } else if (supabaseClient) {
      this._enqueue({ op: 'upsert', id: record.id, data: record, retries: 0 });
    }
    this.updateBadges();
    return record;
  },
  async deleteInstallation(id) {
    localStorage.setItem('cctv_installations', JSON.stringify(this.getLocal().filter(r => r.id !== id)));
    this.tombstones[id] = Date.now(); this._saveTombstones();
    if (supabaseClient && navigator.onLine) {
      try { await supabaseClient.from('installations').delete().eq('id', id); } catch (e) { this._enqueue({ op: 'delete', id, retries: 0 }); }
    } else if (supabaseClient) this._enqueue({ op: 'delete', id, retries: 0 });
    this.updateBadges();
  },
  getLocal() { return JSON.parse(localStorage.getItem('cctv_installations') || '[]'); },
  _enqueue(item) { this.queue = this.queue.filter(q => q.id !== item.id); this.queue.push(item); this._saveQueue(); },
  async _upsertRemote(record) {
    const { error } = await supabaseClient.from('installations').upsert(record, { onConflict: 'id' });
    if (error) throw error;
  },
  async syncNow() {
    if (!supabaseClient || !navigator.onLine || this.syncing) return;
    this.syncing = true; this.updateBadges();
    try {
      const remaining = [];
      for (const item of this.queue) {
        try {
          if (item.op === 'upsert') await this._upsertRemote(item.data);
          else if (item.op === 'delete') await supabaseClient.from('installations').delete().eq('id', item.id);
        } catch (e) {
          item.retries = (item.retries || 0) + 1;
          if (item.retries < CONFIG.SYNC_MAX_RETRIES) remaining.push(item);
        }
      }
      this.queue = remaining; this._saveQueue();
      await this._pullAndMerge();
    } catch (e) { console.warn('Sync error:', e); }
    this.syncing = false; this.updateBadges();
  },
  async _pullAndMerge() {
    if (!Auth.user) return;
    const { data: remote, error } = await supabaseClient.from('installations').select('*').eq('user_id', Auth.user.id).order('updated_at', { ascending: false });
    if (error || !remote) return;
    const local = this.getLocal();
    const localMap = Object.fromEntries(local.map(r => [r.id, r]));
    const remoteMap = Object.fromEntries(remote.map(r => [r.id, r]));
    const merged = [];
    const allIds = new Set([...Object.keys(localMap), ...Object.keys(remoteMap)]);
    for (const id of allIds) {
      if (this.tombstones[id]) continue;
      const L = localMap[id], R = remoteMap[id];
      if (L && R) {
        const tL = new Date(L.updated_at || 0).getTime(), tR = new Date(R.updated_at || 0).getTime();
        if (tL > tR) { merged.push(L); if (JSON.stringify(L) !== JSON.stringify(R)) { this._logConflict(id, 'local', 'updated_at local más reciente'); this._enqueue({ op: 'upsert', id, data: L, retries: 0 }); } }
        else { merged.push(R); if (tR > tL) this._logConflict(id, 'remoto', 'updated_at remoto más reciente'); }
      } else if (L) { merged.push(L); this._enqueue({ op: 'upsert', id, data: L, retries: 0 }); }
      else if (R) merged.push(R);
    }
    localStorage.setItem('cctv_installations', JSON.stringify(merged));
  },
  _logConflict(id, winner, reason) { this.conflicts.push({ id, winner, reason, at: new Date().toISOString() }); this._saveConflicts(); },
  clearConflicts() { this.conflicts = []; this._saveConflicts(); this.updateBadges(); }
};

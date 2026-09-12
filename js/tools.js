const Tools = {
  calcSubnet(ip, cidr) {
    cidr = parseInt(cidr, 10);
    if (cidr < 0 || cidr > 32) throw new Error('CIDR inválido (0-32)');
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) throw new Error('IP inválida');
    const ipNum = ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
    const mask = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0;
    const network = (ipNum & mask) >>> 0;
    const broadcast = (network | (~mask >>> 0)) >>> 0;
    const hosts = cidr >= 31 ? 0 : (broadcast - network - 1);
    const first = hosts > 0 ? network + 1 : network;
    const last = hosts > 0 ? broadcast - 1 : broadcast;
    const toIP = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
    return { network: toIP(network), broadcast: toIP(broadcast), mask: toIP(mask), wildcard: toIP(~mask >>> 0), firstHost: toIP(first), lastHost: toIP(last), hosts, cidr };
  },
  estimateStorage({ cameras, resolution, codec, fps, days, activity }) {
    const bitrateTable = { '720p': { H264: 2, H265: 1.2, MJPEG: 8 }, '1080p': { H264: 4, H265: 2.5, MJPEG: 16 }, '3MP': { H264: 6, H265: 3.5, MJPEG: 24 }, '4MP': { H264: 8, H265: 5, MJPEG: 32 }, '4K': { H264: 16, H265: 10, MJPEG: 64 } };
    const base = (bitrateTable[resolution] || bitrateTable['1080p'])[codec] || 4;
    const mbps = base * (fps / 15) * Math.max(0.1, activity / 100);
    const totalMbps = mbps * cameras;
    const gbPerDay = (totalMbps * 86400) / 8 / 1024;
    const totalGB = gbPerDay * days;
    const totalTB = totalGB / 1024;
    return { bitratePerCam: mbps.toFixed(2), totalMbps: totalMbps.toFixed(2), gbPerDay: gbPerDay.toFixed(1), totalGB: totalGB.toFixed(0), totalTB: totalTB.toFixed(2), recommendHDD: Math.ceil(totalTB * 1.2 * 10) / 10 };
  },
  T568A: [
    { pin: 1, color: '#52c41a', name: 'Blanco/Verde' }, { pin: 2, color: '#52c41a', name: 'Verde' },
    { pin: 3, color: '#faad14', name: 'Blanco/Naranja' }, { pin: 4, color: '#1890ff', name: 'Azul' },
    { pin: 5, color: '#1890ff', name: 'Blanco/Azul' }, { pin: 6, color: '#faad14', name: 'Naranja' },
    { pin: 7, color: '#722ed1', name: 'Blanco/Marrón' }, { pin: 8, color: '#722ed1', name: 'Marrón' }
  ],
  T568B: [
    { pin: 1, color: '#faad14', name: 'Blanco/Naranja' }, { pin: 2, color: '#faad14', name: 'Naranja' },
    { pin: 3, color: '#52c41a', name: 'Blanco/Verde' }, { pin: 4, color: '#1890ff', name: 'Azul' },
    { pin: 5, color: '#1890ff', name: 'Blanco/Azul' }, { pin: 6, color: '#52c41a', name: 'Verde' },
    { pin: 7, color: '#722ed1', name: 'Blanco/Marrón' }, { pin: 8, color: '#722ed1', name: 'Marrón' }
  ],
  dvrItems: [
    { group: 'Red', items: ['IP estática configurada', 'Máscara y gateway correctos', 'DNS configurado', 'Puerto HTTP cambiado (no 80)', 'Puerto RTSP verificado', 'UPnP desactivado'] },
    { group: 'Grabación', items: ['HDD detectado y formateado', 'Horario de grabación definido', 'Modo (continuo / movimiento)', 'Sobrescritura activada', 'Respaldo en nube / FTP (si aplica)'] },
    { group: 'Cámaras', items: ['Todas las cámaras online', 'Nombre de canal asignado', 'OSD con fecha/hora', 'Zonas de privacidad (si aplica)'] },
    { group: 'Seguridad', items: ['Contraseña de admin cambiada', 'Usuario técnico creado', 'Acceso remoto (P2P / DDNS) probado', 'Firmware actualizado'] }
  ],
  installItems: ['Cámaras montadas y orientadas', 'Cableado etiquetado', 'Conectores RJ45 / BNC verificados', 'Fuente de poder / PoE estable', 'DVR/NVR encendido y configurado', 'Imagen de todas las cámaras OK', 'Grabación de prueba (30 s)', 'Acceso remoto funcionando', 'Cliente capacitado (básico)', 'Documentación entregada'],
  async simulatePing(host) {
    await new Promise(r => setTimeout(r, 400 + Math.random() * 600));
    if (Math.random() <= 0.15) return { success: false, error: 'Host inalcanzable / timeout' };
    const times = Array.from({ length: 4 }, () => (8 + Math.random() * 40).toFixed(1));
    const avg = (times.reduce((a, b) => a + parseFloat(b), 0) / 4).toFixed(1);
    return { success: true, times, avg, host };
  },
  async simulateRTSP(url) {
    await new Promise(r => setTimeout(r, 600 + Math.random() * 800));
    if (!url.includes('rtsp://') || Math.random() <= 0.2) return { success: false, error: 'No se pudo conectar al stream RTSP' };
    return { success: true, codec: Math.random() > 0.5 ? 'H.264' : 'H.265', resolution: ['1280x720', '1920x1080', '2560x1440'][Math.floor(Math.random() * 3)], fps: [15, 20, 25, 30][Math.floor(Math.random() * 4)], bitrate: (1.5 + Math.random() * 6).toFixed(1) + ' Mbps' };
  },
  exportHistoryPDF(records) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('CCTV Field Tools — Historial', 14, 20);
    doc.setFontSize(10); doc.setTextColor(100); doc.text('Generado: ' + new Date().toLocaleString('es'), 14, 28); doc.setTextColor(0);
    let y = 40;
    records.forEach((r, i) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.text((i + 1) + '. ' + (r.client || 'Sin cliente'), 14, y); y += 6;
      doc.setFont(undefined, 'normal'); doc.setFontSize(9);
      doc.text('Fecha: ' + new Date(r.created_at || r.updated_at).toLocaleString('es'), 14, y); y += 5;
      doc.text('Técnico: ' + (r.technician || '—') + '  |  Estado: ' + (r.status || '—'), 14, y); y += 5;
      if (r.notes) { doc.text('Notas: ' + r.notes.substring(0, 80), 14, y); y += 5; }
      y += 6;
    });
    doc.save('cctv-historial.pdf');
  },
  exportSinglePDF(record) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Informe de Instalación CCTV', 14, 20);
    doc.setFontSize(10); doc.setTextColor(100); doc.text(new Date(record.created_at || Date.now()).toLocaleString('es'), 14, 28); doc.setTextColor(0);
    doc.setFontSize(12); let y = 42;
    [['Cliente', record.client || '—'], ['Técnico', record.technician || '—'], ['Dirección', record.address || '—'], ['Estado', record.status || '—'], ['Cámaras', String(record.cameras || '—')], ['Notas', record.notes || '—']].forEach(([k, v]) => {
      doc.setFont(undefined, 'bold'); doc.text(k + ':', 14, y); doc.setFont(undefined, 'normal'); doc.text(String(v), 50, y); y += 8;
    });
    if (record.checklist) {
      y += 6; doc.setFont(undefined, 'bold'); doc.text('Checklist:', 14, y); y += 7; doc.setFont(undefined, 'normal');
      Object.entries(record.checklist).forEach(([item, status]) => { if (y > 275) { doc.addPage(); y = 20; } doc.text('• ' + item + ': ' + status, 18, y); y += 6; });
    }
    doc.save('cctv-' + (record.client || 'informe').replace(/\s+/g, '_') + '.pdf');
  }
};

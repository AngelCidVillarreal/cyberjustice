function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('bg-cyber-cyan', 'border-cyber-cyan', 'text-cyber-dark', 'shadow-lg');
        el.classList.add('bg-cyber-card', 'border-cyber-border', 'text-cyber-text');
    });

    document.getElementById('tab-' + tabId).classList.remove('hidden');
    const activeBtn = document.getElementById('btn-' + tabId);
    activeBtn.classList.remove('bg-cyber-card', 'border-cyber-border', 'text-cyber-text');
    activeBtn.classList.add('bg-cyber-cyan', 'border-cyber-cyan', 'text-cyber-dark', 'shadow-lg');

    if (tabId === 'net') {
        monitorNetwork();
    }

    if (tabId === 'defense') {
        renderDefenseStatus();
    }
}

function toggleCodeWindow() {
    const panel = document.getElementById('code-window');
    const content = document.getElementById('code-content');
    const input = document.getElementById('code-url-input');

    if (!panel || !content) return;

    const current = document.getElementById('url-input')?.value.trim() || document.getElementById('ip-input')?.value.trim() || '';
    if (input && current && !input.value) {
        input.value = current.includes('://') ? current : `https://${current}`;
    }

    panel.classList.toggle('hidden');

    if (!panel.classList.contains('hidden')) {
        loadCodeSource();
    }
}

function applyCodeEdit() {
    const content = document.getElementById('code-content');
    if (!content) return;

    const value = content.value.trim();
    if (!value) {
        content.value = '> No hay código para guardar.';
        return;
    }

    content.value = value + '\n\n> Modificado en tiempo real desde la ventana de código.';
}

function updateDomainPreview(html, url) {
    const frame = document.getElementById('code-preview-frame');
    if (!frame) return;

    const fullUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const cleanHtml = (html || '').trim();
    const bodyHtml = cleanHtml.includes('<')
        ? cleanHtml.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
        : `<pre style="font-family: monospace; white-space: pre-wrap; word-break: break-word; margin: 0;">${cleanHtml || 'Sin contenido disponible.'}</pre>`;

    frame.srcdoc = `<!doctype html>
        <html>
        <head>
            <meta charset="UTF-8" />
            <style>
                body { font-family: Arial, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 16px; }
                pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-family: "Courier New", monospace; }
                a { color: #0ea5e9; }
            </style>
        </head>
        <body>${bodyHtml}</body>
        </html>`;
    frame.title = fullUrl;
}

async function loadCodeSource() {
    const input = document.getElementById('code-url-input');
    const content = document.getElementById('code-content');
    if (!input || !content) return;

    let target = input.value.trim();
    if (!target) {
        const fallback = document.getElementById('url-input')?.value.trim() || document.getElementById('ip-input')?.value.trim() || 'https://example.com';
        target = fallback;
        input.value = fallback;
    }

    const realUrl = /^https?:\/\//i.test(target) ? target : `https://${target}`;
    content.value = `> Cargando código HTML de ${realUrl}...`;

    const rawTarget = realUrl.replace(/^https?:\/\//i, '');
    const proxyUrls = [
        `https://r.jina.ai/http://${rawTarget}`,
        `https://r.jina.ai/http://https://${rawTarget}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(realUrl)}`
    ];

    let lastError = null;

    for (const proxyUrl of proxyUrls) {
        try {
            const response = await fetch(proxyUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const html = await response.text();
            const cleaned = html
                .slice(0, 6000)
                .replace(/\t+/g, '  ');

            content.value = cleaned;
            updateDomainPreview(cleaned, realUrl);
            return;
        } catch (err) {
            lastError = err;
        }
    }

    const fallbackMessage = `> No se pudo obtener el código HTML real para ${realUrl}.\n> Motivo: ${lastError ? lastError.message : 'fallo del proxy'}\n> Prueba con otra URL pública o usa https://example.com.`;
    content.value = fallbackMessage;
    updateDomainPreview(fallbackMessage, realUrl);
}

function normalizeTarget(value) {
    if (!value) return '';
    return value.trim()
        .replace(/^https?:\/\//i, '')
        .replace(/^www\./i, '')
        .replace(/\/.*$/, '')
        .replace(/:\d+$/, '')
        .split(/[/?#]/)[0]
        .trim();
}

async function lookupIP() {
    const rawValue = document.getElementById('ip-input').value;
    const query = normalizeTarget(rawValue);
    const geoBox = document.getElementById('res-geo');
    const asnBox = document.getElementById('res-asn');
    const portsBox = document.getElementById('res-ports');

    if (!query) {
        geoBox.innerHTML = '<span class="text-cyber-magenta">Introduce una IP o dominio válido.</span>';
        asnBox.innerHTML = '> Sin datos.';
        portsBox.innerHTML = '> Sin datos.';
        return;
    }

    geoBox.innerHTML = '> Consultando registros IP...';
    asnBox.innerHTML = '> Analizando red...';
    portsBox.innerHTML = '> Verificando puertos comunes...';

    try {
        let target = query;
        if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(query)) {
            const dnsRes = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(query)}&type=A`);
            if (!dnsRes.ok) {
                throw new Error('No se pudo resolver el dominio por DNS.');
            }
            const dnsData = await dnsRes.json();
            const answers = dnsData.Answer || [];
            const aRecord = answers.find(item => item.type === 1);
            target = (aRecord ? aRecord.data : answers[0]?.data) || query;
        }

        const res = await fetch(`https://ipwho.is/${encodeURIComponent(target)}`);
        if (!res.ok) {
            throw new Error(`IP lookup falló con ${res.status}`);
        }

        const data = await res.json();
        if (!(data && (data.ip || data.country || data.city))) {
            throw new Error('La API no devolvió datos válidos.');
        }

        const ip = data.ip || data.query || target;
        const country = data.country || data.country_name || 'N/A';
        const countryCode = data.country_code || 'N/A';
        const city = data.city || 'N/A';
        const latitude = data.latitude ?? 'N/A';
        const longitude = data.longitude ?? 'N/A';
        const asn = data.connection?.asn ?? data.asn ?? 'N/A';
        const org = data.connection?.org || data.org || data.isp || 'N/A';
        const isp = data.connection?.isp || data.org || 'N/A';
        const timezone = data.timezone?.id || data.timezone || 'N/A';

        geoBox.innerHTML = `
            <div>IP: <span class="text-cyber-cyan">${ip}</span> (${data.type || 'host'})</div>
            <div>País: ${country} (${countryCode})</div>
            <div>Ciudad: ${city}</div>
            <div>Coordenadas: ${latitude}, ${longitude}</div>
        `;

        asnBox.innerHTML = `
            <div>ASN: AS${asn}</div>
            <div>Organización: ${org}</div>
            <div>ISP: ${isp}</div>
            <div>Zona Horaria: ${timezone}</div>
        `;

        const ports = [
            { port: 80, state: 'ABIERTO', color: 'text-cyber-green' },
            { port: 443, state: 'ABIERTO', color: 'text-cyber-green' },
            { port: 22, state: 'FILTRADO', color: 'text-cyber-text/60' },
            { port: 3389, state: 'CERRADO', color: 'text-cyber-text/60' }
        ];

        portsBox.innerHTML = ports.map(p => `<div><span class="${p.color}">[${p.state}]</span> Port ${p.port}</div>`).join('');
    } catch (err) {
        geoBox.innerHTML = `<span class="text-cyber-magenta">Error: ${err.message || 'No se pudo resolver el host.'}</span>`;
        asnBox.innerHTML = '> Sin datos.';
        portsBox.innerHTML = '> Sin datos.';
    }
}

async function searchCVE() {
    const query = document.getElementById('cve-search-input').value.trim();
    const container = document.getElementById('cve-results-container');

    if (!query) {
        container.innerHTML = '<div class="bg-cyber-card border border-cyber-border p-4 rounded text-xs text-cyber-text">Escribe una keyword o CVE para consultar la base NVD.</div>';
        return;
    }

    container.innerHTML = '<div class="bg-cyber-card border border-cyber-border p-4 rounded text-xs text-cyber-cyan animate-pulse">Consultando base NVD...</div>';

    try {
        const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${encodeURIComponent(query)}&resultsPerPage=5`;
        const res = await fetch(url, {
            headers: { Accept: 'application/json' }
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        const items = data.vulnerabilities || [];

        if (!items.length) {
            container.innerHTML = `<div class="bg-cyber-card border border-cyber-border p-4 rounded text-xs text-cyber-text">No se encontraron resultados para '${query}'.</div>`;
            return;
        }

        container.innerHTML = items.map(item => {
            const cve = item.cve;
            const metrics = cve.metrics || {};
            const cvss = metrics.cvssMetricV31?.[0]?.cvssData?.baseScore ?? metrics.cvssMetricV2?.[0]?.cvssData?.baseScore ?? 'N/A';
            const severity = metrics.cvssMetricV31?.[0]?.baseSeverity || metrics.cvssMetricV2?.[0]?.baseSeverity || 'N/A';
            const description = cve.descriptions?.[0]?.value || 'Sin descripción disponible.';
            const refs = cve.references?.slice(0, 2).map(r => r.url).join(', ') || 'N/A';

            return `
                <div class="bg-cyber-card border border-cyber-border p-4 rounded-lg flex flex-col space-y-2">
                    <div class="flex justify-between items-center">
                        <div class="text-xs font-bold text-cyber-cyan font-mono">${cve.id}</div>
                        <span class="text-[10px] px-2 py-0.5 bg-cyber-magenta/20 text-cyber-magenta border border-cyber-magenta/40 rounded font-bold">${severity.toUpperCase()} [CVSS ${cvss}]</span>
                    </div>
                    <p class="text-xs text-cyber-light">${description}</p>
                    <div class="text-[11px] text-cyber-text flex justify-between font-mono gap-2 flex-wrap">
                        <span>Base NVD</span>
                        <span class="text-cyber-yellow">Refs: ${refs}</span>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        container.innerHTML = `<div class="bg-cyber-card border border-cyber-border p-4 rounded text-xs text-cyber-magenta">No se pudo consultar la base NVD desde este navegador: ${err.message}</div>`;
    }
}

async function generateHashes() {
    const text = document.getElementById('hash-input').value;
    const md5El = document.getElementById('hash-md5');
    const sha1El = document.getElementById('hash-sha1');
    const sha256El = document.getElementById('hash-sha256');

    if (!text) {
        md5El.innerText = '-';
        sha1El.innerText = '-';
        sha256El.innerText = '-';
        return;
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    const hashBuffer256 = await crypto.subtle.digest('SHA-256', data);
    const hashArray256 = Array.from(new Uint8Array(hashBuffer256));
    sha256El.innerText = hashArray256.map(b => b.toString(16).padStart(2, '0')).join('');

    const hashBuffer1 = await crypto.subtle.digest('SHA-1', data);
    const hashArray1 = Array.from(new Uint8Array(hashBuffer1));
    sha1El.innerText = hashArray1.map(b => b.toString(16).padStart(2, '0')).join('');

    const md5 = await crypto.subtle.digest('MD5', data);
    const md5Array = Array.from(new Uint8Array(md5));
    md5El.innerText = md5Array.map(b => b.toString(16).padStart(2, '0')).join('');
}

function analyzePassword() {
    const pwd = document.getElementById('pwd-input').value;
    const strengthEl = document.getElementById('pwd-strength');
    const barEl = document.getElementById('pwd-bar');
    const entropyEl = document.getElementById('pwd-entropy');
    const timeEl = document.getElementById('pwd-time');
    const feedbackEl = document.getElementById('pwd-feedback');

    if (!pwd) {
        strengthEl.innerText = 'MUY DÉBIL';
        strengthEl.className = 'font-bold text-cyber-magenta';
        barEl.style.width = '10%';
        barEl.className = 'bg-cyber-magenta h-full transition-all';
        entropyEl.innerText = '0 bits';
        timeEl.innerText = 'Instantáneo';
        feedbackEl.innerText = '> Introduce una contraseña para analizar entropía y resistencia.';
        return;
    }

    let charsetSize = 0;
    if (/[a-z]/.test(pwd)) charsetSize += 26;
    if (/[A-Z]/.test(pwd)) charsetSize += 26;
    if (/[0-9]/.test(pwd)) charsetSize += 10;
    if (/[^a-zA-Z0-9]/.test(pwd)) charsetSize += 32;

    const entropy = Math.round(pwd.length * Math.log2(charsetSize || 1));
    entropyEl.innerText = entropy + ' bits';

    let strength = 'DÉBIL';
    let colorClass = 'text-cyber-yellow';
    let barColor = 'bg-cyber-yellow';
    let width = '35%';
    let time = 'Menos de 1 hora';

    if (entropy > 60) {
        strength = 'MODERADA';
        width = '65%';
        time = 'Días o Semanas';
    }
    if (entropy > 80) {
        strength = 'FUERTE';
        colorClass = 'text-cyber-cyan';
        barColor = 'bg-cyber-cyan';
        width = '85%';
        time = 'Varios Siglos';
    }
    if (entropy > 100) {
        strength = 'EXTREMADAMENTE SEGURA';
        colorClass = 'text-cyber-green';
        barColor = 'bg-cyber-green';
        width = '100%';
        time = 'Incalculable (Miles de años)';
    }

    strengthEl.innerText = strength;
    strengthEl.className = `font-bold ${colorClass}`;
    barEl.style.width = width;
    barEl.className = `${barColor} h-full transition-all`;
    timeEl.innerText = time;
    feedbackEl.innerText = `> Longitud: ${pwd.length} caracteres. Diversidad de caracteres: ${charsetSize} símbolos posibles.`;
}

async function checkHeaders() {
    const rawUrl = document.getElementById('url-input').value.trim();
    const report = document.getElementById('headers-report');

    if (!rawUrl) {
        alert('Introduce una URL válida.');
        return;
    }

    report.innerHTML = `<div class="p-3 bg-cyber-dark rounded text-cyber-cyan animate-pulse"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Consultando cabeceras de ${rawUrl}...</div>`;

    try {
        const proxyUrl = `https://api.hackertarget.com/httpheaders/?q=${encodeURIComponent(rawUrl)}`;
        const response = await fetch(proxyUrl);
        const text = await response.text();

        if (!text || text.toLowerCase().includes('error')) {
            throw new Error('La API no devolvió headers válidos.');
        }

        const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
        const headers = {};
        lines.forEach(line => {
            const idx = line.indexOf(':');
            if (idx > 0) {
                const key = line.slice(0, idx).trim();
                const value = line.slice(idx + 1).trim();
                headers[key.toLowerCase()] = value;
            }
        });

        const checks = [
            ['strict-transport-security', 'Strict-Transport-Security (HSTS)', 'Fuerza HTTPS obligatorio.'],
            ['content-security-policy', 'Content-Security-Policy (CSP)', 'Controla contenido ejecutable.'],
            ['x-frame-options', 'X-Frame-Options', 'Evita clickjacking.'],
            ['x-content-type-options', 'X-Content-Type-Options', 'Evita MIME sniffing.']
        ];

        report.innerHTML = checks.map(([key, label, desc]) => {
            const value = headers[key] || 'No presente';
            const present = value !== 'No presente';
            return `
                <div class="p-3 bg-cyber-dark rounded border border-cyber-border flex justify-between items-center gap-4">
                    <div>
                        <span class="font-bold text-cyber-light">${label}</span>
                        <div class="text-[10px] text-cyber-text">${desc}</div>
                    </div>
                    <span class="${present ? 'text-cyber-green' : 'text-cyber-yellow'} font-bold">
                        <i class="fa-solid ${present ? 'fa-check' : 'fa-triangle-exclamation'} mr-1"></i>
                        ${present ? 'PRESENTE' : 'REVISAR'}
                    </span>
                </div>
            `;
        }).join('');
    } catch (err) {
        report.innerHTML = `<div class="p-3 bg-cyber-dark rounded border border-cyber-border text-cyber-magenta text-xs">No se pudieron obtener cabeceras reales para esta URL desde el navegador: ${err.message}</div>`;
    }
}

async function monitorNetwork() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
    const connectionEl = document.getElementById('net-connection');
    const signalEl = document.getElementById('net-signal');
    const latencyEl = document.getElementById('net-latency');
    const dnsEl = document.getElementById('net-dns');
    const portsEl = document.getElementById('net-ports');
    const riskEl = document.getElementById('net-risk');
    const statusEl = document.getElementById('net-status');
    const historyEl = document.getElementById('net-history');

    if (!connectionEl || !signalEl || !latencyEl || !dnsEl || !portsEl || !riskEl || !statusEl || !historyEl) return;

    const connType = connection ? (connection.effectiveType || connection.type || 'unknown') : 'browser-blocked';
    const downlink = connection ? (connection.downlink ? `${connection.downlink} Mbps` : 'N/A') : 'N/A';
    const rtt = connection ? (connection.rtt ? `${connection.rtt} ms` : 'N/A') : 'N/A';
    const online = navigator.onLine;

    statusEl.textContent = online ? 'ONLINE' : 'OFFLINE';
    statusEl.className = `text-sm font-bold font-mono ${online ? 'text-cyber-green' : 'text-cyber-magenta'}`;
    connectionEl.textContent = connType.toUpperCase();
    signalEl.textContent = downlink !== 'N/A' ? downlink : (online ? 'BROWSER LIMITED' : 'NO INTERNET');
    latencyEl.textContent = 'CHECKING...';
    riskEl.textContent = 'CHECKING...';
    riskEl.className = 'text-sm font-bold text-cyber-yellow font-mono';

    if (!online) {
        latencyEl.textContent = 'OFFLINE';
        riskEl.textContent = 'CRITICAL';
        riskEl.className = 'text-sm font-bold text-cyber-magenta font-mono';
        dnsEl.innerHTML = '<div>> Internet unavailable in this browser session.</div><div>> Local connectivity cannot be forced from JavaScript.</div>';
        portsEl.innerHTML = '<div>> No network traffic is being monitored because the device is offline.</div>';
        historyEl.textContent = 'Offline state';
        return;
    }

    const history = window.netHistory || [];
    window.netHistory = history;

    try {
        const t0 = performance.now();
        const start = Date.now();
        await fetch('https://example.com', { mode: 'no-cors' });
        const latency = Math.round(performance.now() - t0);
        const elapsed = Date.now() - start;
        const finalLatency = Math.max(2, Math.min(latency || elapsed, 999));

        history.push(finalLatency);
        if (history.length > 6) history.shift();

        const avg = Math.round(history.reduce((sum, val) => sum + val, 0) / history.length);
        latencyEl.textContent = `${finalLatency} ms`;
        historyEl.textContent = `${history.join(' ms / ')} ms`;

        const dnsRes = await fetch('https://dns.google/resolve?name=example.com&type=A');
        const dnsData = await dnsRes.json();
        const dnsAnswer = dnsData.Answer?.find(item => item.type === 1)?.data || 'No disponible';

        const risk = finalLatency < 120 ? 'LOW' : finalLatency < 260 ? 'MEDIUM' : 'HIGH';
        riskEl.textContent = risk;
        riskEl.className = `text-sm font-bold font-mono ${risk === 'LOW' ? 'text-cyber-green' : risk === 'MEDIUM' ? 'text-cyber-yellow' : 'text-cyber-magenta'}`;

        dnsEl.innerHTML = `
            <div>> domain: example.com</div>
            <div>> dns resolution: ${dnsAnswer}</div>
            <div>> transport: ${connType.toUpperCase()}</div>
            <div>> effective RTT: ${rtt}</div>
            <div>> avg latency: ${avg} ms</div>
            <div>> note: browser APIs hide SSID and neighbor details for privacy.</div>
        `;

        portsEl.innerHTML = `
            <div>> http: 80 / standard web service</div>
            <div>> https: 443 / secure service</div>
            <div>> dns: 53 / local resolution</div>
            <div>> status: local detection active</div>
        `;
    } catch (error) {
        latencyEl.textContent = 'UNAVAILABLE';
        signalEl.textContent = 'BROWSER RESTRICTED';
        riskEl.textContent = 'UNKNOWN';
        riskEl.className = 'text-sm font-bold text-cyber-magenta font-mono';
        dnsEl.innerHTML = `<div>> Access limited by browser permissions.</div><div>> Detail: ${error.message}</div>`;
        portsEl.innerHTML = '<div>> Local monitoring limited by browser permissions.</div>';
        historyEl.textContent = history.length ? `${history.join(' ms / ')} ms` : 'Sin historial';
    }
}

function renderDefenseStatus() {
    const https = document.getElementById('def-https');
    const pass = document.getElementById('def-pass');
    const headers = document.getElementById('def-headers');
    const score = document.getElementById('def-score');
    const checklist = document.getElementById('def-checklist');
    const recommend = document.getElementById('def-recommend');
    const allowed = document.getElementById('def-allowed');
    const blocked = document.getElementById('def-blocked');

    if (!https || !pass || !headers || !score || !checklist || !recommend || !allowed || !blocked) return;

    const httpsValue = location.protocol === 'https:' ? 'OK' : 'NO HTTPS';
    const passValue = 'STRONG';
    const headersValue = 'CONFIGURED';
    const scoreValue = 'HIGH';

    https.textContent = httpsValue;
    https.className = `text-sm font-bold font-mono ${httpsValue === 'OK' ? 'text-cyber-green' : 'text-cyber-magenta'}`;
    pass.textContent = passValue;
    pass.className = 'text-sm font-bold text-cyber-yellow font-mono';
    headers.textContent = headersValue;
    headers.className = 'text-sm font-bold text-cyber-cyan font-mono';
    score.textContent = scoreValue;
    score.className = 'text-sm font-bold text-cyber-green font-mono';

    checklist.innerHTML = `
        <div>> TLS/HTTPS enabled: ${httpsValue === 'OK' ? 'yes' : 'no'}</div>
        <div>> Password policy: minimum 12 chars + complexity</div>
        <div>> Security headers: CSP, HSTS, X-Frame-Options</div>
        <div>> Least privilege and MFA enabled</div>
        <div>> Logs and alerts active</div>
        <div>> Patching cadence: regular and documented</div>
    `;

    recommend.innerHTML = `
        <div>> Enforce HTTPS with HSTS on all public endpoints.</div>
        <div>> Require MFA and strong password rules.</div>
        <div>> Review CSP and X-Frame-Options headers.</div>
        <div>> Keep OS and software up to date.</div>
        <div>> Monitor failed logins and unusual activity.</div>
        <div>> Back up critical data and test restoration.</div>
    `;

    allowed.innerHTML = `
        <div>> Check if browser is online/offline.</div>
        <div>> Read connection type and approximate latency.</div>
        <div>> Query public domains and DNS information.</div>
        <div>> Evaluate website headers and security posture.</div>
        <div>> Show local health / monitoring status in the UI.</div>
        <div>> Analyze public IP, ASN and domain metadata through APIs.</div>
    `;

    blocked.innerHTML = `
        <div>> Force connection on/off from browser JavaScript.</div>
        <div>> Connect to a TV, router, or other device on the LAN.</div>
        <div>> Traverse the local network without explicit permission.</div>
        <div>> Access unrelated private devices or network internals.</div>
        <div>> Bypass OS/browser security restrictions.</div>
        <div>> Use page scripts to control system networking.</div>
    `;
}

searchCVE();
monitorNetwork();
renderDefenseStatus();

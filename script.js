// Custom cursor
const cursor = document.querySelector('.cursor');
const cursorGlow = document.querySelector('.cursor-glow');

document.addEventListener('mousemove', (e) => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
    cursorGlow.style.left = e.clientX + 'px';
    cursorGlow.style.top = e.clientY + 'px';
});

const interactiveElements = document.querySelectorAll('a, button, input');
interactiveElements.forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
});

// State
let apiKey = null;

// API functions
async function dehashedSearch(query, page = 1, size = 100, wildcard = true, regex = false, deDupe = true) {
    const res = await fetch("https://api.dehashed.com/v2/search", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Dehashed-Api-Key": apiKey,
        },
        body: JSON.stringify({
            page,
            query,
            size,
            wildcard,
            regex,
            de_dupe: deDupe,
        })
    });
    return await res.json();
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Set API key
document.getElementById('setKeyBtn').addEventListener('click', () => {
    const key = document.getElementById('apiKey').value.trim();
    if (!key) {
        alert('Please enter an API key');
        return;
    }
    apiKey = key;
    document.getElementById('apiKeySection').classList.add('hidden');
    document.getElementById('searchSection').classList.remove('hidden');
});

// Search
document.getElementById('searchBtn').addEventListener('click', async () => {
    const initialQuery = document.getElementById('initialQuery').value.trim();
    const relatedTermsInput = document.getElementById('relatedTerms').value.trim();

    if (!initialQuery || !relatedTermsInput) {
        alert('Please fill in both fields');
        return;
    }

    const relatedTerms = relatedTermsInput.split(',').map(t => t.trim()).filter(t => t);

    const btn = document.getElementById('searchBtn');
    btn.disabled = true;
    btn.textContent = 'Searching...';

    const resultsSection = document.getElementById('resultsSection');
    const resultsContent = document.getElementById('resultsContent');

    resultsContent.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>Searching databases...</p></div>';
    resultsSection.classList.add('show');

    try {
        // Search initial query
        const initialResults = await dehashedSearch(initialQuery);

        if (initialResults.error || !initialResults.entries) {
            throw new Error(initialResults.message || 'No results found');
        }

        // Extract identifiers
        const connections = {
            emails: new Set(),
            usernames: new Set(),
            names: new Set(),
            phones: new Set(),
            ips: new Set()
        };

        initialResults.entries.forEach(entry => {
            if (entry.email) connections.emails.add(entry.email);
            if (entry.username) connections.usernames.add(entry.username);
            if (entry.name) connections.names.add(entry.name);
            if (entry.phone) connections.phones.add(entry.phone);
            if (entry.ip_address) connections.ips.add(entry.ip_address);
        });

        // Search related terms
        const connectionMap = {};
        for (const term of relatedTerms) {
            const result = await dehashedSearch(term);
            if (result.entries) {
                connectionMap[term] = {
                    entries: result.entries,
                    connections: {
                        email: new Set(),
                        username: new Set(),
                        name: new Set(),
                        phone: new Set(),
                        ip: new Set()
                    }
                };

                result.entries.forEach(entry => {
                    if (entry.email && connections.emails.has(entry.email)) {
                        connectionMap[term].connections.email.add(entry.email);
                    }
                    if (entry.username && connections.usernames.has(entry.username)) {
                        connectionMap[term].connections.username.add(entry.username);
                    }
                    if (entry.name && connections.names.has(entry.name)) {
                        connectionMap[term].connections.name.add(entry.name);
                    }
                    if (entry.phone && connections.phones.has(entry.phone)) {
                        connectionMap[term].connections.phone.add(entry.phone);
                    }
                    if (entry.ip_address && connections.ips.has(entry.ip_address)) {
                        connectionMap[term].connections.ip.add(entry.ip_address);
                    }
                });
            }
        }

        // Display results
        displayResults(initialQuery, initialResults, connectionMap);

    } catch (error) {
        resultsContent.innerHTML = `<div class="error">ERROR: ${escapeHtml(error.message)}</div>`;
    }

    btn.disabled = false;
    btn.textContent = 'Find Connections';
});

function displayResults(query, initialResults, connectionMap) {
    const resultsContent = document.getElementById('resultsContent');
    let html = '';

    // Initial results
    html += `<div class="result-section">`;
    html += `<div class="result-header">Initial Search: ${escapeHtml(query)}</div>`;
    html += `<p style="color: var(--text-secondary); margin-bottom: 20px;">Found ${initialResults.entries.length} entries</p>`;

    initialResults.entries.slice(0, 10).forEach((entry, i) => {
        html += `<div class="entry-item">`;
        html += `<div style="font-weight: 600; margin-bottom: 12px; color: var(--accent);">Entry ${i + 1}</div>`;
        
        if (entry.email) html += `<div class="entry-field"><span class="entry-label">Email:</span><span class="entry-value">${escapeHtml(entry.email)}</span></div>`;
        if (entry.username) html += `<div class="entry-field"><span class="entry-label">Username:</span><span class="entry-value">${escapeHtml(entry.username)}</span></div>`;
        if (entry.name) html += `<div class="entry-field"><span class="entry-label">Name:</span><span class="entry-value">${escapeHtml(entry.name)}</span></div>`;
        if (entry.phone) html += `<div class="entry-field"><span class="entry-label">Phone:</span><span class="entry-value">${escapeHtml(entry.phone)}</span></div>`;
        if (entry.password) html += `<div class="entry-field"><span class="entry-label">Password:</span><span class="entry-value">${escapeHtml(entry.password)}</span></div>`;
        if (entry.hashed_password) html += `<div class="entry-field"><span class="entry-label">Hash:</span><span class="entry-value">${escapeHtml(entry.hashed_password.substring(0, 50))}...</span></div>`;
        if (entry.database_name) html += `<div class="entry-field"><span class="entry-label">Database:</span><span class="entry-value">${escapeHtml(entry.database_name)}</span></div>`;
        
        html += `</div>`;
    });

    if (initialResults.entries.length > 10) {
        html += `<p style="color: var(--text-secondary); margin-top: 16px;">... and ${initialResults.entries.length - 10} more entries</p>`;
    }

    html += `</div>`;

    // Connection results
    html += `<div class="result-section">`;
    html += `<div class="result-header">Connection Analysis</div>`;

    let hasConnections = false;
    for (const [term, data] of Object.entries(connectionMap)) {
        const conns = data.connections;
        const hasAnyConnection = Array.from(Object.values(conns)).some(set => set.size > 0);

        if (hasAnyConnection) {
            hasConnections = true;
            html += `<div style="margin-bottom: 32px;">`;
            html += `<h3 style="color: var(--accent); font-size: 18px; margin-bottom: 16px;">Connections for: ${escapeHtml(term)}</h3>`;

            for (const [type, values] of Object.entries(conns)) {
                if (values.size > 0) {
                    html += `<div style="margin-bottom: 16px;">`;
                    html += `<div style="color: var(--text-secondary); font-size: 14px; font-weight: 600; margin-bottom: 8px;">${type.toUpperCase()} MATCHES:</div>`;
                    Array.from(values).forEach(val => {
                        html += `<span class="connection-badge">${escapeHtml(val)}</span>`;
                    });
                    html += `</div>`;
                }
            }

            html += `<p style="color: var(--text-secondary); margin-top: 12px;">Total related entries: ${data.entries.length}</p>`;

            // Show sample entries
            data.entries.slice(0, 3).forEach((entry, i) => {
                html += `<div class="entry-item" style="margin-top: 12px;">`;
                html += `<div style="font-weight: 600; margin-bottom: 8px; color: var(--text-secondary);">Sample Entry ${i + 1}</div>`;
                
                if (entry.email) html += `<div class="entry-field"><span class="entry-label">Email:</span><span class="entry-value">${escapeHtml(entry.email)}</span></div>`;
                if (entry.username) html += `<div class="entry-field"><span class="entry-label">Username:</span><span class="entry-value">${escapeHtml(entry.username)}</span></div>`;
                if (entry.name) html += `<div class="entry-field"><span class="entry-label">Name:</span><span class="entry-value">${escapeHtml(entry.name)}</span></div>`;
                if (entry.database_name) html += `<div class="entry-field"><span class="entry-label">Database:</span><span class="entry-value">${escapeHtml(entry.database_name)}</span></div>`;
                
                html += `</div>`;
            });

            html += `</div>`;
        }
    }

    if (!hasConnections) {
        html += `<p style="color: var(--text-secondary);">No connections found between initial query and related terms.</p>`;
    }

    html += `</div>`;

    resultsContent.innerHTML = html;
}

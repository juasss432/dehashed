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
let lastSearchResults = null;

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

// Helper to safely convert to lowercase string
function safeToLower(value) {
    return value ? String(value).toLowerCase() : null;
}

// Helper to check if a term appears in a password
function passwordContains(password, term) {
    if (!password || !term) return false;
    const pwLower = String(password).toLowerCase();
    const termLower = String(term).toLowerCase();
    return pwLower.includes(termLower);
}

// Export functions
function exportToJSON() {
    if (!lastSearchResults) return;
    
    const dataStr = JSON.stringify(lastSearchResults, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dehashed_results_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

function exportToCSV() {
    if (!lastSearchResults) return;
    
    const allEntries = [];
    
    // Add initial results
    lastSearchResults.initialResults.entries.forEach(entry => {
        allEntries.push({
            source: 'Initial Search',
            email: entry.email || '',
            username: entry.username || '',
            name: entry.name || '',
            phone: entry.phone || '',
            address: entry.address || '',
            ip_address: entry.ip_address || '',
            password: entry.password || '',
            hashed_password: entry.hashed_password || '',
            database_name: entry.database_name || ''
        });
    });
    
    // Add related results
    for (const [term, data] of Object.entries(lastSearchResults.connectionMap)) {
        data.entries.forEach(entry => {
            allEntries.push({
                source: `Related: ${term}`,
                email: entry.email || '',
                username: entry.username || '',
                name: entry.name || '',
                phone: entry.phone || '',
                address: entry.address || '',
                ip_address: entry.ip_address || '',
                password: entry.password || '',
                hashed_password: entry.hashed_password || '',
                database_name: entry.database_name || ''
            });
        });
    }
    
    if (allEntries.length === 0) return;
    
    // Create CSV
    const headers = Object.keys(allEntries[0]);
    const csvRows = [headers.join(',')];
    
    allEntries.forEach(entry => {
        const values = headers.map(header => {
            const val = String(entry[header] || '');
            return `"${val.replace(/"/g, '""')}"`;
        });
        csvRows.push(values.join(','));
    });
    
    const csvStr = csvRows.join('\n');
    const dataBlob = new Blob([csvStr], { type: 'text/csv' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dehashed_results_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
            ips: new Set(),
            addresses: new Set()
        };

        initialResults.entries.forEach(entry => {
            const email = safeToLower(entry.email);
            const username = safeToLower(entry.username);
            const name = safeToLower(entry.name);
            const address = safeToLower(entry.address);
            
            if (email) connections.emails.add(email);
            if (username) connections.usernames.add(username);
            if (name) connections.names.add(name);
            if (entry.phone) connections.phones.add(entry.phone);
            if (entry.ip_address) connections.ips.add(entry.ip_address);
            if (address) connections.addresses.add(address);
        });

        // Search related terms
        const connectionMap = {};
        for (const term of relatedTerms) {
            const result = await dehashedSearch(term);
            if (result.entries && result.entries.length > 0) {
                connectionMap[term] = {
                    entries: result.entries,
                    connections: {
                        email: new Set(),
                        username: new Set(),
                        name: new Set(),
                        phone: new Set(),
                        ip: new Set(),
                        address: new Set(),
                        password: new Set()
                    }
                };

                result.entries.forEach(entry => {
                    const email = safeToLower(entry.email);
                    const username = safeToLower(entry.username);
                    const name = safeToLower(entry.name);
                    const address = safeToLower(entry.address);
                    
                    if (email && connections.emails.has(email)) {
                        connectionMap[term].connections.email.add(entry.email);
                    }
                    if (username && connections.usernames.has(username)) {
                        connectionMap[term].connections.username.add(entry.username);
                    }
                    if (name && connections.names.has(name)) {
                        connectionMap[term].connections.name.add(entry.name);
                    }
                    if (entry.phone && connections.phones.has(entry.phone)) {
                        connectionMap[term].connections.phone.add(entry.phone);
                    }
                    if (entry.ip_address && connections.ips.has(entry.ip_address)) {
                        connectionMap[term].connections.ip.add(entry.ip_address);
                    }
                    if (address && connections.addresses.has(address)) {
                        connectionMap[term].connections.address.add(entry.address);
                    }
                    
                    // CHECK PASSWORD CONTENTS
                    initialResults.entries.forEach(initEntry => {
                        if (passwordContains(initEntry.password, term)) {
                            connectionMap[term].connections.password.add(initEntry.password);
                        }
                    });
                });
            }
        }

        // Store results for export
        lastSearchResults = {
            initialQuery,
            initialResults,
            connectionMap,
            connections
        };

        // Display results
        displayResults(initialQuery, initialResults, connectionMap, connections);

    } catch (error) {
        resultsContent.innerHTML = `<div class="error">ERROR: ${escapeHtml(error.message)}</div>`;
    }

    btn.disabled = false;
    btn.textContent = 'Find Connections';
});

function displayResults(query, initialResults, connectionMap, discoveredConnections) {
    const resultsContent = document.getElementById('resultsContent');
    let html = '';

    // Export buttons
    html += `<div style="display: flex; gap: 12px; margin-bottom: 24px;">`;
    html += `<button class="btn" onclick="exportToJSON()" style="padding: 12px 24px; font-size: 14px;">Export JSON</button>`;
    html += `<button class="btn" onclick="exportToCSV()" style="padding: 12px 24px; font-size: 14px;">Export CSV</button>`;
    html += `</div>`;

    // Initial results
    html += `<div class="result-section">`;
    html += `<div class="result-header">Initial Search: ${escapeHtml(query)}</div>`;
    html += `<p style="color: var(--text-secondary); margin-bottom: 20px;">Found ${initialResults.entries.length} entries</p>`;

    // Show what identifiers were discovered
    html += `<div style="background: rgba(220, 20, 60, 0.05); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 20px;">`;
    html += `<div style="font-weight: 600; margin-bottom: 12px; color: var(--accent);">Discovered Identifiers:</div>`;
    
    if (discoveredConnections.emails.size > 0) {
        html += `<div style="margin-bottom: 8px;"><span style="color: var(--text-secondary);">Emails:</span> `;
        html += Array.from(discoveredConnections.emails).map(e => `<span class="connection-badge">${escapeHtml(e)}</span>`).join('');
        html += `</div>`;
    }
    if (discoveredConnections.usernames.size > 0) {
        html += `<div style="margin-bottom: 8px;"><span style="color: var(--text-secondary);">Usernames:</span> `;
        html += Array.from(discoveredConnections.usernames).map(u => `<span class="connection-badge">${escapeHtml(u)}</span>`).join('');
        html += `</div>`;
    }
    if (discoveredConnections.names.size > 0) {
        html += `<div style="margin-bottom: 8px;"><span style="color: var(--text-secondary);">Names:</span> `;
        html += Array.from(discoveredConnections.names).map(n => `<span class="connection-badge">${escapeHtml(n)}</span>`).join('');
        html += `</div>`;
    }
    if (discoveredConnections.phones.size > 0) {
        html += `<div style="margin-bottom: 8px;"><span style="color: var(--text-secondary);">Phones:</span> `;
        html += Array.from(discoveredConnections.phones).map(p => `<span class="connection-badge">${escapeHtml(p)}</span>`).join('');
        html += `</div>`;
    }
    if (discoveredConnections.ips.size > 0) {
        html += `<div style="margin-bottom: 8px;"><span style="color: var(--text-secondary);">IPs:</span> `;
        html += Array.from(discoveredConnections.ips).map(ip => `<span class="connection-badge">${escapeHtml(ip)}</span>`).join('');
        html += `</div>`;
    }
    if (discoveredConnections.addresses.size > 0) {
        html += `<div style="margin-bottom: 8px;"><span style="color: var(--text-secondary);">Addresses:</span> `;
        html += Array.from(discoveredConnections.addresses).slice(0, 3).map(a => `<span class="connection-badge">${escapeHtml(a)}</span>`).join('');
        if (discoveredConnections.addresses.size > 3) {
            html += `<span style="color: var(--text-secondary); font-size: 12px;"> +${discoveredConnections.addresses.size - 3} more</span>`;
        }
        html += `</div>`;
    }
    
    if (discoveredConnections.emails.size === 0 && discoveredConnections.names.size === 0 && 
        discoveredConnections.phones.size === 0 && discoveredConnections.ips.size === 0) {
        html += `<p style="color: var(--text-secondary); font-size: 14px;">Only username found. Try searching for associated emails, names, or phone numbers.</p>`;
    }
    
    html += `</div>`;

    initialResults.entries.slice(0, 10).forEach((entry, i) => {
        html += `<div class="entry-item">`;
        html += `<div style="font-weight: 600; margin-bottom: 12px; color: var(--accent);">Entry ${i + 1}</div>`;
        
        if (entry.email) html += `<div class="entry-field"><span class="entry-label">Email:</span><span class="entry-value">${escapeHtml(entry.email)}</span></div>`;
        if (entry.username) html += `<div class="entry-field"><span class="entry-label">Username:</span><span class="entry-value">${escapeHtml(entry.username)}</span></div>`;
        if (entry.name) html += `<div class="entry-field"><span class="entry-label">Name:</span><span class="entry-value">${escapeHtml(entry.name)}</span></div>`;
        if (entry.phone) html += `<div class="entry-field"><span class="entry-label">Phone:</span><span class="entry-value">${escapeHtml(entry.phone)}</span></div>`;
        if (entry.address) html += `<div class="entry-field"><span class="entry-label">Address:</span><span class="entry-value">${escapeHtml(entry.address)}</span></div>`;
        if (entry.vin) html += `<div class="entry-field"><span class="entry-label">VIN:</span><span class="entry-value">${escapeHtml(entry.vin)}</span></div>`;
        if (entry.ip_address) html += `<div class="entry-field"><span class="entry-label">IP:</span><span class="entry-value">${escapeHtml(entry.ip_address)}</span></div>`;
        if (entry.password) html += `<div class="entry-field"><span class="entry-label">Password:</span><span class="entry-value">${escapeHtml(entry.password)}</span></div>`;
        if (entry.hashed_password) {
            const hashStr = String(entry.hashed_password);
            const displayHash = hashStr.length > 50 ? hashStr.substring(0, 50) + '...' : hashStr;
            html += `<div class="entry-field"><span class="entry-label">Hash:</span><span class="entry-value">${escapeHtml(displayHash)}</span></div>`;
        }
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
            html += `<h3 style="color: var(--accent); font-size: 18px; margin-bottom: 16px;">✓ Connections found for: ${escapeHtml(term)}</h3>`;

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
            data.entries.slice(0, 5).forEach((entry, i) => {
                html += `<div class="entry-item" style="margin-top: 12px;">`;
                html += `<div style="font-weight: 600; margin-bottom: 8px; color: var(--text-secondary);">Sample Entry ${i + 1}</div>`;
                
                if (entry.email) html += `<div class="entry-field"><span class="entry-label">Email:</span><span class="entry-value">${escapeHtml(entry.email)}</span></div>`;
                if (entry.username) html += `<div class="entry-field"><span class="entry-label">Username:</span><span class="entry-value">${escapeHtml(entry.username)}</span></div>`;
                if (entry.name) html += `<div class="entry-field"><span class="entry-label">Name:</span><span class="entry-value">${escapeHtml(entry.name)}</span></div>`;
                if (entry.phone) html += `<div class="entry-field"><span class="entry-label">Phone:</span><span class="entry-value">${escapeHtml(entry.phone)}</span></div>`;
                if (entry.password) html += `<div class="entry-field"><span class="entry-label">Password:</span><span class="entry-value">${escapeHtml(entry.password)}</span></div>`;
                if (entry.database_name) html += `<div class="entry-field"><span class="entry-label">Database:</span><span class="entry-value">${escapeHtml(entry.database_name)}</span></div>`;
                
                html += `</div>`;
            });

            html += `</div>`;
        } else {
            // Show that we searched but found no connections
            html += `<div style="margin-bottom: 24px;">`;
            html += `<h3 style="color: var(--text-secondary); font-size: 18px; margin-bottom: 12px;">✗ No connections for: ${escapeHtml(term)}</h3>`;
            html += `<p style="color: var(--text-secondary); font-size: 14px;">Found ${data.entries.length} entries, but none share identifiers with your initial search.</p>`;
            html += `</div>`;
        }
    }

    if (!hasConnections) {
        html += `<div style="background: rgba(220, 20, 60, 0.05); border: 1px solid var(--border); border-radius: 12px; padding: 20px;">`;
        html += `<p style="color: var(--text-secondary); margin-bottom: 12px;">No connections found between initial query and related terms.</p>`;
        html += `<p style="color: var(--text-secondary); font-size: 14px;">This means the related terms you searched don't share any emails, usernames, names, phones, IPs, or password content with your initial search.</p>`;
        html += `</div>`;
    }

    html += `</div>`;

    resultsContent.innerHTML = html;
}

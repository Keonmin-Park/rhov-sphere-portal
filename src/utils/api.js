// ==========================================
// RHOV Sphere REST API Client
// ==========================================

export async function fetchInventory() {
  const res = await fetch('/api/v1/inventory');
  if (!res.ok) throw new Error(`Failed to fetch inventory (${res.status})`);
  return res.json();
}

export async function fetchNamespaces() {
  const res = await fetch('/api/v1/namespaces');
  if (!res.ok) throw new Error(`Failed to fetch namespaces (${res.status})`);
  return res.json();
}

export async function createNamespace(payload) {
  const res = await fetch('/api/v1/namespaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function fetchOverview() {
  const res = await fetch('/api/v1/overview');
  if (!res.ok) throw new Error(`Failed to fetch overview (${res.status})`);
  return res.json();
}

export async function fetchVm(id) {
  const res = await fetch(`/api/v1/vm/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to fetch VM details (${res.status})`);
  return res.json();
}

export async function powerVm(id, action) {
  const res = await fetch(`/api/v1/vm/${encodeURIComponent(id)}/power`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  });
  return res.json();
}

export async function updateHardware(id, payload) {
  const res = await fetch(`/api/v1/vm/${encodeURIComponent(id)}/hardware`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function createVm(payload) {
  const res = await fetch('/api/v1/vm/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function deleteVm(id, deleteDisks = false) {
  const res = await fetch(`/api/v1/vm/${encodeURIComponent(id)}?deleteDisks=${deleteDisks ? 'true' : 'false'}`, {
    method: 'DELETE'
  });
  return res.json();
}

export async function createSnapshot(id, name, desc, includeMemory = false) {
  const res = await fetch(`/api/v1/vm/${encodeURIComponent(id)}/snapshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, desc, includeMemory: !!includeMemory })
  });
  return res.json();
}

export async function revertSnapshot(id, snapId) {
  const res = await fetch(`/api/v1/vm/${encodeURIComponent(id)}/snapshot/${encodeURIComponent(snapId)}/revert`, {
    method: 'POST'
  });
  return res.json();
}

export async function deleteSnapshot(id, snapName) {
  const res = await fetch(`/api/v1/vm/${encodeURIComponent(id)}/snapshot/${encodeURIComponent(snapName)}`, {
    method: 'DELETE'
  });
  return res.json();
}

export async function migrateVm(id, targetNode) {
  const res = await fetch(`/api/v1/vm/${encodeURIComponent(id)}/migrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetNode })
  });
  return res.json();
}

export async function toggleMaintenance(nodeName) {
  const res = await fetch(`/api/v1/host/${encodeURIComponent(nodeName)}/maintenance`, {
    method: 'POST'
  });
  return res.json();
}

export async function connectCluster(apiUrl, token) {
  const res = await fetch('/api/v1/cluster/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiUrl, token })
  });
  return res.json();
}

export function openWebConsole(vm) {
  if (!vm) return;
  const url = `/console.html?vm=${encodeURIComponent(vm.name)}&node=${encodeURIComponent(vm.node || '')}&os=${encodeURIComponent(vm.os || '')}`;
  const width = Math.min(1380, window.screen.availWidth - 80);
  const height = Math.min(920, window.screen.availHeight - 80);
  const left = Math.round((window.screen.availWidth - width) / 2);
  const top = Math.round((window.screen.availHeight - height) / 2);

  const consoleWin = window.open(
    url,
    `rhov_console_${vm.name}`,
    `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes`
  );

  if (consoleWin) {
    consoleWin.focus();
  } else {
    window.open(url, '_blank');
  }
}

export async function cloneVm(id, { newName, targetNamespace, storageClass, cloneType, autoStart }) {
  const res = await fetch(`/api/v1/vm/${encodeURIComponent(id)}/clone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      newName,
      targetNamespace,
      storageClass,
      cloneType,
      autoStart
    })
  });
  return res.json();
}

export async function fetchVmMetrics(id, range = '1h') {
  const res = await fetch(`/api/v1/vm/${encodeURIComponent(id)}/metrics?range=${encodeURIComponent(range)}`);
  if (!res.ok) throw new Error(`Failed to fetch VM metrics (${res.status})`);
  return res.json();
}


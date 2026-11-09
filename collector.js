import http from 'http';
import https from 'https';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';

// ==========================================
// RHOV Cluster Collector Sidecar Agent
// ==========================================
const PORT = process.env.COLLECTOR_PORT || 4001;

let liveConfig = {
  apiUrl: process.env.OPENSHIFT_API_URL || process.env.KUBERNETES_API_URL || '',
  token: process.env.OPENSHIFT_TOKEN || process.env.KUBERNETES_TOKEN || ''
};

// 1) OpenShift / K8s In-Cluster Pod Auth (/var/run/secrets/kubernetes.io/serviceaccount/token)
try {
  const inClusterTokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
  if (fs.existsSync(inClusterTokenPath)) {
    liveConfig.token = fs.readFileSync(inClusterTokenPath, 'utf8').trim();
    if (!liveConfig.apiUrl) {
      const k8sHost = process.env.KUBERNETES_SERVICE_HOST || 'kubernetes.default.svc';
      const k8sPort = process.env.KUBERNETES_SERVICE_PORT || '443';
      liveConfig.apiUrl = `https://${k8sHost}:${k8sPort}`;
    }
    console.log(`[Collector Auth] Using in-cluster ServiceAccount token on ${liveConfig.apiUrl}`);
  }
} catch (e) {
  console.warn('[Collector Auth] In-cluster token lookup error:', e.message);
}

// In-Memory Synchronized State
let clusterState = {
  datacenter: {
    id: 'dc-01',
    name: 'Enterprise-Seoul-DC (Live OCP)',
    location: 'Seoul IDC 2F, RHOV Zone',
    status: 'Healthy',
    vCenterCompatibility: 'ESXi 8.0 Update 2 Equivalent'
  },
  cluster: {
    id: 'cluster-01',
    name: 'rhov-prod-cluster',
    type: 'OpenShift Compact 3-Node (Master + Worker)',
    ocpVersion: 'OpenShift 4.22 (KubeVirt Live)',
    haEnabled: true,
    liveMigrationEnabled: true,
    totalCpuCores: 48,
    usedCpuCores: 18,
    totalMemoryGb: 192,
    usedMemoryGb: 88,
    totalStorageTb: 6.0,
    usedStorageTb: 2.2
  },
  nodes: [],
  vms: [],
  datastores: [
    {
      id: 'ds-01',
      name: 'thin-csi',
      type: 'VMware vSphere CSI (VMFS)',
      capacityTb: 4.5,
      freeTb: 2.8,
      provisioning: 'Thin Provisioned (RWO Block)',
      rwxSupported: false,
      liveMigrationReady: false,
      desc: 'vSphere ESXi VMFS 기반 단일 노드 전용(RWO) 블록 볼륨 (Live Migration 불가 / Cold Migration 전용)'
    },
    {
      id: 'ds-02',
      name: 'nfs-rwx-storage',
      type: 'NFS Shared (ReadWriteMany)',
      capacityTb: 1.5,
      freeTb: 1.0,
      provisioning: 'Shared Multi-Attach (RWX)',
      rwxSupported: true,
      liveMigrationReady: true,
      desc: '다중 VM 및 노드 동시 마운트 지원으로 vMotion 무중단 실시간 마이그레이션(Live Migration) 가능'
    }
  ],
  networks: [
    {
      id: 'net-01',
      name: 'ovn-kubernetes',
      type: 'Cluster Default CNI',
      cidr: '10.128.0.0/14',
      vlan: 'Overlay Geneve',
      desc: 'OpenShift 내부 포드 및 VM 기본 인터커넥트 네트워크'
    },
    {
      id: 'net-02',
      name: 'corp-vlan200-bridge',
      type: 'Multus Linux Bridge CNI',
      cidr: '192.168.10.0/24',
      vlan: '200 (외부 사내 업무망)',
      desc: 'vSphere 기존 가상머신과 동일한 L2 브로드캐스트 도메인 직접 연결'
    }
  ],
  tasks: [],
  events: [],
  namespaces: []
};

// Raw KubeVirt cache maps
const rawVms = new Map();       // name -> VirtualMachine CR
const rawVmis = new Map();      // name -> VirtualMachineInstance CR
const rawSnaps = new Map();     // snapName -> VirtualMachineSnapshot CR
const rawNodes = new Map();     // nodeName -> Node CR
const rawPvcs = new Map();      // pvcName -> PersistentVolumeClaim
const rawScs = new Map();       // scName -> StorageClass

// K8s HTTP/HTTPS Request Helper
async function k8sRequest(path) {
  if (!liveConfig.token) return null;
  const urlObj = new URL(liveConfig.apiUrl);
  return new Promise((resolve) => {
    const req = https.request({
      hostname: urlObj.hostname,
      port: urlObj.port ? parseInt(urlObj.port) : (urlObj.protocol === 'https:' ? 443 : 80),
      path: path,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + liveConfig.token,
        'Accept': 'application/json'
      },
      rejectUnauthorized: false,
      timeout: 6000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// Thanos / Prometheus Query
async function thanosQuery(query) {
  if (!liveConfig.token) return [];
  const thanosHostname = process.env.THANOS_INGRESS_IP || process.env.THANOS_HOST || 'thanos-querier.openshift-monitoring.svc';
  const thanosPort = parseInt(process.env.THANOS_PORT || '9091', 10);
  const thanosHostHeader = process.env.THANOS_ROUTE_HOST || thanosHostname;
  return new Promise((resolve) => {
    const req = https.request({
      hostname: thanosHostname,
      port: thanosPort,
      path: '/api/v1/query?query=' + encodeURIComponent(query),
      headers: {
        'Host': thanosHostHeader,
        'Authorization': 'Bearer ' + liveConfig.token
      },
      rejectUnauthorized: false,
      timeout: 3000
    }, res => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => {
        try {
          const json = JSON.parse(b);
          resolve((json.data && json.data.result) ? json.data.result : []);
        } catch(e) { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
    req.on('timeout', () => { req.destroy(); resolve([]); });
    req.end();
  });
}

// Helper to parse K8s memory strings to GB (e.g., '16Gi', '4096Mi', '17179869184')
function parseMemoryToGb(val) {
  if (!val) return 4;
  const str = String(val);
  const m = str.match(/([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z]*)/);
  if (!m) return 4;
  const num = parseFloat(m[1]);
  const unit = (m[2] || '').toLowerCase();
  if (unit.startsWith('m')) return Math.round(num / 1024) || 1;
  if (unit.startsWith('g')) return Math.round(num);
  if (unit.startsWith('t')) return Math.round(num * 1024);
  if (num > 1024 * 1024) return Math.round(num / (1024 * 1024 * 1024));
  return Math.round(num);
}

// Helper to parse K8s storage strings to GB (e.g., '100Gi', '107374182400')
function parseStorageToGb(val) {
  if (!val) return 30;
  const str = String(val);
  const m = str.match(/([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z]*)/);
  if (!m) return 30;
  const num = parseFloat(m[1]);
  const unit = (m[2] || '').toLowerCase();
  if (unit.startsWith('m')) return Math.round(num / 1024) || 1;
  if (unit.startsWith('g')) return Math.round(num);
  if (unit.startsWith('t')) return Math.round(num * 1024);
  if (num > 1024 * 1024) return Math.round(num / (1024 * 1024 * 1024));
  return Math.round(num);
}

function buildNormalizedNode(n) {
  const name = n.metadata?.name || 'unknown';
  const isMaster = name.includes('master');
  const cpuCap = parseInt(n.status?.capacity?.cpu || '16');
  const memKi = parseInt(n.status?.capacity?.memory ? n.status.capacity.memory.replace('Ki', '') : '67108864') || 67108864;
  const memCap = Math.round(memKi / 1024 / 1024);
  const readyCond = n.status?.conditions?.find(c => c.type === 'Ready');
  const isReady = readyCond?.status === 'True';
  const isCordoned = !!n.spec?.unschedulable;

  let status = isReady ? 'Ready' : 'NotReady';
  if (isCordoned) status = 'Maintenance';

  return {
    id: name,
    name: name,
    isMaster,
    role: isMaster ? 'Control Plane, Master' : 'Worker (ESXi Host)',
    status: status,
    ip: n.status?.addresses?.find(a => a.type === 'InternalIP')?.address || '192.168.100.x',
    kvmAccel: 'Nested VT-x Active (/dev/kvm)',
    cpuCores: cpuCap,
    cpuUsedPct: 15,
    memoryGb: memCap,
    memoryUsedGb: Math.round(memCap * 0.35),
    uptime: '28일 10시간',
    maintenanceMode: isCordoned,
    vmCount: clusterState.vms ? clusterState.vms.filter(v => v.node === name).length : 0
  };
}

// Normalized VM Builder from raw KubeVirt VM and VMI
function buildNormalizedVm(name) {
  const vmObj = rawVms.get(name);
  if (!vmObj) return null;

  const vmiObj = rawVmis.get(name);
  const isRunning = !!vmiObj && vmiObj.status?.phase === 'Running';

  // 1. Precise OpenShift printableStatus
  let status = 'Stopped';
  if (vmObj.metadata?.deletionTimestamp) {
    status = 'Deleting';
  } else if (vmiObj?.status?.migrationState && (vmiObj.status.migrationState.startTimestamp && !vmiObj.status.migrationState.endTimestamp)) {
    status = 'Migrating';
  } else if (vmObj.status?.printableStatus) {
    status = vmObj.status.printableStatus;
  } else if (vmiObj) {
    status = vmiObj.status?.phase || 'Running';
  }

  // 2. OS Details
  let osType = 'linux';
  let osName = 'Red Hat Enterprise Linux';
  if (vmiObj?.status?.guestOSInfo) {
    const g = vmiObj.status.guestOSInfo;
    osName = g.prettyName || g.version || g.name || osName;
    if (g.id === 'mswindows' || (g.name && g.name.includes('Windows'))) {
      osType = 'windows';
    }
  } else if (name.includes('win')) {
    osType = 'windows';
    osName = 'Microsoft Windows';
  } else if (name.includes('rocky')) {
    osType = 'linux';
    osName = 'Rocky Linux 9.x';
  } else if (name.includes('rhel')) {
    osType = 'rhel';
    osName = 'Red Hat Enterprise Linux 8.10';
  }

  // 3. Hardware Compute Specs
  let vCpu = 2;
  let memoryGb = 4;
  const cpuSpec = vmiObj?.spec?.domain?.cpu || vmObj.spec?.template?.spec?.domain?.cpu || {};
  vCpu = (cpuSpec.cores || 1) * (cpuSpec.sockets || 1) * (cpuSpec.threads || 1);

  const memGuest = vmiObj?.spec?.domain?.memory?.guest || vmObj.spec?.template?.spec?.domain?.memory?.guest;
  const memReq = vmiObj?.spec?.domain?.resources?.requests?.memory || vmObj.spec?.template?.spec?.domain?.resources?.requests?.memory;
  memoryGb = parseMemoryToGb(memGuest || memReq || 4);

  // 4. Disks from Volumes & volumeStatus (Dynamically resolved from DataVolumeTemplates, PVCs, and Datastores)
  let disks = [];
  const specVolumes = vmObj.spec?.template?.spec?.volumes || [];
  const vmiVolStatuses = vmiObj?.status?.volumeStatus || [];
  const dataVolumeTemplates = vmObj.spec?.dataVolumeTemplates || [];

  // Default virtual storageclass fallback (dynamically discovered from cluster)
  const defaultVirtSc = clusterState.datastores?.find(d => d.isDefaultVirt)?.storageClass ||
                        clusterState.datastores?.find(d => d.rwxSupported && (d.name.includes('rbd') || d.name.includes('ceph') || d.name.includes('ocs')))?.storageClass ||
                        clusterState.datastores?.[0]?.storageClass ||
                        'ocs-storagecluster-ceph-rbd';

  if (specVolumes.length > 0) {
    disks = specVolumes.map(sv => {
      const vmiVol = vmiVolStatuses.find(v => v.name === sv.name);
      let sizeGb = 30;
      let pvcName = sv.persistentVolumeClaim ? sv.persistentVolumeClaim.claimName : (sv.dataVolume ? sv.dataVolume.name : sv.name);
      let accessMode = 'ReadWriteMany';
      let sc = '';

      // 1) Match from VM's dataVolumeTemplates
      const dvt = dataVolumeTemplates.find(t => 
        t.metadata?.name === (sv.dataVolume?.name || sv.name) || 
        t.metadata?.name === pvcName ||
        pvcName?.startsWith(t.metadata?.name || '___')
      );
      if (dvt?.spec?.storage) {
        if (dvt.spec.storage.storageClassName) sc = dvt.spec.storage.storageClassName;
        if (dvt.spec.storage.accessModes?.[0]) accessMode = dvt.spec.storage.accessModes[0];
        if (dvt.spec.storage.resources?.requests?.storage) sizeGb = parseStorageToGb(dvt.spec.storage.resources.requests.storage);
      }

      // 2) Match from live VMI VolumeStatus
      if (vmiVol?.persistentVolumeClaimInfo) {
        pvcName = vmiVol.persistentVolumeClaimInfo.claimName || pvcName;
        if (vmiVol.persistentVolumeClaimInfo.capacity?.storage) {
          sizeGb = parseStorageToGb(vmiVol.persistentVolumeClaimInfo.capacity.storage);
        }
        if (vmiVol.persistentVolumeClaimInfo.accessModes?.[0]) {
          accessMode = vmiVol.persistentVolumeClaimInfo.accessModes[0];
        }
      }

      // 3) Match from real K8s PVC cache
      const realPvc = rawPvcs.get(pvcName) || rawPvcs.get(`${vmObj.metadata?.namespace || 'default'}/${pvcName}`);
      if (realPvc) {
        if (realPvc.spec?.storageClassName) sc = realPvc.spec.storageClassName;
        if (realPvc.spec?.accessModes?.[0]) accessMode = realPvc.spec.accessModes[0];
        if (realPvc.spec?.resources?.requests?.storage) sizeGb = parseStorageToGb(realPvc.spec.resources.requests.storage);
      }

      // 4) Dynamic Fallback if not explicitly found
      if (!sc) {
        if (pvcName && pvcName.includes('nfs')) {
          sc = 'nfs-rwx';
          accessMode = 'ReadWriteMany';
        } else if (pvcName && (pvcName.includes('thin') || pvcName.includes('vsphere'))) {
          sc = 'thin-csi';
          accessMode = 'ReadWriteOnce';
        } else {
          sc = defaultVirtSc;
          const dsMeta = clusterState.datastores?.find(d => d.storageClass === sc || d.name === sc);
          if (dsMeta?.rwxSupported) accessMode = 'ReadWriteMany';
        }
      }

      return {
        name: `${sv.name} (${vmiVol ? (vmiVol.target || 'virtio') : 'virtio'})`,
        pvc: pvcName,
        sizeGb: sizeGb,
        sc: sc,
        accessMode: accessMode
      };
    });
  } else {
    disks = [{ name: 'rootdisk (vda)', pvc: `pvc-${name}-root`, sizeGb: 30, sc: defaultVirtSc, accessMode: 'ReadWriteMany' }];
  }

  // 5. NICs & IPs
  let nics = [];
  let primaryIp = '-';
  let podIp = '-';
  const specNetworks = vmObj.spec?.template?.spec?.networks || [];
  const vmiInterfaces = vmiObj?.status?.interfaces || [];
  if (specNetworks.length > 0) {
    nics = specNetworks.map((net, iIdx) => {
      const iface = vmiInterfaces.find(i => i.name === net.name) || vmiInterfaces[iIdx] || {};
      const isMultus = net.multus || (net.name !== 'default' && net.name !== 'net-0');
      return {
        name: `vnic${iIdx} (${net.name})`,
        network: isMultus ? 'default/physnet (Multus L2)' : 'ovn-kubernetes (Default Pod)',
        ip: iface.ipAddress || (iface.ipAddresses ? iface.ipAddresses[0] : '-'),
        mac: iface.mac || '52:54:00:xx:xx:xx'
      };
    });
    primaryIp = nics[0]?.ip !== '-' ? nics[0]?.ip : (nics[1]?.ip || '-');
    podIp = nics.length > 1 && nics[1]?.ip !== '-' ? nics[1]?.ip : primaryIp;
  }

  // 6. Uptime
  let uptime = 'Offline';
  if (vmiObj?.metadata?.creationTimestamp) {
    const diffMs = Date.now() - new Date(vmiObj.metadata.creationTimestamp).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    uptime = `${diffDays > 0 ? diffDays + '일 ' : ''}${diffHours}시간 ${diffMins}분`;
  }

  // 7. Snapshots for this VM
  const vmSnaps = [];
  rawSnaps.forEach(s => {
    if (s.spec?.source?.name === name) {
      const memAnno = s.metadata?.annotations?.['rhov.kubevirt.io/include-memory'];
      const hasMem = memAnno === 'true';
      vmSnaps.push({
        id: s.metadata.name,
        name: s.metadata.name,
        time: s.status?.creationTime?.substring(0, 16).replace('T', ' ') || s.metadata?.creationTimestamp?.substring(0, 16).replace('T', ' ') || '방금 전',
        created: s.status?.creationTime?.substring(0, 16).replace('T', ' ') || s.metadata?.creationTimestamp?.substring(0, 16).replace('T', ' ') || '방금 전',
        desc: (s.status?.readyToUse ? 'CSI 스냅샷 준비 완료 (Ready)' : '스냅샷 생성 완료') + (s.status?.virtualMachineSnapshotContentName ? ` | ${s.status.virtualMachineSnapshotContentName}` : ''),
        includeMemory: hasMem,
        memoryIncluded: hasMem,
        sizeGb: disks[0]?.sizeGb || 30,
        ready: s.status?.readyToUse ?? true
      });
    }
  });

  // Preserve existing metrics or default
  const oldVm = clusterState.vms.find(v => v.name === name);
  const metrics = oldVm?.metrics || {
    cpuUsagePct: isRunning ? 0.8 : 0,
    cpuMhz: isRunning ? 35 : 0,
    memoryUsagePct: isRunning ? 12.0 : 0,
    memoryUsedGb: isRunning ? 0.4 : 0,
    diskIops: isRunning ? 180 : 0,
    networkKbps: isRunning ? 50 : 0
  };

  const liveMigratableCond = vmiObj?.status?.conditions?.find(c => c.type === 'LiveMigratable');
  const isLiveMigratable = liveMigratableCond 
    ? (liveMigratableCond.status === 'True')
    : (disks.length > 0 && disks.every(d => d.accessMode === 'ReadWriteMany' || (d.sc && !d.sc.toLowerCase().includes('thin'))));

  return {
    id: name, // CRITICAL: Persistent ID bound to VM Name, never index!
    name: name,
    namespace: vmObj.metadata?.namespace || 'default',
    os: osName,
    osType: osType,
    status: status,
    node: vmiObj?.status?.nodeName || 'Unassigned',
    ip: primaryIp,
    podIp: podIp,
    vCpu: vCpu,
    memoryGb: memoryGb,
    uptime: uptime,
    liveMigratable: isLiveMigratable,
    guestAgent: {
      installed: !!vmiObj?.status?.guestOSInfo,
      version: 'VirtIO Guest Agent',
      status: vmiObj?.status?.guestOSInfo ? 'Active (Connected)' : 'Not Reporting / Inactive'
    },
    metrics: metrics,
    disks: disks,
    nics: nics,
    snapshots: vmSnaps
  };
}

// Refresh full clusterState.vms from maps
function recomputeAllVms() {
  const updatedVms = [];
  rawVms.forEach((_, name) => {
    const norm = buildNormalizedVm(name);
    if (norm) updatedVms.push(norm);
  });
  clusterState.vms = updatedVms;
  updateClusterCounters();
}

function updateClusterCounters() {
  // Update node VM counts
  clusterState.nodes.forEach(n => {
    n.vmCount = clusterState.vms.filter(v => v.node === n.name).length;
  });
  clusterState.cluster.totalCpuCores = clusterState.nodes.reduce((acc, n) => acc + (n.cpuCores || 16), 0) || 48;
  clusterState.cluster.totalMemoryGb = clusterState.nodes.reduce((acc, n) => acc + (n.memoryGb || 64), 0) || 192;
}

// ==========================================
// WebSocket Broadcasting to Portal & Clients
// ==========================================
const clients = new Set();

function broadcastEvent(type, payload) {
  const msg = JSON.stringify({
    type,
    payload,
    timestamp: new Date().toISOString()
  });
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

// ==========================================
// K8s Watch Streams Manager (Zero Polling!)
// ==========================================
const keepAliveAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 15000,
  rejectUnauthorized: false
});

function startWatcher(path, name, onAddOrModify, onDelete) {
  if (!liveConfig.token) return;
  const urlObj = new URL(liveConfig.apiUrl);

  console.log(`[Watcher] Starting K8s Watch stream on ${name} (${path})...`);
  let streamReq = null;

  function connect() {
    streamReq = https.request({
      agent: keepAliveAgent,
      hostname: urlObj.hostname,
      port: urlObj.port ? parseInt(urlObj.port) : (urlObj.protocol === 'https:' ? 443 : 80),
      path: `${path}?watch=true`,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + liveConfig.token,
        'Accept': 'application/json'
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        console.warn(`[Watcher] ${name} stream HTTP ${res.statusCode}. Retrying in 4s...`);
        setTimeout(connect, 4000);
        return;
      }
      console.log(`[Watcher] ${name} watch stream ACTIVE (200 OK). Zero-polling live events enabled.`);

      let buffer = '';
      res.on('data', chunk => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep last incomplete line

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const ev = JSON.parse(line);
            const evType = ev.type; // ADDED, MODIFIED, DELETED
            const obj = ev.object;
            if (!obj) continue;

            if (evType === 'DELETED') {
              onDelete(obj);
            } else if (evType === 'ADDED' || evType === 'MODIFIED') {
              onAddOrModify(evType, obj);
            }
          } catch (err) {
            // json parse error on incomplete chunk, ignore
          }
        }
      });

      res.on('end', () => {
        console.log(`[Watcher] ${name} stream ended by server. Reconnecting in 1s...`);
        setTimeout(connect, 1000);
      });
    });

    streamReq.on('error', (err) => {
      console.warn(`[Watcher Error] ${name}: ${err.message}. Reconnecting in 3s...`);
      setTimeout(connect, 3000);
    });

    streamReq.end();
  }

  connect();
}

// Dynamic Datastores Resolver
function updateDatastoresFromSc(scData, pvData) {
  if (!scData?.items || scData.items.length === 0) return;
  // Filter out non-VM / duplicate storage classes (virtualization duplicate, rgw, cephfs, noobaa)
  const candidateScs = scData.items.filter(sc => {
    const scName = (sc.metadata?.name || '').toLowerCase();
    if (scName.includes('virtualization') || scName.includes('rgw') || scName.includes('cephfs') || scName.includes('noobaa')) {
      return false;
    }
    return true;
  });

  clusterState.datastores = candidateScs.map(sc => {
    const scName = sc.metadata?.name || 'default';
    const provisioner = sc.provisioner || '';
    const anno = sc.metadata?.annotations || {};
    
    const isCephRbd = provisioner.includes('rbd') || scName.includes('ceph-rbd') || (scName.includes('ceph') && !scName.includes('cephfs') && !scName.includes('rgw'));
    const isNfs = provisioner.includes('nfs') || scName.includes('nfs');
    const isThinOrVsphere = (provisioner.includes('vsphere') || scName.includes('vsphere') || scName.includes('thin')) && !isCephRbd;

    const isDefaultVirt = anno['storageclass.kubevirt.io/is-default-virt-class'] === 'true' || anno['storageclass.kubernetes.io/is-default-class'] === 'true' || isCephRbd;
    const isDefault = anno['storageclass.kubernetes.io/is-default-class'] === 'true';

    let dsType = 'Kubernetes StorageClass (CSI)';
    let isRwx = false;
    if (isCephRbd) {
      dsType = 'Red Hat OpenShift Data Foundation (Ceph RBD)';
      isRwx = true;
    } else if (isThinOrVsphere) {
      dsType = 'VMware vSphere CSI (VMFS / vSAN)';
      isRwx = false;
    } else if (isNfs) {
      dsType = 'NFS Shared (ReadWriteMany)';
      isRwx = true;
    }

    const matchingPvs = (pvData && pvData.items) ? pvData.items.filter(pv => pv.spec?.storageClassName === scName) : [];
    matchingPvs.forEach(pv => {
      if (!isThinOrVsphere && pv.spec?.accessModes?.includes('ReadWriteMany')) {
        isRwx = true;
      }
    });

    if (isThinOrVsphere) {
      isRwx = false;
    }

    let totalAllocatedGb = 0;
    matchingPvs.forEach(pv => {
      const capStr = pv.spec?.capacity?.storage || '10Gi';
      const m = capStr.match(/([0-9]+)/);
      if (m) {
        const num = parseInt(m[1]);
        if (capStr.includes('Ti') || capStr.includes('T')) totalAllocatedGb += num * 1024;
        else totalAllocatedGb += num;
      }
    });

    const baseCapacityTb = isCephRbd ? 5.0 : (isThinOrVsphere ? 7.2 : 2.0);
    const capacityTb = Math.max(baseCapacityTb, Math.round(((totalAllocatedGb * 1.5) / 1024) * 10) / 10);
    const usedTb = Math.round((totalAllocatedGb / 1024) * 10) / 10;
    const freeTb = Math.max(0.1, Math.round((capacityTb - usedTb) * 10) / 10);

    const attachedVms = clusterState.vms.filter(v => (v.disks || []).some(d => d.sc === scName)).map(v => ({
      id: v.id,
      name: v.name,
      namespace: v.namespace,
      sizeGb: v.disks.find(d => d.sc === scName)?.sizeGb || 30,
      accessMode: isThinOrVsphere ? 'ReadWriteOnce' : (isRwx ? 'ReadWriteMany' : 'ReadWriteOnce'),
      node: v.node,
      status: v.status
    }));

    return {
      id: `ds-${scName}`,
      name: scName,
      type: dsType,
      storageClass: scName,
      provisioner,
      isDefaultVirt,
      isDefault,
      capacityTb,
      usedTb,
      freeTb,
      capacityGb: Math.round(capacityTb * 1024),
      usedGb: totalAllocatedGb,
      freeGb: Math.round(freeTb * 1024),
      provisioning: isCephRbd ? 'Ceph RBD Block (RWX / Live Migration 최적화)' : (isThinOrVsphere ? 'Thin Provisioned (RWO Block)' : (isRwx ? 'Shared Multi-Attach (RWX)' : 'Thin Provisioned (RWO)')),
      rwxSupported: isRwx,
      liveMigrationReady: isRwx,
      vmCount: attachedVms.length,
      vms: attachedVms,
      desc: isCephRbd
        ? 'Red Hat OpenShift Data Foundation Ceph RBD 분산 블록 스토리지 (RWX 실시간 무중단 Live Migration 및 CoW 고속 스냅샷 완벽 지원)'
        : (isThinOrVsphere
          ? 'vSphere ESXi VMFS 기반 단일 노드 전용(RWO) 블록 볼륨 (Live Migration 불가 / Multi-Attach 충돌 / Cold Migration 전용)'
          : (isRwx ? '실시간 무중단 마이그레이션(Live Migration) 가능' : '단일 노드 전용(RWO) 블록 볼륨'))
    };
  });
}

// Initial Sync + Start Watchers
async function initializeCollector() {
  console.log('[Collector] Loading initial cluster snapshot from OpenShift API...');
  const [nodes, vms, vmis, snaps, initialEvents, projects, scData, pvData, pvcData, nadData] = await Promise.all([
    k8sRequest('/api/v1/nodes'),
    k8sRequest('/apis/kubevirt.io/v1/virtualmachines'),
    k8sRequest('/apis/kubevirt.io/v1/virtualmachineinstances'),
    k8sRequest('/apis/snapshot.kubevirt.io/v1beta1/virtualmachinesnapshots')
      .then(r => (r && r.items) ? r : k8sRequest('/apis/snapshot.kubevirt.io/v1alpha1/virtualmachinesnapshots')),
    k8sRequest('/api/v1/namespaces/default/events'),
    k8sRequest('/apis/project.openshift.io/v1/projects')
      .then(r => (r && r.items) ? r : k8sRequest('/api/v1/namespaces')),
    k8sRequest('/apis/storage.k8s.io/v1/storageclasses'),
    k8sRequest('/api/v1/persistentvolumes'),
    k8sRequest('/api/v1/persistentvolumeclaims'),
    k8sRequest('/apis/k8s.cni.cncf.io/v1/network-attachment-definitions')
  ]);

  if (pvcData?.items) {
    pvcData.items.forEach(pvc => {
      const name = pvc.metadata?.name;
      const ns = pvc.metadata?.namespace || 'default';
      if (name) {
        rawPvcs.set(name, pvc);
        rawPvcs.set(`${ns}/${name}`, pvc);
      }
    });
  }

  if (scData?.items) {
    scData.items.forEach(sc => {
      if (sc.metadata?.name) rawScs.set(sc.metadata.name, sc);
    });
  }

  if (nodes?.items) {
    nodes.items.forEach(n => rawNodes.set(n.metadata.name, n));
    clusterState.nodes = nodes.items.map(n => buildNormalizedNode(n));

    // Dynamic OpenShift cluster version lookup
    try {
      const cv = await k8sRequest('/apis/config.openshift.io/v1/clusterversions/version');
      const ver = cv?.status?.desired?.version || cv?.status?.history?.[0]?.version;
      if (ver) {
        clusterState.cluster.ocpVersion = `OpenShift ${ver} (KubeVirt Live)`;
      } else if (nodes.items[0]?.status?.nodeInfo?.kubeletVersion) {
        clusterState.cluster.ocpVersion = `OpenShift 4.22 (KubeVirt Live / ${nodes.items[0].status.nodeInfo.kubeletVersion})`;
      }
    } catch (e) {
      // fallback
    }
  }

  if (vms?.items) {
    vms.items.forEach(vm => rawVms.set(vm.metadata.name, vm));
  }
  if (vmis?.items) {
    vmis.items.forEach(vmi => rawVmis.set(vmi.metadata.name, vmi));
  }
  if (snaps?.items) {
    snaps.items.forEach(snap => rawSnaps.set(snap.metadata.name, snap));
  }

  if (projects?.items) {
    clusterState.namespaces = projects.items.map(p => {
      const name = p.metadata?.name || 'default';
      const displayName = p.metadata?.annotations?.['openshift.io/display-name'] || name;
      const isSystem = name.startsWith('openshift-') || name.startsWith('kube-') || name === 'openshift';
      return {
        name,
        displayName,
        description: p.metadata?.annotations?.['openshift.io/description'] || '',
        isSystem,
        status: p.status?.phase || 'Active'
      };
    });
  }

  if (initialEvents?.items) {
    const sorted = initialEvents.items.sort((a, b) => new Date(b.lastTimestamp || b.eventTime || 0) - new Date(a.lastTimestamp || a.eventTime || 0));
    clusterState.events = sorted.slice(0, 30).map(e => ({
      time: (e.lastTimestamp ? e.lastTimestamp.substring(11, 19) : (e.eventTime ? e.eventTime.substring(11, 19) : '12:00:00')),
      type: e.type || 'Normal',
      object: e.involvedObject ? e.involvedObject.name : (e.metadata ? e.metadata.name : 'Cluster'),
      message: e.message || e.reason || 'KubeVirt Event'
    }));
  }

  // Dynamic Datastores Resolution from StorageClasses and PVs
  updateDatastoresFromSc(scData, pvData);

  // Recompute VMs after datastores are dynamically established
  recomputeAllVms();

  const detectedNets = [
    {
      id: 'net-ovn-default',
      name: 'ovn-kubernetes',
      type: 'Cluster Default CNI (OVN)',
      isDefault: true,
      vlan: 'Overlay Geneve (VNI 4096)',
      cidr: '10.128.0.0/14',
      uplink: 'bond0 (Physical 10GbE Trunk)',
      desc: 'OpenShift 내부 포드 및 VM 기본 인터커넥트 네트워크',
      vms: clusterState.vms.filter(v => (v.nics || []).some(n => n.network.includes('ovn') || n.network.includes('Default') || n.network.includes('default'))).map(v => ({
        id: v.id,
        name: v.name,
        namespace: v.namespace,
        ip: v.ip || v.podIp,
        mac: v.nics?.[0]?.mac || '52:54:00:xx:xx:xx',
        node: v.node,
        status: v.status
      }))
    }
  ];

  if (nadData && nadData.items && nadData.items.length > 0) {
    nadData.items.forEach(nad => {
      const nadName = nad.metadata?.name || 'net';
      const nadNs = nad.metadata?.namespace || 'default';
      const attachedVms = clusterState.vms.filter(v => (v.nics || []).some(n => n.network.includes(nadName))).map(v => ({
        id: v.id,
        name: v.name,
        namespace: v.namespace,
        ip: v.ip,
        mac: v.nics?.[0]?.mac || '52:54:00:xx:xx:xx',
        node: v.node,
        status: v.status
      }));
      detectedNets.push({
        id: `net-${nadNs}-${nadName}`,
        name: nadName,
        namespace: nadNs,
        type: 'Multus L2 Bridge CNI',
        isDefault: false,
        vlan: '200 (외부 사내 업무망)',
        cidr: '192.168.10.0/24',
        uplink: 'ens192 / vmnic0 (Physical L2 Trunk)',
        desc: 'vSphere 기존 가상머신과 동일한 L2 브로드캐스트 도메인 직접 연결',
        vms: attachedVms
      });
    });
  }
  clusterState.networks = detectedNets;

  console.log(`[Collector Initialized] Loaded ${rawVms.size} VMs, ${rawNodes.size} Nodes, ${clusterState.datastores.length} Datastores, ${clusterState.networks.length} Networks.`);

  // 1. Watch VirtualMachines (Instant Detection of oc delete / oc create / spec changes)
  startWatcher(
    '/apis/kubevirt.io/v1/virtualmachines',
    'VirtualMachines',
    (evType, vm) => {
      const name = vm.metadata?.name;
      if (!name) return;
      rawVms.set(name, vm);
      const normVm = buildNormalizedVm(name);
      if (normVm) {
        const idx = clusterState.vms.findIndex(v => v.name === name);
        if (idx >= 0) clusterState.vms[idx] = normVm;
        else clusterState.vms.unshift(normVm);
        updateClusterCounters();
        broadcastEvent(evType === 'ADDED' ? 'VM_ADDED' : 'VM_MODIFIED', normVm);
        console.log(`[Live Watcher] VM '${name}' ${evType} -> Status: ${normVm.status}`);
      }
    },
    (vm) => {
      const name = vm.metadata?.name;
      if (!name) return;
      rawVms.delete(name);
      rawVmis.delete(name);
      clusterState.vms = clusterState.vms.filter(v => v.name !== name);
      updateClusterCounters();
      broadcastEvent('VM_DELETED', { name, id: name });
      console.log(`[Live Watcher] 🔥 VM '${name}' DELETED on OpenShift -> Instantly evicted from portal.`);
    }
  );

  // 2. Watch VirtualMachineInstances (Instant Detection of Power On / Off / Crash / Phase)
  startWatcher(
    '/apis/kubevirt.io/v1/virtualmachineinstances',
    'VMIs',
    (evType, vmi) => {
      const name = vmi.metadata?.name;
      if (!name) return;
      rawVmis.set(name, vmi);
      const normVm = buildNormalizedVm(name);
      if (normVm) {
        const idx = clusterState.vms.findIndex(v => v.name === name);
        if (idx >= 0) clusterState.vms[idx] = normVm;
        updateClusterCounters();
        broadcastEvent('VM_MODIFIED', normVm);
      }
    },
    (vmi) => {
      const name = vmi.metadata?.name;
      if (!name) return;
      rawVmis.delete(name);
      const normVm = buildNormalizedVm(name);
      if (normVm) {
        const idx = clusterState.vms.findIndex(v => v.name === name);
        if (idx >= 0) clusterState.vms[idx] = normVm;
        updateClusterCounters();
        broadcastEvent('VM_MODIFIED', normVm);
        console.log(`[Live Watcher] VMI '${name}' DELETED -> VM is now Stopped`);
      }
    }
  );

  // 3. Watch Snapshots (Zero-latency snapshot create / ready / delete reflection)
  startWatcher(
    '/apis/snapshot.kubevirt.io/v1beta1/virtualmachinesnapshots',
    'Snapshots',
    (evType, snap) => {
      const snapName = snap.metadata?.name;
      const vmName = snap.spec?.source?.name;
      if (!snapName) return;
      rawSnaps.set(snapName, snap);
      if (vmName) {
        const normVm = buildNormalizedVm(vmName);
        if (normVm) {
          const idx = clusterState.vms.findIndex(v => v.name === vmName);
          if (idx >= 0) clusterState.vms[idx] = normVm;
          broadcastEvent('SNAPSHOT_CHANGED', { vmName, snapshot: snap, vm: normVm });
          console.log(`[Live Watcher] Snapshot '${snapName}' for VM '${vmName}' ${evType} (Ready: ${snap.status?.readyToUse ?? false})`);
        }
      }
    },
    (snap) => {
      const snapName = snap.metadata?.name;
      const vmName = snap.spec?.source?.name;
      if (!snapName) return;
      rawSnaps.delete(snapName);
      if (vmName) {
        const normVm = buildNormalizedVm(vmName);
        if (normVm) {
          const idx = clusterState.vms.findIndex(v => v.name === vmName);
          if (idx >= 0) clusterState.vms[idx] = normVm;
          broadcastEvent('SNAPSHOT_CHANGED', { vmName, deletedSnapName: snapName, vm: normVm });
          console.log(`[Live Watcher] Snapshot '${snapName}' DELETED`);
        }
      }
    }
  );

  // 4. Watch Cluster Nodes (Ready, NotReady, Maintenance mode live reflection)
  startWatcher(
    '/api/v1/nodes',
    'Nodes',
    (evType, node) => {
      const nodeName = node.metadata?.name;
      if (!nodeName) return;
      rawNodes.set(nodeName, node);
      const normNode = buildNormalizedNode(node);
      const idx = clusterState.nodes.findIndex(n => n.name === nodeName);
      if (idx >= 0) clusterState.nodes[idx] = normNode;
      else clusterState.nodes.push(normNode);
      updateClusterCounters();
      broadcastEvent('NODE_CHANGED', normNode);
    },
    (node) => {
      const nodeName = node.metadata?.name;
      if (!nodeName) return;
      rawNodes.delete(nodeName);
      clusterState.nodes = clusterState.nodes.filter(n => n.name !== nodeName);
      updateClusterCounters();
      broadcastEvent('NODE_CHANGED', { name: nodeName, deleted: true });
    }
  );

  // 5. Watch Live Migrations (vMotion live progress)
  startWatcher(
    '/apis/kubevirt.io/v1/virtualmachineinstancemigrations',
    'Migrations',
    (evType, mig) => {
      const vmiName = mig.spec?.vmiName;
      const phase = mig.status?.phase;
      if (!vmiName) return;
      console.log(`[Live Watcher] Migration for '${vmiName}' -> Phase: ${phase}`);
      const normVm = buildNormalizedVm(vmiName);
      if (normVm) {
        if (phase === 'Running' || phase === 'PreparingTarget' || phase === 'TargetReady') {
          normVm.status = 'Migrating';
        }
        const idx = clusterState.vms.findIndex(v => v.name === vmiName);
        if (idx >= 0) clusterState.vms[idx] = normVm;
        broadcastEvent('VM_MODIFIED', normVm);
      }
    },
    (mig) => {}
  );

  // 6. Watch Cluster Events
  startWatcher(
    '/api/v1/events',
    'Events',
    (evType, ev) => {
      const involved = ev.involvedObject;
      if (!involved || (involved.kind !== 'VirtualMachine' && involved.kind !== 'VirtualMachineInstance' && involved.kind !== 'VirtualMachineSnapshot')) {
        return;
      }
      const eventItem = {
        time: (ev.lastTimestamp ? ev.lastTimestamp.substring(11, 19) : (ev.eventTime ? ev.eventTime.substring(11, 19) : new Date().toLocaleTimeString('ko-KR'))),
        type: ev.type || 'Normal',
        object: involved.name || 'Cluster',
        message: ev.message || ev.reason || 'KubeVirt Event'
      };
      clusterState.events.unshift(eventItem);
      if (clusterState.events.length > 50) clusterState.events.pop();
      broadcastEvent('EVENT_ADDED', eventItem);
    },
    () => {}
  );

  // 7. Watch OpenShift Projects (Zero-polling detection of oc new-project / delete)
  startWatcher(
    '/apis/project.openshift.io/v1/projects',
    'Projects',
    (evType, proj) => {
      const name = proj.metadata?.name;
      if (!name) return;
      const displayName = proj.metadata?.annotations?.['openshift.io/display-name'] || name;
      const isSystem = name.startsWith('openshift-') || name.startsWith('kube-') || name === 'openshift';
      const entry = {
        name,
        displayName,
        description: proj.metadata?.annotations?.['openshift.io/description'] || '',
        isSystem,
        status: proj.status?.phase || 'Active'
      };
      if (!clusterState.namespaces) clusterState.namespaces = [];
      const idx = clusterState.namespaces.findIndex(n => n.name === name);
      if (idx >= 0) clusterState.namespaces[idx] = entry;
      else clusterState.namespaces.push(entry);

      broadcastEvent('NAMESPACES_UPDATED', { action: evType, namespace: entry, namespaces: clusterState.namespaces });
      console.log(`[Live Watcher] Project '${name}' ${evType}`);
    },
    (proj) => {
      const name = proj.metadata?.name;
      if (!name) return;
      if (clusterState.namespaces) {
        clusterState.namespaces = clusterState.namespaces.filter(n => n.name !== name);
      }
      broadcastEvent('NAMESPACES_UPDATED', { action: 'DELETED', name, namespaces: clusterState.namespaces });
      console.log(`[Live Watcher] Project '${name}' DELETED`);
    }
  );

  // 8. Watch StorageClasses (Dynamic addition/removal of ODF, CSI storageclasses)
  startWatcher(
    '/apis/storage.k8s.io/v1/storageclasses',
    'StorageClasses',
    async (evType, sc) => {
      const scName = sc.metadata?.name;
      if (!scName) return;
      rawScs.set(scName, sc);
      const [newScData, newPvData] = await Promise.all([
        k8sRequest('/apis/storage.k8s.io/v1/storageclasses'),
        k8sRequest('/api/v1/persistentvolumes')
      ]);
      if (newScData?.items) {
        updateDatastoresFromSc(newScData, newPvData);
        recomputeAllVms();
        broadcastEvent('DATASTORES_UPDATED', clusterState.datastores);
        broadcastEvent('ALL_DATA', clusterState);
        console.log(`[Live Watcher] StorageClass '${scName}' ${evType} -> Datastores dynamically refreshed.`);
      }
    },
    async (sc) => {
      const scName = sc.metadata?.name;
      if (!scName) return;
      rawScs.delete(scName);
      clusterState.datastores = clusterState.datastores.filter(d => d.name !== scName);
      recomputeAllVms();
      broadcastEvent('DATASTORES_UPDATED', clusterState.datastores);
      console.log(`[Live Watcher] StorageClass '${scName}' DELETED`);
    }
  );

  // 9. Watch PersistentVolumeClaims (Dynamic disk PVC binding & accessMode reflection)
  startWatcher(
    '/api/v1/persistentvolumeclaims',
    'PVCs',
    (evType, pvc) => {
      const name = pvc.metadata?.name;
      const ns = pvc.metadata?.namespace || 'default';
      if (!name) return;
      rawPvcs.set(name, pvc);
      rawPvcs.set(`${ns}/${name}`, pvc);
      recomputeAllVms();
      broadcastEvent('ALL_DATA', clusterState);
    },
    (pvc) => {
      const name = pvc.metadata?.name;
      const ns = pvc.metadata?.namespace || 'default';
      if (!name) return;
      rawPvcs.delete(name);
      rawPvcs.delete(`${ns}/${name}`);
      recomputeAllVms();
    }
  );

  // 4. Lightweight Thanos Metrics Poll (every 3 seconds, low load)
  setInterval(async () => {
    try {
      const [tCpu, tMemUsed, tNet] = await Promise.all([
        thanosQuery('rate(kubevirt_vmi_cpu_usage_seconds_total[5m])'),
        thanosQuery('kubevirt_vmi_memory_used_bytes'),
        thanosQuery('sum by (name) (rate(kubevirt_vmi_network_traffic_bytes_total[5m]))')
      ]);

      let changed = false;
      clusterState.vms.forEach(vm => {
        if (vm.status !== 'Running') return;
        const cpuMetric = (tCpu || []).find(r => r.metric?.name === vm.name);
        const memMetric = (tMemUsed || []).find(r => r.metric?.name === vm.name);
        const netMetric = (tNet || []).find(r => r.metric?.name === vm.name);

        if (cpuMetric?.value) {
          const usedCores = parseFloat(cpuMetric.value[1]) || 0;
          vm.metrics.cpuUsagePct = Math.round((usedCores / vm.vCpu) * 1000) / 10;
          vm.metrics.cpuMhz = Math.round(usedCores * 2500);
          changed = true;
        }
        if (memMetric?.value) {
          const memUsedBytes = parseFloat(memMetric.value[1]) || 0;
          vm.metrics.memoryUsedGb = Math.round((memUsedBytes / 1024 / 1024 / 1024) * 10) / 10;
          vm.metrics.memoryUsagePct = Math.round((vm.metrics.memoryUsedGb / vm.memoryGb) * 100);
          changed = true;
        }
        if (netMetric?.value) {
          vm.metrics.networkKbps = Math.round((parseFloat(netMetric.value[1]) / 1024) * 10) / 10;
          changed = true;
        }
      });

      if (changed) {
        broadcastEvent('METRICS_UPDATED', clusterState.vms.map(v => ({ name: v.name, metrics: v.metrics })));
      }
    } catch (e) {
      // quiet catch on metrics query
    }
  }, 3000);
}

// ==========================================
// HTTP Server & WebSocket Event Stream
// ==========================================
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), vms: clusterState.vms.length }));
    return;
  }

  if (url.pathname === '/state') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(clusterState));
    return;
  }

  if (url.pathname.startsWith('/state/vm/')) {
    const vmName = decodeURIComponent(url.pathname.replace('/state/vm/', ''));
    const vm = clusterState.vms.find(v => v.name === vmName || v.id === vmName);
    if (!vm) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'VM not found' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(vm));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[Collector WS] Client connected (Total: ${clients.size})`);

  // Send initial full state immediately on connection
  ws.send(JSON.stringify({
    type: 'INITIAL_STATE',
    payload: clusterState,
    timestamp: new Date().toISOString()
  }));

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[Collector WS] Client disconnected (Remaining: ${clients.size})`);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`  ⚡ RHOV OCP Collector Sidecar Agent Active`);
  console.log(`  🔗 HTTP & WebSocket on http://0.0.0.0:${PORT}`);
  console.log(`  🎯 K8s Event-Driven Watcher: Zero-Polling Live Mode`);
  console.log(`=======================================================`);
  initializeCollector();
});

export { clusterState, broadcastEvent };

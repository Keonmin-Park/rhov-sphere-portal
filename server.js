import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/novnc', express.static(path.join(__dirname, 'node_modules/@novnc/novnc')));

// ==========================================
// In-Memory State for RHOV Enterprise Environment
// ==========================================
let clusterState = {
  datacenter: {
    id: 'dc-01',
    name: 'Enterprise-Seoul-DC',
    location: 'Seoul IDC 2F, RHOV Zone',
    status: 'Healthy',
    vCenterCompatibility: 'ESXi 8.0 Update 2 Equivalent'
  },
  cluster: {
    id: 'cluster-01',
    name: 'rhov-compact-3node',
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
  nodes: [
    {
      id: 'node-01',
      name: 'master-01.rhov.example.local',
      role: 'Control Plane, Worker',
      status: 'Ready',
      ip: '192.168.10.11',
      kvmAccel: 'Nested VT-x Active (/dev/kvm)',
      cpuCores: 16,
      cpuUsedPct: 38,
      memoryGb: 64,
      memoryUsedGb: 32,
      maintenanceMode: false,
      vmCount: 2
    },
    {
      id: 'node-02',
      name: 'master-02.rhov.example.local',
      role: 'Control Plane, Worker',
      status: 'Ready',
      ip: '192.168.10.12',
      kvmAccel: 'Nested VT-x Active (/dev/kvm)',
      cpuCores: 16,
      cpuUsedPct: 45,
      memoryGb: 64,
      memoryUsedGb: 36,
      maintenanceMode: false,
      vmCount: 2
    },
    {
      id: 'node-03',
      name: 'master-03.rhov.example.local',
      role: 'Control Plane, Worker',
      status: 'Ready',
      ip: '192.168.10.13',
      kvmAccel: 'Nested VT-x Active (/dev/kvm)',
      cpuCores: 16,
      cpuUsedPct: 28,
      memoryGb: 64,
      memoryUsedGb: 20,
      maintenanceMode: false,
      vmCount: 1
    }
  ],
  vms: [
    {
      id: 'vm-01',
      name: 'ent-web-prd-01',
      namespace: 'prd-workloads',
      os: 'Red Hat Enterprise Linux 8.10 (Ootpa)',
      osType: 'rhel',
      status: 'Running',
      node: 'master-01.rhov.example.local',
      ip: '192.168.10.150',
      podIp: '10.128.2.45',
      vCpu: 4,
      memoryGb: 8,
      uptime: '18일 7시간 24분',
      guestAgent: {
        installed: true,
        version: '7.2.0',
        status: 'Active (Connected)'
      },
      metrics: {
        cpuUsagePct: 24,
        cpuMhz: 2496,
        memoryUsagePct: 48,
        memoryUsedGb: 3.84,
        diskIops: 320,
        networkKbps: 1850
      },
      disks: [
        { name: 'disk-01 (Boot)', pvc: 'pvc-web-root', sizeGb: 100, sc: 'nfs-rwx-storage', accessMode: 'ReadWriteMany' },
        { name: 'disk-02 (Logs)', pvc: 'pvc-web-logs', sizeGb: 50, sc: 'nfs-rwx-storage', accessMode: 'ReadWriteMany' }
      ],
      nics: [
        { name: 'vnic0', network: 'ovn-kubernetes (Default Pod)', ip: '10.128.2.45', mac: '52:54:00:1a:2b:11' },
        { name: 'vnic1', network: 'corp-vlan200-bridge (Multus L2)', ip: '192.168.10.150', mac: '52:54:00:1a:2b:12' }
      ],
      snapshots: [
        { id: 'snap-01', name: 'pre-patch-kernel-8.10', time: '2026-10-15 14:00', desc: 'RHEL 8.10 커널 업데이트 전 백업 스냅샷' },
        { id: 'snap-02', name: 'golden-image-v1', time: '2026-10-01 09:30', desc: '초기 세팅 완료 골든 이미지' }
      ]
    },
    {
      id: 'vm-02',
      name: 'ent-db-oracle-01',
      namespace: 'prd-workloads',
      os: 'Red Hat Enterprise Linux 9.4 (Plow)',
      osType: 'rhel',
      status: 'Running',
      node: 'master-02.rhov.example.local',
      ip: '192.168.10.155',
      podIp: '10.129.2.88',
      vCpu: 8,
      memoryGb: 32,
      uptime: '34일 12시간 10분',
      guestAgent: {
        installed: true,
        version: '7.2.0',
        status: 'Active (Connected)'
      },
      metrics: {
        cpuUsagePct: 52,
        cpuMhz: 10816,
        memoryUsagePct: 76,
        memoryUsedGb: 24.32,
        diskIops: 2150,
        networkKbps: 4800
      },
      disks: [
        { name: 'disk-01 (Boot)', pvc: 'pvc-oracle-boot', sizeGb: 120, sc: 'nfs-rwx-storage', accessMode: 'ReadWriteMany' },
        { name: 'disk-02 (Data)', pvc: 'pvc-oracle-data', sizeGb: 500, sc: 'odf-ceph-rbd', accessMode: 'ReadWriteMany' }
      ],
      nics: [
        { name: 'vnic0', network: 'ovn-kubernetes (Default Pod)', ip: '10.129.2.88', mac: '52:54:00:2b:3c:01' },
        { name: 'vnic1', network: 'corp-vlan200-bridge (Multus L2)', ip: '192.168.10.155', mac: '52:54:00:2b:3c:02' }
      ],
      snapshots: [
        { id: 'snap-db-01', name: 'weekly-cold-backup', time: '2026-10-18 03:00', desc: '정기 백업 스냅샷' }
      ]
    },
    {
      id: 'vm-03',
      name: 'ent-win2022-ad',
      namespace: 'infra-core',
      os: 'Windows Server 2022 Datacenter',
      osType: 'windows',
      status: 'Running',
      node: 'master-01.rhov.example.local',
      ip: '192.168.10.160',
      podIp: '10.128.2.99',
      vCpu: 4,
      memoryGb: 16,
      uptime: '45일 3시간 12분',
      guestAgent: {
        installed: true,
        version: '7.2.0 (VirtIO Guest Tools)',
        status: 'Active (Connected)'
      },
      metrics: {
        cpuUsagePct: 15,
        cpuMhz: 1560,
        memoryUsagePct: 35,
        memoryUsedGb: 5.6,
        diskIops: 180,
        networkKbps: 640
      },
      disks: [
        { name: 'disk-01 (C: System)', pvc: 'pvc-win-c', sizeGb: 120, sc: 'nfs-rwx-storage', accessMode: 'ReadWriteMany' }
      ],
      nics: [
        { name: 'vnic0', network: 'ovn-kubernetes (Default Pod)', ip: '10.128.2.99', mac: '52:54:00:3c:4d:11' },
        { name: 'vnic1', network: 'corp-vlan200-bridge (Multus L2)', ip: '192.168.10.160', mac: '52:54:00:3c:4d:12' }
      ],
      snapshots: [
        { id: 'snap-ad-01', name: 'ad-forest-initial', time: '2026-09-20 11:00', desc: '도메인 컨트롤러 승격 직후 스냅샷' }
      ]
    },
    {
      id: 'vm-04',
      name: 'ent-cicd-runner',
      namespace: 'dev-tools',
      os: 'Red Hat Enterprise Linux 8.8 (Ootpa)',
      osType: 'rhel',
      status: 'Running',
      node: 'master-03.rhov.example.local',
      ip: '192.168.10.170',
      podIp: '10.130.2.22',
      vCpu: 4,
      memoryGb: 16,
      uptime: '9일 14시간 5분',
      guestAgent: {
        installed: true,
        version: '7.2.0',
        status: 'Active (Connected)'
      },
      metrics: {
        cpuUsagePct: 68,
        cpuMhz: 7072,
        memoryUsagePct: 62,
        memoryUsedGb: 9.92,
        diskIops: 890,
        networkKbps: 3400
      },
      disks: [
        { name: 'disk-01 (Boot/Workspace)', pvc: 'pvc-cicd-disk', sizeGb: 150, sc: 'nfs-rwx-storage', accessMode: 'ReadWriteMany' }
      ],
      nics: [
        { name: 'vnic0', network: 'corp-vlan200-bridge (Multus L2)', ip: '192.168.10.170', mac: '52:54:00:4d:5e:01' }
      ],
      snapshots: []
    },
    {
      id: 'vm-05',
      name: 'ent-stage-app-02',
      namespace: 'stage-test',
      os: 'Rocky Linux 9.3 (Blue Onyx)',
      osType: 'linux',
      status: 'Stopped',
      node: 'master-02.rhov.example.local',
      ip: '192.168.10.180',
      podIp: '-',
      vCpu: 2,
      memoryGb: 4,
      uptime: 'Offline',
      guestAgent: {
        installed: true,
        version: '7.2.0',
        status: 'Inactive (VM Powered Off)'
      },
      metrics: {
        cpuUsagePct: 0,
        cpuMhz: 0,
        memoryUsagePct: 0,
        memoryUsedGb: 0,
        diskIops: 0,
        networkKbps: 0
      },
      disks: [
        { name: 'disk-01 (Boot)', pvc: 'pvc-stage-root', sizeGb: 60, sc: 'nfs-rwx-storage', accessMode: 'ReadWriteMany' }
      ],
      nics: [
        { name: 'vnic0', network: 'corp-vlan200-bridge (Multus L2)', ip: '192.168.10.180', mac: '52:54:00:5e:6f:01' }
      ],
      snapshots: []
    }
  ],
  datastores: [
    {
      id: 'ds-01',
      name: 'thin-csi',
      type: 'VMware vSphere CSI (VMFS)',
      storageClass: 'thin-csi',
      provisioner: 'csi.vsphere.vmware.com',
      capacityGb: 4608,
      freeGb: 2867,
      capacityTb: 4.5,
      usedTb: 1.7,
      freeTb: 2.8,
      rwxSupported: false,
      liveMigrationReady: false,
      provisioning: 'Thin Provisioned (RWO Block)',
      vmCount: 0,
      desc: 'vSphere ESXi VMFS 기반 단일 노드 전용(RWO) 블록 볼륨 (Live Migration 불가 / Cold Migration 전용)'
    },
    {
      id: 'ds-02',
      name: 'nfs-rwx-storage',
      type: 'NFSv4 / NetApp RWX',
      storageClass: 'nfs-client',
      provisioner: 'nfs-subdir-external-provisioner',
      capacityGb: 2048,
      freeGb: 1420,
      capacityTb: 2.0,
      usedTb: 0.6,
      freeTb: 1.4,
      rwxSupported: true,
      liveMigrationReady: true,
      provisioning: 'Shared Multi-Attach (RWX)',
      vmCount: 5,
      desc: '다중 VM 및 노드 동시 마운트 지원으로 vMotion 실시간 마이그레이션(Live Migration) 가능'
    },
    {
      id: 'ds-03',
      name: 'odf-ceph-rbd',
      type: 'Red Hat OpenShift Data Foundation (Ceph)',
      storageClass: 'ocs-storagecluster-ceph-rbd',
      provisioner: 'openshift-storage.rbd.csi.ceph.com',
      capacityGb: 4096,
      freeGb: 2840,
      capacityTb: 4.0,
      usedTb: 1.2,
      freeTb: 2.8,
      rwxSupported: true,
      liveMigrationReady: true,
      provisioning: 'Ceph RBD Multi-Attach (RWX)',
      vmCount: 1,
      desc: 'Red Hat ODF 분산 스토리지 기반 실시간 마이그레이션 지원 풀'
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
  tasks: [
    {
      id: 'task-101',
      name: 'Create VirtualMachineSnapshot (pre-patch-v1)',
      target: 'ent-stage-app-02',
      user: 'admin@example.local',
      status: 'Completed',
      progressPct: 100,
      startTime: '2026-10-20 16:50:12',
      duration: '3초'
    },
    {
      id: 'task-102',
      name: 'VirtualMachine Live Migration (vMotion)',
      target: 'win-jumpbox-01',
      user: 'admin@example.local',
      status: 'Completed',
      progressPct: 100,
      startTime: '2026-10-20 15:30:45',
      duration: '14초 (무중단 0 ms 패킷 손실)'
    },
    {
      id: 'task-103',
      name: 'Power On VirtualMachine',
      target: 'ent-db-oracle-01',
      user: 'admin@example.local',
      status: 'Completed',
      progressPct: 100,
      startTime: '2026-10-20 14:15:20',
      duration: '5초'
    },
    {
      id: 'task-104',
      name: 'Reconfigure Virtual Hardware (vCPU / RAM)',
      target: 'ent-web-prd-01',
      user: 'admin@example.local',
      status: 'Completed',
      progressPct: 100,
      startTime: '2026-10-20 13:40:10',
      duration: '1초'
    },
    {
      id: 'task-105',
      name: 'MTV (Migration Toolkit) Import from VMware vSphere',
      target: 'test-rwx-vm',
      user: 'admin@example.local',
      status: 'Completed',
      progressPct: 100,
      startTime: '2026-10-20 11:20:00',
      duration: '6분 15초'
    }
  ],
  events: [
    { time: '17:15:30', type: 'Normal', object: 'ent-db-oracle-01', message: 'QEMU Guest Agent heartbeat verified healthy.' },
    { time: '16:50:15', type: 'Normal', object: 'ent-stage-app-02', message: 'Snapshot pre-patch-v1 created and bound successfully.' },
    { time: '15:30:59', type: 'Normal', object: 'win-jumpbox-01', message: 'Live migration completed successfully to worker node.' },
    { time: '14:15:25', type: 'Normal', object: 'ent-db-oracle-01', message: 'Domain started (qemu-kvm pid 38491).' },
    { time: '13:40:11', type: 'Normal', object: 'ent-web-prd-01', message: 'VirtualMachine spec updated: vCPU and memory allocation refreshed.' }
  ],
  namespaces: []
};

// Helper: Calculate live VM count and sort namespaces for display
function getComputedNamespaces() {
  const baseList = (clusterState.namespaces && clusterState.namespaces.length > 0)
    ? [...clusterState.namespaces]
    : [
        { name: 'default', displayName: 'default', isSystem: false, status: 'Active' },
        { name: 'openshift-cnv', displayName: 'OpenShift Virtualization Core', isSystem: true, status: 'Active' },
        { name: 'rhov-portal', displayName: 'RHOV Sphere Portal', isSystem: false, status: 'Active' }
      ];

  // Guarantee 'default' exists
  if (!baseList.find(n => n.name === 'default')) {
    baseList.unshift({ name: 'default', displayName: 'default', isSystem: false, status: 'Active' });
  }

  // Also include any namespace present in existing VMs
  (clusterState.vms || []).forEach(v => {
    const ns = v.namespace || 'default';
    if (!baseList.find(n => n.name === ns)) {
      baseList.push({
        name: ns,
        displayName: ns,
        isSystem: ns.startsWith('openshift-') || ns.startsWith('kube-') || ns === 'openshift',
        status: 'Active'
      });
    }
  });

  // Calculate live vmCount for each namespace
  const computed = baseList.map(n => {
    const count = (clusterState.vms || []).filter(v => (v.namespace || 'default') === n.name).length;
    return {
      ...n,
      vmCount: count
    };
  });

  // Sort: default first, then user workloads by vmCount desc, system namespaces last
  computed.sort((a, b) => {
    if (a.name === 'default') return -1;
    if (b.name === 'default') return 1;
    if (a.isSystem !== b.isSystem) return a.isSystem ? 1 : -1;
    if (b.vmCount !== a.vmCount) return b.vmCount - a.vmCount;
    return a.name.localeCompare(b.name);
  });

  return computed;
}

// ==========================================
// REST API Endpoints
// ==========================================

// 1. Get entire inventory tree & cluster overview
app.get('/api/v1/overview', (req, res) => {
  res.json({
    datacenter: clusterState.datacenter,
    cluster: clusterState.cluster,
    nodeCount: clusterState.nodes.length,
    vmCount: clusterState.vms.length,
    runningVms: clusterState.vms.filter(v => v.status === 'Running').length,
    stoppedVms: clusterState.vms.filter(v => v.status === 'Stopped').length,
    tasksCount: clusterState.tasks.length,
    tasks: clusterState.tasks,
    events: clusterState.events
  });
});

// 2. Inventory Tree for Navigation
app.get('/api/v1/inventory', (req, res) => {
  const tree = {
    datacenter: clusterState.datacenter,
    cluster: clusterState.cluster,
    nodes: clusterState.nodes.map(n => ({
      ...n,
      vms: clusterState.vms.filter(v => v.node === n.name)
    })),
    vms: clusterState.vms,
    namespaces: getComputedNamespaces(),
    datastores: clusterState.datastores,
    networks: clusterState.networks,
    tasks: clusterState.tasks,
    events: clusterState.events
  };
  res.json(tree);
});

// 2-1. OpenShift Namespaces / Projects API
app.get('/api/v1/namespaces', (req, res) => {
  res.json(getComputedNamespaces());
});

app.post('/api/v1/namespaces', async (req, res) => {
  const { name, displayName, description } = req.body;
  const cleanName = (name || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (!cleanName) {
    return res.status(400).json({ error: '유효한 프로젝트 이름을 입력해주세요 (영문 소문자, 숫자, 하이픈).' });
  }

  try {
    const projectReq = {
      kind: 'ProjectRequest',
      apiVersion: 'project.openshift.io/v1',
      metadata: { name: cleanName },
      displayName: displayName || cleanName,
      description: description || ''
    };
    let result = await k8sCall('POST', '/apis/project.openshift.io/v1/projectrequests', projectReq);

    if (result.statusCode !== 200 && result.statusCode !== 201) {
      const nsPayload = {
        kind: 'Namespace',
        apiVersion: 'v1',
        metadata: {
          name: cleanName,
          annotations: {
            'openshift.io/display-name': displayName || cleanName,
            'openshift.io/description': description || ''
          }
        }
      };
      result = await k8sCall('POST', '/api/v1/namespaces', nsPayload);
    }

    if (result.statusCode === 200 || result.statusCode === 201) {
      const newEntry = {
        name: cleanName,
        displayName: displayName || cleanName,
        description: description || '',
        isSystem: false,
        vmCount: 0,
        status: 'Active'
      };
      if (!clusterState.namespaces) clusterState.namespaces = [];
      if (!clusterState.namespaces.find(n => n.name === cleanName)) {
        clusterState.namespaces.push(newEntry);
      }
      broadcastToBrowsers({
        type: 'NAMESPACES_UPDATED',
        payload: { action: 'ADDED', namespace: newEntry, namespaces: getComputedNamespaces() }
      });
      return res.json({ success: true, name: cleanName, message: `프로젝트 '${cleanName}'이(가) 성공적으로 생성되었습니다.` });
    } else {
      return res.status(result.statusCode || 500).json({
        error: result.data?.message || result.error || '프로젝트 생성 실패',
        details: result.data
      });
    }
  } catch (err) {
    console.error('[Create Project Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// 2-2. Recent Tasks & Events
app.get('/api/v1/tasks', (req, res) => {
  res.json(clusterState.tasks || []);
});

app.get('/api/v1/events', (req, res) => {
  res.json(clusterState.events || []);
});

// 3. VM List & Single VM Details
app.get('/api/v1/vms', (req, res) => {
  res.json(clusterState.vms);
});

app.get('/api/v1/vm/:id', (req, res) => {
  const vm = clusterState.vms.find(v => v.id === req.params.id || v.name === req.params.id);
  if (!vm) return res.status(404).json({ error: 'VirtualMachine not found' });
  res.json(vm);
});

// 3-1. Time-Series Performance Metrics via Thanos (1h & 24h real telemetry)
app.get('/api/v1/vm/:id/metrics', async (req, res) => {
  try {
    const vm = clusterState.vms.find(v => v.id === req.params.id || v.name === req.params.id);
    if (!vm) return res.status(404).json({ error: 'VirtualMachine not found' });

    const range = req.query.range === '24h' ? '24h' : '1h';
    const now = Math.floor(Date.now() / 1000);
    const duration = range === '24h' ? 86400 : 3600;
    const step = range === '24h' ? 1800 : 120; // 30min for 24h, 2min for 1h
    const start = now - duration;

    const vmName = vm.name;
    const vCpu = vm.vCpu || 2;
    const totalMemGb = vm.memoryGb || 4;

    const [cpuRes, memRes, netRes] = await Promise.all([
      thanosQueryRange(`sum(rate(kubevirt_vmi_cpu_usage_seconds_total{name="${vmName}"}[5m]))`, start, now, step),
      thanosQueryRange(`sum(kubevirt_vmi_memory_used_bytes{name="${vmName}"})`, start, now, step),
      thanosQueryRange(`sum(rate(kubevirt_vmi_network_traffic_bytes_total{name="${vmName}"}[5m]))`, start, now, step)
    ]);

    const rawCpu = (cpuRes[0] && cpuRes[0].values) ? cpuRes[0].values : [];
    const rawMem = (memRes[0] && memRes[0].values) ? memRes[0].values : [];
    const rawNet = (netRes[0] && netRes[0].values) ? netRes[0].values : [];

    const isLiveThanos = rawCpu.length > 0;
    const points = [];

    if (isLiveThanos) {
      const mapMem = new Map(rawMem.map(item => [item[0], parseFloat(item[1]) || 0]));
      const mapNet = new Map(rawNet.map(item => [item[0], parseFloat(item[1]) || 0]));

      for (let i = 0; i < rawCpu.length; i++) {
        const [ts, cVal] = rawCpu[i];
        const coresUsed = parseFloat(cVal) || 0;
        const cpuPct = Math.min(100, Math.max(0, Math.round((coresUsed / vCpu) * 1000) / 10));

        const memBytes = mapMem.get(ts) || 0;
        const memGb = Math.round((memBytes / (1024 * 1024 * 1024)) * 100) / 100;
        const memPct = Math.min(100, Math.max(0, Math.round((memGb / totalMemGb) * 1000) / 10));

        const netBytes = mapNet.get(ts) || 0;
        const netKbps = Math.round((netBytes / 1024) * 10) / 10;

        const d = new Date(ts * 1000);
        const hours = d.getHours().toString().padStart(2, '0');
        const mins = d.getMinutes().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        const timeStr = range === '1h' ? `${hours}:${mins}` : `${month}/${day} ${hours}:${mins}`;
        const fullTimeStr = `${d.getFullYear()}-${month}-${day} ${hours}:${mins}:00`;

        points.push({
          timestamp: ts,
          time: timeStr,
          fullTime: fullTimeStr,
          cpuPct,
          cpuCores: Math.round(coresUsed * 1000) / 1000,
          cpuMhz: Math.round(coresUsed * 2500),
          vCpu,
          memPct,
          memGb,
          memFreeGb: Math.max(0, Math.round((totalMemGb - memGb) * 100) / 100),
          memTotalGb: totalMemGb,
          netKbps
        });
      }
    } else {
      // Graceful fallback if VM is stopped or metrics just initialising
      const count = range === '24h' ? 48 : 30;
      const intervalSec = duration / count;
      const baseCpu = vm.cpuUsedPct || (vm.status === 'Running' ? 12 : 0);
      const baseMem = vm.memoryUsedGb ? Math.round((vm.memoryUsedGb / totalMemGb) * 100) : (vm.status === 'Running' ? 25 : 0);
      const baseNet = vm.networkKbps || (vm.status === 'Running' ? 35 : 0);

      for (let i = count; i >= 0; i--) {
        const ts = now - (i * intervalSec);
        const d = new Date(ts * 1000);
        const hours = d.getHours().toString().padStart(2, '0');
        const mins = d.getMinutes().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        const timeStr = range === '1h' ? `${hours}:${mins}` : `${month}/${day} ${hours}:${mins}`;
        const fullTimeStr = `${d.getFullYear()}-${month}-${day} ${hours}:${mins}:00`;

        const noiseCpu = vm.status === 'Running' ? Math.sin(i * 0.7) * 4 + (Math.random() * 2 - 1) : 0;
        const cpuPct = Math.max(0, Math.min(100, Math.round((baseCpu + noiseCpu) * 10) / 10));
        const coresUsed = Math.round(((cpuPct / 100) * vCpu) * 1000) / 1000;

        const noiseMem = vm.status === 'Running' ? Math.cos(i * 0.4) * 3 : 0;
        const memPct = Math.max(0, Math.min(100, Math.round((baseMem + noiseMem) * 10) / 10));
        const memGb = Math.round(((memPct / 100) * totalMemGb) * 100) / 100;

        const netKbps = vm.status === 'Running' ? Math.max(0, Math.round((baseNet + Math.sin(i * 1.1) * 15) * 10) / 10) : 0;

        points.push({
          timestamp: ts,
          time: timeStr,
          fullTime: fullTimeStr,
          cpuPct,
          cpuCores: coresUsed,
          cpuMhz: Math.round(coresUsed * 2500),
          vCpu,
          memPct,
          memGb,
          memFreeGb: Math.max(0, Math.round((totalMemGb - memGb) * 100) / 100),
          memTotalGb: totalMemGb,
          netKbps
        });
      }
    }

    const lastPt = points[points.length - 1] || {};
    const cpuVals = points.map(p => p.cpuPct);
    const memVals = points.map(p => p.memPct);
    const netVals = points.map(p => p.netKbps);

    const kpis = {
      cpu: {
        currentPct: lastPt.cpuPct !== undefined ? lastPt.cpuPct : (vm.cpuUsedPct || 0),
        currentCores: lastPt.cpuCores !== undefined ? lastPt.cpuCores : 0,
        currentMhz: lastPt.cpuMhz !== undefined ? lastPt.cpuMhz : 0,
        peakPct: cpuVals.length ? Math.max(...cpuVals) : 0,
        avgPct: cpuVals.length ? Math.round((cpuVals.reduce((a, b) => a + b, 0) / cpuVals.length) * 10) / 10 : 0,
        vCpu
      },
      memory: {
        currentPct: lastPt.memPct !== undefined ? lastPt.memPct : 0,
        currentGb: lastPt.memGb !== undefined ? lastPt.memGb : (vm.memoryUsedGb || 0),
        freeGb: lastPt.memFreeGb !== undefined ? lastPt.memFreeGb : totalMemGb,
        peakPct: memVals.length ? Math.max(...memVals) : 0,
        avgPct: memVals.length ? Math.round((memVals.reduce((a, b) => a + b, 0) / memVals.length) * 10) / 10 : 0,
        totalGb: totalMemGb
      },
      network: {
        currentKbps: lastPt.netKbps !== undefined ? lastPt.netKbps : (vm.networkKbps || 0),
        peakKbps: netVals.length ? Math.max(...netVals) : 0,
        avgKbps: netVals.length ? Math.round((netVals.reduce((a, b) => a + b, 0) / netVals.length) * 10) / 10 : 0
      }
    };

    res.json({
      success: true,
      vmId: vm.id,
      vmName: vm.name,
      range,
      isLiveThanos,
      kpis,
      points
    });
  } catch (err) {
    console.error('[VM Metrics Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper for KubeVirt API calls
async function k8sCall(method, path, body = null, contentType = null) {
  if (!liveConfig.token) return { statusCode: 500, error: 'No token configured' };
  const urlObj = new URL(liveConfig.apiUrl);
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const defaultContentType = method === 'PATCH' ? 'application/merge-patch+json' : (body ? 'application/json' : 'text/plain');
    const req = https.request({
      hostname: urlObj.hostname,
      port: urlObj.port ? parseInt(urlObj.port) : (urlObj.protocol === 'https:' ? 443 : 80),
      path: path,
      method: method,
      headers: {
        'Authorization': 'Bearer ' + liveConfig.token,
        'Content-Type': contentType || defaultContentType,
        'Accept': '*/*',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      },
      rejectUnauthorized: false,
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
        } catch(e) {
          resolve({ statusCode: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', (err) => resolve({ statusCode: 500, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ statusCode: 504, error: 'Timeout' }); });
    if (payload) req.write(payload);
    req.end();
  });
}

// 4. Power Operations (Start, Stop, Restart) - Real KubeVirt Subresource & Patch API
app.post('/api/v1/vm/:id/power', async (req, res) => {
  const { action } = req.body;
  const vm = clusterState.vms.find(v => v.id === req.params.id || v.name === req.params.id);
  if (!vm) return res.status(404).json({ error: 'VM not found' });

  const taskId = `task-${Date.now()}`;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  let taskDesc = '';
  let apiResult = null;

  if (action === 'start') {
    taskDesc = `Power On VirtualMachine '${vm.name}'`;
    // 1. Try PATCH running: true (most reliable in KubeVirt)
    apiResult = await k8sCall('PATCH', `/apis/kubevirt.io/v1/namespaces/${vm.namespace}/virtualmachines/${vm.name}`, { spec: { running: true } });
    if (!apiResult || apiResult.statusCode < 200 || apiResult.statusCode >= 300) {
      // Fallback: subresource start
      apiResult = await k8sCall('PUT', `/apis/subresources.kubevirt.io/v1/namespaces/${vm.namespace}/virtualmachines/${vm.name}/start`);
    }
  } else if (action === 'stop' || action === 'shutdown') {
    taskDesc = action === 'shutdown' ? `Guest OS Graceful Shutdown '${vm.name}'` : `Power Off VirtualMachine '${vm.name}'`;
    // 1. Try PATCH running: false (clean shutdown in KubeVirt)
    apiResult = await k8sCall('PATCH', `/apis/kubevirt.io/v1/namespaces/${vm.namespace}/virtualmachines/${vm.name}`, { spec: { running: false } });
    if (!apiResult || apiResult.statusCode < 200 || apiResult.statusCode >= 300) {
      // Fallback: subresource stop
      apiResult = await k8sCall('PUT', `/apis/subresources.kubevirt.io/v1/namespaces/${vm.namespace}/virtualmachines/${vm.name}/stop`);
    }
  } else if (action === 'restart') {
    taskDesc = `Reset / Restart VirtualMachine '${vm.name}'`;
    // Subresource restart
    apiResult = await k8sCall('PUT', `/apis/subresources.kubevirt.io/v1/namespaces/${vm.namespace}/virtualmachines/${vm.name}/restart`);
  }

  const isSuccess = apiResult && apiResult.statusCode >= 200 && apiResult.statusCode < 300;
  console.log(`[Real KubeVirt Power] ${taskDesc} -> HTTP ${apiResult ? apiResult.statusCode : 'Error'}`);

  const newTask = {
    id: taskId,
    name: taskDesc,
    target: vm.name,
    user: 'admin@example.local',
    status: isSuccess ? 'Completed' : (apiResult ? `Failed (HTTP ${apiResult.statusCode})` : 'Completed'),
    progressPct: 100,
    startTime: now,
    duration: '1초'
  };

  clusterState.tasks.unshift(newTask);
  clusterState.events.unshift({
    time: new Date().toLocaleTimeString('ko-KR'),
    type: isSuccess ? 'Normal' : 'Warning',
    object: vm.name,
    message: `${taskDesc} ${isSuccess ? '호출 완료 (KubeVirt 반영 중)' : '실패'}`
  });

  // Re-sync from cluster after short delay
  setTimeout(syncFromLiveCluster, 1500);

  res.json({ success: isSuccess, vm, task: newTask, apiResult });
});

// 4-1. Create VirtualMachine (Real KubeVirt API with DataVolumeTemplate)
app.post('/api/v1/vm/create', async (req, res) => {
  const { name, namespace, osImage, vCpu, memoryGb, diskSizeGb, storageClass, network, autoStart } = req.body;
  const vmName = (name || `vm-${Date.now()}`).toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const ns = namespace || 'default';
  const cpu = parseInt(vCpu) || 2;
  const mem = parseInt(memoryGb) || 4;
  const disk = parseInt(diskSizeGb) || 30;
  const defaultSc = clusterState.datastores?.find(d => d.isDefaultVirt)?.storageClass ||
                    clusterState.datastores?.find(d => d.name.includes('ceph') || d.name.includes('rbd') || d.name.includes('ocs'))?.storageClass ||
                    clusterState.datastores?.[0]?.storageClass ||
                    'ocs-storagecluster-ceph-rbd';
  const sc = storageClass || defaultSc;
  const running = autoStart !== false;
  const os = osImage || 'rhel9';
  const targetNet = network || 'ovn-kubernetes';
  const isMultus = targetNet !== 'ovn-kubernetes' && !targetNet.includes('default');

  // When Multus network is selected, eliminate redundant pod network to prevent unnecessary Pod IP assignment
  const ifaces = isMultus ? [
    { name: 'primary-corp', bridge: {} }
  ] : [
    { name: 'default', masquerade: {} }
  ];

  const nets = isMultus ? [
    { name: 'primary-corp', multus: { networkName: targetNet } }
  ] : [
    { name: 'default', pod: {} }
  ];

  const vmManifest = {
    apiVersion: 'kubevirt.io/v1',
    kind: 'VirtualMachine',
    metadata: {
      name: vmName,
      namespace: ns,
      labels: {
        'app.kubernetes.io/name': vmName,
        'vm.kubevirt.io/template': os
      }
    },
    spec: {
      running: running,
      template: {
        metadata: {
          labels: {
            'kubevirt.io/domain': vmName
          }
        },
        spec: {
          domain: {
            cpu: {
              cores: cpu,
              sockets: 1,
              threads: 1
            },
            resources: {
              requests: {
                memory: `${mem}Gi`
              }
            },
            devices: {
              ...(isMultus ? { autoattachPodInterface: false } : {}),
              disks: [
                {
                  name: 'rootdisk',
                  bootOrder: 1,
                  disk: { bus: 'virtio' }
                },
                {
                  name: 'cloudinitdisk',
                  disk: { bus: 'virtio' }
                }
              ],
              interfaces: ifaces
            }
          },
          networks: nets,
          volumes: [
            {
              name: 'rootdisk',
              dataVolume: {
                name: `${vmName}-volume`
              }
            },
            {
              name: 'cloudinitdisk',
              cloudInitNoCloud: {
                userData: `#cloud-config\nuser: cloud-user\npassword: ${process.env.DEFAULT_VM_PASSWORD || "ChangeMe123!"}\nchpasswd: { expire: False }\n`
              }
            }
          ]
        }
      },
      dataVolumeTemplates: [
        {
          metadata: {
            name: `${vmName}-volume`
          },
          spec: {
            sourceRef: {
              kind: 'DataSource',
              name: os,
              namespace: 'openshift-virtualization-os-images'
            },
            storage: {
              resources: {
                requests: {
                  storage: `${disk}Gi`
                }
              },
              storageClassName: sc,
              accessModes: (sc.includes('ceph') || sc.includes('rbd') || sc.includes('ocs') || sc.includes('nfs')) ? ['ReadWriteMany'] : ['ReadWriteOnce'],
              volumeMode: (sc.includes('ceph') || sc.includes('rbd') || sc.includes('ocs') || sc.includes('thin')) ? 'Block' : 'Filesystem'
            }
          }
        }
      ]
    }
  };

  const apiResult = await k8sCall('POST', `/apis/kubevirt.io/v1/namespaces/${ns}/virtualmachines`, vmManifest);
  const isSuccess = apiResult && apiResult.statusCode >= 200 && apiResult.statusCode < 300;

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  clusterState.tasks.unshift({
    id: `task-create-${Date.now()}`,
    name: `Create VirtualMachine '${vmName}' (${os}, ${cpu} vCPU, ${mem} GB)`,
    target: vmName,
    user: 'admin@example.local',
    status: isSuccess ? 'Completed' : `Failed (HTTP ${apiResult ? apiResult.statusCode : 500})`,
    progressPct: 100,
    startTime: now,
    duration: '2초'
  });

  setTimeout(syncFromLiveCluster, 1500);

  res.json({
    success: isSuccess,
    name: vmName,
    namespace: ns,
    apiResult
  });
});

// 4-2. Delete VirtualMachine (Real KubeVirt API)
app.delete('/api/v1/vm/:id', async (req, res) => {
  const vm = clusterState.vms.find(v => v.id === req.params.id || v.name === req.params.id);
  if (!vm) return res.status(404).json({ error: 'VM not found' });

  const deleteDisks = req.query.deleteDisks === 'true' || req.body?.deleteDisks === true;
  const ns = vm.namespace || 'default';
  const vmName = vm.name;

  // 1. If deleteDisks is requested, delete all associated PVCs and DataVolumes
  let deletedPvcCount = 0;
  if (deleteDisks && vm.disks && vm.disks.length > 0) {
    for (const disk of vm.disks) {
      const pvcName = disk.pvc || disk.claimName;
      if (pvcName && pvcName !== 'cloudinitdisk') {
        try {
          console.log(`[VM Deletion] Deleting associated PVC '${pvcName}' in namespace '${ns}'...`);
          await k8sCall('DELETE', `/api/v1/namespaces/${ns}/persistentvolumeclaims/${pvcName}`);
          await k8sCall('DELETE', `/apis/cdi.kubevirt.io/v1beta1/namespaces/${ns}/datavolumes/${pvcName}`);
          deletedPvcCount++;
        } catch (e) {
          console.warn(`[VM Deletion] Error deleting PVC ${pvcName}:`, e.message);
        }
      }
    }
  }

  // 2. Delete the VirtualMachine object
  const apiResult = await k8sCall('DELETE', `/apis/kubevirt.io/v1/namespaces/${ns}/virtualmachines/${vmName}`);
  const isSuccess = apiResult && ((apiResult.statusCode >= 200 && apiResult.statusCode < 300) || apiResult.statusCode === 404);

  const diskMsg = deleteDisks ? ` (연결된 디스크 PVC ${deletedPvcCount}개 영구 삭제)` : ' (영구 디스크 보존)';
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  clusterState.tasks.unshift({
    id: `task-del-${Date.now()}`,
    name: `Delete VirtualMachine '${vmName}'${diskMsg}`,
    target: vmName,
    user: 'admin@example.local',
    status: isSuccess ? 'Completed' : `Failed (HTTP ${apiResult ? apiResult.statusCode : 500})`,
    progressPct: 100,
    startTime: now,
    duration: '1초'
  });

  clusterState.vms = clusterState.vms.filter(v => v.id !== vm.id && v.name !== vm.name);
  setTimeout(syncFromLiveCluster, 1500);

  res.json({ success: isSuccess, deletedPvcCount, apiResult });
});

// 4-3. Edit Hardware Specs (Zero-Downtime Hotplug for Disks & Live KubeVirt API)
app.patch('/api/v1/vm/:id/hardware', async (req, res) => {
  const { vCpu, memoryGb, disks, nics } = req.body;
  const vm = clusterState.vms.find(v => v.id === req.params.id || v.name === req.params.id);
  if (!vm) return res.status(404).json({ error: 'VM not found' });

  const cpu = parseInt(vCpu) || vm.vCpu;
  const mem = parseInt(memoryGb) || vm.memoryGb;

  let diskChangeDesc = '';
  let nicChangeDesc = '';
  const hotplugOperations = [];

  // Check if VM is currently running in OpenShift
  let isRunning = vm.status === 'Running';
  let liveVmObj = null;
  let liveVmiObj = null;

  if (liveConfig.token) {
    try {
      const [vmRes, vmiRes] = await Promise.all([
        k8sCall('GET', `/apis/kubevirt.io/v1/namespaces/${vm.namespace}/virtualmachines/${vm.name}`),
        k8sCall('GET', `/apis/kubevirt.io/v1/namespaces/${vm.namespace}/virtualmachineinstances/${vm.name}`)
      ]);
      if (vmRes.statusCode === 200 && vmRes.data) liveVmObj = vmRes.data;
      if (vmiRes.statusCode === 200 && vmiRes.data && vmiRes.data.status?.phase === 'Running') {
        liveVmiObj = vmiRes.data;
        isRunning = true;
      } else if (vmiRes.statusCode === 404) {
        isRunning = false;
      }
    } catch (e) {
      console.error('Error fetching live VM/VMI state:', e);
    }
  }

  // Current volumes on live VM or fallback to vm.disks
  const realKubeVolumes = (liveVmObj?.spec?.template?.spec?.volumes || []).map(v => v.name.toLowerCase());
  const existingVolumes = new Set([
    ...realKubeVolumes,
    ...(liveVmiObj?.spec?.volumes || []).map(v => v.name.toLowerCase()),
    ...(vm.disks || []).map(d => (d.name || '').split(' ')[0].toLowerCase().replace(/[^a-z0-9-]/g, '')),
    'rootdisk', 'cloudinitdisk', 'vol-0'
  ]);

  let kubeDisks = [];
  let kubeVolumes = [];

  if (Array.isArray(disks) && disks.length > 0) {
    const oldDiskCount = (vm.disks || []).length;

    // Normalize new disk list
    const defaultDynamicSc = clusterState.datastores?.find(d => d.isDefaultVirt)?.storageClass ||
                             clusterState.datastores?.find(d => d.name.includes('ceph') || d.name.includes('rbd') || d.name.includes('ocs'))?.storageClass ||
                             'ocs-storagecluster-ceph-rbd';

    const normalizedNewDisks = disks.map((d, idx) => {
      let rawName = (d.name || '').split(' ')[0].toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '');
      if (!rawName) rawName = `disk-${idx}`;
      let pvcName = (d.pvc && d.pvc !== '-' && !d.pvc.includes(' ')) ? d.pvc : `${vm.name}-${rawName}`;
      const sizeGb = parseInt(d.sizeGb) || 30;
      const sc = d.sc || defaultDynamicSc;
      const isBoot = idx === 0 || rawName === 'rootdisk' || rawName === 'vol-0' || d.isBoot;
      return { rawName, pvcName, sizeGb, sc, isBoot, originalDisk: d };
    });

    const newRawNames = normalizedNewDisks.map(nd => nd.rawName);

    // 1. Process each incoming disk (Create PVC, Hotplug if running, Expand if larger)
    for (const nd of normalizedNewDisks) {
      const isNewDisk = !existingVolumes.has(nd.rawName.toLowerCase()) && !nd.isBoot && nd.rawName !== 'rootdisk' && nd.rawName !== 'cloudinitdisk';
      const isCeph = nd.sc.includes('ceph') || nd.sc.includes('rbd') || nd.sc.includes('ocs');
      const isNfs = nd.sc.includes('nfs');
      const isThin = nd.sc.includes('thin') || nd.sc.includes('vsphere');

      if (liveConfig.token) {
        try {
          const checkPvc = await k8sCall('GET', `/api/v1/namespaces/${vm.namespace}/persistentvolumeclaims/${nd.pvcName}`);
          if (checkPvc.statusCode === 404) {
            // For live hotplug, Ceph RBD and thin-csi use Block mode. Ceph and NFS support RWX for live migration.
            const volumeMode = (isCeph || isThin) ? 'Block' : 'Filesystem';
            const accessModes = (isCeph || isNfs) ? ['ReadWriteMany'] : ['ReadWriteOnce'];

            console.log(`[Disk Add] Creating PVC ${nd.pvcName} (SC: ${nd.sc}, Mode: ${volumeMode}, Size: ${nd.sizeGb}Gi)`);
            await k8sCall('POST', `/api/v1/namespaces/${vm.namespace}/persistentvolumeclaims`, {
              apiVersion: 'v1',
              kind: 'PersistentVolumeClaim',
              metadata: {
                name: nd.pvcName,
                namespace: vm.namespace
              },
              spec: {
                accessModes: accessModes,
                resources: {
                  requests: {
                    storage: `${nd.sizeGb}Gi`
                  }
                },
                storageClassName: nd.sc,
                volumeMode: volumeMode
              }
            });
          } else if (checkPvc.statusCode === 200 && checkPvc.data && checkPvc.data.spec) {
            // Expand existing PVC if size increased
            const currentSizeStr = checkPvc.data.spec?.resources?.requests?.storage || '';
            const currentSizeNum = parseInt(currentSizeStr) || 0;
            if (nd.sizeGb > currentSizeNum) {
              console.log(`[Disk Expand] Expanding PVC ${nd.pvcName} from ${currentSizeNum}Gi to ${nd.sizeGb}Gi`);
              await k8sCall('PATCH', `/api/v1/namespaces/${vm.namespace}/persistentvolumeclaims/${nd.pvcName}`, {
                spec: {
                  resources: {
                    requests: {
                      storage: `${nd.sizeGb}Gi`
                    }
                  }
                }
              });
            }
          }
        } catch (e) {
          console.error(`Error handling PVC ${nd.pvcName}:`, e);
        }
      }

      // If VM is RUNNING and disk is NEW -> HOTPLUG LIVE WITHOUT REBOOT!
      if (isRunning && isNewDisk && liveConfig.token) {
        console.log(`[Live Hotplug] Hotplugging new disk '${nd.rawName}' into running VM '${vm.name}'`);
        const hotplugRes = await k8sCall('PUT', `/apis/subresources.kubevirt.io/v1/namespaces/${vm.namespace}/virtualmachines/${vm.name}/addvolume`, {
          name: nd.rawName,
          disk: {
            name: nd.rawName,
            disk: { bus: 'scsi' }
          },
          volumeSource: {
            persistentVolumeClaim: { claimName: nd.pvcName }
          }
        });
        hotplugOperations.push({ action: 'add', name: nd.rawName, status: hotplugRes.statusCode });
        console.log(`[Live Hotplug] Hotplug add result: ${hotplugRes.statusCode}`);
      }

      // For spec template
      kubeDisks.push({
        name: nd.rawName,
        disk: { bus: nd.isBoot ? 'virtio' : 'scsi' },
        ...(nd.isBoot ? { bootOrder: 1 } : {})
      });

      kubeVolumes.push({
        name: nd.rawName,
        persistentVolumeClaim: { claimName: nd.pvcName }
      });
    }

    // 2. Identify REMOVED disks (existed previously but deleted by user) -> Unplug live!
    if (liveConfig.token && realKubeVolumes.length > 0) {
      for (const exVol of realKubeVolumes) {
        if (!newRawNames.includes(exVol) && exVol !== 'cloudinitdisk' && exVol !== 'rootdisk' && exVol !== 'vol-0') {
          if (isRunning) {
            console.log(`[Live Hotplug] Removing volume '${exVol}' from running VM '${vm.name}'`);
            const remRes = await k8sCall('PUT', `/apis/subresources.kubevirt.io/v1/namespaces/${vm.namespace}/virtualmachines/${vm.name}/removevolume`, {
              name: exVol
            });
            hotplugOperations.push({ action: 'remove', name: exVol, status: remRes.statusCode });
          }
        }
      }
    }

    // Update in-memory disks
    vm.disks = disks.map((d, idx) => {
      const nd = normalizedNewDisks[idx];
      return {
        name: d.name || `disk-0${idx + 1}`,
        pvc: nd.pvcName,
        sizeGb: nd.sizeGb,
        sc: nd.sc,
        accessMode: nd.sc === 'thin-csi' ? 'ReadWriteOnce' : 'ReadWriteMany',
        usedGb: d.usedGb !== undefined ? d.usedGb : 2.16
      };
    });
    diskChangeDesc = `, 디스크 ${vm.disks.length}개(기존 ${oldDiskCount}개)`;
  }

  // Network Interfaces
  let kubeInterfaces = [];
  let kubeNetworks = [];
  if (Array.isArray(nics) && nics.length > 0) {
    const oldNicCount = (vm.nics || []).length;
    nics.forEach((n, idx) => {
      const rawName = (n.name || `nic-${idx}`).split(' ')[0].toLowerCase().replace(/[^a-z0-9-]/g, '') || `nic-${idx}`;
      const isDefault = (n.network && (n.network.includes('Default') || n.network.includes('ovn'))) || idx === 0;

      kubeInterfaces.push({
        name: rawName,
        model: n.model || 'virtio',
        ...(isDefault ? { masquerade: {} } : { bridge: {} })
      });

      kubeNetworks.push({
        name: rawName,
        ...(isDefault ? { pod: {} } : { multus: { networkName: 'default/physnet' } })
      });
    });

    vm.nics = nics.map((n, idx) => ({
      name: n.name || `vnic${idx}`,
      network: n.network || (idx === 0 ? 'ovn-kubernetes (Default Pod)' : 'default/physnet (Multus L2)'),
      ip: n.ip || (idx === 0 ? vm.ip || '10.129.2.55' : '-'),
      mac: n.mac || `52:54:00:${Math.floor(Math.random()*89+10)}:${Math.floor(Math.random()*89+10)}:${Math.floor(Math.random()*89+10)}`
    }));
    nicChangeDesc = `, 네트워크 어댑터 ${vm.nics.length}개(기존 ${oldNicCount}개)`;
  }

  // Apply merge patch to VirtualMachine spec:
  // If running, we update cpu, memory, interfaces, networks. (Disks/Volumes are handled by addvolume/removevolume to avoid conflicts).
  // If stopped, we update everything including disks and volumes.
  const patchDomain = {
    cpu: { cores: cpu, sockets: 1, threads: 1 },
    resources: { requests: { memory: `${mem}Gi` } },
    devices: {
      ...(isRunning ? {} : (kubeDisks.length > 0 ? { disks: kubeDisks } : {})),
      ...(kubeInterfaces.length > 0 ? { interfaces: kubeInterfaces } : {})
    }
  };

  const patchBody = {
    spec: {
      template: {
        spec: {
          domain: patchDomain,
          ...(isRunning ? {} : (kubeVolumes.length > 0 ? { volumes: kubeVolumes } : {})),
          ...(kubeNetworks.length > 0 ? { networks: kubeNetworks } : {})
        }
      }
    }
  };

  let apiResult = null;
  if (liveConfig.token) {
    apiResult = await k8sCall('PATCH', `/apis/kubevirt.io/v1/namespaces/${vm.namespace}/virtualmachines/${vm.name}`, patchBody);
  }

  // Always update in-memory state
  vm.vCpu = cpu;
  vm.memoryGb = mem;

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const hotplugDesc = isRunning && hotplugOperations.length > 0 ? ` [⚡ 무중단 Live Hotplug ${hotplugOperations.length}건 실시간 연결]` : '';

  clusterState.tasks.unshift({
    id: `task-hw-${Date.now()}`,
    name: `Reconfigure Hardware '${vm.name}' (${cpu} vCPU, ${mem} GB${diskChangeDesc}${nicChangeDesc})${hotplugDesc}`,
    target: vm.name,
    user: 'admin@example.local',
    status: 'Completed',
    progressPct: 100,
    startTime: now,
    duration: '1초'
  });

  clusterState.events.unshift({
    time: new Date().toLocaleTimeString('ko-KR'),
    type: 'Normal',
    object: vm.name,
    message: `가상머신 사양 변경 완료: ${cpu} vCPU, ${mem} GB Memory${diskChangeDesc}${nicChangeDesc}${hotplugDesc}`
  });

  setTimeout(syncFromLiveCluster, 1500);

  res.json({
    success: true,
    vm,
    hotplug: isRunning,
    hotplugOperations,
    apiResult
  });
});

// 5. Live Migration (Real KubeVirt VirtualMachineInstanceMigration)
app.post('/api/v1/vm/:id/migrate', async (req, res) => {
  const { targetNode } = req.body;
  const vm = clusterState.vms.find(v => v.id === req.params.id || v.name === req.params.id);
  if (!vm) return res.status(404).json({ error: 'VM not found' });

  if (vm.status !== 'Running') {
    return res.status(400).json({ error: '실행 중(Running)인 가상머신만 실시간 무중단 마이그레이션(Live Migration)이 가능합니다.' });
  }

  const prevNode = vm.node;
  const taskId = `task-mig-${Date.now()}`;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  // Real KubeVirt API Call to create VirtualMachineInstanceMigration
  const migPayload = {
    apiVersion: 'kubevirt.io/v1',
    kind: 'VirtualMachineInstanceMigration',
    metadata: {
      generateName: `${vm.name}-migration-`,
      namespace: vm.namespace
    },
    spec: {
      vmiName: vm.name
    }
  };

  const migResult = await k8sCall('POST', `/apis/kubevirt.io/v1/namespaces/${vm.namespace}/virtualmachineinstancemigrations`, migPayload);
  const isMigSuccess = migResult.statusCode >= 200 && migResult.statusCode < 300;
  console.log(`[Real KubeVirt vMotion] '${vm.name}' -> HTTP ${migResult.statusCode}`);

  vm.status = 'Migrating';

  const task = {
    id: taskId,
    name: `Live Migration (vMotion) '${vm.name}'`,
    target: vm.name,
    sourceNode: prevNode,
    targetNode: targetNode || '클러스터 최적 노드',
    user: 'admin@example.local',
    status: isMigSuccess ? 'In Progress' : `Failed (HTTP ${migResult.statusCode})`,
    progressPct: 25,
    startTime: now,
    duration: '진행 중'
  };

  clusterState.tasks.unshift(task);

  if (isMigSuccess) {
    let checkCount = 0;
    const migInterval = setInterval(async () => {
      checkCount++;
      await syncFromLiveCluster();
      const updatedVm = clusterState.vms.find(v => v.name === vm.name);

      if (updatedVm && updatedVm.status === 'Running' && updatedVm.node !== prevNode) {
        task.progressPct = 100;
        task.status = 'Completed';
        task.targetNode = updatedVm.node;
        task.duration = `${checkCount * 2}초 (무중단 전환 완료)`;
        clearInterval(migInterval);
      } else if (checkCount > 15) {
        task.progressPct = 100;
        task.status = 'Completed';
        clearInterval(migInterval);
      }
    }, 2000);
  }

  res.json({
    success: isMigSuccess,
    message: isMigSuccess ? `KubeVirt VirtualMachineInstanceMigration 생성 성공` : `마이그레이션 실패 (HTTP ${migResult.statusCode})`,
    task,
    migResult
  });
});


// 6. Snapshot Management - Real KubeVirt VirtualMachineSnapshot API
app.post('/api/v1/vm/:id/snapshot', async (req, res) => {
  const { name, desc, includeMemory } = req.body;
  const vm = clusterState.vms.find(v => v.id === req.params.id || v.name === req.params.id);
  if (!vm) return res.status(404).json({ error: 'VM not found' });

  const rawSnapName = name || `snap-${vm.name}-${new Date().toISOString().substring(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 900 + 100)}`;
  const snapName = rawSnapName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  // Try KubeVirt v1beta1 first, fallback to v1alpha1
  const snapAnnotations = {
    'rhov.kubevirt.io/include-memory': String(!!includeMemory)
  };

  let apiResult = await k8sCall('POST', `/apis/snapshot.kubevirt.io/v1beta1/namespaces/${vm.namespace}/virtualmachinesnapshots`, {
    apiVersion: 'snapshot.kubevirt.io/v1beta1',
    kind: 'VirtualMachineSnapshot',
    metadata: {
      name: snapName,
      namespace: vm.namespace,
      annotations: snapAnnotations
    },
    spec: {
      source: {
        apiGroup: 'kubevirt.io',
        kind: 'VirtualMachine',
        name: vm.name
      }
    }
  });

  if (!apiResult || apiResult.statusCode >= 400) {
    apiResult = await k8sCall('POST', `/apis/snapshot.kubevirt.io/v1alpha1/namespaces/${vm.namespace}/virtualmachinesnapshots`, {
      apiVersion: 'snapshot.kubevirt.io/v1alpha1',
      kind: 'VirtualMachineSnapshot',
      metadata: {
        name: snapName,
        namespace: vm.namespace,
        annotations: snapAnnotations
      },
      spec: {
        source: {
          apiGroup: 'kubevirt.io',
          kind: 'VirtualMachine',
          name: vm.name
        }
      }
    });
  }

  const isK8sSuccess = apiResult && apiResult.statusCode >= 200 && apiResult.statusCode < 300;
  console.log(`[Snapshot] '${snapName}' for VM '${vm.name}' -> HTTP ${apiResult ? apiResult.statusCode : 'Mock'}`);

  const diskSize = (vm.disks && vm.disks[0] && vm.disks[0].sizeGb) ? vm.disks[0].sizeGb : 40;
  const newSnap = {
    id: snapName,
    name: snapName,
    time: now.substring(0, 16),
    created: now.substring(0, 16),
    desc: desc || (isK8sSuccess ? 'OpenShift VirtualMachineSnapshot (CSI 스냅샷)' : '가상머신 시스템 및 디스크 복원 지점'),
    includeMemory: !!includeMemory,
    memoryIncluded: !!includeMemory,
    sizeGb: diskSize,
    ready: true
  };

  // Guaranteed persistence in VM's snapshots list
  if (!vm.snapshots) vm.snapshots = [];
  vm.snapshots = vm.snapshots.filter(s => s.name !== snapName && s.id !== snapName);
  vm.snapshots.unshift(newSnap);

  const taskId = `task-snap-${Date.now()}`;
  clusterState.tasks.unshift({
    id: taskId,
    name: `스냅샷 생성: ${vm.name} ➔ ${snapName}${includeMemory ? ' (RAM 포함)' : ''}`,
    target: vm.name,
    user: 'admin@example.local',
    status: 'Completed',
    progressPct: 100,
    startTime: now,
    duration: '2초'
  });

  // Background refresh, preserving existing snapshots
  setTimeout(syncFromLiveCluster, 2000);

  res.json({
    success: true,
    message: `스냅샷 '${snapName}'이(가) 성공적으로 생성되었습니다.`,
    snapshot: newSnap,
    apiResult
  });
});

// 7. Revert Snapshot - Real KubeVirt VirtualMachineRestore API
app.post('/api/v1/vm/:id/snapshot/:snapId/revert', async (req, res) => {
  const vm = clusterState.vms.find(v => v.id === req.params.id || v.name === req.params.id);
  if (!vm) return res.status(404).json({ error: 'VM not found' });

  const snap = (vm.snapshots || []).find(s => s.id === req.params.snapId || s.name === req.params.snapId);
  const snapName = snap ? snap.name : req.params.snapId;

  const restorePayload = {
    apiVersion: 'snapshot.kubevirt.io/v1alpha1',
    kind: 'VirtualMachineRestore',
    metadata: {
      name: `restore-${snapName.substring(0, 30)}-${Date.now()}`,
      namespace: vm.namespace
    },
    spec: {
      target: {
        apiGroup: 'kubevirt.io',
        kind: 'VirtualMachine',
        name: vm.name
      },
      virtualMachineSnapshotName: snapName
    }
  };

  const apiResult = await k8sCall('POST', `/apis/snapshot.kubevirt.io/v1alpha1/namespaces/${vm.namespace}/virtualmachinerestores`, restorePayload);
  const isSuccess = apiResult && apiResult.statusCode >= 200 && apiResult.statusCode < 300;

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  clusterState.tasks.unshift({
    id: `task-revert-${Date.now()}`,
    name: `Revert to Snapshot '${snapName}'`,
    target: vm.name,
    user: 'admin@example.local',
    status: isSuccess ? 'Completed' : `Failed (HTTP ${apiResult ? apiResult.statusCode : 500})`,
    progressPct: 100,
    startTime: now,
    duration: '3초'
  });

  setTimeout(syncFromLiveCluster, 2000);

  res.json({ success: isSuccess, apiResult });
});

// 7-1. Delete Snapshot - Real KubeVirt Snapshot API (v1beta1 & v1alpha1 fallback)
app.delete('/api/v1/vm/:id/snapshot/:snapName', async (req, res) => {
  const vm = clusterState.vms.find(v => v.id === req.params.id || v.name === req.params.id);
  if (!vm) return res.status(404).json({ error: 'VM not found' });

  const snapName = req.params.snapName;
  console.log(`[Snapshot Delete] Requesting deletion of snapshot '${snapName}' on VM '${vm.name}' in ns '${vm.namespace}'...`);

  // Try v1beta1 first (standard in OpenShift 4.16), fallback to v1alpha1
  let apiResult = await k8sCall('DELETE', `/apis/snapshot.kubevirt.io/v1beta1/namespaces/${vm.namespace}/virtualmachinesnapshots/${snapName}`);
  if (!apiResult || (apiResult.statusCode !== 200 && apiResult.statusCode !== 204 && apiResult.statusCode !== 404)) {
    const fallbackResult = await k8sCall('DELETE', `/apis/snapshot.kubevirt.io/v1alpha1/namespaces/${vm.namespace}/virtualmachinesnapshots/${snapName}`);
    if (fallbackResult && (fallbackResult.statusCode < 400 || fallbackResult.statusCode === 404)) {
      apiResult = fallbackResult;
    }
  }

  const isSuccess = apiResult && ((apiResult.statusCode >= 200 && apiResult.statusCode < 300) || apiResult.statusCode === 404);
  console.log(`[Snapshot Delete] Result for '${snapName}' -> HTTP ${apiResult ? apiResult.statusCode : 'Failed'}`);

  if (isSuccess && vm.snapshots) {
    vm.snapshots = vm.snapshots.filter(s => s.name !== snapName && s.id !== snapName);
    broadcastToBrowsers({
      type: 'SNAPSHOT_CHANGED',
      payload: { vmName: vm.name, deletedSnapName: snapName, vm }
    });
  }

  res.json({ success: isSuccess, apiResult });
});

// 7-2. Clone VirtualMachine - Real KubeVirt VirtualMachineClone CRD API
app.post('/api/v1/vm/:id/clone', async (req, res) => {
  const sourceVm = clusterState.vms.find(v => v.id === req.params.id || v.name === req.params.id);
  if (!sourceVm) return res.status(404).json({ error: 'Source VM not found' });

  const { newName, targetNamespace, storageClass, cloneType, autoStart } = req.body;
  const rawTargetName = newName || `${sourceVm.name}-clone`;
  const targetVmName = rawTargetName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const targetNs = targetNamespace || sourceVm.namespace || 'default';
  const sc = storageClass || 'thin-csi';
  const isFullClone = cloneType !== 'linked';
  const startAfter = autoStart === true;
  const cloneCrName = `clone-${sourceVm.name}-to-${targetVmName}`.substring(0, 60);

  // KubeVirt VirtualMachineClone CRD Payload
  const clonePayload = {
    apiVersion: 'clone.kubevirt.io/v1alpha1',
    kind: 'VirtualMachineClone',
    metadata: {
      name: cloneCrName,
      namespace: targetNs
    },
    spec: {
      source: {
        apiGroup: 'kubevirt.io',
        kind: 'VirtualMachine',
        name: sourceVm.name
      },
      target: {
        apiGroup: 'kubevirt.io',
        kind: 'VirtualMachine',
        name: targetVmName
      }
    }
  };

  const apiResult = await k8sCall('POST', `/apis/clone.kubevirt.io/v1alpha1/namespaces/${targetNs}/virtualmachineclones`, clonePayload);
  const isK8sSuccess = apiResult && apiResult.statusCode >= 200 && apiResult.statusCode < 300;
  console.log(`[Real KubeVirt Clone] '${sourceVm.name}' ➔ '${targetVmName}' in ns '${targetNs}' -> HTTP ${apiResult ? apiResult.statusCode : 'Mock'}`);

  // Create new Cloned VM entry for immediate UI responsiveness
  const newVmId = `vm-${Date.now().toString().slice(-4)}`;
  const randomLastOctet = Math.floor(Math.random() * 80 + 120);
  const clonedVm = {
    id: newVmId,
    name: targetVmName,
    namespace: targetNs,
    os: sourceVm.os,
    osType: sourceVm.osType,
    status: startAfter ? 'Running' : 'Stopped',
    node: sourceVm.node || 'master-01.rhov.example.local',
    ip: `192.168.10.${randomLastOctet}`,
    podIp: startAfter ? `10.128.2.${randomLastOctet}` : '-',
    vCpu: sourceVm.vCpu,
    memoryGb: sourceVm.memoryGb,
    uptime: startAfter ? '0분 (방금 기동됨)' : 'Offline (복제 완료)',
    guestAgent: {
      installed: sourceVm.guestAgent?.installed ?? true,
      version: sourceVm.guestAgent?.version || '7.2.0',
      status: startAfter ? 'Active (Connected)' : 'Disconnected'
    },
    metrics: {
      cpuUsagePct: startAfter ? 12 : 0,
      cpuMhz: startAfter ? 1200 : 0,
      memoryUsagePct: startAfter ? 25 : 0,
      memoryUsedGb: startAfter ? (sourceVm.memoryGb * 0.25).toFixed(1) : 0,
      diskIops: startAfter ? 150 : 0,
      networkKbps: startAfter ? 320 : 0
    },
    disks: (sourceVm.disks || []).map((d, idx) => ({
      ...d,
      name: `${d.name.split(' ')[0]} (Cloned)`,
      pvc: `pvc-${targetVmName}-${idx + 1}`,
      sc: sc
    })),
    nics: (sourceVm.nics || []).map((nic, idx) => ({
      ...nic,
      ip: `192.168.10.${randomLastOctet + idx}`,
      mac: `52:54:00:${Math.floor(Math.random()*89+10)}:${Math.floor(Math.random()*89+10)}:${Math.floor(Math.random()*89+10)}`
    })),
    snapshots: []
  };

  clusterState.vms.unshift(clonedVm);

  // Add Task to Recent Tasks list
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  clusterState.tasks.unshift({
    id: `task-clone-${Date.now()}`,
    name: `Clone VM: ${sourceVm.name} ➔ ${targetVmName} (${isFullClone ? 'Full Clone' : 'Linked Clone'})`,
    target: targetVmName,
    user: 'admin@example.local',
    status: 'Completed',
    progressPct: 100,
    startTime: now,
    duration: '6초'
  });

  setTimeout(syncFromLiveCluster, 3000);

  res.json({
    success: true,
    message: `가상머신 '${sourceVm.name}' ➔ '${targetVmName}' 복제가 완료되었습니다.`,
    vm: clonedVm,
    apiResult
  });
});

// 8. Host Maintenance Mode (Evacuate all VMs)
app.post('/api/v1/host/:name/maintenance', (req, res) => {
  const host = clusterState.nodes.find(n => n.name === req.params.name);
  if (!host) return res.status(404).json({ error: 'Host not found' });

  host.maintenanceMode = !host.maintenanceMode;

  if (host.maintenanceMode) {
    // Live migrate all VMs on this host to other ready hosts!
    const vmsOnHost = clusterState.vms.filter(v => v.node === host.name && v.status === 'Running');
    const otherHosts = clusterState.nodes.filter(n => n.name !== host.name && !n.maintenanceMode);

    if (otherHosts.length > 0 && vmsOnHost.length > 0) {
      vmsOnHost.forEach(async (vm, idx) => {
        // Real KubeVirt Live Migration CR
        const migPayload = {
          apiVersion: 'kubevirt.io/v1',
          kind: 'VirtualMachineInstanceMigration',
          metadata: {
            generateName: `${vm.name}-evac-`,
            namespace: vm.namespace
          },
          spec: { vmiName: vm.name }
        };
        await k8sCall('POST', `/apis/kubevirt.io/v1/namespaces/${vm.namespace}/virtualmachineinstancemigrations`, migPayload);

        clusterState.tasks.unshift({
          id: `task-evac-${Date.now()}-${idx}`,
          name: `Host Maintenance Evacuation (Live Migration) '${vm.name}'`,
          target: vm.name,
          sourceNode: host.name,
          targetNode: '클러스터 자동 분산',
          user: 'System / DRS Evacuation',
          status: 'In Progress',
          progressPct: 50,
          startTime: new Date().toISOString().replace('T', ' ').substring(0, 19),
          duration: '진행 중'
        });
      });
    }

    clusterState.nodes.forEach(n => {
      n.vmCount = clusterState.vms.filter(v => v.node === n.name).length;
    });

    res.json({
      success: true,
      maintenanceMode: true,
      message: `호스트 '${host.name}'이(가) 유지보수 모드로 전환되었습니다. 구동 중이던 ${vmsOnHost.length}대 가상머신이 타 호스트로 자동 무중단 대피(Live Migration)되었습니다.`
    });
  } else {
    res.json({
      success: true,
      maintenanceMode: false,
      message: `호스트 '${host.name}' 유지보수 모드가 해제되었습니다. 신규 VM 스케줄링이 활성화됩니다.`
    });
  }
});

// 9. Interactive Web Console / Terminal Exec Simulation
app.post('/api/v1/vm/:id/exec', (req, res) => {
  const vm = clusterState.vms.find(v => v.id === req.params.id || v.name === req.params.id);
  if (!vm) return res.status(404).json({ error: 'VM not found' });

  if (vm.status !== 'Running') {
    return res.json({ output: 'Error: Cannot connect to console. VirtualMachine is powered off.\r\n' });
  }

  const cmd = (req.body.command || '').trim();
  let output = '';

  switch (cmd.toLowerCase()) {
    case 'uname -a':
      output = `Linux ${vm.name} 4.18.0-553.el8_10.x86_64 #1 SMP Thu May 9 04:36:22 EDT 2024 x86_64 x86_64 x86_64 GNU/Linux\r\n`;
      break;
    case 'cat /etc/redhat-release':
    case 'cat /etc/os-release':
      output = `NAME="Red Hat Enterprise Linux"\nVERSION="8.10 (Ootpa)"\nID="rhel"\nID_LIKE="fedora"\nVERSION_ID="8.10"\nPLATFORM_ID="platform:el8"\n`;
      break;
    case 'uptime':
      output = ` 13:22:15 up 18 days,  7:24,  2 users,  load average: 0.18, 0.24, 0.31\r\n`;
      break;
    case 'free -h':
    case 'free -m':
      output = `              total        used        free      shared  buff/cache   available\nMem:          7.8Gi       3.8Gi       2.1Gi       128Mi       1.9Gi       3.7Gi\nSwap:         4.0Gi          0B       4.0Gi\r\n`;
      break;
    case 'ip a':
    case 'ip addr':
      output = `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN\n    inet 127.0.0.1/8 scope host lo\n2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1450 qdisc fq_codel state UP\n    inet ${vm.podIp}/14 brd 10.128.255.255 scope global dynamic eth0\n3: eth1: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP\n    inet ${vm.ip}/24 brd 192.168.10.255 scope global eth1 (VLAN 200 Bridge)\r\n`;
      break;
    case 'df -h':
      output = `Filesystem             Size  Used Avail Use% Mounted on\ndevtmpfs               3.9G     0  3.9G   0% /dev\n/dev/mapper/rhel-root   90G   34G   56G  38% /\n/dev/vda1              960M  280M  681M  30% /boot\n/dev/vdb1               48G   12G   34G  27% /var/log\r\n`;
      break;
    case 'systemctl status qemu-guest-agent':
      output = `● qemu-guest-agent.service - QEMU Guest Agent\n   Loaded: loaded (/usr/lib/systemd/system/qemu-guest-agent.service; enabled; vendor preset: enabled)\n   Active: active (running) since Tue 2026-10-02 06:00:01 KST; 18 days ago\n Main PID: 928 (qemu-ga)\n    Tasks: 2 (limit: 48924)\n   Memory: 4.8M\n   CGroup: /system.slice/qemu-guest-agent.service\n           └─928 /usr/bin/qemu-ga --method=virtio-serial --path=/dev/virtio-ports/org.qemu.guest_agent.0\r\n`;
      break;
    case 'systemctl status httpd':
      output = `● httpd.service - The Apache HTTP Server\n   Loaded: loaded (/usr/lib/systemd/system/httpd.service; enabled; vendor preset: disabled)\n   Active: active (running) since Tue 2026-10-02 06:00:15 KST; 18 days ago\n Main PID: 1240 (httpd)\n   Status: "Total requests: 184,291; Idle/Busy workers 100/0;Requests/sec: 1.2; Bytes/sec: 14.8KB/sec"\r\n`;
      break;
    case 'top':
      output = `top - 13:22:45 up 18 days, 1 user, load average: 0.22, 0.25, 0.30\nTasks: 184 total,   1 running, 183 sleeping,   0 stopped,   0 zombie\n%Cpu(s):  4.2 us,  1.8 sy,  0.0 ni, 93.8 id,  0.2 wa,  0.0 hi,  0.0 si\nMiB Mem :   7980.4 total,   2180.2 free,   3890.1 used,   1910.1 buff/cache\n\n  PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND\n 1240 apache    20   0  312450  45210  12840 S   4.8   0.6  42:15.10 httpd\n  928 root      20   0   48120   4920   3100 S   0.2   0.1   1:12.44 qemu-ga\r\n`;
      break;
    case 'help':
      output = `Available demo commands:\n  - uname -a\n  - uptime\n  - ip a\n  - free -h\n  - df -h\n  - systemctl status qemu-guest-agent\n  - systemctl status httpd\n  - top\n  - cat /etc/redhat-release\n  - clear\r\n`;
      break;
    case 'clear':
      output = 'CLEAR_SCREEN';
      break;
    default:
      if (cmd === '') {
        output = '';
      } else {
        output = `bash: ${cmd}: command not found. (Type 'help' for available commands)\r\n`;
      }
  }

  res.json({ output });
});

// ==========================================
// Live OpenShift & KubeVirt API Client
// ==========================================
import https from 'https';

let liveConfig = {
  enabled: true,
  apiUrl: process.env.OPENSHIFT_API_URL || process.env.KUBERNETES_API_URL || '',
  token: process.env.OPENSHIFT_TOKEN || process.env.KUBERNETES_TOKEN || ''
};

// 1) In-Cluster ServiceAccount Token Support for OpenShift / K8s Pod Execution
try {
  const inClusterTokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
  if (fs.existsSync(inClusterTokenPath)) {
    liveConfig.token = fs.readFileSync(inClusterTokenPath, 'utf8').trim();
    if (!liveConfig.apiUrl) {
      const k8sHost = process.env.KUBERNETES_SERVICE_HOST || 'kubernetes.default.svc';
      const k8sPort = process.env.KUBERNETES_SERVICE_PORT || '443';
      liveConfig.apiUrl = `https://${k8sHost}:${k8sPort}`;
    }
    console.log(`[Auth] Loaded in-cluster ServiceAccount token successfully from ${inClusterTokenPath} -> ${liveConfig.apiUrl}`);
  }
} catch (e) {
  console.warn('[Auth] In-cluster token lookup error:', e.message);
}

// Helper to dynamically detect OpenShift / Kubernetes Cluster Version
async function detectClusterVersion(nodeData) {
  if (process.env.OPENSHIFT_VERSION) {
    return `OpenShift ${process.env.OPENSHIFT_VERSION} (KubeVirt Live)`;
  }
  try {
    const cv = await k8sRequest('/apis/config.openshift.io/v1/clusterversions/version');
    if (cv && cv.status) {
      const detected = cv.status.desired?.version || cv.status.history?.[0]?.version;
      if (detected) {
        return `OpenShift ${detected} (KubeVirt Live)`;
      }
    }
  } catch (e) {
    // skip
  }
  try {
    const k8sVer = await k8sRequest('/version');
    if (k8sVer && k8sVer.gitVersion) {
      return `OpenShift 4.22 (KubeVirt Live / K8s ${k8sVer.gitVersion})`;
    }
  } catch (e) {
    // skip
  }
  if (nodeData && nodeData.items && nodeData.items[0]?.status?.nodeInfo?.kubeletVersion) {
    return `OpenShift 4.22 (KubeVirt Live / ${nodeData.items[0].status.nodeInfo.kubeletVersion})`;
  }
  return 'OpenShift 4.22 (KubeVirt Live)';
}

async function k8sRequest(path) {
  if (!liveConfig.token || !liveConfig.apiUrl) return null;
  const urlObj = new URL(liveConfig.apiUrl);
  return new Promise((resolve, reject) => {
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
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          resolve(null);
        }
      });
    });
    req.on('error', (err) => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

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

async function thanosQueryRange(query, start, end, step) {
  if (!liveConfig.token) return [];
  const thanosHostname = process.env.THANOS_INGRESS_IP || process.env.THANOS_HOST || 'thanos-querier.openshift-monitoring.svc';
  const thanosPort = parseInt(process.env.THANOS_PORT || '9091', 10);
  const thanosHostHeader = process.env.THANOS_ROUTE_HOST || thanosHostname;
  return new Promise((resolve) => {
    const qPath = `/api/v1/query_range?query=${encodeURIComponent(query)}&start=${start}&end=${end}&step=${step}`;
    const req = https.request({
      hostname: thanosHostname,
      port: thanosPort,
      path: qPath,
      headers: {
        'Host': thanosHostHeader,
        'Authorization': 'Bearer ' + liveConfig.token
      },
      rejectUnauthorized: false,
      timeout: 8000
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

// Sync Live Cluster Data into clusterState
async function syncFromLiveCluster() {
  if (!liveConfig.token) return;
  try {
    const [nodeData, vmData, vmiData, podMetrics, nodeMetrics, tCpu, tMemUsed, tMemAvail, tStorUsed, tStorCap, tNet, snapData, scData, pvData, nadData] = await Promise.all([
      k8sRequest('/api/v1/nodes'),
      k8sRequest('/apis/kubevirt.io/v1/virtualmachines'),
      k8sRequest('/apis/kubevirt.io/v1/virtualmachineinstances'),
      k8sRequest('/apis/metrics.k8s.io/v1beta1/pods'),
      k8sRequest('/apis/metrics.k8s.io/v1beta1/nodes'),
      thanosQuery('rate(kubevirt_vmi_cpu_usage_seconds_total[5m])'),
      thanosQuery('kubevirt_vmi_memory_used_bytes'),
      thanosQuery('kubevirt_vmi_memory_available_bytes'),
      thanosQuery('sum by (name) (kubevirt_vmi_filesystem_used_bytes)'),
      thanosQuery('sum by (name) (kubevirt_vmi_filesystem_capacity_bytes)'),
      thanosQuery('sum by (name) (rate(kubevirt_vmi_network_traffic_bytes_total[5m]))'),
      k8sRequest('/apis/snapshot.kubevirt.io/v1beta1/virtualmachinesnapshots')
        .then(res => (res && res.items && res.items.length > 0 ? res : k8sRequest('/apis/snapshot.kubevirt.io/v1alpha1/virtualmachinesnapshots'))),
      k8sRequest('/apis/storage.k8s.io/v1/storageclasses'),
      k8sRequest('/api/v1/persistentvolumes'),
      k8sRequest('/apis/k8s.cni.cncf.io/v1/network-attachment-definitions')
    ]);

    if (nodeData && nodeData.items && nodeData.items.length > 0) {
      clusterState.datacenter.name = 'Enterprise-Seoul-DC (Live OCP)';
      clusterState.cluster.name = 'rhov-prod-cluster';
      clusterState.cluster.ocpVersion = await detectClusterVersion(nodeData);

      // Sync nodes with real metrics
      clusterState.nodes = nodeData.items.map(n => {
        const isMaster = n.metadata.name.includes('master');
        const cpuCap = parseInt(n.status.capacity ? n.status.capacity.cpu : '16');
        const memCap = Math.round(parseInt(n.status.capacity ? n.status.capacity.memory : '67108864') / 1024 / 1024);

        // Real Node Metrics from metrics.k8s.io
        const nMetric = (nodeMetrics && nodeMetrics.items) ? nodeMetrics.items.find(m => m.metadata.name === n.metadata.name) : null;
        let nodeCpuUsedPct = 12;
        let nodeMemUsedGb = Math.round(memCap * 0.35);

        if (nMetric && nMetric.usage) {
          const nanoCpu = parseInt(nMetric.usage.cpu ? nMetric.usage.cpu.replace('n', '') : '0') || 0;
          const usedCores = nanoCpu / 1e9;
          nodeCpuUsedPct = Math.max(1, Math.min(100, Math.round((usedCores / cpuCap) * 100)));
          const memKi = parseInt(nMetric.usage.memory ? nMetric.usage.memory.replace('Ki', '') : '0') || 0;
          nodeMemUsedGb = Math.round((memKi / 1024 / 1024) * 10) / 10;
        }

        // Calculate real uptime
        let uptime = '110일';
        if (n.metadata && n.metadata.creationTimestamp) {
          const diffMs = Date.now() - new Date(n.metadata.creationTimestamp).getTime();
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          uptime = `${diffDays}일 ${diffHours}시간`;
        }

        const esxiHost = (n.metadata.labels && n.metadata.labels['node.cluster.x-k8s.io/esxi-host']) || 'esxi-node01.example.local';
        const nodeInfo = n.status.nodeInfo || {};
        const cpuGhzTotal = Math.round(cpuCap * 2.2 * 100) / 100;
        const cpuGhzUsed = Math.round((nodeCpuUsedPct / 100) * cpuGhzTotal * 100) / 100;

        return {
          id: n.metadata.uid || n.metadata.name,
          name: n.metadata.name,
          isMaster: isMaster,
          role: isMaster ? 'Control Plane, Master' : 'Worker (ESXi Host)',
          status: 'Ready',
          ip: n.status.addresses ? (n.status.addresses.find(a => a.type === 'InternalIP') || {}).address : '192.168.100.x',
          kvmAccel: 'Nested VT-x Active (/dev/kvm)',
          cpuCores: cpuCap,
          cpuUsedPct: nodeCpuUsedPct,
          cpuGhzTotal: cpuGhzTotal,
          cpuGhzUsed: cpuGhzUsed,
          memoryGb: memCap,
          memoryUsedGb: nodeMemUsedGb,
          hypervisor: 'Red Hat OpenShift Virtualization (KubeVirt / KVM)',
          model: 'PowerEdge R650 (OpenShift Node)',
          processorType: 'Intel(R) Xeon(R) Gold 5320 CPU @ 2.20GHz',
          osImage: nodeInfo.osImage || 'Red Hat Enterprise Linux CoreOS 9.8 (Plow)',
          kernelVersion: nodeInfo.kernelVersion || '5.14.0-687.42.1.el9_8.x86_64',
          containerRuntime: nodeInfo.containerRuntimeVersion || 'cri-o://1.35.6',
          kubeletVersion: nodeInfo.kubeletVersion || 'v1.35.6',
          architecture: nodeInfo.architecture || 'amd64',
          esxiHost: esxiHost,
          uptime: uptime,
          nicsCount: 2,
          storageTb: 2.0,
          usedStorageTb: 0.8,
          maintenanceMode: false,
          vmCount: 0
        };
      });
    }

    if (vmData && vmData.items) {
      const vmis = (vmiData && vmiData.items) ? vmiData.items : [];

      clusterState.vms = vmData.items.map((vm, idx) => {
        const name = vm.metadata.name;
        const ns = vm.metadata.namespace;
        const matchingVmi = vmis.find(v => v.metadata.name === name);
        const isRunning = !!matchingVmi;

        let osType = 'linux';
        let osName = 'Red Hat Enterprise Linux';
        if (matchingVmi && matchingVmi.status && matchingVmi.status.guestOSInfo) {
          const g = matchingVmi.status.guestOSInfo;
          if (g.version || g.prettyName || g.name) {
            osName = g.prettyName || g.version || g.name;
          }
          if (g.id === 'mswindows' || (g.name && g.name.includes('Windows'))) {
            osType = 'windows';
          }
        } else if (name.includes('win')) {
          osType = 'windows';
          osName = 'Microsoft Windows 10';
        } else if (name.includes('rocky')) {
          osType = 'linux';
          osName = 'Rocky Linux 9.x';
        } else if (name.includes('rhel')) {
          osType = 'rhel';
          osName = 'Red Hat Enterprise Linux 8.10';
        }

        let vCpu = 2;
        let memoryGb = 4;
        let disks = [];
        let nics = [];
        let uptime = 'Offline';
        let primaryIp = '-';
        let podIp = '-';
        let guestAgentStatus = 'Inactive (Disconnected)';

        let realCpuUsagePct = 0;
        let realCpuMhz = 0;
        let realMemoryUsagePct = 0;
        let realMemoryUsedGb = 0;
        let realNetworkKbps = 69;

        if (matchingVmi) {
          // 1. Real vCPU calculation
          const cpuSpec = (matchingVmi.spec && matchingVmi.spec.domain && matchingVmi.spec.domain.cpu) 
            || (vm.spec && vm.spec.template && vm.spec.template.spec && vm.spec.template.spec.domain && vm.spec.template.spec.domain.cpu) || {};
          vCpu = (cpuSpec.cores || 1) * (cpuSpec.sockets || 1) * (cpuSpec.threads || 1);

          // 2. Real Memory calculation
          const memObj = (matchingVmi.spec && matchingVmi.spec.domain && matchingVmi.spec.domain.memory)
            || (vm.spec && vm.spec.template && vm.spec.template.spec && vm.spec.template.spec.domain && vm.spec.template.spec.domain.memory);
          if (memObj && memObj.guest) {
            const m = memObj.guest.match(/([0-9]+)/);
            if (m) memoryGb = parseInt(m[1]);
          } else if (matchingVmi.spec && matchingVmi.spec.domain && matchingVmi.spec.domain.resources && matchingVmi.spec.domain.resources.requests && matchingVmi.spec.domain.resources.requests.memory) {
            const m = matchingVmi.spec.domain.resources.requests.memory.match(/([0-9]+)/);
            if (m) memoryGb = parseInt(m[1]);
          }

          // 3. Real Disks from VirtualMachine spec & VMI volumeStatus
          const specVolumes = (vm.spec && vm.spec.template && vm.spec.template.spec && vm.spec.template.spec.volumes) || [];
          const vmiVolStatuses = (matchingVmi.status && matchingVmi.status.volumeStatus) || [];

          if (specVolumes.length > 0) {
            disks = specVolumes.map(sv => {
              const vmiVol = vmiVolStatuses.find(v => v.name === sv.name);
              let sizeGb = 30;
              let pvcName = sv.persistentVolumeClaim ? sv.persistentVolumeClaim.claimName : (sv.dataVolume ? sv.dataVolume.name : sv.name);
              let accessMode = 'ReadWriteMany';
              let sc = (pvcName && pvcName.includes('nfs')) ? 'nfs-rwx' : 'thin-csi';

              if (vmiVol && vmiVol.persistentVolumeClaimInfo) {
                pvcName = vmiVol.persistentVolumeClaimInfo.claimName || pvcName;
                if (vmiVol.persistentVolumeClaimInfo.capacity && vmiVol.persistentVolumeClaimInfo.capacity.storage) {
                  const m = vmiVol.persistentVolumeClaimInfo.capacity.storage.match(/([0-9]+)/);
                  if (m) sizeGb = parseInt(m[1]);
                }
                if (vmiVol.persistentVolumeClaimInfo.accessModes) {
                  accessMode = vmiVol.persistentVolumeClaimInfo.accessModes[0];
                }
              } else if (pvcName === 'ent-stage-app-02-nfs-disk') {
                sizeGb = 120;
              }

              return {
                name: `${sv.name} (${vmiVol ? (vmiVol.target || 'virtio') : 'virtio'})`,
                pvc: pvcName,
                sizeGb: sizeGb,
                sc: sc,
                accessMode: accessMode
              };
            });
          } else if (vmiVolStatuses.length > 0) {
            disks = vmiVolStatuses.map(v => {
              let sizeGb = 30;
              let pvcName = v.persistentVolumeClaimInfo ? v.persistentVolumeClaimInfo.claimName : v.name;
              if (v.persistentVolumeClaimInfo && v.persistentVolumeClaimInfo.capacity && v.persistentVolumeClaimInfo.capacity.storage) {
                const m = v.persistentVolumeClaimInfo.capacity.storage.match(/([0-9]+)/);
                if (m) sizeGb = parseInt(m[1]);
              }
              return {
                name: `${v.name} (${v.target || 'disk'})`,
                pvc: pvcName,
                sizeGb: sizeGb,
                sc: 'nfs-rwx',
                accessMode: (v.persistentVolumeClaimInfo && v.persistentVolumeClaimInfo.accessModes) ? v.persistentVolumeClaimInfo.accessModes[0] : 'ReadWriteMany'
              };
            });
          } else {
            disks = [{ name: 'rootdisk (vda)', pvc: `pvc-${name}-root`, sizeGb: 30, sc: 'nfs-rwx', accessMode: 'ReadWriteMany' }];
          }

          // 4. Real NICs & IPs from VirtualMachine spec & VMI interfaces
          const specNetworks = (vm.spec && vm.spec.template && vm.spec.template.spec && vm.spec.template.spec.networks) || [];
          const vmiInterfaces = (matchingVmi.status && matchingVmi.status.interfaces) || [];

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
            primaryIp = nics[0].ip !== '-' ? nics[0].ip : (nics[1] ? nics[1].ip : '-');
            podIp = nics.length > 1 && nics[1].ip !== '-' ? nics[1].ip : primaryIp;
          } else if (vmiInterfaces.length > 0) {
            nics = vmiInterfaces.map((iface, iIdx) => ({
              name: `vnic${iIdx} (${iface.name})`,
              network: iface.name === 'default' || iface.name === 'net-0' ? 'ovn-kubernetes (Default Pod)' : 'default/physnet (Multus L2)',
              ip: iface.ipAddress || (iface.ipAddresses ? iface.ipAddresses[0] : '-'),
              mac: iface.mac || '52:54:00:xx:xx:xx'
            }));
            primaryIp = nics[0].ip !== '-' ? nics[0].ip : (nics[1] ? nics[1].ip : '-');
            podIp = nics.length > 1 && nics[1].ip !== '-' ? nics[1].ip : primaryIp;
          }

          // 5. Real Uptime from creationTimestamp
          if (matchingVmi.metadata && matchingVmi.metadata.creationTimestamp) {
            const diffMs = Date.now() - new Date(matchingVmi.metadata.creationTimestamp).getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            uptime = `${diffDays > 0 ? diffDays + '일 ' : ''}${diffHours}시간 ${diffMins}분`;
          }

          // 6. Guest Agent
          const hasGuestOs = matchingVmi.status && matchingVmi.status.guestOSInfo && Object.keys(matchingVmi.status.guestOSInfo).length > 0;
          guestAgentStatus = hasGuestOs ? 'Active (Connected)' : 'Not Reporting / Inactive';

          // 7. REAL Metrics from Thanos / Prometheus (Exact match with OpenShift Console!)
          const cpuMetric = (tCpu || []).find(r => r.metric && r.metric.name === name);
          const memMetric = (tMemUsed || []).find(r => r.metric && r.metric.name === name);
          const memAvailMetric = (tMemAvail || []).find(r => r.metric && r.metric.name === name);
          const storMetric = (tStorUsed || []).find(r => r.metric && r.metric.name === name);
          const storCapMetric = (tStorCap || []).find(r => r.metric && r.metric.name === name);
          const netMetric = (tNet || []).find(r => r.metric && r.metric.name === name);

          if (cpuMetric && cpuMetric.value) {
            const usedCores = parseFloat(cpuMetric.value[1]) || 0;
            realCpuUsagePct = Math.round((usedCores / vCpu) * 1000) / 10;
            realCpuMhz = Math.round(usedCores * 2500);
          } else {
            const vPod = (podMetrics && podMetrics.items) ? podMetrics.items.find(p => p.metadata.name.startsWith(`virt-launcher-${name}-`)) : null;
            if (vPod && vPod.containers) {
              const computeC = vPod.containers.find(c => c.name === 'compute') || vPod.containers[0];
              if (computeC && computeC.usage) {
                const nano = parseInt(computeC.usage.cpu ? computeC.usage.cpu.replace('n', '') : '0') || 0;
                const usedCores = nano / 1e9;
                realCpuUsagePct = Math.round((usedCores / vCpu) * 1000) / 10;
                realCpuMhz = Math.round(usedCores * 2500);
              }
            }
          }

          if (memMetric && memMetric.value) {
            const memUsedBytes = parseFloat(memMetric.value[1]) || 0;
            realMemoryUsedGb = Math.round((memUsedBytes / 1024 / 1024 / 1024) * 10) / 10;
            const memAvailBytes = memAvailMetric ? parseFloat(memAvailMetric.value[1]) : (memoryGb * 1024 * 1024 * 1024);
            realMemoryUsagePct = Math.round((memUsedBytes / memAvailBytes) * 1000) / 10;
          } else {
            const vPod = (podMetrics && podMetrics.items) ? podMetrics.items.find(p => p.metadata.name.startsWith(`virt-launcher-${name}-`)) : null;
            if (vPod && vPod.containers) {
              const computeC = vPod.containers.find(c => c.name === 'compute') || vPod.containers[0];
              if (computeC && computeC.usage) {
                const memKi = parseInt(computeC.usage.memory ? computeC.usage.memory.replace('Ki', '') : '0') || 0;
                realMemoryUsedGb = Math.round((memKi / 1024 / 1024) * 10) / 10;
                realMemoryUsagePct = Math.round((realMemoryUsedGb / memoryGb) * 100);
              }
            }
          }

          if (netMetric && netMetric.value) {
            realNetworkKbps = Math.round((parseFloat(netMetric.value[1]) / 1024) * 10) / 10;
          }

          if (storMetric && storMetric.value && disks.length > 0) {
            disks[0].usedGb = Math.round((parseFloat(storMetric.value[1]) / 1024 / 1024 / 1024) * 100) / 100;
          }
          if (storCapMetric && storCapMetric.value && disks.length > 0) {
            disks[0].sizeGb = Math.round((parseFloat(storCapMetric.value[1]) / 1024 / 1024 / 1024) * 100) / 100;
          }
        }

        const node = matchingVmi ? matchingVmi.status.nodeName : 'Unassigned';

        // Smart-merge: preserve locally created snapshots + sync live cluster snapshots
        const existingVm = clusterState.vms.find(v => v.name === name || v.id === `vm-${idx + 1}`);
        const existingSnaps = existingVm?.snapshots || [];

        const k8sSnaps = (snapData && snapData.items) ? snapData.items.filter(s => s.spec && s.spec.source && s.spec.source.name === name) : [];
        const liveSnapshots = k8sSnaps.map(s => {
          const snapId = s.metadata.name;
          const existing = existingSnaps.find(ex => (ex.name || ex.id) === snapId);
          const memAnno = s.metadata?.annotations?.['rhov.kubevirt.io/include-memory'];

          // Default is disk-only (false) unless explicit memory annotation exists or local state explicitly had true
          let hasMem = false;
          if (memAnno !== undefined) {
            hasMem = memAnno === 'true';
          } else if (existing && existing.includeMemory !== undefined) {
            hasMem = existing.includeMemory === true;
          }

          return {
            id: snapId,
            name: snapId,
            time: s.status && s.status.creationTime ? s.status.creationTime.substring(0, 16).replace('T', ' ') : (s.metadata.creationTimestamp ? s.metadata.creationTimestamp.substring(0, 16).replace('T', ' ') : 'Just now'),
            created: s.status && s.status.creationTime ? s.status.creationTime.substring(0, 16).replace('T', ' ') : (s.metadata.creationTimestamp ? s.metadata.creationTimestamp.substring(0, 16).replace('T', ' ') : 'Just now'),
            desc: (s.status && s.status.readyToUse ? 'CSI 스냅샷 준비 완료 (Ready)' : '스냅샷 생성 완료') + (s.status && s.status.virtualMachineSnapshotContentName ? ` | ${s.status.virtualMachineSnapshotContentName}` : ''),
            includeMemory: hasMem,
            memoryIncluded: hasMem,
            sizeGb: disks[0]?.sizeGb || 40,
            ready: s.status ? s.status.readyToUse : true
          };
        });

        // Merge maps so snapshots are never wiped out and local includeMemory choice is strictly preserved
        const snapMap = new Map();
        existingSnaps.forEach(s => snapMap.set(s.name || s.id, s));
        liveSnapshots.forEach(s => {
          const ex = snapMap.get(s.name || s.id);
          if (ex) {
            snapMap.set(s.name || s.id, {
              ...ex,
              ...s,
              includeMemory: s.includeMemory,
              memoryIncluded: s.memoryIncluded
            });
          } else {
            snapMap.set(s.name || s.id, s);
          }
        });
        const mergedSnapshots = Array.from(snapMap.values());

        let liveStatus = 'Stopped';
        if (vm.metadata?.deletionTimestamp) {
          liveStatus = 'Deleting';
        } else if (matchingVmi?.status?.migrationState && (matchingVmi.status.migrationState.startTimestamp && !matchingVmi.status.migrationState.endTimestamp)) {
          liveStatus = 'Migrating';
        } else if (vm.status?.printableStatus) {
          liveStatus = vm.status.printableStatus;
        } else if (matchingVmi) {
          liveStatus = matchingVmi.status?.phase || 'Running';
        }

        return {
          id: name,
          name: name,
          namespace: ns,
          os: osName,
          osType: osType,
          status: liveStatus,
          node: node,
          ip: primaryIp,
          podIp: podIp,
          vCpu: vCpu,
          memoryGb: memoryGb,
          uptime: uptime,
          guestAgent: {
            installed: guestAgentStatus.includes('Active'),
            version: 'VirtIO Guest Agent',
            status: guestAgentStatus
          },
          metrics: {
            cpuUsagePct: realCpuUsagePct,
            cpuMhz: realCpuMhz,
            memoryUsagePct: realMemoryUsagePct,
            memoryUsedGb: realMemoryUsedGb,
            diskIops: isRunning ? 180 : 0,
            networkKbps: realNetworkKbps
          },
          disks: disks,
          nics: nics,
          snapshots: mergedSnapshots
        };
      });

      // Update node vmCounts
      clusterState.nodes.forEach(n => {
        n.vmCount = clusterState.vms.filter(v => v.node === n.name).length;
      });

      clusterState.cluster.totalCpuCores = clusterState.nodes.reduce((acc, n) => acc + n.cpuCores, 0);
      clusterState.cluster.totalMemoryGb = clusterState.nodes.reduce((acc, n) => acc + n.memoryGb, 0);

      // Real Cluster-wide CPU & Memory Usage from node metrics
      if (nodeMetrics && nodeMetrics.items) {
        const totalNanoCpu = nodeMetrics.items.reduce((acc, m) => acc + (parseInt(m.usage.cpu ? m.usage.cpu.replace('n','') : '0') || 0), 0);
        clusterState.cluster.usedCpuCores = Math.round((totalNanoCpu / 1e9) * 10) / 10;
        const totalMemKi = nodeMetrics.items.reduce((acc, m) => acc + (parseInt(m.usage.memory ? m.usage.memory.replace('Ki','') : '0') || 0), 0);
        clusterState.cluster.usedMemoryGb = Math.round((totalMemKi / 1024 / 1024) * 10) / 10;
      }

      // ==========================================
      // Dynamic Datastores & Networks Resolution
      // ==========================================
      if (scData && scData.items && scData.items.length > 0) {
        // Exclude redundant ODF profiles (virtualization), file storage (cephfs), object storage (rgw, noobaa), and unused NFS
        const candidateScs = scData.items.filter(sc => {
          const scName = (sc.metadata?.name || '').toLowerCase();
          if (scName.includes('virtualization') || scName.includes('rgw') || scName.includes('cephfs') || scName.includes('noobaa') || scName.includes('nfs')) {
            return false;
          }
          return true;
        });

        clusterState.datastores = candidateScs.map((sc) => {
          const scName = sc.metadata?.name || 'default';
          const provisioner = sc.provisioner || '';
          
          const isCephRbd = provisioner.includes('rbd') || scName.includes('ceph-rbd') || (scName.includes('ceph') && !scName.includes('cephfs') && !scName.includes('rgw'));
          const isThinOrVsphere = (provisioner.includes('vsphere') || scName.includes('vsphere') || scName.includes('thin')) && !isCephRbd;
          
          let dsType = 'Kubernetes StorageClass (CSI)';
          let isRwx = false;
          if (isCephRbd) {
            dsType = 'Red Hat OpenShift Data Foundation (Ceph RBD)';
            isRwx = true;
          } else if (isThinOrVsphere) {
            dsType = 'VMware vSphere CSI (VMFS / vSAN)';
            isRwx = false; // thin-csi / vSphere CSI is strictly ReadWriteOnce (RWO) block volume
          }

          // Count PVs and calculate storage capacity from pvData
          const matchingPvs = (pvData && pvData.items) 
            ? pvData.items.filter(pv => pv.spec && (pv.spec.storageClassName === scName || (pv.metadata && pv.metadata.annotations && pv.metadata.annotations['volume.beta.kubernetes.io/storage-class'] === scName)))
            : [];
          
          matchingPvs.forEach(pv => {
            if (!isThinOrVsphere && pv.spec && pv.spec.accessModes && pv.spec.accessModes.includes('ReadWriteMany')) {
              isRwx = true;
            }
          });

          // Final strict enforcement for vSphere CSI
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
              else if (capStr.includes('Mi')) totalAllocatedGb += Math.round(num / 1024);
              else totalAllocatedGb += num;
            }
          });

          const baseCapacityTb = isCephRbd ? 5.0 : 7.2;
          const capacityTb = Math.max(baseCapacityTb, Math.round(((totalAllocatedGb * 1.5) / 1024) * 10) / 10);
          const usedTb = Math.round((totalAllocatedGb / 1024) * 10) / 10;
          const freeTb = Math.max(0.1, Math.round((capacityTb - usedTb) * 10) / 10);

          // Find VMs using this datastore
          const attachedVms = clusterState.vms.filter(v => 
            (v.disks || []).some(d => d.sc === scName || (d.name && d.name.includes(scName)))
          ).map(v => {
            const disk = v.disks.find(d => d.sc === scName || (d.name && d.name.includes(scName)));
            return {
              id: v.id,
              name: v.name,
              namespace: v.namespace,
              diskName: disk?.name || 'rootdisk',
              sizeGb: disk?.sizeGb || 30,
              accessMode: isThinOrVsphere ? 'ReadWriteOnce' : (disk?.accessMode || (isRwx ? 'ReadWriteMany' : 'ReadWriteOnce')),
              node: v.node,
              status: v.status
            };
          });

          return {
            id: `ds-${scName}`,
            name: scName,
            type: dsType,
            storageClass: scName,
            provisioner: provisioner,
            reclaimPolicy: sc.reclaimPolicy || 'Delete',
            volumeBindingMode: sc.volumeBindingMode || 'Immediate',
            capacityTb: capacityTb,
            usedTb: usedTb,
            freeTb: freeTb,
            capacityGb: Math.round(capacityTb * 1024),
            usedGb: totalAllocatedGb,
            freeGb: Math.round(freeTb * 1024),
            provisioning: isThinOrVsphere ? 'Thin Provisioned (RWO Block)' : (isRwx ? 'Shared Multi-Attach (RWX)' : 'Thin Provisioned (RWO)'),
            rwxSupported: isRwx,
            liveMigrationReady: isRwx,
            vmCount: attachedVms.length,
            vms: attachedVms,
            desc: isThinOrVsphere
              ? 'vSphere ESXi VMFS 기반 단일 노드 전용(RWO) 블록 볼륨 (Live Migration 불가 / Multi-Attach 충돌 / Cold Migration 전용)'
              : (isRwx 
                  ? '다중 노드 동시 마운트(RWX) 지원 스토리지로 VM 무중단 실시간 마이그레이션(Live Migration) 가능'
                  : '단일 노드 전용(RWO) 블록 볼륨으로 다른 노드로 vMotion 시 VM 전원 오프(Cold Migration) 필요')
          };
        });
      }

      // Dynamic Networks Resolution
      const detectedNets = [
        {
          id: 'net-ovn-default',
          name: 'ovn-kubernetes',
          type: 'Cluster Default CNI (OVN)',
          isDefault: true,
          vlan: 'Overlay Geneve (VNI 4096)',
          cidr: '10.128.0.0/14',
          gateway: '10.128.0.1',
          dns: '172.30.0.10',
          uplink: 'bond0 (Physical 10GbE Trunk)',
          desc: 'OpenShift 내부 포드 및 VM 기본 인터커넥트 네트워크 (East-West 통신 및 NAT 외부 접속)',
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
          let netConfig = {};
          try {
            netConfig = JSON.parse(nad.spec?.config || '{}');
          } catch(e) {}

          const cniType = netConfig.type || 'macvlan / bridge';
          const vlanId = netConfig.vlan || (netConfig.plugins && netConfig.plugins[0]?.vlan) || '200 (VLAN Untagged/Direct)';
          const ipamSubnet = netConfig.ipam?.subnet || (netConfig.plugins && netConfig.plugins[0]?.ipam?.subnet) || '192.168.10.0/24';

          const attachedVms = clusterState.vms.filter(v => 
            (v.nics || []).some(n => n.network.includes(nadName) || (nadName.includes('physnet') && n.network.includes('Multus')))
          ).map(v => {
            const nic = v.nics.find(n => n.network.includes(nadName) || (nadName.includes('physnet') && n.network.includes('Multus')));
            return {
              id: v.id,
              name: v.name,
              namespace: v.namespace,
              ip: nic?.ip || v.ip,
              mac: nic?.mac || '52:54:00:xx:xx:xx',
              node: v.node,
              status: v.status
            };
          });

          detectedNets.push({
            id: `net-${nadNs}-${nadName}`,
            name: `${nadName}`,
            namespace: nadNs,
            type: `Multus ${cniType.toUpperCase()} CNI`,
            isDefault: false,
            vlan: String(vlanId),
            cidr: ipamSubnet,
            gateway: ipamSubnet.replace(/\.0\/.*/, '.1'),
            dns: '192.168.10.1',
            uplink: 'ens192 / vmnic0 (Physical L2 Switch Trunk)',
            desc: 'vSphere 기존 가상머신 및 사내 IDC 레거시 대역과 동일한 L2 브로드캐스트 도메인 직접 연결',
            vms: attachedVms
          });
        });
      }
      clusterState.networks = detectedNets;

      // Fetch Real Live Kubernetes / KubeVirt Events
      const eventsData = await k8sRequest('/api/v1/namespaces/default/events');
      if (eventsData && eventsData.items && eventsData.items.length > 0) {
        const sortedEvents = eventsData.items.sort((a, b) => new Date(b.lastTimestamp || b.eventTime || 0) - new Date(a.lastTimestamp || a.eventTime || 0));
        clusterState.events = sortedEvents.slice(0, 30).map(e => ({
          time: (e.lastTimestamp ? e.lastTimestamp.substring(11, 19) : (e.eventTime ? e.eventTime.substring(11, 19) : '12:00:00')),
          type: e.type || 'Normal',
          object: e.involvedObject ? e.involvedObject.name : (e.metadata ? e.metadata.name : 'Cluster'),
          message: e.message || e.reason || 'KubeVirt Event'
        }));
      }
    }
  } catch(e) {
    console.error('Error during cluster sync:', e);
  }
}

// Initial sync on boot
syncFromLiveCluster();

// Low-frequency fallback (zero ETCD load; active only if collector is disconnected)
setInterval(() => {
  if (!collectorWs || collectorWs.readyState !== WebSocket.OPEN) {
    syncFromLiveCluster();
  }
}, 30000);

// 10. Live Cluster Connection Test Endpoint
app.post('/api/v1/cluster/connect', async (req, res) => {
  const { apiUrl, token } = req.body;
  if (!apiUrl) {
    return res.status(400).json({ error: 'OpenShift API URL을 입력해주세요.' });
  }

  liveConfig.apiUrl = apiUrl.replace(/\/$/, '');
  if (token && token.trim()) {
    liveConfig.token = token.trim();
  }
  liveConfig.enabled = true;

  try {
    await syncFromLiveCluster();
    const currentVer = clusterState.cluster.ocpVersion || 'OpenShift 4.22 (KubeVirt Live)';
    const cleanVer = currentVer.replace(/OpenShift\s*/i, '').replace(/\s*\(KubeVirt Live.*\)/i, '').trim();
    res.json({
      success: true,
      message: `OpenShift API Server [${liveConfig.apiUrl}] 연결 성공! 실제 KubeVirt 노드 및 VM 동기화 완료.`,
      clusterInfo: {
        serverVersion: currentVer,
        openShiftVersion: cleanVer || '4.22',
        virtualizationOperator: 'KubeVirt Live (Healthy)',
        detectedNodes: clusterState.nodes.length,
        detectedVms: clusterState.vms.length
      }
    });
  } catch(err) {
    res.status(500).json({ error: '연결 실패: ' + err.message });
  }
});


// ==========================================
// Real KubeVirt Web Console & VNC WebSocket Proxy
// ==========================================
const wss = new WebSocketServer({
  noServer: true,
  handleProtocols: (protocols) => {
    if (protocols && protocols.size > 0) {
      return protocols.values().next().value;
    }
    return false;
  }
});

// Browser Live-Sync WebSocket & Collector Bridge
// ==========================================
const browserClients = new Set();
const liveSyncWss = new WebSocketServer({ noServer: true });

liveSyncWss.on('connection', (clientWs) => {
  browserClients.add(clientWs);
  console.log(`[LiveSync WS] Browser connected (Total: ${browserClients.size})`);

  // Send current full inventory immediately upon connect
  clientWs.send(JSON.stringify({
    type: 'INITIAL_STATE',
    payload: {
      datacenter: clusterState.datacenter,
      cluster: clusterState.cluster,
      nodes: clusterState.nodes.map(n => ({
        ...n,
        vms: clusterState.vms.filter(v => v.node === n.name)
      })),
      vms: clusterState.vms,
      namespaces: getComputedNamespaces(),
      datastores: clusterState.datastores,
      networks: clusterState.networks,
      tasks: clusterState.tasks,
      events: clusterState.events
    },
    timestamp: new Date().toISOString()
  }));

  clientWs.on('close', () => {
    browserClients.delete(clientWs);
  });
});

function broadcastToBrowsers(eventObj) {
  const data = JSON.stringify(eventObj);
  for (const client of browserClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// Sidecar Collector Client Bridge
import { fork } from 'child_process';
const COLLECTOR_URL = process.env.COLLECTOR_URL || 'ws://127.0.0.1:4001';
let collectorWs = null;
let collectorSpawnAttempted = false;

function initCollectorBridge() {
  try {
    collectorWs = new WebSocket(COLLECTOR_URL);

    collectorWs.on('open', () => {
      console.log(`[Collector Bridge] Connected to Collector Sidecar Agent (4001)! Zero-latency event pipeline active.`);
    });

    collectorWs.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'INITIAL_STATE' && msg.payload) {
          if (msg.payload.nodes) clusterState.nodes = msg.payload.nodes;
          if (msg.payload.vms) clusterState.vms = msg.payload.vms;
          if (msg.payload.cluster) clusterState.cluster = msg.payload.cluster;
          if (msg.payload.events) clusterState.events = msg.payload.events;
          if (msg.payload.namespaces) clusterState.namespaces = msg.payload.namespaces;
        } else if (msg.type === 'NAMESPACES_UPDATED' && msg.payload) {
          if (msg.payload.namespaces) {
            clusterState.namespaces = msg.payload.namespaces;
          } else if (msg.payload.action === 'DELETED') {
            clusterState.namespaces = (clusterState.namespaces || []).filter(n => n.name !== msg.payload.name);
          } else if (msg.payload.namespace) {
            const idx = (clusterState.namespaces || []).findIndex(n => n.name === msg.payload.namespace.name);
            if (idx >= 0) clusterState.namespaces[idx] = msg.payload.namespace;
            else (clusterState.namespaces = clusterState.namespaces || []).push(msg.payload.namespace);
          }
        } else if (msg.type === 'VM_ADDED' || msg.type === 'VM_MODIFIED') {
          const vm = msg.payload;
          const idx = clusterState.vms.findIndex(v => v.name === vm.name || v.id === vm.name);
          if (idx >= 0) clusterState.vms[idx] = vm;
          else clusterState.vms.unshift(vm);
          clusterState.nodes.forEach(n => {
            n.vmCount = clusterState.vms.filter(v => v.node === n.name).length;
          });
        } else if (msg.type === 'VM_DELETED') {
          const name = msg.payload?.name || msg.payload?.id;
          clusterState.vms = clusterState.vms.filter(v => v.name !== name && v.id !== name);
          clusterState.nodes.forEach(n => {
            n.vmCount = clusterState.vms.filter(v => v.node === n.name).length;
          });
        } else if (msg.type === 'METRICS_UPDATED' && Array.isArray(msg.payload)) {
          msg.payload.forEach(m => {
            const vm = clusterState.vms.find(v => v.name === m.name || v.id === m.name);
            if (vm && m.metrics) vm.metrics = m.metrics;
          });
        } else if (msg.type === 'SNAPSHOT_CHANGED' && msg.payload?.vm) {
          const vm = msg.payload.vm;
          const idx = clusterState.vms.findIndex(v => v.name === vm.name || v.id === vm.name);
          if (idx >= 0) clusterState.vms[idx] = vm;
        } else if (msg.type === 'NODE_CHANGED' && msg.payload) {
          const node = msg.payload;
          if (node.deleted) {
            clusterState.nodes = clusterState.nodes.filter(n => n.name !== node.name);
          } else {
            const idx = clusterState.nodes.findIndex(n => n.name === node.name);
            if (idx >= 0) clusterState.nodes[idx] = node;
            else clusterState.nodes.push(node);
          }
        } else if (msg.type === 'EVENT_ADDED' && msg.payload) {
          clusterState.events.unshift(msg.payload);
          if (clusterState.events.length > 50) clusterState.events.pop();
        }
        // Broadcast immediately to all connected browsers!
        broadcastToBrowsers(msg);
      } catch(e) {}
    });

    collectorWs.on('error', (err) => {
      // Sidecar container runs independently on 4001; wait and reconnect
      if (process.env.AUTO_SPAWN_COLLECTOR === 'true' && !collectorSpawnAttempted) {
        collectorSpawnAttempted = true;
        console.log('[Collector Bridge] Auto-spawning collector.js as embedded dev agent...');
        try {
          const cp = fork(path.join(__dirname, 'collector.js'));
          cp.on('error', spawnErr => console.error('[Collector Subprocess Error]', spawnErr));
        } catch(e) {}
      }
    });

    collectorWs.on('close', () => {
      setTimeout(initCollectorBridge, 2500);
    });
  } catch(e) {
    setTimeout(initCollectorBridge, 3000);
  }
}

initCollectorBridge();

server.on('upgrade', (request, socket, head) => {
  const urlObj = new URL(request.url, `http://${request.headers.host}`);
  if (urlObj.pathname === '/ws/console') {
    wss.handleUpgrade(request, socket, head, (clientWs) => {
      wss.emit('connection', clientWs, request);
    });
  } else if (urlObj.pathname === '/ws/live-sync') {
    liveSyncWss.handleUpgrade(request, socket, head, (clientWs) => {
      liveSyncWss.emit('connection', clientWs, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (clientWs, req) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const vmId = urlObj.searchParams.get('vmId');
  const consoleType = urlObj.searchParams.get('type') || 'console'; // 'console' or 'vnc'

  const vm = clusterState.vms.find(v => v.id === vmId || v.name === vmId);
  if (!vm) {
    clientWs.send('\r\n[Error] 가상머신을 찾을 수 없습니다.\r\n');
    clientWs.close();
    return;
  }

  if (vm.status !== 'Running') {
    clientWs.send(`\r\n[Error] 웹 콘솔 연결 불가: '${vm.name}' VM이 현재 ${vm.status} 상태입니다. 전원을 먼저 켜주세요.\r\n`);
    clientWs.close();
    return;
  }

  const apiBase = liveConfig.apiUrl.replace(/^http/, 'ws');
  const subresource = consoleType === 'vnc' ? 'vnc' : 'console';
  const k8sWsUrl = `${apiBase}/apis/subresources.kubevirt.io/v1/namespaces/${vm.namespace}/virtualmachineinstances/${vm.name}/${subresource}`;

  console.log(`[Web Console Proxy] Connecting to KubeVirt ${subresource}: ${k8sWsUrl}`);

  const k8sWs = new WebSocket(k8sWsUrl, ['plain.kubevirt.io'], {
    headers: {
      'Authorization': 'Bearer ' + liveConfig.token
    },
    rejectUnauthorized: false
  });

  k8sWs.on('open', () => {
    console.log(`[Web Console Proxy] Connected to KubeVirt for VM '${vm.name}' (${subresource})`);
    if (consoleType !== 'vnc') {
      clientWs.send(`\r\n\x1b[32m[KubeVirt 실시간 시리얼 콘솔 연결됨 - ${vm.name} on ${vm.node}]\x1b[0m\r\n\r\n`);
    }
  });

  k8sWs.on('message', (data, isBinary) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data, { binary: isBinary });
    }
  });

  clientWs.on('message', (data, isBinary) => {
    if (k8sWs.readyState === WebSocket.OPEN) {
      k8sWs.send(data, { binary: isBinary });
    }
  });

  k8sWs.on('error', (err) => {
    console.error(`[Web Console Proxy Error] KubeVirt WS:`, err.message);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(`\r\n\x1b[31m[KubeVirt 웹 콘솔 연결 에러: ${err.message}]\x1b[0m\r\n`);
      clientWs.close();
    }
  });

  clientWs.on('error', (err) => {
    console.error(`[Web Console Proxy Error] Client WS:`, err.message);
    k8sWs.close();
  });

  k8sWs.on('close', (code, reason) => {
    console.log(`[Web Console Proxy] KubeVirt WS closed (${code})`);
    if (clientWs.readyState === WebSocket.OPEN) {
      try { clientWs.close(1000, 'KubeVirt session ended'); } catch(e) {}
    }
  });

  clientWs.on('close', () => {
    if (k8sWs.readyState === WebSocket.OPEN) {
      try { k8sWs.close(1000); } catch(e) {}
    }
  });
});

// SPA Fallback for React Router / Client Routes (Express 5 compatible)
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api') || req.path.startsWith('/ws') || req.path.includes('.')) {
    return next();
  }
  const distIndex = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(distIndex)) {
    return res.sendFile(distIndex);
  }
  next();
});

// Start Server
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  🚀 RHOV Sphere - vSphere Style OpenShift Portal`);
  console.log(`  🔗 Server running at: http://localhost:${PORT}`);
  console.log(`  📦 Datacenter: ${clusterState.datacenter.name}`);
  console.log(`  🖥️ Active VMs: ${clusterState.vms.length} | Hosts: ${clusterState.nodes.length}`);
  console.log(`  ⚡ Real KubeVirt Web Console Proxy (Serial & VNC) Active!`);
  console.log(`=======================================================`);
});


import React, { useState, useMemo } from 'react';
import { useCluster } from '../../../context/ClusterContext';
import { 
  Copy, 
  Check, 
  Download, 
  Code2, 
  FileCode, 
  ExternalLink 
} from 'lucide-react';

export default function VmYamlView({ vm }) {
  const { showToast } = useCluster();
  const [copied, setCopied] = useState(false);

  // Generate authentic KubeVirt VirtualMachine CRD YAML
  const yamlContent = useMemo(() => {
    if (!vm) return '';

    const isRunning = vm.status === 'Running';
    const cpuCores = vm.vCpu || 4;
    const memoryGb = vm.memoryGb || 8;
    const disks = vm.disks || [
      { name: 'disk-01', pvc: 'pvc-root', sizeGb: 100, sc: 'nfs-rwx-storage' }
    ];
    const nics = vm.nics || [
      { name: 'vnic0', network: 'ovn-kubernetes', ip: vm.ip || '10.128.2.45', mac: '52:54:00:1a:2b:11' }
    ];

    const diskDevicesYaml = disks.map((d, i) => `        - name: ${d.name.split(' ')[0]}
          disk:
            bus: virtio`).join('\n');

    const diskVolumesYaml = disks.map((d) => `      - name: ${d.name.split(' ')[0]}
        persistentVolumeClaim:
          claimName: ${d.pvc || `pvc-${d.name.split(' ')[0]}`}`).join('\n');

    const interfaceDevicesYaml = nics.map(n => `        - name: ${n.name}
          masquerade: {}`).join('\n');

    const networkVolumesYaml = nics.map(n => `      - name: ${n.name}
        pod: {}`).join('\n');

    return `apiVersion: kubevirt.io/v1
kind: VirtualMachine
metadata:
  name: ${vm.name}
  namespace: ${vm.namespace || 'prd-workloads'}
  labels:
    app.kubernetes.io/name: ${vm.name}
    kubevirt.io/vm: ${vm.name}
    kubevirt.io/os: ${vm.osType || 'rhel'}
    rhov.kubevirt.io/workload-tier: tier-1-production
    rhov.kubevirt.io/managed-by: rhov-sphere-portal
  annotations:
    description: "Enterprise RHOV Virtual Workload - ${vm.os}"
    rhov.kubevirt.io/datacenter: "Enterprise-Seoul-DC"
    rhov.kubevirt.io/assigned-node: "${vm.node || 'master-01.rhov.example.local'}"
    rhov.kubevirt.io/guest-agent: "${vm.guestAgent?.installed ? 'enabled' : 'disabled'}"
spec:
  running: ${isRunning}
  template:
    metadata:
      labels:
        kubevirt.io/domain: ${vm.name}
        kubevirt.io/vm: ${vm.name}
    spec:
      domain:
        cpu:
          cores: ${cpuCores}
          sockets: 1
          threads: 1
        resources:
          requests:
            memory: ${memoryGb}Gi
            cpu: "${cpuCores}"
          limits:
            memory: ${memoryGb}Gi
            cpu: "${cpuCores}"
        devices:
          disks:
${diskDevicesYaml}
          interfaces:
${interfaceDevicesYaml}
          rng: {}
        features:
          acpi: {}
          apic: {}
        machine:
          type: q35
      volumes:
${diskVolumesYaml}
      networks:
${networkVolumesYaml}
status:
  printableStatus: ${vm.status}
  ready: ${isRunning}
  conditions:
    - type: Ready
      status: "${isRunning ? 'True' : 'False'}"
      lastTransitionTime: "2026-10-21T07:15:30Z"
    - type: LiveMigratable
      status: "True"
      lastTransitionTime: "2026-10-21T07:15:30Z"`;
  }, [vm]);

  const handleCopy = () => {
    navigator.clipboard.writeText(yamlContent);
    setCopied(true);
    showToast('KubeVirt VirtualMachine YAML이 클립보드에 복사되었습니다.', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([yamlContent], { type: 'text/yaml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${vm.name}-kubevirt.yaml`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`${vm.name}-kubevirt.yaml 파일이 다운로드되었습니다.`, 'info');
  };

  const lines = yamlContent.split('\n');

  return (
    <div className="vm-yaml-view-container">
      {/* 1. Subheader Toolbar */}
      <div className="yaml-view-toolbar">
        <div className="toolbar-left">
          <FileCode size={15} className="yaml-icon" />
          <span className="yaml-title">OpenShift Virtualization CRD Manifest (KubeVirt v1)</span>
          <span className="yaml-badge">Read-Only Live Sync</span>
        </div>

        <div className="toolbar-right">
          <button 
            type="button" 
            className="yaml-tool-btn" 
            onClick={handleCopy}
            title="YAML 매니페스트 복사"
          >
            {copied ? <Check size={14} className="icon-green" /> : <Copy size={14} />}
            <span>{copied ? '복사됨!' : 'YAML 복사'}</span>
          </button>

          <button 
            type="button" 
            className="yaml-tool-btn" 
            onClick={handleDownload}
            title="YAML 파일 다운로드"
          >
            <Download size={14} />
            <span>다운로드 (.yaml)</span>
          </button>
        </div>
      </div>

      {/* 2. Code Viewer with Line Numbers */}
      <div className="yaml-code-scrollbox">
        <pre className="yaml-code-pre">
          <code>
            {lines.map((line, idx) => {
              // Simple syntax styling
              let lineClass = 'yaml-line';
              if (line.trim().startsWith('#')) lineClass += ' yaml-comment';
              else if (line.includes(':')) {
                const parts = line.split(':');
                const key = parts[0];
                const rest = parts.slice(1).join(':');
                return (
                  <div key={idx} className="yaml-line-row">
                    <span className="line-num">{idx + 1}</span>
                    <span className="line-code">
                      <span className="yaml-key">{key}:</span>
                      <span className="yaml-val">{rest}</span>
                    </span>
                  </div>
                );
              }

              return (
                <div key={idx} className="yaml-line-row">
                  <span className="line-num">{idx + 1}</span>
                  <span className="line-code">{line}</span>
                </div>
              );
            })}
          </code>
        </pre>
      </div>
    </div>
  );
}

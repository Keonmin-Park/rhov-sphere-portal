# RHOV Sphere Portal: Kubernetes 가상화(KubeVirt) 관제 포털 및 전환 아키텍처

> **참고:** 본 저장소는 가상화 인프라의 컨테이너 전환 과제를 해결하기 위해 설계·구현된 프로젝트이며, 모든 설정값은 `.env.example` 기반으로 템플릿화되어 있습니다.

VMware vSphere 환경에서 **Kubernetes 기반 가상화(OpenShift Virtualization / KubeVirt)**로 전환할 때 발생하는 운영팀의 진입 장벽과 휴먼 에러(Toil)를 최소화하기 위해, **스토리지/네트워크 안전 정책(가드레일)을 정의하고 BFF + Watch 스트림 아키텍처로 구현·검증한 관제 포털 및 선언적 인프라 매니페스트**입니다.

---

## 1. 핵심 엔지니어링 설계 포인트 (Key Engineering Focus)

1. **스토리지 AccessMode(`RWX` vs `RWO`) 기반 마이그레이션 가드레일**:
   - KubeVirt의 무중단 Live Migration은 소스 노드와 타겟 노드의 `virt-launcher` Pod가 동일한 PVC를 동시에 마운트해야 동작합니다.
   - 단일 노드 독점 마운트(`ReadWriteOnce` - `thin-csi`) 볼륨을 가진 VM에 Live Migration을 시도할 때 발생하는 `Multi-Attach error`를 사전 차단하고, 공유 스토리지(`ReadWriteMany` - NFS / Ceph RBD) 여부를 검증하는 안전 정책을 UI와 API에 반영했습니다.
2. **듀얼 네트워크(OVN Overlay + Multus L2 Bridge) 연동**:
   - 클러스터 내부 통신용 기본 CNI(`OVN-Kubernetes`)와 별개로, 기존 VMware 가상머신의 사내 고정 IP를 NAT 없이 그대로 유지하기 위해 `NMState` (`NodeNetworkConfigurationPolicy`) 기반 호스트 L2 브리지(`br0`)와 `Multus CNI` (`NetworkAttachmentDefinition`) 구성을 표준화했습니다.
3. **BFF + Collector 사이드카 분리 및 K8s Watch 스트림 구조**:
   - `kube-apiserver`에 대한 무분별한 폴링 부하와 웹 요청 블로킹을 방지하기 위해, 제어 명령을 처리하는 **BFF 서버(`server.js`)**와 Long-lived Watch 스트림(`?watch=true`) 및 PromQL 메트릭을 비동기 수집하는 **Collector 사이드카(`collector.js`)**를 분리 설계했습니다.
4. **최소 권한 RBAC 및 동적 클러스터 인증**:
   - KubeVirt CRD(`VirtualMachine`, `VMI`, `Migration`, `Snapshot`) 및 스토리지/노드 조회에 필요한 권한만 정의한 전용 `ClusterRole`(`rhov-portal-operator-role`)을 적용했습니다.
   - Pod 내부 구동 시 `/var/run/secrets/kubernetes.io/serviceaccount/token`을 자동 탐색하며, UI 모달을 통해 외부 클러스터 API Endpoint/Token도 동적으로 연결할 수 있습니다.
5. **포털 락인(Lock-in) 방지를 위한 GUI ↔ YAML 원클릭 스위치**:
   - 운영자가 vSphere 스타일 GUI에서 조작한 결과가 실제 KubeVirt 선언적 CRD YAML에 어떻게 매핑되는지 즉시 대조할 수 있도록 구현하여 Kubernetes 네이티브 환경 적응을 지원합니다.

---

## 2. 시스템 아키텍처 (System Architecture)

```text
+---------------------------------------------------------------------------------------------------+
| [1] Operator Browser (vSphere Client UX)                                                          |
|   +-- React 19 + Vite SPA (GUI View <-> Declarative KubeVirt YAML View 1-Click Switch)            |
|   +-- noVNC Web Console (Pop-out Multi-Window / Ctrl+Alt+Del Injection)                           |
+-------------------------------------------------+-------------------------------------------------+
                                                  | REST API (/api/v1/*) & WebSocket VNC Stream
                                                  v
+---------------------------------------------------------------------------------------------------+
| [2] OpenShift Native Pod (Deployment: rhov-portal-react | Dual-Container Sidecar Pattern)         |
|                                                                                                   |
|   +-----------------------------------------+       +-----------------------------------------+   |
|   | Portal BFF Server (server.js :4000)     |       | Collector Sidecar (collector.js :4001)  |   |
|   |  - KubeVirt CRD Command Dispatcher      | <==== |  - Long-Lived K8s Watch Stream Consumer |   |
|   |  - RWO vs RWX Migration Guardrail       |  WS   |  - Thanos / Prometheus PromQL Collector |   |
|   |  - VNC WebSocket Proxy & Dynamic Auth   | Sync  |  - VM + VMI + PVC State Normalizer      |   |
|   +--------------------+--------------------+       +--------------------+--------------------+   |
|                        |  In-Cluster ServiceAccount (Least-Privilege RBAC)                        |
+------------------------+-------------------------------------------------+------------------------+
                         | CRD Patch / Create                              | Watch API & PromQL
                         v                                                 v
+---------------------------------------------------------------------------------------------------+
| [3] OpenShift Virtualization (RHOV / KubeVirt) Control Plane & Hypervisor Nodes                   |
|                                                                                                   |
|   +-----------------------------------------+       +-----------------------------------------+   |
|   | KubeVirt Control Plane & Telemetry      |       | Worker Nodes (RHCOS + KVM /dev/kvm)     |   |
|   |  - kube-apiserver / virt-api            | ----> |  - virt-handler (DaemonSet)             |   |
|   |  - virt-controller / HCO Operator       |       |  - virt-launcher Pod (libvirtd + qemu)  |   |
|   |  - Thanos Querier / Tekton Pipelines    |       |  - Dual CNI: OVN-K8s + Multus L2 (br0)  |   |
|   +-----------------------------------------+       +--------------------+--------------------+   |
|                                                                          |                        |
|   +----------------------------------------------------------------------+--------------------+   |
|   | Storage Tiering: RWX Shared (NFS / ODF Ceph -> Live Migration OK) vs RWO Block (thin-csi) |   |
|   +-------------------------------------------------------------------------------------------+   |
+---------------------------------------------------------------------------------------------------+
```

---

## 3. 디렉토리 구조 및 핵심 문서

```text
rhov-kubevirt-portal/
├── src/                                  # React 19 프론트엔드 (인벤토리 트리, 제어 모달, GUI<->YAML 뷰)
├── server.js                             # Express BFF 게이트웨이 & KubeVirt CRD 제어/VNC 프록시
├── collector.js                          # K8s Watch API & Thanos 메트릭 수집 사이드카 에이전트
├── Dockerfile                            # Red Hat UBI 9 Node.js 20 기반 Multi-Stage 빌드
├── manifests/                            # Kubernetes / OpenShift 선언적 매니페스트
│   ├── k8s-manifest.yaml                 # Least-Privilege RBAC, Deployment(Portal+Sidecar), Service, Route
│   ├── tekton-pipeline.yaml              # Tekton CI/CD Pipeline (git-clone -> buildah -> rollout)
│   └── cluster-infra/                    # KubeVirt 인프라 구성 (HCO, NFS RWX, NMState L2 Bridge, NAD, VM)
├── docs/                                 # 핵심 설계 및 트러블슈팅 요약 문서
│   ├── 01-CORE_REQUIREMENTS.md           # 운영 페인포인트 기반 핵심 요구사항 및 안전망 설계 요약
│   └── 02-KUBEVIRT_OPERATIONS_GUIDE.md   # VMware vs KubeVirt 매핑 및 핵심 트러블슈팅(RWO/Multus/MTV) 노트
├── .env.example                          # 클러스터 도메인 / VIP / 스토리지 환경 변수 템플릿
└── setup-env.sh                          # 환경 변수 로드 및 매니페스트 템플릿 렌더링 스크립트
```

---

## 4. 실행 및 배포 방법 (Quick Start)

### 로컬 시뮬레이션 모드 실행
클러스터 연결 정보가 없을 경우 내장된 KubeVirt 인벤토리 시뮬레이션 모드로 구동되어 UI와 제어 흐름을 즉시 확인할 수 있습니다.

```bash
npm install
npm run build
npm start
```

### 클러스터 배포 (OpenShift / KubeVirt)

```bash
cp .env.example .env
./setup-env.sh --render

oc new-project rhov-portal
oc apply -f rendered/k8s-manifest.yaml -n rhov-portal
```

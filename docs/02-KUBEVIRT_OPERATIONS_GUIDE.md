# OpenShift Virtualization (KubeVirt) 핵심 아키텍처 및 트러블슈팅 가이드

운영팀이 포털 UI에 종속(Lock-in)되지 않고 Kubernetes 네이티브 가상화 원리를 이해하며 운영할 수 있도록 정리한 아키텍처 매핑 및 트러블슈팅(RCA) 가이드입니다.

---

## 1. VMware vSphere vs KubeVirt 핵심 개념 매핑

KubeVirt는 가상머신(VM)을 별도의 하이퍼바이저 전용 클러스터가 아닌 **일반 Kubernetes Pod(`virt-launcher`) 내부의 `qemu-kvm` 프로세스**로 캡슐화하여 구동합니다.

| VMware vSphere | OpenShift Virtualization (KubeVirt) | 동작 원리 요약 |
| :--- | :--- | :--- |
| **ESXi Host** | Worker Node (`RHCOS` + `/dev/kvm`) | Linux 커널 KVM 모듈을 통해 하드웨어 가상화 가속 제공 |
| **VM (`.vmx`)** | `VirtualMachine` (CRD) | VM의 CPU, Memory, Disk, Network 스펙을 정의하는 선언적 리소스 |
| **실행 중인 VM** | `VirtualMachineInstance` (`VMI`) + `virt-launcher` Pod | 전원이 켜졌을 때 실제로 워커 노드에 스케줄링되어 구동되는 인스턴스 |
| **vMotion** | `VirtualMachineInstanceMigration` (`VMIM`) | 소스 파드와 타겟 파드 간 실시간 메모리 프리카피(Pre-copy) 및 핸드오버 |
| **Datastore** | `PersistentVolumeClaim` (`PVC`) / `StorageClass` | CSI 기반 볼륨 (`RWX` 공유 스토리지 vs `RWO` 블록 스토리지) |
| **vSwitch / PortGroup** | `OVN-Kubernetes` + `Multus CNI` (`Linux Bridge`) | 기본 Pod 오버레이 망 + 외부 L2 물리망 브리지 이중 구성 |

---

## 2. 주요 아키텍처 설계 및 트러블슈팅 (RCA)

### [Case 1] `thin-csi` (RWO) 볼륨의 Live Migration 실패 (`Multi-Attach error`)

* **현상 (Symptom)**:
  VMware 기본 CSI(`thin-csi`)로 생성된 VM에 대해 Live Migration을 시도할 경우, 타겟 노드의 `virt-launcher` 파드가 `ContainerCreating` 단계에서 중단되고 아래 이벤트가 지속 발생함.
  ```text
  Warning  FailedAttachVolume  attachdetach-controller
  Multi-Attach error for volume "pvc-..." Volume is already exclusively attached to one node and can't be attached to another
  ```
* **원인 분석 (Root Cause Analysis)**:
  1. KubeVirt Live Migration 메커니즘은 무중단 전환을 위해 **소스 노드의 기존 파드가 실행 중인 상태에서 타겟 노드에 새 파드를 띄워 동일한 PVC를 동시 마운트**한 뒤 메모리를 동기화함.
  2. `thin-csi`는 단일 노드 독점 마운트(`ReadWriteOnce`, RWO) 스토리지이므로, Kubernetes의 `attachdetach-controller`가 데이터 오염 방지를 위해 타겟 노드의 추가 마운트를 강제 차단함.
* **조치 및 가드레일 (Resolution & Guardrail)**:
  1. **스토리지 표준화**: 무중단 Live Migration이 필수적인 워크로드는 다중 노드 동시 마운트를 지원하는 **`ReadWriteMany` (RWX) 스토리지(`ODF Ceph RBD`, `NFS`)**로 스토리지 클래스를 분리 지정.
  2. **운영 정책 분리**: `RWO` 볼륨 VM은 정지(Stop) 후 타겟 노드에서 기동하는 Cold Migration 절차를 적용하고, 포털 API(`server.js`) 및 UI(`MigrateModal.jsx`)에서 RWO 디스크 감지 시 Live Migration 시도를 원천 차단하는 가드레일 적용.
* **검증 결과 (Verification)**:
  * RWX 스토리지 환경에서 Live Migration 수행 중 ICMP Ping 패킷 손실 0건(무중단 핸드오버) 검증 완료.

---

### [Case 2] 기존 사내망 고정 IP 유지를 위한 듀얼 네트워크 (OVN + Multus L2 Bridge)

* **과제 (Problem Statement)**:
  Kubernetes 기본 Pod 네트워크(`OVN-Kubernetes`)는 클러스터 내부 사설 대역(`10.128.0.0/14`)과 NAT(Masquerade)를 사용하므로, 기존 VMware에서 사용하던 사내 물리망 고정 IP로 외부 클라이언트가 직접 통신할 수 없음.
* **해결 설계 (Architecture Design)**:
  1. 각 워커 노드에 물리/가상 NIC를 2개(`ens33`, `ens34`)로 분리 구성.
  2. `NMState Operator` (`NodeNetworkConfigurationPolicy`)를 통해 두 번째 인터페이스(`ens34`)에 IP가 할당되지 않은 **순수 L2 Linux Bridge(`br0`, STP 비활성화)**를 선언적으로 생성.
  3. `Multus CNI` (`NetworkAttachmentDefinition`)를 통해 VM에 보조 네트워크 인터페이스를 연결하여 사내 물리망과 L2 레벨로 1:1 직결(NAT 없이 기존 고정 IP 통신 지원).
* **검증 결과 (Verification)**:
  * 게스트 OS 내부에서 사내망 GW(`10.40.101.1`)로의 직접 Ping 및 외부 트래픽 인입 확인 완료.

---

### [Case 3] VMware ➔ KubeVirt 마이그레이션(MTV) 시 이슈 해결

#### 1. VDDK InitContainer `Init:0/1` 무한 대기 현상
* **원인**: VMware VMDK 디스크 변환용 VDDK 라이브러리를 주입하는 `InitContainer`의 실행 명령이 `sleep infinity`로 설정되어 프로세스가 종료되지 않음. Kubernetes의 `InitContainer`는 정상 종료(`Exit Code 0`)되어야만 메인 컨테이너(`virt-v2v`)로 제어가 넘어감.
* **조치**: 공유 `emptyDir` 볼륨(`/opt`)에 라이브러리 파일 복사(`cp -r`) 직후 컨테이너가 정상 종료되도록 이미지를 수정하여 파이프라인 정상화.

#### 2. 이관 후 게스트 OS 네트워크 `disconnected` (`ens33` ➔ `enp1s0`)
* **원인**: VMware 환경의 가상 NIC 드라이버(`VMXNET3`, 디바이스명 `ens33`)가 KubeVirt로 변환되면서 KVM 반가상화 드라이버인 `VirtIO` PCI 장치(`enp1s0`)로 변경됨. 게스트 OS의 기존 NetworkManager 연결 프로필이 구 하드웨어 디바이스명을 참조하여 링크 업 실패.
* **조치**: 이관 후 `nmcli connection modify ens33 connection.interface-name enp1s0` 명령으로 디바이스 매핑을 갱신하여 네트워크 정상 개통.

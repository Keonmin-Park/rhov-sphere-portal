# RHOV Sphere Portal - 핵심 운영 요구사항 명세 (Core Requirements)

## 1. 기획 배경
레거시 VMware vSphere 환경에서 Kubernetes 기반 가상화(OpenShift Virtualization / KubeVirt)로 전환할 때, 기존 운영팀이 낯선 K8s 웹 콘솔과 선언적 YAML 조작으로 인해 겪는 **운영 피로도(Toil)와 휴먼 에러를 줄이기 위해** 핵심 요구사항을 정의하고 포털을 구현했습니다.

---

## 2. 핵심 설계 요구사항 요약

| 구분 | 요구사항 명칭 | 도입 목적 및 운영 효과 |
| :---: | :--- | :--- |
| **인벤토리** | **실시간 검색 및 상태 필터 토글** | 대소문자/정규식(Regex) 기반 VM 즉시 필터링 및 상태별(`Running`, `Stopped`, `Error`) 원클릭 조회 |
| **일괄 제어** | **다중 VM 동시 제어 (Batch Control)** | 단일 VM 제어 위주였던 기존 환경의 한계를 개선하여 다중 선택 전원 제어·스냅샷·마이그레이션 지원 |
| **전원 안전망** | **ACPI 정상 종료 vs 강제 차단 분리** | 파일시스템 손상을 방지하기 위해 게스트 OS 정상 셧다운(ACPI)과 강제 종료(`gracePeriodSeconds: 0` + 2차 확인 체크박스)를 UI에서 분리 |
| **스토리지 안전망** | **RWX vs RWO 구분 및 마이그레이션 차단** | 단일 노드 독점 마운트(`ReadWriteOnce`) 볼륨을 가진 VM의 라이브 마이그레이션 시도를 사전 감지·차단하여 `Multi-Attach error` 예방 |
| **호스트 운영** | **노드 점검 모드 및 VM 자동 대피** | 워커 노드 유지보수(Cordon/Drain) 진입 시 해당 노드의 실행 중 VM을 가용 워커 노드로 자동 분산 마이그레이션 |
| **플랫폼 학습** | **GUI 뷰 ↔ K8s YAML 뷰 원클릭 스위치** | 운영자가 UI에서 조작한 내용이 실제 KubeVirt `VirtualMachine` CRD YAML에 어떻게 선언되는지 즉시 대조하여 K8s 네이티브 적응 지원 |
| **인증 확장성** | **In-Cluster SA 토큰 및 동적 클러스터 연결** | Pod 내부 실행 시 ServiceAccount 토큰을 자동 감지하고, UI 모달을 통해 타 클러스터 API URL/Token도 동적으로 전환 가능하도록 구성 |

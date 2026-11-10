---
title: Band Secret Vote
project: band-secret-vote
doc_type: project-index
source: github
created_at: 2026-11-10
updated_at: 2026-11-10
status: planning-fast-track-v0.1
summary: 6명의 밴드 멤버가 추천한 18곡에서 추천자별 한 곡씩 선정하는 GitHub Pages 비밀투표 웹앱.
---

# Band Secret Vote — 밴드 공연곡 비밀투표

## 목표
6명이 각자 추천한 3곡(총 18곡)에서, 팀원 전원이 **추천자별 1곡씩** 선택해 최종 6곡을 공정하게 선정하는 모바일 중심 웹앱.

## 현재 상태
- **Fast Track v0.1 — 요구사항 등록 완료 / 구현 미착수**
- **확정**: 일반 공개 URL과 개인별 URL을 분리한다. 공개 페이지는 곡 목록·YouTube 링크·일정·투표 기간 중 참여 진행률·공개 조건 충족 후 결과를 표시한다.
- **확정**: 각 6명은 자기 추천곡을 포함하여 각 추천자 그룹당 1곡씩, 총 6곡을 선택한다.
- **확정**: 투표 기간 중 개인 URL로 재진입하여 **횟수 제한 없이 수정**할 수 있으며 최신 제출만 유효하다.
- **확정**: 결과는 **마감 시각 경과 AND 6명 전원 제출 완료**일 때만 공개한다. 6명 모두 완료해도 마감 전이면 비공개다.
- **확정**: 투표 중에는 타인의 선택과 중간 득표를 숨기고, 결과 발표 시 **6명 각자의 최종 6곡 선택(이름과 선택곡의 연결), 총 36개 선택 내역 및 득표 결과를 일반 공개 URL에 공개**한다. 이전 수정 이력은 공개하지 않는다.
- **확정**: 투표 제출 전에 결과 공개 후 개인별 최종 선택이 일반 URL에 표시된다는 사실을 명확히 안내한다.
- **확정**: 공개 사이트 호스팅은 **GitHub Pages**. 실제 운영 URL, 백엔드, 배포 방식 및 계정은 미구성.
- **제안/검토 중**: React/Vite + GitHub Pages(프론트) + Supabase Edge Functions/PostgreSQL(서버). 최종 기술 결정 전 검증 필요.
- **미결정**: 동점 재투표, 후보 중복 처리, 미참여자 발생 시 운영자 연장·재개 절차, 관리자 인증 및 보안 수준.

## 프로젝트 문서
- [Fast Track v0.1 사양](docs/v0.1/spec.md) — 단일 요구사항 기준
- [Fast Track 작업 목록](docs/v0.1/tasks.md) — 작은 단위 구현 체크리스트
- [검증 계획](docs/v0.1/validation.md) — 완료 조건 및 보안·집계 검증
- [기술/운영 결정](docs/decisions.md) — 확정과 제안을 분리
- [문서 디렉터리 안내](docs/README.md)
- [AI 작업 규칙](AGENTS.md)
- [변경 이력](CHANGELOG.md)

## 예상 소스 배치 (미생성)
```text
40-projects/band-secret-vote/
├── README.md / AGENTS.md / CHANGELOG.md
├── docs/
│   ├── README.md
│   ├── decisions.md
│   └── v0.1/
│       ├── README.md
│       ├── spec.md
│       ├── tasks.md
│       └── validation.md
├── web/              # 계획: 공개/개인/관리자 UI
└── supabase/         # 후보: 서버 API/DB 마이그레이션
```

## Fast Track 원칙
1. 요구사항은 `docs/v0.1/spec.md`를 단일 기준으로 사용한다. 추측한 세부사항은 미결정으로 남긴다.
2. **기획 → 최소 구현 → 자동 검증 → 실제 휴대전화 검증 → 개선** 순서로 짧게 진행한다.
3. 확정되지 않은 기능을 조용히 추가하거나 투표 결과 공개 조건을 변경하지 않는다.
4. 실제 투표 URL 토큰, 비밀번호, API 비밀키, 개별 투표 원본을 GitHub 저장소와 프론트 빌드 산출물에 올리지 않는다.
5. GitHub Pages는 정적 사이트이므로 투표·마감·집계 권한은 별도 서버에서 검사한다.
6. 미구현/미검증/미배포 상태를 완료로 표시하지 않는다.
7. 공개 URL의 YouTube 링크는 **참조용 링크**이며 영상 자체를 저장하거나 배포하지 않는다.

## 관련 문서
[저장소 관리 기준](../../DOCUMENT_MANAGEMENT_GUIDE.md) · [프로젝트 목록](../README.md) · [프로젝트 생성 가이드](../PROJECT_DIRECTORY_GUIDE.md)

---
title: Band Secret Vote
project: band-secret-vote
doc_type: project-index
source: github
created_at: 2026-11-10
updated_at: 2026-11-10
status: completed-fast-track-v0.1
summary: 6명의 밴드 멤버가 추천한 18곡에서 추천자별 한 곡씩 선정하는 GitHub Pages 비밀투표 웹앱 (v0.1 배포 및 검증 완료).
---

# Band Secret Vote — 밴드 공연곡 비밀투표

## 목표
6명이 각자 추천한 3곡(총 18곡)에서, 팀원 전원이 **추천자별 1곡씩** 선택해 최종 6곡을 공정하게 선정하는 모바일 중심 웹앱.

## 현재 상태 (v0.1 최종 완료)
- **Fast Track v0.1 — 개발, 실기 테스트 및 프로덕션 배포 완료 (2026-11-10)**
- **운영 사이트 URL**: `https://BongCheolShin.github.io/band-secret-vote/`
- **저장소**: `https://github.com/BongCheolShin/band-secret-vote.git` (브랜치: `main`, `gh-pages`)
- **백엔드**: Supabase PostgreSQL + Row Level Security(RLS) + Security Definer RPC 함수
- **확정 정책 및 기능 구현 내역**:
  - 일반 공개 URL과 개인별 고유 난수(32자리 Hex) URL을 분리.
  - 공개 페이지: 18곡 후보 및 YouTube 바로듣기, 일정, 접수/진행 현황, 마감 및 전원 제출 충족 시 결과 자동 공개.
  - 개인 투표 페이지: 6개 추천자 그룹(본인 그룹 포함)별 각 1곡씩 총 6곡 라디오 선택, 무제한 수정 및 최신 제출만 반영.
  - 마감 전 고지문: "투표 중 비공개, 마감 및 6명 전원 참여 완료 시 이름과 최종 선택이 일반 공개 페이지에 투명하게 공개됨" 사전 안내 (FR-017).
  - 결과 공개 이중 조건: 서버 시각 기준 `now >= end_at AND completed_members == 6` 충족 시에만 공개 (서버 RPC에서 엄격히 검증).
  - 결과 공개 화면: 최종 선정곡 6곡 카드, 18곡 상세 득표수, 6명 실명 × 6개 최종 선택(총 36건) 매트릭스 표 투명 공개.
  - **동점 처리 정책 (사용자 확정)**: 추천자 그룹 내 1위 득표 동점 발생 시, **해당 그룹 추천인(본인)이 직접 투표한 곡을 최종 선정곡으로 자동 확정** (`[추천인 동점 우선]` 뱃지 표기).
  - 관리자 콘솔: 비밀번호 인증 기반, 개인 링크 일괄 카톡 복사, 18곡 후보곡 등록/수정, 투표 일정(KST) 및 제목 설정.

## 프로젝트 문서
- [Fast Track v0.1 사양](docs/v0.1/spec.md) — 단일 요구사항 기준
- [Fast Track 작업 목록](docs/v0.1/tasks.md) — 구현 및 배포 체크리스트 (전 항목 완료)
- [검증 계획 및 결과](docs/v0.1/validation.md) — 단위 테스트 및 실기 검증 결과 (PASS)
- [기술/운영 결정](docs/decisions.md) — 아키텍처 및 정책 결정 기록 (ADR-001 ~ ADR-009)
- [AI 작업 규칙](AGENTS.md)
- [변경 이력](CHANGELOG.md)

## 실제 소스 구조
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
├── supabase/
│   ├── schema.sql      # PostgreSQL DDL, RLS, 보안 RPC 함수
│   └── seed.sql        # 6명 멤버, 18곡 후보 데이터 시드
└── web/                # React 18 + Vite + TypeScript + Tailwind CSS
    ├── src/
    │   ├── pages/      # PublicPage, VotePage, AdminPage
    │   ├── lib/        # Supabase 클라이언트, 날짜 유틸(dateUtils)
    │   └── __tests__/  # Vitest 비즈니스 로직 및 동점 단위 테스트
    └── dist/           # gh-pages 배포용 정적 빌드 산출물
```

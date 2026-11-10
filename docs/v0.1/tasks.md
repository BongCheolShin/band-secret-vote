# v0.1 Fast Track 작업 목록

- 상태: **전 항목 완료 (DONE)** (2026-11-10)
- 기준: [spec.md](spec.md) / [decisions.md](../decisions.md)
- 배포 사이트: `https://BongCheolShin.github.io/band-secret-vote/`

| ID | 우선순위 | 작업 | 완료 조건 및 검증 내용 | 상태 |
| --- | --- | --- | --- | --- |
| FT-001 | P0 | 기술 선택 및 호스팅 결정 | React + Vite + TS + Tailwind + Supabase(PostgreSQL/RLS/RPC) + GitHub Pages 채택 (ADR-007) | DONE |
| FT-002 | P0 | 투표 데이터 모델/보안 RPC | PostgreSQL DDL 스키마, RLS 및 보안 함수(`get_public_election_data`, `get_my_ballot`, `submit_ballot`, `get_admin_data`) 작성 완료 | DONE |
| FT-003 | P0 | 프론트엔드 프로젝트 초기화 | Vite + Tailwind 번들러 설정, 정적 에셋 빌드(740ms), Vitest 테스트 환경 구성 완료 | DONE |
| FT-004 | P0 | 관리자 콘솔 및 링크 관리 | 관리자 비밀번호 인증, 6명 개인 URL 확인 및 카카오톡 1:1 전달용 일괄 복사 기능 구현 완료 | DONE |
| FT-005 | P0 | 개인 URL 발급 및 보안 검증 | 32자리 고엔트로피 난수 Hex 토큰 발급, 이니셜/순번 미노출, 토큰 기반 본인 투표함 조회 RPC 완료 | DONE |
| FT-006 | P0 | 일반 공개 페이지 구현 | 18곡 후보 및 YouTube 링크, KST 일정, 접수/투표 진행률 배너, 마감 전 중간 집계 은닉, 결과 발표 후 6×6 실명 매트릭스 표 구현 완료 | DONE |
| FT-007 | P0 | 개인 투표 및 무제한 재수정 | 그룹당 1개×6곡 선택, 본인 추천 그룹 포함, 마감 전 무제한 수정 및 최신 제출만 반영, 발표 후 실명 공개 사전 고지(FR-017) 구현 완료 | DONE |
| FT-008 | P0 | 서버 마감 및 결과 공개 이중 검증 | 서버 시각 기준 `now >= end_at AND completed_members == 6` 충족 시에만 집계 및 선택 내역 반환하는 서버 RPC 검증 완료 | DONE |
| FT-009 | P0 | 동점 처리 정책 개선 | 동점 발생 시 해당 그룹 추천인(본인)이 직접 투표한 곡을 최종 선정곡으로 자동 확정 (`[추천인 동점 우선]` 뱃지 표기) 구현 완료 (ADR-009) | DONE |
| FT-010 | P0 | 자동 보안/기능 단위 테스트 | Vitest 단위 테스트(완결성, 이중 조건, 36표 정합성, 동점 처리) 4개 시나리오 100% PASS | DONE |
| FT-011 | P1 | 실제 기기 및 브라우저 검증 | 모바일(카카오톡 인앱 브라우저 / iOS Safari / Android Chrome) 및 데스크톱 브라우저에서 투표·수정·결과 조회 정상 동작 검증 완료 | DONE |
| FT-012 | P1 | 프로덕션 GitHub Pages 배포 | `gh-pages` 브랜치를 통한 정적 빌드 자동 배포, live Supabase DB 연동 완료 | DONE |
| FT-013 | P0 | 개인 PIN 잠금 및 관리자 초기화 | 최초 4자리 PIN 설정 강제, PIN 일치 시에만 투표지 열림/수정, 관리자 콘솔 PIN 초기화 RPC 및 UI 완료 (ADR-011) | DONE |

## 작업 완료 요약
1. **FT-001 ~ FT-003**: React 18, TypeScript, Tailwind, Supabase(PostgreSQL), GitHub Pages 파이프라인 구축.
2. **FT-004 ~ FT-007**: 관리자 콘솔, 개인별 32자리 고유 토큰, 6곡 필수 선택 및 사전 고지문, 무제한 재수정 지원.
3. **FT-008 ~ FT-009**: 마감 AND 전원 제출 이중 조건 서버 강제, 동점 시 추천인 본인 선택 곡 우선 채택 정책 반영.
4. **FT-010 ~ FT-012**: Vitest 4개 단위 테스트 통과, 실제 모바일 인앱/웹 실기 검증, 실서버 프로덕션 배포 완료.
5. **FT-013**: 개인 4자리 PIN 잠금(관리자 사전 열람 원천 차단) 및 분실자 구제용 관리자 PIN 초기화 기능 구현 완료.

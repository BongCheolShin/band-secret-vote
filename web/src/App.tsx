import { useState, useEffect } from 'react';
import PublicPage from './pages/PublicPage';
import VotePage from './pages/VotePage';
import AdminPage from './pages/AdminPage';
import DevSimulator from './components/DevSimulator';
import { mockPublicData, mockRevealedResults, mockRevealedMemberChoices, recommendersList, baseElection } from './mockData';
import { PublicElectionData, MemberBallotData } from './types';

import { isSupabaseConfigured } from './lib/supabase';

export default function App() {
  const [currentView, setCurrentView] = useState<'public' | 'vote' | 'admin'>('public');
  const [token, setToken] = useState<string>('');
  
  // 시뮬레이터 override 데이터 (Supabase 연결 시 기본은 실제 DB 데이터를 직접 조회)
  const [overridePublicData, setOverridePublicData] = useState<PublicElectionData | undefined>(
    isSupabaseConfigured ? undefined : mockPublicData
  );
  const [currentMemberData, setCurrentMemberData] = useState<MemberBallotData | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const voteToken = params.get('token');
    const page = params.get('page');

    if (voteToken) {
      setToken(voteToken);
      const foundMember = recommendersList.find(m => m.token === voteToken);
      if (foundMember) {
        setCurrentMemberData({
          election: baseElection,
          member: {
            id: foundMember.id,
            name: foundMember.name,
            part: foundMember.part,
          },
          my_choices: [],
          has_submitted: false,
          recommenders: recommendersList.map(r => ({
            ...r,
            is_me: r.id === foundMember.id,
          })),
        });
      }
      setCurrentView('vote');
    } else if (page === 'admin') {
      setCurrentView('admin');
    } else {
      setCurrentView('public');
    }
  }, []);

  // 시뮬레이터: 멤버 변경
  const handleSelectMember = (memberId: string) => {
    const targetMember = recommendersList.find(m => m.id === memberId);
    if (!targetMember) return;

    setToken(targetMember.token);
    setCurrentMemberData({
      election: baseElection,
      member: {
        id: targetMember.id,
        name: targetMember.name,
        part: targetMember.part,
      },
      my_choices: [],
      has_submitted: false,
      recommenders: recommendersList.map(r => ({
        ...r,
        is_me: r.id === targetMember.id,
      })),
    });
    setCurrentView('vote');
  };

  // 시뮬레이터: 시나리오 상태 변경
  const handleSetScenario = (scenario: 'before' | 'in_progress' | 'waiting' | 'revealed') => {
    setCurrentView('public');
    if (scenario === 'before') {
      const beforeRecommenders = recommendersList.map(r => {
        if (['m1', 'm2', 'm3'].includes(r.id)) {
          return r;
        }
        return { ...r, songs: [] };
      });

      setOverridePublicData({
        ...mockPublicData,
        election: {
          ...baseElection,
          server_now: '2026-11-10T12:00:00+09:00', // 시작 전
        },
        completed_count: 0,
        is_ended: false,
        is_revealed: false,
        recommenders: beforeRecommenders,
        results: [],
        member_choices: [],
      });
    } else if (scenario === 'in_progress') {
      setOverridePublicData({
        ...mockPublicData,
        election: {
          ...baseElection,
          server_now: '2026-11-12T12:00:00+09:00', // 진행 중
        },
        completed_count: 3,
        is_ended: false,
        is_revealed: false,
        results: [],
        member_choices: [],
      });
    } else if (scenario === 'waiting') {
      setOverridePublicData({
        ...mockPublicData,
        election: {
          ...baseElection,
          server_now: '2026-11-14T12:00:00+09:00', // 마감 후
        },
        completed_count: 5, // 5명 미완료
        is_ended: true,
        is_revealed: false,
        results: [],
        member_choices: [],
      });
    } else if (scenario === 'revealed') {
      setOverridePublicData({
        ...mockPublicData,
        election: {
          ...baseElection,
          server_now: '2026-11-14T12:00:00+09:00', // 마감 후
        },
        completed_count: 6, // 6명 전원 완료
        is_ended: true,
        is_revealed: true,
        results: mockRevealedResults,
        member_choices: mockRevealedMemberChoices,
      });
    }
  };

  const handleReset = () => {
    setOverridePublicData(isSupabaseConfigured ? undefined : mockPublicData);
    setCurrentMemberData(null);
    setCurrentView('public');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between">
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-6">
        {currentView === 'vote' && (
          <VotePage
            token={token}
            onGoPublic={() => setCurrentView('public')}
            overrideMemberData={currentMemberData}
          />
        )}
        {currentView === 'admin' && (
          <AdminPage onGoPublic={() => setCurrentView('public')} />
        )}
        {currentView === 'public' && (
          <PublicPage overrideData={overridePublicData} />
        )}
      </main>

      <footer className="py-4 text-center text-xs text-slate-500 border-t border-slate-800">
        <p>이따위밴드 (IT' DIE) 공연곡 비밀투표 시스템</p>
      </footer>

      {/* 로컬 개발 환경(DEV)에서만 테스트 시뮬레이터 플로팅 바 표시 */}
      {import.meta.env.DEV && (
        <DevSimulator
          onSelectMember={handleSelectMember}
          onSetScenario={handleSetScenario}
          onReset={handleReset}
          currentView={currentView}
          onGoPublic={() => setCurrentView('public')}
          onGoAdmin={() => setCurrentView('admin')}
        />
      )}
    </div>
  );
}

import { useState } from 'react';
import { Settings, Play, RefreshCw } from 'lucide-react';

interface DevSimulatorProps {
  onSelectMember: (memberId: string) => void;
  onSetScenario: (scenario: 'before' | 'in_progress' | 'waiting' | 'revealed') => void;
  onReset: () => void;
  currentView: string;
  onGoPublic: () => void;
  onGoAdmin: () => void;
}

export default function DevSimulator({
  onSelectMember,
  onSetScenario,
  onReset,
  currentView,
  onGoPublic,
  onGoAdmin,
}: DevSimulatorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const members = [
    { id: 'm1', name: '이상희', part: '키보드' },
    { id: 'm2', name: '손석호', part: '기타' },
    { id: 'm3', name: '권선영', part: '기타' },
    { id: 'm4', name: '신봉철', part: '베이스' },
    { id: 'm5', name: '문성일', part: '보컬' },
    { id: 'm6', name: '김동희', part: '드럼' },
  ];

  return (
    <aside aria-label="Dev Simulator" className="fixed bottom-3 right-3 z-50">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-violet-600 hover:bg-violet-500 text-white p-2.5 rounded-full shadow-2xl flex items-center gap-1.5 text-xs font-bold border border-violet-400/50"
          title="로컬 테스트 시뮬레이터 열기"
        >
          <Settings className="w-4 h-4 animate-spin-slow" />
          <span>테스트 시뮬레이터</span>
        </button>
      ) : (
        <div className="bg-slate-900/95 border border-slate-700 backdrop-blur-md rounded-2xl p-4 shadow-2xl w-80 text-xs space-y-3 text-slate-200">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <span className="font-bold text-violet-400 flex items-center gap-1">
              <Play className="w-3.5 h-3.5" /> 로컬 테스트 시뮬레이터
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded"
            >
              닫기
            </button>
          </div>

          {/* 뷰 전환 */}
          <div>
            <p className="text-slate-400 font-semibold mb-1">1. 화면 모드 전환</p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={onGoPublic}
                className={`py-1.5 px-2 rounded-lg font-medium text-center ${
                  currentView === 'public' ? 'bg-violet-600 text-white' : 'bg-slate-800 hover:bg-slate-700'
                }`}
              >
                일반 공개 화면
              </button>
              <button
                onClick={onGoAdmin}
                className={`py-1.5 px-2 rounded-lg font-medium text-center ${
                  currentView === 'admin' ? 'bg-violet-600 text-white' : 'bg-slate-800 hover:bg-slate-700'
                }`}
              >
                관리자 화면
              </button>
            </div>
          </div>

          {/* 멤버별 개인 투표함 즉시 진입 */}
          <div>
            <p className="text-slate-400 font-semibold mb-1">2. 멤버별 개인 투표지 진입</p>
            <div className="grid grid-cols-3 gap-1">
              {members.map(m => (
                <button
                  key={m.id}
                  onClick={() => onSelectMember(m.id)}
                  className="bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg text-center"
                >
                  <div className="font-bold text-slate-200">{m.name}</div>
                  <div className="text-[10px] text-slate-400">{m.part}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 시나리오 상태 테스트 */}
          <div>
            <p className="text-slate-400 font-semibold mb-1">3. 투표 상태 시뮬레이션 (공개 화면)</p>
            <div className="grid grid-cols-2 gap-1 text-[11px]">
              <button
                onClick={() => onSetScenario('before')}
                className="bg-slate-800 hover:bg-slate-700 p-1.5 rounded text-left"
              >
                ⏳ 투표 시작 전
              </button>
              <button
                onClick={() => onSetScenario('in_progress')}
                className="bg-slate-800 hover:bg-slate-700 p-1.5 rounded text-left"
              >
                🗳️ 투표 진행 중 (3/6)
              </button>
              <button
                onClick={() => onSetScenario('waiting')}
                className="bg-slate-800 hover:bg-slate-700 p-1.5 rounded text-left"
              >
                🛑 마감 (5/6 대기)
              </button>
              <button
                onClick={() => onSetScenario('revealed')}
                className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-900 p-1.5 rounded text-left font-bold"
              >
                🎉 전원 완료 & 결과 공개
              </button>
            </div>
          </div>

          {/* 초기화 */}
          <button
            onClick={onReset}
            className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white flex items-center justify-center gap-1 text-[11px]"
          >
            <RefreshCw className="w-3 h-3" /> 투표 데이터 초기화
          </button>
        </div>
      )}
    </aside>
  );
}

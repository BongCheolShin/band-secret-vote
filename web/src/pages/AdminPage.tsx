import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { mockPublicData, recommendersList } from '../mockData';
import { KeyRound, Copy, Check, ArrowLeft, Users, ShieldAlert, Calendar, Music, Save, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import YoutubeIcon from '../components/YoutubeIcon';
import { toLocalInputFormat } from '../lib/dateUtils';

interface MemberLink {
  id: string;
  name: string;
  part: string;
  vote_token: string;
  has_submitted?: boolean;
  songs: Array<{
    id: string;
    title: string;
    artist: string;
    youtube_url: string;
    order_no: number;
  }>;
}

interface AdminPageProps {
  onGoPublic: () => void;
}

export default function AdminPage({ onGoPublic }: AdminPageProps) {
  const [adminPass, setAdminPass] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'links' | 'songs' | 'settings'>('links');
  const [electionId, setElectionId] = useState<string>('');

  // 1. 투표 기본 설정 상태
  const [title, setTitle] = useState('이따위밴드 2027년 상반기 공연곡 투표');
  const [theme, setTheme] = useState(mockPublicData.election.theme);
  const [startAt, setStartAt] = useState('2026-11-12T00:00');
  const [endAt, setEndAt] = useState('2026-11-13T23:59');
  const [settingsSaved, setSettingsSaved] = useState(false);

  // 2. 멤버 및 18곡 후보 데이터
  const [membersData, setMembersData] = useState<MemberLink[]>(recommendersList.map(r => ({
    id: r.id,
    name: r.name,
    part: r.part,
    vote_token: r.token,
    has_submitted: false,
    songs: r.songs,
  })));
  const [expandedMemberId, setExpandedMemberId] = useState<string>(membersData[0]?.id || '');
  const [songsSaved, setSongsSaved] = useState(false);

  // 3. 링크 복사 상태
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [allCopied, setAllCopied] = useState<boolean>(false);

  const EXPECTED_PASS = import.meta.env.VITE_ADMIN_SECRET || 'itdie2027';

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPass.trim() === EXPECTED_PASS) {
      setIsAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError('관리자 비밀번호가 일치하지 않습니다.');
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !isSupabaseConfigured || !supabase) return;

    const fetchAdminData = async () => {
      if (!supabase) return;
      try {
        const { data: adminData, error } = await supabase.rpc('get_admin_data');
        if (!error && adminData) {
          const el = adminData.election;
          setElectionId(el.id);
          setTitle(el.title);
          setTheme(el.theme);
          setStartAt(toLocalInputFormat(el.start_at));
          setEndAt(toLocalInputFormat(el.end_at));

          if (adminData.members) {
            setMembersData(adminData.members as MemberLink[]);
            if (adminData.members.length > 0) {
              setExpandedMemberId(adminData.members[0].id);
            }
          }
        }
      } catch (err) {
        console.error('관리자 데이터 조회 실패:', err);
      }
    };

    fetchAdminData();
  }, [isAuthenticated]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSupabaseConfigured && supabase && electionId) {
      try {
        await supabase.rpc('admin_save_election', {
          p_election_id: electionId,
          p_title: title,
          p_theme: theme,
          p_start_at: new Date(startAt).toISOString(),
          p_end_at: new Date(endAt).toISOString(),
        });
      } catch (err) {
        console.error('설정 저장 실패:', err);
      }
    }
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  };

  const handleSongChange = (memberId: string, songIndex: number, field: string, value: string) => {
    setMembersData(prev => prev.map(m => {
      if (m.id !== memberId) return m;
      const updatedSongs = [...m.songs];
      // 3곡이 다 안 채워져 있을 때 대비
      while (updatedSongs.length <= songIndex) {
        updatedSongs.push({
          id: `new-${Date.now()}-${updatedSongs.length}`,
          title: '',
          artist: '',
          youtube_url: '',
          order_no: updatedSongs.length + 1,
        });
      }
      updatedSongs[songIndex] = {
        ...updatedSongs[songIndex],
        [field]: value,
      };
      return { ...m, songs: updatedSongs };
    }));
  };

  const handleSaveSongs = async () => {
    if (isSupabaseConfigured && supabase && electionId) {
      try {
        for (const m of membersData) {
          for (let i = 0; i < 3; i++) {
            const song = m.songs[i];
            if (song && (song.title || song.artist)) {
              await supabase.rpc('admin_save_song', {
                p_election_id: electionId,
                p_recommender_id: m.id,
                p_order_no: i + 1,
                p_title: song.title.trim(),
                p_artist: song.artist.trim() || '신해철',
                p_youtube_url: song.youtube_url?.trim() || '',
              });
            }
          }
        }
      } catch (err) {
        console.error('곡 저장 실패:', err);
      }
    }
    setSongsSaved(true);
    setTimeout(() => setSongsSaved(false), 2500);
  };

  const getVoteUrl = (token: string) => {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    return `${origin}${pathname}?token=${token}`;
  };

  const copyToClipboard = (token: string) => {
    const url = getVoteUrl(token);
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const copyAllLinks = () => {
    const text = membersData
      .map(m => `🎸 [이따위밴드 투표] ${m.name} 님:\n${getVoteUrl(m.vote_token)}`)
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 2000);
  };

  if (!isAuthenticated) {
    return (
      <div className="space-y-6 pt-8">
        <button
          onClick={onGoPublic}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          일반 공개 페이지로 이동
        </button>

        <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-6 space-y-4 max-w-sm mx-auto">
          <div className="text-center space-y-1">
            <div className="w-10 h-10 bg-violet-900/60 rounded-full flex items-center justify-center mx-auto text-violet-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold text-white">투표 관리자 콘솔</h1>
            <p className="text-xs text-slate-400">일정, 18곡 후보 및 개인 링크 관리</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <input
                type="password"
                value={adminPass}
                onChange={e => setAdminPass(e.target.value)}
                placeholder="관리자 암호 입력"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
              {authError && <p className="text-xs text-rose-400 mt-1">{authError}</p>}
            </div>

            <button
              type="submit"
              className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-2.5 px-4 rounded-lg text-sm transition-colors"
            >
              인증하고 들어가기
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <button
        onClick={onGoPublic}
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        일반 공개 페이지로 이동
      </button>

      <header className="space-y-1">
        <span className="text-xs px-2.5 py-0.5 bg-violet-900/60 text-violet-300 font-semibold rounded-full border border-violet-700/50">
          관리자 콘솔
        </span>
        <h1 className="text-2xl font-bold text-white">공연곡 투표 통합 관리</h1>
        <p className="text-xs text-slate-400">
          투표 기본 정보, 18곡 후보 등록, 카톡 전달 링크를 관리합니다.
        </p>
      </header>

      {/* 보안 주의사항 */}
      <section className="bg-slate-800/80 border border-slate-700 rounded-xl p-3.5 space-y-1 text-xs text-slate-300">
        <div className="flex items-center gap-1.5 text-amber-400 font-bold">
          <ShieldAlert className="w-4 h-4" />
          공정성 원칙
        </div>
        <p className="text-slate-400 leading-relaxed">
          • 투표 기간 중에는 <strong className="text-white font-bold">관리자도 중간 득표수나 타인의 선택을 볼 수 없습니다.</strong><br />
          • 개인 링크는 다른 멤버와 섞이지 않도록 <strong className="text-white font-bold">카카오톡 1:1 대화</strong>로 전송하세요.
        </p>
      </section>

      {/* 상단 탭 메뉴 */}
      <div className="grid grid-cols-3 gap-1 bg-slate-800 p-1 rounded-xl text-xs font-semibold">
        <button
          onClick={() => setActiveTab('links')}
          className={`py-2 rounded-lg flex items-center justify-center gap-1 transition-colors ${
            activeTab === 'links' ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" /> 개인 링크
        </button>
        <button
          onClick={() => setActiveTab('songs')}
          className={`py-2 rounded-lg flex items-center justify-center gap-1 transition-colors ${
            activeTab === 'songs' ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Music className="w-3.5 h-3.5" /> 18곡 후보 등록
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`py-2 rounded-lg flex items-center justify-center gap-1 transition-colors ${
            activeTab === 'settings' ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" /> 일정/제목 설정
        </button>
      </div>

      {/* 탭 1: 개인 링크 관리 */}
      {activeTab === 'links' && (
        <section className="space-y-4">
          <button
            onClick={copyAllLinks}
            className="w-full py-2.5 px-4 bg-violet-600/30 hover:bg-violet-600/40 border border-violet-500/50 rounded-xl text-xs font-bold text-violet-200 flex items-center justify-center gap-2 transition-colors"
          >
            {allCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {allCopied ? '전체 링크가 복사되었습니다!' : `카톡 전달용 ${membersData.length}명 전체 링크 한 번에 복사`}
          </button>

          <div className="space-y-2.5">
            {membersData.map(member => {
              const isCopied = copiedToken === member.vote_token;
              const voteUrl = getVoteUrl(member.vote_token);

              return (
                <div
                  key={member.id}
                  className="bg-slate-800/80 border border-slate-700 rounded-xl p-3.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{member.name}</span>
                      <span className="text-xs text-slate-400">({member.part})</span>
                      {member.has_submitted ? (
                        <span className="text-[10px] px-2 py-0.5 bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-semibold rounded">
                          투표 완료
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 bg-slate-700/60 text-slate-400 font-semibold rounded">
                          미제출
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5 font-mono">{voteUrl}</p>
                  </div>

                  <button
                    onClick={() => copyToClipboard(member.vote_token)}
                    className={`p-2 rounded-lg border text-xs font-medium flex items-center gap-1 shrink-0 transition-colors ${
                      isCopied
                        ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                        : 'bg-slate-700/60 hover:bg-slate-700 border-slate-600 text-slate-200'
                    }`}
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopied ? '복사됨' : '복사'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 탭 2: 18곡 후보 등록 및 편집 */}
      {activeTab === 'songs' && (
        <section className="space-y-4">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">멤버별 3곡 (총 18곡) 정보 편집</span>
            <button
              onClick={handleSaveSongs}
              className="py-1.5 px-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-lg flex items-center gap-1 transition-colors"
            >
              <Save className="w-3.5 h-3.5" /> 후보곡 저장
            </button>
          </div>

          {songsSaved && (
            <div className="bg-emerald-950/40 border border-emerald-500/50 p-2.5 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4" /> 후보곡 목록이 성공적으로 저장되었습니다!
            </div>
          )}

          <div className="space-y-3">
            {membersData.map(m => {
              const isExpanded = expandedMemberId === m.id;

              return (
                <div key={m.id} className="bg-slate-800/80 border border-slate-700 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedMemberId(isExpanded ? '' : m.id)}
                    className="w-full p-3.5 flex justify-between items-center text-left hover:bg-slate-700/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{m.name}</span>
                      <span className="text-xs text-slate-400">({m.part})</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>{m.songs.length}곡 등록됨</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-3.5 pt-0 space-y-3 border-t border-slate-700/60 bg-slate-900/30">
                      {m.songs.map((song, idx) => (
                        <div key={song.id} className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg space-y-2">
                          <span className="text-[11px] font-bold text-violet-400">추천곡 #{idx + 1}</span>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={song.title}
                              onChange={e => handleSongChange(m.id, idx, 'title', e.target.value)}
                              placeholder="곡 제목"
                              className="bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                            />
                            <input
                              type="text"
                              value={song.artist}
                              onChange={e => handleSongChange(m.id, idx, 'artist', e.target.value)}
                              placeholder="아티스트"
                              className="bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <YoutubeIcon className="w-4 h-4 text-red-500 shrink-0" />
                            <input
                              type="url"
                              value={song.youtube_url}
                              onChange={e => handleSongChange(m.id, idx, 'youtube_url', e.target.value)}
                              placeholder="YouTube 검색/영상 링크 (https://...)"
                              className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 탭 3: 기본 설정 및 일정 */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 space-y-4">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-violet-400" /> 투표 정보 및 일정 (KST)
            </h2>
            <p className="text-xs text-slate-400">공개 화면 상단에 표시되는 제목과 투표 기간입니다.</p>
          </div>

          {settingsSaved && (
            <div className="bg-emerald-950/40 border border-emerald-500/50 p-2.5 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4" /> 설정이 성공적으로 저장되었습니다!
            </div>
          )}

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 mb-1 font-semibold">투표 명칭</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-semibold">공연 주제</label>
              <input
                type="text"
                value={theme}
                onChange={e => setTheme(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-violet-400" /> 시작 일시 (KST)
                </label>
                <input
                  type="datetime-local"
                  value={startAt}
                  onChange={e => setStartAt(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-violet-400" /> 마감 일시 (KST)
                </label>
                <input
                  type="datetime-local"
                  value={endAt}
                  onChange={e => setEndAt(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <Save className="w-4 h-4" /> 기본 설정 저장하기
          </button>
        </form>
      )}
    </div>
  );
}

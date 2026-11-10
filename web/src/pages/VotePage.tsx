import { useState, useEffect, useCallback } from 'react';
import { MemberBallotData } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { mockMemberData } from '../mockData';
import { CheckCircle, AlertTriangle, ArrowLeft, Send, Clock, Lock, KeyRound } from 'lucide-react';
import YoutubeIcon from '../components/YoutubeIcon';
import { parseIsoDate, formatDisplayDate } from '../lib/dateUtils';

interface VotePageProps {
  token: string;
  onGoPublic: () => void;
  overrideMemberData?: MemberBallotData | null;
}

export default function VotePage({ token, onGoPublic, overrideMemberData }: VotePageProps) {
  const [data, setData] = useState<MemberBallotData>(overrideMemberData || mockMemberData);
  const [loading, setLoading] = useState<boolean>(!overrideMemberData && isSupabaseConfigured);
  const [selectedChoices, setSelectedChoices] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // PIN 관련 상태
  const [pinInput, setPinInput] = useState<string>('');
  const [pinConfirmInput, setPinConfirmInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [isPinSubmitting, setIsPinSubmitting] = useState<boolean>(false);
  const [currentPin, setCurrentPin] = useState<string>(() => {
    return (typeof window !== 'undefined' && token)
      ? sessionStorage.getItem(`band_vote_pin_${token}`) || ''
      : '';
  });

  const fetchBallot = useCallback(async (pinToUse?: string) => {
    if (!supabase || !token) return;
    setLoading(true);
    setErrorMessage('');
    try {
      const pinParam = pinToUse !== undefined ? pinToUse : (currentPin || null);
      const { data: ballotData, error } = await supabase.rpc('get_my_ballot', {
        p_token: token,
        p_pin: pinParam,
      });

      if (error) {
        if (pinToUse) {
          setPinError(error.message || '비밀번호가 일치하지 않습니다.');
        } else {
          setErrorMessage(error.message || '투표 정보를 불러오지 못했습니다.');
        }
        return false;
      }

      const bData = ballotData as MemberBallotData;
      setData(bData);

      if (bData.is_unlocked) {
        if (pinToUse) {
          setCurrentPin(pinToUse);
          sessionStorage.setItem(`band_vote_pin_${token}`, pinToUse);
        }
        const choicesMap: Record<string, string> = {};
        bData.my_choices?.forEach(c => {
          choicesMap[c.recommender_id] = c.song_id;
        });
        setSelectedChoices(choicesMap);
        setPinError('');
      }
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '오류가 발생했습니다.';
      if (pinToUse) {
        setPinError(msg);
      } else {
        setErrorMessage(msg);
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, [token, currentPin]);

  useEffect(() => {
    if (overrideMemberData) {
      setData(overrideMemberData);
      setLoading(false);
      const initialChoices: Record<string, string> = {};
      overrideMemberData.my_choices?.forEach(c => {
        initialChoices[c.recommender_id] = c.song_id;
      });
      setSelectedChoices(initialChoices);
      setSubmitSuccess(false);
      return;
    }

    if (!isSupabaseConfigured || !supabase || !token) {
      const initialChoices: Record<string, string> = {};
      mockMemberData.my_choices?.forEach(c => {
        initialChoices[c.recommender_id] = c.song_id;
      });
      setSelectedChoices(initialChoices);
      setData(prev => ({ ...prev, is_unlocked: true, has_pin: true }));
      return;
    }

    fetchBallot();
  }, [token, overrideMemberData, fetchBallot]);

  // 최초 PIN 등록 처리
  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.length < 4) {
      setPinError('PIN 번호는 4자리 숫자여야 합니다.');
      return;
    }
    if (pinInput !== pinConfirmInput) {
      setPinError('비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setIsPinSubmitting(true);
    setPinError('');

    if (!isSupabaseConfigured || !supabase) {
      setCurrentPin(pinInput);
      setData(prev => ({ ...prev, has_pin: true, is_unlocked: true }));
      setIsPinSubmitting(false);
      return;
    }

    try {
      const { error } = await supabase.rpc('set_my_pin', {
        p_token: token,
        p_pin: pinInput,
      });

      if (error) {
        setPinError(error.message || '비밀번호 등록에 실패했습니다.');
      } else {
        await fetchBallot(pinInput);
      }
    } catch (err: unknown) {
      setPinError(err instanceof Error ? err.message : '등록 중 오류가 발생했습니다.');
    } finally {
      setIsPinSubmitting(false);
    }
  };

  // 기존 PIN 잠금 해제 처리
  const handleUnlockPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.length < 4) {
      setPinError('PIN 번호 4자리를 모두 입력해 주세요.');
      return;
    }

    setIsPinSubmitting(true);
    setPinError('');

    if (!isSupabaseConfigured || !supabase) {
      setCurrentPin(pinInput);
      setData(prev => ({ ...prev, has_pin: true, is_unlocked: true }));
      setIsPinSubmitting(false);
      return;
    }

    await fetchBallot(pinInput);
    setIsPinSubmitting(false);
  };

  const { election, member, recommenders = [] } = data;
  const totalGroups = recommenders.length;
  const selectedCount = Object.keys(selectedChoices).length;
  const isAllSelected = totalGroups > 0 && selectedCount === totalGroups;

  // 투표 가능 여부 판정 (서버 시간 기준, 타임존 안전 파싱)
  const serverNow = parseIsoDate(election?.server_now || new Date().toISOString()).getTime();
  const startAt = parseIsoDate(election?.start_at || new Date().toISOString()).getTime();
  const endAt = parseIsoDate(election?.end_at || new Date().toISOString()).getTime();
  const isBeforeStart = serverNow < startAt;
  const isAfterEnd = serverNow >= endAt;
  const isVotingPeriod = serverNow >= startAt && serverNow < endAt;

  const handleSelectSong = (recommenderId: string, songId: string) => {
    if (!isVotingPeriod) return;
    setSelectedChoices(prev => ({
      ...prev,
      [recommenderId]: songId,
    }));
    setSubmitSuccess(false);
  };

  const handleSubmit = async () => {
    if (!isAllSelected || !isVotingPeriod) return;

    setIsSubmitting(true);
    setErrorMessage('');

    const choicesPayload = Object.entries(selectedChoices).map(([recommender_id, song_id]) => ({
      recommender_id,
      song_id,
    }));

    if (!isSupabaseConfigured || !supabase) {
      setTimeout(() => {
        setIsSubmitting(false);
        setSubmitSuccess(true);
        setData(prev => ({ ...prev, has_submitted: true }));
      }, 300);
      return;
    }

    try {
      const { error } = await supabase.rpc('submit_ballot', {
        p_token: token,
        p_choices: choicesPayload,
        p_pin: currentPin || null,
      });

      if (error) {
        setErrorMessage(error.message || '제출에 실패했습니다.');
      } else {
        setSubmitSuccess(true);
        setData(prev => ({ ...prev, has_submitted: true }));
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : '제출 처리 중 오류 발생');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400">
        <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-base">개인 투표함을 불러오는 중입니다...</p>
      </div>
    );
  }

  // 1. PIN 최초 미설정 상태 화면
  if (data.has_pin === false) {
    return (
      <div className="max-w-md mx-auto py-8 space-y-6 text-slate-100">
        <button
          onClick={onGoPublic}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          공개 페이지로 돌아가기
        </button>

        <div className="bg-slate-800/90 border border-violet-500/50 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5">
          <div className="text-center space-y-2.5">
            <div className="w-14 h-14 bg-violet-600/20 text-violet-400 rounded-full flex items-center justify-center mx-auto border border-violet-500/40">
              <Lock className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              <span className="text-violet-400">{member?.name}</span> 님의 비밀번호 설정
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              본인만 투표지를 열어볼 수 있도록 <strong>4자리 숫자 PIN</strong>을 등록해 주세요.<br />
              <span className="text-violet-300 font-semibold">관리자를 포함한 타인은 이 번호를 알 수 없습니다.</span>
            </p>
          </div>

          <form onSubmit={handleSetPin} className="space-y-4 pt-2">
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                새 비밀번호 (숫자 4자리)
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pinInput}
                onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full text-center tracking-[0.5em] text-2xl py-3 px-4 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-violet-500"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                비밀번호 확인
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pinConfirmInput}
                onChange={e => setPinConfirmInput(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full text-center tracking-[0.5em] text-2xl py-3 px-4 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-violet-500"
              />
            </div>

            {pinError && (
              <div className="p-3 bg-rose-950/50 border border-rose-500/50 rounded-xl text-rose-300 text-sm flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
                <span>{pinError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={pinInput.length < 4 || isPinSubmitting}
              className="w-full py-4 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold text-base rounded-xl shadow-lg transition-all"
            >
              {isPinSubmitting ? '등록 중...' : '비밀번호 등록 및 투표 시작'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. PIN 설정되어 있으나 잠금 해제되지 않은 상태 화면
  if (data.is_unlocked === false) {
    return (
      <div className="max-w-md mx-auto py-8 space-y-6 text-slate-100">
        <button
          onClick={onGoPublic}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          공개 페이지로 돌아가기
        </button>

        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5">
          <div className="text-center space-y-2.5">
            <div className="w-14 h-14 bg-violet-600/20 text-violet-400 rounded-full flex items-center justify-center mx-auto border border-violet-500/40">
              <KeyRound className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              <span className="text-violet-400">{member?.name}</span> 님의 투표지
            </h2>
            <p className="text-sm sm:text-base text-slate-300">
              등록하신 <strong>4자리 PIN 번호</strong>를 입력해 주세요.
            </p>
          </div>

          <form onSubmit={handleUnlockPin} className="space-y-4 pt-2">
            <div>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pinInput}
                onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full text-center tracking-[0.5em] text-3xl py-3 px-4 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-violet-500"
                autoFocus
              />
            </div>

            {pinError && (
              <div className="p-3 bg-rose-950/50 border border-rose-500/50 rounded-xl text-rose-300 text-sm flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
                <span>{pinError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={pinInput.length < 4 || isPinSubmitting}
              className="w-full py-4 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold text-base rounded-xl shadow-lg transition-all"
            >
              {isPinSubmitting ? '확인 중...' : '투표지 열기'}
            </button>

            <p className="text-xs sm:text-sm text-center text-slate-400 pt-2 leading-relaxed">
              ※ 비밀번호를 분실하신 경우 관리자에게 <span className="text-amber-400 font-semibold">PIN 초기화</span>를 요청하세요.
            </p>
          </form>
        </div>
      </div>
    );
  }

  // 3. 잠금 해제 완료된 정상 투표 화면
  return (
    <div className="space-y-6 pb-12 text-slate-100">
      {/* 상단 네비게이션 */}
      <button
        onClick={onGoPublic}
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors py-1"
      >
        <ArrowLeft className="w-4 h-4" />
        전체 후보 및 일정 보러가기
      </button>

      {/* 헤더 */}
      <header className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm px-3 py-0.5 bg-violet-900/60 text-violet-300 font-semibold rounded-full border border-violet-700/50">
            {member?.part}
          </span>
          <span className="text-sm text-slate-300 font-medium">
            선택 진행: <strong className="text-violet-400 font-bold text-base">{selectedCount}</strong> / {totalGroups}
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          <span className="text-violet-400">{member?.name}</span> 님의 투표지
        </h1>
        <p className="text-sm sm:text-base text-slate-300">
          각 추천자 그룹에서 마음에 드는 곡을 <strong className="text-violet-300 font-bold">1곡씩(총 {totalGroups}곡)</strong> 선택해 주세요.
        </p>
      </header>

      {/* 상태 배너 */}
      {isBeforeStart ? (
        <section className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 text-center space-y-1.5 shadow-sm">
          <div className="inline-flex items-center gap-2 text-sky-400 font-bold text-lg">
            <Clock className="w-5 h-5" />
            ⏳ 투표 시작 전입니다.
          </div>
          <p className="text-sm text-slate-300">
            투표 기간: {formatDisplayDate(election.start_at)} ~ {formatDisplayDate(election.end_at)} (KST)
          </p>
          <p className="text-xs text-slate-400 pt-0.5">
            투표 시작 전에는 후보를 미리 들어보실 수 있으며, 시작 일시부터 투표 제출이 가능합니다.
          </p>
        </section>
      ) : isAfterEnd ? (
        <section className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 text-center space-y-1.5 shadow-sm">
          <div className="inline-flex items-center gap-2 text-amber-400 font-bold text-lg">
            <Clock className="w-5 h-5" />
            ⏰ 투표가 마감되었습니다.
          </div>
          <p className="text-sm text-slate-300">
            투표 결과는 마감 및 전원 참여 완료 후 일반 공개 페이지에서 확인하실 수 있습니다.
          </p>
        </section>
      ) : null}

      {/* 필수 고지 안내문 (FR-017) */}
      <section className="bg-amber-950/30 border border-amber-600/40 rounded-xl p-4 sm:p-5 space-y-2.5 text-sm sm:text-base">
        <div className="flex items-center gap-2 text-amber-400 font-bold text-base sm:text-lg">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          투표 진행 및 결과 공개 안내 (필독)
        </div>
        <p className="text-slate-300 leading-relaxed text-sm sm:text-base">
          • 투표 기간 중에는 <strong className="text-amber-200 font-bold">본인의 선택만 확인 가능</strong>하며 타인의 선택이나 중간 득표는 비공개입니다.<br />
          • 설정하신 <strong className="text-amber-200 font-bold">4자리 PIN 비밀번호</strong>로 잠겨 있어 관리자를 포함한 타인이 열람할 수 없습니다.<br />
          • 투표 마감 및 <strong className="text-amber-200 font-bold">{totalGroups}명 전원 참여 완료 시</strong>, <strong className="text-amber-200 font-bold">일반 공개 페이지에 멤버 전원의 실명과 최종 선택한 {totalGroups}곡 내역이 모두 투명하게 공개</strong>됩니다.<br />
          • 마감 전까지는 본 링크로 재접속하여 <strong className="text-amber-200 font-bold">언제든 무제한으로 수정</strong>할 수 있습니다.
        </p>
      </section>

      {/* 완료 및 에러 알림 */}
      {submitSuccess && (
        <div className="bg-emerald-950/40 border border-emerald-500/50 rounded-xl p-4 flex items-center gap-3 text-emerald-300 text-sm sm:text-base">
          <CheckCircle className="w-6 h-6 shrink-0 text-emerald-400" />
          <div>
            <p className="font-bold text-base sm:text-lg">투표가 정상적으로 저장되었습니다!</p>
            <p className="text-xs sm:text-sm text-emerald-400/80">마감 전까지 언제든 본 페이지에서 수정하실 수 있습니다.</p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-950/40 border border-rose-500/50 rounded-xl p-4 text-rose-300 text-sm sm:text-base">
          {errorMessage}
        </div>
      )}

      {/* 추천자 그룹별 후보 선택 */}
      <section className="space-y-4">
        {recommenders.map(rec => {
          const currentSelectedSongId = selectedChoices[rec.id];

          return (
            <div
              key={rec.id}
              className={`bg-slate-800/80 border rounded-xl p-4 space-y-3 transition-colors ${
                currentSelectedSongId
                  ? 'border-slate-700'
                  : 'border-violet-500/40 shadow-sm'
              }`}
            >
              <div className="flex justify-between items-center border-b border-slate-700/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-lg">{rec.name}</span>
                  <span className="text-base text-slate-300">({rec.part})</span>
                  {rec.is_me && (
                    <span className="text-xs px-2.5 py-0.5 bg-violet-600/40 text-violet-300 font-semibold rounded">
                      본인 추천 그룹
                    </span>
                  )}
                </div>
                {currentSelectedSongId ? (
                  <span className="text-sm sm:text-base text-emerald-400 flex items-center gap-1 font-semibold">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" /> 선택 완료
                  </span>
                ) : (
                  <span className="text-sm sm:text-base text-amber-400 font-semibold">1곡 선택 필요</span>
                )}
              </div>

              {/* 3곡 라디오 버튼 */}
              <div className="space-y-2.5">
                {rec.songs.map(song => {
                  const isChecked = currentSelectedSongId === song.id;

                  return (
                    <label
                      key={song.id}
                      onClick={() => handleSelectSong(rec.id, song.id)}
                      className={`flex items-center justify-between p-3.5 sm:p-4 rounded-xl border cursor-pointer select-none transition-all ${
                        isChecked
                          ? 'bg-violet-600/20 border-violet-500 text-white font-medium shadow-inner'
                          : 'bg-slate-900/40 border-slate-800 text-slate-300 hover:bg-slate-700/30'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0 pr-2">
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            isChecked ? 'border-violet-400 bg-violet-600' : 'border-slate-600'
                          }`}
                        >
                          {isChecked && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-base sm:text-lg font-bold text-white truncate">{song.title}</p>
                          <p className="text-sm sm:text-base text-slate-300 truncate">{song.artist}</p>
                        </div>
                      </div>

                      {song.youtube_url && (
                        <a
                          href={song.youtube_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="p-2 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all shrink-0"
                          title="YouTube에서 듣기"
                        >
                          <YoutubeIcon className="w-6 h-6" />
                        </a>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      {/* 제출 버튼 */}
      <div className="pt-2">
        <button
          onClick={handleSubmit}
          disabled={!isAllSelected || isSubmitting || !isVotingPeriod}
          className={`w-full py-4 px-4 rounded-xl font-bold text-base shadow-lg flex items-center justify-center gap-2 transition-all ${
            isAllSelected && isVotingPeriod
              ? 'bg-violet-600 hover:bg-violet-500 text-white active:scale-[0.99]'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
          }`}
        >
          {isSubmitting ? (
            '제출 처리 중...'
          ) : !isVotingPeriod ? (
            '현재는 투표 기간이 아닙니다'
          ) : isAllSelected ? (
            <>
              <Send className="w-5 h-5" />
              {data.has_submitted ? '수정하여 다시 제출하기' : `투표 최종 제출하기 (${totalGroups}곡 선택)`}
            </>
          ) : (
            `모든 그룹을 선택해주세요 (${selectedCount} / ${totalGroups})`
          )}
        </button>
      </div>
    </div>
  );
}

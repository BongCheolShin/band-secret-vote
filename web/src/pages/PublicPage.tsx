import { useState, useEffect } from 'react';
import { PublicElectionData } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { mockPublicData } from '../mockData';
import { CheckCircle, Clock, Trophy, Users, AlertTriangle } from 'lucide-react';
import YoutubeIcon from '../components/YoutubeIcon';
import { parseIsoDate, formatDisplayDate } from '../lib/dateUtils';

interface PublicPageProps {
  overrideData?: PublicElectionData;
}

export default function PublicPage({ overrideData }: PublicPageProps) {
  const [data, setData] = useState<PublicElectionData>(overrideData || mockPublicData);
  const [loading, setLoading] = useState<boolean>(!overrideData && isSupabaseConfigured);
  const [loadError, setLoadError] = useState<string>('');

  useEffect(() => {
    if (overrideData) {
      setData(overrideData);
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured || !supabase) return;

    const fetchPublicData = async () => {
      if (!supabase) return;
      try {
        // 첫 번째 활성 선거 조회
        const { data: electionList } = await supabase.from('elections').select('id').limit(1);
        if (electionList && electionList.length > 0) {
          const { data: rpcData, error } = await supabase.rpc('get_public_election_data', {
            p_election_id: electionList[0].id,
          });
          if (error) {
            console.error('공개 데이터 로딩 에러:', error);
            setLoadError(error.message || '데이터를 불러오지 못했습니다.');
          } else if (rpcData) {
            setData(rpcData as PublicElectionData);
          }
        }
      } catch (err) {
        console.error('공개 데이터 로딩 실패:', err);
        setLoadError(err instanceof Error ? err.message : '오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchPublicData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400">
        <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p>투표 정보를 불러오는 중입니다...</p>
      </div>
    );
  }

  const { election, total_members, completed_count, is_ended, is_revealed, recommenders, results, member_choices } = data;

  const serverNowTime = parseIsoDate(election.server_now).getTime();
  const startTime = parseIsoDate(election.start_at).getTime();
  const isBeforeStart = serverNowTime < startTime;

  // 투표 시작 전: 후보곡 추천 접수 완료 현황 계산
  const completedRecommenders = recommenders.filter(r => r.songs && r.songs.length === 3);
  const totalSubmittedSongs = recommenders.reduce((acc, r) => acc + (r.songs ? r.songs.length : 0), 0);

  // 곡별 득표수 매핑
  const voteMap = new Map<string, number>();
  results?.forEach(r => voteMap.set(r.song_id, r.vote_count));

  // 추천인별 본인 추천 그룹 투표곡 맵: recommender_id -> song_id
  const recommenderSelfVoteMap = new Map<string, string>();
  if (member_choices) {
    member_choices.forEach(mc => {
      const selfChoice = mc.choices?.find(c => c.recommender_id === mc.member_id);
      if (selfChoice) {
        recommenderSelfVoteMap.set(mc.member_id, selfChoice.song_id);
      }
    });
  }

  // 결과 공개 시: 추천자 그룹별 1위(단독 및 추천인 선택으로 동점 확정 포함) 목록 계산
  const winningGroups: Array<{
    recommenderId: string;
    recommenderName: string;
    recommenderPart: string;
    isTie: boolean;
    isTieBrokenByRecommender?: boolean;
    votes: number;
    songs: Array<{
      id: string;
      title: string;
      artist: string;
      youtube_url: string;
    }>;
  }> = [];

  if (is_revealed) {
    recommenders.forEach(rec => {
      let maxVotes = -1;
      rec.songs.forEach(s => {
        const v = voteMap.get(s.id) || 0;
        if (v > maxVotes) maxVotes = v;
      });

      if (maxVotes > 0) {
        const topSongs = rec.songs.filter(s => (voteMap.get(s.id) || 0) === maxVotes);

        if (topSongs.length > 1) {
          // 동점 발생 시 정책: 추천인 본인이 투표한 곡이 1위 후보 중에 있으면 우선 선정
          const selfVotedSongId = recommenderSelfVoteMap.get(rec.id);
          const recommenderChoiceSong = topSongs.find(s => s.id === selfVotedSongId);

          if (recommenderChoiceSong) {
            winningGroups.push({
              recommenderId: rec.id,
              recommenderName: rec.name,
              recommenderPart: rec.part,
              isTie: false,
              isTieBrokenByRecommender: true,
              votes: maxVotes,
              songs: [recommenderChoiceSong],
            });
          } else {
            // 추천인의 선택이 다른 곡이었을 때만 협의/결선 필요
            winningGroups.push({
              recommenderId: rec.id,
              recommenderName: rec.name,
              recommenderPart: rec.part,
              isTie: true,
              isTieBrokenByRecommender: false,
              votes: maxVotes,
              songs: topSongs,
            });
          }
        } else {
          // 단독 1위
          winningGroups.push({
            recommenderId: rec.id,
            recommenderName: rec.name,
            recommenderPart: rec.part,
            isTie: false,
            isTieBrokenByRecommender: false,
            votes: maxVotes,
            songs: topSongs,
          });
        }
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <header className="text-center space-y-2.5 pt-2">
        <span className="inline-block px-3.5 py-1 bg-violet-900/60 text-violet-300 text-sm font-semibold rounded-full border border-violet-700/50">
          이따위밴드 (IT' DIE)
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">{election.title}</h1>
        <p className="text-base text-slate-300">
          공연 주제: <span className="font-semibold text-violet-400">{election.theme}</span>
        </p>
        <p className="text-sm text-slate-400 flex items-center justify-center gap-1.5">
          <Clock className="w-4 h-4" />
          투표 기간: {formatDisplayDate(election.start_at)} ~ {formatDisplayDate(election.end_at)} (KST)
        </p>
      </header>

      {loadError && (
        <section className="bg-rose-950/40 border border-rose-500/50 rounded-xl p-4 text-sm text-rose-300 flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{loadError}</span>
        </section>
      )}

      {/* 상태 배너 */}
      <section className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 sm:p-5 shadow-sm">
        {is_revealed ? (
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center gap-2 text-emerald-400 font-bold text-base sm:text-lg">
              <Trophy className="w-5 h-5" />
              투표 종료 — 최종 결과 발표
            </div>
            <p className="text-sm text-slate-300">전원 참여 및 마감 완료로 최종 선정곡이 확정되었습니다.</p>
          </div>
        ) : is_ended ? (
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center gap-2 text-amber-400 font-bold text-base sm:text-lg">
              <Clock className="w-5 h-5" />
              마감 완료 — 결과 공개 대기 중
            </div>
            <p className="text-sm text-slate-300">
              현재 참여: <strong className="text-amber-300 font-bold">{completed_count}</strong> / {total_members}명 (전원 참여 후 결과가 자동 공개됩니다)
            </p>
          </div>
        ) : isBeforeStart ? (
          <div className="space-y-3.5">
            <div className="flex justify-between items-center text-base font-semibold">
              <span className="text-slate-200 flex items-center gap-2">
                <Clock className="w-5 h-5 text-sky-400" />
                공연곡 추천 접수 현황
              </span>
              <span className="text-sky-400 font-bold text-base">
                {completedRecommenders.length} / {total_members}명 완료 ({totalSubmittedSongs} / {total_members * 3}곡)
              </span>
            </div>
            {/* 프로그레스 바 */}
            <div className="w-full bg-slate-700 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-sky-500 h-full transition-all duration-500"
                style={{ width: `${total_members > 0 ? (completedRecommenders.length / total_members) * 100 : 0}%` }}
              />
            </div>
            <p className="text-center text-sm font-medium text-slate-300">
              ⏳ 투표 시작 전입니다.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            <div className="flex justify-between items-center text-base font-semibold">
              <span className="text-slate-200 flex items-center gap-2">
                <Users className="w-5 h-5 text-violet-400" />
                투표 진행 현황
              </span>
              <span className="text-violet-400 font-bold text-base">
                {completed_count} / {total_members}명 완료
              </span>
            </div>
            {/* 프로그레스 바 */}
            <div className="w-full bg-slate-700 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-violet-500 h-full transition-all duration-500"
                style={{ width: `${total_members > 0 ? (completed_count / total_members) * 100 : 0}%` }}
              />
            </div>
            <p className="text-center text-sm text-slate-400">
              ※ 투표 기간 중에는 중간 득표수와 타인의 선택이 비공개입니다.
            </p>
          </div>
        )}
      </section>

      {/* [최우선 배치] 결과 공개 시: 최종 선정된 곡 목록 (동점 그룹 분기 처리) */}
      {is_revealed && winningGroups.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-xl text-white flex items-center gap-2">
              <span className="text-2xl">🏆</span> 최종 선정 공연곡 (총 {winningGroups.length}개 추천 그룹)
            </h2>
            <span className="text-sm px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-500/60 rounded-full font-bold">
              확정
            </span>
          </div>

          <div className="space-y-3.5">
            {winningGroups.map((group, idx) => {
              // 단독 1위 확정곡인 경우
              if (!group.isTie) {
                const song = group.songs[0];
                return (
                  <div
                    key={group.recommenderId}
                    className="bg-gradient-to-r from-emerald-950/60 to-slate-900/80 border border-emerald-500/60 rounded-xl p-4 flex items-center justify-between gap-3.5 shadow-md"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="w-8 h-8 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-bold text-white truncate">{song.title}</p>
                        <p className="text-sm text-slate-300 truncate">
                          {song.artist} <span className="text-slate-500">·</span>{' '}
                          <span className="text-emerald-400/90 font-medium">{group.recommenderName} 추천</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {group.isTieBrokenByRecommender && (
                        <span className="text-xs px-2.5 py-1 bg-violet-600/30 border border-violet-500/50 text-violet-300 font-semibold rounded shrink-0">
                          추천인 동점 우선
                        </span>
                      )}
                      <span className="text-sm px-3 py-1.5 bg-emerald-500 text-slate-950 font-bold rounded-lg shadow-sm">
                        {group.votes}표 득표
                      </span>
                      {song.youtube_url && (
                        <a
                          href={song.youtube_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all shrink-0"
                          title="YouTube에서 바로 듣기"
                        >
                          <YoutubeIcon className="w-6 h-6" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              }

              // 공동 1위 동점 발생인 경우
              return (
                <div
                  key={group.recommenderId}
                  className="bg-gradient-to-r from-amber-950/40 to-slate-900/90 border-2 border-amber-500/60 rounded-xl p-4 space-y-3 shadow-md"
                >
                  <div className="flex items-center justify-between border-b border-amber-500/30 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                        {idx + 1}
                      </div>
                      <div>
                        <span className="text-base font-bold text-amber-300 flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-amber-400" />
                          [{group.recommenderName} 추천] 공동 1위 동점
                        </span>
                        <span className="text-xs text-amber-400/80">
                          {group.songs.length}개 곡 각 {group.votes}표 득표
                        </span>
                      </div>
                    </div>
                    <span className="text-xs px-2.5 py-1 bg-amber-500 text-slate-950 font-bold rounded">
                      협의 / 결선 필요
                    </span>
                  </div>

                  <div className="space-y-2 pl-1">
                    {group.songs.map(song => (
                      <div
                        key={song.id}
                        className="bg-slate-900/80 border border-amber-500/20 rounded-lg p-3 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm sm:text-base font-bold text-white truncate">{song.title}</p>
                          <p className="text-xs sm:text-sm text-slate-300 truncate">{song.artist}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs sm:text-sm px-2.5 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 font-semibold rounded">
                            {group.votes}표 (동점)
                          </span>
                          {song.youtube_url && (
                            <a
                              href={song.youtube_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-red-500 hover:text-red-400 transition-colors shrink-0"
                              title="YouTube에서 바로 듣기"
                            >
                              <YoutubeIcon className="w-5 h-5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs sm:text-sm text-amber-400/90 flex items-center gap-1.5 pt-0.5">
                    ※ 해당 추천 그룹은 밴드 회의 또는 결선 투표로 최종 1곡을 결정합니다.
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 결과 공개 시: 실명별 최종 선택표 (6x6 = 36건 매트릭스) */}
      {is_revealed && member_choices && member_choices.length > 0 && (
        <section className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-700 pb-3">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <h2 className="font-bold text-white text-lg">멤버별 최종 선택 내역 (총 {total_members * total_members}표)</h2>
          </div>
          <p className="text-sm text-slate-300">
            투표자 {total_members}명의 최종 선택곡 내역입니다. 각 추천 그룹별 득표수와 완벽히 일치합니다.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-200 border-collapse">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900/60 text-slate-300">
                  <th className="p-2.5 font-semibold">투표자</th>
                  {recommenders.map(rec => (
                    <th key={rec.id} className="p-2.5 font-semibold whitespace-nowrap">
                      {rec.name} 추천
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {member_choices.map(mc => (
                  <tr key={mc.member_id} className="border-b border-slate-800 hover:bg-slate-700/30">
                    <td className="p-2.5 font-bold text-violet-300 whitespace-nowrap">{mc.member_name}</td>
                    {recommenders.map(rec => {
                      const choice = mc.choices.find(c => c.recommender_id === rec.id);
                      const song = rec.songs.find(s => s.id === choice?.song_id);
                      return (
                        <td key={rec.id} className="p-2.5 whitespace-nowrap text-slate-200">
                          {song ? song.title : '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 추천자별 후보곡 목록 */}
      <section className="space-y-4">
        <h2 className="font-bold text-lg sm:text-xl text-slate-100 flex items-center justify-between">
          <span>후보곡 목록 ({total_members}명 × 3곡 = {total_members * 3}곡)</span>
          <span className="text-sm font-normal text-slate-400">추천자별 1곡씩 선정</span>
        </h2>

        {recommenders.map(rec => {
          // 해당 그룹의 최다 득표곡 계산 (결과 공개 시)
          let topVote = -1;
          if (is_revealed) {
            rec.songs.forEach(s => {
              const votes = voteMap.get(s.id) || 0;
              if (votes > topVote) topVote = votes;
            });
          }

          return (
            <div key={rec.id} className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 sm:p-5 space-y-3.5">
              <div className="flex justify-between items-center border-b border-slate-700/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-base">{rec.name}</span>
                  <span className="text-sm text-slate-400">({rec.part})</span>
                </div>
                {isBeforeStart ? (
                  rec.songs && rec.songs.length > 0 ? (
                    <span className="text-xs px-2.5 py-1 bg-sky-950 border border-sky-500/50 text-sky-300 font-semibold rounded-full">
                      {rec.songs.length}곡 추천 완료
                    </span>
                  ) : (
                    <span className="text-xs px-2.5 py-1 bg-amber-950/60 border border-amber-500/50 text-amber-300 font-semibold rounded-full">
                      추천곡 제출 대기 중
                    </span>
                  )
                ) : (
                  <span className="text-sm text-violet-400 font-medium">추천곡 {rec.songs.length}곡</span>
                )}
              </div>

              {rec.songs && rec.songs.length > 0 ? (
                <div className="space-y-2.5">
                  {rec.songs.map(song => {
                    const votes = voteMap.get(song.id);
                    const winningGroup = winningGroups.find(g => g.recommenderId === rec.id);
                    const isWinner = is_revealed && !!winningGroup?.songs?.some(s => s.id === song.id) && !winningGroup.isTie;
                    const isRecommenderTieWinner = is_revealed && !!winningGroup?.isTieBrokenByRecommender && !!winningGroup?.songs?.some(s => s.id === song.id);
                    const isUnresolvedTie = is_revealed && !!winningGroup?.isTie && !!winningGroup?.songs?.some(s => s.id === song.id);
                    const isRunnerUpTied = is_revealed && !isWinner && votes !== undefined && votes === topVote && votes > 0;

                    return (
                      <div
                        key={song.id}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                          isWinner
                            ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
                            : isUnresolvedTie
                              ? 'bg-amber-950/30 border-amber-500/50 text-amber-200'
                              : 'bg-slate-900/40 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-2 font-medium truncate">
                            {isWinner ? (
                              <Trophy className="w-5 h-5 text-emerald-400 shrink-0" />
                            ) : isUnresolvedTie ? (
                              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                            ) : null}
                            <span className="text-base sm:text-lg font-bold text-white truncate">{song.title}</span>
                          </div>
                          <p className="text-sm sm:text-base text-slate-300 truncate">{song.artist}</p>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          {is_revealed && votes !== undefined && (
                            <span
                              className={`text-sm px-2.5 py-1 rounded-full font-bold ${
                                isWinner
                                  ? 'bg-emerald-500 text-slate-950'
                                  : isUnresolvedTie
                                    ? 'bg-amber-500 text-slate-950'
                                    : 'bg-slate-700 text-slate-300'
                              }`}
                            >
                              {votes}표 득표 {isWinner ? (isRecommenderTieWinner ? '★ 최종 선정 (추천인 선택)' : '★ 최종 선정') : isUnresolvedTie ? '★ 공동 1위 (협의 필요)' : isRunnerUpTied ? '(동점 차순위)' : ''}
                            </span>
                          )}
                          {song.youtube_url && (
                            <a
                              href={song.youtube_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all flex items-center gap-1 shrink-0"
                              title="YouTube에서 듣기"
                            >
                              <YoutubeIcon className="w-6 h-6" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-4 px-4 text-center text-sm text-slate-400 bg-slate-900/40 rounded-xl border border-dashed border-slate-700/60">
                  ⏳ 아직 공연곡 후보를 제출하기 전입니다.
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

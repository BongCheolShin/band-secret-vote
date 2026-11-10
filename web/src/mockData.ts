import { PublicElectionData, MemberBallotData } from './types';

export const baseElection = {
  id: 'mock-election-1',
  title: '이따위밴드 2027년 상반기 공연곡 투표',
  theme: '신해철',
  start_at: '2026-11-12T00:00:00+09:00',
  end_at: '2026-11-13T23:59:59+09:00',
  server_now: '2026-11-12T12:00:00+09:00',
};

export const recommendersList = [
  {
    id: 'm1',
    name: '이상희',
    part: '키보드',
    token: 'v8q3k9m2x7w1p4z6j8b5n0c4d2f1g7h9',
    songs: [
      { id: 's1', title: '일상으로의 초대', artist: '신해철', youtube_url: 'https://www.youtube.com/results?search_query=신해철+일상으로의+초대', order_no: 1 },
      { id: 's2', title: '힘겨워하는 연인들을 위하여', artist: '넥스트', youtube_url: 'https://www.youtube.com/results?search_query=넥스트+힘겨워하는+연인들을+위하여', order_no: 2 },
      { id: 's3', title: '질주', artist: '신해철', youtube_url: 'https://www.youtube.com/results?search_query=신해철+질주', order_no: 3 },
    ]
  },
  {
    id: 'm2',
    name: '손석호',
    part: '기타',
    token: 'b4n7c1d9f2g8h3j5k6m0p4w8z1x3v5q7',
    songs: [
      { id: 's4', title: '슬픈표정하지말아요', artist: '신해철', youtube_url: 'https://www.youtube.com/results?search_query=신해철+슬픈표정하지말아요', order_no: 1 },
      { id: 's5', title: '그대에게', artist: '무한궤도', youtube_url: 'https://www.youtube.com/results?search_query=무한궤도+그대에게', order_no: 2 },
      { id: 's6', title: '날아라 얄리', artist: '넥스트', youtube_url: 'https://www.youtube.com/results?search_query=넥스트+날아라+얄리', order_no: 3 },
    ]
  },
  {
    id: 'm3',
    name: '권선영',
    part: '기타',
    token: 'm9p2w6z1x8v4q7k3b0n5c2d8f4g1h6j3',
    songs: [
      { id: 's7', title: '이중인격자', artist: '넥스트', youtube_url: 'https://www.youtube.com/results?search_query=넥스트+이중인격자', order_no: 1 },
      { id: 's8', title: '재즈카페', artist: '신해철', youtube_url: 'https://www.youtube.com/results?search_query=신해철+재즈카페', order_no: 2 },
      { id: 's9', title: '나에게 쓰는 편지', artist: '신해철', youtube_url: 'https://www.youtube.com/results?search_query=신해철+나에게+쓰는+편지', order_no: 3 },
    ]
  },
  {
    id: 'm4',
    name: '신봉철',
    part: '베이스 / 리더',
    token: 'z3v7q1k8m4p0w5x2j6b9n1c7d3f8g2h5',
    songs: [
      { id: 's10', title: '니가 진짜로 원하는게 뭐야, Pt.2', artist: '신해철', youtube_url: 'https://www.youtube.com/results?search_query=신해철+니가+진짜로+원하는게+뭐야+Pt.2', order_no: 1 },
      { id: 's11', title: '단 하나의 약속', artist: '신해철', youtube_url: 'https://www.youtube.com/results?search_query=신해철+단+하나의+약속', order_no: 2 },
      { id: 's12', title: '영원히', artist: '넥스트', youtube_url: 'https://www.youtube.com/results?search_query=넥스트+영원히', order_no: 3 },
    ]
  },
  {
    id: 'm5',
    name: '문성일',
    part: '보컬',
    token: 'c5d1f8g4h2j7k3m9p6w0z4x8v2q5b1n7',
    songs: [
      { id: 's13', title: 'Lazenca, Save Us', artist: '넥스트', youtube_url: 'https://www.youtube.com/results?search_query=넥스트+Lazenca+Save+Us', order_no: 1 },
      { id: 's14', title: '아주 가끔은', artist: '신해철', youtube_url: 'https://www.youtube.com/results?search_query=신해철+아주+가끔은', order_no: 2 },
      { id: 's15', title: 'The Destruction of the Shell', artist: '넥스트', youtube_url: 'https://www.youtube.com/results?search_query=넥스트+The+Destruction+of+the+Shell', order_no: 3 },
    ]
  },
  {
    id: 'm6',
    name: '김동희',
    part: '드럼',
    token: 'w7z2x5v9q3k6m1p8b4n0c7d2f9g5h1j4',
    songs: [
      { id: 's16', title: '안녕', artist: '신해철', youtube_url: 'https://www.youtube.com/results?search_query=신해철+안녕', order_no: 1 },
      { id: 's17', title: '절망에 관하여', artist: '신해철', youtube_url: 'https://www.youtube.com/results?search_query=신해철+절망에+관하여', order_no: 2 },
      { id: 's18', title: 'Hope', artist: '넥스트', youtube_url: 'https://www.youtube.com/results?search_query=넥스트+Hope', order_no: 3 },
    ]
  },
];

export const mockPublicData: PublicElectionData = {
  election: baseElection,
  total_members: 6,
  completed_count: 3,
  is_ended: false,
  is_revealed: false,
  recommenders: recommendersList,
  results: [],
  member_choices: []
};

// 결과 공개 시뮬레이션용 (36건 전수 공개 데이터)
export const mockRevealedResults = [
  // m1 이상희 조: s1(4표), s2(1표), s3(1표)
  { song_id: 's1', recommender_id: 'm1', vote_count: 4 },
  { song_id: 's2', recommender_id: 'm1', vote_count: 1 },
  { song_id: 's3', recommender_id: 'm1', vote_count: 1 },
  // m2 손석호 추천 (3:3 공동 1위 동점 시나리오 테스트: 그대에게 3표, 얄리 3표)
  { song_id: 's4', recommender_id: 'm2', vote_count: 0 },
  { song_id: 's5', recommender_id: 'm2', vote_count: 3 },
  { song_id: 's6', recommender_id: 'm2', vote_count: 3 },
  // m3 권선영 조: s8(4표), s7(1표), s9(1표)
  { song_id: 's7', recommender_id: 'm3', vote_count: 1 },
  { song_id: 's8', recommender_id: 'm3', vote_count: 4 },
  { song_id: 's9', recommender_id: 'm3', vote_count: 1 },
  // m4 신봉철 조: s10(3표), s11(2표), s12(1표)
  { song_id: 's10', recommender_id: 'm4', vote_count: 3 },
  { song_id: 's11', recommender_id: 'm4', vote_count: 2 },
  { song_id: 's12', recommender_id: 'm4', vote_count: 1 },
  // m5 문성일 조: s13(5표), s14(1표), s15(0표)
  { song_id: 's13', recommender_id: 'm5', vote_count: 5 },
  { song_id: 's14', recommender_id: 'm5', vote_count: 1 },
  { song_id: 's15', recommender_id: 'm5', vote_count: 0 },
  // m6 김동희 조: s17(4표), s16(1표), s18(1표)
  { song_id: 's16', recommender_id: 'm6', vote_count: 1 },
  { song_id: 's17', recommender_id: 'm6', vote_count: 4 },
  { song_id: 's18', recommender_id: 'm6', vote_count: 1 },
];

export const mockRevealedMemberChoices = [
  {
    member_id: 'm1',
    member_name: '이상희',
    choices: [
      { recommender_id: 'm1', song_id: 's1' },
      { recommender_id: 'm2', song_id: 's6' },
      { recommender_id: 'm3', song_id: 's8' },
      { recommender_id: 'm4', song_id: 's10' },
      { recommender_id: 'm5', song_id: 's13' },
      { recommender_id: 'm6', song_id: 's17' },
    ]
  },
  {
    member_id: 'm2',
    member_name: '손석호',
    choices: [
      { recommender_id: 'm1', song_id: 's1' },
      { recommender_id: 'm2', song_id: 's5' },
      { recommender_id: 'm3', song_id: 's8' },
      { recommender_id: 'm4', song_id: 's11' },
      { recommender_id: 'm5', song_id: 's13' },
      { recommender_id: 'm6', song_id: 's17' },
    ]
  },
  {
    member_id: 'm3',
    member_name: '권선영',
    choices: [
      { recommender_id: 'm1', song_id: 's2' },
      { recommender_id: 'm2', song_id: 's6' },
      { recommender_id: 'm3', song_id: 's8' },
      { recommender_id: 'm4', song_id: 's10' },
      { recommender_id: 'm5', song_id: 's13' },
      { recommender_id: 'm6', song_id: 's16' },
    ]
  },
  {
    member_id: 'm4',
    member_name: '신봉철',
    choices: [
      { recommender_id: 'm1', song_id: 's1' },
      { recommender_id: 'm2', song_id: 's6' },
      { recommender_id: 'm3', song_id: 's7' },
      { recommender_id: 'm4', song_id: 's10' },
      { recommender_id: 'm5', song_id: 's13' },
      { recommender_id: 'm6', song_id: 's17' },
    ]
  },
  {
    member_id: 'm5',
    member_name: '문성일',
    choices: [
      { recommender_id: 'm1', song_id: 's1' },
      { recommender_id: 'm2', song_id: 's5' },
      { recommender_id: 'm3', song_id: 's8' },
      { recommender_id: 'm4', song_id: 's11' },
      { recommender_id: 'm5', song_id: 's13' },
      { recommender_id: 'm6', song_id: 's18' },
    ]
  },
  {
    member_id: 'm6',
    member_name: '김동희',
    choices: [
      { recommender_id: 'm1', song_id: 's3' },
      { recommender_id: 'm2', song_id: 's5' },
      { recommender_id: 'm3', song_id: 's9' },
      { recommender_id: 'm4', song_id: 's12' },
      { recommender_id: 'm5', song_id: 's14' },
      { recommender_id: 'm6', song_id: 's17' },
    ]
  },
];

export const mockMemberData: MemberBallotData = {
  election: baseElection,
  member: {
    id: 'm4',
    name: '신봉철',
    part: '베이스 / 리더',
  },
  my_choices: [
    { recommender_id: 'm1', song_id: 's1' },
    { recommender_id: 'm2', song_id: 's6' },
  ],
  has_submitted: false,
  recommenders: recommendersList.map(r => ({
    ...r,
    is_me: r.id === 'm4'
  }))
};

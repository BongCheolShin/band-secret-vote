export interface Song {
  id: string;
  title: string;
  artist: string;
  youtube_url: string;
  order_no: number;
}

export interface RecommenderGroup {
  id: string;
  name: string;
  part: string;
  is_me?: boolean;
  songs: Song[];
}

export interface ElectionInfo {
  id: string;
  title: string;
  theme: string;
  start_at: string;
  end_at: string;
  server_now: string;
}

export interface SongVoteResult {
  song_id: string;
  recommender_id: string;
  vote_count: number;
}

export interface MemberChoiceResult {
  member_id: string;
  member_name: string;
  choices: Array<{
    recommender_id: string;
    song_id: string;
  }>;
}

export interface PublicElectionData {
  election: ElectionInfo;
  total_members: number;
  completed_count: number;
  is_ended: boolean;
  is_revealed: boolean;
  recommenders: RecommenderGroup[];
  results: SongVoteResult[];
  member_choices: MemberChoiceResult[];
}

export interface MemberBallotData {
  has_pin?: boolean;
  is_unlocked?: boolean;
  election: ElectionInfo;
  member: {
    id: string;
    name: string;
    part: string;
  };
  my_choices?: Array<{
    recommender_id: string;
    song_id: string;
  }>;
  has_submitted?: boolean;
  recommenders?: RecommenderGroup[];
}

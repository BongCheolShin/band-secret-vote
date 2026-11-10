-- ==============================================================================
-- Band Secret Vote - PostgreSQL Schema & Security RPC Functions
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLES

-- Elections (선거)
CREATE TABLE IF NOT EXISTS elections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    theme TEXT NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Members (멤버 6명)
CREATE TABLE IF NOT EXISTS members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    part TEXT NOT NULL,
    vote_token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(election_id, name)
);

-- Songs (후보곡 18곡: 6명 x 3곡)
CREATE TABLE IF NOT EXISTS songs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    recommender_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    youtube_url TEXT NOT NULL DEFAULT '',
    order_no INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(recommender_id, order_no)
);

-- Ballots (투표 제출 기록 - 멤버당 1개 레코드 유지)
CREATE TABLE IF NOT EXISTS ballots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(election_id, member_id)
);

-- Ballot Choices (투표지의 6개 그룹별 선택)
CREATE TABLE IF NOT EXISTS ballot_choices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ballot_id UUID NOT NULL REFERENCES ballots(id) ON DELETE CASCADE,
    recommender_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(ballot_id, recommender_id)
);

-- 3. ROW LEVEL SECURITY (RLS)
ALTER TABLE elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ballots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ballot_choices ENABLE ROW LEVEL SECURITY;

-- 익명 사용자(anon)는 기본 테이블 직접 SELECT/INSERT/UPDATE 불가 (보안 함수 RPC를 통해서만 통신)
-- 이렇게 해야 마감 전 중간 집계나 타인의 투표 토큰 유출을 원천 방지할 수 있습니다.
DROP POLICY IF EXISTS "Anon public read elections" ON elections;
CREATE POLICY "Anon public read elections" ON elections FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anon public read songs" ON songs;
CREATE POLICY "Anon public read songs" ON songs FOR SELECT USING (true);

-- members 테이블은 토큰 제외하고 공개 조회 가능하도록 RPC로 처리


-- 4. SECURITY DEFINER RPC FUNCTIONS (보안 비즈니스 로직)

-- A. 공개 페이지용 데이터 조회 RPC
-- 마감 시각 경과 AND 전원(6명) 완료 전에는 절대로 개별 선택과 득표수를 반환하지 않음!
CREATE OR REPLACE FUNCTION get_public_election_data(p_election_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_election RECORD;
    v_total_members INT;
    v_completed_count INT;
    v_is_ended BOOLEAN;
    v_is_revealed BOOLEAN;
    v_recommenders JSONB;
    v_results JSONB := '[]'::JSONB;
    v_member_choices JSONB := '[]'::JSONB;
BEGIN
    -- 1. 선거 정보 조회
    SELECT * INTO v_election FROM elections WHERE id = p_election_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION '선거 정보를 찾을 수 없습니다.';
    END IF;

    -- 2. 멤버 수 및 제출 완료자 수 확인
    SELECT COUNT(*) INTO v_total_members FROM members WHERE election_id = p_election_id;
    SELECT COUNT(*) INTO v_completed_count FROM ballots WHERE election_id = p_election_id;

    -- 3. 이중 조건 판정 (서버 시간 기준)
    v_is_ended := timezone('utc'::text, now()) >= v_election.end_at;
    v_is_revealed := v_is_ended AND (v_completed_count >= v_total_members AND v_total_members > 0);

    -- 4. 추천자 그룹 및 곡 목록 조회 (토큰 제외, 곡이 없으면 빈 배열)
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', m.id,
            'name', m.name,
            'part', m.part,
            'songs', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', s.id,
                        'title', s.title,
                        'artist', s.artist,
                        'youtube_url', s.youtube_url,
                        'order_no', s.order_no
                    ) ORDER BY s.order_no
                ) FROM songs s WHERE s.recommender_id = m.id
            ), '[]'::JSONB)
        ) ORDER BY m.name
    ) INTO v_recommenders
    FROM members m
    WHERE m.election_id = p_election_id;

    -- 5. 결과 공개 조건 충족 시에만 득표 집계 및 6명 실명 선택 매트릭스 계산
    IF v_is_revealed THEN
        -- 후보곡별 득표수
        SELECT jsonb_agg(
            jsonb_build_object(
                'song_id', s.id,
                'recommender_id', s.recommender_id,
                'vote_count', COALESCE(COUNT(bc.id), 0)
            )
        ) INTO v_results
        FROM songs s
        LEFT JOIN ballot_choices bc ON bc.song_id = s.id
        WHERE s.election_id = p_election_id
        GROUP BY s.id, s.recommender_id;

        -- 6명 실명별 최종 선택 매트릭스 (36건)
        SELECT jsonb_agg(
            jsonb_build_object(
                'member_id', m.id,
                'member_name', m.name,
                'choices', (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'recommender_id', bc.recommender_id,
                            'song_id', bc.song_id
                        )
                    )
                    FROM ballots b
                    JOIN ballot_choices bc ON bc.ballot_id = b.id
                    WHERE b.member_id = m.id
                )
            ) ORDER BY m.name
        ) INTO v_member_choices
        FROM members m
        WHERE m.election_id = p_election_id;
    END IF;

    -- 6. 최종 안전한 데이터 반환
    RETURN jsonb_build_object(
        'election', jsonb_build_object(
            'id', v_election.id,
            'title', v_election.title,
            'theme', v_election.theme,
            'start_at', v_election.start_at,
            'end_at', v_election.end_at,
            'server_now', timezone('utc'::text, now())
        ),
        'total_members', v_total_members,
        'completed_count', v_completed_count,
        'is_ended', v_is_ended,
        'is_revealed', v_is_revealed,
        'recommenders', COALESCE(v_recommenders, '[]'::JSONB),
        'results', v_results,
        'member_choices', v_member_choices
    );
END;
$$;


-- B. 개인 투표 페이지 진입용 RPC (토큰으로 내 정보 및 기존 선택 조회)
CREATE OR REPLACE FUNCTION get_my_ballot(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_member RECORD;
    v_election RECORD;
    v_existing_ballot RECORD;
    v_my_choices JSONB := '[]'::JSONB;
    v_recommenders JSONB;
BEGIN
    -- 1. 토큰으로 멤버 조회
    SELECT * INTO v_member FROM members WHERE vote_token = p_token;
    IF NOT FOUND THEN
        RAISE EXCEPTION '유효하지 않은 투표 링크입니다.';
    END IF;

    -- 2. 선거 정보 조회
    SELECT * INTO v_election FROM elections WHERE id = v_member.election_id;

    -- 3. 본인이 기존에 제출한 선택 내역 조회 (타인의 선택은 절대 조회 불가)
    SELECT * INTO v_existing_ballot FROM ballots WHERE member_id = v_member.id AND election_id = v_election.id;
    IF FOUND THEN
        SELECT jsonb_agg(
            jsonb_build_object(
                'recommender_id', bc.recommender_id,
                'song_id', bc.song_id
            )
        ) INTO v_my_choices
        FROM ballot_choices bc
        WHERE bc.ballot_id = v_existing_ballot.id;
    END IF;

    -- 4. 전체 추천자 그룹 및 곡 정보 조회 (곡이 없으면 빈 배열)
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', m.id,
            'name', m.name,
            'part', m.part,
            'is_me', (m.id = v_member.id),
            'songs', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', s.id,
                        'title', s.title,
                        'artist', s.artist,
                        'youtube_url', s.youtube_url,
                        'order_no', s.order_no
                    ) ORDER BY s.order_no
                ) FROM songs s WHERE s.recommender_id = m.id
            ), '[]'::JSONB)
        ) ORDER BY m.name
    ) INTO v_recommenders
    FROM members m
    WHERE m.election_id = v_election.id;

    RETURN jsonb_build_object(
        'election', jsonb_build_object(
            'id', v_election.id,
            'title', v_election.title,
            'theme', v_election.theme,
            'start_at', v_election.start_at,
            'end_at', v_election.end_at,
            'server_now', timezone('utc'::text, now())
        ),
        'member', jsonb_build_object(
            'id', v_member.id,
            'name', v_member.name,
            'part', v_member.part
        ),
        'my_choices', COALESCE(v_my_choices, '[]'::JSONB),
        'has_submitted', (v_existing_ballot.id IS NOT NULL),
        'recommenders', COALESCE(v_recommenders, '[]'::JSONB)
    );
END;
$$;


-- C. 투표 제출 및 수정 RPC (원자적 트랜잭션 & 엄격한 검증)
CREATE OR REPLACE FUNCTION submit_ballot(p_token TEXT, p_choices JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_member RECORD;
    v_election RECORD;
    v_ballot_id UUID;
    v_total_groups INT;
    v_choice RECORD;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    -- 1. 토큰 검증
    SELECT * INTO v_member FROM members WHERE vote_token = p_token;
    IF NOT FOUND THEN
        RAISE EXCEPTION '유효하지 않은 투표 링크입니다.';
    END IF;

    -- 2. 선거 일정 검증 (서버 시간 기준)
    SELECT * INTO v_election FROM elections WHERE id = v_member.election_id;
    IF v_now < v_election.start_at THEN
        RAISE EXCEPTION '투표가 아직 시작되지 않았습니다.';
    END IF;
    IF v_now >= v_election.end_at THEN
        RAISE EXCEPTION '투표가 이미 마감되었습니다.';
    END IF;

    -- 3. 6개 그룹 선택 완결성 검증
    SELECT COUNT(*) INTO v_total_groups FROM members WHERE election_id = v_election.id;
    IF jsonb_array_length(p_choices) <> v_total_groups THEN
        RAISE EXCEPTION '모든 추천자 그룹(총 %개)에서 정확히 1곡씩 선택해야 합니다.', v_total_groups;
    END IF;

    -- 4. 투표지(Ballot) 생성 또는 갱신
    INSERT INTO ballots (election_id, member_id, submitted_at)
    VALUES (v_election.id, v_member.id, v_now)
    ON CONFLICT (election_id, member_id)
    DO UPDATE SET submitted_at = v_now
    RETURNING id INTO v_ballot_id;

    -- 5. 기존 선택 내역 삭제 후 최신 선택 일괄 삽입
    DELETE FROM ballot_choices WHERE ballot_id = v_ballot_id;

    FOR v_choice IN SELECT * FROM jsonb_to_recordset(p_choices) AS x(recommender_id UUID, song_id UUID)
    LOOP
        -- 선택한 song_id가 실제 해당 recommender_id의 곡인지 검증
        IF NOT EXISTS (
            SELECT 1 FROM songs
            WHERE id = v_choice.song_id AND recommender_id = v_choice.recommender_id
        ) THEN
            RAISE EXCEPTION '잘못된 추천자 및 곡 조합이 포함되어 있습니다.';
        END IF;

        INSERT INTO ballot_choices (ballot_id, recommender_id, song_id)
        VALUES (v_ballot_id, v_choice.recommender_id, v_choice.song_id);
    END LOOP;

-- 7. 관리자 전용 보안 RPC 함수 (멤버 링크 및 투표 완료 여부 조회)
CREATE OR REPLACE FUNCTION get_admin_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_election RECORD;
    v_members JSONB;
BEGIN
    SELECT * INTO v_election FROM elections ORDER BY created_at DESC LIMIT 1;
    IF NOT FOUND THEN
        RAISE EXCEPTION '선거 정보가 없습니다.';
    END IF;

    SELECT jsonb_agg(
        jsonb_build_object(
            'id', m.id,
            'name', m.name,
            'part', m.part,
            'vote_token', m.vote_token,
            'has_submitted', EXISTS(SELECT 1 FROM ballots b WHERE b.member_id = m.id AND b.election_id = v_election.id),
            'songs', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', s.id,
                        'title', s.title,
                        'artist', s.artist,
                        'youtube_url', s.youtube_url,
                        'order_no', s.order_no
                    ) ORDER BY s.order_no
                ) FROM songs s WHERE s.recommender_id = m.id
            ), '[]'::JSONB)
        ) ORDER BY m.name
    ) INTO v_members
    FROM members m
    WHERE m.election_id = v_election.id;

    RETURN jsonb_build_object(
        'election', jsonb_build_object(
            'id', v_election.id,
            'title', v_election.title,
            'theme', v_election.theme,
            'start_at', v_election.start_at,
            'end_at', v_election.end_at
        ),
        'members', COALESCE(v_members, '[]'::JSONB)
    );
END;
$$;

-- 8. 관리자용 곡 정보 저장/업데이트 RPC
CREATE OR REPLACE FUNCTION admin_save_song(
    p_election_id UUID,
    p_recommender_id UUID,
    p_order_no INT,
    p_title TEXT,
    p_artist TEXT,
    p_youtube_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO songs (election_id, recommender_id, order_no, title, artist, youtube_url)
    VALUES (p_election_id, p_recommender_id, p_order_no, p_title, p_artist, p_youtube_url)
    ON CONFLICT (recommender_id, order_no)
    DO UPDATE SET
        title = EXCLUDED.title,
        artist = EXCLUDED.artist,
        youtube_url = EXCLUDED.youtube_url;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 9. 관리자용 일정/제목 저장 RPC
CREATE OR REPLACE FUNCTION admin_save_election(
    p_election_id UUID,
    p_title TEXT,
    p_theme TEXT,
    p_start_at TIMESTAMPTZ,
    p_end_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE elections
    SET title = p_title,
        theme = p_theme,
        start_at = p_start_at,
        end_at = p_end_at
    WHERE id = p_election_id;

    RETURN jsonb_build_object('success', true);
END;
$$;


-- ==============================================================================
-- Band Secret Vote - PostgreSQL Schema & Security RPC Functions
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
    pin_hash TEXT DEFAULT NULL,
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

DROP POLICY IF EXISTS "Anon public read elections" ON elections;
CREATE POLICY "Anon public read elections" ON elections FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anon public read songs" ON songs;
CREATE POLICY "Anon public read songs" ON songs FOR SELECT USING (true);


-- 4. SECURITY DEFINER RPC FUNCTIONS (보안 비즈니스 로직)

-- 구버전 오버로딩 함수 삭제 (파라미터 충돌 방지)
DROP FUNCTION IF EXISTS public.get_my_ballot(TEXT);
DROP FUNCTION IF EXISTS public.get_my_ballot(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.submit_ballot(TEXT, JSONB);
DROP FUNCTION IF EXISTS public.submit_ballot(TEXT, JSONB, TEXT);

-- A. 공개 페이지용 데이터 조회 RPC
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
    SELECT * INTO v_election FROM elections WHERE id = p_election_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION '선거를 찾을 수 없습니다.';
    END IF;

    SELECT COUNT(*) INTO v_total_members FROM members WHERE election_id = p_election_id;
    SELECT COUNT(*) INTO v_completed_count FROM ballots WHERE election_id = p_election_id;

    v_is_ended := now() >= v_election.end_at;
    v_is_revealed := (v_is_ended AND v_completed_count >= v_total_members);

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

    IF v_is_revealed THEN
        SELECT jsonb_agg(
            jsonb_build_object(
                'song_id', sub.id,
                'recommender_id', sub.recommender_id,
                'vote_count', sub.cnt
            )
        ) INTO v_results
        FROM (
            SELECT s.id, s.recommender_id, COUNT(bc.id) AS cnt
            FROM songs s
            LEFT JOIN ballot_choices bc ON bc.song_id = s.id
            WHERE s.election_id = p_election_id
            GROUP BY s.id, s.recommender_id
        ) sub;

        SELECT jsonb_agg(
            jsonb_build_object(
                'member_id', m.id,
                'member_name', m.name,
                'choices', COALESCE((
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'recommender_id', bc.recommender_id,
                            'song_id', bc.song_id
                        )
                    )
                    FROM ballots b
                    JOIN ballot_choices bc ON bc.ballot_id = b.id
                    WHERE b.member_id = m.id AND b.election_id = p_election_id
                ), '[]'::JSONB)
            ) ORDER BY m.name
        ) INTO v_member_choices
        FROM members m
        WHERE m.election_id = p_election_id;
    END IF;

    RETURN jsonb_build_object(
        'election', jsonb_build_object(
            'id', v_election.id,
            'title', v_election.title,
            'theme', v_election.theme,
            'start_at', to_char(v_election.start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'end_at', to_char(v_election.end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'server_now', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
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


-- B. 최초 PIN 등록 RPC
CREATE OR REPLACE FUNCTION set_my_pin(
    p_token TEXT,
    p_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_member RECORD;
BEGIN
    IF LENGTH(p_pin) < 4 THEN
        RAISE EXCEPTION 'PIN 번호는 최소 4자리 이상이어야 합니다.';
    END IF;

    SELECT * INTO v_member FROM members WHERE vote_token = p_token;
    IF NOT FOUND THEN
        RAISE EXCEPTION '유효하지 않은 투표 링크입니다.';
    END IF;

    IF v_member.pin_hash IS NOT NULL THEN
        RAISE EXCEPTION '이미 PIN 비밀번호가 설정되어 있습니다.';
    END IF;

    UPDATE members
    SET pin_hash = encode(digest(p_pin, 'sha256'), 'hex')
    WHERE id = v_member.id;

    RETURN jsonb_build_object('success', true);
END;
$$;


-- C. 개인 투표 페이지 진입용 RPC (PIN 보호)
CREATE OR REPLACE FUNCTION get_my_ballot(
    p_token TEXT,
    p_pin TEXT DEFAULT NULL
)
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
    SELECT * INTO v_member FROM members WHERE vote_token = p_token;
    IF NOT FOUND THEN
        RAISE EXCEPTION '유효하지 않은 투표 링크입니다.';
    END IF;

    SELECT * INTO v_election FROM elections WHERE id = v_member.election_id;

    -- 전체 추천자 그룹 및 곡 정보 조회 (공개 데이터이므로 항상 포함하여 프론트 크래시 방지)
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

    -- 1. PIN 미설정 상태인 경우
    IF v_member.pin_hash IS NULL THEN
        RETURN jsonb_build_object(
            'has_pin', false,
            'is_unlocked', false,
            'member', jsonb_build_object(
                'id', v_member.id,
                'name', v_member.name,
                'part', v_member.part
            ),
            'recommenders', COALESCE(v_recommenders, '[]'::JSONB),
            'election', jsonb_build_object(
                'id', v_election.id,
                'title', v_election.title,
                'theme', v_election.theme,
                'start_at', to_char(v_election.start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                'end_at', to_char(v_election.end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                'server_now', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
            )
        );
    END IF;

    -- 2. PIN이 설정되어 있으나 입력하지 않은 경우 (잠금 화면용 메타데이터만 반환)
    IF p_pin IS NULL THEN
        RETURN jsonb_build_object(
            'has_pin', true,
            'is_unlocked', false,
            'member', jsonb_build_object(
                'id', v_member.id,
                'name', v_member.name,
                'part', v_member.part
            ),
            'recommenders', COALESCE(v_recommenders, '[]'::JSONB),
            'election', jsonb_build_object(
                'id', v_election.id,
                'title', v_election.title,
                'theme', v_election.theme,
                'start_at', to_char(v_election.start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                'end_at', to_char(v_election.end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                'server_now', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
            )
        );
    END IF;

    -- 3. PIN 검증
    IF v_member.pin_hash <> encode(digest(p_pin, 'sha256'), 'hex') THEN
        RAISE EXCEPTION 'PIN 비밀번호가 일치하지 않습니다.';
    END IF;

    -- 4. PIN 인증 성공 시 기존 선택 및 투표지 반환
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
        'has_pin', true,
        'is_unlocked', true,
        'election', jsonb_build_object(
            'id', v_election.id,
            'title', v_election.title,
            'theme', v_election.theme,
            'start_at', to_char(v_election.start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'end_at', to_char(v_election.end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'server_now', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
        ),
        'member', jsonb_build_object(
            'id', v_member.id,
            'name', v_member.name,
            'part', v_member.part
        ),
        'has_submitted', (v_existing_ballot.id IS NOT NULL),
        'my_choices', COALESCE(v_my_choices, '[]'::JSONB),
        'recommenders', COALESCE(v_recommenders, '[]'::JSONB)
    );
END;
$$;


-- D. 투표 제출 및 수정 RPC (PIN 검증 포함)
CREATE OR REPLACE FUNCTION submit_ballot(
    p_token TEXT,
    p_choices JSONB,
    p_pin TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_member RECORD;
    v_election RECORD;
    v_ballot_id UUID;
    v_choice RECORD;
    v_total_groups INT;
    v_now TIMESTAMPTZ := now();
BEGIN
    SELECT * INTO v_member FROM members WHERE vote_token = p_token;
    IF NOT FOUND THEN
        RAISE EXCEPTION '유효하지 않은 투표 링크입니다.';
    END IF;

    -- PIN이 설정되어 있는 경우 검증
    IF v_member.pin_hash IS NOT NULL THEN
        IF p_pin IS NULL OR v_member.pin_hash <> encode(digest(p_pin, 'sha256'), 'hex') THEN
            RAISE EXCEPTION 'PIN 비밀번호 인증에 실패했습니다.';
        END IF;
    END IF;

    SELECT * INTO v_election FROM elections WHERE id = v_member.election_id;

    IF v_now < v_election.start_at THEN
        RAISE EXCEPTION '투표가 아직 시작되지 않았습니다.';
    END IF;
    IF v_now >= v_election.end_at THEN
        RAISE EXCEPTION '투표가 이미 마감되었습니다.';
    END IF;

    SELECT COUNT(*) INTO v_total_groups FROM members WHERE election_id = v_election.id;
    IF jsonb_array_length(p_choices) <> v_total_groups THEN
        RAISE EXCEPTION '모든 추천자 그룹(총 %개)에서 정확히 1곡씩 선택해야 합니다.', v_total_groups;
    END IF;

    INSERT INTO ballots (election_id, member_id, submitted_at)
    VALUES (v_election.id, v_member.id, v_now)
    ON CONFLICT (election_id, member_id)
    DO UPDATE SET submitted_at = v_now
    RETURNING id INTO v_ballot_id;

    DELETE FROM ballot_choices WHERE ballot_id = v_ballot_id;

    FOR v_choice IN SELECT * FROM jsonb_to_recordset(p_choices) AS x(recommender_id UUID, song_id UUID)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM songs
            WHERE id = v_choice.song_id AND recommender_id = v_choice.recommender_id
        ) THEN
            RAISE EXCEPTION '잘못된 추천자 및 곡 조합이 포함되어 있습니다.';
        END IF;

        INSERT INTO ballot_choices (ballot_id, recommender_id, song_id)
        VALUES (v_ballot_id, v_choice.recommender_id, v_choice.song_id);
    END LOOP;

    RETURN jsonb_build_object('success', true);
END;
$$;


-- E. 관리자 전용 보안 RPC 함수 (멤버 링크, 투표 완료 및 PIN 설정 상태 조회)
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
            'has_pin', (m.pin_hash IS NOT NULL),
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
            'start_at', to_char(v_election.start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'end_at', to_char(v_election.end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'server_now', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
        ),
        'members', COALESCE(v_members, '[]'::JSONB)
    );
END;
$$;


-- F. 관리자 PIN 초기화 RPC (PIN 분실자 구제)
CREATE OR REPLACE FUNCTION admin_reset_member_pin(
    p_member_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE members
    SET pin_hash = NULL
    WHERE id = p_member_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '해당 멤버를 찾을 수 없습니다.';
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

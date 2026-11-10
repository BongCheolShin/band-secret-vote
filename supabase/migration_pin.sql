-- ==============================================================================
-- Migration: Add PIN Lock & Reset Feature to Band Secret Vote
-- ==============================================================================

-- 1. pgcrypto 확장 활성화 (sha256 digest용)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. members 테이블에 pin_hash 컬럼 추가
ALTER TABLE members ADD COLUMN IF NOT EXISTS pin_hash TEXT DEFAULT NULL;

-- 3. 최초 PIN 등록 RPC
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

-- 4. 투표지 조회 RPC (PIN 보호 적용)
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

    -- PIN 미설정 상태
    IF v_member.pin_hash IS NULL THEN
        RETURN jsonb_build_object(
            'has_pin', false,
            'is_unlocked', false,
            'member', jsonb_build_object(
                'id', v_member.id,
                'name', v_member.name,
                'part', v_member.part
            ),
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

    -- PIN 설정되어 있으나 입력하지 않은 경우 (기본 메타데이터만 반환)
    IF p_pin IS NULL THEN
        RETURN jsonb_build_object(
            'has_pin', true,
            'is_unlocked', false,
            'member', jsonb_build_object(
                'id', v_member.id,
                'name', v_member.name,
                'part', v_member.part
            ),
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

    -- PIN 검증
    IF v_member.pin_hash <> encode(digest(p_pin, 'sha256'), 'hex') THEN
        RAISE EXCEPTION 'PIN 비밀번호가 일치하지 않습니다.';
    END IF;

    -- PIN 일치 시 투표지 및 선택 내역 조회
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

-- 5. 투표 제출 RPC (PIN 검증 포함)
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

-- 6. 관리자 데이터 조회 RPC에 has_pin 추가
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

-- 7. 관리자 PIN 초기화 RPC
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

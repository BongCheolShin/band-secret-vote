-- ==============================================================================
-- Band Secret Vote - Initial Seed Data (이따위밴드 2027-H1 신해철 공연곡 투표)
-- ==============================================================================

DO $$
DECLARE
    v_election_id UUID;
    v_mem_sh UUID; -- 이상희
    v_mem_sk UUID; -- 손석호
    v_mem_sy UUID; -- 권선영
    v_mem_bc UUID; -- 신봉철
    v_mem_si UUID; -- 문성일
    v_mem_dh UUID; -- 김동희
BEGIN
    -- 1. 선거 등록 (투표 일정: 2026-11-12 00:00 ~ 2026-11-13 23:59 KST)
    -- KST(UTC+9) 기준: 2026-11-11 15:00:00 UTC ~ 2026-11-13 14:59:59 UTC
    INSERT INTO elections (title, theme, start_at, end_at)
    VALUES (
        '이따위밴드 2027년 상반기 공연곡 투표',
        '신해철',
        '2026-11-11 15:00:00+00',
        '2026-11-13 14:59:59+00'
    ) RETURNING id INTO v_election_id;

    -- 2. 멤버 6명 등록 (추측 불가능한 32자리 고엔트로피 난수 토큰 생성)
    INSERT INTO members (election_id, name, part, vote_token)
    VALUES (v_election_id, '이상희', '키보드', md5(random()::text || clock_timestamp()::text || 'sh'))
    RETURNING id INTO v_mem_sh;

    INSERT INTO members (election_id, name, part, vote_token)
    VALUES (v_election_id, '손석호', '기타', md5(random()::text || clock_timestamp()::text || 'sk'))
    RETURNING id INTO v_mem_sk;

    INSERT INTO members (election_id, name, part, vote_token)
    VALUES (v_election_id, '권선영', '기타', md5(random()::text || clock_timestamp()::text || 'sy'))
    RETURNING id INTO v_mem_sy;

    INSERT INTO members (election_id, name, part, vote_token)
    VALUES (v_election_id, '신봉철', '베이스 / 리더', md5(random()::text || clock_timestamp()::text || 'bc'))
    RETURNING id INTO v_mem_bc;

    INSERT INTO members (election_id, name, part, vote_token)
    VALUES (v_election_id, '문성일', '보컬', md5(random()::text || clock_timestamp()::text || 'si'))
    RETURNING id INTO v_mem_si;

    INSERT INTO members (election_id, name, part, vote_token)
    VALUES (v_election_id, '김동희', '드럼', md5(random()::text || clock_timestamp()::text || 'dh'))
    RETURNING id INTO v_mem_dh;

    -- 3. 추천곡 등록 (30-creatives/band/it-die/2027-H1/선곡일지.md 기준)
    -- 이상희 추천곡 3곡
    INSERT INTO songs (election_id, recommender_id, title, artist, youtube_url, order_no) VALUES
    (v_election_id, v_mem_sh, '일상으로의 초대', '신해철', 'https://www.youtube.com/results?search_query=신해철+일상으로의+초대', 1),
    (v_election_id, v_mem_sh, '힘겨워하는 연인들을 위하여', '넥스트', 'https://www.youtube.com/results?search_query=넥스트+힘겨워하는+연인들을+위하여', 2),
    (v_election_id, v_mem_sh, '질주', '신해철', 'https://www.youtube.com/results?search_query=신해철+질주', 3);

    -- 손석호 추천곡 3곡
    INSERT INTO songs (election_id, recommender_id, title, artist, youtube_url, order_no) VALUES
    (v_election_id, v_mem_sk, '슬픈표정하지말아요', '신해철', 'https://www.youtube.com/results?search_query=신해철+슬픈표정하지말아요', 1),
    (v_election_id, v_mem_sk, '그대에게', '무한궤도', 'https://www.youtube.com/results?search_query=무한궤도+그대에게', 2),
    (v_election_id, v_mem_sk, '날아라 얄리', '넥스트', 'https://www.youtube.com/results?search_query=넥스트+날아라+얄리', 3);

    -- 권선영 추천곡 3곡
    INSERT INTO songs (election_id, recommender_id, title, artist, youtube_url, order_no) VALUES
    (v_election_id, v_mem_sy, '이중인격자', '넥스트', 'https://www.youtube.com/results?search_query=넥스트+이중인격자', 1),
    (v_election_id, v_mem_sy, '재즈카페', '신해철', 'https://www.youtube.com/results?search_query=신해철+재즈카페', 2),
    (v_election_id, v_mem_sy, '나에게 쓰는 편지', '신해철', 'https://www.youtube.com/results?search_query=신해철+나에게+쓰는+편지', 3);

    -- 신봉철 추천곡 (제출 대기 임시곡)
    INSERT INTO songs (election_id, recommender_id, title, artist, youtube_url, order_no) VALUES
    (v_election_id, v_mem_bc, '해에게서 소년에게', '넥스트', 'https://www.youtube.com/results?search_query=넥스트+해에게서+소년에게', 1),
    (v_election_id, v_mem_bc, '도시인', '넥스트', 'https://www.youtube.com/results?search_query=넥스트+도시인', 2),
    (v_election_id, v_mem_bc, '인형의 기사 Part 2', '넥스트', 'https://www.youtube.com/results?search_query=넥스트+인형의+기사+Part+2', 3);

    -- 문성일 추천곡 (제출 대기 임시곡)
    INSERT INTO songs (election_id, recommender_id, title, artist, youtube_url, order_no) VALUES
    (v_election_id, v_mem_si, 'Lazenca, Save Us', '넥스트', 'https://www.youtube.com/results?search_query=넥스트+Lazenca+Save+Us', 1),
    (v_election_id, v_mem_si, '아주 가끔은', '신해철', 'https://www.youtube.com/results?search_query=신해철+아주+가끔은', 2),
    (v_election_id, v_mem_si, 'The Destruction of the Shell', '넥스트', 'https://www.youtube.com/results?search_query=넥스트+The+Destruction+of+the+Shell', 3);

    -- 김동희 추천곡 (제출 대기 임시곡)
    INSERT INTO songs (election_id, recommender_id, title, artist, youtube_url, order_no) VALUES
    (v_election_id, v_mem_dh, '안녕', '신해철', 'https://www.youtube.com/results?search_query=신해철+안녕', 1),
    (v_election_id, v_mem_dh, '절망에 관하여', '신해철', 'https://www.youtube.com/results?search_query=신해철+절망에+관하여', 2),
    (v_election_id, v_mem_dh, 'Hope', '넥스트', 'https://www.youtube.com/results?search_query=넥스트+Hope', 3);

    RAISE NOTICE '2027-H1 이따위밴드 신해철 투표 데이터 초기화 완료! election_id: %', v_election_id;
END;
$$;

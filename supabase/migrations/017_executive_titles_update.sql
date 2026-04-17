-- executive_positions 직책 목록에 '회장', '군지음팀장' 추가
ALTER TABLE executive_positions
  DROP CONSTRAINT IF EXISTS executive_positions_title_check;

ALTER TABLE executive_positions
  ADD CONSTRAINT executive_positions_title_check
  CHECK (title IN (
    '담당목사',
    '회장',
    '청년부회장',
    '부회장',
    '회계',
    '사역국장',
    '목양국장',
    '군지음팀장'
  ));

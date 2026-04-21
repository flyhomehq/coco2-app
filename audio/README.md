# CockpitOS 사운드 파일 가이드

이 폴더에 MP3 파일을 추가하면 자동으로 재생됩니다.
코드 수정 필요 없음. 파일만 넣으면 됨.

## 필요한 파일 목록

### 비행 단계별 배경음악 (BGM)
| 파일명 | 용도 | 추천 스타일 |
|--------|------|------------|
| ambient_ground.mp3 | 주기/준비 | 차분한 앰비언트 |
| engine_taxi.mp3 | 택싱 | 엔진 소리 배경 |
| takeoff_theme.mp3 | 이륙 | 극적/상승감 |
| climbing.mp3 | 상승 | 기대감 있는 음악 |
| cruise_ambient.mp3 | 순항 | 잔잔한 하늘 음악 |
| descent.mp3 | 하강 | 차분한 전환 |
| approach.mp3 | 접근 | 긴장감 |
| landing_tension.mp3 | 착륙 중 | 집중 |
| landed_victory.mp3 | 착륙 완료 | 성취감 |

### 관광지 테마
| 파일명 | 용도 |
|--------|------|
| seoul_theme.mp3 | 서울 지역 |
| jeju_theme.mp3 | 제주 지역 |
| tokyo_theme.mp3 | 도쿄 (확장용) |
| tourist_generic.mp3 | 일반 관광 |

### 효과음 (SFX)
| 파일명 | 용도 |
|--------|------|
| sfx_ding.mp3 | 이륙 성공 |
| sfx_applause.mp3 | 부드러운 착륙 |
| sfx_warning.mp3 | 거친 착륙 |
| sfx_achievement.mp3 | 배지 획득 |
| sfx_alert.mp3 | 경고 |
| sfx_danger.mp3 | 위험 |
| sfx_chime.mp3 | 관광지 도착 |
| sfx_click.mp3 | 버튼 클릭 |

## 사운드 소스 추천

### 무료 상업 이용 가능 사이트
- **Free Music Archive** (freemusicarchive.org)
- **YouTube Audio Library** (studio.youtube.com - 크리에이터 스튜디오)
- **Pixabay Music** (pixabay.com/music)
- **Incompetech** (incompetech.com - Kevin MacLeod)
- **Freesound** (freesound.org - 효과음)

### 유료 (고품질)
- **Epidemic Sound** ($15/월)
- **Artlist** ($9.99/월)
- **AudioJungle** (건당 $10~50)

### 추천 장르
- 순항 BGM: "cinematic piano", "ambient pad", "chill electronic"
- 이륙: "epic orchestral", "uplifting"
- 효과음: "UI sound", "notification"

## 주의사항

1. **길이**: 배경음악 3~5분 (루프), 효과음 0.5~3초
2. **볼륨**: 배경음악 -20dB, 효과음 -12dB 정규화 권장
3. **포맷**: MP3 128kbps 이상
4. **용량**: 각 파일 5MB 이하 권장

## 테스트 방법

1. 파일 추가 후 브라우저 새로고침 (Ctrl+Shift+R)
2. 비행 시작
3. 설정에서 음량 조절

## 파일 없을 때

FlightAudio 시스템이 자동으로 **조용히 실패**합니다. 에러 메시지 없이 진행되므로 파일 없어도 앱이 작동합니다.

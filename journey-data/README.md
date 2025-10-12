# 여정 데이터 목록

## 📌 데이터 형식
- **경로 파일**: `{id}-{name}.csv` - 경로 좌표 데이터
- **랜드마크 파일**: `{id}-{name}-landmarks.csv` - 랜드마크 정보

## 🗺️ 여정 목록

### 1. 한국의 고궁탐방 (Palace Tour)
- **ID**: 1
- **거리**: 12.5km
- **난이도**: 쉬움
- **카테고리**: DOMESTIC / 역사
- **파일**:
  - `01-palace-tour.csv` (경로 29개 포인트)
  - `01-palace-tour-landmarks.csv` (8개 랜드마크)
- **랜드마크**: 경복궁 → 청와대 → 창덕궁 → 창경궁 → 종묘 → 서울역사박물관 → 덕수궁 → 숭례문

### 2. 한강 러닝 코스 (Han River Running)
- **ID**: 2
- **거리**: 10.0km
- **난이도**: 쉬움
- **카테고리**: DOMESTIC / 자연
- **파일**:
  - `02-hanriver-run.csv` (경로 50개 포인트)
  - `02-hanriver-run-landmarks.csv` (5개 랜드마크)
- **랜드마크**: 여의도 한강공원 → 선유도공원 → 양화대교 → 당산철교 → 반포대교

### 3. 북한산 둘레길 1코스 (Bukhansan Trail Course 1)
- **ID**: 3
- **거리**: 8.3km
- **난이도**: 보통
- **카테고리**: DOMESTIC / 자연
- **파일**:
  - `03-bukhansan-trail.csv` (경로 80개 포인트)
  - `03-bukhansan-trail-landmarks.csv` (6개 랜드마크)
- **랜드마크**: 구기탐방센터 → 계곡쉼터 → 소귀천 → 화계사 → 솔밭광장 → 우이탐방센터

### 4. 제주 올레 1코스 (Jeju Olle Trail Route 1)
- **ID**: 4
- **거리**: 15.1km
- **난이도**: 보통
- **카테고리**: DOMESTIC / 자연
- **파일**:
  - `04-jeju-olle-1.csv` (경로 100개 포인트)
  - `04-jeju-olle-1-landmarks.csv` (7개 랜드마크)
- **랜드마크**: 시흥초등학교 → 말미오름 → 알오름 → 광치기해변 → 온평포구 → 성산일출봉 → 우도

### 5. 경주 역사문화탐방 (Gyeongju History Tour)
- **ID**: 5
- **거리**: 11.2km
- **난이도**: 쉬움
- **카테고리**: DOMESTIC / 역사
- **파일**:
  - `05-gyeongju-history.csv` (경로 60개 포인트)
  - `05-gyeongju-history-landmarks.csv` (8개 랜드마크)
- **랜드마크**: 대릉원 → 첨성대 → 계림 → 경주향교 → 월정교 → 동궁과 월지 → 국립경주박물관 → 황룡사지

### 6. 부산 해운대 해안길 (Busan Haeundae Coastal Trail)
- **ID**: 6
- **거리**: 9.5km
- **난이도**: 쉬움
- **카테고리**: DOMESTIC / 자연
- **파일**:
  - `06-haeundae-coastal.csv` (경로 70개 포인트)
  - `06-haeundae-coastal-landmarks.csv` (6개 랜드마크)
- **랜드마크**: 해운대해수욕장 → 동백섬 → 달맞이길 → 청사포 → 송정해수욕장 → 죽성성당

---

## 🌍 향후 추가 예정 (국제 여정)

### 파리 센강 산책 (Paris Seine Walk)
- **ID**: 101
- **거리**: 7.5km
- **카테고리**: INTERNATIONAL / 유럽
- **랜드마크**: 에펠탑 → 샹드마르스 → 알렉상드르3세 다리 → 루브르 → 노트르담

### 뉴욕 센트럴파크 러닝 (NYC Central Park Run)
- **ID**: 102
- **거리**: 10.0km
- **카테고리**: INTERNATIONAL / 북미
- **랜드마크**: 맨하탄 광장 → 베세스다 분수 → 벨베데레 성 → 대잔디밭 → 자클린 케네디 저수지

### 도쿄 황궁 둘레길 (Tokyo Imperial Palace Circuit)
- **ID**: 103
- **거리**: 5.0km
- **카테고리**: INTERNATIONAL / 아시아
- **랜드마크**: 황거외원 → 니주바시 → 기타노마루 공원 → 지도리가후치 → 황거동원

---

## 📊 데이터 통계

- **총 여정**: 6개 (국내) + 3개 (향후 추가)
- **총 경로 포인트**: 약 389개
- **총 랜드마크**: 40개
- **총 거리**: 약 66.6km

---

## 🚀 서버 입력 방법

### 1. Journey 기본 정보 먼저 생성
```sql
INSERT INTO journeys (name, description, total_distance_km, category, difficulty, estimated_duration_hours, thumbnail_url, created_at, updated_at)
VALUES
('한국의 고궁탐방', '서울의 5대 궁궐을 탐방하는 역사 여정', 12.5, 'DOMESTIC', 'EASY', 2.5, 'https://...', NOW(), NOW()),
('한강 러닝 코스', '한강을 따라 달리는 상쾌한 러닝 코스', 10.0, 'DOMESTIC', 'EASY', 2.0, 'https://...', NOW(), NOW()),
...
```

### 2. CSV 파일로 경로 데이터 일괄 입력
```bash
mysql -u user -p database < journey-data/load-all.sql
```

또는

```bash
LOAD DATA LOCAL INFILE 'journey-data/01-palace-tour.csv'
INTO TABLE journey_routes
FIELDS TERMINATED BY ','
LINES TERMINATED BY '\n'
IGNORE 1 ROWS;
```

### 3. 랜드마크 데이터 입력
```bash
LOAD DATA LOCAL INFILE 'journey-data/01-palace-tour-landmarks.csv'
INTO TABLE landmarks
FIELDS TERMINATED BY ','
LINES TERMINATED BY '\n'
IGNORE 1 ROWS;
```

---

**작성일**: 2025-01-07
**마지막 수정**: 2025-01-07

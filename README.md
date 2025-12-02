<p></p>
<img width="257" height="154" alt="image" src="https://github.com/user-attachments/assets/7c9349d0-a052-406a-bec8-2bf350ca6baf" />


<br><br>

## WayToEarth - 모던 러닝 · 여정 · 커뮤니티를 하나로 잇는 플랫폼

**WayToEarth**는 “단순 러닝 앱”을 넘어,
**달린 거리 → 가상 여정 진행 → 스탬프/엠블럼 획득 → AI 러닝 분석 → 크루와 함께 달리기**
까지 하나의 경험으로 묶은 **스마트 러닝 플랫폼**입니다.

사용자는 지루한 운동 기록이 아니라
**이야기가 있는 여정, 의미 있는 성취, 함께 달리는 경험**을 얻게 됩니다.

---

#  1. 문제 정의 & 니즈 분석

## AS-IS — 기존 러닝 앱의 한계

* 혼자 뛰면 지루하고 동기부여 부족
* 단순 거리/시간 기록 중심 → 재미 없음
* 소셜 기능·커뮤니티가 약함
* 개인화된 조언 부족

## TO-BE — WayToEarth가 제안하는 해결

* **여정 기반 러닝**: 달린 거리로 가상 코스를 여행
* **스탬프·엠블럼 게임화**로 지속성 확보
* **크루 + 실시간 채팅**으로 동기부여
* **AI 러닝 분석/페이스 코치**로 개인화된 피드백 제공

---

#  2. 주요 기능 요약

### 🏃 러닝 (Real-time Running)


<img src="https://github.com/user-attachments/assets/74d5185b-aec6-49af-9760-2596982f1218" width="600"/>
<p></p>

* GPS 기반 실시간 러닝 추적
* 워치 연동(Wear OS)
* 칼만 필터링으로 GPS 노이즈 제거
* 실시간 페이스/거리/고도/정확도 계산

<br>

### 🗺 여정 & 스탬프 (Journey & Stamp)

<img src="https://github.com/user-attachments/assets/77490a33-b4ca-4c65-ab29-b19bd3a57ed6" width="600"/>

<p></p>
<img width="850" height="341" alt="image" src="https://github.com/user-attachments/assets/8fe84469-97c4-41d4-a79b-54ea3efae6b4" />

<img width="732" height="293" alt="image" src="https://github.com/user-attachments/assets/d65c26e5-9d8c-4e29-bf7f-504d7d31bef2" />


<p></p>

* 실제 거리 → 가상 여정 진행
* Landmark 스토리 확인
* 자동 스탬프 획득
* 방명록 기능



<br><br>

### 💬 크루 & 소셜 (Crew & Social)

<img width="811" height="364" alt="image" src="https://github.com/user-attachments/assets/104525d7-4e2b-4481-a2a3-528d57b04a0f" />
<p></p>

* 크루 생성/가입/관리
* 실시간 채팅(WebSocket)
* 크루 랭킹 & 성장률
* 크루 MVP 자동 선정




<br>

### 🤖 AI 러닝 분석 (AI Coaching)

* GPT 기반 페이스/러닝 분석
* 최근 5회 평균 페이스 기반 코칭
* 요일/거리/패턴 기반 트렌드 분석

<img width="751" height="469" alt="image" src="https://github.com/user-attachments/assets/5afa650a-c03e-40b1-9d42-7fcfbc57c972" />
<img width="841" height="422" alt="image" src="https://github.com/user-attachments/assets/2cac13a5-a995-4640-879b-fa83a3103bf5" />


---

#  3. 서비스 전체 구조

<img width="627" height="732" alt="image" src="https://github.com/user-attachments/assets/195f9192-2901-4991-b67a-70a9a51777cf" />
<p></p>



* **Mobile App (React Native)**
* **Wear OS App (Kotlin)**
* **Backend API (Spring Boot)**
* **OpenAI 기반 AI 분석 서버**
* **AWS 기반 인프라 (EC2 · ALB · RDS · ElastiCache · S3 · CloudFront)**

---

#  4. ☁ 시스템 아키텍처

<img width="1312" height="741" alt="image" src="https://github.com/user-attachments/assets/50a84191-c522-46e4-99a0-9ee88d7f3b92" />
<p></p>

| **사용 기술 / 서비스 (Tech Stack)**        | **사용 이유 (Reason for Use)**                                                                                  |
|---------------------------------------------|------------------------------------------------------------------------------------------------------------------|
| **AWS Route 53**                             | 서비스 도메인(waytoearth.cloud) 관리 및 DNS 라우팅 처리                                                         |
| **AWS Certificate Manager (ACM)**            | SSL/TLS 인증서 발급 관리 및 HTTPS 보안 프로토콜 적용                                                            |
| **Application Load Balancer (ALB)**          | 트래픽 부하 분산 및 Blue/Green 무중단 배포(8080/8081) 환경 구성                                                 |
| **Amazon EC2 + Docker**                      | Spring Boot 애플리케이션의 컨테이너 기반 격리 및 운영                                                            |
| **GitHub Actions**                           | CI/CD 구축 (Docker Build → Hub Push → EC2 자동 배포)                                                            |
| **Amazon RDS (MariaDB, Multi-AZ)**           | 주요 서비스 데이터의 안정적 저장 및 고가용성 확보                                                                |
| **Amazon ElastiCache (Redis)**               | Refresh Token 저장, JWT 블랙리스트 관리, 캐싱, API Rate Limit 처리                                              |
| **Amazon S3**                                | 피드·프로필·방명록 이미지 저장소                                                                                |
| **Amazon CloudFront**                        | 전 세계 엣지 배포 가속화 및 S3 Presigned URL 만료 문제 해결                                                     |
| **Firebase Cloud Messaging (FCM)**           | 러닝 활동·크루 소식·피드 반응 등 실시간 모바일 푸시 알림 전송                                                  |
| **OpenAI GPT-4o-mini**                       | 사용자 러닝 데이터를 기반으로 AI 분석 리포트 생성 및 페이스 코칭 제공                                          |
| **Google Maps API**                          | 러닝 경로 지도 렌더링 및 위치 기반 서비스 제공                                                                   |
| **Kakao OAuth 2.0**                          | 간편 로그인 제공으로 사용자 유입 장벽 감소                                                                      |

## 데이터 흐름
<img width="550" height="580" alt="image" src="https://github.com/user-attachments/assets/4be73589-54b8-44c1-81ca-51f7fdf7f0b7" />
<p></p>



### **1. Client Layer**

* 사용자가 **모바일 앱(App)** 또는 **Wear OS**에서 요청을 보냅니다.


### **2. Network Layer**

* 모든 요청은 **HTTPS** 기반으로 전송됩니다.
* `Route53`이 도메인(**waytoearth.cloud**)을 라우팅합니다.
* `ACM(SSL)`이 인증서를 적용하여 암호화된 통신을 유지합니다.
* 요청은 **ALB(Application Load Balancer)**로 전달됩니다.



### **3. Load Balancing**

* ALB는 서버 상태를 확인하고 트래픽을
  **EC2 Blue(8080) / Green(8081)** 인스턴스 중 하나로 분산합니다.



### **4. Application Layer (EC2)**

* Spring Boot 애플리케이션이 핵심 비즈니스 로직을 처리합니다.
* 데이터 조회/저장, 인증, AI 분석, 크루 기능 처리 등이 이 레이어에서 수행됩니다.



### **5. Data Layer**

* **RDS(MariaDB)**
  → 사용자, 러닝 기록, 크루, 여정, 피드 등 모든 핵심 서비스 데이터 저장
* **ElastiCache(Redis)**
  → Refresh Token, 블랙리스트, 랭킹, 캐싱, 세션 등 빠른 처리와 성능 최적화



### **6. Static File Layer**

* 프로필 이미지, 피드 이미지, 방명록 이미지 등은
  **CloudFront CDN**을 통해 빠르게 전송됩니다.
* 캐시가 없으면 CloudFront가 **S3** 원본에서 파일을 조회합니다.
* 업로드는 Presigned URL 기반으로 클라이언트 → S3 직접 업로드 방식입니다.



### **7. External Services**

* **FCM** → 러닝 알림, 크루 알림, 피드 반응 등 실시간 푸시 메시지 전송
* **OpenAI API** → 러닝 데이터 기반 AI 분석 및 코칭 생성



### **8. Response**

* 모든 처리가 완료되면
  **EC2 → ALB → HTTPS → App** 순으로 사용자에게 응답이 반환됩니다.


<p></p>

---


#  5. 핵심 기능 상세

## 1) 러닝 엔진

* 3초 간격 위치 업데이트
* Kalman 2D 필터로 GPS 오차 보정
* 정지 상태 감지(10초 윈도우)
* 듀얼 컬러 경로 렌더링 (완료/미완료 구간)
* 워치 연동 + Session ID 기반 데이터 통합

## 2) 여정 엔진

* Journey → Route → Landmark 3계층 구조
* Landmark 도달 시 스탬프 자동 지급
* 유니크 스탬프 보장 로직
* 거리 기반 진행률 계산

## 3) 피드 & S3

* Presigned URL로 이미지 업로드
* 피드 삭제 시 S3 이미지 자동 삭제
* 좋아요 낙관적 락 처리

## 4) 크루 시스템

* WebSocket 기반 실시간 채팅
* ConcurrentHashMap으로 세션 관리
* N+1 해결 위한 Fetch Join
* 월간/주간 통계·랭킹

## 5) AI 코칭

* GPT-4o-mini 기반 러닝 분석
* 트렌드 분석
* 페이스 코치

---

#  6. 기술 스택

<img width="768" height="441" alt="image" src="https://github.com/user-attachments/assets/3d99af18-609a-4bb8-9a48-5705a5610943" />
<p></p>

## 📱 Frontend (React Native, Expo)

* React Native + TypeScript
* Expo / EAS Build
* Tanstack Query
* Zustand
* react-native-maps
* Expo-Location
* Firebase FCM
* WebSocket


<br>

## 💽 Backend (Spring Boot)

* Spring Boot 3
* Spring Security (JWT)
* QueryDSL
* JPA & Hibernate
* Redis (Token & Cache)
* S3 / CloudFront
* WebSocket (STOMP)
* Swagger(OpenAPI)

<br>

## ☁ Infra

* AWS EC2 · ALB · RDS · ElastiCache
* S3 / CloudFront
* GitHub Actions CI/CD
* Docker Blue/Green Deploy

---

#  7. ERD 구조

<img width="2092" height="1342" alt="image" src="https://github.com/user-attachments/assets/16a1465c-6e8c-4bc1-8683-44e087c531b1" />

<p></p>



* User 중심의 도메인
* Running, Journey, Crew, Feed 다중 연관
* Emblem/Stamp 체계적 설계
* FeedLike, CrewMember, UserProgress 등 N:M 다수

---

#  8. 디렉터리 구조

## 🔧 Backend Directory

```markdown
📁 WayToEarth_BE/
│
├── 📄 build.gradle                    # Gradle 빌드 설정
├── 📄 settings.gradle
├── 📄 Dockerfile                      # Docker 이미지 빌드
├── 📄 gradlew, gradlew.bat           # Gradle Wrapper
├── 📄 LICENSE                         # Apache 2.0 라이선스
├── 📄 NOTICE                          # 의존성 고지
├── 📄 README.md
├── 📄 .env                            # 환경 변수 (gitignore)
├── 📄 .gitignore
│
├── 📁 .github/                        # GitHub Actions CI/CD
├── 📁 gradle/                         # Gradle wrapper
├── 📁 build/                          # 빌드 결과물 (gitignore)
│
└── 📁 src/
    ├── 📁 main/
    │   ├── 📁 java/com/waytoearth/
    │   │   │
    │   │   ├── 📄 WaytoearthBackendApplication.java  # 메인 클래스
    │   │   │
    │   │   ├── 📁 config/                    # 설정 클래스 모음
    │   │   │   ├── awsS3/
    │   │   │   ├── cache/
    │   │   │   ├── firebase/
    │   │   │   ├── jpa/
    │   │   │   ├── jwt/
    │   │   │   ├── queryDsl/
    │   │   │   ├── redis/
    │   │   │   ├── scheduling/
    │   │   │   ├── security/
    │   │   │   ├── swagger/
    │   │   │   ├── web/
    │   │   │   └── websocket/
    │   │   │
    │   │   ├── 📁 controller/v1/            # REST API (도메인별)
    │   │   │   ├── admin/
    │   │   │   ├── auth/                    # 카카오 로그인
    │   │   │   ├── crew/
    │   │   │   ├── emblem/
    │   │   │   ├── feed/
    │   │   │   ├── file/
    │   │   │   ├── journey/
    │   │   │   ├── notification/
    │   │   │   ├── running/
    │   │   │   ├── statistics/
    │   │   │   ├── user/
    │   │   │   └── weather/
    │   │   │
    │   │   ├── 📁 dto/                      # Request/Response DTO
    │   │   │   ├── request/
    │   │   │   │   ├── auth/
    │   │   │   │   ├── crew/
    │   │   │   │   ├── feed/
    │   │   │   │   ├── file/
    │   │   │   │   ├── journey/
    │   │   │   │   ├── notification/
    │   │   │   │   ├── running/
    │   │   │   │   │   └── ai/
    │   │   │   │   └── user/
    │   │   │   │
    │   │   │   ├── response/
    │   │   │   │   ├── auth/
    │   │   │   │   ├── common/
    │   │   │   │   ├── crew/
    │   │   │   │   ├── emblem/
    │   │   │   │   ├── feed/
    │   │   │   │   ├── file/
    │   │   │   │   ├── journey/
    │   │   │   │   ├── notification/
    │   │   │   │   ├── running/
    │   │   │   │   │   └── ai/
    │   │   │   │   ├── statistics/
    │   │   │   │   ├── user/
    │   │   │   │   └── weather/
    │   │   │
    │   │   ├── 📁 entity/                   # JPA 엔티티 (도메인별)
    │   │   │   ├── auth/
    │   │   │   ├── common/
    │   │   │   ├── crew/
    │   │   │   ├── emblem/
    │   │   │   ├── enums/
    │   │   │   ├── feed/
    │   │   │   ├── journey/
    │   │   │   ├── notification/
    │   │   │   ├── running/
    │   │   │   └── user/
    │   │   │
    │   │   ├── 📁 repository/
    │   │   │   ├── auth/
    │   │   │   ├── crew/
    │   │   │   ├── emblem/
    │   │   │   ├── feed/
    │   │   │   ├── journey/
    │   │   │   ├── notification/
    │   │   │   ├── running/
    │   │   │   ├── statistics/
    │   │   │   └── user/
    │   │   │
    │   │   ├── 📁 service/
    │   │   │   ├── ai/
    │   │   │   ├── auth/
    │   │   │   ├── crew/
    │   │   │   ├── emblem/
    │   │   │   ├── feed/
    │   │   │   ├── file/
    │   │   │   ├── journey/
    │   │   │   ├── notification/
    │   │   │   ├── ranking/
    │   │   │   ├── ratelimit/
    │   │   │   ├── running/
    │   │   │   ├── statistics/
    │   │   │   ├── user/
    │   │   │   └── weather/
    │   │   │
    │   │   ├── 📁 security/
    │   │   │   ├── JwtAuthenticationFilter.java
    │   │   │   ├── JwtTokenProvider.java
    │   │   │   ├── AuthUserArgumentResolver.java
    │   │   │   └── mock/
    │   │   │
    │   │   ├── 📁 exception/
    │   │   ├── 📁 validation/
    │   │   ├── 📁 util/
    │   │   └── 📁 websocket/
    │   │
    │   └── 📁 resources/
    │       ├── application.yml
    │       ├── application-dev.yml
    │       ├── application-prod.yml
    │       ├── 📁 db/migration/
    │       └── 📁 firebase/
    │
    └── 📁 test/
        └── 📁 java/com/waytoearth/

```

> 백엔드 전체 구조 상세 (config, controller, DTO, entity, service 등)


<p></p>

## 📱 Frontend Directory

```markdown
📁 WayToEarth_FE/
│
├── App.tsx                    # 앱 진입점
├── assets/                    # 이미지, 폰트
├── contexts/                  # 전역 컨텍스트 (Auth, Weather 등)
├── hooks/                     # 커스텀 훅
├── utils/                     # API 클라이언트, 공용 유틸
├── types/                     # TypeScript 타입 정의
├── navigation/                # 네비게이션 설정
├── styles/                    # 글로벌 스타일
├── scripts/                   # 빌드/유틸 스크립트
├── android/                   # Android 네이티브 구성
│
└── src/
    ├── app/
    │   ├── layout/            # 상단바/하단바 레이아웃
    │   └── screens/           # Main.tsx 등 주요 화면
    │
    └── features/              # 기능 중심 폴더링 (핵심)
        ├── auth/              # 로그인/회원가입
        ├── onboarding/        # 온보딩
        ├── crew/              # 크루 기능
        ├── running/           # 러닝 트래킹
        ├── journey/           # 여정/테마
        ├── landmark/          # 랜드마크/스탬프
        ├── feed/              # 피드
        ├── guestbook/         # 방명록
        ├── records/           # 러닝 기록/통계
        └── profile/           # 프로필/내 계정
```

---


#  9. API 명세


<img src="https://github.com/user-attachments/assets/efe4a1ca-31f4-43c5-8965-09c44e7d7005" width="450"/>

<p></p>



#  10. Team

|BE | Full Stack | FE |
| :---: | :---: | :---: |
| 홍성민(팀장) | 이평강 | 정진호 |
|  <img width="130px" src="https://github.com/user-attachments/assets/4bffbd92-a458-4f8e-99ea-292ec5860b27" /> |  <img width="130px" src="" /> |   <img src="https://github.com/user-attachments/assets/4636c270-72ba-4c50-9e1d-f3cd06f9d8e0" width="130" alt="정진호 증명사진" /> 
|
| 한림대학교 | 한림대학교 | 한림대학교|
| 빅데이터전공 4학년 | 빅데이터전공 4학년 | 콘텐츠IT전공 3학년|
| [@hskhsmm](https://github.com/hskhsmm)|[@leepg038292](https://github.com/leepg038292)|[@wjdwlsgh](https://github.com/wjdwlsgh)

---

#  11. License

본 프로젝트는 **Apache License 2.0**을 따릅니다.

```
Copyright 2025 WayToEarth

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
```

---

#  12. 결론

WayToEarth는
러닝 · 여정 · 커뮤니티 · AI를 결합한 **새로운 형태의 러닝 플랫폼**입니다.

우리는 단순 운동 관리가 아니라
**러닝을 하나의 여정으로 만드는 경험**을 만들고자 합니다.

앞으로도 더 확장성과 안정성 있는 서비스로 발전할 예정입니다.

---


# 프로젝트 시연 영상

### 아래의 이미지를 클릭하면 시연 영상을 확인할 수 있습니다. 
[![Video Label](http://img.youtube.com/vi/e45tMPZ9_9M/0.jpg)](https://youtu.be/e45tMPZ9_9M)



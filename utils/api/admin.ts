import { client } from "@utils/api/client";
import * as FileSystem from "expo-file-system";

type PresignResponse = {
  upload_url: string;
  download_url: string;
  key: string;
  expires_in?: number;
};

export async function presignLandmarkImage(params: {
  journeyId: number | string;
  landmarkId: number | string;
  contentType: string;
  size: number;
}): Promise<PresignResponse> {
  const { journeyId, landmarkId, contentType, size } = params;
  const { data } = await client.post(
    `/v1/admin/landmarks/${journeyId}/${landmarkId}/image/presign`,
    { contentType, size }
  );
  return (data?.data ?? data) as PresignResponse;
}

export async function presignStoryImage(params: {
  journeyId: number | string;
  landmarkId: number | string;
  storyId: number | string;
  contentType: string;
  size: number;
}): Promise<PresignResponse> {
  const { journeyId, landmarkId, storyId, contentType, size } = params;
  const { data } = await client.post(
    `/v1/admin/story-cards/${journeyId}/${landmarkId}/${storyId}/image/presign`,
    { contentType, size }
  );
  return (data?.data ?? data) as PresignResponse;
}

export async function updateLandmarkImage(landmarkId: number | string, imageUrl: string) {
  // Some backends may expect PUT/PATCH with body { imageUrl }
  await client.put(`/v1/admin/landmarks/${landmarkId}`, { imageUrl });
}

export async function updateStoryImage(storyId: number | string, imageUrl: string) {
  await client.put(`/v1/admin/story-cards/${storyId}`, { imageUrl });
}

export async function uploadToS3(uploadUrl: string, fileUri: string, contentType: string) {
  const info = await FileSystem.getInfoAsync(fileUri);
  if (!info.exists || info.isDirectory) {
    throw new Error("로컬 파일을 찾을 수 없습니다.");
  }
  const res = await FileSystem.uploadAsync(uploadUrl, fileUri, {
    httpMethod: "PUT",
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-cache, no-store, must-revalidate", // 백엔드 서명에 포함된 헤더
      ...(typeof info.size === "number" ? { "Content-Length": String(info.size) } : {}),
    },
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  });
  if (!(res.status === 200 || res.status === 204)) {
    throw new Error(`S3 업로드 실패: ${res.status}`);
  }
}

export function guessImageMime(uriOrName: string): string {
  const name = (uriOrName.split("/").pop() || uriOrName).toLowerCase();
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

// ========== 스토리 CRUD API ==========

export type StoryType = 'HISTORY' | 'CULTURE' | 'NATURE';

export type StoryCardCreateRequest = {
  landmarkId: number;
  title: string;
  content: string;
  imageUrl?: string;
  type: StoryType;
  orderIndex: number;
};

export type StoryCardUpdateRequest = {
  title?: string;
  content?: string;
  imageUrl?: string;
  type?: StoryType;
  orderIndex?: number;
};

export type StoryCardResponse = {
  id: number;
  title: string;
  content: string;
  imageUrl?: string;
  type: StoryType;
  orderIndex: number;
};

// 스토리 생성
export async function createStoryCard(data: StoryCardCreateRequest): Promise<StoryCardResponse> {
  const res = await client.post('/v1/admin/story-cards', data);
  return (res.data?.data ?? res.data) as StoryCardResponse;
}

// 스토리 수정
export async function updateStoryCard(storyId: number, data: StoryCardUpdateRequest): Promise<StoryCardResponse> {
  const res = await client.put(`/v1/admin/story-cards/${storyId}`, data);
  return (res.data?.data ?? res.data) as StoryCardResponse;
}

// 스토리 삭제
export async function deleteStoryCard(storyId: number): Promise<void> {
  await client.delete(`/v1/admin/story-cards/${storyId}`);
}

// ========== 랜드마크 갤러리 관리 ==========

// 랜드마크 갤러리 이미지 추가
// TODO: 백엔드 API가 journeyId를 받도록 수정되면 경로를 /v1/admin/landmarks/${journeyId}/${landmarkId}/images로 변경
export async function addLandmarkGalleryImage(
  landmarkId: number | string,
  imageUrl: string
): Promise<any> {
  console.log('[API] 갤러리 이미지 추가:', { landmarkId, imageUrl });
  const response = await client.post(`/v1/admin/landmarks/${landmarkId}/images`, { imageUrl });
  console.log('[API] 갤러리 이미지 추가 응답:', response.data);
  return response.data?.data ?? response.data;
}

// 랜드마크 갤러리 이미지 삭제
// TODO: 백엔드 API가 journeyId를 받도록 수정되면 경로를 /v1/admin/landmarks/${journeyId}/images/${imageId}로 변경
export async function deleteLandmarkGalleryImage(imageId: number | string): Promise<void> {
  console.log('[API] 갤러리 이미지 삭제:', { imageId });
  await client.delete(`/v1/admin/landmarks/images/${imageId}`);
}

// 랜드마크 갤러리 이미지 순서 변경
// TODO: 백엔드 API가 journeyId를 받도록 수정되면 경로를 /v1/admin/landmarks/${journeyId}/${landmarkId}/images/reorder로 변경
export async function reorderLandmarkGalleryImages(
  landmarkId: number | string,
  imageIds: number[]
): Promise<void> {
  console.log('[API] 갤러리 순서 변경:', { landmarkId, imageIds });
  await client.patch(`/v1/admin/landmarks/${landmarkId}/images/reorder`, { imageIds });
}

// ========== 스토리카드 갤러리 관리 ==========

// 스토리카드 갤러리 이미지 추가
// TODO: 백엔드 API가 journeyId를 받도록 수정되면 경로 변경
export async function addStoryGalleryImage(storyId: number | string, imageUrl: string): Promise<any> {
  console.log('[API] 스토리 갤러리 이미지 추가:', { storyId, imageUrl });
  const response = await client.post(`/v1/admin/story-cards/${storyId}/images`, { imageUrl });
  console.log('[API] 스토리 갤러리 이미지 추가 응답:', response.data);
  return response.data?.data ?? response.data;
}

// 스토리카드 갤러리 이미지 삭제
// TODO: 백엔드 API가 journeyId를 받도록 수정되면 경로 변경
export async function deleteStoryGalleryImage(imageId: number | string): Promise<void> {
  console.log('[API] 스토리 갤러리 이미지 삭제:', { imageId });
  await client.delete(`/v1/admin/story-cards/images/${imageId}`);
}

// 스토리카드 갤러리 이미지 순서 변경
// TODO: 백엔드 API가 journeyId를 받도록 수정되면 경로 변경
export async function reorderStoryGalleryImages(
  storyId: number | string,
  imageIds: number[]
): Promise<void> {
  console.log('[API] 스토리 갤러리 순서 변경:', { storyId, imageIds });
  await client.patch(`/v1/admin/story-cards/${storyId}/images/reorder`, { imageIds });
}

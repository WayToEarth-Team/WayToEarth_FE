import { client } from "./client";
import * as FileSystem from "expo-file-system";

export type FeedItem = {
  id: number;
  content: string;
  imageUrl?: string | null;
  likeCount: number;
  liked: boolean;
  nickname?: string;
  distance?: number;
  createdAt?: string; // ISO 8601 timestamp from backend
  // author avatar (backend may use different keys)
  profile_image_url?: string | null;
  profileImageUrl?: string | null;
  author?: {
    nickname?: string;
    profile_image_url?: string | null;
    profileImageUrl?: string | null;
  } | null;
};

export type CreateFeedPayload = {
  runningRecordId: number | string; // 서버가 만든 실제 id
  content?: string;
  photoUrl?: string | null; // file:///... 또는 https://...
};

const guessMime = (nameOrUri: string) => {
  const ext = (nameOrUri.split(".").pop() || "").toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
};

// presign → S3 PUT → download_url/key 반환(Swagger 기준)
async function ensureRemoteObject(
  localOrRemote?: string | null
): Promise<{ url: string; key?: string } | null> {
  if (!localOrRemote) return null;
  if (/^https?:\/\//i.test(localOrRemote)) return { url: localOrRemote };

  // 로컬 경로 정규화: 절대경로("/var/...") → "file:///var/..."
  let fileUri = localOrRemote;
  if (!/^file:\/\//i.test(fileUri) && fileUri.startsWith("/")) {
    fileUri = `file://${fileUri}`;
  }

  const fileName = (fileUri.split("/").pop() || "feed.jpg").split("?")[0];
  const contentType = guessMime(fileName);
  const info = await FileSystem.getInfoAsync(fileUri);
  if (!info.exists || info.isDirectory) {
    throw new Error(
      `이미지 파일을 열 수 없습니다. 다른 이미지를 선택하거나 갤러리에서 다시 선택해주세요. (uri=${localOrRemote})`
    );
  }
  const size = typeof (info as any).size === "number" ? (info as any).size : 0;
  if (size <= 0) throw new Error("파일 크기를 확인할 수 없습니다.");

  // 1) presign (Swagger: upload_url, download_url, key)
  const { data: sign } = await client.post("/v1/files/presign/feed", {
    fileName,
    contentType,
    size,
  });

  const signedUrl =
    sign?.upload_url ?? sign?.signed_url ?? sign?.uploadUrl ?? sign?.signedUrl;
  const downloadUrl =
    sign?.download_url ?? sign?.public_url ?? sign?.downloadUrl ?? sign?.publicUrl;
  const key = sign?.key;
  if (!signedUrl || !downloadUrl) throw new Error("업로드 URL 발급 실패");

  // 2) S3 업로드
  const resUpload = await FileSystem.uploadAsync(signedUrl, fileUri, {
    httpMethod: "PUT",
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(size),
    },
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  });
  if (!(resUpload.status === 200 || resUpload.status === 204)) {
    throw new Error(`S3 업로드 실패: ${resUpload.status}`);
  }

  return { url: downloadUrl as string, key: key as string | undefined };
}

export async function createFeed(
  payload: CreateFeedPayload
): Promise<FeedItem> {
  // 서버가 만든 진짜 record id만 허용
  const n = Number(payload.runningRecordId);
  if (!Number.isFinite(n)) {
    throw new Error("유효하지 않은 runningRecordId 입니다.");
  }

  const remote = await ensureRemoteObject(payload.photoUrl);

  const body: Record<string, any> = {
    runningRecordId: n, // 백엔드 DTO가 기대하는 이름/타입
    content: payload.content ?? "",
    imageUrl: remote?.url ?? null,
  };
  if (remote?.key) body.imageKey = remote.key; // Swagger에 imageKey가 존재하는 경우 포함

  const { data } = await client.post("/v1/feeds", body); // JWT는 client 인터셉터로 자동 첨부
  return data as FeedItem;
}

export async function listFeeds(offset = 0, limit = 4): Promise<FeedItem[]> {
  const { data } = await client.get("/v1/feeds", { params: { offset, limit } });
  console.log('[FEEDS] First feed item:', JSON.stringify(data?.[0], null, 2));
  return Array.isArray(data) ? (data as FeedItem[]) : [];
}

export async function toggleFeedLike(
  feedId: number
): Promise<{ feedId?: number; likeCount: number; liked: boolean }> {
  const { data } = await client.post(`/v1/feeds/${feedId}/like`);
  const res = (data as any) || {};
  return {
    feedId: res.feedId ?? feedId,
    likeCount: res.likeCount,
    liked: res.liked,
  };
}

export async function deleteFeed(feedId: number): Promise<void> {
  await client.delete(`/v1/feeds/${feedId}`);
}

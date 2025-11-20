import { client } from "@utils/api/client";

export type MyCrewItem = {
  id: number;
  name: string;
  description: string;
  maxMembers: number;
  currentMembers: number;
  profileImageUrl?: string;
  ownerNickname?: string;
  createdAt?: string;
  canJoin?: boolean;
};

export type PageMeta = {
  pageNumber: number;
  pageSize: number;
};

export type MyCrewsResponse = {
  content: MyCrewItem[];
  pageable: PageMeta;
  totalElements: number;
  totalPages: number;
  last: boolean;
  first: boolean;
};

export const crewAPI = {
  getMyCrews: async (page = 0, size = 20): Promise<MyCrewsResponse> => {
    const res = await client.get(`/v1/crews/my`, { params: { page, size } });
    return res.data as MyCrewsResponse;
  },
};

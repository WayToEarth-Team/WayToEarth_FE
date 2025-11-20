import { client } from "@utils/api/client";

export async function getCurrentWeather(lat: number, lon: number) {
  const response = await client.get("/v1/weather/current", {
    params: { lat, lon }
  });
  // client.ts 인터셉터가 이미 { success, data, message }에서 data를 언래핑함
  return response.data;
}

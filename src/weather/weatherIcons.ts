import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun } from "lucide-react";

export const getWeatherIcon = (weatherCode: number) => {
  if (weatherCode === 0) return Sun;
  if (weatherCode === 1 || weatherCode === 2) return CloudSun;
  if (weatherCode === 3) return Cloud;
  if (weatherCode === 45 || weatherCode === 48) return CloudFog;
  if ((weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82)) return CloudRain;
  if ((weatherCode >= 71 && weatherCode <= 77) || weatherCode === 85 || weatherCode === 86) return CloudSnow;
  if (weatherCode >= 95 && weatherCode <= 99) return CloudLightning;
  return CloudSun;
};

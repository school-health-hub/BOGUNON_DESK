import type { WeatherState } from '../../../src/weather/types';
export const useWeatherData = () => ({state:{status:'signedOut'} as WeatherState,refresh:()=>{}});

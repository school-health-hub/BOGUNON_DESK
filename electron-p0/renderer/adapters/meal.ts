import type { MealState } from '../../../src/meal/types';
export const useMealData = () => ({state:{status:'signedOut'} as MealState,refresh:()=>{}});

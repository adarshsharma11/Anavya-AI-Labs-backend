import { findActivePlans, findPlanById } from "./pricing.repository";

const transformPrice = (plan: any) => {
  return {
    ...plan,
    price: plan.price / 100,
    compareAtPrice: plan.compareAtPrice
      ? plan.compareAtPrice / 100
      : null,
    hasDiscount: !!plan.discountPercent,
  };
};

export const getPublicPlansService = async () => {
  const data = await findActivePlans();
  return data.map(transformPrice);
};

export const getSinglePlanService = async (id: number) => {
  const plan = await findPlanById(id);
  if (!plan) throw new Error("Plan not found");
  return transformPrice(plan);
};

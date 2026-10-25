import { findActivePlans, findPlanById } from "./pricing.repository.js";
import { priceForRegion } from "../../lib/paymentConfig.js";
import { getUsdToInrRate } from "../../lib/fx.js";

type PlanRow = Awaited<ReturnType<typeof findPlanById>> & {};

const transformPrice = (plan: PlanRow, usdToInrRate: number) => {
  const usd = plan.price / 100;
  return {
    ...plan,
    price: usd,
    compareAtPrice: plan.compareAtPrice ? plan.compareAtPrice / 100 : null,
    hasDiscount: !!plan.discountPercent,
    prices: {
      USD: priceForRegion(usd, "INTL", usdToInrRate),
      INR: priceForRegion(usd, "IN", usdToInrRate),
    },
  };
};

export const getPublicPlansService = async () => {
  const [data, rate] = await Promise.all([findActivePlans(), getUsdToInrRate()]);
  return data.map((plan) => transformPrice(plan, rate));
};

export const getSinglePlanService = async (id: number) => {
  const plan = await findPlanById(id);
  if (!plan || !plan.active) throw new Error("Plan not found");
  return transformPrice(plan, await getUsdToInrRate());
};

import type { Context } from "hono";
import { getPublicPlansService, getSinglePlanService } from "./pricing.service";

export const getPublicPlans = async (c: Context) => {
  try {
    const data = await getPublicPlansService();
    return c.json({
      success: true,
      data,
    });
  } catch (e: any) {
    return c.json(
      { success: false, message: e.message },
      500
    );
  }
};

export const getSinglePlan = async (c: Context) => {
  try {
    const id = Number(c.req.param("id"));
    const data = await getSinglePlanService(id);

    return c.json({
      success: true,
      data,
    });
  } catch (e: any) {
    return c.json(
      { success: false, message: e.message },
      404
    );
  }
};

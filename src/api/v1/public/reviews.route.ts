import { Hono } from "hono";
import { getPublicReviews, submitReview } from "../../../modules/reviews/reviews.controller.js";
import { optionalVerifyToken } from "../../../middlewares/auth.middleware.js";

const reviewsRoute = new Hono();

reviewsRoute.get("/reviews", getPublicReviews);
reviewsRoute.post("/reviews", optionalVerifyToken, submitReview);

export default reviewsRoute;

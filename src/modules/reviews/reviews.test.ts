import { describe, expect, test } from "bun:test";
import { isSpamSubmission, parseReviewStatus, ReviewError, validateReview } from "./reviews.service.js";

const valid = { name: "Priya Sharma", roleCompany: "Founder, Acme", email: "Priya@Acme.com", review: "The audit showed exactly what to fix." };

describe("validateReview", () => {
  test("accepts a valid review and normalises fields", () => {
    expect(validateReview(valid)).toEqual({
      name: "Priya Sharma",
      roleCompany: "Founder, Acme",
      email: "priya@acme.com",
      review: "The audit showed exactly what to fix.",
    });
  });

  test("optional fields may be blank", () => {
    const result = validateReview({ name: "Raj", review: "Great tool, very clear results." });
    expect(result.roleCompany).toBeNull();
    expect(result.email).toBeNull();
  });

  test("strips HTML before checking length", () => {
    expect(validateReview({ ...valid, review: "<b>Helpful</b> <script>x</script>report overall" }).review).toBe("Helpful xreport overall");
    expect(() => validateReview({ ...valid, review: "<p>short</p>" })).toThrow(ReviewError);
  });

  test("reports which field is invalid", () => {
    const fieldOf = (input: object) => {
      try {
        validateReview(input);
      } catch (err) {
        return (err as ReviewError).field;
      }
    };
    expect(fieldOf({ ...valid, name: "A" })).toBe("name");
    expect(fieldOf({ ...valid, email: "not-an-email" })).toBe("email");
    expect(fieldOf({ ...valid, roleCompany: "x".repeat(121) })).toBe("roleCompany");
    expect(fieldOf({ ...valid, review: "x".repeat(2001) })).toBe("review");
  });
});

describe("helpers", () => {
  test("honeypot flags bots only when filled", () => {
    expect(isSpamSubmission({ website: "http://spam" })).toBe(true);
    expect(isSpamSubmission({ website: "" })).toBe(false);
    expect(isSpamSubmission({})).toBe(false);
  });

  test("parses only known statuses", () => {
    expect(parseReviewStatus("approved")).toBe("approved");
    expect(parseReviewStatus("published")).toBeUndefined();
  });
});

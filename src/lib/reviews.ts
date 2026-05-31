// Talleo — post-delivery reviews domain logic. Customers leave a 1–5 rating
// (with optional comment) from the guest view once their order is delivered.
// Each review emits a `resena` notification to the shop. All access goes
// through reviewsRepo; everything is local & simulated.

import type { Review } from "@/types";
import { reviewsRepo, customersRepo } from "@/lib/db";
import { notify } from "@/lib/notifications";

export interface ReviewInput {
  orderId: string;
  customerId: string;
  vehicleId: string;
  rating: number; // 1–5
  comment?: string;
}

/**
 * Create a review for an order (clamps rating to 1–5) and emit a `resena`
 * notification to the shop linking back to the reviews list.
 */
export function createReview(tenantId: string, input: ReviewInput): Review {
  const rating = Math.max(1, Math.min(5, Math.round(input.rating)));
  const review = reviewsRepo.create(tenantId, {
    tenantId,
    orderId: input.orderId,
    customerId: input.customerId,
    vehicleId: input.vehicleId,
    rating,
    comment: input.comment?.trim() || undefined,
    createdAt: new Date().toISOString(),
  } as Omit<Review, "id">);

  const customer = customersRepo.getById(tenantId, input.customerId);
  notify(tenantId, {
    type: "resena",
    title: "Nueva reseña",
    body: `${customer?.name ?? "Un cliente"} valoró su orden con ${rating}/5 estrellas.`,
    link: "/app/resenas",
  });

  return review;
}

/** All reviews for a tenant, newest first. */
export function listReviews(tenantId: string): Review[] {
  return reviewsRepo
    .list(tenantId)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The review for a given order, if any. */
export function getReviewByOrderId(
  tenantId: string,
  orderId: string,
): Review | undefined {
  return reviewsRepo.list(tenantId).find((r) => r.orderId === orderId);
}

/** Average rating for a tenant (0 when there are no reviews). */
export function averageRating(tenantId: string): number {
  const reviews = reviewsRepo.list(tenantId);
  if (reviews.length === 0) return 0;
  const sum = reviews.reduce((s, r) => s + r.rating, 0);
  return sum / reviews.length;
}

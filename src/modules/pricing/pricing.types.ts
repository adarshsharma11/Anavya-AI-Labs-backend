export interface PricingDTO {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  compareAtPrice?: number | null;
  discountPercent?: number | null;
  type: string;
  interval?: string | null;
  scanLimit?: number | null;
  badge?: string | null;
  isHighlighted?: boolean | null;
}

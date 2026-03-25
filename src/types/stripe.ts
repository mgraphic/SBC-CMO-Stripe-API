// Re-export official Stripe SDK types used throughout the app.
import type Stripe from 'stripe';

export type { Stripe };

export type StripeProduct = Stripe.Product;
export type StripePrice = Stripe.Price;
export type StripeLineItem = Stripe.LineItem;
export type StripeCheckoutSession = Stripe.Checkout.Session;
export type StripeListResponse<T> = Stripe.ApiList<T>;
export type CreateCheckoutSessionParams = Stripe.Checkout.SessionCreateParams;
export type CheckoutLineItemParam =
    Stripe.Checkout.SessionCreateParams.LineItem;

// Convenience error shape (not a first-class Stripe SDK type).
export interface StripeErrorResponse {
    error: {
        type: string;
        code?: string;
        message: string;
        param?: string;
    };
}

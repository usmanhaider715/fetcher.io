import Stripe from 'stripe';
import { config } from '../config/index.js';
import { Organization } from '../models/index.js';
import { applyPlanLimits, type PlanId } from '../config/plans.js';

export class StripeService {
  private stripe: Stripe | null = null;

  private get client(): Stripe {
    if (!this.stripe) {
      if (!config.stripe.secretKey) throw new Error('Stripe not configured');
      this.stripe = new Stripe(config.stripe.secretKey);
    }
    return this.stripe;
  }

  async createCheckoutSession(orgId: string, priceId: string, customerEmail: string) {
    const session = await this.client.checkout.sessions.create({
      mode: 'subscription',
      customer_email: customerEmail,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${config.webUrl}/dashboard/billing?success=1`,
      cancel_url: `${config.webUrl}/dashboard/billing?cancelled=1`,
      metadata: { organizationId: orgId },
    });
    return { url: session.url, sessionId: session.id };
  }

  async createPortalSession(customerId: string) {
    const session = await this.client.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${config.webUrl}/dashboard/billing`,
    });
    return { url: session.url };
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    if (!config.stripe.webhookSecret) throw new Error('Webhook secret not configured');

    const event = this.client.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.['organizationId'];
        if (!orgId) break;

        const priceId = session.line_items?.data?.[0]?.price?.id ?? session.metadata?.['priceId'];
        const plan = this.planFromPriceId(priceId ?? '');

        await Organization.findByIdAndUpdate(orgId, {
          plan,
          stripeSubscriptionId: session.subscription as string,
          stripePriceId: priceId,
          ...applyPlanLimits(plan),
        });
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await Organization.findOneAndUpdate(
          { stripeSubscriptionId: sub.id },
          { plan: 'free', stripeSubscriptionId: null, ...applyPlanLimits('free') },
        );
        break;
      }
    }

    return { received: true };
  }

  planFromPriceId(priceId: string): PlanId {
    if (priceId === config.stripe.prices.starter) return 'starter';
    if (priceId === config.stripe.prices.pro) return 'pro';
    if (priceId === config.stripe.prices.team) return 'team';
    return 'free';
  }
}

export const stripeService = new StripeService();

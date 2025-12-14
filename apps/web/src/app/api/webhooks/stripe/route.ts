import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createServerPocketBase, Collections } from '@/lib/pocketbase';
import type Stripe from 'stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const pb = createServerPocketBase();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(pb, session);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(pb, subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(pb, subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(pb, invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(pb, invoice);
        break;
      }

      default:
        console.log(`Unhandled webhook event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handleCheckoutComplete(
  pb: ReturnType<typeof createServerPocketBase>,
  session: Stripe.Checkout.Session
) {
  const userId = session.metadata?.userId;
  if (!userId) {
    console.error('No userId in checkout session metadata');
    return;
  }

  // Update user's stripe customer ID
  await pb.collection(Collections.users).update(userId, {
    stripeCustomerId: session.customer as string,
  });

  // Create subscription record
  const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

  await pb.collection(Collections.subscriptions).create({
    user: userId,
    plan: getPlanFromPriceId(subscription.items.data[0]?.price.id),
    status: 'active',
    stripeSubscriptionId: subscription.id,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
  });
}

async function handleSubscriptionUpdate(
  pb: ReturnType<typeof createServerPocketBase>,
  subscription: Stripe.Subscription
) {
  const records = await pb.collection(Collections.subscriptions).getList(1, 1, {
    filter: `stripeSubscriptionId = "${subscription.id}"`,
  });

  if (records.items.length === 0) return;

  await pb.collection(Collections.subscriptions).update(records.items[0]!.id, {
    status: subscription.status === 'active' ? 'active' : 'past_due',
    currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
    plan: getPlanFromPriceId(subscription.items.data[0]?.price.id),
  });
}

async function handleSubscriptionCanceled(
  pb: ReturnType<typeof createServerPocketBase>,
  subscription: Stripe.Subscription
) {
  const records = await pb.collection(Collections.subscriptions).getList(1, 1, {
    filter: `stripeSubscriptionId = "${subscription.id}"`,
  });

  if (records.items.length === 0) return;

  await pb.collection(Collections.subscriptions).update(records.items[0]!.id, {
    status: 'canceled',
  });
}

async function handlePaymentSucceeded(
  pb: ReturnType<typeof createServerPocketBase>,
  invoice: Stripe.Invoice
) {
  console.log('Payment succeeded for invoice:', invoice.id);
  // Could send confirmation email, update UI, etc.
}

async function handlePaymentFailed(
  pb: ReturnType<typeof createServerPocketBase>,
  invoice: Stripe.Invoice
) {
  console.log('Payment failed for invoice:', invoice.id);
  // Could send failure notification, retry logic, etc.
}

function getPlanFromPriceId(priceId: string | undefined): string {
  if (!priceId) return 'free';

  if (priceId === process.env.STRIPE_PRICE_STARTER) return 'starter';
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro';

  return 'free';
}

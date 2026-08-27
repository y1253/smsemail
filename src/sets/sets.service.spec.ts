import { SetsService } from './sets.service';
import { BillingService } from '../billing/billing.service';

const mockStripe = {
  subscriptions: { cancel: jest.fn().mockResolvedValue(undefined) },
};

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => mockStripe),
}));

const HOUR = 60 * 60 * 1000;
const nowSec = () => Math.floor(Date.now() / 1000);
const past = () => nowSec() - 24 * 60 * 60;
const future = () => nowSec() + 24 * 60 * 60;

/** A Stripe subscription shaped the way the 20.x API returns it. */
function stripeSub(overrides: Record<string, any> = {}): any {
  return {
    id: 'sub_1',
    status: 'active',
    cancel_at: null,
    cancel_at_period_end: false,
    items: {
      data: [
        {
          current_period_end: future(),
          price: { unit_amount: 1000, currency: 'usd', recurring: { interval: 'month' } },
        },
      ],
    },
    ...overrides,
  };
}

function makeSet(overrides: Record<string, any> = {}): any {
  return {
    setId: 1,
    stripeSubscriptionId: 'sub_1',
    deletedAt: null,
    pendingCancelAt: null,
    email: { emailId: 7, refreshToken: 'enc' },
    phone: { phoneId: 3, phone: '15550001111', optedOutAt: null },
    ...overrides,
  };
}

function makeHarness(
  sets: any[],
  subs: Map<string, any> = new Map(),
  listError: string | null = null,
) {
  const setRepo = {
    find: jest.fn().mockResolvedValue(sets),
    save: jest.fn(async (s: any) => s),
    // No sibling set on the mailbox unless a test says otherwise.
    count: jest.fn().mockResolvedValue(0),
  };
  const signalwireService = { sendSms: jest.fn().mockResolvedValue(undefined) };
  const gmailService = { unwatchGmail: jest.fn().mockResolvedValue(undefined) };
  const emailsService = { decrypt: jest.fn(() => 'refresh-token') };
  const billing = {
    loadAllStripeSubscriptions: jest.fn().mockResolvedValue({ subs, error: listError }),
    // The real derivation — it is a pure function of (sub, set).
    describeSubscription: BillingService.prototype.describeSubscription,
  };
  const config = {
    get: jest.fn((key: string) => (key === 'STRIPE_TEST_KEY' ? 'sk_test_x' : undefined)),
  };

  const service = new SetsService(
    {} as any,
    {} as any,
    {} as any,
    setRepo as any,
    {} as any,
    config as any,
    emailsService as any,
    gmailService as any,
    signalwireService as any,
    billing as any,
  );

  return { service, setRepo, signalwireService, gmailService, billing };
}

describe('SetsService.reconcileSubscriptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ends a set whose Stripe subscription is already canceled, without re-cancelling it', async () => {
    const set = makeSet({ pendingCancelAt: new Date(Date.now() - HOUR) });
    const { service, setRepo, signalwireService } = makeHarness(
      [set],
      new Map([['sub_1', stripeSub({ status: 'canceled' })]]),
    );

    await service.reconcileSubscriptions();

    expect(set.deletedAt).toBeInstanceOf(Date);
    expect(set.pendingCancelAt).toBeNull();
    expect(setRepo.save).toHaveBeenCalledWith(set);
    expect(mockStripe.subscriptions.cancel).not.toHaveBeenCalled();
    expect(signalwireService.sendSms).toHaveBeenCalledWith(
      '15550001111',
      expect.stringContaining('cancelled'),
    );
  });

  it.each(['unpaid', 'incomplete_expired'])('ends a set whose subscription is %s', async (status) => {
    const set = makeSet();
    const { service } = makeHarness([set], new Map([['sub_1', stripeSub({ status })]]));

    await service.reconcileSubscriptions();

    expect(set.deletedAt).toBeInstanceOf(Date);
  });

  it('leaves a past_due set alone — Stripe is still retrying the charge', async () => {
    const set = makeSet();
    const { service } = makeHarness([set], new Map([['sub_1', stripeSub({ status: 'past_due' })]]));

    await service.reconcileSubscriptions();

    expect(set.deletedAt).toBeNull();
  });

  it('ends a pending-cancel set once its end date has passed', async () => {
    const set = makeSet({ pendingCancelAt: new Date(Date.now() - HOUR) });
    const { service } = makeHarness(
      [set],
      new Map([['sub_1', stripeSub({ cancel_at_period_end: true, cancel_at: past() })]]),
    );

    await service.reconcileSubscriptions();

    expect(set.deletedAt).toBeInstanceOf(Date);
    // Stripe still says active here, so the subscription does need cancelling.
    expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith('sub_1');
  });

  it('keeps a pending-cancel set alive inside the paid period and syncs the date', async () => {
    const cancelAt = future();
    const set = makeSet({ pendingCancelAt: null });
    const { service, setRepo } = makeHarness(
      [set],
      new Map([['sub_1', stripeSub({ cancel_at_period_end: true, cancel_at: cancelAt })]]),
    );

    await service.reconcileSubscriptions();

    expect(set.deletedAt).toBeNull();
    expect(set.pendingCancelAt).toEqual(new Date(cancelAt * 1000));
    expect(setRepo.save).toHaveBeenCalledWith(set);
  });

  it('clears pendingCancelAt when the subscription was resumed outside our API', async () => {
    const set = makeSet({ pendingCancelAt: new Date(Date.now() + HOUR) });
    const { service, setRepo } = makeHarness([set], new Map([['sub_1', stripeSub()]]));

    await service.reconcileSubscriptions();

    expect(set.deletedAt).toBeNull();
    expect(set.pendingCancelAt).toBeNull();
    expect(setRepo.save).toHaveBeenCalledWith(set);
  });

  it('ends nothing when Stripe is unreachable', async () => {
    const set = makeSet({ pendingCancelAt: new Date(Date.now() - HOUR) });
    const { service, setRepo, signalwireService } = makeHarness([set], new Map(), 'Stripe is down');

    await service.reconcileSubscriptions();

    expect(set.deletedAt).toBeNull();
    expect(setRepo.save).not.toHaveBeenCalled();
    expect(signalwireService.sendSms).not.toHaveBeenCalled();
  });

  it('never touches a PROMO set', async () => {
    const set = makeSet({ stripeSubscriptionId: 'PROMO', pendingCancelAt: new Date(0) });
    const { service, billing, setRepo } = makeHarness([set]);

    await service.reconcileSubscriptions();

    expect(billing.loadAllStripeSubscriptions).not.toHaveBeenCalled();
    expect(setRepo.save).not.toHaveBeenCalled();
    expect(set.deletedAt).toBeNull();
  });

  it('ends a set missing from Stripe only once its own schedule has passed', async () => {
    const expired = makeSet({ setId: 1, stripeSubscriptionId: 'sub_gone', pendingCancelAt: new Date(Date.now() - HOUR) });
    const live = makeSet({ setId: 2, stripeSubscriptionId: 'sub_also_gone', pendingCancelAt: null });
    const { service } = makeHarness([expired, live], new Map());

    await service.reconcileSubscriptions();

    expect(expired.deletedAt).toBeInstanceOf(Date);
    expect(live.deletedAt).toBeNull();
  });

  it('ends an opted-out set without texting it', async () => {
    const set = makeSet({ phone: { phoneId: 3, phone: '15550001111', optedOutAt: new Date() } });
    const { service, signalwireService } = makeHarness(
      [set],
      new Map([['sub_1', stripeSub({ status: 'canceled' })]]),
    );

    await service.reconcileSubscriptions();

    expect(set.deletedAt).toBeInstanceOf(Date);
    expect(signalwireService.sendSms).not.toHaveBeenCalled();
  });

  it('keeps the Gmail watch when another live set uses the same mailbox', async () => {
    const set = makeSet();
    const { service, setRepo, gmailService } = makeHarness(
      [set],
      new Map([['sub_1', stripeSub({ status: 'canceled' })]]),
    );
    setRepo.count.mockResolvedValue(1);

    await service.reconcileSubscriptions();

    expect(set.deletedAt).toBeInstanceOf(Date);
    expect(gmailService.unwatchGmail).not.toHaveBeenCalled();
  });

  it('keeps going after one set fails', async () => {
    const bad = makeSet({ setId: 1, stripeSubscriptionId: 'sub_bad' });
    const good = makeSet({ setId: 2, stripeSubscriptionId: 'sub_good' });
    const { service, setRepo } = makeHarness(
      [bad, good],
      new Map([
        ['sub_bad', stripeSub({ status: 'canceled' })],
        ['sub_good', stripeSub({ status: 'canceled' })],
      ]),
    );
    setRepo.save.mockImplementationOnce(async () => {
      throw new Error('deadlock');
    });

    await service.reconcileSubscriptions();

    expect(good.deletedAt).toBeInstanceOf(Date);
  });
});

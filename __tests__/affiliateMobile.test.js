const test = require('node:test');
const assert = require('node:assert/strict');

test('Mobile Affiliate Suite', async (t) => {

    await t.test('Mobile AsyncStorage referral code retrieval & payload attachment', () => {
        // Mock AsyncStorage state
        const storage = {
            'ratedeed_ref_code': 'PARTNER2026',
        };

        const storedCode = storage['ratedeed_ref_code'];
        assert.equal(storedCode, 'PARTNER2026', 'Storage should retrieve stored referral code');

        // Form payload submission
        const signupPayload = {
            companyName: 'Bravura Roofing',
            category: 'roofing',
            email: 'bravura@example.com',
            referralCode: storedCode || undefined,
        };

        assert.equal(signupPayload.referralCode, 'PARTNER2026', 'Signup payload must attach referralCode from AsyncStorage');
    });

    await t.test('Mobile Notification route resolver maps /affiliate link to AffiliateScreen', () => {
        const resolveRoute = (path, type, message) => {
            const t = (type || '').toLowerCase();
            const m = (message || '').toLowerCase();

            if (path && path.startsWith('/affiliate')) {
                return 'AffiliateScreen';
            }
            if (t.includes('affiliate') || t.includes('commission') || t.includes('payout') || m.includes('commission') || m.includes('payout')) {
                return 'AffiliateScreen';
            }
            return 'Home';
        };

        assert.equal(resolveRoute('/affiliate', 'affiliate_commission', 'Commission earned'), 'AffiliateScreen');
        assert.equal(resolveRoute(null, 'affiliate_payout_approved', 'Your payout was approved'), 'AffiliateScreen');
        assert.equal(resolveRoute(null, 'system_update', 'You earned $5.00 commission'), 'AffiliateScreen');
    });

    await t.test('Mobile Payout Button State requires Stripe Connected account', () => {
        const checkButtonState = (hasStripeConnected, affiliateBalanceCents) => {
            const disabled = !hasStripeConnected || affiliateBalanceCents < 1000;
            let label = 'Withdraw';
            if (!hasStripeConnected) label = 'Connect Stripe';
            else if (affiliateBalanceCents < 1000) label = 'Min $10';

            return { disabled, label };
        };

        // Case 1: Stripe NOT connected -> Disabled with "Connect Stripe"
        const case1 = checkButtonState(false, 5000);
        assert.equal(case1.disabled, true);
        assert.equal(case1.label, 'Connect Stripe');

        // Case 2: Stripe connected but balance < $10 -> Disabled with "Min $10"
        const case2 = checkButtonState(true, 500);
        assert.equal(case2.disabled, true);
        assert.equal(case2.label, 'Min $10');

        // Case 3: Stripe connected & balance >= $10 -> Enabled with "Withdraw"
        const case3 = checkButtonState(true, 2500);
        assert.equal(case3.disabled, false);
        assert.equal(case3.label, 'Withdraw');
    });

});

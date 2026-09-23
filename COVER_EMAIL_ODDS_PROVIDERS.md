# Cover Email - Odds Data Provider Outreach

Unlike the law-firm emails, this isn't a formal RFP - it's a pre-purchase vendor inquiry. The Odds API is self-serve with public pricing, so that email is a direct question to their support/sales team before you subscribe. OpticOdds and SportsDataIO require a sales quote regardless, so those two are scoped inquiry emails requesting pricing for our specific use case, not their full catalog.

**Send this round now** - unlike the prediction-market emails, this isn't deferred to a later phase. The display/redistribution-rights question is the one open item blocking a provider decision (`DECISIONS.md` item 2), and it's foundational: the real ingestion pipeline (Phase 1) can't start until a provider is signed.

**Not included in this round:** Sportradar and Genius Sports. Both are enterprise-only ($10k+/mo, sales-gated pricing) and overkill for the MVP's 4-league/4-book scope - worth revisiting only if official league-level data rights become a requirement in a later phase, not now.

---

## The Odds API (primary candidate)

This is the one where getting a clear written answer matters most before you subscribe - their public FAQ doesn't address display rights at all.

**Subject:** Question on display/redistribution rights before subscribing - Professional/Business tier

> Hi [Odds API team],
>
> I'm building EdgeHub, a subscription sports-betting market-intelligence product that compares sportsbook odds and shows users implied-probability/EV calculations - not a sportsbook itself. I'm planning to subscribe to your Professional tier (or Business, if needed) to cover NFL/NBA/MLB/NHL moneyline/spread/total odds from FanDuel, DraftKings, BetMGM, and Caesars.
>
> Before I commit, I have one question I couldn't find a clear answer to in your public FAQ or docs: does a Professional or Business subscription include the right to display your odds data to my own end users inside a commercial product (redistribution/display rights), or is the license limited to internal use/analysis only? If a consumer-facing product like ours needs a different tier or add-on, I'd appreciate knowing which one, and any attribution requirements that come with it.
>
> Two related questions while I have you:
> - Does the Business tier's historical odds archive count as full retained history, or is there a retention cap I should plan around?
> - Are there restrictions on caching/storing odds snapshots on our own infrastructure, rather than calling the API live on every page load?
>
> Happy to get this confirmed by email or a pointer to the relevant section of your Terms of Service - just want this settled before we build against the API.
>
> Thanks,
> [Your name]
> [Company]
> [Phone / email]

---

## OpticOdds (fallback - sales quote required)

**Subject:** Pricing/scope inquiry - NFL/NBA/MLB/NHL odds, 4 US sportsbooks

> Hi [OpticOdds team],
>
> I'm building EdgeHub, a subscription sports-betting market-intelligence product (odds comparison plus probability/EV analytics, not a sportsbook). I'd like a quote scoped to our actual use case rather than your full catalog:
>
> - Leagues: NFL, NBA, MLB, NHL
> - Markets: moneyline, spread, total
> - Sportsbooks: FanDuel, DraftKings, BetMGM, Caesars
> - Use case: display current and historical odds to our own subscribers, plus derived analytics (implied probability, consensus, edge/EV) - all read-only, no wagering functionality
>
> A few things I'd want as part of scoping:
> - Pricing for the scope above specifically
> - Whether the license includes display/redistribution rights to our own end users in a commercial product, and any attribution requirements
> - Historical odds/line-history availability and retention terms
> - Whether there's a trial or limited-scope starter option before a full contract commitment
>
> We're an early-stage company, so a scoped starter arrangement (if available) would be preferable to a full enterprise contract at this stage.
>
> Would appreciate a call or written quote at your convenience.
>
> Thanks,
> [Your name]
> [Company]
> [Phone / email]

---

## SportsDataIO (fallback - sales quote required)

**Subject:** Pricing/scope inquiry - Odds API for NFL/NBA/MLB/NHL, 4 US sportsbooks

> Hi [SportsDataIO team],
>
> I'm building EdgeHub, a subscription sports-betting market-intelligence product (odds comparison plus probability/EV analytics, not a sportsbook). I'd like a quote scoped to our actual use case:
>
> - Leagues: NFL, NBA, MLB, NHL
> - Markets: moneyline, spread, total
> - Sportsbooks: FanDuel, DraftKings, BetMGM, Caesars
> - Use case: display current and historical odds to our own subscribers, plus derived analytics - read-only, no wagering functionality
>
> Since I know you also offer stats and fantasy data bundled with odds, I want to flag we're specifically looking for an **odds-only** quote at this stage, unless bundling is more cost-effective than odds alone.
>
> Also want to confirm as part of scoping:
> - Whether the license includes display/redistribution rights to our own end users in a commercial product, and any attribution requirements
> - Historical odds/line-history availability and retention terms
> - Typical contract length/commitment for a company at our stage
>
> Would appreciate a call or written quote at your convenience.
>
> Thanks,
> [Your name]
> [Company]
> [Phone / email]

---

*Fill in [Your name] / [Company] / [Phone / email] before sending. Once a provider confirms display rights and gives a quote, log the decision in `DECISIONS.md` item 2 and this becomes the input to Phase 1, item 8 (the real ingestion pipeline).*

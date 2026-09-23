# Request for Proposal: Gaming/Regulatory Counsel

**Prepared for:** outreach to prospective law firms
**Prepared by:** EdgeHub (working name) founder
**Date:** 2026-09-20
**Status:** draft - ready to send, customize the bracketed items before sending

---

## 1. Company and product background

EdgeHub (working name - final name pending trademark clearance) is a **read-only, informational** sports-betting market-intelligence product. It does not operate a sportsbook or exchange, does not accept or place wagers, and does not custody user funds. In plain terms, it aggregates publicly posted sportsbook prices, converts them into comparable probabilities, shows users the math behind that comparison, and lets users privately track their own betting decisions and results. Where a user chooses to act on that information, they leave the product and place any wager directly with a third-party licensed sportsbook - EdgeHub may earn an affiliate fee for that referral.

**Planned MVP scope:**
- Leagues: NFL, NBA, MLB, NHL
- Markets: moneyline, spread, total
- Sportsbooks referenced (via public odds and affiliate links, not integration): FanDuel, DraftKings, BetMGM, Caesars
- Geography: United States, specific launch state(s) not yet determined
- Business model: freemium subscription (Free / Pro / Elite tiers) plus sportsbook affiliate referral fees
- AI-generated content: the product includes an AI feature that explains market data in plain language (e.g., "why is this price better than average"); it is explicitly restricted to citing only data the product already calculated, is barred from generating win predictions or guarantees, and every output carries a fixed disclaimer

**Planned future scope (not in MVP, gated pending legal review before any public UI ships):**
- Read-only integration with prediction-market venues (Kalshi and/or Polymarket) - we understand these operate under a different regulatory regime (CFTC-regulated event contracts) than state-licensed sports betting, and we want counsel's view on that distinction before committing to a roadmap
- Arbitrage-opportunity display, backtesting tools, and a social/community layer are explicitly deferred until after the items above are resolved

We have not yet selected a licensed odds-data provider or finalized a launch jurisdiction - both are open items we'd like counsel's input on, not settled facts we're asking you to work around.

## 2. Scope of work requested

We're looking for counsel to help us reach a public launch responsibly. In rough priority order:

1. **Product/regulatory classification.** An opinion on how this product is legally characterized (informational/comparison service vs. something requiring gaming-adjacent licensure), and whether affiliate-linking to sportsbooks changes that analysis.
2. **Jurisdiction/state-availability analysis.** Which U.S. states we can reasonably launch in given the product as described, what age/identity/geolocation controls are required, and a recommended initial launch state or states.
3. **Marketing and claims review.** Review of our public-facing copy (landing page, pricing, FAQ, in-app language) for prohibited claims - no "lock," "guaranteed," "risk-free," or similar language - plus a reusable checklist we can apply ourselves to future copy, with your review as needed rather than approval of every sentence.
4. **Affiliate relationship compliance.** FTC affiliate-disclosure requirements and any state-specific rules about promoting licensed sportsbooks for compensation.
5. **Policy documents.** Review (or drafting, if you recommend starting over) of our draft Terms of Service, Privacy Policy, and Responsible Use page - drafts attached as Exhibit A, currently marked internally as "pending counsel review."
6. **Data licensing review.** Once we've selected a licensed odds-data provider, a review of that provider's contract for adequate rights to store, cache, display, and derive analytics from their data, plus required attribution.
7. **Responsible-gambling requirements.** Any mandated resources, language, or functionality (self-exclusion ties, help-line disclosures, cooling-off mechanics) for our target launch state(s).
8. **Prediction-market roadmap.** A separate, scoped opinion on the Kalshi/Polymarket integration described above - we understand this may need a different regulatory lens (CFTC/derivatives) than the sports-betting-adjacent work above, and want to know if that means different counsel entirely.
9. **AI-content liability review.** A sanity check on whether our AI-explanation guardrails (evidence-only citation, no predictions, fixed disclaimer label) are adequate, or what additional language/controls you'd want to see.

## 3. Questions for prospective firms

We'd like written or call responses to the following before engaging:

**Relevant experience**
- Have you advised comparison/analytics/media companies in the sports-betting space (as opposed to sportsbook operators themselves)? Those are different regulatory postures and we want to make sure that distinction is one you work with regularly.
- Do you have experience with affiliate-marketing compliance (FTC disclosure rules) specifically in the gambling-adjacent space?
- Do you have experience with prediction markets / CFTC-regulated event contracts (Kalshi, Polymarket, or similar)? If not, can you refer us to someone who does, or would this need to be a second engagement?
- Do you have multi-state licensing/registration experience, or do you work through a local-counsel network for state-specific questions?

**Engagement structure**
- Who on your team would actually do this work (partner, associate, mix), and what's the typical turnaround for an initial classification memo?
- Do you offer a fixed fee for the classification + jurisdiction-matrix deliverables, or is this strictly hourly? If hourly, what's a realistic estimated range for items 1-5 above?
- What would an ongoing engagement look like after initial launch - a retainer for periodic marketing-copy review, or ad hoc as-needed?
- Can you share (without breaching confidentiality) the type/stage of similar clients you've worked with?

## 4. Deliverables we're asking for

- Written memo: product/regulatory classification and rationale
- State-availability matrix with a recommended initial launch state (or states) and required age/geo controls
- Reusable marketing-claims checklist, plus one pass of review on our current site copy
- Reviewed/finalized Terms of Service, Privacy Policy, and Responsible Use page
- Separate short memo on the prediction-market roadmap question (item 8 above), even if the answer is "engage different counsel for this"
- A proposal for ongoing engagement scope/cost post-launch

## 5. Timeline

We'd like the classification memo and state-availability matrix before we finalize a data-provider contract or invite any beta users. A rough estimate of your timeline for that portion of the work, independent of the full engagement, would help us sequence the rest of our launch plan.

## 6. Materials attached

- **Exhibit A:** current draft Terms of Service, Privacy Policy, and Responsible Use page - see `exhibits/` folder:
  - `Exhibit-A1-Terms.pdf` / `.md`
  - `Exhibit-A2-Privacy.pdf` / `.md`
  - `Exhibit-A3-Responsible-Use.pdf` / `.md`

  The `.pdf` files are exact exports of the live pages (attach these); the `.md` files are plain-text transcripts of the same content, useful if you want to paste text into an email body or let counsel redline in a doc editor.
- **Exhibit B:** one-page product overview (Section 1 of this document, if you'd like it as a standalone leave-behind)

---

*Internal note (remove before sending): once a firm is selected, log the engagement and its scope back into `DECISIONS.md` items 3-4, and update this file's Status line to "sent" / "engaged" as it progresses.*

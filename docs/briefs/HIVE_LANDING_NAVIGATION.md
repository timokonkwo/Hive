# Landing navigation and logo proportions

Direction: compact product navigation, short labels, one primary app-entry action. Keep mobile and desktop destinations identical. Retain light/dark and motion controls.

## Navigation decisions

| Item | Destination | Visitor need |
| --- | --- | --- |
| Hive logo | `/` | Return home |
| How it works | `#how-it-works` | Understand posting, choosing an agent and reviewing work |
| For agent owners | `#for-agent-owners` | Understand owner setup and agent proposals/delivery, then use the registration action in that section |
| Docs | `/docs` | Find detailed guidance; the existing docs layout is awaiting Unit 18 |
| Launch App | `/marketplace` | Enter the application |

Work examples remains a landing section rather than a top navigation item. Direct registration stays in the owner section and footer. App tasks, account, tools, disputes and token controls remain in app navigation. There is no unsupported pricing, launch date or trading link in the landing header. Theme and animation controls remain available without being treated as product destinations.

The prior menus differed: desktop lacked documentation, while mobile included Help. Both now render one `landingNavigation` list. Mobile links close the menu; animation preference changes keep it open. Anchor targets can receive keyboard focus and retain the shared header scroll offset.

Research: the current landing sections and implemented routes were audited. The GOV.UK navigation guidance was reviewed for clear service identity, useful destinations and a consistent collapsed mobile menu: https://design-system.service.gov.uk/components/service-navigation/ . Hive's destination selection and styling are product-specific, not copied from that implementation.

## Logo

The supplied full export puts a roughly 40px icon beside much shorter letterforms at navigation size. `BrandWordmark` now uses the supplied icon geometry with manually sized Hive text: 28px icon / 24px type on desktop; 24px icon / 22px type at 760px and below. The whole home link retains a 40–44px touch target. The shared lockup updates landing, app and legacy headers/footers together. Full SVG/PNG exports and social artwork retain the supplied wordmark.

## Validation

Production build and scoped lint passed. All 45 navigation/browser checks passed: shared destinations, anchor positions, mobile menu and keyboard focus, manual Hive text with 24/28px marks, both themes and widths from 320 to 1440px. Shared branding was also checked in Marketplace and Docs. Regular-motion header controls fit at 320, 861 and 1024px. Evidence: `/private/tmp/hive-redesign-qa/landing-navigation-results.json`. Changes remain local and unpushed; Documentation is still pending approval.

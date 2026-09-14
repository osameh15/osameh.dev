# Architecting Hirava: a two-sided recruitment marketplace with Nuxt 4

Hirava is a B2B recruitment marketplace: companies post hiring requests, independent recruiters submit assessed candidates, and a success fee is paid when a hire sticks. The frontend is implemented in Nuxt 4. The backend — planned as Go with PostgreSQL — does not exist yet.

That order is deliberate, and it is the reason this note exists. Building the product surface first is only safe if the frontend does not quietly become the system of record.

**Status of every claim below:** the Nuxt application is implemented and running as a development preview. The Go backend, the database and every server-enforced rule are planned. Nothing here describes a deployed API.

## The domain before the backend

Two participants, not one product with a role flag:

- **Companies** create jobs, review candidate assessments, run a hiring pipeline and manage a subscription plan.
- **Recruiters** maintain a verified profile, submit candidates against jobs, and are measured on what happens to those candidates afterwards.

Modeling that domain in the browser first produced something more useful than mockups: an executable description of the product. Every screen forces a question the specification can leave vague — what exactly does a company see before a candidate's contact details are unmasked, what does a recruiter see when their submission quota is exhausted, what does an empty pipeline column mean.

The risk is equally concrete. A frontend written before its API tends to invent one, and the invented shape is usually convenient for a component rather than correct for a domain.

## Companies and recruiters as separate product contexts

The routes are split at the top level: `/c/**` for companies, `/r/**` for recruiters, `/admin/**` for internal staff, and prerendered public marketing routes at the root. Route middleware (`company-only`, `recruiter-only`, `admin-only`) keeps each context closed.

This is a product boundary before it is a routing convenience. A company dashboard and a recruiter dashboard share almost no vocabulary: one thinks in open roles and shortlists, the other in submissions, placements and earnings. Collapsing them into one "dashboard" with conditionals would have produced a component that understands neither side.

What the two contexts do share is deliberately small: layout chrome, formatting (Jalali and Gregorian calendars, Persian digits, Rial-to-Toman display), plan and tier presentation, and the design system. Those live in shared composables and components. Nothing that encodes a business rule is shared by accident.

## Shared primitives versus role-specific workflows

The useful split turned out to be:

- **Primitives** — presentation of a value that means the same thing to everyone. A date, a currency, a status chip, a tier badge.
- **Workflows** — sequences that only make sense inside one context. Submitting a candidate, moving a pipeline stage, scheduling an interview.

Primitives are shared aggressively; workflows are never shared. When a workflow looks like it wants to be generalized across contexts, that is usually the domain saying the two things are not the same thing.

## The hiring pipeline is a state model, not a set of tabs

Every submission moves through one sequence:

```text
SUBMITTED → UNDER_REVIEW → INTERVIEW → FINAL_STAGE → HIRED
                                                   ↓
                                         REJECTED (from any non-terminal state)
```

The frontend treats that as a state machine with a single status union type, not as a list of UI tabs that happen to be ordered. The difference shows up immediately: a board column is a projection of state, an action is a transition, and an illegal transition is not renderable rather than merely discouraged.

When the backend arrives, the same sequence has to be enforced there, over an append-only history. A client-side state machine is a usability feature. It is not an invariant.

## Candidate submission and evaluation

Two product rules shape the recruiter side more than anything else:

- A recruiter may submit **at most five candidates per job**, for the lifetime of that job.
- Every submission carries a structured assessment — summary, strengths, weaknesses, motivation for change, risk factors, recommendation and fit score — not a resume attachment.

The cap lives in one module as a named constant with a comment stating that the server re-validates it and that the client value exists only to disable an obviously invalid action. That comment matters more than the constant. A quota rendered in a browser is a courtesy; the same quota enforced in a transaction is the rule.

## Designing frontend contracts before the API exists

The application declares its API base in runtime configuration and points it at a local Go service that has not been written. No component calls it. All state is served from typed modules under `app/data` and Pinia stores that read them.

Three rules kept this from becoming a trap:

1. **Types describe the domain, not the fixture.** `SubmissionStatus` is a union of the real states; it is not derived from whatever the mock file happens to contain.
2. **Components read stores, never data modules.** The data module is an implementation detail of the store, so replacing it is a change in one layer.
3. **No mock-shaped conveniences.** Nothing relies on the whole dataset being present, synchronous, or already joined — because none of that survives contact with a paginated HTTP API.

## Avoiding frontend assumptions that constrain the backend

The failure mode is not a wrong endpoint name. It is a UI that has silently decided something about the server.

Cases worth naming, all avoided deliberately:

- **Derived truth.** A recruiter's performance figures are presentation of a score the backend will own. The frontend must not compute a reputation number and then treat it as canonical.
- **Client-generated identity.** Nothing mints an id that a database will later need to honour.
- **Assumed atomicity.** A submission that must be validated against a lifetime quota is a server-side transaction, not two optimistic updates.
- **Assumed visibility.** Candidate contact details are masked until a late pipeline stage. Masking in a component is a rendering choice; if the API ever sends the field, the guarantee is already gone. The backend must not send it at all.

## Mock data without coupling the product to mock data

Prototype content is also a truth hazard. The landing page shows illustrative figures — company counts, recruiter counts, a retention percentage — that are presentation placeholders for a pre-launch product, not measured results. They are treated as copy, not as data, and they are never quoted anywhere as outcomes.

The same applies internally: sample companies, recruiters and submissions exist to exercise the interface. Nothing reads them as evidence of adoption.

## What changes when the backend arrives

The intended sequence is unglamorous:

1. Stores swap their data source from a typed module to an HTTP client. Component code does not move.
2. Every invariant currently mirrored in the client — the submission cap, the state machine, PII masking, verification-before-submission — gains its real enforcement in Go, with the client check demoted to a hint.
3. Loading, empty, partial and error states become real. A prototype has one of these; a product has four.
4. Anything the frontend derived for display gets re-sourced from the server, or is deleted.

## Lessons learned

- Building the product surface first is defensible only while the surface stays honest about not being the system.
- Split by participant, not by page. Two participants sharing a screen is a coincidence; sharing a workflow is usually a mistake.
- Write the state machine down, in types, before the first board column.
- A client-side rule with a comment explaining that the server owns it is worth far more than the same rule without one.
- Keep prototype content clearly labelled as prototype content. The temptation to quote your own placeholder metrics is the first way a truthful project stops being one.

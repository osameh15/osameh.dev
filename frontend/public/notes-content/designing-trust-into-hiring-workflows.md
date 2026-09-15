# Designing trust into hiring workflows

Recruiter scoring, candidate caps, verification and transparent pipelines — and where each of them actually has to live.

A company that hires through independent recruiters is asked to act on someone else's judgement about a stranger. Nothing about that is guaranteed by good intentions. It has to be encoded.

This note uses Hirava — a two-sided recruitment marketplace whose Nuxt frontend is implemented while its Go backend is still planned — as the concrete domain. Every mechanism below is currently **product modelling in the frontend**. None of it is a server-enforced guarantee today, and the distinction is the point of the note rather than a footnote to it.

## Trust is part of the data model

The usual instinct is to treat trust as interface polish: a badge, a star rating, a reassuring line of copy. That produces a system where the trust signal and the thing it describes can drift apart indefinitely.

The alternative is to make each trust claim a modelled entity with a defined source:

- verification is a **state** a recruiter reaches through a defined pipeline, not an attribute someone sets;
- performance is a **derivation** from recorded outcomes, not a number stored on a profile;
- pipeline position is a **history**, not a mutable field;
- submission volume is a **constraint**, not a guideline.

Once each claim has a source, the honest question about any badge becomes answerable: what event produced this, and what would have to happen for it to change?

## Why unrestricted submission creates noise

Recruiters are paid on success. Without a cap, the individually rational strategy is volume: submit everyone plausible, let the company sort it out. Every recruiter doing this reproduces exactly the problem the marketplace claims to solve, plus a screening bill for the company.

A cap inverts the economics. If a recruiter may submit at most five candidates for a job, each slot has an opportunity cost, and the cheapest way to win is to be selective — which is the behaviour the product wants.

## The cap as a system constraint

Hirava's rule is: **at most five candidate submissions per recruiter per job, for the lifetime of the job.** "Lifetime" is doing real work in that sentence. A monthly quota would be gamed by waiting.

In the frontend, that number lives in one module as a named constant, with the reason stated beside it: the client uses it to disable an obviously invalid action. The frontend models the five-candidate limit; the future backend must re-validate the rule server-side. Until that backend exists, the limit is modelled, not enforced — and a quota that exists only in a browser is a suggestion to anyone willing to send an HTTP request.

Its real implementation — still planned — will be a transactional check against a lifetime count, with rejection at the API boundary, not a disabled button.

## Structured evaluation instead of forwarded resumes

Each submission is required to carry an assessment package: professional summary, strengths, weaknesses, motivation for change, risk factors, an overall recommendation, a fit score, and recruiter notes.

Two design consequences follow.

First, weaknesses and risk factors are **required fields**. A recruiter who must write down a candidate's weak points before submitting is making a falsifiable statement. Optional fields collect no negatives.

Second, the assessment becomes an accountable artefact. It is written before the outcome is known, and the outcome is recorded later against it — which is what makes assessment accuracy measurable at all rather than an opinion about an opinion.

## Verification and identity

Anonymous supply cannot be held accountable, so the product design requires recruiters to pass a staged verification pipeline — phone ownership, a national identity check against the phone holder, profile and CV review, an admin review, and an interview — before they can submit anything. Companies pass their own shorter pipeline before posting jobs.

Two properties matter more than the number of stages:

- **Verification gates the action, not the account.** An unverified recruiter can exist and browse; they cannot submit.
- **Verification is a pipeline with a history**, so "verified" always has a date, a reviewer and a reason behind it.

Today the frontend renders those stages and their states. The identity checks themselves are provider integrations that do not exist yet. A verification badge whose backing check has not been built is a design artefact, and describing it as anything else would be exactly the failure this product is meant to fix.

## Scoring and performance signals

The reputation model tracks interview rate, hire rate, ninety-day retention, response speed, candidate quality and assessment accuracy.

Retention is the interesting one. Hire rate alone rewards persuasion — placing a candidate who leaves in six weeks still counts. Retention measured at ninety days, with the success fee held until then, aligns the recruiter's payout with the company's actual outcome. The metric and the money agree.

Response speed is the opposite case: cheap to measure, easy to game, and only weakly related to quality. It belongs in the model as a minor signal, not as a headline number.

## Pipeline visibility and status transitions

Every submission moves through one sequence:

```text
SUBMITTED → UNDER_REVIEW → INTERVIEW → FINAL_STAGE → HIRED
                                                   ↓
                                         REJECTED (from any non-terminal state)
```

Both sides see the same stage names. That shared vocabulary is most of the trust benefit — a recruiter chasing a silent company and a company drowning in follow-up messages are the same failure of visibility.

The design rules that make it work are boring and strict:

- transitions are **append-only events**; the current stage is a projection of that history, never a field someone overwrites;
- illegal transitions do not exist as operations, rather than being merely discouraged;
- every stage change is attributable and timestamped, because a pipeline nobody can audit is a story, not a record.

Candidate contact details are designed to stay masked until a late stage, with the reveal recorded as an audited event. Masking in a component is a rendering choice; the guarantee the future API must provide is never sending the field early.

## Preventing metrics from becoming vanity scores

Any published score becomes a target. Some defences that are cheap to design in and expensive to retrofit:

- **Report volume alongside rate.** A 100% hire rate on one submission is not a hire rate.
- **Prefer outcomes the recruiter cannot self-report.** Retention beats self-declared placements.
- **Delay recognition of the reward** — hold the fee until the retention window closes — so short-term wins do not settle immediately.
- **Deduplicate submissions** by a hash of candidate contact identity, so the same person cannot be resubmitted to the same job to manufacture activity.
- **Keep the formula explainable.** A score nobody can account for is disputed rather than trusted.

None of these are anti-fraud systems. They are incentive design, which is what you can do before you have the data to detect abuse.

## What the frontend can model, and what the backend must guarantee

A clean division, and the honest current status of each:

- **Submission cap** — frontend: quota display and a disabled action. Backend: a transactional check against the lifetime count.
- **Verification** — frontend: the staged interface, its states, and the review queue. Backend: the identity checks themselves, immutable state, and gating every action behind it.
- **Scoring** — frontend: presentation of the model. Backend: derivation from recorded outcomes.
- **Pipeline** — frontend: the state machine and shared stage names. Backend: append-only history, legal transitions only.
- **PII masking** — frontend: masked rendering. Backend: never sending the field early, and auditing every reveal.
- **Success fee** — frontend: plan and fee presentation. Backend: the ledger, the hold, and release on retention.

Everything listed as frontend is implemented. Everything listed as backend is planned. A marketplace where only the frontend half exists is a convincing demonstration and nothing more, and saying so plainly costs less than being found out.

## Lessons for other two-sided marketplaces

- Constrain supply volume early. Marketplaces do not usually fail from too little supply; they fail from unfiltered supply making demand's job worse.
- Make the low-quality path expensive rather than forbidden.
- Require the negative fields. Optional weaknesses are never filled in.
- Score outcomes the participant does not report themselves, and publish the denominator.
- Keep the record append-only. Disputes are settled by history, not by current state.
- Enforce every rule that matters on the server, and say clearly which rules are not enforced yet.

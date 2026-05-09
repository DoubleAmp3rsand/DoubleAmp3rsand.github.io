---
title: A Statistical Toolkit for US Catastrophe Loss Trends
date: 2026-05-08
tags: [statistics, data, catastrophe]
---

A walkthrough of the statistical machinery used to model the **insured-vs-economic
loss gap** in US natural catastrophes (1990–2024) — what each tool does, why it
fits a heavy-tailed, event-driven series, and how the pieces compose into a
defensible trend estimate.

> Data: NOAA Billion-Dollar Disasters (real, CPI-adjusted), joined to a
> synthetic insured-loss series in `synth.py` calibrated to public take-up
> rates. The findings section below uses these numbers; the methods section is
> the point of the post.

---

## Findings (in one section)

The protection gap — economic loss not covered by insurance — has widened at
**+$1.63 B / yr** on average over 1990–2024 (95% bootstrap CI **+$0.76 B,
+$2.74 B**, n = 35). Average annual uninsured loss has roughly **3.5×** between
1990–1994 ($16.8 B/yr) and 2020–2024 ($58.8 B/yr). Most of that growth is
because *total* losses are rising; the aggregate insured share drifted only
~5pp (58.5% → 53.9%).

| Peril | Slope (USD B / yr) | 95% CI | R² | Variance share | Significant? |
| --- | ---: | --- | ---: | ---: | :---: |
| Hurricane | **+1.17** | (+0.28, +2.24) | 0.14 | **88.5%** | yes |
| Severe storm | +0.34 | (+0.22, +0.46) | **0.55** | 5.0% | yes |
| Wildfire | +0.15 | (+0.04, +0.27) | 0.20 | 5.1% | yes |
| Inland flood | −0.02 | (−0.36, +0.26) | 0.00 | 1.4% | no |

Hurricane drives the **dollar trend and the variance**; severe storm is the
*cleanest* signal (high R², tight CI); wildfire is small but compounding
fastest; inland flood is null at NOAA's billion-dollar threshold. Three of the
five worst gap years (2017, 2022, 2024) are in the past decade, and 2017 alone
moves the OLS headline slope by ~24%.

That is the entire empirical story. The rest of this post is about the tools
that produced it.

---

## The toolkit

Each tool below is one paragraph: what it does, why it fits *this* problem.

### 1. OLS (`statsmodels.OLS`)

Fits the conditional mean of `gap` as a linear function of `year`. Cheap,
interpretable, gives a slope in **dollars per year** that maps directly onto
the headline. We use it for the overall and per-peril `gap ~ year`
regressions; everything else in the toolkit is either checking OLS'
assumptions or providing a robust counterpart.

### 2. Paired bootstrap (B = 2000)

Resamples `(year, gap)` rows with replacement, refits OLS, takes the central
95% of slope draws. Non-parametric over the residual distribution — critical
because catastrophe losses are heavy-tailed and Gaussian-error CIs would
under-cover the upside. ~2 s for 2,000 fits on 35 rows.

### 3. CPI adjustment

NOAA publishes a `CPI-Adjusted Cost` column; we use it instead of nominal
cost. Without this step, **any** trend regression on nominal loss data is
~3%/yr of inflation cosplaying as climate signal — the most common
trend-inflation trap in the catastrophe literature.

### 4. Lognormal multiplicative noise (in `synth.py`)

Synthetic insured shares are sampled as `share × LogNormal(0, 0.18)`, which
keeps draws strictly positive and right-skewed — the empirically correct
shape for insurance-ratio data. Gaussian additive noise would let shares go
negative and would flatten the upper tail.

### 5. Augmented Dickey–Fuller (stationarity)

Tests whether the series has a unit root vs. is stationary around a
deterministic trend. We run ADF on both the raw gap series and the OLS
residuals. Non-stationary residuals would make the regression "spurious" in
the Granger–Newbold sense; both ADF tests reject (p < 0.01), so the trend
specification is well-posed.

### 6. Durbin–Watson (autocorrelation)

Detects first-order autocorrelation in residuals on a 0–4 scale (2 = none).
Catastrophe losses are event-driven, so adjacent years should be roughly
independent. **DW = 2.00** confirms it — uncorrected OLS standard errors are
admissible in principle.

### 7. Breusch–Pagan (heteroscedasticity)

Asks whether residual variance grows with the fitted value; if it does, OLS
SEs are biased. Our LM = 1.30, p = 0.25 — variance is roughly constant along
the trend, so we don't need WLS or weighted-bootstrap fixes.

### 8. Skew, excess kurtosis, Shapiro–Wilk (distributional sanity)

Three numbers + one hypothesis test that diagnose how non-Gaussian residuals
are. Ours are **aggressively** heavy-tailed: skew = 2.35, excess kurtosis =
6.77, Shapiro–Wilk p < 1e-3. This is the single most load-bearing diagnostic
in the post — it's *why* we don't trust parametric CIs and reach for the
bootstrap.

### 9. HAC / Newey–West standard errors

HAC SEs robustify OLS inference against autocorrelation and
heteroscedasticity without changing the point estimate. Useful as a sanity
check against the bootstrap. Here HAC gives a **tighter** CI than the
bootstrap, which itself is diagnostic: it tells us the bootstrap's width is
mostly reacting to *tail mass*, not to autocorrelation.

### 10. Theil–Sen estimator (`scipy.stats.theilslopes`)

Median of all `(yi − yj)/(i − j)` slope pairs. Robust to ~29% outlier
contamination, where OLS breaks down at one bad point. The fact that
Theil–Sen comes in **37% lower** than OLS (+1.03 vs +1.63) is the core
honest-broker disclosure of the analysis: a non-trivial fraction of the OLS
slope is a measurement of 2005 + 2017.

### 11. Log-linear specification

Refits `log1p(gap) ~ year` to express the trend as a **percentage growth
rate** (~+5.9% / yr). Two wins: (a) variance-stabilizes a right-skewed
series without throwing away the trend; (b) gives a number a non-actuarial
audience can carry around in their head.

### 12. Leave-one-out / jackknife

The crudest possible influence diagnostic: refit without each point, see how
much the slope moves. Reported as leave-2017-out: slope drops from +1.63 to
+1.24. One number that summarizes "how much of this trend is one bad year?"
better than any leverage statistic for a blog audience.

### 13. Variance decomposition

`cov(gap_peril, gap_total) / var(gap_total)`. Tells us which peril is the
**volatility driver** — a *different question* from which has the steepest
mean trend. Hurricane scores 88.5% here despite a low R² in its own
regression: it is loud, not steady. Useful for separating capital-allocation
conversations from underwriting-trend conversations.

### 14. Spearman rank correlation

Rank-based, non-parametric, robust to the heavy tails that break Pearson.
Used to check cross-peril dependence; max ρ = 0.38, mostly < 0.2 — perils
behave near-independently at annual aggregation, which justifies
peril-stratified modeling and implies a real diversification benefit.

### 15. Power analysis (back-of-envelope)

Normal-approximation MDE: `~2.8 · σ_resid / √(Σ(year−ȳ)²)`. Gives the
**minimum detectable slope** at 80% power. Here it is ~0.7 USD B/yr, which
puts the inland-flood null in context — that's a statement about NOAA's
threshold truncation as much as flood physics.

### Tools at a glance

| Stage | Tool | Library | Question it answers |
| --- | --- | --- | --- |
| Estimation | OLS | `statsmodels` | What's the average annual change? |
| Estimation | Paired bootstrap | `numpy` | How uncertain, given heavy tails? |
| Estimation | Theil–Sen | `scipy.stats` | What's the slope without outlier influence? |
| Estimation | Log-linear OLS | `statsmodels` | What's the % growth rate? |
| Diagnostics | ADF | `statsmodels.tsa` | Is the regression spurious? |
| Diagnostics | Durbin–Watson | `statsmodels` | Are residuals autocorrelated? |
| Diagnostics | Breusch–Pagan | `statsmodels` | Is residual variance constant? |
| Diagnostics | Shapiro–Wilk + moments | `scipy.stats` | Are residuals Gaussian? |
| Inference | HAC SEs | `statsmodels` | Robust SEs without bootstrap. |
| Influence | Jackknife (LOO) | hand-rolled | How much does one tail year matter? |
| Decomposition | Variance share | `numpy.cov` | Which peril drives volatility? |
| Decomposition | Spearman ρ | `scipy.stats` | Are perils co-moving? |
| Power | Normal-approx MDE | hand-rolled | Could we even detect this? |
| Generation | Lognormal noise | `numpy.random` | How to model right-skewed shares. |

---

## Diagnostic results, in one table

The point of the toolkit is composing it. Running every diagnostic on the
overall `gap ~ year` regression:

| Diagnostic | Statistic | Interpretation |
| --- | ---: | --- |
| OLS R² | 0.223 | Year explains ~22% of variance — modest, expected. |
| Durbin–Watson | 2.00 | No autocorrelation. |
| Breusch–Pagan | LM = 1.30, p = 0.25 | No heteroscedasticity. |
| ADF (gap) | t = −4.55, p < 0.001 | Trend-stationary. |
| ADF (residuals) | t = −3.50, p = 0.008 | Detrended series stationary. |
| Skew / excess kurtosis | 2.35 / 6.77 | Heavy right tail. |
| Shapiro–Wilk | W = 0.79, p < 1e-3 | Residuals **not** Gaussian. |

Verdict: textbook well-specified (no autocorrelation, stationary residuals,
constant variance) but with **non-normal errors** — exactly the case the
bootstrap is built for.

| Estimator | Slope (USD B / yr) | 95% CI |
| --- | ---: | --- |
| OLS (headline) | **+1.63** | (+0.76, +2.74) bootstrap |
| OLS + HAC SE | +1.63 | (+0.87, +2.40) |
| Theil–Sen | +1.03 | (+0.24, +2.02) |
| Leave-2017-out | +1.24 | — |
| Log-linear | ~+5.9% / yr | R² = 0.30 |

All five flag the trend as positive and significant. **Sign is robust;
magnitude is influence-driven** — the actionable takeaway from the whole
toolkit composing on one series.

---

## Limitations

- **Synthetic insured series.** Replace `synth.synthesize_insured` with real
  NFIP + ISO/PCS extracts before quoting numbers externally; the *methods*
  in this post don't change, but the levels do.
- **Annual aggregation loses event structure.** An event-level bootstrap on
  a frequency–severity model would give tighter tail estimates; on the
  roadmap.
- **n = 35.** Short by climate-statistics standards. Per-peril CIs are
  suggestive, not authoritative — see the power section.
- **NOAA threshold bias.** Sub-billion-dollar events are excluded by
  construction; fine for catastrophe-scale work, wrong for everyday claims.

Code: `src/catloss/{data,synth,models,plots}.py`. Pipeline:
`uv run python -m catloss.run`.

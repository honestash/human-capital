const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { calculate, ageFromBirthYear, peerBenchmark, peerComparison, parseNumericInput, formatThousands, SURVEY_BENCHMARKS, estimateAfterTaxIncome, incomeTrajectory, projectedWage, workingDiscountRate, retiredDiscountRate, allocationShares } = require("./calculator.js");

const demo = {
  gamma: 7,
  education: 3,
  self: { age: 42, annualGrossIncome: 7200, retirementAge: 60, additionalWorkEndAge: 65 },
  spouse: { age: 40, annualGrossIncome: 4800, retirementAge: 60, additionalWorkEndAge: 63 },
  assets: {
    dcBalance: 35000, dcEquity: 30,
    irpBalance: 20000, irpEquity: 45,
    otherBalance: 65000, otherEquity: 40,
  },
};

const r = calculate(demo);
assert.equal(ageFromBirthYear(1984), 42);
assert.equal(ageFromBirthYear(2006), 20);
assert.equal(SURVEY_BENCHMARKS.totalN, 2000);
assert.equal(peerBenchmark(30).n, 668);
assert.equal(peerBenchmark(39).humanCapital.median, peerBenchmark(30).humanCapital.median);
assert.equal(peerBenchmark(40).n, 666);
assert.equal(peerBenchmark(59).actualShare.n, 598);
assert.equal(peerBenchmark(29), null);
assert.equal(peerBenchmark(60), null);
assert.equal(parseNumericInput("7,200"), 7200);
assert.ok(Number.isNaN(parseNumericInput("")));
assert.equal(formatThousands(7200), "7,200");
assert.deepEqual(peerComparison(10, { p25: 20, median: 30, p75: 40 }), { position: 12.5, zone: "P25 미만" });
assert.deepEqual(peerComparison(30, { p25: 20, median: 30, p75: 40 }), { position: 50, zone: "중앙값" });
assert.deepEqual(peerComparison(35, { p25: 20, median: 30, p75: 40 }), { position: 62.5, zone: "중앙값~P75" });
assert.deepEqual(peerComparison(50, { p25: 20, median: 30, p75: 40 }), { position: 87.5, zone: "P75 초과" });
assert.deepEqual(peerComparison(100, { p25: 100, median: 100, p75: 100 }), { position: 50, zone: "사분위 값 동일" });
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const appSource = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
const htmlIds = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
assert.equal(new Set(htmlIds).size, htmlIds.length, "HTML IDs must be unique");
for (const key of ["h", "w", "actual", "target"]) {
  for (const prefix of ["peer", "report-peer"]) {
    for (const suffix of ["track", "iqr", "marker", "p25", "median", "p75", "median-marker"]) {
      assert.match(html, new RegExp(`id=["']${prefix}-${key}-${suffix}["']`));
    }
    if (prefix === "peer") assert.match(html, new RegExp(`id=["']${prefix}-${key}-position["']`));
  }
}
for (const id of ["report-income-chart", "income-self-line", "income-spouse-line", "income-y-axis-labels", "income-x-mid", "income-transition-markers", "income-change-markers", "report-peer-grid", "report-peer-legend"]) {
  assert.match(html, new RegExp(`id=["']${id}["']`));
}
for (const id of ["close-mobile-report-button", "mobile-print-button"]) assert.match(html, new RegExp(`id=["']${id}["']`));
assert.match(appSource, /matchMedia\("\(max-width: 880px\)"\)/);
assert.match(appSource, /mobile-print-button.*window\.print/s);
assert.equal(estimateAfterTaxIncome(0).afterTaxIncome, 0);
assert.ok(estimateAfterTaxIncome(7200).afterTaxIncome < 7200);
assert.equal(estimateAfterTaxIncome(7200).taxableIncome, 5715);
assert.equal(estimateAfterTaxIncome(7200).incomeTax, 795.6);
assert.ok(Math.abs(estimateAfterTaxIncome(7200).afterTaxIncome - 6324.84) < 1e-9);
const incomePath = incomeTrajectory(demo.self);
assert.equal(incomePath[0].age, 42);
assert.ok(Math.abs(incomePath[0].annualIncome - estimateAfterTaxIncome(7200).afterTaxIncome) < 1e-9);
assert.equal(incomePath.find((point) => point.age === 60).annualIncome, projectedWage(42, estimateAfterTaxIncome(7200).afterTaxIncome, 60));
assert.equal(incomePath.find((point) => point.age === 61).annualIncome, projectedWage(42, estimateAfterTaxIncome(7200).afterTaxIncome, 60) * 0.5);
assert.equal(incomePath.find((point) => point.age === 66).annualIncome, projectedWage(42, estimateAfterTaxIncome(7200).afterTaxIncome, 60) * 0.4);
assert.equal(incomePath.at(-1).age, 99);
assert.ok(Math.abs(r.baseShare - 0.04547225207391364) < 1e-12);
assert.ok(r.humanCapital > 0 && r.humanCapital < 167156.38144505402);
assert.equal(r.self.grossIncome, 7200);
assert.equal(r.self.afterTaxIncome, estimateAfterTaxIncome(7200).afterTaxIncome);
assert.ok(Math.abs(r.financialWealth - 120000) < 1e-9);
assert.ok(Math.abs(r.equityAmount - 45500) < 1e-9);
assert.ok(Math.abs(r.actualShare - 0.37916666666666665) < 1e-12);
assert.ok(r.recommendedShare > r.baseShare && r.recommendedShare < 1);
assert.ok(Math.abs(r.gap - (r.recommendedShare - r.actualShare)) < 1e-12);

const reportExample = allocationShares(92200, 7000, 7);
assert.ok(Math.abs(reportExample.recommendedShare - 0.6444) < 0.0001);

const noAssets = calculate({
  ...demo,
  assets: { dcBalance: 0, dcEquity: 0, irpBalance: 0, irpEquity: 0, otherBalance: 0, otherEquity: 0 },
});
assert.equal(noAssets.hasNoFinancialWealth, true);
assert.equal(noAssets.recommendedShare, 0);
assert.equal(noAssets.actualShare, 0);
assert.equal(noAssets.hOverW, 0);

const capped = calculate({
  ...demo,
  assets: { dcBalance: 1, dcEquity: 100, irpBalance: 0, irpEquity: 0, otherBalance: 0, otherEquity: 0 },
});
assert.equal(capped.recommendedShare, 1);
assert.equal(capped.cappedAt100, true);

assert.ok(workingDiscountRate(42, 7, 3) > -1);
assert.ok(retiredDiscountRate(61, 7) > -1);
assert.throws(() => calculate({ ...demo, gamma: 11 }), /4~10/);
assert.throws(() => calculate({ ...demo, self: { ...demo.self, additionalWorkEndAge: 55 } }), /추가 소득활동 종료 나이/);

console.log("calculator tests passed");

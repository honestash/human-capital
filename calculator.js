(function (root) {
  "use strict";

  const PARAMS = Object.freeze({
    version: "report71-domestic-2026-09",
    referenceYear: 2026,
    stockReturn: 0.05,
    riskFreeRate: 0.02,
    stockVolatility: 0.307,
    additionalWorkReplacement: 0.50,
    postWorkReplacement: 0.40,
    terminalAge: 99,
    educationRisk: Object.freeze({
      1: Object.freeze([0.0054, 0.1748]),
      2: Object.freeze([0.0101, 0.1456]),
      3: Object.freeze([0.0053, 0.1412]),
      4: Object.freeze([0.0053, 0.1412]),
    }),
    worker: Object.freeze({
      constant: 0.0589683551917788,
      gamma: 0.04976703141479,
      logPremium: -0.218236533047062,
      logRiskFree: 1.61966222464735,
      permanentVariance: 3.43439322752238,
      transitoryVariance: 0.137378824619836,
      replacementRate: 0.0445111260043819,
      age: -0.32851840797324,
      ageSquared: 0.151857889871378,
    }),
    retired: Object.freeze({
      constant: -0.191868119745063,
      gamma: -0.00215228417533658,
      logPremium: -0.275622049928747,
      logRiskFree: 0.775294941041416,
      age: 0.530430722894117,
      ageSquared: -0.276704874081542,
    }),
  });

  const SURVEY_BENCHMARKS = Object.freeze({
    year: 2026,
    totalN: 2000,
    sourceNote: "2026년 인적자본 기반 투자비중 적정성 조사 응답자별 산출자료; 10년 연령대별 요약",
    bands: Object.freeze({
      "30대": Object.freeze({
        n: 668,
        humanCapital: Object.freeze({ n: 668, p25: 63846.51, median: 96202.43, p75: 156122.97 }),
        financialWealth: Object.freeze({ n: 668, p25: 1000, median: 3000, p75: 6750 }),
        actualShare: Object.freeze({ n: 625, p25: 0.0681, median: 0.25, p75: 0.5278 }),
        recommendedShare: Object.freeze({ n: 668, p25: 0.5427, median: 1, p75: 1 }),
      }),
      "40대": Object.freeze({
        n: 666,
        humanCapital: Object.freeze({ n: 666, p25: 77868.65, median: 115784.09, p75: 170198.34 }),
        financialWealth: Object.freeze({ n: 666, p25: 1700, median: 5000, p75: 12975 }),
        actualShare: Object.freeze({ n: 597, p25: 0.0789, median: 0.24, p75: 0.5 }),
        recommendedShare: Object.freeze({ n: 666, p25: 0.3011, median: 0.7275, p75: 1 }),
      }),
      "50대": Object.freeze({
        n: 666,
        humanCapital: Object.freeze({ n: 666, p25: 70534.77, median: 102508.33, p75: 152914.01 }),
        financialWealth: Object.freeze({ n: 666, p25: 2010, median: 8000, p75: 20000 }),
        actualShare: Object.freeze({ n: 598, p25: 0.0853, median: 0.2388, p75: 0.495 }),
        recommendedShare: Object.freeze({ n: 666, p25: 0.2102, median: 0.4492, p75: 1 }),
      }),
    }),
  });

  const clamp01 = (n) => Math.max(0, Math.min(1, n));

  function parseNumericInput(raw) {
    const normalized = String(raw).trim().replaceAll(",", "");
    return normalized === "" ? NaN : Number(normalized);
  }

  function formatThousands(value) {
    return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(value);
  }

  function ageFromBirthYear(birthYear) {
    return PARAMS.referenceYear - Number(birthYear);
  }

  function peerBenchmark(age) {
    if (age < 30 || age > 59) return null;
    const decade = Math.floor(age / 10) * 10;
    return SURVEY_BENCHMARKS.bands[`${decade}대`] || null;
  }

  function peerComparison(value, distribution) {
    if (value < distribution.p25) return { position: 12.5, zone: "P25 미만" };
    if (value > distribution.p75) return { position: 87.5, zone: "P75 초과" };
    if (distribution.p25 === distribution.p75) return { position: 50, zone: "사분위 값 동일" };
    if (value === distribution.median) return { position: 50, zone: "중앙값" };
    const zone = value < distribution.median ? "P25~중앙값" : "중앙값~P75";
    const position = 25 + 50 * (value - distribution.p25) / (distribution.p75 - distribution.p25);
    return { position, zone };
  }

  function earnedIncomeDeduction(grossIncome) {
    const income = Math.max(0, grossIncome);
    let deduction;
    if (income <= 500) deduction = income * 0.70;
    else if (income <= 1500) deduction = 350 + (income - 500) * 0.40;
    else if (income <= 4500) deduction = 750 + (income - 1500) * 0.15;
    else if (income <= 10000) deduction = 1200 + (income - 4500) * 0.05;
    else deduction = 1475 + (income - 10000) * 0.02;
    return Math.min(deduction, 2000);
  }

  function progressiveIncomeTax(taxableIncome) {
    const base = Math.max(0, taxableIncome);
    if (base <= 1400) return base * 0.06;
    if (base <= 5000) return 84 + (base - 1400) * 0.15;
    if (base <= 8800) return 624 + (base - 5000) * 0.24;
    if (base <= 15000) return 1536 + (base - 8800) * 0.35;
    if (base <= 30000) return 3706 + (base - 15000) * 0.38;
    if (base <= 50000) return 9406 + (base - 30000) * 0.40;
    if (base <= 100000) return 17406 + (base - 50000) * 0.42;
    return 38406 + (base - 100000) * 0.45;
  }

  function estimateAfterTaxIncome(grossIncome) {
    if (!(grossIncome >= 0 && Number.isFinite(grossIncome))) {
      throw new Error("연간 세전 근로소득은 0 이상의 금액으로 입력해 주세요.");
    }
    const earnedIncome = Math.max(0, grossIncome - earnedIncomeDeduction(grossIncome));
    const taxableIncome = Math.max(0, earnedIncome - 150);
    const incomeTax = progressiveIncomeTax(taxableIncome);
    const localIncomeTax = incomeTax * 0.10;
    return {
      grossIncome,
      earnedIncome,
      taxableIncome,
      incomeTax,
      localIncomeTax,
      afterTaxIncome: Math.max(0, grossIncome - incomeTax - localIncomeTax),
    };
  }

  function projectedWage(currentAge, currentAnnualIncome, futureAge) {
    if (currentAnnualIncome <= 0) return 0;
    const da = futureAge - currentAge;
    return currentAnnualIncome * Math.exp(
      0.5 * (da * 0.13 ** 2 + 0.242 ** 2)
      + 0.3194 * da
      - 0.00577 * (futureAge ** 2 - currentAge ** 2)
      + 0.000033 * (futureAge ** 3 - currentAge ** 3)
    );
  }

  function incomeTrajectory(person) {
    const { age, annualGrossIncome, retirementAge, additionalWorkEndAge } = person;
    const annualIncome = estimateAfterTaxIncome(annualGrossIncome).afterTaxIncome;
    const retirementIncomeBase = projectedWage(age, annualIncome, retirementAge);
    const firstAge = Math.floor(age);
    const points = [];

    for (let futureAge = firstAge; futureAge <= PARAMS.terminalAge; futureAge += 1) {
      let income;
      if (futureAge === firstAge) income = annualIncome;
      else if (futureAge <= retirementAge) income = projectedWage(age, annualIncome, futureAge);
      else if (futureAge <= additionalWorkEndAge) income = retirementIncomeBase * PARAMS.additionalWorkReplacement;
      else income = retirementIncomeBase * PARAMS.postWorkReplacement;
      points.push({ age: futureAge, annualIncome: income });
    }
    return points;
  }

  function workingDiscountRate(age, gamma, education) {
    const [sigmaU2, sigmaE2] = PARAMS.educationRisk[education] || PARAMS.educationRisk[3];
    const p = PARAMS.worker;
    const age100 = age / 100;
    const logPremium = Math.log1p(PARAMS.stockReturn)
      - 0.5 * PARAMS.stockVolatility ** 2
      - Math.log1p(PARAMS.riskFreeRate);
    return p.constant
      + p.gamma * gamma / 10
      + p.logPremium * logPremium
      + p.logRiskFree * Math.log1p(PARAMS.riskFreeRate)
      + p.permanentVariance * sigmaU2
      + p.transitoryVariance * sigmaE2
      + p.replacementRate * PARAMS.postWorkReplacement
      + p.age * age100
      + p.ageSquared * age100 ** 2;
  }

  function retiredDiscountRate(age, gamma) {
    const p = PARAMS.retired;
    const age100 = age / 100;
    const logPremium = Math.log1p(PARAMS.stockReturn)
      - 0.5 * PARAMS.stockVolatility ** 2
      - Math.log1p(PARAMS.riskFreeRate);
    return p.constant
      + p.gamma * gamma / 10
      + p.logPremium * logPremium
      + p.logRiskFree * Math.log1p(PARAMS.riskFreeRate)
      + p.age * age100
      + p.ageSquared * age100 ** 2;
  }

  function allocationShares(humanCapital, financialWealth, gamma) {
    const baseShare = clamp01((PARAMS.stockReturn - PARAMS.riskFreeRate)
      / (gamma * PARAMS.stockVolatility ** 2));
    const rawRecommendedShare = financialWealth > 0
      ? baseShare * (1 + humanCapital / financialWealth)
      : 0;
    return {
      baseShare,
      rawRecommendedShare,
      recommendedShare: clamp01(rawRecommendedShare),
      cappedAt100: rawRecommendedShare > 1,
    };
  }

  function estimatePerson(person, gamma, education) {
    const { age, annualGrossIncome, retirementAge, additionalWorkEndAge } = person;
    const taxEstimate = estimateAfterTaxIncome(annualGrossIncome);
    const annualIncome = taxEstimate.afterTaxIncome;
    if (!(age >= 20 && age <= 75)) throw new Error("현재 나이는 20~75세 범위로 입력해 주세요.");
    if (!(retirementAge >= age && retirementAge <= 80)) throw new Error("퇴직 예상 나이는 현재 나이 이상, 80세 이하로 입력해 주세요.");
    if (!(additionalWorkEndAge >= retirementAge && additionalWorkEndAge <= PARAMS.terminalAge)) {
      throw new Error("추가 소득활동 종료 나이는 퇴직 예상 나이 이상으로 입력해 주세요.");
    }

    const retirementIncomeBase = projectedWage(age, annualIncome, retirementAge);
    let cumulativeDiscount = 1;
    let laborHumanCapital = 0;
    let pensionHumanCapital = 0;

    for (let futureAge = Math.floor(age) + 1; futureAge <= PARAMS.terminalAge; futureAge += 1) {
      let income = 0;
      if (futureAge <= retirementAge) {
        income = projectedWage(age, annualIncome, futureAge);
      } else if (futureAge <= additionalWorkEndAge) {
        income = retirementIncomeBase * PARAMS.additionalWorkReplacement;
      } else {
        income = retirementIncomeBase * PARAMS.postWorkReplacement;
      }

      const rate = futureAge <= retirementAge
        ? workingDiscountRate(futureAge, gamma, education)
        : retiredDiscountRate(futureAge, gamma);
      if (rate <= -1) throw new Error("할인율 가정 오류로 계산할 수 없습니다.");
      cumulativeDiscount *= 1 + rate;
      const presentValue = income / cumulativeDiscount;

      if (futureAge <= additionalWorkEndAge) laborHumanCapital += presentValue;
      else pensionHumanCapital += presentValue;
    }

    return {
      ...taxEstimate,
      age,
      laborHumanCapital,
      pensionHumanCapital,
      totalHumanCapital: laborHumanCapital + pensionHumanCapital,
    };
  }

  function calculate(input) {
    const gamma = Number(input.gamma);
    if (!(gamma >= 4 && gamma <= 10)) throw new Error("위험회피도 γ는 4~10 사이여야 합니다.");
    const education = Number(input.education);
    if (!PARAMS.educationRisk[education]) throw new Error("학력을 선택해 주세요.");

    const self = estimatePerson(input.self, gamma, education);
    const spouse = input.spouse
      ? estimatePerson(input.spouse, gamma, education)
      : { grossIncome: 0, earnedIncome: 0, taxableIncome: 0, incomeTax: 0, localIncomeTax: 0, afterTaxIncome: 0, age: null, laborHumanCapital: 0, pensionHumanCapital: 0, totalHumanCapital: 0 };

    const laborHumanCapital = self.laborHumanCapital + spouse.laborHumanCapital;
    const pensionHumanCapital = self.pensionHumanCapital + spouse.pensionHumanCapital;
    const humanCapital = laborHumanCapital + pensionHumanCapital;
    const assets = input.assets;
    const balances = [assets.dcBalance, assets.irpBalance, assets.otherBalance];
    const equityShares = [assets.dcEquity, assets.irpEquity, assets.otherEquity];
    if (balances.some((n) => !Number.isFinite(n) || n < 0)) throw new Error("금융자산 보유액은 0 이상의 금액으로 입력해 주세요.");
    if (equityShares.some((n) => !Number.isFinite(n) || n < 0 || n > 100)) throw new Error("각 계좌의 주식비중은 0~100%로 입력해 주세요.");

    const financialWealth = balances.reduce((sum, n) => sum + n, 0);
    const equityAmount = balances.reduce((sum, balance, i) => sum + balance * equityShares[i] / 100, 0);
    const actualShare = financialWealth > 0 ? equityAmount / financialWealth : 0;
    const allocation = allocationShares(humanCapital, financialWealth, gamma);

    return {
      version: PARAMS.version,
      gamma,
      education,
      self,
      spouse,
      laborHumanCapital,
      pensionHumanCapital,
      humanCapital,
      financialWealth,
      equityAmount,
      actualShare,
      ...allocation,
      hOverW: financialWealth > 0 ? humanCapital / financialWealth : 0,
      gap: allocation.recommendedShare - actualShare,
      hasNoFinancialWealth: financialWealth === 0,
    };
  }

  const api = { PARAMS, SURVEY_BENCHMARKS, peerBenchmark, peerComparison, parseNumericInput, formatThousands, ageFromBirthYear, earnedIncomeDeduction, progressiveIncomeTax, estimateAfterTaxIncome, projectedWage, incomeTrajectory, workingDiscountRate, retiredDiscountRate, estimatePerson, allocationShares, calculate, clamp01 };
  root.HumanCapitalCalculator = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);

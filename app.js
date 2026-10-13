(function () {
  "use strict";

  const form = document.getElementById("consultation-form");
  const $ = (id) => document.getElementById(id);
  const number = (id) => HumanCapitalCalculator.parseNumericInput($(id).value);
  const money = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
  const decimal = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 });
  const percent = (value, digits = 1) => `${(value * 100).toFixed(digits)}%`;
  const eok = (manwon) => `${decimal.format(manwon / 10000)}억원`;
  const peerEok = (manwon) => `${(manwon / 10000).toFixed(1)}억원`;

  function formatIncomeInput(id) {
    const field = $(id);
    const raw = field.value.trim().replaceAll(",", "");
    if (raw === "" || !Number.isFinite(Number(raw))) return;
    field.value = HumanCapitalCalculator.formatThousands(Number(raw));
  }

  for (const id of ["self-gross-income", "spouse-gross-income"]) {
    $(id).addEventListener("focus", () => { $(id).value = $(id).value.replaceAll(",", ""); });
    $(id).addEventListener("blur", () => formatIncomeInput(id));
  }

  function peerPositionLabel(value, distribution) {
    const comparison = HumanCapitalCalculator.peerComparison(value, distribution);
    if (comparison.zone === "P25 미만") return "P25 미만 · 또래 하위 25% 구간";
    if (comparison.zone === "P75 초과") return "P75 초과 · 또래 상위 25% 구간";
    if (comparison.zone === "사분위 값 동일") return "또래 사분위 기준값과 동일";
    return `${comparison.zone} 구간`;
  }

  function renderPeerTrack(prefix, value, distribution, format, unavailable = false) {
    const marker = $(`${prefix}-marker`);
    const iqr = $(`${prefix}-iqr`);
    const track = $(`${prefix}-track`);
    const comparison = HumanCapitalCalculator.peerComparison(value, distribution);
    const medianPosition = distribution.p25 === distribution.p75
      ? 50
      : 25 + 50 * (distribution.median - distribution.p25) / (distribution.p75 - distribution.p25);
    const chartX = (position) => 12 + position / 100 * 376;
    marker.setAttribute("cx", chartX(comparison.position));
    marker.setAttribute("visibility", unavailable ? "hidden" : "visible");
    const medianX = chartX(medianPosition);
    $(`${prefix}-median-marker`).setAttribute("x1", medianX);
    $(`${prefix}-median-marker`).setAttribute("x2", medianX);
    const pointRange = distribution.p25 === distribution.p75;
    iqr.setAttribute("x", pointRange ? medianX : 106);
    iqr.setAttribute("width", pointRange ? 0 : 188);
    setText(`${prefix}-p25`, format(distribution.p25));
    setText(`${prefix}-median`, format(distribution.median));
    setText(`${prefix}-p75`, format(distribution.p75));
    track.setAttribute("aria-label", `P25 ${format(distribution.p25)}, 중앙값 ${format(distribution.median)}, P75 ${format(distribution.p75)}; 내 결과 ${unavailable ? "비교 제외" : format(value)}`);
  }

  function updatePeerComparisons(input, result) {
    const benchmark = HumanCapitalCalculator.peerBenchmark(input.self.age);
    const peerMetrics = $("peer-metrics");
    if (!benchmark) {
      setText("peer-cohort", "비교 표본 없음");
      setText("peer-sample", "조사 표본은 만 30~59세입니다.");
      peerMetrics.classList.add("is-hidden");
      setText("peer-footnote", "연령대별 비교자료가 없어 상대 위치를 표시하지 않습니다.");
      setText("report-peer-cohort", "조사 표본은 만 30~59세이므로 또래 비교를 제공하지 않습니다.");
      setText("report-peer-note", "연령대별 비교자료가 없습니다.");
      $("report-peer-grid").classList.add("is-hidden");
      $("report-peer-legend").classList.add("is-hidden");
      for (const key of ["h", "w", "actual", "target"]) {
        for (const suffix of ["own", "p25", "median", "p75"]) setText(`report-peer-${key}-${suffix}`, "비교 불가");
        $(`peer-${key}-marker`).setAttribute("visibility", "hidden");
        $(`report-peer-${key}-marker`).setAttribute("visibility", "hidden");
      }
      return;
    }

    peerMetrics.classList.remove("is-hidden");
    $("report-peer-grid").classList.remove("is-hidden");
    $("report-peer-legend").classList.remove("is-hidden");
    const band = `${Math.floor(input.self.age / 10) * 10}대`;
    setText("peer-cohort", band);
    setText("peer-sample", `2026년 조사 응답자 ${benchmark.n.toLocaleString("ko-KR")}명 · 본인 연령대`);
    setText("peer-footnote", "점은 내 결과, 세로선은 중앙값, 색 구간은 P25~P75입니다. 구간 안 점 위치는 값 차이를 선형 표시한 것으로 백분위가 아닙니다. 구간 밖은 경계에 표시합니다.");
    setText("report-peer-cohort", `2026년 조사 ${band} 응답자 ${benchmark.n.toLocaleString("ko-KR")}명 기준. H=L(근로성+연금성 현재가치), W=F3 금융자산입니다.`);

    const metrics = [
      { key: "h", value: result.humanCapital, distribution: benchmark.humanCapital, format: peerEok },
      { key: "w", value: result.financialWealth, distribution: benchmark.financialWealth, format: peerEok },
      { key: "actual", value: result.actualShare, distribution: benchmark.actualShare, format: (v) => percent(v), unavailable: result.hasNoFinancialWealth },
      { key: "target", value: result.recommendedShare, distribution: benchmark.recommendedShare, format: (v) => percent(v) },
    ];

    for (const metric of metrics) {
      const { key, value, distribution, format } = metric;
      const sampleLabel = key === "actual" ? ` · W>0 ${distribution.n.toLocaleString("ko-KR")}명` : "";
      setText(`peer-${key}-value`, metric.unavailable ? "해당 없음" : format(value));
      setText(`peer-${key}-position`, metric.unavailable ? `W=0 · 실제 주식비중 비교 제외${sampleLabel}` : `${peerPositionLabel(value, distribution)}${sampleLabel}`);
      renderPeerTrack(`peer-${key}`, value, distribution, format, metric.unavailable);
      setText(`report-peer-${key}-own`, metric.unavailable ? "해당 없음 (W=0)" : format(value));
      renderPeerTrack(`report-peer-${key}`, value, distribution, format, metric.unavailable);
    }
    setText("report-peer-note", `자료: 2026년 인적자본 기반 투자비중 적정성 조사 최종 분석자료(N=2,000). 색 구간 P25~P75는 가운데 50% 응답 구간이며, 구간 안 점 위치는 값 차이를 선형 표시한 것으로 백분위 추정이 아닙니다. 실제 주식비중은 W>0인 ${benchmark.actualShare.n.toLocaleString("ko-KR")}명만 비교하며, 적정비중은 W=0 응답자를 0%로 처리했습니다. 본인 H는 세전소득에서 세후소득을 단순 추정하므로 입력 기준 차이가 있습니다. 서베이 표본 내 참고 위치입니다.`);
  }

  function updateIncomeChart(input) {
    const selfPath = HumanCapitalCalculator.incomeTrajectory(input.self);
    const paths = [{ key: "self", values: selfPath }];
    if (input.spouse) paths.push({ key: "spouse", values: HumanCapitalCalculator.incomeTrajectory(input.spouse) });

    const startAge = Math.min(...paths.map(({ values }) => values[0].age));
    const endAge = HumanCapitalCalculator.PARAMS.terminalAge;
    const maxIncome = Math.max(1, ...paths.flatMap(({ values }) => values.map((point) => point.annualIncome)));
    const chart = { left: 52, right: 584, top: 18, bottom: 142 };
    const x = (age) => chart.left + (age - startAge) / (endAge - startAge) * (chart.right - chart.left);
    const y = (income) => chart.bottom - income / maxIncome * (chart.bottom - chart.top);
    const transitionAges = [...new Set(paths.flatMap(({ values }, index) => {
      const person = index === 0 ? input.self : input.spouse;
      return [person.retirementAge, person.additionalWorkEndAge];
    }))].filter((age) => age >= startAge && age <= endAge).sort((a, b) => a - b);
    const changes = paths.flatMap(({ key, values }, index) => {
      const person = index === 0 ? input.self : input.spouse;
      const changeAges = [...new Set([person.retirementAge + 1, person.additionalWorkEndAge + 1])];
      return changeAges.flatMap((age) => {
        const point = values.find((candidate) => candidate.age === age);
        return point ? [{ key, age, income: point.annualIncome }] : [];
      });
    });
    const markers = $("income-transition-markers");
    markers.replaceChildren();
    for (const [index, age] of transitionAges.entries()) {
      const position = x(age);
      const guide = document.createElementNS("http://www.w3.org/2000/svg", "line");
      guide.setAttribute("class", "chart-transition-line");
      guide.setAttribute("x1", position);
      guide.setAttribute("x2", position);
      guide.setAttribute("y1", chart.top);
      guide.setAttribute("y2", chart.bottom + 7);
      markers.append(guide);

      const tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
      tick.setAttribute("class", "chart-transition-tick");
      tick.setAttribute("x1", position);
      tick.setAttribute("x2", position);
      tick.setAttribute("y1", chart.bottom);
      tick.setAttribute("y2", chart.bottom + 8);
      markers.append(tick);

      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("class", "chart-transition-label");
      label.setAttribute("x", position);
      label.setAttribute("y", chart.bottom + 20 + (index % 2) * 13);
      label.setAttribute("text-anchor", position < chart.left + 25 ? "start" : position > chart.right - 25 ? "end" : "middle");
      label.textContent = `${age}세`;
      markers.append(label);
    }

    const changeMarkers = $("income-change-markers");
    changeMarkers.replaceChildren();
    for (const change of changes) {
      const guide = document.createElementNS("http://www.w3.org/2000/svg", "line");
      guide.setAttribute("class", "chart-income-guide");
      guide.setAttribute("x1", chart.left);
      guide.setAttribute("x2", x(change.age));
      guide.setAttribute("y1", y(change.income));
      guide.setAttribute("y2", y(change.income));
      changeMarkers.append(guide);

      const point = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      point.setAttribute("class", `chart-income-point chart-income-point-${change.key}`);
      point.setAttribute("cx", x(change.age));
      point.setAttribute("cy", y(change.income));
      point.setAttribute("r", 3.2);
      changeMarkers.append(point);
    }

    const axisLabelMap = new Map();
    for (const income of [maxIncome, maxIncome / 2, 0]) {
      const rounded = Math.round(income);
      axisLabelMap.set(rounded, { income, label: money.format(rounded), kind: "scale" });
    }
    for (const { income } of changes) {
      const rounded = Math.round(income);
      axisLabelMap.set(rounded, { income: rounded, label: money.format(rounded), kind: "change" });
    }
    const axisLabels = [...axisLabelMap.values()].sort((a, b) => y(a.income) - y(b.income));
    let previousLabelY = chart.top - 7;
    for (const item of axisLabels) {
      item.labelY = Math.max(y(item.income) + 3, previousLabelY + 10);
      previousLabelY = item.labelY;
    }
    const overflow = previousLabelY - (chart.bottom + 3);
    if (overflow > 0) axisLabels.forEach((item) => { item.labelY -= overflow; });

    const yLabels = $("income-y-axis-labels");
    yLabels.replaceChildren();
    for (const item of axisLabels) {
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("class", `chart-y-label${item.kind === "change" ? " chart-y-change-label" : ""}`);
      label.setAttribute("x", 46);
      label.setAttribute("y", item.labelY);
      label.setAttribute("text-anchor", "end");
      label.textContent = item.label;
      yLabels.append(label);
    }

    for (const { key, values } of paths) {
      const line = $(`income-${key}-line`);
      const current = $(`income-${key}-current`);
      line.setAttribute("points", values.map((point) => `${x(point.age).toFixed(1)},${y(point.annualIncome).toFixed(1)}`).join(" "));
      current.setAttribute("cx", x(values[0].age));
      current.setAttribute("cy", y(values[0].annualIncome));
      current.setAttribute("visibility", "visible");
    }
    if (!input.spouse) {
      $("income-spouse-line").setAttribute("points", "");
      $("income-spouse-current").setAttribute("visibility", "hidden");
    }
    $("income-spouse-legend").classList.toggle("is-hidden", !input.spouse);
    $("report-income-chart").setAttribute("aria-label", `나이에 따른 세후 연간소득 예상 경로. 주요 전환 나이: ${transitionAges.map((age) => `${age}세`).join(", ") || "없음"}`);
    setText("income-x-start", `약 ${startAge}세`);
    setText("income-x-mid", `약 ${Math.round((startAge + endAge) / 2)}세`);
    setText("income-chart-note", `현재 세후소득을 기준으로 근로기간에는 모형 임금경로를 적용하고, 주된 직장 퇴직 후 ${Math.round(HumanCapitalCalculator.PARAMS.additionalWorkReplacement * 100)}%, 추가 소득활동 종료 후 ${Math.round(HumanCapitalCalculator.PARAMS.postWorkReplacement * 100)}%의 소득대체율을 적용한 참고 경로입니다. 실제 소득과 다를 수 있으며${input.spouse ? " 본인과 배우자는 각각 표시됩니다." : ""}`);
  }

  function readInput() {
    const spouseOn = $("has-spouse").checked;
    return {
      gamma: number("gamma"),
      education: number("self-education"),
      self: {
        birthYear: number("self-birth-year"),
        age: HumanCapitalCalculator.ageFromBirthYear(number("self-birth-year")),
        annualGrossIncome: number("self-gross-income"),
        retirementAge: number("self-retire"),
        additionalWorkEndAge: number("self-work-end"),
      },
      spouse: spouseOn ? {
        birthYear: number("spouse-birth-year"),
        age: HumanCapitalCalculator.ageFromBirthYear(number("spouse-birth-year")),
        annualGrossIncome: number("spouse-gross-income"),
        retirementAge: number("spouse-retire"),
        additionalWorkEndAge: number("spouse-work-end"),
      } : null,
      assets: {
        dcBalance: number("dc-balance"),
        dcEquity: number("dc-equity"),
        irpBalance: number("irp-balance"),
        irpEquity: number("irp-equity"),
        otherBalance: number("other-balance"),
        otherEquity: number("other-equity"),
      },
    };
  }

  function validate(input) {
    const required = [
      ["self-birth-year", "본인 출생연도"],
      ["self-education", "본인 학력"],
      ["self-gross-income", "본인 연간 세전 근로소득"],
      ["self-retire", "본인 주된 직장 퇴직 예상 나이"],
      ["self-work-end", "본인 추가 소득활동 종료 나이"],
      ["dc-balance", "DC 보유액"], ["dc-equity", "DC 주식 비중"],
      ["irp-balance", "IRP 보유액"], ["irp-equity", "IRP 주식 비중"],
      ["other-balance", "기타 금융자산 보유액"], ["other-equity", "기타 금융자산 주식 비중"],
    ];
    for (const [id, label] of required) {
      if ($(id).value.trim() === "") return `${label}을(를) 입력해 주세요.`;
    }
    if (!Number.isInteger(input.self.birthYear) || input.self.birthYear < 1951 || input.self.birthYear > 2006) return "본인 출생연도는 1951~2006년 사이로 입력해 주세요. (2026년 기준 20~75세)";
    if (input.self.retirementAge < input.self.age || input.self.retirementAge > 80) return "본인의 퇴직 예상 나이를 확인해 주세요.";
    if (input.self.additionalWorkEndAge < input.self.retirementAge || input.self.additionalWorkEndAge > 99) return "본인의 추가 소득활동 종료 나이를 확인해 주세요.";
    if (!Number.isFinite(input.self.annualGrossIncome) || input.self.annualGrossIncome < 0) return "본인 연간 세전 근로소득은 0 이상의 금액으로 입력해 주세요.";
    if (input.spouse) {
      const spouseRequired = [
        ["spouse-birth-year", "배우자 출생연도"], ["spouse-gross-income", "배우자 연간 세전 근로소득"],
        ["spouse-retire", "배우자 퇴직 예상 나이"], ["spouse-work-end", "배우자 추가 소득활동 종료 나이"],
      ];
      for (const [id, label] of spouseRequired) {
        if ($(id).value.trim() === "") return `${label}을(를) 입력해 주세요.`;
      }
      if (!Number.isInteger(input.spouse.birthYear) || input.spouse.birthYear < 1951 || input.spouse.birthYear > 2006) return "배우자 출생연도는 1951~2006년 사이로 입력해 주세요. (2026년 기준 20~75세)";
      if (input.spouse.retirementAge < input.spouse.age || input.spouse.retirementAge > 80) return "배우자의 퇴직 예상 나이를 확인해 주세요.";
      if (input.spouse.additionalWorkEndAge < input.spouse.retirementAge || input.spouse.additionalWorkEndAge > 99) return "배우자의 추가 소득활동 종료 나이를 확인해 주세요.";
      if (!Number.isFinite(input.spouse.annualGrossIncome) || input.spouse.annualGrossIncome < 0) return "배우자 연간 세전 근로소득은 0 이상의 금액으로 입력해 주세요.";
    }
    for (const [key, value] of Object.entries(input.assets)) {
      if (!Number.isFinite(value)) return "금융자산 보유액과 주식비중을 모두 입력해 주세요. 미보유 항목은 0으로 입력합니다.";
      if (key.toLowerCase().includes("balance") && value < 0) return "금융자산 보유액은 0 이상이어야 합니다.";
      if (key.toLowerCase().includes("equity") && (value < 0 || value > 100)) return "주식비중은 0~100%로 입력해 주세요.";
    }
    if (!Number.isFinite(input.gamma)) return "손실 감내 수준을 선택해 주세요.";
    return "";
  }

  function setText(id, value) { $(id).textContent = value; }

  function updateDerivedValues() {
    for (const prefix of ["self", "spouse"]) {
      const year = number(`${prefix}-birth-year`);
      const ageOutput = $(`${prefix}-age-output`);
      ageOutput.textContent = Number.isInteger(year)
        ? `2026년 기준 약 ${HumanCapitalCalculator.ageFromBirthYear(year)}세 (생일 미반영)`
        : "2026년 기준 나이 —";

      const gross = number(`${prefix}-gross-income`);
      const netOutput = $(`${prefix}-net-income`);
      if (Number.isFinite(gross) && gross >= 0) {
        const estimate = HumanCapitalCalculator.estimateAfterTaxIncome(gross);
        netOutput.textContent = `세후 추정 ${money.format(Math.round(estimate.afterTaxIncome))}만원`;
      } else {
        netOutput.textContent = "세후 추정 —";
      }
    }
  }

  function updateReport(input, result) {
    const hasSpouse = Boolean(input.spouse);
    const ageLabel = hasSpouse
      ? `본인 약 ${input.self.age}세 · 배우자 약 ${input.spouse.age}세 · 가구 기준 (2026년)`
      : `본인 약 ${input.self.age}세 · 단독 기준 (2026년)`;
    const values = {
      "report-date": new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeZone: "Asia/Seoul" }).format(new Date()),
      "report-profile": `${ageLabel} · 위험회피도 γ=${result.gamma}`,
      "report-recommended": percent(result.recommendedShare),
      "report-cap-note": result.cappedAt100 ? "100% 상한 적용" : "",
      "report-actual": percent(result.actualShare),
      "report-target": percent(result.recommendedShare),
      "report-gap": `${result.gap >= 0 ? "+" : "−"}${Math.abs(result.gap * 100).toFixed(1)}%p`,
      "report-h-labor": eok(result.laborHumanCapital),
      "report-h-pension": eok(result.pensionHumanCapital),
      "report-h": eok(result.humanCapital),
      "report-w": eok(result.financialWealth),
      "report-ratio": result.hasNoFinancialWealth ? "산출불가 (W=0)" : `${decimal.format(result.hOverW)}배`,
    };
    Object.entries(values).forEach(([id, value]) => setText(id, value));
    updateIncomeChart(input);
    const interpretation = result.hasNoFinancialWealth
      ? "투자 대상 금융자산 W가 없어 H/W는 산출되지 않습니다. 비교를 위한 보고서 기준에 따라 실제·모형상 주식비중은 0%로 표시했습니다."
      : result.gap > 0.005
        ? `현재 입력과 기준 가정에서 모형상 비중이 실제 비중보다 ${(result.gap * 100).toFixed(1)}%p 높게 산출됐습니다. 이 차이는 상담을 위한 비교값이며, 그대로 조정해야 할 투자 지시를 뜻하지 않습니다.`
        : result.gap < -0.005
          ? `현재 입력과 기준 가정에서 모형상 비중이 실제 비중보다 ${Math.abs(result.gap * 100).toFixed(1)}%p 낮게 산출됐습니다. 지출·부채·유동성 등 다른 조건을 함께 확인해 해석해야 합니다.`
          : "현재 입력과 기준 가정에서 실제 주식비중과 모형상 비중이 비슷하게 산출됐습니다. 모형 결과는 상담을 위한 참고값입니다.";
    setText("report-interpretation", interpretation);
    setText("report-client", "상담 결과 요약");
    updatePeerComparisons(input, result);
  }

  function updateResults(input, result) {
    $("empty-state").classList.add("is-hidden");
    $("results").classList.remove("is-hidden");
    $("result-state").textContent = "계산 완료";
    $("result-state").classList.add("is-ready");
    $("print-button").disabled = false;
    $("view-report-button").disabled = false;

    setText("recommended-share", percent(result.recommendedShare));
    setText("actual-share", percent(result.actualShare));
    setText("target-share", percent(result.recommendedShare));
    setText("gap-share", `${result.gap >= 0 ? "+" : "−"}${Math.abs(result.gap * 100).toFixed(1)}%p`);
    setText("human-capital", eok(result.humanCapital));
    setText("financial-wealth", eok(result.financialWealth));
    setText("h-over-w", result.hasNoFinancialWealth ? "산출불가" : `${decimal.format(result.hOverW)}배`);
    setText("h-labor", eok(result.laborHumanCapital));
    setText("h-pension", eok(result.pensionHumanCapital));
    $("actual-meter").style.width = `${result.actualShare * 100}%`;
    $("target-meter").style.width = `${result.recommendedShare * 100}%`;
    $("capped-note").classList.toggle("is-hidden", !result.cappedAt100);

    let message;
    if (result.hasNoFinancialWealth) {
      message = "W=0이면 H/W는 정의되지 않습니다. 이 도구는 최신 보고서의 비교 규칙에 따라 적정·실제 비중을 0%로 표시합니다.";
    } else if (result.cappedAt100) {
      message = "인적자본을 반영한 계산값이 100%를 넘어 상한이 적용됐습니다. 상한 도달 여부와 함께 손실감내·유동성 조건을 검토하세요.";
    } else {
      message = `H는 금융자산 W와 별도로 추정한 생애소득의 현재가치입니다. H/W는 ${decimal.format(result.hOverW)}배입니다.`;
    }
    if (input.self.age < 30 || input.self.age > 59) {
      message += " 본인 연령이 서베이 비교표본(30~59세)을 벗어나 또래 비교를 제공하지 않습니다.";
    }
    setText("model-message", message);
    $("form-status").textContent = "입력값이 변경되면 결과가 자동으로 다시 계산됩니다. 저장·전송되지 않습니다.";
    $("form-status").classList.remove("is-error");
    updateReport(input, result);
  }

  function showError(message) {
    $("empty-state").classList.remove("is-hidden");
    $("results").classList.add("is-hidden");
    $("result-state").textContent = "입력 확인";
    $("result-state").classList.remove("is-ready");
    $("print-button").disabled = true;
    $("view-report-button").disabled = true;
    if (message) {
      $("form-status").textContent = message;
      $("form-status").classList.add("is-error");
    } else {
      $("form-status").textContent = "필수 입력을 완료하면 결과가 자동으로 갱신됩니다.";
      $("form-status").classList.remove("is-error");
    }
  }

  function recalculate() {
    updateDerivedValues();
    const input = readInput();
    const message = validate(input);
    if (message) return showError(message);
    try {
      updateResults(input, HumanCapitalCalculator.calculate(input));
    } catch (error) {
      showError(error.message || "입력값을 확인해 주세요.");
    }
  }

  function setValues(values) {
    Object.entries(values).forEach(([id, value]) => {
      $(id).value = String(value);
      if (id.endsWith("-gross-income")) formatIncomeInput(id);
    });
    recalculate();
  }

  function toggleSpouse() {
    const enabled = $("has-spouse").checked;
    const block = $("spouse-block");
    block.classList.toggle("is-hidden", !enabled);
    block.setAttribute("aria-hidden", String(!enabled));
    block.querySelectorAll("input").forEach((input) => { input.disabled = !enabled; });
    recalculate();
  }

  form.addEventListener("input", recalculate);
  form.addEventListener("change", recalculate);
  $("has-spouse").addEventListener("change", toggleSpouse);
  $("sample-button").addEventListener("click", () => {
    $("has-spouse").checked = true;
    toggleSpouse();
    setValues({
      "self-birth-year": 1976, "self-education": 3, "self-gross-income": 5000, "self-retire": 60, "self-work-end": 65,
      "spouse-birth-year": 1978, "spouse-gross-income": 3600, "spouse-retire": 60, "spouse-work-end": 63,
      "gamma": 7,
      "dc-balance": 1500, "dc-equity": 30,
      "irp-balance": 1000, "irp-equity": 45,
      "other-balance": 3500, "other-equity": 40,
    });
  });
  $("reset-button").addEventListener("click", () => {
    window.setTimeout(() => {
      $("has-spouse").checked = false;
      toggleSpouse();
      showError("");
    }, 0);
  });
  $("print-button").addEventListener("click", () => window.print());
  $("view-report-button").addEventListener("click", () => window.print());

  toggleSpouse();
  showError("");
})();


(() => {
  const mobileStyle = document.createElement("style");
  mobileStyle.textContent = `@media (max-width: 880px) {
    #print-report.is-mobile-report { position: fixed; z-index: 1000; inset: 0; display: block; overflow-y: auto; padding: 14px; background: #fff; color: #1d2d42; overscroll-behavior: contain; }
    .mobile-report-actions { position: sticky; z-index: 2; top: -14px; display: flex; justify-content: space-between; gap: 9px; margin: -14px -14px 14px; padding: 10px 14px; border-bottom: 1px solid #d9e1df; background: #fff; }
    .mobile-report-actions button { min-height: 40px; padding: 0 14px; border: 1px solid #173b63; border-radius: 3px; background: #fff; color: #173b63; font: inherit; font-weight: 700; }
    .mobile-report-actions button:last-child { background: #173b63; color: #fff; }
  }
  @media print { .mobile-report-actions { display: none !important; } }
  `;
  document.head.append(mobileStyle);

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("#print-button, #view-report-button");
    if (!trigger || !window.matchMedia("(max-width: 880px)").matches) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const report = document.getElementById("print-report");
    if (!report) return window.print();
    report.classList.add("is-mobile-report");
    report.setAttribute("aria-hidden", "false");

    if (!report.querySelector(".mobile-report-actions")) {
      const actions = document.createElement("div");
      actions.className = "mobile-report-actions";
      const close = document.createElement("button");
      close.type = "button";
      close.textContent = "닫기";
      close.addEventListener("click", () => {
        report.classList.remove("is-mobile-report");
        report.setAttribute("aria-hidden", "true");
        trigger.focus();
      });
      const print = document.createElement("button");
      print.type = "button";
      print.textContent = "인쇄 · PDF 저장";
      print.addEventListener("click", () => window.print());
      actions.append(close, print);
      report.prepend(actions);
      close.focus();
    }
  }, true);

  document.addEventListener("keydown", (event) => {
    const report = document.getElementById("print-report");
    if (event.key === "Escape" && report?.classList.contains("is-mobile-report")) {
      report.classList.remove("is-mobile-report");
      report.setAttribute("aria-hidden", "true");
    }
  });
})();


(() => {
  let libraryPromise;
  const loadPdf = () => {
    if (window.html2pdf) return Promise.resolve();
    if (libraryPromise) return libraryPromise;
    libraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      script.integrity = "sha512-GsLlZN/3F2ErC5ifS5QtgpiJtWd43JWSuIgh7mbzZ8zBps+dvLus+V+eNQATqgA/HdeKFVgA5v3S/cIrLF7QnIg==";
      script.crossOrigin = "anonymous";
      script.referrerPolicy = "no-referrer";
      script.onload = resolve;
      script.onerror = () => reject(new Error("PDF 생성 도구를 불러오지 못했습니다."));
      document.head.append(script);
    });
    return libraryPromise;
  };

  const printRules = () => {
    const rules = [];
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.conditionText === "print") {
            for (const item of rule.cssRules) if (item.type !== CSSRule.PAGE_RULE) rules.push(item.cssText);
          }
        }
      } catch {}
    }
    return rules.join("\n");
  };

  async function savePdf() {
    const buttons = [...document.querySelectorAll("#print-button, #view-report-button")];
    const labels = buttons.map((button) => button.textContent);
    let stage;
    buttons.forEach((button) => { button.disabled = true; button.textContent = "PDF 생성 중…"; });
    try {
      await loadPdf();
      stage = document.createElement("div");
      stage.id = "pdf-export-stage";
      stage.style.cssText = "position:fixed;left:0;top:0;width:794px;padding:53px 60px;box-sizing:border-box;background:#fff;visibility:hidden;z-index:-1";
      const report = document.getElementById("print-report").cloneNode(true);
      report.id = "pdf-export-report";
      report.style.setProperty("display", "block", "important");
      report.style.width = "100%";
      report.removeAttribute("aria-hidden");
      report.querySelectorAll(".mobile-report-actions").forEach((item) => item.remove());
      const style = document.createElement("style");
      style.textContent = printRules() + "\n#pdf-export-report .report-footer{position:static}";
      report.prepend(style);
      stage.append(report);
      document.body.append(stage);
      const date = new Date().toISOString().slice(0, 10);
      await window.html2pdf().set({
        margin: 0,
        filename: "인적자본_투자비중_리포트_" + date + ".pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, backgroundColor: "#ffffff", windowWidth: 794, scrollX: 0, scrollY: 0 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] }
      }).from(report).save();
    } catch (error) {
      const status = document.getElementById("form-status");
      if (status) status.textContent = (error.message || "PDF 생성에 실패했습니다.") + " 인쇄 창을 엽니다.";
      window.print();
    } finally {
      stage?.remove();
      buttons.forEach((button, index) => { button.disabled = false; button.textContent = labels[index]; });
    }
  }

  window.addEventListener("click", (event) => {
    const button = event.target.closest("#print-button, #view-report-button");
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    savePdf();
  }, true);
})();


for (const id of ["print-button", "view-report-button"]) {
  const button = document.getElementById(id);
  if (button) button.textContent = "PDF 다운로드";
}

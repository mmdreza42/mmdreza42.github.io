(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const num = (id, fallback = 0) => {
    const element = $(id);
    if (!element) return fallback;

    const value = parseFloat(element.value);
    return Number.isFinite(value) ? value : fallback;
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const fmt = (value, digits = 2) =>
    Number.isFinite(value)
      ? value.toLocaleString("fa-IR", {
          maximumFractionDigits: digits,
        })
      : "—";

  const modeText = {
    "on-grid":
      "در حالت On-Grid، سیستم به شبکه برق متصل است و هدف اصلی تأمین بخشی یا تمام انرژی مصرفی با پنل خورشیدی است. باتری برای این محاسبه الزامی نیست.",

    "off-grid":
      "در حالت Off-Grid، شبکه برق به‌عنوان منبع پشتیبان در نظر گرفته نمی‌شود؛ بنابراین ظرفیت باتری، روزهای خودکفایی و توان Surge اهمیت بیشتری دارند.",
  };

  // ============================================================
  // LOADS
  // ============================================================

  const loadsBody = $("loadsBody");

  function addLoadRow(data = {}) {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>
        <input
          class="load-name"
          value="${data.name || ""}"
          placeholder="مثلاً یخچال"
        >
      </td>

      <td>
        <input
          class="load-qty"
          type="number"
          min="0"
          step="1"
          value="${data.qty ?? 1}"
        >
      </td>

      <td>
        <input
          class="load-watt"
          type="number"
          min="0"
          step="1"
          value="${data.watt ?? 100}"
        >
      </td>

      <td>
        <input
          class="load-hours"
          type="number"
          min="0"
          max="24"
          step="0.1"
          value="${data.hours ?? 1}"
        >
      </td>

      <td>
        <input
          class="load-days"
          type="number"
          min="1"
          max="31"
          step="1"
          value="${data.days ?? 30}"
        >
      </td>

      <td>
        <input
          class="load-coincidence"
          type="number"
          min="0"
          max="1"
          step="0.05"
          value="${data.coincidence ?? 1}"
        >
      </td>

      <td>
        <input
          class="load-surge"
          type="number"
          min="0"
          step="1"
          value="${data.surge ?? data.watt ?? 100}"
        >
      </td>

      <td>
        <button
          type="button"
          class="btn btn-ghost remove-load"
          aria-label="حذف"
        >
          ×
        </button>
      </td>
    `;

    loadsBody.appendChild(tr);

    updateLoadPreview();
  }

  function readLoads() {
    return [...loadsBody.querySelectorAll("tr")].map((row) => {
      const get = (selector) =>
        parseFloat(row.querySelector(selector)?.value) || 0;

      return {
        name: row.querySelector(".load-name")?.value || "وسیله",

        qty: get(".load-qty"),

        watt: get(".load-watt"),

        hours: get(".load-hours"),

        days: get(".load-days"),

        coincidence: get(".load-coincidence"),

        surge: get(".load-surge"),
      };
    });
  }

  function calculateLoads() {
    const loads = readLoads();

    let daily = 0;
    let peak = 0;
    let surge = 0;

    loads.forEach((load) => {
      /*
       * Daily Energy
       *
       * E = P × Quantity × Hours
       *
       * W → kWh
       */
      daily += (load.qty * load.watt * load.hours) / 1000;

      /*
       * Estimated simultaneous peak
       */
      peak += load.qty * load.watt * load.coincidence;

      /*
       * Starting / Surge load
       */
      surge += load.qty * Math.max(load.watt, load.surge) * load.coincidence;
    });

    return {
      loads,

      daily,

      monthly: daily * 30,

      annual: daily * 365,

      peak,

      surge,
    };
  }

  function updateLoadPreview() {
    const result = calculateLoads();

    $("loadEnergyPreview").textContent = `${fmt(result.daily)} kWh/day`;

    $("loadPeakPreview").textContent = `${fmt(result.peak)} W`;

    $("loadSurgePreview").textContent = `${fmt(result.surge)} W`;
  }

  loadsBody.addEventListener("input", updateLoadPreview);

  loadsBody.addEventListener("click", (event) => {
    if (event.target.classList.contains("remove-load")) {
      event.target.closest("tr")?.remove();

      updateLoadPreview();
    }
  });

  $("addLoad").addEventListener("click", () => addLoadRow());

  // Default loads
  addLoadRow({
    name: "یخچال",
    qty: 1,
    watt: 250,
    hours: 10,
    days: 30,
    coincidence: 0.8,
    surge: 800,
  });

  addLoadRow({
    name: "روشنایی",
    qty: 8,
    watt: 12,
    hours: 6,
    days: 30,
    coincidence: 0.9,
    surge: 12,
  });

  // ============================================================
  // SYSTEM MODE
  // ============================================================

  function updateMode() {
    const mode = document.querySelector(
      'input[name="systemType"]:checked',
    )?.value;

    if (!mode) return;

    $("modeExplanation").textContent = modeText[mode];

    /*
     * Battery section only for Off-Grid
     */
    $("batterySection").classList.toggle("hidden", mode !== "off-grid");

    $("batteryResultsCard").classList.toggle("hidden", mode !== "off-grid");
  }

  document.querySelectorAll('input[name="systemType"]').forEach((input) => {
    input.addEventListener("change", updateMode);
  });

  updateMode();

  // ============================================================
  // LOSSES
  // ============================================================

  function lossFactor() {
    const lossIds = [
      "soiling",
      "shading",
      "mismatch",
      "dcWiring",
      "connections",
      "acWiring",
      "otherLoss",
      "degradation",
    ];

    /*
     * Losses are applied sequentially.
     *
     * Factor =
     * (1-L1)
     * × (1-L2)
     * × ...
     */

    return lossIds.reduce((factor, id) => {
      const loss = clamp(num(id), 0, 100) / 100;

      return factor * (1 - loss);
    }, 1);
  }

  // ============================================================
  // DEMAND
  // ============================================================

  function getDemand(loadInfo) {
    const directDaily = num("dailyEnergy");

    const monthly = num("monthlyEnergy");

    const annual = num("annualEnergy");

    let daily = directDaily;

    /*
     * Monthly → Daily
     */
    if (!daily && monthly) {
      daily = monthly / 30;
    }

    /*
     * Annual → Daily
     */
    if (!daily && annual) {
      daily = annual / 365;
    }

    /*
     * Appliance calculation
     */
    if (!daily) {
      daily = loadInfo.daily;
    }

    return {
      daily: daily || 0,

      monthly: monthly || daily * 30,

      annual: annual || daily * 365,

      peak: loadInfo.peak,

      surge: loadInfo.surge,
    };
  }

  // ============================================================
  // TEMPERATURE
  // ============================================================

  /*
   * Voc increases when temperature decreases.
   *
   * Voc(T) =
   * Voc(STC) ×
   * [1 + βVoc × (T - 25)]
   *
   * β is converted from %/°C to decimal.
   */

  function coldVoc() {
    const voc = num("panelVoc");

    const coefficient = num("vocCoeff", -0.28) / 100;

    const minimumTemperature = num("minTemp", 25);

    return voc * (1 + coefficient * (minimumTemperature - 25));
  }

  /*
   * Vmp at hot cell temperature.
   */

  function hotVmp() {
    const vmp = num("panelVmp");

    const coefficient = num("vmpCoeff", -0.3) / 100;

    const cellTemperature = num("cellTemp", 45);

    return vmp * (1 + coefficient * (cellTemperature - 25));
  }

  // ============================================================
  // PV ARRAY DESIGN
  // ============================================================

  function calculateArrayOptions() {
    const panelPower = num("panelPower");

    const panelVoc = num("panelVoc");

    const panelVmp = num("panelVmp");

    const panelIsc = num("panelIsc");

    const panelImp = num("panelImp");

    /*
     * Cannot design an array
     * without these values.
     */

    if (
      !(
        panelPower > 0 &&
        panelVoc > 0 &&
        panelVmp > 0 &&
        panelIsc > 0 &&
        panelImp > 0
      )
    ) {
      return [];
    }

    const inverterMinPv = num("invMinPv");

    const inverterMaxPv = num("invMaxPv");

    const mpptMin = num("mpptMin");

    const mpptMax = num("mpptMax");

    const maxCurrent = num("invMaxCurrent");

    const maxIsc = num("invMaxIsc");

    const maxPower = num("invMaxPower") * 1000;

    const coldVocValue = coldVoc();

    const hotVmpValue = hotVmp();

    /*
     * Calculate required PV power.
     */

    const demand = getDemand(calculateLoads());

    const sunHours = num("sunHours");

    const totalLossFactor = lossFactor();

    let targetPower = 0;

    if (demand.daily > 0 && sunHours > 0 && totalLossFactor > 0) {
      targetPower = (demand.daily / (sunHours * totalLossFactor)) * 1000;
    }

    /*
     * We search many possible
     * Series / Parallel combinations.
     */

    const maxPanels =
      targetPower > 0 ? Math.ceil((targetPower / panelPower) * 1.35) : 60;

    const options = [];

    /*
     * Series = number of panels
     * in one string.
     *
     * Parallel = number of strings.
     */

    for (let series = 1; series <= 30; series++) {
      for (let parallel = 1; parallel <= 20; parallel++) {
        const panelCount = series * parallel;

        if (panelCount > Math.max(120, maxPanels * 2)) {
          continue;
        }

        /*
         * Array electrical values
         */

        const arrayPower = panelCount * panelPower;

        const arrayVoc = series * coldVocValue;

        const arrayVmp = series * hotVmpValue;

        const arrayImp = parallel * panelImp;

        const arrayIsc = parallel * panelIsc;

        /*
         * Validation
         */

        const checks = {
          maxVoc: !inverterMaxPv || arrayVoc <= inverterMaxPv,

          mppt:
            (!mpptMin || arrayVmp >= mpptMin) &&
            (!mpptMax || arrayVmp <= mpptMax),

          current: !maxCurrent || arrayImp <= maxCurrent,

          isc: !maxIsc || arrayIsc <= maxIsc,

          power: !maxPower || arrayPower <= maxPower,

          inverterVoltage: !inverterMinPv || arrayVmp >= inverterMinPv,
        };

        const valid = Object.values(checks).every(Boolean);

        /*
         * Does the array produce
         * enough power?
         */

        const meetsEnergy = !targetPower || arrayPower >= targetPower * 0.9;

        /*
         * Distance from required
         * power.
         */

        const distance =
          Math.abs(arrayPower - targetPower) / Math.max(targetPower || 1, 1);

        options.push({
          series,

          parallel,

          count: panelCount,

          arrayPower,

          arrayVoc,

          arrayVmp,

          arrayImp,

          arrayIsc,

          valid,

          meetsEnergy,

          checks,

          distance,
        });
      }
    }

    /*
     * Sort:
     *
     * 1. Valid + enough power
     * 2. Valid
     * 3. Invalid
     *
     * Then closest to required
     * power.
     */

    options.sort((a, b) => {
      const scoreA = a.valid && a.meetsEnergy ? 0 : a.valid ? 1 : 2;

      const scoreB = b.valid && b.meetsEnergy ? 0 : b.valid ? 1 : 2;

      return scoreA - scoreB || a.distance - b.distance || a.count - b.count;
    });

    return options;
  }

  // ============================================================
  // UI HELPERS
  // ============================================================

  function resultRow(label, value) {
    return `
      <div class="result-row">
        <span>${label}</span>
        <b>${value}</b>
      </div>
    `;
  }

  function metric(label, value, note = "") {
    return `
      <div class="metric">
        <span>${label}</span>

        <strong>
          ${value}
        </strong>

        ${note ? `<small>${note}</small>` : ""}
      </div>
    `;
  }

  // ============================================================
  // VALIDATION
  // ============================================================

  function validateBasic() {
    const required = [
      ["panelPower", "توان پنل"],

      ["panelVoc", "Voc پنل"],

      ["panelVmp", "Vmp پنل"],

      ["panelIsc", "Isc پنل"],

      ["panelImp", "Imp پنل"],
    ];

    const missing = required
      .filter(([id]) => !(num(id) > 0))
      .map(([, label]) => label);

    if (!(num("invRated") > 0)) {
      missing.push("توان نامی اینورتر");
    }

    if (!(num("sunHours") > 0)) {
      missing.push("Peak Sun Hours");
    }

    return missing;
  }

  // ============================================================
  // MAIN CALCULATION
  // ============================================================

  function calculate() {
    const mode =
      document.querySelector('input[name="systemType"]:checked')?.value ||
      "on-grid";

    const loadInfo = calculateLoads();

    const demand = getDemand(loadInfo);

    const panelPower = num("panelPower");

    const sunHours = num("sunHours");

    const totalLossFactor = lossFactor();

    const inverterEfficiency = clamp(num("invEfficiency", 97), 1, 100) / 100;

    /*
     * Required PV without losses
     *
     * PV kWh/day =
     * PV kW × sun hours
     */

    const rawRequiredPv =
      demand.daily && sunHours ? demand.daily / sunHours : 0;

    /*
     * Required PV after
     * system losses and
     * inverter efficiency.
     */

    const requiredPv =
      totalLossFactor > 0
        ? rawRequiredPv / totalLossFactor / inverterEfficiency
        : 0;

    const recommendedPanels =
      panelPower > 0 ? Math.ceil((requiredPv * 1000) / panelPower) : 0;

    /*
     * Find best Series / Parallel
     */

    const arrayOptions = calculateArrayOptions();

    const best =
      arrayOptions.find((option) => option.valid && option.meetsEnergy) ||
      arrayOptions.find((option) => option.valid) ||
      arrayOptions[0];

    /*
     * Actual PV size
     */

    const actualPv = best ? best.arrayPower / 1000 : 0;

    /*
     * Raw daily production
     */

    const dailyRaw = actualPv * sunHours;

    /*
     * Final daily AC production
     */

    const dailyFinal = dailyRaw * totalLossFactor * inverterEfficiency;

    const monthlyFinal = dailyFinal * 30;

    const annualFinal = dailyFinal * 365;

    /*
     * Solar coverage
     */

    const coverage = demand.daily > 0 ? (dailyFinal / demand.daily) * 100 : 0;

    /*
     * DC/AC ratio
     */

    const inverterRated = num("invRated");

    const dcAc = inverterRated > 0 ? actualPv / inverterRated : 0;

    // ========================================================
    // BATTERY
    // ========================================================

    const battery = {};

    if (mode === "off-grid") {
      const backupDays = num("backupDays", 1);

      const batteryVoltage = num("batteryVoltage", 48);

      const batteryAh = num("batteryAh");

      const batteryCount = num("batteryCount", 1);

      const dod = clamp(num("dod", 80), 1, 100) / 100;

      const batteryEfficiency =
        clamp(num("batteryEfficiency", 90), 1, 100) / 100;

      const chargeEfficiency = clamp(num("chargeEfficiency", 95), 1, 100) / 100;

      /*
       * Required usable energy
       */

      const usableRequired = demand.daily * backupDays;

      /*
       * Required nominal energy
       *
       * E_nominal =
       * E_required /
       * (DoD × efficiency)
       */

      const nominalRequired =
        usableRequired /
        Math.max(dod * batteryEfficiency * chargeEfficiency, 0.01);

      /*
       * Required Ah
       *
       * Ah =
       * Wh / V
       */

      const requiredBankAh =
        (nominalRequired * 1000) / Math.max(batteryVoltage, 1);

      /*
       * Existing battery energy
       */

      const existingNominalKwh =
        (batteryVoltage * batteryAh * batteryCount) / 1000;

      const existingUsableKwh =
        existingNominalKwh * dod * batteryEfficiency * chargeEfficiency;

      const batteryShortfall = Math.max(0, usableRequired - existingUsableKwh);

      battery.requiredKwh = nominalRequired;

      battery.requiredBankAh = requiredBankAh;

      battery.existingNominalKwh = existingNominalKwh;

      battery.existingUsableKwh = existingUsableKwh;

      battery.shortfall = batteryShortfall;
    }

    return {
      mode,

      demand,

      loadInfo,

      losses: totalLossFactor,

      requiredPv,

      recommendedPanels,

      best,

      arrayOptions,

      actualPv,

      dailyRaw,

      dailyFinal,

      monthlyFinal,

      annualFinal,

      coverage,

      dcAc,

      battery,
    };
  }

  // ============================================================
  // RENDER RESULTS
  // ============================================================

  function render(result) {
    $("results").classList.remove("hidden");

    $("resultMode").textContent =
      result.mode === "on-grid"
        ? "حالت انتخاب‌شده: On-Grid"
        : "حالت انتخاب‌شده: Off-Grid";

    // ========================================================
    // WARNINGS
    // ========================================================

    const warnings = [];

    const inverterRated = num("invRated");

    const inverterMaxPv = num("invMaxPv");

    if (!result.best) {
      warnings.push(`
        <div class="alert error">
          اطلاعات پنل برای طراحی آرایه کافی نیست.
        </div>
      `);
    } else {
      /*
       * Maximum Voc
       */

      if (inverterMaxPv && result.best.arrayVoc > inverterMaxPv) {
        warnings.push(`
          <div class="alert error">
            Voc آرایه در دمای سرد طراحی
            از حداکثر ولتاژ PV اینورتر
            بیشتر است.
          </div>
        `);
      }

      /*
       * MPPT
       */

      if (!result.best.checks.mppt) {
        warnings.push(`
          <div class="alert warn">
            Vmp آرایه در محدوده MPPT
            تعریف‌شده قرار نمی‌گیرد.
          </div>
        `);
      }

      /*
       * Current
       */

      if (!result.best.checks.current) {
        warnings.push(`
          <div class="alert error">
            جریان کاری آرایه از
            محدودیت ورودی اینورتر
            بیشتر است.
          </div>
        `);
      }

      /*
       * Isc
       */

      if (!result.best.checks.isc) {
        warnings.push(`
          <div class="alert error">
            Isc آرایه از محدودیت Isc
            ورودی اینورتر بیشتر است.
          </div>
        `);
      }

      /*
       * PV Power
       */

      if (!result.best.checks.power) {
        warnings.push(`
          <div class="alert error">
            توان DC آرایه از حداکثر
            توان PV اینورتر بیشتر است.
          </div>
        `);
      }

      /*
       * DC / AC
       */

      if (inverterRated && result.dcAc > 1.5) {
        warnings.push(`
          <div class="alert warn">
            نسبت DC/AC برابر
            ${fmt(result.dcAc, 2)}
            است.
            احتمال clipping و محدودیت‌های
            سازنده را بررسی کنید.
          </div>
        `);
      }

      /*
       * Solar coverage
       */

      if (result.coverage < 100) {
        warnings.push(`
          <div class="alert warn">
            تولید تخمینی روزانه کمتر
            از مصرف روزانه است.
            کمبود انرژی باید با شبکه،
            باتری یا افزایش ظرفیت بررسی شود.
          </div>
        `);
      }

      if (result.coverage >= 100) {
        warnings.push(`
          <div class="alert ok">
            تولید تخمینی روزانه به مصرف
            محاسبه‌شده می‌رسد یا از آن
            بیشتر است.
          </div>
        `);
      }
    }

    $("warnings").innerHTML =
      warnings.join("") ||
      `
        <div class="alert warn">
          برای افزایش دقت، تمام مقادیر
          دیتاشیت و شرایط واقعی محل نصب
          را وارد کنید.
        </div>
      `;

    // ========================================================
    // TOP METRICS
    // ========================================================

    $("metricsGrid").innerHTML = [
      metric("مصرف روزانه", `${fmt(result.demand.daily)} kWh`, "برآورد مصرف"),

      metric(
        "توان PV پیشنهادی",
        `${fmt(result.requiredPv, 2)} kWp`,
        "با احتساب تلفات",
      ),

      metric(
        "تعداد پنل",
        fmt(result.best?.count || result.recommendedPanels, 0),
        "آرایش انتخاب‌شده",
      ),

      metric(
        "تولید روزانه",
        `${fmt(result.dailyFinal)} kWh`,
        `${fmt(result.coverage)}٪ پوشش مصرف`,
      ),
    ].join("");

    // ========================================================
    // LOAD RESULTS
    // ========================================================

    $("loadResults").innerHTML = [
      resultRow("مصرف روزانه", `${fmt(result.demand.daily)} kWh`),

      resultRow("مصرف ماهانه", `${fmt(result.demand.monthly)} kWh`),

      resultRow("مصرف سالانه", `${fmt(result.demand.annual)} kWh`),

      resultRow("Peak بارهای واردشده", `${fmt(result.loadInfo.peak)} W`),

      resultRow("Peak با Surge", `${fmt(result.loadInfo.surge)} W`),
    ].join("");

    // ========================================================
    // SOLAR RESULTS
    // ========================================================

    $("solarResults").innerHTML = [
      resultRow("ضریب کل تلفات", `${fmt((1 - result.losses) * 100)}٪`),

      resultRow("انرژی خام روزانه", `${fmt(result.dailyRaw)} kWh`),

      resultRow("انرژی نهایی روزانه", `${fmt(result.dailyFinal)} kWh`),

      resultRow("انرژی نهایی ماهانه", `${fmt(result.monthlyFinal)} kWh`),

      resultRow("انرژی نهایی سالانه", `${fmt(result.annualFinal)} kWh`),

      resultRow("پوشش مصرف", `${fmt(result.coverage)}٪`),

      resultRow("نسبت DC/AC", fmt(result.dcAc, 2)),
    ].join("");

    // ========================================================
    // ARRAY RESULTS
    // ========================================================

    if (result.best) {
      $("arrayResults").innerHTML = [
        resultRow("پنل سری", `${fmt(result.best.series, 0)} عدد`),

        resultRow("String موازی", `${fmt(result.best.parallel, 0)} عدد`),

        resultRow("کل پنل", `${fmt(result.best.count, 0)} عدد`),

        resultRow("توان آرایه", `${fmt(result.best.arrayPower / 1000)} kWp`),

        resultRow("Vmp تقریبی", `${fmt(result.best.arrayVmp)} V`),

        resultRow("Voc در سرما", `${fmt(result.best.arrayVoc)} V`),

        resultRow("Imp کل", `${fmt(result.best.arrayImp)} A`),

        resultRow("Isc کل", `${fmt(result.best.arrayIsc)} A`),
      ].join("");
    } else {
      $("arrayResults").innerHTML = resultRow("وضعیت", "اطلاعات کافی نیست");
    }

    // ========================================================
    // BATTERY
    // ========================================================

    if (result.mode === "off-grid") {
      $("batteryResults").innerHTML = [
        resultRow(
          "انرژی نامی موردنیاز",
          `${fmt(result.battery.requiredKwh)} kWh`,
        ),

        resultRow(
          "ظرفیت بانک باتری",
          `${fmt(result.battery.requiredBankAh)} Ah @ ${fmt(
            num("batteryVoltage"),
            0,
          )} V`,
        ),

        resultRow(
          "ظرفیت نامی فعلی",
          `${fmt(result.battery.existingNominalKwh)} kWh`,
        ),

        resultRow(
          "ظرفیت قابل استفاده فعلی",
          `${fmt(result.battery.existingUsableKwh)} kWh`,
        ),

        resultRow("کمبود نسبت به هدف", `${fmt(result.battery.shortfall)} kWh`),
      ].join("");
    }

    // ========================================================
    // ARRAY TABLE
    // ========================================================

    const tableBody = $("arrayTableBody");

    tableBody.innerHTML = result.arrayOptions
      .slice(0, 40)
      .map((option) => {
        let status;

        if (option.valid && option.meetsEnergy) {
          status = `<span class="status-pass">معتبر</span>`;
        } else if (option.valid) {
          status = `<span class="status-warn">معتبر / توان کمتر</span>`;
        } else {
          status = `<span class="status-fail">نامعتبر</span>`;
        }

        return `
            <tr>
              <td>${option.series}</td>

              <td>${option.parallel}</td>

              <td>${option.count}</td>

              <td>
                ${fmt(option.arrayPower / 1000)}
                kWp
              </td>

              <td>
                ${fmt(option.arrayVmp)}
                V
              </td>

              <td>
                ${fmt(option.arrayVoc)}
                V
              </td>

              <td>
                ${fmt(option.arrayImp)}
                A
              </td>

              <td>
                ${fmt(option.arrayIsc)}
                A
              </td>

              <td>
                ${status}
              </td>
            </tr>
          `;
      })
      .join("");

    /*
     * Scroll to report
     */

    $("results").scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  // ============================================================
  // FORM SUBMIT
  // ============================================================

  $("solarForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const missing = validateBasic();

    if (missing.length) {
      $("warnings").innerHTML = `
          <div class="alert error">
            برای محاسبه این موارد را
            وارد کنید:
            ${missing.join("، ")}.
          </div>
        `;

      $("results").classList.remove("hidden");

      $("results").scrollIntoView({
        behavior: "smooth",
      });

      return;
    }

    const result = calculate();

    render(result);
  });

  // ============================================================
  // RESET
  // ============================================================

  $("resetBtn").addEventListener("click", () => {
    $("solarForm").reset();

    loadsBody.innerHTML = "";

    addLoadRow({
      name: "یخچال",
      qty: 1,
      watt: 250,
      hours: 10,
      days: 30,
      coincidence: 0.8,
      surge: 800,
    });

    addLoadRow({
      name: "روشنایی",
      qty: 8,
      watt: 12,
      hours: 6,
      days: 30,
      coincidence: 0.9,
      surge: 12,
    });

    $("results").classList.add("hidden");

    updateMode();

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  });

  // ============================================================
  // PRINT
  // ============================================================

  $("printBtn").addEventListener("click", () => {
    window.print();
  });
})();

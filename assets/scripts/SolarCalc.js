// عناصر ورودی
const inputs = {
  dailyLoad: document.getElementById("dailyLoad"),
  peakLoad: document.getElementById("peakLoad"),
  invMinVoltage: document.getElementById("invMinVoltage"),
  invMaxVoltage: document.getElementById("invMaxVoltage"),
  invMaxCurrent: document.getElementById("invMaxCurrent"),
  panelPmax: document.getElementById("panelPmax"),
  panelVoc: document.getElementById("panelVoc"),
  panelVmp: document.getElementById("panelVmp"),
  panelImp: document.getElementById("panelImp"),
  tempCoeffVoc: document.getElementById("tempCoeffVoc"),
  tempCoeffVmp: document.getElementById("tempCoeffVmp"),
  minTemp: document.getElementById("minTemp"),
  maxTemp: document.getElementById("maxTemp"),
  psh: document.getElementById("psh"),
  autonomyDays: document.getElementById("autonomyDays"),
  systemLosses: document.getElementById("systemLosses"),
  batteryVoltage: document.getElementById("batteryVoltage"),
  batteryDod: document.getElementById("batteryDod"),
  batteryEfficiency: document.getElementById("batteryEfficiency"),
};

// تابع اصلی محاسبات
function calculate() {
  // دریافت مقادیر
  const dailyLoadWh = parseFloat(inputs.dailyLoad.value) || 0;
  const peakLoadW = parseFloat(inputs.peakLoad.value) || 0;
  const invMinV = parseFloat(inputs.invMinVoltage.value) || 0;
  const invMaxV = parseFloat(inputs.invMaxVoltage.value) || 0;
  const invMaxA = parseFloat(inputs.invMaxCurrent.value) || 0;

  const panelW = parseFloat(inputs.panelPmax.value) || 1; // جلوگیری از تقسیم بر صفر
  const panelVocSTC = parseFloat(inputs.panelVoc.value) || 0;
  const panelVmpSTC = parseFloat(inputs.panelVmp.value) || 0;
  const panelImpSTC = parseFloat(inputs.panelImp.value) || 0;
  const tempCoeffVoc = parseFloat(inputs.tempCoeffVoc.value) / 100 || 0;
  const tempCoeffVmp = parseFloat(inputs.tempCoeffVmp.value) / 100 || 0;

  const minTemp = parseFloat(inputs.minTemp.value) || 25;
  const maxTemp = parseFloat(inputs.maxTemp.value) || 25;
  const psh = parseFloat(inputs.psh.value) || 1; // جلوگیری از تقسیم بر صفر
  const autonomyDays = parseFloat(inputs.autonomyDays.value) || 1;
  const systemLossesPercent = parseFloat(inputs.systemLosses.value) || 0;
  const systemEfficiency = 1 - systemLossesPercent / 100;

  const batteryV = parseFloat(inputs.batteryVoltage.value) || 12;
  const batteryDod = parseFloat(inputs.batteryDod.value) / 100 || 0.5;
  const batteryEff = parseFloat(inputs.batteryEfficiency.value) / 100 || 0.9;

  // 1. محاسبه ظرفیت آرایه خورشیدی
  // توان آرایه = مصرف روزانه / (PSH * راندمان سیستم)
  const arraySizeW = dailyLoadWh / (psh * systemEfficiency);
  const totalPanelsNeeded = Math.ceil(arraySizeW / panelW);

  // 2. محاسبه ظرفیت بانک باتری
  // ظرفیت (Ah) = (مصرف روزانه * روزهای استقلال) / (ولتاژ * DoD * راندمان)
  const batteryCapacityAh =
    (dailyLoadWh * autonomyDays) / (batteryV * batteryDod * batteryEff);

  // 3. محاسبه توان اینورتر
  // توان اینورتر = حداکثر بار * 1.25 (برای جریان هجومی)
  const inverterSizeW = peakLoadW * 1.25;

  // 4. محاسبه ولتاژهای تصحیح شده با دما
  // ولتاژ مدار باز در سردترین دما (بیشترین مقدار)
  const vocCold = panelVocSTC * (1 + tempCoeffVoc * (minTemp - 25));
  // ولتاژ نقطه حداکثر توان در گرم‌ترین دما (کمترین مقدار)
  const vmpHot = panelVmpSTC * (1 + tempCoeffVmp * (maxTemp - 25));

  // 5. محاسبه تعداد پنل در سری (حداقل و حداکثر)
  // حداقل تعداد در سری: برای تامین حداقل ولتاژ ورودی اینورتر در گرما
  const minSeries = Math.ceil(invMinV / vmpHot);
  // حداکثر تعداد در سری: برای عدم تجاوز از حداکثر ولتاژ ورودی اینورتر در سرما
  const maxSeries = Math.floor(invMaxV / vocCold);

  // 6. محاسبه تعداد رشته‌های موازی
  // جریان هر رشته = جریان Imp پنل
  // حداکثر تعداد رشته موازی = حداکثر جریان اینورتر / (جریان Imp * 1.25 برای ضریب اطمینان NEC)
  const maxParallel = Math.floor(invMaxA / (panelImpSTC * 1.25));

  // 7. طراحی آرایه (ترکیب سری و موازی)
  // بهترین حالت: استفاده از حداکثر تعداد ممکن در سری برای کاهش تلفات
  let selectedSeries = maxSeries;
  let selectedParallel = 1;

  // اگر تعداد پنل مورد نیاز بیشتر از یک رشته است، تعداد رشته‌ها را محاسبه کن
  if (totalPanelsNeeded > selectedSeries) {
    selectedParallel = Math.ceil(totalPanelsNeeded / selectedSeries);
  }

  // بررسی محدودیت جریان موازی
  if (selectedParallel > maxParallel) {
    selectedParallel = maxParallel;
    // اگر تعداد رشته‌ها محدود شد، ممکن است نیاز به افزایش تعداد سری باشد
    // اما اگر از maxSeries بیشتر شود، امکان‌پذیر نیست
    if (selectedSeries * selectedParallel < totalPanelsNeeded) {
      // هشدار: نیاز به اینورتر با جریان بالاتر یا پنل با توان بالاتر
      console.warn("ظرفیت اینورتر برای این آرایه کافی نیست.");
    }
  }

  // 8. محاسبه تلفات (Waste) به صورت تقریبی
  // تلفات به صورت درصدی از توان تولیدی در نظر گرفته می‌شود
  const totalLossesW = arraySizeW * (systemLossesPercent / 100);

  // نمایش نتایج
  renderResults({
    arraySizeW: Math.round(arraySizeW),
    totalPanelsNeeded,
    batteryCapacityAh: Math.round(batteryCapacityAh),
    inverterSizeW: Math.round(inverterSizeW),
    vocCold: vocCold.toFixed(2),
    vmpHot: vmpHot.toFixed(2),
    minSeries,
    maxSeries,
    maxParallel,
    selectedSeries,
    selectedParallel,
    totalLossesW: Math.round(totalLossesW),
    systemEfficiency: (systemEfficiency * 100).toFixed(0),
  });
}

// تابع نمایش نتایج
function renderResults(data) {
  const resultsContainer = document.getElementById("results");
  resultsContainer.innerHTML = `
        <div class="result-item">
            <span class="label">ظرفیت آرایه خورشیدی مورد نیاز</span>
            <span class="value">${data.arraySizeW.toLocaleString()} <span class="unit">وات</span></span>
        </div>
        <div class="result-item">
            <span class="label">تعداد کل پنل مورد نیاز</span>
            <span class="value">${data.totalPanelsNeeded} <span class="unit">عدد</span></span>
        </div>
        <div class="result-item">
            <span class="label">ظرفیت بانک باتری</span>
            <span class="value">${data.batteryCapacityAh.toLocaleString()} <span class="unit">آمپر-ساعت</span></span>
        </div>
        <div class="result-item">
            <span class="label">توان اینورتر پیشنهادی</span>
            <span class="value">${data.inverterSizeW.toLocaleString()} <span class="unit">وات</span></span>
        </div>
        <div class="result-item success">
            <span class="label">تعداد پنل در هر رشته (سری)</span>
            <span class="value">${data.selectedSeries} <span class="unit">عدد</span></span>
        </div>
        <div class="result-item success">
            <span class="label">تعداد رشته‌های موازی</span>
            <span class="value">${data.selectedParallel} <span class="unit">رشته</span></span>
        </div>
        <div class="result-item warning">
            <span class="label">حداقل تعداد سری (جهت گرمای محیط)</span>
            <span class="value">${data.minSeries} <span class="unit">عدد</span></span>
        </div>
        <div class="result-item warning">
            <span class="label">حداکثر تعداد سری (جهت سرمای محیط)</span>
            <span class="value">${data.maxSeries} <span class="unit">عدد</span></span>
        </div>
        <div class="result-item">
            <span class="label">حداکثر رشته موازی مجاز (محدودیت جریان)</span>
            <span class="value">${data.maxParallel} <span class="unit">رشته</span></span>
        </div>
        <div class="result-item">
            <span class="label">ولتاژ مدار باز در سردترین دما (Voc, Cold)</span>
            <span class="value">${data.vocCold} <span class="unit">ولت</span></span>
        </div>
        <div class="result-item">
            <span class="label">ولتاژ نقطه توان در گرم‌ترین دما (Vmp, Hot)</span>
            <span class="value">${data.vmpHot} <span class="unit">ولت</span></span>
        </div>
        <div class="result-item warning">
            <span class="label">تلفات تقریبی سیستم (Waste)</span>
            <span class="value">${data.totalLossesW.toLocaleString()} <span class="unit">وات</span></span>
        </div>
    `;
}

// اضافه کردن شنونده رویداد به تمام ورودی‌ها
Object.values(inputs).forEach((input) => {
  input.addEventListener("input", calculate);
});

// محاسبه اولیه هنگام بارگذاری صفحه
calculate();

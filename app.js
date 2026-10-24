'use strict';

// ---------- settings ----------
const PD_SHEET = '1wx8Ps4-mTL9MpdbwV3FTv8gGEqwuQL_LisSoyUBu6ZU'; // pending_dispatching (public CSV)
const PD_TABS = { dispatching: 0, scans: 1002, history: 1004 };
const WHS = ['CAIID01', 'CAIID02', 'CAIID03', 'CAIID04', 'CAIID05', 'CAIID06', 'CAIID07'];
const API_URL = new URLSearchParams(location.search).get('api') || (window.CPO_CONFIG && window.CPO_CONFIG.API_URL) || '';
// Branch names for codes that rarely show up in pending_dispatching
const DS_FALLBACK = {
  CAIDS09: 'Fifth Settlement - 1st District', CAIDS10: 'First Settlement - El Banafseg', CAIDS11: 'New Cairo - One Golden SQ',
  CAIDS12: 'Sheikh Zayed', CAIDS14: 'Dokki', CAIDS15: '6th of October', CAIDS16: 'Haram', CAIDS17: 'Hadayek Al Ahram 2',
  CAIDS18: 'Mokattam 2', CAIDS19: 'Sherouk', CAIDS20: 'Zahra Maadi', CAIDS21: 'Maadi 2', CAIDS22: 'Sheraton',
  CAIDS23: 'Heliopolis 2', CAIDS24: 'Nasr City 2', CAIDS25: 'New Giza', CAIDS26: 'New Cairo - South Investors',
  CAIDS28: 'Sheikh Zayed - 16th District', CAIDS29: 'El Sahel (Shobra)', CAIDS31: 'Garden City', CAIDS32: 'Al Zaitoun',
  CAIDS33: 'Al Fardoos City', CAIDS36: 'Obour',
};
const CAT_ORDER = ['red', 'amber', 'blue', 'purple', 'green', 'rust', 'gray'];
const LINE_ORDER = { red: 0, blue: 1, amber: 2, green: 3, rust: 4, purple: 5, gray: 6 };

// ---------- text ----------
// {name} is replaced by the value passed to t(); values that come from data are escaped by the caller.
const I18N = {
  ar: {
    docTitle: 'noon Minutes · CPO والتوتات الضايعة',
    appTitle: 'CPO والتوتات الضايعة',
    langBtn: 'English',
    loading: 'بيحمّل الداتا…',
    tabDash: 'الداش بورد', tabLost: 'التوتات الضايعة',
    presetDay: 'آخر يوم', presetWeek: 'آخر 7 أيام', presetMonth: 'من أول الشهر',
    from: 'من', to: 'لـ', apply: 'اعرض',
    refresh: 'تحديث من الشيت',
    refreshTitle: 'يقرا شيت CPO من الأول بدل النسخة اللي بتتحدث كل ساعة (ممكن ياخد دقيقتين)',
    whLabel: 'المخزن', allWh: 'كل المخازن',
    trendTitle: 'الـ Missing والـ Damage والـ Excess باليوم',
    asTable: 'اعرض كجدول', asChart: 'اعرض كرسم',
    byWh: 'بالمخزن', bucketsTitle: 'أنواع الـ Missing', bucketsHint: 'من تاب MTD Item level',
    byDs: 'بالفرع', byCat: 'بالكاتيجوري', showAll: 'اعرض الكل ({n})', showTop: 'اعرض أول 12',
    searchPh: 'دور على توتة (TGI… أو PH…) أو تحويل (TR-…) أو بالتة (FPI…)', searchBtn: 'دوّر',
    allDays: 'كل الأيام', allDs: 'كل الفروع', csv: 'تحميل CSV',
    explainTitle: 'إزاي بنقرا الأدلة',
    explainBody: `<p>بندور على كل توتة Box Lost في شيت pending_dispatching (البالتات وسكان الـ Review) وفي تاب Wrong Connection (سكان الفروع) وتاب Missing (الـ Excess).</p>
      <ul>
        <li><b>اتسكنت قبل ما تخرج:</b> قبل ما البالتة تخرج بنسكان البالتة وكل التوتات اللي عليها، فالتوتة اللي اتسكنت كانت على البالتة الصح جوه المخزن.</li>
        <li><b>ماتسكنتش في الـ Review:</b> البالتة اتعملها Review والتوتة دي مش من التوتات اللي اتسكنت، يعني ماكانتش على البالتة ساعتها.</li>
        <li><b>وصلت والسكان فشل / فرع غلط:</b> تاب Wrong Connection فيه سكانات التوتات في الفروع، فالتوتة اللي اتسكنت في فرع كانت موجودة فيه فعلاً حتى لو السكان فشل.</li>
        <li><b>وصلت بأصناف تانية:</b> الفرع مابيقدرش يسجّل Excess على توتة إلا لو التوتة قدامه. يعني "Box Lost" هنا معناها إن كل الأصناف المطلوبة ناقصة، مش لازم التوتة نفسها تكون ضاعت.</li>
        <li><b>التوتة رجعت المخزن:</b> كل توتة ليها رقم ثابت والـ <span class="mono">_vNN</span> بيزيد كل ما تتشغل، فلو نفس التوتة ظهرت تاني برقم أعلى يبقى التوتة نفسها رجعت.</li>
      </ul>
      <p class="muted">شيت pending_dispatching فيه بالتات CAIID01 بس (وشوية CAIID02 وCAIID06)، وبدأ يوم 19/10، وحتى في CAIID01 مش كل التوتات بتتسجل فيه، فـ"مش ظاهرة على أي بالتة" لوحدها مش دليل إن التوتة ماخرجتش.</p>`,
    footer: 'الداتا من شيت [WH] Daily CPO EG وشيت pending_dispatching.',
    egp: '{n} ج',
    egpBig: '{n}<small> ج</small>',
    pcs: n => (n === 1 ? 'قطعة' : n === 2 ? 'قطعتين' : n <= 10 ? `${n} قطع` : `${n} قطعة`),
    totes: n => (n === 1 ? 'توتة' : n === 2 ? 'توتتين' : n <= 10 ? `${n} توتات` : `${n} توتة`),
    totesN: n => (+n === 1 ? 'توتة واحدة' : +n === 2 ? 'توتتين' : +n <= 10 ? `${n} توتات` : `${n} توتة`),
    piecesN: n => `${n} قطعة`,
    kMissing: 'الـ Missing (Transfer Loss)', kDamage: 'الـ Damage', kExcess: 'الـ Excess',
    kBoxLost: 'Box Lost (توتة كاملة)', kWc: 'Wrong Connection', kCpo: 'CPO',
    ofMissing: '{p}% من الـ Missing',
    cpoNoWh: 'الـ CPO في الشيت مش متقسم بالمخزن',
    cpoAvg: 'متوسط الفترة · آخر يوم {d}: {v}',
    cpoNone: 'مفيش CPO للفترة دي في تاب Summary',
    day: 'اليوم', total: 'الإجمالي',
    whHead: ['المخزن', 'Missing', 'Damage', 'Excess', 'Excess ÷ Missing', 'Box Lost', 'Box Lost (ج)'],
    bAll: 'إجمالي الـ Missing', bPartial: 'جزء من الكمية ناقص', bSku: 'الصنف كله ناقص', bFull: 'التوتة كلها ناقصة (Box Lost)',
    bucketHead: ['النوع', 'القطع', 'التوتات', 'القيمة (ج)', 'الأصناف'],
    bucketDaily: 'التوتات والأصناف متجمعة يوم بيوم.',
    dsHead: ['الفرع', 'Missing', '', 'Damage', 'Excess', 'Box Lost'],
    catHead: ['الكاتيجوري', 'Missing', '', 'Damage', 'Excess'],
    noData: 'مفيش داتا للفترة دي.',
    pickMoreDays: 'اختار أكتر من يوم عشان يبان الترند.',
    chartAria: 'الـ Missing والـ Damage والـ Excess باليوم',
    allTotes: 'كل التوتات',
    lostTitle: 'التوتات اللي ضاعت بالكامل (Box Lost) من {from} لـ {to}',
    noTotes: 'مفيش توتات بالفلتر ده.',
    lostHead: ['#', 'اليوم', 'CAIID', 'التوتة', 'رايحة فين', 'القطع', 'القيمة (ج)', 'لقينا إيه', 'المتابعة'],
    cat_red: 'فرع غلط', cat_red_t: 'راحت فرع غلط أو أصنافها اتلقت في فرع تاني',
    cat_amber: 'وصلت بأصناف تانية', cat_amber_t: 'وصلت فرعها بس جواها أصناف غير المطلوبة',
    cat_blue: 'وصلت والسكان فشل', cat_blue_t: 'وصلت فرعها والسكان فشل',
    cat_purple: 'التوتة رجعت المخزن', cat_purple_t: 'التوتة نفسها رجعت المخزن واتشغلت تاني',
    cat_green: 'اتسكنت قبل ما تخرج', cat_green_t: 'اتسكنت في الـ Review قبل ما تخرج، ومفيش دليل بعد كدا',
    cat_rust: 'ماتسكنتش في الـ Review', cat_rust_t: 'البالتة اتعملها Review والتوتة مش من اللي اتسكنوا',
    cat_gray: 'مفيش دليل', cat_gray_t: 'مفيش دليل',
    tagWrong: 'فرع غلط', tagAtBranch: 'في الفرع', tagMaybe: 'احتمال', tagExcess: 'Excess', tagScanned: 'اتسكنت',
    tagNotScanned: 'ماتسكنتش', tagBack: 'رجعت', tagNoScan: 'مفيش سكان', tagNoPallet: 'مش على بالتة', tagNone: 'مفيش أثر',
    evWrongScan: 'اتسكنت في <b>{scan}</b> يوم {day} الساعة {time} والسكان فشل، والمفروض تروح {ds}.',
    evOwnScan: 'اتسكنت في <b>{scan}</b> نفسها يوم {day} الساعة {time} والسكان فشل، يعني التوتة كانت في الفرع.',
    evOnTote: 'التوتة {tote}',
    evSameTransfer: '{pcs} من أصنافها ({v}) اتسجلت Excess في <b>{ds}</b> على {on} من نفس التحويل.',
    evSwap: 'نفس الصنف بنفس الكمية ({pcs} بـ {v}) اتسجل Excess في <b>{ds}</b> على {on}، ودي كمان متسجلة Box Lost.',
    evMaybe: 'نفس الصنف بنفس الكمية ({pcs} بـ {v}) اتسجل Excess في <b>{ds}</b> نفس اليوم على تحويل تاني.',
    evExcess: '{ds} سجّل {pcs} Excess ({v}) على نفس التوتة، يعني التوتة وصلت {how}.',
    evExcessOther: 'بأصناف غير اللي كانت مطلوبة', evExcessExtra: 'وفيها أصناف زيادة',
    evScanned: 'اتسكنت في الـ {stage} يوم {when} على البالتة {pallet}، واتسكن {done} من {tot} توتة عليها.',
    evNotScanned: 'البالتة {pallet} اتعملها Review واتسكن {done} من {tot} توتة، والتوتة دي مش منهم.',
    evBackPallet: 'نفس التوتة رجعت المخزن واتحطت تاني ({v}) على بالتة رايحة {where} يوم {when}.',
    evBackScan: 'نفس التوتة اتشغلت تاني ({v}) واتسكنت في {where} يوم {when}.',
    evNotReviewed: 'كانت على البالتة {pallet} (اتعملت {created}) ومحدش سكان البالتة دي خالص (0 من {tot} توتة).',
    evNoPallet: 'مش ظاهرة على أي بالتة في pending_dispatching.',
    evNoneWh: '{wh} مش في شيت السكان، ومفيش أي سكان أو Excess عليها.',
    evNone: 'مفيش أي سكان أو Excess عليها.',
    searching: 'بيدوّر في الشيتين…', searchFail: 'مقدرتش أدوّر:', tooShort: 'اكتب رقم التوتة أو التحويل كامل',
    close: '✕ قفل',
    versions: n => (n === 1 ? 'نسخة واحدة' : `${n} نسخ`),
    lostTimes: n => `اتسجلت Box Lost ${n === 1 ? 'مرة' : n === 2 ? 'مرتين' : n + ' مرات'}`,
    toteNotFound: 'التوتة دي مش موجودة في أي تاب.',
    fTransfer: 'التحويل:', fDay: 'اليوم:', fRoute: 'من <b>{a}</b> لـ <b>{b}</b>', fPallet: 'البالتة:',
    palletMeta: '(اتعملت {c} · اتسكن {d} من {t})',
    fScanned: 'اتسكنت في الـ {stage}:',
    fBranchScan: 'سكان في الفرع: <b>{b}</b> يوم {at}', scanOk: 'نجح', shouldBe: 'المفروض {b}',
    fBoxLost: '<b>{pcs} · {v}</b> يوم {d}',
    itemsHead: ['الصنف', 'الكاتيجوري', 'المطلوب', 'ناقص', 'قيمة الناقص', 'زيادة', 'قيمة الزيادة', 'Damage'],
    noDetails: 'مفيش تفاصيل.',
    transferEmpty: 'التحويل ده مش موجود في تاب Missing ولا Tote Missing.',
    transferSub: '{n} توتة عليها فرق',
    transferHead: ['التوتة', 'الفرع', '', 'Missing (ج)', 'Excess (ج)', 'البالتة', 'اتسكنت'],
    palletEmpty: 'البالتة دي مش في pending_dispatching.',
    pBranch: 'الفرع:', pCreated: 'اتعملت:', pLoc: 'مكانها:', pScanned: 'اتسكن:', pFirst: '(أول سكان {t})', ofN: '{a} من {b}',
    palletHead: ['التوتة', 'الـ Review', ''],
    palletHint: 'الـ Box Lost هنا من الفترة المعروضة بس.',
    metaLine: 'الفترة من {from} لـ {to} · آخر يوم في الشيت {latest}{upd} · اتسحب من الشيت {pulled}',
    metaUpd: ' · الشيت اتحدّث {d}',
    loadingRebuild: 'بيقرا شيت CPO من الأول… ممكن ياخد دقيقتين',
    loadingData: 'بيسحب الداتا من الشيتين…',
    waitingApi: 'مستني رابط الـ Apps Script', errorMeta: 'حصل خطأ', loadFail: 'الداتا ماتسحبتش:',
    setup: `<b>الموقع محتاج رابط الـ Apps Script عشان يقرا شيت [WH] Daily CPO EG.</b>
      <ol><li>افتح script.google.com واعمل New project، والزق فيه ملف <span class="mono">google-apps-script.gs</span>.</li>
      <li>شغّل installTrigger مرة، وبعدين Deploy ← New deployment ← Web app، و Execute as: Me، و Who has access: Anyone.</li>
      <li>انسخ الرابط اللي آخره <span class="mono">/exec</span> وحطه في <span class="mono">config.js</span>.</li></ol>`,
    apiStatus: 'الـ API رد بـ {s}', apiError: 'الـ API رجّع خطأ', pdStatus: 'pending_dispatching رد بـ {s}',
    updating: 'بيحدّث…',
    pdLoading: 'بيحمّل البالتات وسكان الـ Review من pending_dispatching…',
    searchPartial: 'ده من الفترة المعروضة بس، وبيكمل البحث في الشيت كله…',
    reportBtn: 'تقرير اليوم', rpDay: 'اليوم', rpEvidenceOnly: 'اللي عليها دليل بس',
    rpPng: 'صورة PNG', rpCopy: 'نسخ الصورة', rpPdf: 'PDF', rpClose: 'قفل',
    rpWholePeriod: 'الفترة كلها ({from} – {to})',
    rpMaking: 'بيعمل الصورة…', rpCopied: 'الصورة اتنسخت، الزقها في الواتساب أو الإيميل', rpSaved: 'الصورة اتحملت',
    rpFail: 'مقدرتش أعمل الصورة: {e}', rpCopyFail: 'المتصفح مارضيش ينسخ الصورة، استخدم صورة PNG',
    rpTitleDay: 'التوتات اللي ضاعت بالكامل (Box Lost) يوم {d}: لقينا إيه',
    rpTitleRange: 'التوتات اللي ضاعت بالكامل (Box Lost) من {from} لـ {to}: لقينا إيه',
    rpSub: 'التوتات المسجلة Box Lost في تاب Tote Missing في شيت [WH] Daily CPO EG، وجنب كل توتة الدليل اللي لقيناه في pending_dispatching وتاب Wrong Connection وتاب Missing. المواعيد بتوقيت القاهرة.',
    rpSubWh: ' المخزن: {wh}.', rpSubEvidence: ' التقرير فيه التوتات اللي عليها دليل بس.',
    rpKeys: 'الخلاصة',
    rpKeyEvidence: '{n} من {t} ({v} من {tv}، يعني {p}%) عليها دليل إنها خرجت من المخزن أو وصلت فرع.',
    rpKeyRed: '{n} راحت فرع غلط أو أصنافها اتلقت في فرع تاني ({v}).',
    rpKeyAmber: '{n} وصلت فرعها بس الفرع سجّل عليها Excess، يعني الأصناف اللي جواها اتبدلت ({v}).',
    rpKeyBlue: '{n} اتسكنت في فرعها والسكان فشل ({v}).',
    rpKeyTopDs: 'أكتر فرع: {ds}، {n} ({v}).',
    rpKeyTopWh: 'أكتر مخزن: {wh}، {n} ({v}).',
    rpKeyNotReviewed: '{n} بالتة محدش عملها Review خالص: {list}.',
    rpNote: '<b>إزاي نقرا الأدلة:</b> التوتة اللي اتسكنت في الـ Review كانت على البالتة الصح جوه المخزن. والتوتة اللي اتسكنت في فرع (تاب Wrong Connection) كانت موجودة فيه فعلاً حتى لو السكان فشل. والفرع مابيقدرش يسجّل Excess على توتة إلا لو التوتة قدامه، فـ"Box Lost" معناها إن كل الأصناف المطلوبة ناقصة، مش لازم التوتة نفسها تكون ضاعت. ولو نفس التوتة ظهرت تاني برقم <span class="mono">_vNN</span> أعلى يبقى رجعت المخزن.',
    rpFoot: '<b>المصادر:</b> شيت [WH] Daily CPO EG (تاب Tote Missing وتاب Missing وتاب Wrong Connection)، وشيت pending_dispatching (تاب pallet_scan وتاب dispatching وتاب dispatching_history). الداتا من الشيت {pulled}، والتقرير اتعمل {now}.',
    rpNone: 'مفيش توتات Box Lost في اليوم ده.',
    rpHead: ['#', 'CAIID', 'التوتة', 'رايحة فين', 'القطع', 'القيمة (ج)', 'لقينا إيه'],
    rpHeadRange: ['#', 'اليوم', 'CAIID', 'التوتة', 'رايحة فين', 'القطع', 'القيمة (ج)', 'لقينا إيه'],
    months: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    followCol: 'المتابعة', followAll: 'كل الحالات', followEdit: '✎ تحديث',
    st_open: 'مفتوحة', st_investigating: 'بنحقق', st_found: 'اتلقت', st_charged: 'اتحاسب عليها', st_not_lost: 'مش ضايعة', st_closed: 'اتقفلت من غير ما تتلاقي',
    followTitle: 'متابعة التوتة {tote}', followStatus: 'الحالة', followNote: 'ملاحظة',
    followNotePh: 'إيه اللي حصل؟ اتكلمت مع مين؟ الأصناف راحت فين؟', followBy: 'اسمك',
    followSave: 'حفظ', followCancel: 'إلغاء', followSaving: 'بيحفظ…', followNeedName: 'اكتب اسمك الأول',
    followFail: 'ماتحفظتش: {e}', followHistory: 'اللي اتسجل قبل كدا', followNone: 'لسه محدش سجّل حاجة على التوتة دي.',
    followUnsupported: 'المتابعة محتاجة تحديث الاسكربت (New version) عشان تشتغل.',
    rpKeyFollow: 'المتابعة: {list}.',
  },
  en: {
    docTitle: 'noon Minutes · CPO & Lost Totes',
    appTitle: 'CPO & Lost Totes',
    langBtn: 'عربي',
    loading: 'Loading data…',
    tabDash: 'Dashboard', tabLost: 'Lost totes',
    presetDay: 'Last day', presetWeek: 'Last 7 days', presetMonth: 'Month to date',
    from: 'From', to: 'To', apply: 'Show',
    refresh: 'Refresh from sheet',
    refreshTitle: 'Reads the CPO sheet again now instead of the hourly copy (takes about 2 minutes)',
    whLabel: 'Warehouse', allWh: 'All warehouses',
    trendTitle: 'Missing, damage and excess by day',
    asTable: 'Show as table', asChart: 'Show as chart',
    byWh: 'By warehouse', bucketsTitle: 'Missing by type', bucketsHint: 'From the MTD Item level tab',
    byDs: 'By branch', byCat: 'By category', showAll: 'Show all ({n})', showTop: 'Show top 12',
    searchPh: 'Search a tote (TGI… or PH…), a transfer (TR-…) or a pallet (FPI…)', searchBtn: 'Search',
    allDays: 'All days', allDs: 'All branches', csv: 'Download CSV',
    explainTitle: 'How to read the evidence',
    explainBody: `<p>Every Box Lost tote is looked up in the pending_dispatching sheet (pallets and Review scans), in the Wrong Connection tab (branch scans) and in the Missing tab (excess).</p>
      <ul>
        <li><b>Scanned before leaving:</b> before a pallet leaves, we scan the pallet and every tote on it, so a scanned tote was on the right pallet inside the warehouse.</li>
        <li><b>Missed at Review:</b> the pallet was reviewed and this tote was not among the scanned ones, so it was not on the pallet at that time.</li>
        <li><b>Arrived, scan failed / wrong branch:</b> the Wrong Connection tab lists tote scans at branches, so a tote scanned at a branch was physically there, even when the scan failed.</li>
        <li><b>Arrived with other items:</b> a branch can only book excess on a tote it has in hand. "Box Lost" here means every item ordered is missing; the tote itself may not be lost.</li>
        <li><b>Tote came back:</b> each tote keeps its number and the <span class="mono">_vNN</span> goes up every time it is used, so a higher version later means the tote itself came back.</li>
      </ul>
      <p class="muted">pending_dispatching only holds CAIID01 pallets (plus a few CAIID02 and CAIID06), started on 19 Oct, and does not capture every CAIID01 tote, so "not on any pallet" alone does not prove the tote never left.</p>`,
    footer: 'Data from the [WH] Daily CPO EG and pending_dispatching sheets.',
    egp: 'EGP {n}',
    egpBig: '<small>EGP </small>{n}',
    pcs: n => (+n === 1 ? '1 pc' : `${n} pcs`),
    totes: n => (+n === 1 ? '1 tote' : `${n} totes`),
    totesN: n => (+n === 1 ? '1 tote' : `${n} totes`),
    piecesN: n => `${n} pcs`,
    kMissing: 'Missing (transfer loss)', kDamage: 'Damage', kExcess: 'Excess',
    kBoxLost: 'Box Lost (whole tote)', kWc: 'Wrong connection', kCpo: 'CPO',
    ofMissing: '{p}% of missing',
    cpoNoWh: "The sheet's CPO is not split by warehouse",
    cpoAvg: 'Period average · last day {d}: {v}',
    cpoNone: 'No CPO for this period in the Summary tab',
    day: 'Day', total: 'Total',
    whHead: ['Warehouse', 'Missing', 'Damage', 'Excess', 'Excess ÷ missing', 'Box Lost', 'Box Lost (EGP)'],
    bAll: 'All missing', bPartial: 'Part of the quantity missing', bSku: 'Whole SKU missing', bFull: 'Whole tote missing (Box Lost)',
    bucketHead: ['Type', 'Pieces', 'Totes', 'Value (EGP)', 'SKUs'],
    bucketDaily: 'Totes and SKUs are added up day by day.',
    dsHead: ['Branch', 'Missing', '', 'Damage', 'Excess', 'Box Lost'],
    catHead: ['Category', 'Missing', '', 'Damage', 'Excess'],
    noData: 'No data for this period.',
    pickMoreDays: 'Pick more than one day to see the trend.',
    chartAria: 'Missing, damage and excess by day',
    allTotes: 'All totes',
    lostTitle: 'Box Lost totes, {from} to {to}',
    noTotes: 'No totes match this filter.',
    lostHead: ['#', 'Day', 'CAIID', 'Tote', 'Going to', 'Pieces', 'Value (EGP)', 'What we found', 'Follow-up'],
    cat_red: 'Wrong branch', cat_red_t: 'Went to the wrong branch, or its items turned up at another branch',
    cat_amber: 'Arrived with other items', cat_amber_t: 'Reached its branch, but with items other than the ones ordered',
    cat_blue: 'Arrived, scan failed', cat_blue_t: 'Reached its branch and the scan failed',
    cat_purple: 'Tote came back', cat_purple_t: 'The tote itself came back to the warehouse and was used again',
    cat_green: 'Scanned before leaving', cat_green_t: 'Scanned at Review before leaving, and nothing after that',
    cat_rust: 'Missed at Review', cat_rust_t: 'The pallet was reviewed and this tote was not among the scanned ones',
    cat_gray: 'No evidence', cat_gray_t: 'No evidence',
    tagWrong: 'Wrong branch', tagAtBranch: 'At branch', tagMaybe: 'Possible', tagExcess: 'Excess', tagScanned: 'Scanned',
    tagNotScanned: 'Not scanned', tagBack: 'Came back', tagNoScan: 'No scan', tagNoPallet: 'No pallet', tagNone: 'No trace',
    evWrongScan: 'Scanned at <b>{scan}</b> on {day} at {time} and the scan failed; it should have gone to {ds}.',
    evOwnScan: 'Scanned at <b>{scan}</b> itself on {day} at {time} and the scan failed, so the tote was at the branch.',
    evOnTote: 'tote {tote}',
    evSameTransfer: '{pcs} of its items ({v}) were booked as excess at <b>{ds}</b> on {on} from the same transfer.',
    evSwap: 'The same item and quantity ({pcs}, {v}) was booked as excess at <b>{ds}</b> on {on}, which is also Box Lost.',
    evMaybe: 'The same item and quantity ({pcs}, {v}) was booked as excess at <b>{ds}</b> the same day on another transfer.',
    evExcess: '{ds} booked {pcs} as excess ({v}) on this tote, so the tote arrived {how}.',
    evExcessOther: 'with items other than the ones ordered', evExcessExtra: 'with extra items',
    evScanned: 'Scanned at {stage} on {when} on pallet {pallet}; {done} of {tot} totes on it were scanned.',
    evNotScanned: 'Pallet {pallet} was reviewed and {done} of {tot} totes were scanned; this tote was not one of them.',
    evBackPallet: 'The same tote came back to the warehouse and was put again ({v}) on a pallet for {where} on {when}.',
    evBackScan: 'The same tote was used again ({v}) and scanned at {where} on {when}.',
    evNotReviewed: 'It was on pallet {pallet} (created {created}) and nobody scanned that pallet (0 of {tot} totes).',
    evNoPallet: 'Not on any pallet in pending_dispatching.',
    evNoneWh: '{wh} is not in the scan sheet, and there is no scan or excess on it.',
    evNone: 'No scan or excess on it.',
    searching: 'Searching both sheets…', searchFail: 'Search failed:', tooShort: 'Type the full tote or transfer number',
    close: '✕ Close',
    versions: n => (n === 1 ? '1 version' : `${n} versions`),
    lostTimes: n => `Box Lost ${n === 1 ? 'once' : n === 2 ? 'twice' : n + ' times'}`,
    toteNotFound: 'This tote is not in any tab.',
    fTransfer: 'Transfer:', fDay: 'Day:', fRoute: 'From <b>{a}</b> to <b>{b}</b>', fPallet: 'Pallet:',
    palletMeta: '(created {c} · {d} of {t} scanned)',
    fScanned: 'Scanned at {stage}:',
    fBranchScan: 'Branch scan: <b>{b}</b> on {at}', scanOk: 'succeeded', shouldBe: 'should be {b}',
    fBoxLost: '<b>{pcs} · {v}</b> on {d}',
    itemsHead: ['SKU', 'Category', 'Expected', 'Missing', 'Missing value', 'Extra', 'Extra value', 'Damage'],
    noDetails: 'No details.',
    transferEmpty: 'This transfer is not in the Missing or Tote Missing tab.',
    transferSub: '{n} totes with a difference',
    transferHead: ['Tote', 'Branch', '', 'Missing (EGP)', 'Excess (EGP)', 'Pallet', 'Scanned'],
    palletEmpty: 'This pallet is not in pending_dispatching.',
    pBranch: 'Branch:', pCreated: 'Created:', pLoc: 'Location:', pScanned: 'Scanned:', pFirst: '(first scan {t})', ofN: '{a} of {b}',
    palletHead: ['Tote', 'Review', ''],
    palletHint: 'Box Lost here only covers the period on screen.',
    metaLine: 'Period {from} to {to} · last day in the sheet {latest}{upd} · pulled from the sheet {pulled}',
    metaUpd: ' · sheet updated {d}',
    loadingRebuild: 'Reading the CPO sheet again… this can take 2 minutes',
    loadingData: 'Pulling data from both sheets…',
    waitingApi: 'Waiting for the Apps Script link', errorMeta: 'Something went wrong', loadFail: 'Data did not load:',
    setup: `<b>The site needs the Apps Script link to read the [WH] Daily CPO EG sheet.</b>
      <ol><li>Open script.google.com, create a New project and paste <span class="mono">google-apps-script.gs</span> into it.</li>
      <li>Run installTrigger once, then Deploy → New deployment → Web app, Execute as: Me, Who has access: Anyone.</li>
      <li>Copy the link ending in <span class="mono">/exec</span> into <span class="mono">config.js</span>.</li></ol>`,
    apiStatus: 'The API answered {s}', apiError: 'The API returned an error', pdStatus: 'pending_dispatching answered {s}',
    updating: 'updating…',
    pdLoading: 'Loading pallets and Review scans from pending_dispatching…',
    searchPartial: 'This is from the period on screen only; searching the whole sheet…',
    reportBtn: 'Day report', rpDay: 'Day', rpEvidenceOnly: 'Only totes with evidence',
    rpPng: 'PNG image', rpCopy: 'Copy image', rpPdf: 'PDF', rpClose: 'Close',
    rpWholePeriod: 'Whole period ({from} – {to})',
    rpMaking: 'Making the image…', rpCopied: 'Image copied, paste it in WhatsApp or email', rpSaved: 'Image downloaded',
    rpFail: 'Could not make the image: {e}', rpCopyFail: 'The browser would not copy the image; use PNG image',
    rpTitleDay: 'Box Lost totes on {d}: what we found',
    rpTitleRange: 'Box Lost totes, {from} to {to}: what we found',
    rpSub: 'Totes recorded as Box Lost in the Tote Missing tab of [WH] Daily CPO EG, each with the evidence found in pending_dispatching, the Wrong Connection tab and the Missing tab. Times are Cairo time.',
    rpSubWh: ' Warehouse: {wh}.', rpSubEvidence: ' Only totes with evidence are listed.',
    rpKeys: 'Summary',
    rpKeyEvidence: '{n} of {t} ({v} of {tv}, {p}%) have evidence that they left the warehouse or reached a branch.',
    rpKeyRed: '{n} went to the wrong branch or their items turned up at another branch ({v}).',
    rpKeyAmber: '{n} reached their branch, but the branch booked excess on them, so the items inside were swapped ({v}).',
    rpKeyBlue: '{n} were scanned at their branch and the scan failed ({v}).',
    rpKeyTopDs: 'Branch with the most: {ds}, {n} ({v}).',
    rpKeyTopWh: 'Warehouse with the most: {wh}, {n} ({v}).',
    rpKeyNotReviewed: '{n} pallets were never reviewed: {list}.',
    rpNote: '<b>How to read the evidence:</b> a tote scanned at Review was on the right pallet inside the warehouse. A tote scanned at a branch (Wrong Connection tab) was physically there, even when the scan failed. A branch can only book excess on a tote it has in hand, so "Box Lost" means every item ordered is missing; the tote itself may not be lost. A higher <span class="mono">_vNN</span> later means the tote came back to the warehouse.',
    rpFoot: '<b>Sources:</b> [WH] Daily CPO EG (Tote Missing, Missing and Wrong Connection tabs) and pending_dispatching (pallet_scan, dispatching and dispatching_history tabs). Data pulled from the sheet {pulled}; report made {now}.',
    rpNone: 'No Box Lost totes on this day.',
    rpHead: ['#', 'CAIID', 'Tote', 'Going to', 'Pieces', 'Value (EGP)', 'What we found'],
    rpHeadRange: ['#', 'Day', 'CAIID', 'Tote', 'Going to', 'Pieces', 'Value (EGP)', 'What we found'],
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    followCol: 'Follow-up', followAll: 'All statuses', followEdit: '✎ Update',
    st_open: 'Open', st_investigating: 'Investigating', st_found: 'Found', st_charged: 'Charged', st_not_lost: 'Not lost', st_closed: 'Closed, not found',
    followTitle: 'Follow-up for {tote}', followStatus: 'Status', followNote: 'Note',
    followNotePh: 'What happened? Who did you talk to? Where did the items go?', followBy: 'Your name',
    followSave: 'Save', followCancel: 'Cancel', followSaving: 'Saving…', followNeedName: 'Type your name first',
    followFail: 'Not saved: {e}', followHistory: 'History', followNone: 'Nothing recorded for this tote yet.',
    followUnsupported: 'Follow-up needs the updated Apps Script (New version) to work.',
    rpKeyFollow: 'Follow-up: {list}.',
  },
};

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (err) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (err) { /* private mode */ } },
};
let LANG = store.get('cpo-lang') === 'en' ? 'en' : 'ar';

function t(key, vars) {
  const s = I18N[LANG][key] != null ? I18N[LANG][key] : I18N.ar[key];
  if (typeof s === 'function') return s(vars);
  if (typeof s !== 'string') return s;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : '')) : s;
}
const catLabel = c => t('cat_' + c);
const catTitle = c => t('cat_' + c + '_t');

const state = {
  tab: location.hash === '#lost' ? 'lost' : 'dash',
  data: null, pd: null, pdRaw: null, pdAt: 0, pdLoading: null, rows: [],
  wh: '', cat: '', day: '', ds: '', dsAll: false, catAll: false, trendTable: false,
  preset: 'week', search: null, seq: 0, searchSeq: 0, busy: false,
  ranges: new Map(), // every period pulled from the API this visit, so sub-periods need no new request
  searchCache: new Map(),
  follow: new Map(), followOk: null, followAt: 0, followLoading: null, fstatus: '', following: null,
};
const FOLLOW_STATUSES = ['open', 'investigating', 'found', 'charged', 'not_lost', 'closed'];
const PD_MAX_AGE_MS = 5 * 60 * 1000;

// Last default view and pallet data, kept in this browser so the next visit opens instantly.
const idb = {
  db: null,
  open() {
    if (!this.db) {
      this.db = new Promise((resolve, reject) => {
        const req = indexedDB.open('cpo-site', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.db;
  },
  async get(key) {
    try {
      const db = await this.open();
      return await new Promise(resolve => {
        const req = db.transaction('kv').objectStore('kv').get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(undefined);
      });
    } catch (err) {
      return undefined;
    }
  },
  async set(key, value) {
    try {
      const db = await this.open();
      await new Promise(resolve => {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(value, key);
        tx.oncomplete = resolve;
        tx.onerror = resolve;
      });
    } catch (err) {
      // storage is only a speed-up
    }
  },
};

// ---------- helpers ----------
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const money = n => nf0.format(Math.round(n || 0));
const egp = n => t('egp', { n: money(n) });
const egpBig = n => t('egpBig', { n: money(n) });
const qtyf = n => nf2.format(n || 0);
const pcs = n => t('pcs', Math.round(n));
const compact = n => (Math.abs(n) >= 1e6 ? nf2.format(n / 1e6) + 'M' : Math.abs(n) >= 1e3 ? nf0.format(n / 1e3) + 'K' : nf0.format(n));
const sum = (a, f) => a.reduce((s, x) => s + (f ? f(x) : x), 0);
const base = x => String(x || '').replace(/_v\d+$/i, '');
const ver = x => { const m = /_v(\d+)$/i.exec(x || ''); return m ? Number(m[1]) : 0; };
const trBase = x => String(x || '').split('/')[0];
const mono = x => `<span class="mono">${esc(x)}</span>`;
const pad = n => String(n).padStart(2, '0');
const dm = iso => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

function shift(day, n) {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(from, to) {
  const out = [];
  for (let d = from; d <= to && out.length < 400; d = shift(d, 1)) out.push(d);
  return out;
}
// '2026-10-24 6:53' / '2026-10-19 11:46:00' -> {iso:'2026-10-24 06:53', label:'24/10 06:53'}
function localStamp(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/.exec(String(s || '').trim());
  if (!m) return { iso: String(s || ''), label: String(s || '') };
  return { iso: `${m[1]}-${m[2]}-${m[3]} ${pad(m[4])}:${m[5]}`, label: `${m[3]}/${m[2]} ${pad(m[4])}:${m[5]}` };
}
const cairoParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
// Wrong Connection created_at is UTC
function utcToCairo(s) {
  const d = new Date(String(s || '').replace(' ', 'T') + 'Z');
  if (isNaN(d)) return { iso: String(s || ''), day: '', time: '', label: String(s || '') };
  const p = Object.fromEntries(cairoParts.formatToParts(d).map(x => [x.type, x.value]));
  return { iso: `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`, day: `${p.day}/${p.month}`, time: `${p.hour}:${p.minute}`,
    label: `${p.day}/${p.month} ${p.hour}:${p.minute}` };
}

function dsName(code) {
  if (!code) return '';
  const pd = state.pd && state.pd.dsNames[code];
  return pd || DS_FALLBACK[code] || (state.data && state.data.dsNames && state.data.dsNames[code]) || code;
}

function notice(html, kind) {
  const n = $('notice');
  n.className = 'notice' + (kind ? ' ' + kind : '');
  n.innerHTML = html;
  n.hidden = !html;
}

// ---------- loading ----------
// one retry: a dropped connection to Google shows up as "Failed to fetch"
async function fetchRetry(url) {
  try {
    return await fetch(url, { cache: 'no-store' });
  } catch (err) {
    await new Promise(r => setTimeout(r, 1500));
    return fetch(url, { cache: 'no-store' });
  }
}

async function api(params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetchRetry(API_URL + (API_URL.includes('?') ? '&' : '?') + qs);
  if (!res.ok) throw new Error(t('apiStatus', { s: res.status }));
  const out = await res.json();
  if (!out.ok) throw new Error(out.error || t('apiError'));
  return out;
}

// Plain form body, so the browser sends it without a CORS preflight; never retried, it appends a row.
async function apiPost(params) {
  const res = await fetch(API_URL, { method: 'POST', body: new URLSearchParams(params) });
  if (!res.ok) throw new Error(t('apiStatus', { s: res.status }));
  const out = await res.json();
  if (!out.ok) throw new Error(out.error || t('apiError'));
  return out;
}

// Follow-up rows grouped by tote, oldest first: [time, tote, status, note, by, day, wh, branch, value]
function refreshFollow(force) {
  if (!API_URL || state.followLoading || (!force && Date.now() - state.followAt < 60 * 1000)) return;
  state.followLoading = api({ action: 'follow' })
    .then(out => {
      // a deployment from before the follow-up answers with range data and no rows
      state.followOk = Array.isArray(out.rows);
      if (state.followOk) {
        const m = new Map();
        out.rows.forEach(r => { if (!m.has(r[1])) m.set(r[1], []); m.get(r[1]).push(r); });
        state.follow = m;
      }
      state.followAt = Date.now();
      if (state.data) { renderLost(); renderSearch(); renderReport(); }
    })
    .catch(() => { if (state.followOk == null) state.followOk = false; })
    .finally(() => { state.followLoading = null; });
}

const followOf = tote => { const h = state.follow.get(tote); return h ? h[h.length - 1] : null; };
const statusOf = tote => { const f = followOf(tote); return f ? f[2] : 'open'; };
const stPill = st => `<span class="st ${st}">${t('st_' + st)}</span>`;
const fuStamp = at => `${at.slice(8, 10)}/${at.slice(5, 7)} ${at.slice(11, 16)}`;

function followCell(r) {
  const f = followOf(r.awb);
  let html = stPill(f ? f[2] : 'open');
  if (f && f[3]) html += `<div class="fu-note">${esc(f[3].length > 90 ? f[3].slice(0, 90) + '…' : f[3])}</div>`;
  if (f) html += `<div class="fu-by">${esc(f[4])} · ${fuStamp(f[0])}</div>`;
  if (state.followOk) html += `<button class="link fu-edit" data-follow="${esc(r.awb)}">${t('followEdit')}</button>`;
  return html;
}

function openFollow(tote) {
  let r = state.rows.find(x => x.awb === tote);
  if (!r && state.search && state.search.out) {
    const l = (state.search.out.lost || []).find(x => x[0] === tote);
    if (l) r = { awb: l[0], d: l[5], wh: l[2], ds: l[3], val: l[8], qty: l[6] };
  }
  if (!r) return;
  state.following = r;
  const f = followOf(tote);
  const cur = f ? f[2] : 'open';
  $('fu-title').textContent = t('followTitle', { tote });
  $('fu-info').innerHTML = `${dm(r.d)} · <span class="ltr">${esc(r.wh)}</span> → ${esc(dsName(r.ds))} · ${pcs(r.qty)} · ${egp(r.val)}`;
  $('fu-statuses').innerHTML = `<legend>${t('followStatus')}</legend>` + FOLLOW_STATUSES.map(st =>
    `<label class="fu-st"><input type="radio" name="fu-st" value="${st}" ${st === cur ? 'checked' : ''}>${stPill(st)}</label>`).join('');
  $('fu-note').value = '';
  $('fu-note').placeholder = t('followNotePh');
  $('fu-by').value = store.get('cpo-name') || '';
  $('fu-msg').textContent = '';
  $('fu-save').disabled = false;
  const hist = (state.follow.get(tote) || []).slice().reverse();
  $('fu-history').innerHTML = `<h4>${t('followHistory')}</h4>` + (hist.length
    ? hist.map(h => `<div class="fu-h">${stPill(h[2])} <span class="fu-by">${esc(h[4])} · ${fuStamp(h[0])}</span>${h[3] ? `<div class="fu-note">${esc(h[3])}</div>` : ''}</div>`).join('')
    : `<div class="muted">${t('followNone')}</div>`);
  $('follow-dlg').showModal();
}

async function saveFollow(e) {
  e.preventDefault();
  const r = state.following;
  const by = $('fu-by').value.trim();
  if (!by) { $('fu-msg').textContent = t('followNeedName'); $('fu-by').focus(); return; }
  store.set('cpo-name', by);
  const picked = document.querySelector('input[name="fu-st"]:checked');
  const status = picked ? picked.value : 'open';
  $('fu-save').disabled = true;
  $('fu-msg').textContent = t('followSaving');
  try {
    const out = await apiPost({ action: 'follow', tote: r.awb, status, note: $('fu-note').value.trim(), by,
      day: r.d, wh: r.wh, ds: r.ds, value: Math.round(r.val) });
    if (!state.follow.has(r.awb)) state.follow.set(r.awb, []);
    state.follow.get(r.awb).push(out.row);
    $('follow-dlg').close();
    renderLost();
    renderSearch();
    renderReport();
  } catch (err) {
    $('fu-msg').textContent = t('followFail', { e: err.message });
    $('fu-save').disabled = false;
  }
}

function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

async function loadPDRaw() {
  const get = async gid => {
    const res = await fetchRetry(`https://docs.google.com/spreadsheets/d/${PD_SHEET}/export?format=csv&gid=${gid}&_=${Date.now()}`);
    if (!res.ok) throw new Error(t('pdStatus', { s: res.status }));
    return parseCSV(await res.text());
  };
  const [disp, scans, hist] = await Promise.all([get(PD_TABS.dispatching), get(PD_TABS.scans), get(PD_TABS.history)]);
  return { disp, scans, hist };
}

// Pallet data loads beside the API call and never holds up the dashboard.
function refreshPD() {
  if (state.pdLoading) return state.pdLoading;
  state.pdLoading = loadPDRaw()
    .then(raw => {
      state.pdRaw = raw;
      state.pd = indexPD(raw.disp, raw.scans, raw.hist);
      state.pdAt = Date.now();
      if (state.data) {
        state.rows = analyze(state.data.lost, state.data.lines, state.data.wc, state.pd);
        renderLost();
        renderSearch();
        renderReport();
      }
      saveLast();
    })
    .catch(err => { if (!state.pd) notice(`<b>${t('loadFail')}</b> ${esc(err.message)}`, 'error'); })
    .finally(() => { state.pdLoading = null; });
  return state.pdLoading;
}

function cols(header, names) {
  const h = header.map(x => String(x).trim().toLowerCase());
  const out = {};
  Object.entries(names).forEach(([k, n]) => { out[k] = h.indexOf(n.toLowerCase()); });
  return out;
}

function indexPD(disp, scans, hist) {
  const pd = {
    palOf: new Map(), palTotes: new Map(), palInfo: new Map(), scans: new Map(), palScanned: new Map(),
    palReviewed: new Map(), byBase: new Map(), dsNames: {}, whs: new Set(),
  };
  const addTote = (pallet, tote, info) => {
    if (!pallet || !tote) return;
    const had = pd.palOf.get(tote);
    if (!had) pd.palOf.set(tote, { pallet, ...info });
    else if (had.pallet === pallet) Object.entries(info).forEach(([k, v]) => { if (v && !had[k]) had[k] = v; });
    if (!pd.palTotes.has(pallet)) pd.palTotes.set(pallet, new Set());
    pd.palTotes.get(pallet).add(tote);
    const old = pd.palInfo.get(pallet) || {};
    pd.palInfo.set(pallet, { ...info, ...Object.fromEntries(Object.entries(old).filter(([, v]) => v)) });
    const b = base(tote);
    if (!pd.byBase.has(b)) pd.byBase.set(b, []);
    pd.byBase.get(b).push({ v: ver(tote), tote, when: info.created, where: info.branch, src: 'pallet', pallet });
  };

  const hc = cols(hist[0] || [], { pallet: 'Pallet', tote: 'Tote', branch: 'Branch', loc: 'Staging location', created: 'Pallet created', review: 'Review time', dispatch: 'Dispatch time' });
  hist.slice(1).forEach(r => addTote(r[hc.pallet], r[hc.tote], {
    branch: r[hc.branch] || '', created: localStamp(r[hc.created]).iso, loc: r[hc.loc] || '',
    review: r[hc.review] || '', dispatch: r[hc.dispatch] || '',
  }));
  const dc = cols(disp[0] || [], { loc: 'staging_location', pallet: 'palletBarcode', tote: 'containerBarcode', wh: 'source_warehouse_code',
    branch: 'destination_darkstore', ds: 'destination_ds_code', created: 'pallet_creation_date' });
  disp.slice(1).forEach(r => {
    if (r[dc.ds] && r[dc.branch]) pd.dsNames[r[dc.ds]] = r[dc.branch];
    if (r[dc.wh]) pd.whs.add(r[dc.wh]);
    addTote(r[dc.pallet], r[dc.tote], { branch: r[dc.branch] || '', created: localStamp(r[dc.created]).iso, loc: r[dc.loc] || '', wh: r[dc.wh] || '' });
  });
  const sc = cols(scans[0] || [], { date: 'Scan date', time: 'Scan time', type: 'Type', pallet: 'Pallet', tote: 'Tote', branch: 'Branch',
    reviewer: 'Reviewer', shift: 'Shift', stage: 'Stage' });
  scans.slice(1).forEach(r => {
    const when = localStamp(`${r[sc.date]} ${r[sc.time]}`);
    const row = { when, pallet: r[sc.pallet], tote: r[sc.tote], reviewer: r[sc.reviewer] || '', stage: r[sc.stage] || 'Review', branch: r[sc.branch] || '' };
    if (r[sc.type] === 'Tote' && row.tote) {
      if (!pd.scans.has(row.tote)) pd.scans.set(row.tote, []);
      pd.scans.get(row.tote).push(row);
      if (!pd.palScanned.has(row.pallet)) pd.palScanned.set(row.pallet, new Set());
      pd.palScanned.get(row.pallet).add(row.tote);
    } else if (r[sc.type] === 'Pallet' && row.pallet && !pd.palReviewed.has(row.pallet)) {
      pd.palReviewed.set(row.pallet, row);
    }
  });
  pd.scans.forEach(list => list.sort((a, b) => (a.when.iso < b.when.iso ? -1 : 1)));
  if (!pd.whs.size) pd.whs.add('CAIID01');
  return pd;
}

// ---------- evidence ----------
// lost: [awb, transfer, wh, ds, dsName, day, qty, user, value, lossType]
// lines: [transfer, awb, day, wh, ds, category, barcode, missV, excV, missQ, excQ]
// wc: [box, createdAtUTC, srcWh, destDs, scanDs, error, day, isToteMissing, value, scanOk]
function analyze(lost, lines, wc, pd) {
  const byAwb = new Map();
  const excessBySku = new Map();
  lines.forEach(x => {
    if (!byAwb.has(x[1])) byAwb.set(x[1], []);
    byAwb.get(x[1]).push(x);
    if (x[10] > 0) {
      if (!excessBySku.has(x[6])) excessBySku.set(x[6], []);
      excessBySku.get(x[6]).push(x);
    }
  });
  const wcByTote = new Map();
  const later = new Map();
  pd.byBase.forEach((list, b) => later.set(b, list.slice()));
  wc.forEach(w => {
    if (!wcByTote.has(w[0])) wcByTote.set(w[0], []);
    wcByTote.get(w[0]).push(w);
    const b = base(w[0]);
    if (!later.has(b)) later.set(b, []);
    later.get(b).push({ v: ver(w[0]), tote: w[0], when: utcToCairo(w[1]).iso, where: w[4], src: 'scan' });
  });
  const lostSet = new Set(lost.map(r => r[0]));

  return lost.map(r => {
    const [awb, tr, wh, ds, , d, qty, user, val] = r;
    const ev = [];
    const p = pd.palOf.get(awb);
    if (p) {
      const sc = pd.scans.get(awb) || [];
      const tot = (pd.palTotes.get(p.pallet) || new Set()).size;
      const done = (pd.palScanned.get(p.pallet) || new Set()).size;
      if (sc.length) ev.push({ k: 'scanned', when: sc[0].when, stage: sc[0].stage, reviewer: sc[0].reviewer, pallet: p.pallet, done, tot });
      else if (done || pd.palReviewed.has(p.pallet)) ev.push({ k: 'not_scanned', pallet: p.pallet, done, tot });
      else ev.push({ k: 'not_reviewed', pallet: p.pallet, tot, created: p.created });
    } else if (pd.whs.has(wh)) {
      ev.push({ k: 'no_pallet' });
    }
    const v0 = ver(awb);
    if (v0) {
      const again = (later.get(base(awb)) || []).filter(x => x.v > v0).sort((a, b) => a.v - b.v || (a.when < b.when ? -1 : 1));
      if (again.length) ev.push({ k: 'reused', ...again[0] });
    }
    const seen = new Set();
    (wcByTote.get(awb) || []).slice().sort((a, b) => (a[1] < b[1] ? -1 : 1)).forEach(w => {
      const k = w[4] !== w[3] ? 'wrong_scan' : 'own_scan';
      if (seen.has(k + w[4])) return;
      seen.add(k + w[4]);
      ev.push({ k, scan: w[4], at: utcToCairo(w[1]), err: w[5] });
    });
    const its = byAwb.get(awb) || [];
    const exc = its.filter(x => x[10] > 0);
    const miss = its.filter(x => x[9] > 0);
    if (exc.length) {
      ev.push({ k: 'excess', q: sum(exc, x => x[10]), v: sum(exc, x => x[8]), sameSku: exc.some(x => miss.some(m => m[6] === x[6])) });
    }
    const els = new Map();
    const seenSku = new Set();
    const lo = shift(d, -1), hi = shift(d, 2);
    miss.forEach(m => {
      (excessBySku.get(m[6]) || []).forEach(e => {
        if (e[1] === awb || e[2] < lo || e[2] > hi) return;
        let kind = null;
        if (trBase(e[0]) === trBase(tr)) kind = 'same_transfer';
        else if (e[2] === d && e[10] === m[9] && m[9] >= 2) kind = lostSet.has(e[1]) ? 'swap' : 'maybe';
        if (!kind || seenSku.has(m[6] + '|' + e[4])) return;
        seenSku.add(m[6] + '|' + e[4]);
        const take = Math.min(m[9], e[10]);
        const key = e[4] + '|' + kind;
        const a = els.get(key) || { k: 'elsewhere', ds: e[4], kind, q: 0, v: 0, totes: new Set() };
        a.q += take;
        a.v += e[10] ? (e[8] * take) / e[10] : 0;
        a.totes.add(e[1]);
        els.set(key, a);
      });
    });
    els.forEach(a => ev.push(a));

    const rec = { awb, tr, wh, ds, d, qty, val, user, ev };
    describe(rec, pd);
    return rec;
  });
}

// Sets rec.lines (localized evidence) and rec.cat; rerun after a language change.
function describe(rec, pd) {
  const all = evidenceLines(rec, pd);
  const tags = new Set(all.map(l => l.cat));
  rec.cat = CAT_ORDER.find(c => c !== 'gray' && tags.has(c)) || 'gray';
  rec.lines = rec.cat === 'gray' ? all : all.filter(l => l.k !== 'no_pallet' && l.k !== 'none');
  return rec;
}

function evidenceLines(rec, pd) {
  const out = [];
  const add = (cat, tag, html, k) => out.push({ cat, tag: t(tag), html, k });
  rec.ev.forEach(e => {
    switch (e.k) {
      case 'wrong_scan':
        add('red', 'tagWrong', t('evWrongScan', { scan: esc(dsName(e.scan)), day: e.at.day, time: e.at.time, ds: esc(dsName(rec.ds)) }), e.k);
        break;
      case 'own_scan':
        add('blue', 'tagAtBranch', t('evOwnScan', { scan: esc(dsName(e.scan)), day: e.at.day, time: e.at.time }), e.k);
        break;
      case 'elsewhere': {
        const n = e.totes.size;
        const on = n === 1 ? t('evOnTote', { tote: mono([...e.totes][0]) }) : t('totes', n);
        const vars = { pcs: pcs(e.q), v: egp(e.v), ds: esc(dsName(e.ds)), on };
        if (e.kind === 'same_transfer') add('red', 'tagWrong', t('evSameTransfer', vars), e.k);
        else if (e.kind === 'swap') add('red', 'tagWrong', t('evSwap', vars), e.k);
        else add('gray', 'tagMaybe', t('evMaybe', vars), e.k);
        break;
      }
      case 'excess':
        add('amber', 'tagExcess', t('evExcess', { ds: esc(dsName(rec.ds)), pcs: pcs(e.q), v: egp(e.v), how: t(e.sameSku ? 'evExcessExtra' : 'evExcessOther') }), e.k);
        break;
      case 'scanned':
        add('green', 'tagScanned', t('evScanned', { stage: esc(e.stage), when: e.when.label, pallet: mono(e.pallet), done: e.done, tot: e.tot }), e.k);
        break;
      case 'not_scanned':
        add('rust', 'tagNotScanned', t('evNotScanned', { pallet: mono(e.pallet), done: e.done, tot: e.tot }), e.k);
        break;
      case 'reused': {
        const vars = { v: mono('_v' + e.v), where: esc(e.src === 'pallet' ? e.where : dsName(e.where)), when: localStamp(e.when).label };
        add('purple', 'tagBack', t(e.src === 'pallet' ? 'evBackPallet' : 'evBackScan', vars), e.k);
        break;
      }
      case 'not_reviewed':
        add('gray', 'tagNoScan', t('evNotReviewed', { pallet: mono(e.pallet), created: localStamp(e.created).label, tot: e.tot }), e.k);
        break;
      case 'no_pallet':
        add('gray', 'tagNoPallet', t('evNoPallet'), e.k);
        break;
      default:
    }
  });
  if (!out.length) add('gray', 'tagNone', pd.whs.has(rec.wh) ? t('evNone') : t('evNoneWh', { wh: esc(rec.wh) }), 'none');
  return out.sort((a, b) => LINE_ORDER[a.cat] - LINE_ORDER[b.cat]);
}

// ---------- dashboard ----------
function inRange(d) { return d >= state.data.from && d <= state.data.to; }

function renderDash() {
  const D = state.data;
  const wh = state.wh;
  const rows = D.summary.filter(r => !wh || r[1] === wh);
  const lost = D.lost.filter(r => !wh || r[2] === wh);
  const buckets = D.buckets.filter(r => !wh || r[1] === wh);
  const days = daysBetween(D.from, D.to);
  const tot = { m: sum(rows, r => r[4]), dm: sum(rows, r => r[5]), ex: sum(rows, r => r[6]), mq: sum(rows, r => r[7]) };
  const allB = buckets.filter(r => r[2] === 'all');

  const wcTotes = new Map();
  D.wc.forEach(w => {
    if (!inRange(w[6]) || String(w[7]).toUpperCase() !== 'YES' || (wh && w[2] !== wh)) return;
    wcTotes.set(w[0], Math.max(wcTotes.get(w[0]) || 0, w[8] || 0));
  });
  const cpo = D.cpo.filter(c => inRange(c[0])).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const lastCpo = cpo[cpo.length - 1];

  const kpi = (cls, k, v, s) => `<div class="kpi ${cls}"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
  $('kpis').innerHTML = [
    kpi('lead', t('kMissing'), egpBig(tot.m), `${t('piecesN', qtyf(tot.mq))} · ${t('totesN', nf0.format(sum(allB, r => r[5])))}`),
    kpi('', t('kDamage'), egpBig(tot.dm), t('piecesN', qtyf(sum(rows, r => r[8])))),
    kpi('', t('kExcess'), egpBig(tot.ex), tot.m ? t('ofMissing', { p: nf0.format((tot.ex / tot.m) * 100) }) : ''),
    kpi('', t('kBoxLost'), t('totesN', lost.length), egp(sum(lost, r => r[8]))),
    kpi('', t('kWc'), t('totesN', wcTotes.size), egp(sum([...wcTotes.values()]))),
    wh ? kpi('', t('kCpo'), '—', t('cpoNoWh'))
      : kpi('', t('kCpo'), cpo.length ? nf2.format(sum(cpo, c => c[1]) / cpo.length) : '—',
        lastCpo ? t('cpoAvg', { d: dm(lastCpo[0]), v: nf2.format(lastCpo[1]) }) : t('cpoNone')),
  ].join('');

  // trend
  const byDay = new Map(days.map(d => [d, [0, 0, 0]]));
  rows.forEach(r => { const a = byDay.get(r[0]); if (a) { a[0] += r[4]; a[1] += r[5]; a[2] += r[6]; } });
  const series = [
    { name: 'Missing', color: 'var(--series-1)', values: days.map(d => byDay.get(d)[0]) },
    { name: 'Damage', color: 'var(--series-2)', values: days.map(d => byDay.get(d)[1]) },
    { name: 'Excess', color: 'var(--series-3)', values: days.map(d => byDay.get(d)[2]) },
  ];
  $('trend-legend').innerHTML = series.map(s => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join('');
  lineChart($('trend'), days, series);
  $('trend-table').innerHTML = table([t('day'), 'Missing', 'Damage', 'Excess'],
    days.map(d => [dm(d), ...byDay.get(d).map(money)]), [false, true, true, true]);
  $('trend-table').hidden = !state.trendTable;
  $('trend').hidden = state.trendTable;
  $('trend-table-btn').textContent = t(state.trendTable ? 'asChart' : 'asTable');

  // by warehouse
  const pct = (a, b) => (b ? nf0.format((a / b) * 100) + '%' : '—');
  const whRows = (wh ? [wh] : WHS).map(w => {
    const rr = rows.filter(r => r[1] === w);
    const ll = lost.filter(r => r[2] === w);
    const m = sum(rr, r => r[4]);
    const ex = sum(rr, r => r[6]);
    return [w, money(m), money(sum(rr, r => r[5])), money(ex), pct(ex, m), ll.length, money(sum(ll, r => r[8]))];
  });
  whRows.push([t('total'), money(tot.m), money(tot.dm), money(tot.ex), pct(tot.ex, tot.m), lost.length, money(sum(lost, r => r[8]))]);
  $('wh-table').innerHTML = table(t('whHead'), whRows, [false, true, true, true, true, true, true], { totalLast: true });

  // buckets
  const bucketNames = [['all', 'bAll'], ['partial', 'bPartial'], ['sku', 'bSku'], ['full', 'bFull']];
  $('bucket-table').innerHTML = table(t('bucketHead'), bucketNames.map(([k, n]) => {
    const b = buckets.filter(r => r[2] === k);
    return [t(n), qtyf(sum(b, r => r[3])), nf0.format(sum(b, r => r[5])), money(sum(b, r => r[4])), nf0.format(sum(b, r => r[6]))];
  }), [false, true, true, true, true], { totalFirst: true }) +
    (days.length > 1 ? `<div class="hint">${t('bucketDaily')}</div>` : '');

  // by branch and category
  const group = keyIdx => {
    const m = new Map();
    rows.forEach(r => {
      const k = r[keyIdx] || '—';
      const a = m.get(k) || [0, 0, 0];
      a[0] += r[4]; a[1] += r[5]; a[2] += r[6];
      m.set(k, a);
    });
    return [...m.entries()].sort((a, b) => b[1][0] - a[1][0]);
  };
  const lostByDs = new Map();
  lost.forEach(r => lostByDs.set(r[3], (lostByDs.get(r[3]) || 0) + 1));
  const ds = group(2);
  const dsMax = ds.length ? ds[0][1][0] : 0;
  $('ds-table').innerHTML = table(t('dsHead'),
    (state.dsAll ? ds : ds.slice(0, 12)).map(([k, a]) => [
      `<span title="${esc(k)}">${esc(dsName(k))}</span>`, money(a[0]), barHtml(a[0], dsMax), money(a[1]), money(a[2]), lostByDs.get(k) || 0,
    ]), [false, true, false, true, true, true], { raw: true });
  $('ds-more').textContent = state.dsAll ? t('showTop') : t('showAll', { n: ds.length });
  const cat = group(3);
  const catMax = cat.length ? cat[0][1][0] : 0;
  $('cat-table').innerHTML = table(t('catHead'),
    (state.catAll ? cat : cat.slice(0, 12)).map(([k, a]) => [esc(k), money(a[0]), barHtml(a[0], catMax), money(a[1]), money(a[2])]),
    [false, true, false, true, true], { raw: true });
  $('cat-more').textContent = state.catAll ? t('showTop') : t('showAll', { n: cat.length });
}

function barHtml(v, max) {
  const w = max > 0 ? Math.max(2, Math.round((v / max) * 100)) : 0;
  return `<div class="barcell"><div class="bar" style="width:${w}%"></div></div>`;
}

// rows are escaped unless opts.raw (callers then escape themselves)
function table(head, rows, numeric, opts = {}) {
  if (!rows.length) return `<div class="empty">${t('noData')}</div>`;
  const th = head.map((h, i) => `<th class="${numeric[i] ? 'n' : ''}">${esc(h)}</th>`).join('');
  const body = rows.map((r, ri) => {
    const total = (opts.totalLast && ri === rows.length - 1) || (opts.totalFirst && ri === 0);
    return `<tr class="${total ? 'total' : ''}">${r.map((c, i) => `<td class="${numeric[i] ? 'n' : ''}">${opts.raw ? c : esc(c)}</td>`).join('')}</tr>`;
  }).join('');
  return `<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
}

function lineChart(el, days, series) {
  if (days.length < 2) {
    el.innerHTML = `<div class="empty">${t('pickMoreDays')}</div>`;
    return;
  }
  const W = 900, H = 270, L = 52, R = 104, T = 14, B = 30;
  const max = Math.max(1, ...series.flatMap(s => s.values));
  const step = niceStep(max / 4);
  const top = Math.ceil(max / step) * step;
  const x = i => L + (i * (W - L - R)) / (days.length - 1);
  const y = v => T + (H - T - B) * (1 - v / top);
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('chartAria'))}">`;
  svg += '<g class="grid">';
  for (let v = 0; v <= top + 1e-6; v += step) {
    svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${compact(v)}</text>`;
  }
  svg += '</g>';
  const every = Math.ceil(days.length / 12);
  days.forEach((d, i) => {
    if (i % every === 0 || i === days.length - 1) svg += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${dm(d)}</text>`;
  });
  series.forEach(s => {
    const pts = s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    svg += `<polyline points="${pts}" fill="none" style="stroke:${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    if (days.length <= 31) {
      s.values.forEach((v, i) => { svg += `<circle cx="${x(i)}" cy="${y(v)}" r="4" style="fill:${s.color}" stroke="var(--surface)" stroke-width="2"/>`; });
    }
  });
  // end labels, nudged apart so they never overlap
  const ends = series.map(s => ({ s, y: y(s.values[s.values.length - 1]) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
  ends.forEach(e => {
    svg += `<text class="end-label" x="${W - R + 10}" y="${e.y + 4}">${e.s.name} ${compact(e.s.values[e.s.values.length - 1])}</text>`;
  });
  svg += `<line class="cross" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="var(--muted)" stroke-width="1" visibility="hidden"/>`;
  svg += `<rect class="hit" x="${L - 10}" y="0" width="${W - L - R + 20}" height="${H}" fill="transparent"/>`;
  svg += '</svg>';
  el.innerHTML = svg;

  const svgEl = el.querySelector('svg');
  const cross = svgEl.querySelector('.cross');
  const show = evt => {
    const box = svgEl.getBoundingClientRect();
    const px = ((evt.clientX - box.left) / box.width) * W;
    const i = Math.max(0, Math.min(days.length - 1, Math.round(((px - L) / (W - L - R)) * (days.length - 1))));
    cross.setAttribute('x1', x(i));
    cross.setAttribute('x2', x(i));
    cross.setAttribute('visibility', 'visible');
    tooltip(evt.clientX, evt.clientY, dm(days[i]), series.map(s => [s.name, s.color, egp(s.values[i])]));
  };
  const hide = () => { cross.setAttribute('visibility', 'hidden'); tooltip(); };
  const hit = svgEl.querySelector('.hit');
  hit.addEventListener('pointermove', show);
  hit.addEventListener('pointerleave', hide);
}

function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

function tooltip(cx, cy, title, items) {
  const tip = $('tooltip');
  if (title == null) { tip.hidden = true; return; }
  tip.replaceChildren();
  const h = document.createElement('div');
  h.className = 't';
  h.textContent = title;
  tip.appendChild(h);
  items.forEach(([name, color, value]) => {
    const r = document.createElement('div');
    r.className = 'r';
    const b = document.createElement('b');
    b.textContent = value;
    const n = document.createElement('span');
    const i = document.createElement('i');
    i.style.background = color;
    n.append(i, document.createTextNode(name));
    r.append(b, n);
    tip.appendChild(r);
  });
  tip.hidden = false;
  const w = tip.offsetWidth, hh = tip.offsetHeight;
  tip.style.left = Math.min(window.innerWidth - w - 8, cx + 14) + 'px';
  tip.style.top = Math.max(8, cy - hh - 12) + 'px';
}

// ---------- lost totes ----------
function renderLost() {
  if (!state.pd) {
    $('cats').innerHTML = '';
    $('lost-title').textContent = t('lostTitle', { from: dm(state.data.from), to: dm(state.data.to) });
    $('lost-table').innerHTML = `<div class="empty">${t('pdLoading')}</div>`;
    return;
  }
  const all = state.rows.filter(r => !state.wh || r.wh === state.wh);
  const card = (cls, on, k, n, v, c) => `<button class="cat ${cls} ${on ? 'on' : ''}" data-cat="${c}"><div class="k">${k}</div><div class="v">${n}</div><div class="s">${v}</div></button>`;
  $('cats').innerHTML = [card('all', !state.cat, t('allTotes'), all.length, egp(sum(all, r => r.val)), '')]
    .concat(CAT_ORDER.map(c => {
      const g = all.filter(r => r.cat === c);
      return card(c, state.cat === c, catLabel(c), g.length, egp(sum(g, r => r.val)), c);
    })).join('');

  const days = [...new Set(all.map(r => r.d))].sort();
  fillSelect($('lost-day'), [['', t('allDays')]].concat(days.map(d => [d, dm(d)])), state.day);
  const dss = [...new Set(all.map(r => r.ds))].sort((a, b) => dsName(a).localeCompare(dsName(b)));
  fillSelect($('lost-ds'), [['', t('allDs')]].concat(dss.map(d => [d, dsName(d)])), state.ds);
  $('lost-follow').hidden = !state.followOk;
  fillSelect($('lost-follow'), [['', t('followAll')]].concat(FOLLOW_STATUSES.map(st =>
    [st, `${t('st_' + st)} (${all.filter(r => statusOf(r.awb) === st).length})`])), state.fstatus);
  $('follow-note').hidden = state.followOk !== false;
  $('follow-note').textContent = t('followUnsupported');

  const rows = filteredLost();
  $('lost-title').textContent = t('lostTitle', { from: dm(state.data.from), to: dm(state.data.to) });
  if (!rows.length) { $('lost-table').innerHTML = `<div class="empty">${t('noTotes')}</div>`; return; }
  const head = t('lostHead');
  let i = 0;
  const body = CAT_ORDER.map(c => {
    const g = rows.filter(r => r.cat === c).sort((a, b) => b.val - a.val);
    if (!g.length) return '';
    return `<tr class="lost-group"><td colspan="9"><span class="tag ${c}">${catLabel(c)}</span>${catTitle(c)} <span class="muted">· ${t('totesN', g.length)} · ${egp(sum(g, r => r.val))}</span></td></tr>` +
      g.map(r => `<tr><td>${++i}</td><td>${dm(r.d)}</td><td><span class="wh">${esc(r.wh)}</span></td>
        <td><button class="tote mono" data-q="${esc(r.awb)}">${esc(r.awb)}</button></td><td>${esc(dsName(r.ds))}</td>
        <td class="n">${qtyf(r.qty)}</td><td class="n">${money(r.val)}</td>
        <td>${r.lines.map(l => `<div class="ev"><span class="tag ${l.cat}">${l.tag}</span>${l.html}</div>`).join('')}</td>
        <td class="fu">${followCell(r)}</td></tr>`).join('');
  }).join('');
  $('lost-table').innerHTML = `<table><thead><tr>${head.map((h, j) => `<th class="${j === 5 || j === 6 ? 'n' : ''}">${esc(h)}</th>`).join('')}</tr></thead><tbody>${body}
    <tr class="total"><td></td><td colspan="4">${t('total')}</td><td class="n">${qtyf(sum(rows, r => r.qty))}</td><td class="n">${money(sum(rows, r => r.val))}</td><td></td><td></td></tr></tbody></table>`;
}

function filteredLost() {
  return state.rows.filter(r => (!state.wh || r.wh === state.wh) && (!state.cat || r.cat === state.cat) &&
    (!state.day || r.d === state.day) && (!state.ds || r.ds === state.ds) && (!state.fstatus || statusOf(r.awb) === state.fstatus));
}

function fillSelect(sel, options, value) {
  sel.innerHTML = options.map(([v, label]) => `<option value="${esc(v)}">${esc(label)}</option>`).join('');
  sel.value = options.some(o => o[0] === value) ? value : '';
}

function downloadCSV() {
  const rows = filteredLost();
  const strip = h => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent; };
  const head = ['date', 'warehouse', 'tote', 'transfer', 'branch_code', 'branch', 'qty', 'value', 'finding', 'evidence',
    'follow_status', 'follow_note', 'follow_by', 'follow_at'];
  const lines = [head].concat(rows.map(r => {
    const f = followOf(r.awb) || [];
    return [r.d, r.wh, r.awb, r.tr, r.ds, dsName(r.ds), r.qty, Math.round(r.val), catLabel(r.cat),
      r.lines.map(l => `${l.tag}: ${strip(l.html)}`).join(' | '), t('st_' + (f[2] || 'open')), f[3] || '', f[4] || '', f[0] || ''];
  }));
  const csv = '﻿' + lines.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `box_lost_${state.data.from}_${state.data.to}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- day report ----------
const IMAGE_LIB = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js';
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayLong = d => `${Number(d.slice(8, 10))} ${t('months')[Number(d.slice(5, 7)) - 1]}`;
const dayTag = d => `${Number(d.slice(8, 10))}${MONTHS_EN[Number(d.slice(5, 7)) - 1]}`;

function openReport() {
  if (!state.data || !state.pd) return;
  const days = [...new Set(state.rows.map(r => r.d))].sort();
  state.report = { day: state.day || days[days.length - 1] || '', evidenceOnly: state.report ? state.report.evidenceOnly : false };
  $('report-overlay').hidden = false;
  document.body.classList.add('report-open');
  $('rp-status').textContent = '';
  renderReport();
}

function closeReport() {
  $('report-overlay').hidden = true;
  document.body.classList.remove('report-open');
}

function reportRows() {
  const day = state.report.day;
  return state.rows.filter(r => (!state.wh || r.wh === state.wh) && (!day || r.d === day));
}

function renderReport() {
  if ($('report-overlay').hidden || !state.report) return;
  const D = state.data;
  const rp = state.report;
  const days = [...new Set(state.rows.map(r => r.d))].sort();
  if (rp.day && !days.includes(rp.day)) rp.day = days[days.length - 1] || '';
  fillSelect($('rp-day'), [['', t('rpWholePeriod', { from: dm(D.from), to: dm(D.to) })]].concat(days.map(d => [d, dayLong(d)])), rp.day);
  $('rp-evidence').checked = rp.evidenceOnly;

  const all = reportRows();
  const shown = rp.evidenceOnly ? all.filter(r => r.cat !== 'gray') : all;
  const range = !rp.day;
  const title = range ? t('rpTitleRange', { from: dayLong(D.from), to: dayLong(D.to) }) : t('rpTitleDay', { d: dayLong(rp.day) });
  const sub = t('rpSub') + (state.wh ? t('rpSubWh', { wh: state.wh }) : '') + (rp.evidenceOnly ? t('rpSubEvidence') : '');
  const head = `<div class="rp-head"><img src="assets/noon-minutes.png" alt="noon Minutes"><div class="rp-titles"><h1>${esc(title)}</h1><div class="rp-sub">${esc(sub)}</div></div></div>`;
  if (!all.length) {
    $('report').innerHTML = `<div class="rp" dir="${LANG === 'ar' ? 'rtl' : 'ltr'}" lang="${LANG}">${head}<div class="rp-empty">${t('rpNone')}</div></div>`;
    return;
  }

  const card = (cls, k, list) => `<div class="rp-card ${cls}"><div class="k">${k}</div><div class="v">${list.length}</div><div class="s">${egp(sum(list, r => r.val))}</div></div>`;
  const cards = [card('all', t('allTotes'), all)].concat(CAT_ORDER
    .filter(c => all.some(r => r.cat === c) && !(rp.evidenceOnly && c === 'gray'))
    .map(c => card(c, catLabel(c), all.filter(r => r.cat === c)))).join('');

  // summary lines, worked out from every tote of the day (not only the ones listed)
  const keys = [];
  const withEv = all.filter(r => r.cat !== 'gray');
  const totV = sum(all, r => r.val), evV = sum(withEv, r => r.val);
  keys.push(t('rpKeyEvidence', { n: t('totesN', withEv.length), t: all.length, v: egp(evV), tv: egp(totV), p: totV ? Math.round((evV / totV) * 100) : 0 }));
  [['red', 'rpKeyRed'], ['amber', 'rpKeyAmber'], ['blue', 'rpKeyBlue']].forEach(([c, k]) => {
    const g = all.filter(r => r.cat === c);
    if (g.length) keys.push(t(k, { n: t('totesN', g.length), v: egp(sum(g, r => r.val)) }));
  });
  const top = keyOf => {
    const m = new Map();
    all.forEach(r => { const a = m.get(keyOf(r)) || [0, 0]; a[0] += 1; a[1] += r.val; m.set(keyOf(r), a); });
    return [...m.entries()].sort((a, b) => b[1][0] - a[1][0] || b[1][1] - a[1][1])[0];
  };
  const ds = top(r => r.ds);
  // bdi keeps an English branch name from pulling the Arabic comma and count around it
  if (ds && ds[1][0] > 1) keys.push(t('rpKeyTopDs', { ds: `<bdi><b>${esc(dsName(ds[0]))}</b></bdi>`, n: t('totesN', ds[1][0]), v: egp(ds[1][1]) }));
  const wh = top(r => r.wh);
  if (wh && !state.wh && wh[1][0] > 1) keys.push(t('rpKeyTopWh', { wh: `<bdi><b>${esc(wh[0])}</b></bdi>`, n: t('totesN', wh[1][0]), v: egp(wh[1][1]) }));
  const unreviewed = [...new Set(all.flatMap(r => r.ev.filter(e => e.k === 'not_reviewed').map(e => e.pallet)))];
  if (unreviewed.length) keys.push(t('rpKeyNotReviewed', { n: unreviewed.length, list: unreviewed.map(mono).join(LANG === 'ar' ? '، ' : ', ') }));
  const followed = FOLLOW_STATUSES.filter(st => st !== 'open').map(st => [st, all.filter(r => statusOf(r.awb) === st).length]).filter(x => x[1]);
  if (followed.length) keys.push(t('rpKeyFollow', { list: followed.map(([st, n]) => `${t('st_' + st)} ${n}`).join(LANG === 'ar' ? '، ' : ', ') }));

  const cols = range ? ['c-n', 'c-d', 'c-wh', 'c-tote', 'c-ds', 'c-q', 'c-v', ''] : ['c-n', 'c-wh', 'c-tote', 'c-ds', 'c-q', 'c-v', ''];
  const headCells = t(range ? 'rpHeadRange' : 'rpHead');
  const numCol = i => i === headCells.length - 3 || i === headCells.length - 2;
  let i = 0;
  const body = CAT_ORDER.map(c => {
    const g = shown.filter(r => r.cat === c).sort((a, b) => b.val - a.val);
    if (!g.length) return '';
    return `<tr class="rp-group"><td colspan="${headCells.length}"><span class="tag ${c}">${catLabel(c)}</span>${catTitle(c)} <span class="muted">· ${t('totesN', g.length)} · ${egp(sum(g, r => r.val))}</span></td></tr>` +
      g.map(r => `<tr><td>${++i}</td>${range ? `<td>${dm(r.d)}</td>` : ''}<td><span class="wh">${esc(r.wh)}</span></td><td>${mono(r.awb)}</td>
        <td>${esc(dsName(r.ds))}</td><td class="n">${qtyf(r.qty)}</td><td class="n">${money(r.val)}</td>
        <td>${r.lines.map(l => `<div class="ev"><span class="tag ${l.cat}">${l.tag}</span>${l.html}</div>`).join('')}${reportFollow(r)}</td></tr>`).join('');
  }).join('');
  const total = `<tr class="rp-total"><td></td><td colspan="${range ? 4 : 3}">${t('total')}</td><td class="n">${qtyf(sum(shown, r => r.qty))}</td><td class="n">${money(sum(shown, r => r.val))}</td><td></td></tr>`;
  const pulled = utcToCairo(new Date(D.snapshotAt || D.generatedAt).toISOString().slice(0, 19).replace('T', ' ')).label;
  const now = utcToCairo(new Date().toISOString().slice(0, 19).replace('T', ' ')).label;

  $('report').innerHTML = `<div class="rp" dir="${LANG === 'ar' ? 'rtl' : 'ltr'}" lang="${LANG}">${head}<div class="rp-body">
    <div class="rp-cards">${cards}</div>
    <div class="rp-keys"><h3>${t('rpKeys')}</h3><ul>${keys.map(k => `<li>${k}</li>`).join('')}</ul></div>
    <table><colgroup>${cols.map(c => `<col class="${c}">`).join('')}</colgroup>
      <thead><tr>${headCells.map((h, j) => `<th class="${numCol(j) ? 'n' : ''}">${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${body}${total}</tbody></table>
    <div class="rp-note">${t('rpNote')}</div>
    <div class="rp-foot">${t('rpFoot', { pulled, now })}</div>
  </div></div>`;
}

function reportFollow(r) {
  const f = followOf(r.awb);
  if (!f || f[2] === 'open') return '';
  return `<div class="ev">${stPill(f[2])}${f[3] ? ' ' + esc(f[3]) : ''} <span class="fu-by">(${esc(f[4])} · ${fuStamp(f[0])})</span></div>`;
}

function reportFileName() {
  const D = state.data;
  const day = state.report.day;
  const span = day ? dayTag(day)
    : D.from.slice(0, 7) === D.to.slice(0, 7) ? `${Number(D.from.slice(8, 10))}-${dayTag(D.to)}` : `${dayTag(D.from)}-${dayTag(D.to)}`;
  return `Full_Tote_Missing_${span}${state.wh ? '_' + state.wh : ''}${LANG === 'ar' ? '_AR' : ''}`;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(src));
    document.head.appendChild(s);
  });
}

async function reportBlob() {
  if (!window.htmlToImage) await loadScript(IMAGE_LIB);
  const node = $('report').firstElementChild;
  // Chrome caps a canvas side at about 16k pixels, so long reports export at a lower scale
  const ratio = Math.max(1, Math.min(2, 16000 / node.offsetHeight));
  return window.htmlToImage.toBlob(node, { pixelRatio: ratio, backgroundColor: '#ffffff', skipFonts: true, cacheBust: true });
}

async function reportPng() {
  $('rp-status').textContent = t('rpMaking');
  try {
    const blob = await reportBlob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = reportFileName() + '.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    $('rp-status').textContent = t('rpSaved');
  } catch (err) {
    $('rp-status').textContent = t('rpFail', { e: err.message || err });
  }
}

async function reportCopy() {
  $('rp-status').textContent = t('rpMaking');
  try {
    if (!navigator.clipboard || !window.ClipboardItem) throw new Error('clipboard');
    // the item takes the promise so the copy stays tied to the click
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': reportBlob() })]);
    $('rp-status').textContent = t('rpCopied');
  } catch (err) {
    $('rp-status').textContent = t('rpCopyFail');
  }
}

function reportPdf() {
  const title = document.title;
  document.title = reportFileName();
  document.body.classList.add('printing');
  const done = () => {
    document.body.classList.remove('printing');
    document.title = title;
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
}

// ---------- search ----------
async function search(q) {
  q = String(q || '').trim().toUpperCase();
  const box = $('search-result');
  if (!q) { state.search = null; box.innerHTML = ''; return; }
  $('search').value = q;
  if (q.startsWith('FPI')) { state.search = { kind: 'pallet', q }; renderSearch(); return; }
  if (q.length < 6) { box.innerHTML = `<div class="result"><b>${t('searchFail')}</b> ${t('tooShort')}</div>`; return; }
  const key = q.replace(/_V\d+$/, '');
  const seq = ++state.searchSeq;
  if (state.searchCache.has(key)) { state.search = state.searchCache.get(key); renderSearch(); return; }
  // what the loaded period already knows shows at once; the full search of the sheet replaces it
  const local = localSearch(q);
  if (local) { state.search = { kind: local.kind, q, out: local, partial: true }; renderSearch(); }
  else box.innerHTML = `<div class="result"><div class="muted">${t('searching')}</div></div>`;
  try {
    const out = await api({ action: 'tote', q });
    const found = { kind: out.kind, q, out };
    state.searchCache.set(key, found);
    if (seq !== state.searchSeq) return;
    state.search = found;
    renderSearch();
  } catch (err) {
    if (seq !== state.searchSeq) return;
    box.innerHTML = `<div class="result"><b>${t('searchFail')}</b> ${esc(err.message)}</div>`;
  }
}

function localSearch(q) {
  const D = state.data;
  if (!D) return null;
  const isTransfer = q.startsWith('TR-');
  const b = q.replace(/_V\d+$/, '');
  const hit = v => {
    const s = String(v || '').toUpperCase();
    return isTransfer ? s === q || s.startsWith(q + '/') : s === b || s.startsWith(b + '_V');
  };
  const out = {
    q: isTransfer ? q : b, kind: isTransfer ? 'transfer' : 'tote',
    lost: D.lost.filter(r => hit(isTransfer ? r[1] : r[0])),
    lines: D.lines.filter(r => hit(isTransfer ? r[0] : r[1])),
    wc: isTransfer ? [] : D.wc.filter(r => hit(r[0])),
    mtd: [],
  };
  return out.lost.length || out.lines.length || out.wc.length ? out : null;
}

function renderSearch() {
  const s = state.search;
  if (!s) { $('search-result').innerHTML = ''; return; }
  if (!state.pd) { $('search-result').innerHTML = `<div class="result"><div class="muted">${t('pdLoading')}</div></div>`; return; }
  const view = s.kind === 'pallet' ? palletView(s.q) : s.kind === 'transfer' ? transferView(s.out) : toteView(s.out);
  $('search-result').innerHTML = view + (s.partial ? `<div class="hint">${t('searchPartial')}</div>` : '');
}

function resultShell(title, inner) {
  return `<div class="result"><button class="close link" data-close>${t('close')}</button><h3>${title}</h3>${inner}</div>`;
}

function mergeLines(a, b) {
  const seen = new Set();
  return a.concat(b).filter(x => { const k = x.slice(0, 11).join('|'); if (seen.has(k)) return false; seen.add(k); return true; });
}

function toteView(out) {
  const pd = state.pd;
  const versions = new Set();
  out.lost.forEach(r => versions.add(r[0]));
  out.lines.forEach(r => versions.add(r[1]));
  out.wc.forEach(r => versions.add(r[0]));
  out.mtd.forEach(r => versions.add(r[1]));
  (pd.byBase.get(out.q) || []).forEach(x => versions.add(x.tote));
  if (!versions.size) return resultShell(mono(out.q), `<div class="empty">${t('toteNotFound')}</div>`);
  const lines = mergeLines(out.lines, state.data ? state.data.lines : []);
  const wc = out.wc.concat((state.data ? state.data.wc : []).filter(w => base(w[0]) !== out.q));
  const evid = new Map(analyze(out.lost, lines, wc, pd).map(r => [r.awb, r]));
  const sorted = [...versions].sort((a, b) => ver(b) - ver(a));
  const head = `${mono(out.q)} <span class="muted">· ${t('versions', sorted.length)}${out.lost.length ? ' · ' + t('lostTimes', out.lost.length) : ''}</span>`;
  return resultShell(head, sorted.map(v => versionBlock(v, out, evid.get(v))).join(''));
}

function versionBlock(tote, out, ev) {
  const pd = state.pd;
  const lost = out.lost.filter(r => r[0] === tote);
  const lines = out.lines.filter(r => r[1] === tote);
  const mtd = out.mtd.filter(r => r[1] === tote);
  const wc = out.wc.filter(r => r[0] === tote).sort((a, b) => (a[1] < b[1] ? -1 : 1));
  const p = pd.palOf.get(tote);
  const scans = pd.scans.get(tote) || [];
  const first = (i, j, k) => (lost[0] && lost[0][i]) || (lines[0] && lines[0][j]) || (mtd[0] && mtd[0][k]) || '';
  const facts = [];
  const tr = first(1, 0, 0);
  if (tr) facts.push(`<div>${t('fTransfer')} <b>${mono(tr)}</b></div>`);
  const day = first(5, 2, 2);
  if (day) facts.push(`<div>${t('fDay')} <b>${dm(day)}</b></div>`);
  const wh = first(2, 3, 3) || (p && p.wh) || '';
  const ds = first(3, 4, 4);
  if (wh || ds || p) facts.push(`<div>${t('fRoute', { a: esc(wh || '—'), b: esc(ds ? dsName(ds) : (p && p.branch) || '—') })}</div>`);
  if (p) {
    const tot = (pd.palTotes.get(p.pallet) || new Set()).size;
    const done = (pd.palScanned.get(p.pallet) || new Set()).size;
    facts.push(`<div>${t('fPallet')} <button class="tote mono" data-q="${esc(p.pallet)}">${esc(p.pallet)}</button> <span class="muted">${t('palletMeta', { c: localStamp(p.created).label, d: done, t: tot })}</span></div>`);
  }
  scans.forEach(s => facts.push(`<div>${t('fScanned', { stage: esc(s.stage) })} <b>${s.when.label}</b>${s.reviewer ? ` <span class="muted">(${esc(s.reviewer)})</span>` : ''}</div>`));
  wc.forEach(w => {
    const ok = ['1', 'true'].includes(String(w[9]).toLowerCase());
    const wrong = w[4] !== w[3];
    facts.push(`<div>${t('fBranchScan', { b: esc(dsName(w[4])), at: utcToCairo(w[1]).label })} <span class="muted">(${ok ? t('scanOk') : esc(w[5] || '—')}${wrong ? ' · ' + t('shouldBe', { b: esc(dsName(w[3])) }) : ''})</span></div>`);
  });
  lost.forEach(r => facts.push(`<div><span class="tag gray">Box Lost</span> ${t('fBoxLost', { pcs: pcs(r[6]), v: egp(r[8]), d: dm(r[5]) })}</div>`));
  if (lost.length) {
    const f = followOf(tote);
    facts.push(`<div>${t('followCol')}: ${stPill(f ? f[2] : 'open')}${f && f[3] ? ` <b>${esc(f[3])}</b>` : ''}${f ? ` <span class="fu-by">${esc(f[4])} · ${fuStamp(f[0])}</span>` : ''}${state.followOk ? ` <button class="link fu-edit" data-follow="${esc(tote)}">${t('followEdit')}</button>` : ''}</div>`);
  }

  const bySku = new Map();
  lines.forEach(l => {
    const a = bySku.get(l[6]) || { cat: l[5], mq: 0, mv: 0, eq: 0, ev: 0, dq: 0, exp: '' };
    a.mq += l[9]; a.mv += l[7]; a.eq += l[10]; a.ev += l[8]; a.dq += l[12] || 0;
    bySku.set(l[6], a);
  });
  mtd.forEach(m => {
    const a = bySku.get(m[6]) || { cat: m[5], mq: 0, mv: 0, eq: 0, ev: 0, dq: 0, exp: '' };
    a.exp = qtyf(m[10]);
    bySku.set(m[6], a);
  });
  const items = bySku.size ? table(t('itemsHead'),
    [...bySku.entries()].map(([sku, a]) => [mono(sku), esc(a.cat || ''), a.exp || '', a.mq ? qtyf(a.mq) : '', a.mv ? money(a.mv) : '',
      a.eq ? qtyf(a.eq) : '', a.ev ? money(a.ev) : '', a.dq ? qtyf(a.dq) : '']),
    [false, false, true, true, true, true, true, true], { raw: true }) : '';
  const evHtml = ev ? `<div>${ev.lines.map(l => `<div class="ev"><span class="tag ${l.cat}">${l.tag}</span>${l.html}</div>`).join('')}</div>` : '';
  return `<div class="ver"><h4>${mono(tote)} ${ev ? `<span class="tag ${ev.cat}">${catLabel(ev.cat)}</span>` : ''}</h4>
    <div class="facts">${facts.join('') || `<div>${t('noDetails')}</div>`}</div>${evHtml}<div class="scroll">${items}</div></div>`;
}

function transferView(out) {
  const totes = new Set();
  out.lost.forEach(r => totes.add(r[0]));
  out.lines.forEach(r => totes.add(r[1]));
  out.mtd.forEach(r => totes.add(r[1]));
  if (!totes.size) return resultShell(mono(out.q), `<div class="empty">${t('transferEmpty')}</div>`);
  const lostSet = new Set(out.lost.map(r => r[0]));
  const rows = [...totes].sort().map(tote => {
    const ls = out.lines.filter(r => r[1] === tote);
    const p = state.pd.palOf.get(tote);
    const scanned = (state.pd.scans.get(tote) || [])[0];
    return [`<button class="tote mono" data-q="${esc(tote)}">${esc(tote)}</button>`, esc(dsName((ls[0] && ls[0][4]) || '')),
      lostSet.has(tote) ? '<span class="tag gray">Box Lost</span>' : '', money(sum(ls, r => r[7])), money(sum(ls, r => r[8])),
      p ? mono(p.pallet) : '', scanned ? scanned.when.label : ''];
  });
  return resultShell(`${mono(out.q)} <span class="muted">· ${t('transferSub', { n: totes.size })}</span>`,
    table(t('transferHead'), rows, [false, false, false, true, true, false, false], { raw: true }));
}

function palletView(pallet) {
  const pd = state.pd;
  const totes = pd.palTotes.get(pallet);
  if (!totes) return resultShell(mono(pallet), `<div class="empty">${t('palletEmpty')}</div>`);
  const info = pd.palInfo.get(pallet) || {};
  const scanned = pd.palScanned.get(pallet) || new Set();
  const lostIdx = new Map(state.rows.map(r => [r.awb, r]));
  const rows = [...totes].sort().map(tote => {
    const s = (pd.scans.get(tote) || [])[0];
    const l = lostIdx.get(tote);
    return [`<button class="tote mono" data-q="${esc(tote)}">${esc(tote)}</button>`,
      s ? `${s.when.label} <span class="muted">${esc(s.reviewer)}</span>` : `<span class="tag rust">${t('tagNotScanned')}</span>`,
      l ? `<span class="tag ${l.cat}">Box Lost · ${catLabel(l.cat)}</span>` : ''];
  });
  const rev = pd.palReviewed.get(pallet);
  const facts = `<div class="facts"><div>${t('pBranch')} <b>${esc(info.branch || '')}</b></div><div>${t('pCreated')} <b>${localStamp(info.created).label}</b></div>
    <div>${t('pLoc')} <b>${esc(info.loc || '')}</b></div><div>${t('pScanned')} <b>${t('ofN', { a: scanned.size, b: totes.size })}</b>${rev ? ` <span class="muted">${t('pFirst', { t: rev.when.label })}</span>` : ''}</div></div>`;
  return resultShell(mono(pallet), facts + table(t('palletHead'), rows, [false, false, false], { raw: true }) +
    `<div class="hint">${t('palletHint')}</div>`);
}

// ---------- flow ----------
function applyLang() {
  const html = document.documentElement;
  html.lang = LANG;
  html.dir = LANG === 'ar' ? 'rtl' : 'ltr';
  document.title = t('docTitle');
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  const btn = $('lang');
  btn.textContent = t('langBtn');
  btn.lang = LANG === 'ar' ? 'en' : 'ar';
  const whSel = $('wh');
  whSel.innerHTML = `<option value="">${esc(t('allWh'))}</option>` + WHS.map(w => `<option>${w}</option>`).join('');
  whSel.value = state.wh;
}

function setLang(lang) {
  LANG = lang;
  store.set('cpo-lang', lang);
  applyLang();
  if (state.pd) state.rows.forEach(r => describe(r, state.pd));
  if (state.data) render();
  else if (!API_URL) load({});
  renderSearch();
}

function setTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  $('tab-dash').hidden = tab !== 'dash';
  $('tab-lost').hidden = tab !== 'lost';
  history.replaceState(null, '', location.pathname + location.search + (tab === 'lost' ? '#lost' : ''));
}

function metaText() {
  const D = state.data;
  if (!D) return t('loadingData');
  const pulled = utcToCairo(new Date(D.snapshotAt || D.generatedAt).toISOString().slice(0, 19).replace('T', ' ')).label;
  return t('metaLine', {
    from: dm(D.from), to: dm(D.to), latest: dm(D.latest), upd: D.updated ? t('metaUpd', { d: dm(D.updated) }) : '', pulled,
  }) + (state.busy ? ' · ' + t('updating') : '');
}

function render() {
  if (!state.data) return;
  const D = state.data;
  $('meta').textContent = metaText();
  $('from').value = D.from;
  $('to').value = D.to;
  $('from').max = $('to').max = D.latest;
  document.querySelectorAll('#presets button').forEach(b => b.classList.toggle('on', b.dataset.preset === state.preset));
  renderDash();
  renderLost();
  renderReport();
}

function setData(data) {
  if (!state.data) performance.mark('cpo-first-data');
  state.data = data;
  state.rows = state.pd ? analyze(data.lost, data.lines, data.wc, state.pd) : [];
  render();
}

function busy(on, fresh) {
  state.busy = on;
  document.querySelector('main').classList.toggle('loading', on);
  ['apply', 'refresh'].forEach(id => { $(id).disabled = on; });
  $('meta').textContent = on && fresh ? t('loadingRebuild') : metaText();
}

// Periods from the same snapshot only: an hourly rebuild makes the older ones stale.
function remember(data) {
  state.ranges.forEach((d, k) => { if (d.snapshotAt !== data.snapshotAt) state.ranges.delete(k); });
  state.ranges.set(data.from + '|' + data.to, data);
}

function covering(from, to) {
  let best = null;
  state.ranges.forEach(d => {
    if (d.from <= from && to <= d.to && (!best || d.summary.length < best.summary.length)) best = d;
  });
  return best;
}

// A period inside a loaded one, cut on the spot with the same windows the Apps Script uses.
function derive(D, from, to) {
  const lo = shift(from, -1), hi = shift(to, 2);
  const wcLo = shift(from, -2), wcHi = shift(to, 3);
  const lost = D.lost.filter(r => r[5] >= from && r[5] <= to);
  const lostSet = new Set(lost.map(r => r[0]));
  return {
    ...D, from, to, lost,
    summary: D.summary.filter(r => r[0] >= from && r[0] <= to),
    buckets: D.buckets.filter(r => r[0] >= from && r[0] <= to),
    lines: D.lines.filter(r => lostSet.has(r[1]) || (r[10] > 0 && r[2] >= lo && r[2] <= hi)),
    wc: D.wc.filter(r => r[6] >= wcLo && r[6] <= wcHi),
  };
}

function saveLast() {
  const D = state.ranges.get(state.defaultKey || '');
  if (D) idb.set('last|' + API_URL, { data: D, pd: state.pdRaw, savedAt: Date.now() });
}

async function load(params, fresh) {
  if (!API_URL) {
    notice(t('setup'));
    $('meta').textContent = t('waitingApi');
    return;
  }
  const from = params.from || '', to = params.to || '';
  const seq = ++state.seq;
  if (fresh) { state.ranges.clear(); state.searchCache.clear(); }
  if (fresh || !state.pd || Date.now() - state.pdAt > PD_MAX_AGE_MS) refreshPD();
  refreshFollow(fresh);
  const have = !fresh && from && to && covering(from, to);
  if (have) {
    if (state.busy) busy(false);
    setData(derive(have, from, to));
    return;
  }
  busy(true, fresh);
  try {
    const q = { action: 'range', ...params };
    if (fresh) { q.fresh = 1; q.rebuild = 1; }
    const data = await api(q);
    remember(data);
    if (!from && !to) { state.defaultKey = data.from + '|' + data.to; saveLast(); }
    if (seq !== state.seq) return;
    notice('');
    setData(data);
    prefetchMonth();
  } catch (err) {
    if (seq !== state.seq) return;
    notice(`<b>${t('loadFail')}</b> ${esc(err.message)}`, 'error');
    if (!state.data) $('meta').textContent = t('errorMeta');
  } finally {
    if (seq === state.seq) busy(false);
  }
}

// Month to date covers every preset, so after the first view it loads quietly in the background.
function prefetchMonth() {
  const latest = state.data && state.data.latest;
  if (!latest || state.prefetching) return;
  const from = latest.slice(0, 8) + '01';
  if (covering(from, latest)) return;
  state.prefetching = api({ action: 'range', from, to: latest })
    .then(remember)
    .catch(() => {})
    .finally(() => { state.prefetching = null; });
}

// Opens on the last view saved in this browser, then refreshes it.
async function boot() {
  const last = API_URL ? await idb.get('last|' + API_URL) : null;
  if (last && last.data && !state.data) {
    if (last.pd) {
      state.pdRaw = last.pd;
      state.pd = indexPD(last.pd.disp, last.pd.scans, last.pd.hist);
    }
    setData(last.data);
  }
  load({});
}

function presetRange(p) {
  const latest = (state.data && state.data.latest) || '';
  if (!latest) return {};
  if (p === 'day') return { from: latest, to: latest };
  if (p === 'month') return { from: latest.slice(0, 8) + '01', to: latest };
  return { from: shift(latest, -6), to: latest };
}

function bind() {
  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  $('lang').addEventListener('click', () => setLang(LANG === 'ar' ? 'en' : 'ar'));
  $('presets').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    state.preset = b.dataset.preset;
    load(presetRange(state.preset));
  });
  $('apply').addEventListener('click', () => {
    state.preset = '';
    load({ from: $('from').value, to: $('to').value });
  });
  $('refresh').addEventListener('click', () => load(state.data ? { from: state.data.from, to: state.data.to } : {}, true));
  $('wh').addEventListener('change', e => { state.wh = e.target.value; if (state.data) { renderDash(); renderLost(); } });
  $('trend-table-btn').addEventListener('click', () => { state.trendTable = !state.trendTable; renderDash(); });
  $('ds-more').addEventListener('click', () => { state.dsAll = !state.dsAll; renderDash(); });
  $('cat-more').addEventListener('click', () => { state.catAll = !state.catAll; renderDash(); });
  $('cats').addEventListener('click', e => {
    const b = e.target.closest('.cat');
    if (!b) return;
    state.cat = b.dataset.cat;
    renderLost();
  });
  $('lost-day').addEventListener('change', e => { state.day = e.target.value; renderLost(); });
  $('lost-ds').addEventListener('change', e => { state.ds = e.target.value; renderLost(); });
  $('lost-csv').addEventListener('click', downloadCSV);
  $('lost-follow').addEventListener('change', e => { state.fstatus = e.target.value; renderLost(); });
  $('follow-form').addEventListener('submit', saveFollow);
  $('fu-cancel').addEventListener('click', () => $('follow-dlg').close());
  $('report-btn').addEventListener('click', openReport);
  $('rp-close').addEventListener('click', closeReport);
  $('rp-day').addEventListener('change', e => { state.report.day = e.target.value; renderReport(); });
  $('rp-evidence').addEventListener('change', e => { state.report.evidenceOnly = e.target.checked; renderReport(); });
  $('rp-png').addEventListener('click', reportPng);
  $('rp-copy').addEventListener('click', reportCopy);
  $('rp-pdf').addEventListener('click', reportPdf);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('report-overlay').hidden) closeReport(); });
  $('search-form').addEventListener('submit', e => { e.preventDefault(); search($('search').value); });
  document.addEventListener('click', e => {
    const fu = e.target.closest('button[data-follow]');
    if (fu) { openFollow(fu.dataset.follow); return; }
    const b = e.target.closest('button.tote[data-q]');
    if (b) {
      if (state.tab !== 'lost') setTab('lost');
      search(b.dataset.q);
      $('search-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (e.target.closest('[data-close]')) { state.search = null; $('search-result').innerHTML = ''; }
  });
}

applyLang();
bind();
setTab(state.tab);
boot();

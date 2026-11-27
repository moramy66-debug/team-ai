# سجل التغييرات (Changelog)

جميع التغييرات الجوهرية في مشروع **Team AI** موثقة في هذا الملف.

## [v126 - v162] - 2026-11-27

الاسم الجديد للتطبيق: **Ramz (رمز)**. اسم الـ repo ومفاتيح التخزين وبادئة `CACHE_NAME` (`teamai-v...`) فضلت زي ما هي.

### حاسبات ووحدات اتضافت
- **Isc Network (`js/eng-isc.js`, `tools/eng-isc-test.js`) - v161:** تبويب جديد في Eng Calc بـ 4 طرق: MVA (Grid + Transformer)، Fault Level معطى، Ohmic (R, X مع Cable و c factor اختياريين)، وPeak من Isc معطى. كل النتايج `needs_review`. فيه حماية للقيم الصفرية والسالبة. الاختبارات بقيم محسوبة يدويا (مثلا 500 MVA و1000 kVA و5 % و400 V بتدّي 27.757 kA). اتضاف في `index.html` و`sw.js` و`lint.yml`.
- **PFC (`js/eng-pfc-cpc.js`) - v153:** حساب تيار الـ Capacitor من kVAR.
- **Generator (`js/eng-generator.js`) - v153:** Derating Factor يدوي. v150: حقل جديد "Motor Power Factor (PF)" بقيمة افتراضية 0.85 قابلة للتعديل، وبيتقال في النتيجة لما القيمة الافتراضية تُستخدم (`needs_review`).
- **Projects MVP (`js/projects.js`, `tools/projects-test.js`) - v142:** مشاريع بملاحظات، وربط المحادثات بمشروع من غير ما المحادثات القديمة تتغير. الاختبارات 28 حالة.
- **Copy Review Prompt (`js/review-prompt.js`, `tools/review-prompt-test.js`) - v132:** زر على كل نتيجة في Eng Calc بيبني Prompt مراجعة فيه المدخلات والافتراضات والخطوات والمصادر. بيتنسخ بس ومبيتبعتش لأي مكان. v141: زر "Review Prompt" لنتايج الـ AI في المحادثة. v144 و v145: تعديل صياغة (Method يظهر "In Air (Method C)" وملاحظة إن شرط الحماية I2 <= 1.45 Iz ما اتحسبش لوحده وتنبيه الـ ambient).
- **Source popup (`js/source-info.js`, `tools/source-info-test.js`) - v129 و v130:** علامة مرقمة لكل مصدر وعلامة "i" في كل خطوة، بتفتح ورقة فيها الجدول والحالة والمصدر والصفحة والبند والإصدار. أي حقل ناقص بيظهر "غير مسجل" والمصدر الناقص "المصدر غير مسجل". الـ PDF بقى فيه قسم "المصادر وحالتها".
- **زر Eng Calc في الـ sidebar على الديسكتوب - v146.**
- **Code Ref:** badge جديد "Verified Secondary" (v152).

### تصحيحات الحسابات والتحقق من المدخلات
- **v150:** Voltage = 0 وDemand Factor سالب وTransformer Z = 0 بقوا رسايل خطأ واضحة بدل قيم افتراضية بصمت. الحقول الفاضية لسه بتاخد الافتراضي.
- **v150:** Generator وLighting وTransformer وUPS وCable Tray كانت بتعرض صندوق نتيجة فاضي لما التحقق يفشل. دلوقتي الرسالة بتظهر بالأحمر، والضغطات المتكررة بتستبدل النتيجة بدل ما تتراكم.
- **v150:** Lighting بيعرض Lux وW/m2 عند N المحسوب وعند الـ Grid.
- **v151:** Load Schedule: PF خارج (0, 1] لأي حِمل بيدّي خطأ فيه رقم الحِمل والقيمة، وجهد اللوحة صفر أو أقل بيدّي خطأ. الحقل الفاضي لسه 0.85 و400 V.
- **v147:** أي Power Factor مدخل خارج (0, 1] بيدّي خطأ في Cable Sizing وVoltage Drop وGenerator. لو طول الكابل ناقص مع Limit بيظهر تنبيه "Voltage Drop لم يتحقق منه" وبتتضاف عبارة "Voltage Drop غير مفحوص" للملخص. تحذير في UPS إن الـ kVA هو Output Rating. اتشال "IEC 60364-4-43" من تحذير الحماية.
- **v148:** نص خطوة Constant k بقى "k من جدول k المسجل (XLPE_EPR, Cu, 90 إلى 250 C)" من غير رقم معيار.
- **v143:** حذف التحذيرات المكررة في العرض والـ Review Prompt والـ PDF (عرض بس).
- **v154:** تسميات Transformer بإنجليزي بسيط، والأزرار بقت "Calculate X Size".
- **اختبارات:** `tools/eng-guard-test.js` اتضاف (v128) وبعدين اتحدثت، واتضافت اختبارات لـ PF وطول الكابل وPF الموتور وLoad Schedule.
- **Harness (100 حالة، أداة محلية مش مشحونة):** بعد v150: 56 PASS + 18 PASS (memory)، FAIL 2 (#31 بالتصميم، و #64 step_load بسبب تناقض في الـ vector)، KNOWN 2 (#71 و #75). بعد Isc Network (v161): 66 PASS و10 UNMAPPED، والتغيير الوحيد كان الحالات #55 لحد #62 (من UNMAPPED لـ PASS) ومفيش رقم موجود اتغير.

### تخفيض الحالة في الجداول وCode Library
- **v128 (`data/eng-tables.json`):** 14 جدول `verified_mirror` وجدول واحد `verified_mirror_old_edition` بقوا `verified_secondary`. النتيجة 21 `verified_secondary` و3 `from_memory_needs_review`. مفيش حاجة اترفعت. السياسة (الحد الأقصى `verified_secondary`) اتكتبت في `_readme` للملف. مصدر SERA في `eng-pfc-cpc.js` اتخفض بنفس الطريقة.
- **v152 (`data/code-library.json`):** الـ 3 entries اللي كانت `verified_mirror` (`sbc401-scope-systems` و`sec-pv-mv-voltages` و`sec-dc-fault-isolation`) بقوا `verified_secondary`. مفيش أرقام بنود اتضافت. الـ 7 التانيين لسه `needs_review`.

### تعديلات الأمان والخصوصية (v128)
- **Session-only keys:** خيار جديد في Settings (`js/key-session.js`) بيخلي المفاتيح في `sessionStorage` بس ويشيلها من `localStorage`. بيتطبق بعد ضغطة Save.
- **Worker:** `ALLOWED_ORIGIN` في `worker/wrangler.toml` بقى `https://moramy66-debug.github.io` والافتراضي في `worker/api-proxy.js` بقى نفس الـ origin بدل `*`.
- **تنويه:** سطر فوق Effort Level بيقول إن نص المهمة والملفات بتروح لمزود الـ AI المختار.
- **a11y:** `js/a11y-polish.js` اتضاف.

### الواجهة والموبايل (390px)
- **v133 لـ v138:** خطوات الحساب على الموبايل بقت Cards بدل جدول مقصوص. إصلاح اتجاه RTL/LTR (Bidi) في خانات المعادلة والتعويض (عرض بس، النسخ والـ PDF زي ما هم). زر المصدر "i" بقى مسطح بمساحة لمس 44px. حقول موديل Settings بعرض كامل.
- **v139 و v140:** الوضع الفاتح: شرائح القوالب بيضا ومسطحة، شريط الفئات بقى صف واحد قابل للتمرير، اتشال الشريط الرمادي، وزر الثيم بقى SVG بدل emoji وتسميته "Dark" أو "Light".
- **v155 و v156:** تحسين الصفحة الرئيسية للموبايل: وضوح زر Start، زري Stop وTeam Log بأيقونة بس، شرائح بتلف، وتلاشي على حافة صف الفلاتر. كلمة "القائمة" بقت "Menu". خانة "Email me the result" اتنقلت لليسار. وسم `needs_review` في التحذيرات بيظهر "needs review".
- **v162:** إصلاح الوضع الفاتح: كروت الخطوات في Eng Calc على الموبايل كانت بخلفية داكنة ونص داكن فمش باين. السبب إن `--card2` مش معرّف في الثيم الفاتح. اتضافت قيمته (`#eef2f8`). الثيم الداكن ماتأثرش.
- فحص 15 تبويب في Eng Calc في الثيم الداكن على 390px من غير Overflow أفقي (من غير تغيير كود).

### إزالة أرقام المعايير من نصوص الواجهة (v157)
- بناء على قرار المستخدم، كل أرقام المعايير اتشالت من نصوص الواجهة. تسميات المصدر بقت "the applicable standard; source not recorded". الملفات: `eng-calc.js` و`eng-cabletray.js` و`eng-generator.js` و`eng-pfc-cpc.js` و`eng-ups.js` و`eng-calc-test.js` و`index.html`. معرفات الجداول الداخلية في البيانات (مفاتيح) فضلت زي ما هي.

### Ramz والشعار
- **v158:** الاسم Ramz (رمز) في الواجهة. الشعار B (حرف R مع موجة) كـ SVG مدمج، وأيقونة المتصفح وأيقونة Apple وأيقونات PWA (192 و512 و512 maskable) جوه `manifest.webmanifest`. اتعدلت ملفات `index.html` و`css/styles.css` و`js/eng-pdf.js` و`js/files-and-export.js` و`js/review-prompt.js` و`js/team-extras.js`.
- **v159 و v160:** كارت البراند في المنتصف في الـ sidebar والـ drawer، وزيادة padding علوي للـ drawer (76px على 760px وأقل).

### Service Worker (`sw.js`)
- `CACHE_NAME` اتحدّث من `teamai-v126` لـ `teamai-v162`. أضيف `./js/eng-isc.js` لـ `CORE_ASSETS` وأضيفت اختبارات `eng-isc-test.js` في `lint.yml`.

## [المهمة 24] - 2026-11-27
### الميزات الجديدة
- **حاسبة UPS + Battery Sizing (`js/eng-ups.js`):** إضافة وحدة حسابية جديدة (IIFE بدون تعريفات top-level) لتقدير سعة جهاز الـ UPS المطلوبة والمقاس القياسي (kVA)، وقدرة البطارية (kW) وتيار الـ DC عند نهاية التفريغ (EOD)، وسعة وطاقة البطارية (Ah/kWh) مع معاملات التقادم والحرارة وهامش التصميم، بالإضافة إلى التحقق العكسي لمدة التشغيل عند إدخال سعة البطارية (Ah)، مع توثيق الثوابت بحالة `from_memory_needs_review` و`source: null`.
- **اختبارات UPS (`tools/eng-ups-test.js`):** إضافة اختبارات Node مستقلة تتضمن 4 حالات محسوبة يدويا وحالات حدية وفحص حالة الثوابت.

## [v106 - v122] - 2026-11-27
### إصلاحات وتحسينات
- **steps كـ objects:** إصلاح معالجة `RCK.steps` (v110/v111) بعد كسر في التنفيذ.
- **iOS و390px:** خطوط 16px للحقول ومساحات لمس 44px بدون overflow أفقي (v112).
- **Contrast وRTL وfocus:** تحسين التباين والاتجاه RTL وحلقات التركيز (4dbe50c, 2113b4f).
- **إصلاح عاجل لـ `sw.js`:** إصلاح خطأ syntax (علامة اقتباس ناقصة) من commit 268c3c5، في b23bc38 (v117).
- **جدول I2t:** إضافة جدول I2t إلى `data/eng-tables.json` (إجمالي 23 جدولاً ثم 24).
- **dupcheck STRICT:** تحويل فحص التكرار إلى وضع STRICT.
- **CSS لـ Code Ref:** اللوحة كانت تستخدم متغيرات غير معرفة فتظهر داكنة؛ أصبحت تتبع الثيم الفاتح/الداكن (b64eaa5).
- **اختبارات:** إضافة `tools/code-library-test.js` (حقول، حالات، تكرار، `source_url`، ولا أرقام بوحدات في `needs_review`) وربطه في `lint.yml`.
- **جداول BS 7671:** 4D1A (16 mm2 = 56 A، والـ 59 خطأ نسخ في مصدر واحد) و4D1B (2.8 / 2.4 mV/A/m) بحالة `verified_secondary` من 4 مرايا عامة بدون النص الرسمي. إضافة جدول حدود هبوط الجهد من IEC 60364-5-52 كمعلومة إرشادية بحالة `needs_review` (ليس نص SBC 401). إجمالي الجداول 24.
- **نطاق SEC:** مدخلا SEC الموثقان (`sec-pv-mv-voltages`, `sec-dc-fault-isolation`) أُعيدت صياغتهما ليخصا Solar PV أكبر من 2 MW فقط.

## [المهمة 2] - 2026-11-27
### إضافات
- **Code Ref:** مرجع أكواد SBC 401 وSEC في `data/code-library.json` و`js/code-library.js` (10 مدخلات: 3 `verified_mirror` و7 `needs_review`)، وتفعيله في `index.html` و`sw.js`.
- المصادر: صفحة SBC 401 على sbc.gov.sa ووثيقة SEC PV Large Scale Technical Connection Standards (نطاقها Solar PV أكبر من 2 MW).

## [المهمة 1] - 2026-11-27

### الإضافات
- إضافة حاسبات الإضاءة (Lumen Method - `js/eng-lighting.js`)، والـ Cable Tray (`js/eng-cabletray.js`)، والمحول (`js/eng-transformer.js`)، والمولد (`js/eng-generator.js`) وملفات اختبارها (`tools/*-test.js`، تعمل في lint)، وبقية تبويبات Eng Calc (PFC وCPC وSLD وLoad Schedule وSubmittal)، وربطها في `index.html` و`sw.js`.

## [v88 - v89] - 2026-11-26

### التحسينات وتنظيف الواجهة
- **تنظيف شريط الأدوات (`js/ui-tidy.js`):** إضافة قائمة `More` لجمع الأزرار الثانوية، وإضافة فلاتر القوالب لتحسين تجربة المستخدم.
- **تحديث الأدوات المساعدة (`js/pro-tools.js`):** إزالة زر `#calcBtn` وتبويب الحاسبة القديمة ودوال `calcCurrent` / `calcVdrop`، وجعل `backup` التبويب الافتراضي، وتحديث نافذة المساعدة للإشارة إلى `Eng Calc`.
- **الحاسبة الهندسية والتحقق (`js/eng-shortcircuit-ui.js`, `js/eng-crosscheck.js`, `js/eng-pdf.js`, `data/eng-tables.json`):** دعم حسابات القصر، والمقارنة الديتيرمنستيك (`cross-check`)، وتصدير PDF بصيغة صور A4 على جانب العميل، و22 جدولاً هندسياً مع حقول `status` و`source`.
- **Service Worker (`sw.js`):** تحديث `CACHE_NAME` وإضافة `'./js/ui-tidy.js'` إلى `CORE_ASSETS`.

## [v81] - 2026-11-26
### المضاف والمحسّن
- **تحسين قراءة التقارير (`css/styles.css`):** ضبط `line-height: 1.75` وتباعد مريح للعناوين والفقرات داخل `#finalView`.
- **تنسيق الجداول في التقارير:** إضافة صفوف متبادلة اللون (Zebra Striping)، حدود ناعمة، ودعم التمرير الأفقي على الشاشات الصغيرة.
- **استجابة الشريط العلوي والتحول السلس:** تفعيل `flex-wrap: wrap` وتنسيق متوازن للأزرار في `.topbar` على الموبايل، مع `transition` ناعم عند تبديل الوضع الفاتح/الداكن.
- **الدليل السريع (`js/pro-tools.js`):** إضافة زر `?` (`#helpBtn`) في `.topbar` يفتح نافذة مساعدة مختصرة من 4 خطوات (إضافة مفتاح API، رفع الأكواد الهندسية، استخدام الحاسبة والترويسة، والنسخ الاحتياطي).
- **التوثيق والترخيص:** تحديث `README.md` بروابط التشغيل المباشر والفحص وهيكل المشروع، وإنشاء `CHANGELOG.md` و`LICENSE` (رخصة MIT).
- **Service Worker (`sw.js`):** تحديث `CACHE_NAME` إلى `'teamai-v81'`.

## [v78 - v80]
### المضاف والمحسّن
- **الأدوات الاحترافية (`js/pro-tools.js`):** إضافة الحاسبة الهندسية السريعة، إدارة ترويسة المكتب، وأداة النسخ الاحتياطي والاستعادة (JSON).
- **الوضع الفاتح والداكن وتنسيق الطباعة (`css/styles.css`):** دعم تبديل الثيم الفاتح/الداكن وتحسين قواعد `@media print` لإخراج تقارير PDF نظيفة.
- **قاعدة بيانات الأكواد (`codes-data.json`):** دمج بيانات الأكواد الهندسية المرجعية (`SBC 401`، `IEC 60364`، `SEC DPS`) وتحسين البحث عبر `js/code-search.js`.

## [v74 - v77]
### المضاف والمحسّن
- **البث المباشر (Streaming) والتحقق:** تفعيل البث اللحظي لردود الوكلاء في `js/orchestrator.js` مع خطوات التحقق من الحسابات والمراجع الهندسية.
- **صفحة الفحص (`check.html`):** إضافة صفحة مخصصة للتحقق من سلامة المكونات والاتصال.
- **تحسين التخزين والأمان:** دعم `IndexedDB` عبر `js/storage-idb.js` وتنقية المخرجات عبر `js/sanitize.js`.

## [v73-good]
### الأساس المستقر
- إطلاق النسخة المستقرة الأساسية لمنصة الوكلاء المتعددين (`RCK.steps`) بواجهة عربية (`RTL`) وتطبيق ويب تقدمي (`PWA`) يدعم العمل دون اتصال.
- دعم استيراد ملفات PDF وExcel وتصدير التقارير، مع تعدد مزودي الذكاء الاصطناعي (Gemini، Groq، OpenRouter، OpenAI، Claude).
